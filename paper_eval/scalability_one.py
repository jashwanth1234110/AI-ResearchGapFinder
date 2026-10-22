"""One scalability point. Run as a subprocess so ru_maxrss is this run's peak.
Usage: python3 scalability_one.py <n_papers> <query>"""
import sys, time, json, resource, warnings, os
warnings.filterwarnings("ignore")
sys.path.insert(0, "/Users/suchithreddy/Desktop/Developer/researchgap-ai/engine")
os.chdir("/Users/suchithreddy/Desktop/Developer/researchgap-ai/engine")  # CACHE_DIR is relative
from dotenv import load_dotenv
load_dotenv("/Users/suchithreddy/Desktop/Developer/researchgap-ai/engine/.env")
from engine.pipeline import run_pipeline, PipelineError

n = int(sys.argv[1]); query = sys.argv[2]
t0 = time.time()
rec = {"n_requested": n, "query": query}
try:
    res = run_pipeline(query, n, use_cache=True)
    rs = res["run_stats"]
    rec.update(status="ok", total_s=round(time.time()-t0, 2),
               final_corpus=rs["final_corpus"], topics=rs["topics"],
               outliers=rs["outliers"], candidates=rs["candidates"],
               confirmed=res["confirmed_count"], timings=rs["timings_sec"],
               collection=rs["collection"], report_source=res["report_source"])
except PipelineError as e:
    rec.update(status="pipeline_error", total_s=round(time.time()-t0, 2), error=str(e))
except Exception as e:
    rec.update(status="error", total_s=round(time.time()-t0, 2), error=f"{type(e).__name__}: {e}")
# macOS ru_maxrss is bytes (Linux: kB). Normalise on platform.
peak = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
rec["peak_rss_mb"] = round(peak / (1024*1024 if sys.platform == "darwin" else 1024), 1)
print("RESULT " + json.dumps(rec), flush=True)
