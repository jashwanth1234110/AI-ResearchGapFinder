"""Option A: rerun the paper's five queries with instrumentation, sequentially.

Query strings: the original strings from the stored runs are reused where they
were identifiable. The exception is cell segmentation -- the stored run's query
was literally "the image-segmentation", which is an input artefact, not a
domain name, so the paper's own domain name is used instead. Documented in
final_values.md rather than silently substituted.
"""
import json, urllib.request, time, sys, pathlib

API = "http://127.0.0.1:8001"
PAPERS = 300
QUERIES = [
    ("medical imaging",   "medical image segmentation"),
    ("marine biology",    "marine biology"),
    ("migraine research", "migraine prediction machine learning"),
    ("drug discovery",    "graph neural networks drug discovery"),
    ("cell segmentation", "cell segmentation"),
]
OUT = pathlib.Path("paper_eval/rerun_results.json")

def post(topic, papers):
    req = urllib.request.Request(f"{API}/analyze",
        data=json.dumps({"topic": topic, "papers": papers}).encode(),
        headers={"Content-Type": "application/json"}, method="POST")
    return json.load(urllib.request.urlopen(req, timeout=30))["job_id"]

results = {}
if OUT.exists(): results = json.loads(OUT.read_text())

for label, q in QUERIES:
    if label in results and results[label].get("status") == "done":
        print(f"[skip] {label} already done ({results[label]['job_id']})"); continue
    print(f"\n=== {label}: '{q}' ({PAPERS} papers) ===", flush=True)
    jid = post(q, PAPERS); print(f"  job {jid}", flush=True)
    t0 = time.time()
    while time.time() - t0 < 1800:
        d = json.load(urllib.request.urlopen(f"{API}/jobs/{jid}", timeout=20))
        if d["status"] in ("done", "error"): break
        time.sleep(10)
    r = d.get("result") or {}
    rs = r.get("run_stats") or {}
    results[label] = {"job_id": jid, "query": q, "status": d["status"], "error": d.get("error"),
                      "report_source": r.get("report_source"), "run_stats": rs,
                      "papers_count": r.get("papers_count"),
                      "topics": len(r.get("topics") or []), "gaps": len(r.get("gaps") or []),
                      "confirmed": r.get("confirmed_count"), "weak": r.get("weak_count"),
                      "rejected": r.get("rejected_count"), "unverified": r.get("unverified_count")}
    OUT.write_text(json.dumps(results, indent=2))
    if d["status"] == "error":
        print(f"  *** ERROR: {d.get('error')}", flush=True); continue
    c = rs.get("collection", {})
    print(f"  done in {rs.get('timings_sec',{}).get('total')}s  report_source={r.get('report_source')}", flush=True)
    print(f"  S2={c.get('s2_papers')} OA={c.get('openalex_papers')} dup={c.get('duplicates_removed')} "
          f"final={rs.get('final_corpus')} topics={rs.get('topics')} outliers={rs.get('outliers')}", flush=True)
    print(f"  candidates={r.get('confirmed_count',0)+r.get('weak_count',0)+r.get('rejected_count',0)+r.get('unverified_count',0)} "
          f"C={r.get('confirmed_count')} W={r.get('weak_count')} R={r.get('rejected_count')} U={r.get('unverified_count')}", flush=True)

print(f"\nwrote {OUT}")
