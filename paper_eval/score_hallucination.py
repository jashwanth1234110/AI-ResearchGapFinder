"""PART F3 scorer: counts, percentages and Cohen's kappa for Table XIII.
Reads paper_eval/hallucination_sheet.csv once both label columns are filled."""
import csv, sys, collections
LABELS = ("fully", "partially", "unsupported")
rows = list(csv.DictReader(open("paper_eval/hallucination_sheet.csv")))
def norm(v): 
    v = (v or "").strip().lower()
    return next((L for L in LABELS if v.startswith(L[:4])), None)
a = [norm(r["label_annotator1"]) for r in rows]
b = [norm(r["label_annotator2"]) for r in rows]
done = [(x, y) for x, y in zip(a, b) if x and y]
if not done:
    sys.exit(f"No labels filled in ({len(rows)} statements awaiting annotation).")
print(f"Scored {len(done)}/{len(rows)} statements\n")
print("=== TABLE XIII (annotator 1; adjudicate disagreements before publishing) ===")
c = collections.Counter(x for x, _ in done)
for L in LABELS:
    print(f"  {L.capitalize():14} {c[L]:>4}  {100*c[L]/len(done):>5.1f}%")
print(f"  {'Total':14} {len(done):>4}  100.0%")
po = sum(x == y for x, y in done) / len(done)
ca, cb = collections.Counter(x for x, _ in done), collections.Counter(y for _, y in done)
pe = sum((ca[L]/len(done)) * (cb[L]/len(done)) for L in LABELS)
print(f"\n  observed agreement = {po:.3f}")
print(f"  Cohen's kappa      = {(po-pe)/(1-pe):.3f}" if pe < 1 else "  kappa undefined")
src = collections.Counter(r["report_source"] for r in rows)
print("\n  report_source of the sampled statements:")
for k, v in src.items(): print(f"    {k}: {v}")
print("\n  NOTE: statements drawn from a plain-text FALLBACK report were not written")
print("  by the LLM, so they cannot evidence LLM hallucination. Exclude them or")
print("  report them separately -- see paper_values.md sec 0.")
