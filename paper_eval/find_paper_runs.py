"""Locate the five runs the paper reports, by matching its published
per-query numbers (candidates and retained) against every stored job.

Paper Table III / Fig. 8 claim:
    medical imaging    8 candidates, 2 retained
    marine biology     8 candidates, 4 retained
    migraine research  8 candidates, 6 retained
    drug discovery     8 candidates, 2 retained
    cell segmentation  4 candidates, 0 retained
"""
import json, glob, datetime, sys

TARGETS = [
    ("medical imaging",   ["medical image", "image-segmentation", "image segmentation"], 8, 2),
    ("marine biology",    ["marine"],                                                    8, 4),
    ("migraine research", ["migraine"],                                                  8, 6),
    ("drug discovery",    ["drug discovery"],                                            8, 2),
    ("cell segmentation", ["segmentation", "cell"],                                      4, 0),
]

jobs = []
for f in sorted(glob.glob("engine/jobs/*.json")):
    try: d = json.load(open(f))
    except Exception: continue
    r = d.get("result")
    if not r: continue
    gaps = r.get("gaps") or []
    jobs.append({
        "id": d["job_id"], "topic": d.get("topic",""), "created": d.get("created_at",0),
        "req": d.get("papers"), "papers": r.get("papers_count"),
        "topics": len(r.get("topics") or []), "cands": len(gaps),
        "confirmed": sum(1 for g in gaps if g.get("verdict")=="CONFIRMED"),
        "weak":      sum(1 for g in gaps if g.get("verdict")=="WEAK"),
        "rejected":  sum(1 for g in gaps if g.get("verdict")=="REJECTED"),
        "unverified":sum(1 for g in gaps if g.get("verdict")=="UNVERIFIED"),
        "ge_06":     sum(1 for g in gaps if (g.get("confidence") or 0) >= 0.6),
        "full_conf": sum(1 for g in gaps if (g.get("confidence") or 0) >= 1.0),
    })

print("="*112)
print("MATCHING STORED RUNS AGAINST THE PAPER'S PUBLISHED NUMBERS")
print("="*112)
any_missing = False
for label, pats, want_c, want_r in TARGETS:
    cands = [j for j in jobs if any(p in j["topic"].lower() for p in pats)]
    exact = [j for j in cands if j["cands"]==want_c and j["confirmed"]==want_r]
    print(f"\n--- {label}: paper says {want_c} candidates, {want_r} retained ---")
    if not cands:
        print("    NO STORED RUN with a matching topic string at all"); any_missing=True; continue
    for j in cands:
        dt = datetime.datetime.fromtimestamp(j["created"]).strftime("%Y-%m-%d %H:%M")
        mark = "  <== EXACT MATCH" if j in exact else ""
        print(f"    {dt}  {j['id']}  '{j['topic'][:40]}'  req={j['req']} papers={j['papers']} "
              f"topics={j['topics']} cand={j['cands']} CONF={j['confirmed']} W={j['weak']} R={j['rejected']}{mark}")
    if not exact:
        print(f"    *** NO RUN MATCHES {want_c} candidates + {want_r} retained ***"); any_missing=True
    elif len(exact) > 1:
        print(f"    *** {len(exact)} RUNS MATCH EQUALLY — cannot tell which the paper used ***"); any_missing=True
print("\n" + "="*112)
print("VERDICT:", "CANNOT uniquely identify all five runs" if any_missing else "All five runs uniquely identified")
print("="*112)
