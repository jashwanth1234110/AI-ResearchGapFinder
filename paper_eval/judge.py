"""LLM-as-judge over the pooled candidate set. Resumable, blinded, fully logged.

Judge A = claude-sonnet-4-6, temperature=0.
Judge B = claude-opus-5 -- sampling params are REMOVED on this model (400 if
sent), so determinism is approached via output_config.effort instead. This is
stated in eval_results.md rather than claimed as "temperature 0".

Blinding: the judge never sees the pipeline verdict, the OpenAlex hit count, the
prominence score, or which method produced the candidate. Order is shuffled.
"""
import json, pathlib, random, sys, time, os, hashlib, threading
ROOT = pathlib.Path("/Users/suchithreddy/Desktop/Developer/researchgap-ai")
from dotenv import load_dotenv
load_dotenv(ROOT/"engine/.env")
import httpx, anthropic

SEED = 42
LOG = ROOT/"paper_eval/judge_logs"; LOG.mkdir(exist_ok=True)
RESULTS = ROOT/"paper_eval/judge_results.jsonl"
JUDGES = {"A": {"model": "claude-sonnet-4-6", "temp": 0},
          "B": {"model": "claude-opus-5",     "temp": None}}
PRICE = {"claude-sonnet-4-6": (3.0, 15.0), "claude-opus-5": (5.0, 25.0)}
FROM_YEAR = 2021  # "last 5 years" relative to the 2026 runs

JUDGE_SYS = (
 "You are an expert research-literature reviewer assessing whether a proposed "
 "research gap is genuine. You are given two research topics and a sample of "
 "recent literature retrieved for their intersection. Decide using ONLY that "
 "evidence plus your own domain knowledge.\n\n"
 "A gap is GENUINE if the specific intersection of the two topics is materially "
 "under-researched. It is ALREADY ADDRESSED if the retrieved literature contains "
 "work that directly studies that intersection.\n\n"
 "Return ONLY a JSON object, no prose, with exactly these keys:\n"
 '  "genuine_gap": "yes" or "no"\n'
 '  "already_addressed": "yes" or "no"\n'
 '  "addressing_paper_ids": array of evidence ids (e.g. ["P1","P4"]), [] if none\n'
 '  "meaningful": integer 1-5 (is the research direction worth pursuing)\n'
 '  "evidence_sufficient": integer 1-5 (was the retrieved evidence enough to judge)\n'
 '  "importance": integer 1-10 (importance of this gap relative to others in the field)\n'
 '  "rationale": one or two sentences\n'
)

_s2_lock = threading.Lock(); _s2_last = [0.0]
def s2_search(q, limit=10):
    with _s2_lock:
        wait = 3.0 - (time.time() - _s2_last[0])
        if wait > 0: time.sleep(wait)
        _s2_last[0] = time.time()
    try:
        r = httpx.get("https://api.semanticscholar.org/graph/v1/paper/search",
            params={"query": q, "limit": limit, "fields": "title,abstract,year",
                    "year": f"{FROM_YEAR}-"},
            headers={"x-api-key": os.getenv("S2_API_KEY", "")}, timeout=30)
        if r.status_code != 200: return []
        return [{"title": p.get("title") or "", "abstract": (p.get("abstract") or "")[:1200],
                 "year": p.get("year"), "source": "S2"}
                for p in r.json().get("data", []) if p.get("abstract")]
    except Exception: return []

def oa_search(q, limit=10):
    p = {"search": q, "per-page": limit,
         "filter": f"from_publication_date:{FROM_YEAR}-01-01,has_abstract:true",
         "mailto": os.getenv("OPENALEX_MAILTO")}
    if os.getenv("OPENALEX_API_KEY"): p["api_key"] = os.getenv("OPENALEX_API_KEY")
    try:
        r = httpx.get("https://api.openalex.org/works", params=p, timeout=30)
        if r.status_code != 200: return []
        out = []
        for w in r.json().get("results", []):
            inv = w.get("abstract_inverted_index") or {}
            pos = {}
            for word, idxs in inv.items():
                for i in idxs: pos[i] = word
            ab = " ".join(pos[i] for i in sorted(pos))[:1200]
            if ab: out.append({"title": w.get("title") or "", "abstract": ab,
                               "year": w.get("publication_year"), "source": "OpenAlex"})
        return out
    except Exception: return []

