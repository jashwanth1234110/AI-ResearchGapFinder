"""PART C + D: reconcile the paper's numbers and export candidates_all.csv,
using ONLY stored job records. No pipeline reruns, no LLM calls.

Run: python3 paper_eval/export_candidates.py
"""
import json, glob, csv, datetime, os, sys

# Best-match runs located by find_paper_runs.py. drug discovery has NO run
# matching the paper's "8 candidates / 2 retained", so it is left unresolved
# rather than silently substituted.
RUNS = {
    "medical imaging":   "8277413e2e2b",
    "marine biology":    "ba8606412f6c",
    "migraine research": "93d1eeca7b77",   # AMBIGUOUS: 4 runs match equally
    "drug discovery":    None,             # NOT FOUND
    "cell segmentation": "5f0266f32a73",
}
# From agent.py: REJECT_AT=25, WEAK_AT=8 -> confidence = round(1 - hits/25, 2)
REJECT_AT, WEAK_AT = 25, 8
OUT = "paper_eval/candidates_all.csv"

def load(jid):
    p = f"engine/jobs/{jid}.json"
    return json.load(open(p)) if os.path.exists(p) else None

rows, summary = [], []
for query, jid in RUNS.items():
    if jid is None:
        summary.append({"query": query, "job": "NOT FOUND", "cands": None}); continue
    d = load(jid)
    if not d or not d.get("result"):
        summary.append({"query": query, "job": f"{jid} MISSING", "cands": None}); continue
    r = d["result"]
    gaps = r["gaps"]
    sizes = {t["label"]: t["size"] for t in r["topics"]}
    for i, g in enumerate(gaps):
        conf = g.get("confidence") or 0.0
        hits = g.get("recent_papers_found")
        # was_scored: the agent produced a real observation. UNVERIFIED means
        # every OpenAlex query for that candidate failed, i.e. not scored.
        scored = g.get("verdict") != "UNVERIFIED"
        rows.append({
            "query": query, "job_id": jid, "candidate_id": f"{jid}-{i}",
            "topic_i_label": g["topic_a"], "topic_i_keywords": "; ".join(g["keywords_a"]),
            "topic_j_label": g["topic_b"], "topic_j_keywords": "; ".join(g["keywords_b"]),
            "n_i": g["size_a"], "n_j": g["size_b"], "b_ij": g["bridge_papers"],
            "recent_hit_count": hits,
            # Implemented formulas (gaps.py), NOT the paper's Eqs (1)-(4):
            "sparsity_impl_1_over_1plus_b": round(1.0/(1.0+g["bridge_papers"]), 6),
            "mass_impl_sqrt_ninj": round((g["size_a"]*g["size_j"] if False else g["size_a"]*g["size_b"])**0.5, 4),
            "prominence_as_stored": g["prominence"],
            "rank_by_prominence": i + 1,
            "was_scored_by_agent": "Y" if scored else "N",
            "agent_label": g.get("verdict"),
            "agent_confidence": conf,
            "cited_paper_ids": "",          # not collected by the implementation
            "rationale": "",                # not collected by the implementation
            "verification_queries": " | ".join(g.get("verification_queries") or []),
            "retained": "Y" if g.get("verdict") == "CONFIRMED" else "N",
        })
    summary.append({
        "query": query, "job": jid, "cands": len(gaps),
        "scored": sum(1 for g in gaps if g.get("verdict") != "UNVERIFIED"),
        "confirmed": sum(1 for g in gaps if g.get("verdict") == "CONFIRMED"),
        "weak": sum(1 for g in gaps if g.get("verdict") == "WEAK"),
        "rejected": sum(1 for g in gaps if g.get("verdict") == "REJECTED"),
        "unverified": sum(1 for g in gaps if g.get("verdict") == "UNVERIFIED"),
        "ge_06": sum(1 for g in gaps if (g.get("confidence") or 0) >= 0.6),
        "full": sum(1 for g in gaps if (g.get("confidence") or 0) >= 1.0),
        "papers": r["papers_count"], "topics": len(r["topics"]),
    })

if rows:
    with open(OUT, "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0].keys())); w.writeheader(); w.writerows(rows)

print("="*100); print("PER-QUERY SUMMARY FROM STORED RUNS"); print("="*100)
print(f"{'query':20} {'job':14} {'pap':>4} {'top':>4} {'cand':>5} {'scored':>7} {'CONF':>5} {'WEAK':>5} {'REJ':>4} {'UNV':>4} {'>=.6':>5} {'=1.0':>5}")
for s in summary:
    if s.get("cands") is None:
        print(f"{s['query']:20} {s['job']:14}   --- no stored run matches the paper's numbers ---"); continue
    print(f"{s['query']:20} {s['job']:14} {s['papers']:>4} {s['topics']:>4} {s['cands']:>5} {s['scored']:>7} "
          f"{s['confirmed']:>5} {s['weak']:>5} {s['rejected']:>4} {s['unverified']:>4} {s['ge_06']:>5} {s['full']:>5}")

ok = [s for s in summary if s.get("cands")]
C = sum(s["cands"] for s in ok); V = sum(s["confirmed"] for s in ok)
print("\n" + "="*100); print("RECONCILIATION (4 of 5 queries; drug discovery unresolved)"); print("="*100)
print(f"  candidates (sum C)          = {C}   [paper: 36]")
print(f"  retained = CONFIRMED (sum V)= {V}   [paper: 14]")
print(f"  scored by agent             = {sum(s['scored'] for s in ok)}   [paper: 24]")
print(f"  confidence >= 0.6           = {sum(s['ge_06'] for s in ok)}   [paper: 10]")
print(f"  confidence == 1.0           = {sum(s['full'] for s in ok)}   [paper: 6]")
print(f"  pooled yield  = {V}/{C} = {100*V/C:.1f}%   [paper: 38.9%]")
macro = sum(s['confirmed']/s['cands'] for s in ok)/len(ok)
print(f"  macro yield (mean of {len(ok)}) = {100*macro:.1f}%   [paper: 35.0% over 5]")

print("\n  THRESHOLD SWEEP on logged confidences (no new LLM calls):")
for th in (0.5, 0.6, 0.7, 0.8):
    n = sum(1 for r in rows if r["agent_confidence"] >= th)
    nc = sum(1 for r in rows if r["agent_confidence"] >= th and r["agent_label"] == "CONFIRMED")
    print(f"    theta={th}: {n:>2} candidates at/above  ({nc} of them labelled CONFIRMED)")
print(f"\n  wrote {OUT} ({len(rows)} rows)")
