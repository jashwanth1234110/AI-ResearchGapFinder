# paper_eval/ — reproducible evaluation tooling

All scripts run from the repo root: `python3 paper_eval/<script>.py`
They read only stored job records. **None of them call an LLM or rerun the pipeline.**

| Script | Purpose | Status |
|---|---|---|
| `find_paper_runs.py` | Matches stored jobs against the paper's published per-query numbers | works |
| `export_candidates.py` | Writes `candidates_all.csv`; reconciles 36/24/10/6/14; threshold sweep | works |
| `dump_prompts.py` | Regenerates `prompts_appendix.md` verbatim from source | works |
| `build_annotation_sheet.py` | Blinded `annotation_sheet.csv` + hidden `annotation_KEY.csv` | works |
| `compute_metrics.py` | Tables IV, V, VI, VIII(rho) + kappa, once `labels/*.csv` exist | works (smoke-tested) |
| `build_hallucination_sheet.py` | Samples statements + evidence for Table XIII | works (N=39, not 50) |
| `score_hallucination.py` | Counts, percentages, kappa for Table XIII | works |
| `ablations.py` | Table VII variants | **NOT WRITTEN — blocked on rerun decision** |
| `baselines.py` | Table IX (LDA + gap logic; BERTopic no-agent) | **NOT WRITTEN — blocked on rerun decision** |

## Do not commit
`annotation_KEY.csv` maps rows to agent verdicts. Keep it away from annotators.

## Order of use
1. `find_paper_runs.py` — confirm which runs you are standing on.
2. `export_candidates.py` — regenerate the CSV and the reconciliation.
3. `build_annotation_sheet.py` → distribute `annotation_sheet.csv`.
4. Collect filled sheets into `paper_eval/labels/` (one CSV per annotator).
5. `compute_metrics.py`.
6. `build_hallucination_sheet.py` → label → `score_hallucination.py`.