def build_pool():
    pool = []
    abl = json.loads((ROOT/"paper_eval/ablation_candidates.json").read_text())
    seen = {}
    for query, variants in abl.items():
        for variant, cands in variants.items():
            for c in cands:
                key = (query, str(c["topic_a"]), str(c["topic_b"]))
                if key in seen:
                    seen[key]["methods"].append(variant); continue
                cid = "C" + hashlib.sha1("|".join(key).encode()).hexdigest()[:10]
                rec = {"candidate_id": cid, "query": query, "methods": [variant],
                       "topic_a": str(c["topic_a"]), "topic_b": str(c["topic_b"]),
                       "keywords_a": c.get("keywords_a") or [], "keywords_b": c.get("keywords_b") or [],
                       "prominence": c.get("prominence"), "bridge_papers": c.get("bridge_papers"),
                       "size_a": c.get("size_a"), "size_b": c.get("size_b")}
                seen[key] = rec; pool.append(rec)
    llm = json.loads((ROOT/"paper_eval/llm_only_candidates.json").read_text())
    for query, cands in llm.items():
        for c in cands:
            key = (query, str(c["topic_a"]), str(c["topic_b"]))
            if key in seen:
                seen[key]["methods"].append("llm_only"); continue
            cid = "C" + hashlib.sha1("|".join(key).encode()).hexdigest()[:10]
            rec = {"candidate_id": cid, "query": query, "methods": ["llm_only"],
                   "topic_a": str(c["topic_a"]), "topic_b": str(c["topic_b"]),
                   "keywords_a": c.get("keywords_a") or [], "keywords_b": c.get("keywords_b") or [],
                   "prominence": None, "bridge_papers": None,
                   "size_a": None, "size_b": None}
            seen[key] = rec; pool.append(rec)
    random.Random(SEED).shuffle(pool)
    return pool

def parse_json(txt):
    t = txt.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
    try: return json.loads(t)
    except json.JSONDecodeError:
        i, j = t.find("{"), t.rfind("}")
        if i >= 0 and j > i:
            try: return json.loads(t[i:j+1])
            except json.JSONDecodeError: return None
    return None

