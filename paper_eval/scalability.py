"""Table XII: run one fixed query at increasing corpus sizes."""
import subprocess, json, sys, pathlib
QUERY = "medical image segmentation"
SIZES = [150, 300, 500, 1000, 2000, 5000]
PY_BIN = "/Users/suchithreddy/Desktop/Developer/researchgap-ai/engine/.venv/bin/python3"
OUT = pathlib.Path("/Users/suchithreddy/Desktop/Developer/researchgap-ai/paper_eval/scalability_results.json")
rows = json.loads(OUT.read_text()) if OUT.exists() else []
done = {r["n_requested"] for r in rows}
for n in SIZES:
    if n in done: print(f"[skip] {n} already measured"); continue
    print(f"\n=== {n} papers ===", flush=True)
    p = subprocess.run([PY_BIN, "/Users/suchithreddy/Desktop/Developer/researchgap-ai/paper_eval/scalability_one.py",
                        str(n), QUERY], capture_output=True, text=True, timeout=5400)
    line = next((l for l in p.stdout.splitlines() if l.startswith("RESULT ")), None)
    if not line:
        rows.append({"n_requested": n, "status": "no_result", "stderr": p.stderr[-400:]})
        print("  FAILED:", p.stderr[-300:], flush=True)
    else:
        r = json.loads(line[7:]); rows.append(r)
        print(f"  status={r['status']} total={r.get('total_s')}s corpus={r.get('final_corpus')} "
              f"topics={r.get('topics')} peak_rss={r.get('peak_rss_mb')}MB", flush=True)
        if r.get("status") != "ok": print("  error:", r.get("error"), flush=True)
    OUT.write_text(json.dumps(rows, indent=2))
print(f"\nwrote {OUT}")
