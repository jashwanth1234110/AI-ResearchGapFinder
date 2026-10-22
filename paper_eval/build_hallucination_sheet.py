"""PART F3: sample N=50 factual statements from the generated reports and pair
each with the evidence it should be grounded in.

Sentence splitting is intentionally conservative: headings, bullets markers and
fragments under 40 chars are dropped, so annotators judge claims, not formatting.
"""
import json, os, re, csv, random

SEED = 20260918; N = 50
random.seed(SEED)
RUNS = {"medical imaging":"8277413e2e2b","marine biology":"ba8606412f6c",
        "migraine research":"93d1eeca7b77","cell segmentation":"5f0266f32a73"}

def sentences(md):
    md = re.sub(r"^#{1,6}\s.*$", "", md, flags=re.M)          # headings
    md = re.sub(r"^\s*[-*]\s+", "", md, flags=re.M)           # bullet markers
    md = re.sub(r"\*\*|`|\*", "", md)
    parts = re.split(r"(?<=[.!?])\s+(?=[A-Z0-9])", md.replace("\n", " "))
    return [s.strip() for s in parts if len(s.strip()) >= 40]

pool = []
for q, jid in RUNS.items():
    p = f"engine/jobs/{jid}.json"
    if not os.path.exists(p): continue
    d = json.load(open(p)); r = d["result"]
    ev = {
        "papers_count": r["papers_count"],
        "topics": [{"label": t["label"], "size": t["size"], "mean_year": t["mean_year"]} for t in r["topics"]],
        "gaps": [{"a": g["topic_a"], "b": g["topic_b"], "bridge_papers": g["bridge_papers"],
                  "size_a": g["size_a"], "size_b": g["size_b"], "prominence": g["prominence"],
                  "recent_papers_found": g["recent_papers_found"], "verdict": g["verdict"],
                  "confidence": g["confidence"]} for g in r["gaps"]],
        "counts": {k: r[k] for k in ("confirmed_count","weak_count","rejected_count","unverified_count")},
    }
    src = r.get("report_source", "UNRECORDED (job predates the report_source field)")
    for s in sentences(r["report"]):
        pool.append({"query": q, "job_id": jid, "report_source": src,
                     "statement": s, "evidence_json": json.dumps(ev, separators=(",",":"))})

random.shuffle(pool)
sample = pool[:N]
for i, row in enumerate(sample, 1):
    row["stmt_id"] = f"S{i:03d}"
    row["label_annotator1"] = ""     # fully / partially / unsupported
    row["label_annotator2"] = ""
cols = ["stmt_id","query","job_id","report_source","statement",
        "label_annotator1","label_annotator2","evidence_json"]
with open("paper_eval/hallucination_sheet.csv","w",newline="") as f:
    w = csv.DictWriter(f, fieldnames=cols); w.writeheader()
    w.writerows([{c: r[c] for c in cols} for r in sample])
print(f"pool: {len(pool)} statements from {len(RUNS)} reports -> sampled N={len(sample)} (seed={SEED})")
print("wrote paper_eval/hallucination_sheet.csv")
if len(pool) < N:
    print(f"*** WARNING: only {len(pool)} statements available; N={N} not reached ***")
for q in RUNS:
    print(f"   {q:20} statements in pool: {sum(1 for r in pool if r['query']==q)}")
