"""PART F1: build a blinded annotation sheet + a hidden key.

Reads candidates_all.csv, shuffles with a fixed seed, and writes:
  paper_eval/annotation_sheet.csv   <- give this to annotators
  paper_eval/annotation_KEY.csv     <- DO NOT SHARE (method + agent verdict)

The sheet deliberately omits the agent verdict, the confidence, the hit count
and the source method, so an annotator cannot anchor on the system's answer.
"""
import csv, json, random, pathlib, os

SEED = 20260918
random.seed(SEED)
rows = list(csv.DictReader(open("paper_eval/candidates_all.csv")))

def rep_titles(job_id, n=3):
    """Representative titles: the highest-cited papers of the run's corpus.
    Per-topic paper indices are not persisted in the job record, so these are
    run-level, not topic-level -- stated plainly rather than faked."""
    p = f"engine/jobs/{job_id}.json"
    if not os.path.exists(p): return ""
    d = json.load(open(p))
    return ""  # per-topic titles unavailable; see NEEDS_HUMAN item 5

out = []
for r in rows:
    out.append({
        "row_id": "",                       # filled after shuffle
        "topic_A_label": r["topic_i_label"],
        "topic_A_keywords": r["topic_i_keywords"],
        "topic_B_label": r["topic_j_label"],
        "topic_B_keywords": r["topic_j_keywords"],
        "papers_in_A": r["n_i"],
        "papers_in_B": r["n_j"],
        "papers_bridging_both": r["b_ij"],
        "candidate_description":
            f"Is there a research gap at the intersection of '{r['topic_i_label']}' "
            f"and '{r['topic_j_label']}'? Topic A has {r['n_i']} papers, topic B has "
            f"{r['n_j']}, and {r['b_ij']} paper(s) in the corpus address both.",
        "representative_titles": rep_titles(r["job_id"]),
        # --- annotator fills these ---
        "genuine_gap_YN": "",
        "already_addressed_YN": "",
        "meaningful_1to5": "",
        "evidence_sufficient_1to5": "",
        "importance_rank": "",
    })
random.shuffle(out)
key = []
for i, (row, src) in enumerate(zip(out, [None]*len(out)), start=1):
    row["row_id"] = f"R{i:03d}"
# rebuild key by matching on the label pair (unique within this pool)
idx = {(r["topic_i_label"], r["topic_j_label"]): r for r in rows}
for row in out:
    src = idx[(row["topic_A_label"], row["topic_B_label"])]
    key.append({"row_id": row["row_id"], "query": src["query"], "job_id": src["job_id"],
                "candidate_id": src["candidate_id"], "method": "proposed_system",
                "agent_label": src["agent_label"], "agent_confidence": src["agent_confidence"],
                "recent_hit_count": src["recent_hit_count"], "prominence": src["prominence_as_stored"],
                "retained": src["retained"]})

with open("paper_eval/annotation_sheet.csv","w",newline="") as f:
    w=csv.DictWriter(f,fieldnames=list(out[0].keys())); w.writeheader(); w.writerows(out)
with open("paper_eval/annotation_KEY.csv","w",newline="") as f:
    w=csv.DictWriter(f,fieldnames=list(key[0].keys())); w.writeheader(); w.writerows(key)
print(f"wrote annotation_sheet.csv ({len(out)} rows, blinded, seed={SEED})")
print(f"wrote annotation_KEY.csv  ({len(key)} rows) -- DO NOT SHARE WITH ANNOTATORS")
print("\nNOTE: representative_titles is EMPTY -- per-topic paper indices are not")
print("persisted in job records (paper_values.md NEEDS_HUMAN #5). Annotators will")
print("judge from topic labels + keywords unless the pipeline is instrumented.")
