"""Builds ONE real judge prompt (with real retrieval) and counts its tokens,
so the cost estimate is measured rather than assumed. One tiny API call."""
import json, sys, pathlib, time, os
sys.path.insert(0, "/Users/suchithreddy/Desktop/Developer/researchgap-ai/engine")
ROOT = pathlib.Path("/Users/suchithreddy/Desktop/Developer/researchgap-ai")
from dotenv import load_dotenv
load_dotenv(ROOT/"engine/.env")
import httpx, anthropic

cands = json.loads((ROOT/"paper_eval/ablation_candidates.json").read_text())
c = cands["marine biology"]["full"][0]

JUDGE_SYS = (
 "You are an expert research-literature reviewer assessing whether a proposed "
 "research gap is genuine. You are given two research topics and a sample of "
 "recent literature retrieved for their intersection. Decide using ONLY that "
 "evidence plus your own domain knowledge of the field.\n\n"
 "Return ONLY a JSON object with these keys:\n"
 '  "genuine_gap": "yes"|"no"\n'
 '  "already_addressed": "yes"|"no"\n'
 '  "addressing_paper_ids": [list of ids from the evidence that address it]\n'
 '  "meaningful": 1-5\n'
 '  "evidence_sufficient": 1-5\n'
 '  "importance_rank": integer (1 = most important within this query)\n'
 '  "rationale": one or two sentences\n'
)
mailto = os.getenv("OPENALEX_MAILTO"); oakey = os.getenv("OPENALEX_API_KEY")
q = f'"{c["keywords_a"][0]}" "{c["keywords_b"][0]}"'
p = {"search": q, "per-page": 10, "filter": "from_publication_date:2021-01-01,has_abstract:true", "mailto": mailto}
if oakey: p["api_key"] = oakey
r = httpx.get("https://api.openalex.org/works", params=p, timeout=30)
works = r.json().get("results", [])[:10]
def abstract(w):
    inv = w.get("abstract_inverted_index") or {}
    if not inv: return ""
    pos = {}
    for word, idxs in inv.items():
        for i in idxs: pos[i] = word
    return " ".join(pos[i] for i in sorted(pos))[:1200]
ev = [{"id": f"P{i+1}", "title": w.get("title"), "year": w.get("publication_year"),
       "abstract": abstract(w)} for i, w in enumerate(works)]
user = (f"TOPIC A: {c['topic_a']}\nkeywords: {', '.join(c['keywords_a'])}\n"
        f"TOPIC B: {c['topic_b']}\nkeywords: {', '.join(c['keywords_b'])}\n\n"
        f"Proposed gap: is the intersection of Topic A and Topic B under-researched?\n\n"
        f"RECENT LITERATURE RETRIEVED FOR THIS INTERSECTION ({len(ev)} papers):\n"
        f"{json.dumps(ev, indent=1)}")
client = anthropic.Anthropic(timeout=60.0)
n = client.messages.count_tokens(model="claude-sonnet-4-6", system=JUDGE_SYS,
                                 messages=[{"role": "user", "content": user}])
print(f"papers retrieved: {len(ev)}")
print(f"MEASURED judgment-prompt input tokens: {n.input_tokens}")
qn = client.messages.count_tokens(model="claude-sonnet-4-6",
      messages=[{"role":"user","content":
        f"Topics:\nA: {', '.join(c['keywords_a'])}\nB: {', '.join(c['keywords_b'])}\n"
        "Write ONE literature-search query to find papers addressing BOTH topics. "
        "Reply with the query only."}])
print(f"MEASURED query-prompt input tokens:    {qn.input_tokens}")
(ROOT/"paper_eval/judge_logs/_measured_prompt_sample.json").write_text(
    json.dumps({"judgment_input_tokens": n.input_tokens, "query_input_tokens": qn.input_tokens,
                "papers": len(ev), "sample_candidate": {k: c[k] for k in ("topic_a","topic_b")}}, indent=2))