def main():
    pool = build_pool()
    (ROOT/"paper_eval/candidate_pool.json").write_text(json.dumps(pool, indent=2))
    done = set()
    if RESULTS.exists():
        for line in RESULTS.read_text().splitlines():
            try:
                r = json.loads(line); done.add((r["judge"], r["candidate_id"]))
            except Exception: pass
    todo = [(j, c) for c in pool for j in ("A", "B") if (j, c["candidate_id"]) not in done]
    print(f"pool={len(pool)} candidates | already judged={len(done)} | to do={len(todo)}", flush=True)
    clients = {j: anthropic.Anthropic(timeout=240.0, max_retries=3) for j in JUDGES}
    usage = {j: {"in": 0, "out": 0} for j in JUDGES}
    t_start = time.time()
    with RESULTS.open("a") as fh:
        for n, (jid, cand) in enumerate(todo, 1):
            spec = JUDGES[jid]; cl = clients[jid]
            # 1. judge writes its own query
            qprompt = (f"Topics:\nA: {', '.join(cand['keywords_a']) or cand['topic_a']}\n"
                       f"B: {', '.join(cand['keywords_b']) or cand['topic_b']}\n"
                       "Write ONE literature-search query to find papers addressing BOTH "
                       "topics together. Reply with the query only, no quotes, no prose.")
            kw = {"model": spec["model"], "max_tokens": 600,
                  "messages": [{"role": "user", "content": qprompt}]}
            if spec["temp"] is not None: kw["temperature"] = spec["temp"]
            else: kw["output_config"] = {"effort": "low"}
            try:
                qr = cl.messages.create(**kw)
                usage[jid]["in"] += qr.usage.input_tokens; usage[jid]["out"] += qr.usage.output_tokens
                _txt = "".join(b.text for b in qr.content if b.type == "text").strip()
                _lines = [l for l in _txt.splitlines() if l.strip()]
                if not _lines:
                    raise ValueError("judge returned no text for the query prompt")
                squery = _lines[0][:200]
                qfallback = False
            except Exception as e:
                squery = f"{' '.join(cand['keywords_a'][:2])} {' '.join(cand['keywords_b'][:2])}".strip()
                qfallback = True
                print(f"  [{n}] query-gen failed ({type(e).__name__}); using fallback", flush=True)
            # 2. retrieval
            ev_raw = (oa_search(squery, 10) + s2_search(squery, 10))[:10]
            ev = [{"id": f"P{i+1}", **e} for i, e in enumerate(ev_raw)]
            # 3. blinded judgment
            user = (f"TOPIC A: {cand['topic_a']}\nkeywords: {', '.join(cand['keywords_a'])}\n"
                    f"TOPIC B: {cand['topic_b']}\nkeywords: {', '.join(cand['keywords_b'])}\n\n"
                    f"Proposed gap: the intersection of Topic A and Topic B is under-researched.\n\n"
                    f"SEARCH QUERY YOU WROTE: {squery}\n"
                    f"RECENT LITERATURE RETRIEVED ({len(ev)} papers, {FROM_YEAR}+):\n"
                    f"{json.dumps([{k: e[k] for k in ('id','title','year','abstract')} for e in ev], indent=1)}")
            kw2 = {"model": spec["model"], "max_tokens": 2500, "system": JUDGE_SYS,
                   "messages": [{"role": "user", "content": user}]}
            if spec["temp"] is not None: kw2["temperature"] = spec["temp"]
            else: kw2["output_config"] = {"effort": "low"}
            try:
                jr = cl.messages.create(**kw2)
                usage[jid]["in"] += jr.usage.input_tokens; usage[jid]["out"] += jr.usage.output_tokens
                raw = "".join(b.text for b in jr.content if b.type == "text")
                verdict = parse_json(raw)
                err = None if verdict else "unparseable_json"
            except Exception as e:
                raw, verdict, err = "", None, f"{type(e).__name__}: {str(e)[:150]}"
            rec = {"judge": jid, "model": spec["model"], "candidate_id": cand["candidate_id"],
                   "query": cand["query"], "methods": cand["methods"],
                   "search_query": squery, "query_was_fallback": qfallback, "n_evidence": len(ev),
                   "verdict": verdict, "error": err, "ts": time.time()}
            fh.write(json.dumps(rec) + "\n"); fh.flush()
            (LOG/f"{cand['candidate_id']}_{jid}.json").write_text(json.dumps(
                {"judge": jid, "model": spec["model"],
                 "sampling": ("temperature=0" if spec["temp"] is not None else "effort=low (temperature unsupported)"),
                 "system_prompt": JUDGE_SYS, "query_prompt": qprompt, "search_query": squery,
                 "evidence": ev, "user_prompt": user, "raw_response": raw,
                 "parsed": verdict, "error": err}, indent=2))
            if n % 10 == 0 or n == len(todo):
                cost = sum(usage[j]["in"]/1e6*PRICE[JUDGES[j]["model"]][0] +
                           usage[j]["out"]/1e6*PRICE[JUDGES[j]["model"]][1] for j in JUDGES)
                el = time.time() - t_start
                print(f"  [{n}/{len(todo)}] {el/60:.1f}min elapsed, "
                      f"~{el/n*(len(todo)-n)/60:.0f}min left, cost so far ${cost:.2f}", flush=True)
    cost = {j: usage[j]["in"]/1e6*PRICE[JUDGES[j]["model"]][0] + usage[j]["out"]/1e6*PRICE[JUDGES[j]["model"]][1] for j in JUDGES}
    (ROOT/"paper_eval/judge_cost.json").write_text(json.dumps(
        {"usage": usage, "usd": {j: round(c,4) for j,c in cost.items()},
         "total_usd": round(sum(cost.values()),4)}, indent=2))
    print(f"\nTOTAL JUDGE COST: ${sum(cost.values()):.2f}  {json.dumps(usage)}")

if __name__ == "__main__":
    main()
