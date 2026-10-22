"""Table IX baseline: ask claude-sonnet-4-6 for 8 research gaps per query with
NO retrieval at all. Its gaps enter the same blinded judging pool as every
other method, so the comparison is like-for-like."""
import json, pathlib, sys, time
ROOT = pathlib.Path("/Users/suchithreddy/Desktop/Developer/researchgap-ai")
from dotenv import load_dotenv
load_dotenv(ROOT/"engine/.env")
import anthropic

QUERIES = {
    "medical imaging":   "medical image segmentation",
    "marine biology":    "marine biology",
    "migraine research": "migraine prediction machine learning",
    "drug discovery":    "graph neural networks drug discovery",
    "cell segmentation": "cell segmentation",
}
MODEL = "claude-sonnet-4-6"
client = anthropic.Anthropic(timeout=180.0, max_retries=2)
LOG = ROOT/"paper_eval/judge_logs"; LOG.mkdir(exist_ok=True)
out, usage = {}, {"in": 0, "out": 0}
for label, q in QUERIES.items():
    prompt = (
        f"Field: {q}\n\n"
        "List exactly 8 research gaps in this field: specific intersections of two "
        "sub-areas that are under-researched. Use only your own knowledge; you have "
        "no literature search available.\n\n"
        'Return ONLY a JSON array of 8 objects with keys "topic_a", "topic_b", '
        '"gap" (one sentence).'
    )
    t0 = time.time()
    r = client.messages.create(model=MODEL, max_tokens=2000, temperature=0,
                               messages=[{"role": "user", "content": prompt}])
    usage["in"] += r.usage.input_tokens; usage["out"] += r.usage.output_tokens
    txt = r.content[0].text.strip().removeprefix("```json").removesuffix("```").strip()
    try:
        gaps = json.loads(txt)[:8]
    except json.JSONDecodeError:
        print(f"  {label}: UNPARSEABLE -- logged for inspection"); gaps = []
    out[label] = [{"topic_a": g.get("topic_a",""), "topic_b": g.get("topic_b",""),
                   "keywords_a": [g.get("topic_a","")], "keywords_b": [g.get("topic_b","")],
                   "gap": g.get("gap",""), "size_a": None, "size_b": None,
                   "bridge_papers": None, "prominence": None} for g in gaps]
    (LOG/f"llm_only_{label.replace(' ','_')}.json").write_text(json.dumps(
        {"model": MODEL, "temperature": 0, "prompt": prompt, "response": txt,
         "usage": {"in": r.usage.input_tokens, "out": r.usage.output_tokens},
         "wall_s": round(time.time()-t0, 2)}, indent=2))
    print(f"  {label:20} {len(out[label])} gaps  ({time.time()-t0:.1f}s)", flush=True)
(ROOT/"paper_eval/llm_only_candidates.json").write_text(json.dumps(out, indent=2))
cost = usage["in"]/1e6*3 + usage["out"]/1e6*15
print(f"\n  tokens in={usage['in']} out={usage['out']}  cost=${cost:.4f}")
(ROOT/"paper_eval/llm_only_cost.json").write_text(json.dumps({**usage, "usd": round(cost,4), "model": MODEL}, indent=2))
