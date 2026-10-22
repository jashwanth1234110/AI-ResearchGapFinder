# paper_values.md — values for "AI-Powered Research Gap Finder"

Generated 2026-09-18. Every value carries a source tag:
`[CODE: file:line]` · `[LOGS: path/job]` · `[RECOMPUTED: script]` · `[NEEDS_HUMAN]`

> **STOP — READ FIRST.** The paper's headline numbers (36 candidates, 14 retained,
> 38.9% pooled, 35.0% macro) **cannot be reproduced from stored data.** One of the
> five runs is missing entirely and another is ambiguous. See §0. No reruns have
> been performed, per instruction.

---

## 0. GATING: are the original five runs stored?

`[RECOMPUTED: paper_eval/find_paper_runs.py]` — 79 job files on disk, 61 with results.

| Paper query | Paper says | Stored run | Status |
|---|---|---|---|
| Medical imaging | 8 cand / 2 retained | `8277413e2e2b` (2026-07-12 20:07) | **UNIQUE MATCH** |
| Marine biology | 8 cand / 4 retained | `ba8606412f6c` (2026-07-29 13:13) | **UNIQUE MATCH** |
| Migraine research | 8 cand / 6 retained | `93d1eeca7b77`, `52f817e76a55`, `7ede97a2950e`, `3cd7863d13c6` | **AMBIGUOUS — 4 runs match equally** |
| Drug discovery | 8 cand / 2 retained | none | **NOT FOUND** |
| Cell segmentation | 4 cand / 0 retained | `5f0266f32a73` ("the image-segmentation") | **UNIQUE MATCH** |

**Drug discovery:** the only stored `graph neural networks drug discovery` runs retained
**3, 3 and 5** candidates (`b271037a3ce3`, `ccbf8eedc9af`, `ea5cdcca7a5c`). None retained 2.
The paper's value is not in the data.

**Migraine:** three of the four matches are 300-paper runs 3 minutes apart with identical
outputs; one is a 150-paper run. They are indistinguishable from the paper text.

### What this means for the numbers
With the four locatable runs (`[RECOMPUTED: paper_eval/export_candidates.py]`):

| Quantity | From stored data | Paper claims |
|---|---|---|
| Candidates ΣC | **28** | 36 |
| Retained ΣV (=CONFIRMED) | **12** | 14 |
| Scored by agent | **28** (all of them) | 24 |
| confidence ≥ 0.6 | **13** | 10 |
| confidence = 1.0 | **7** | 6 |
| Pooled yield | **42.9%** | 38.9% |
| Macro yield | **37.5%** (over 4) | 35.0% (over 5) |

**Decision required — I have not rerun anything.** Options:
- **(A)** Re-run all five queries now and regenerate *every* number from the new corpus.
  Changes 36/14/38.9%/35.0% and every table. Cost ≈ $0.50, ≈ 10–15 min.
- **(B)** Publish the four recoverable queries, drop drug discovery, and state N=4.
- **(C)** Treat the four as final and re-run drug discovery only. **Not recommended** —
  mixes corpora from July and September, which you ruled out.

---

## §2. CORRECTED SEC. III-E — LaTeX-ready

Replace the current Eqs. (1)–(4) and surrounding prose with the following.
All values verified `[CODE: engine/engine/gaps.py:20-60]`.

```latex
Let $T=\{t_1,\dots,t_K\}$ be the topics returned by BERTopic, excluding the
HDBSCAN outlier bucket ($\text{topic}=-1$). Let $n_k=|t_k|$, let
$\mathbf{e}_p\in\mathbb{R}^{384}$ be the $L_2$-normalised Sentence-BERT
embedding of paper $p$, and let
$\mathbf{c}_k=\tfrac{1}{n_k}\sum_{p\in t_k}\mathbf{e}_p$
be the centroid of topic $t_k$. Because the embeddings are normalised, the
inner product $\mathbf{e}_p^{\top}\mathbf{c}_k$ is a cosine similarity.

A paper \emph{bridges} the pair $(t_i,t_j)$ if it is similar to both
centroids above a fixed threshold $\tau=0.45$:
\begin{equation}
b_{ij}=\bigl|\{\,p:\ \mathbf{e}_p^{\top}\mathbf{c}_i>\tau
       \ \wedge\ \mathbf{e}_p^{\top}\mathbf{c}_j>\tau \,\}\bigr|
\end{equation}
Note that the count ranges over the whole corpus, not only over
$t_i\cup t_j$, so a bridging paper need not belong to either topic.

For every unordered pair $(t_i,t_j)$, $i<j$, sparsity, mass and recency are
\begin{align}
s_{ij}&=\frac{1}{1+b_{ij}}\\[2pt]
m_{ij}&=\sqrt{n_i\,n_j}\\[2pt]
r_{ij}&=1+\tfrac{1}{2}\max\!\left(0,\;
        1-\frac{Y-\min(\bar{y}_i,\bar{y}_j)}{\Delta}\right),\qquad \Delta=10
\end{align}
where $\bar{y}_k$ is the mean publication year of topic $t_k$ and
$Y=\max_p y_p$ is the most recent publication year in the corpus. The
prominence score is their product:
\begin{equation}
P_{ij}=s_{ij}\cdot m_{ij}\cdot r_{ij}
\end{equation}

$P_{ij}$ is deliberately unnormalised: $s_{ij}\in(0,1]$, $r_{ij}\in[1,1.5]$
and $m_{ij}$ is unbounded above, so $P_{ij}$ is reported on an absolute
scale (values of 20--60 are typical for topics of 20--40 papers) and is
meaningful only for ranking candidates \emph{within} one run.

Candidates are ranked by $P_{ij}$ in descending order. Pairs with
$b_{ij}\le 3$ are preferred; if no pair satisfies this, the full ranked list
is used instead, so the stage never returns empty. The top $G=8$ candidates
are passed to validation.
```

**Also correct in Sec. III-F:**

```latex
For each candidate the agent generates $q=2$ search queries with a
language model (Claude Haiku 4.5, temperature $0$), each query pairing one
phrase from $t_i$ with one from $t_j$. Each query is issued to OpenAlex as a
\emph{count-only} request restricted to the last $3$ years; no documents are
returned to the model. Let $h_{ij}$ be the maximum count over the queries.
The verdict is a deterministic rule:
\begin{equation}
v_{ij}=
\begin{cases}
\textsc{unverified}, & \text{if every query failed}\\
\textsc{rejected},   & h_{ij}\ge 25\\
\textsc{weak},       & 8\le h_{ij}<25\\
\textsc{confirmed},  & h_{ij}<8
\end{cases}
\end{equation}
with confidence $c_{ij}=\max(0,\,1-h_{ij}/25)$ for the latter two cases and
$c_{ij}=0$ otherwise. A candidate is retained iff
$v_{ij}=\textsc{confirmed}$; no separate confidence threshold is applied.
```

> The language model's role is confined to **query formulation**. It does not
> read retrieved papers and does not issue the verdict. Sec. III-F and the
> Table I row "Validation mechanism" must both be amended accordingly, and the
> claim of expert-ground-truth validation is a *protocol*, not a completed step.

---

## PART A — METHOD DETAILS (read from code)

### A1. Preprocessing (Sec. III-C)

| Item | Actual value | Source |
|---|---|---|
| Dedup rule | Exact DOI match; if DOI missing/duplicate-free, exact match on `title.lower().strip()` | `[CODE: engine/engine/fetch.py:299-312]` |
| Similarity metric / threshold | **NONE — there is no fuzzy matching and no threshold.** Title matching is exact string equality after lowercase+strip | `[CODE: engine/engine/fetch.py:303-307]` |
| Minimum abstract length L | **200 characters** (not words) | `[CODE: engine/engine/nlp.py:16,21]` |
| Non-English abstracts removed? | **NO** — no language detection anywhere in the codebase | `[CODE: engine/engine/nlp.py:16-24]` |
| Sentence-level segmentation? | **NO** — abstracts are whitespace-normalised only; embedding input is `f"{title}. {abstract}"` | `[CODE: engine/engine/nlp.py:20,45]` |
| Other normalisation | **Only `" ".join(abstract.split())`.** The paper's "repairing broken Unicode, stripping HTML tags, removing special characters" is **NOT implemented** | `[CODE: engine/engine/nlp.py:20]` |

### A2. Topic modelling (Sec. III-D)
**Are HDBSCAN outliers (topic −1) excluded from gap scoring? → YES.** `[CODE: engine/engine/nlp.py:91-93]`
Topic −1 is skipped when building the topics dict, and `detect_gaps` iterates only over that dict `[CODE: engine/engine/gaps.py:28]`.
Outlier *count* is not persisted — recoverable only by rerun `[NEEDS_HUMAN: decision on rerun]`.

### A3. Gap detection (Sec. III-E) — **the paper's equations do not match the code**

Implemented, `[CODE: engine/engine/gaps.py:32-42]`:

```
bridges_ij = |{p : (e_p · c_i) > 0.45  AND  (e_p · c_j) > 0.45}|
sparsity_ij   = 1 / (1 + bridges_ij)
mass_ij       = sqrt(n_i * n_j)
recency_ij    = 1 + 0.5 * max(0, 1 - (Y - min(ybar_i, ybar_j)) / 10)
prominence_ij = sparsity_ij * mass_ij * recency_ij        # PRODUCT, not weighted sum
```

| Paper symbol | Paper form | Implemented form | Source |
|---|---|---|---|
| s_ij | `1 − b/min(n_i,n_j)` | `1/(1+b)` | `[CODE: gaps.py:34]` |
| m_ij | `√(n_i n_j)/max_k n_k` | `√(n_i n_j)` — **no normalisation** | `[CODE: gaps.py:35]` |
| r_ij | fraction of papers with `y ≥ Y−Δ` | `1 + 0.5·max(0, 1 − (Y − min(ȳ_i,ȳ_j))/10)` — uses topic **mean years**, not a paper count | `[CODE: gaps.py:36-40]` |
| P_ij | `w1·m + w2·s + w3·r` | `s · m · r` | `[CODE: gaps.py:42]` |
| w1,w2,w3 | sum to 1 | **DO NOT EXIST** | — |
| σ (sparsity threshold) | `s_ij ≥ σ` | **DOES NOT EXIST**; filter is `bridge_papers ≤ 3` | `[CODE: gaps.py:60]` |
| n_min | topics must have `n ≥ n_min` | **DOES NOT EXIST** — all topic pairs are considered | `[CODE: gaps.py:28]` |
| Δ | recency window | **10 years**, hard-coded in the divisor | `[CODE: gaps.py:40]` |
| G | top-k passed on | **8** (`top_n=8`) | `[CODE: gaps.py:23]` |
| Bridge criterion | "semantically associated with both" | cosine > **0.45** to *both centroids*, on L2-normalised embeddings | `[CODE: gaps.py:20,30-32]` |

**Prominence scaling:** none. The value is **unnormalised and unbounded** —
`round(sparsity*mass*recency, 2)` `[CODE: gaps.py:52]`. With `bridges=0`, `n_i=n_j=40`,
`recency=1.5` you get `1.0*40*1.5 = 60.0`. This is why the UI shows 44.16 / 23.45.
The paper's claim that P ∈ [0,1] is **false for this implementation**.

**Per-candidate research agenda: generated by the LLM**, inside the synthesis call — not a
template, and not per-candidate at detection time `[CODE: engine/engine/synth.py:60-62]`.

### A4. Agentic validation (Sec. III-F) — **largest divergence in the paper**

| Item | Actual | Source |
|---|---|---|
| APIs queried by the agent | **OpenAlex ONLY.** Semantic Scholar is never called during validation | `[CODE: agent.py:91]` → `fetch.count_openalex` |
| q (queries per candidate) | **2** (`QUERIES_PER_GAP`) | `[CODE: agent.py:28]` |
| k (results per query) | **N/A — zero results are returned.** The agent issues a *count-only* query (`per-page=1`) and reads `meta.count`. No titles, abstracts or years ever reach the LLM | `[CODE: fetch.py:225-239]` |
| **How the verdict is made** | **A pure deterministic rule on the hit count. There is NO LLM judgement.** | `[CODE: agent.py:99-106]` |
| Confidence | `round(1 − hits/25, 2)` for CONFIRMED/WEAK; `0.0` for REJECTED and UNVERIFIED. Range `[0.0, 1.0]` | `[CODE: agent.py:104,106]` |
| θ = 0.6 | **DOES NOT EXIST IN THE CODE.** Acceptance is `verdict == "CONFIRMED"`, i.e. `hits < 8` | `[CODE: agent.py:105-106]` |

Verbatim decision logic `[CODE: agent.py:99-106]`:
```python
if not any_verified:      verdict, confidence = "UNVERIFIED", 0.0
elif hits >= REJECT_AT:   verdict, confidence = "REJECTED", 0.0        # REJECT_AT = 25
elif hits >= WEAK_AT:     verdict, confidence = "WEAK",  round(1 - hits/REJECT_AT, 2)   # WEAK_AT = 8
else:                     verdict, confidence = "CONFIRMED", round(1 - hits/REJECT_AT, 2)
```
`hits = max(count)` over the 2 queries `[CODE: agent.py:96]`; `from_year = current_year − 3` `[CODE: agent.py:27,79]`.

**Consequence for θ:** CONFIRMED ⟺ `hits ≤ 7` ⟺ confidence ≥ 0.72. WEAK spans confidence
0.68 down to 0.04. So a **WEAK candidate with 8–10 hits has confidence ≥ 0.6** and would
pass a θ=0.6 filter without being retained. This is why "≥0.6" (13) ≠ "retained" (12).

**Why only 24 of 36 were scored:** **NOT REPRODUCIBLE.** `validate_gaps` loops over *every*
candidate with no cap, no budget and no sampling `[CODE: agent.py:81]`. In all four locatable
runs, scored == candidates (28/28), zero UNVERIFIED. The only mechanism that can leave a
candidate unscored is every OpenAlex query failing → UNVERIFIED `[CODE: agent.py:99-100]`.
**The "24" in Fig. 6 has no basis in the stored data.** `[NEEDS_HUMAN]`

**Hallucination controls — answer per item:**

| Control | Answer | Evidence |
|---|---|---|
| (a) cited paper IDs checked against retrieved set | **NO** | No paper IDs are ever collected. The agent only reads an integer count `[CODE: agent.py:91-97]` |
| (b) output constrained to fixed schema | **NO (partial)** — best-effort `json.loads` + `isinstance(q,str)` filter + `[:2]` truncation, wrapped in try/except with a fallback. No JSON-schema, no tool schema, no pydantic `[CODE: agent.py:64-69]` |
| (c) malformed evidence ⇒ not confirmed | **PARTIAL** — if *all* queries fail the verdict is UNVERIFIED, never CONFIRMED `[CODE: agent.py:99-100]`. But there is no "evidence" to be malformed, since no documents are retrieved |

### A5. Report synthesis (Sec. III-G)

| Item | Value | Source |
|---|---|---|
| Agent model | `claude-haiku-4-5-20251001` (env `AGENT_MODEL`) | `[CODE: agent.py:55]` |
| Synthesis model | `claude-sonnet-4-6` (env `SYNTH_MODEL`) | `[CODE: synth.py:63]` |
| Chat model | `claude-haiku-4-5-20251001` (env `CHAT_MODEL`) | `[CODE: chat.py:70]` |
| Agent temperature / max_tokens | **0** / **200** | `[CODE: agent.py:56-57]` |
| Synthesis temperature / max_tokens | **NOT SET (SDK default)** / **2000** | `[CODE: synth.py:64]` |
| Chat temperature / max_tokens | **NOT SET** / **1000** | `[CODE: chat.py:71]` |
| Timeouts | agent 30s, synthesis 90s, chat 30s | `[CODE: agent.py:41, synth.py:33, chat.py:64]` |

Full prompts: **`paper_eval/prompts_appendix.md`** `[RECOMPUTED: paper_eval/dump_prompts.py]`

---

## PART B — TABLE II (experimental environment)

| Item | Value | Source |
|---|---|---|
| CPU | Apple M4, 10 cores (10 physical) | `[RECOMPUTED: sysctl machdep.cpu.brand_string]` |
| RAM | 16 GB | `[RECOMPUTED: sysctl hw.memsize]` |
| GPU | Apple M4 integrated — **not used; embeddings run on CPU** | `[CODE: nlp.py:28]` |
| OS | macOS 15.7.4 (arm64) | `[RECOMPUTED: sw_vers]` |
| Python | 3.9.6 (Xcode CLT interpreter) | `[RECOMPUTED: engine/.venv/bin/python3 --version]` |
| sentence-transformers | 5.1.2 | `[RECOMPUTED: importlib.metadata]` |
| bertopic | 0.17.3 | ″ |
| umap-learn | 0.5.12 | ″ |
| hdbscan | 0.8.42 | ″ |
| anthropic | 0.116.0 | ″ |
| fastapi | 0.128.8 | ″ |
| scikit-learn / numpy / torch / numba | 1.6.1 / 2.0.2 / 2.8.0 / 0.60.0 | ″ |
| Embedding model | `all-MiniLM-L6-v2`, 384-dim, `normalize_embeddings=True` | `[CODE: nlp.py:44-46]` |
| UMAP | n_neighbors=**15**, n_components=**5**, min_dist=**0.0**, metric=**cosine**, low_memory=False | `[CODE: nlp.py:71-78]` |
| HDBSCAN | min_cluster_size=**max(6, N//40)**, min_samples=**2** | `[CODE: nlp.py:83]` |
| BERTopic | min_topic_size / nr_topics **NOT SET** (library defaults); `calculate_probabilities=False`; vectorizer `CountVectorizer(stop_words=<english + query tokens>, ngram_range=(1,2))`; **top_n_words effectively 6** (`get_topic(tid)[:6]`) | `[CODE: nlp.py:80-85,95]` |
| Papers requested per query per source | S2 first up to `target`; OpenAlex tops up the shortfall (`target − len(s2)`). Not a fixed split | `[CODE: fetch.py:295-297]` |
| Minimum abstract length | 200 characters | `[CODE: nlp.py:16]` |
| Dedup rule | exact DOI, then exact lowercased title | `[CODE: fetch.py:299-312]` |
| n_min, σ, G | n_min **N/A**, σ **N/A**, G=**8** | `[CODE: gaps.py:23,60]` |
| w1,w2,w3 | **N/A — not a weighted sum** | `[CODE: gaps.py:42]` |
| Δ (recency window) | **10 years** (score); **3 years** for the agent's "recent" window | `[CODE: gaps.py:40; agent.py:27]` |
| LLM model IDs | see A5 | ″ |
| q / k | q=**2** / k=**N/A (count-only)** | `[CODE: agent.py:28; fetch.py:225-239]` |
| θ | **not implemented** (paper says 0.6) | `[CODE: agent.py:99-106]` |
| Random seed | **UMAP `random_state=42`** — the only seed in the codebase. HDBSCAN is deterministic given input; no global numpy/torch seed is set | `[CODE: nlp.py:77]` |
| Retrieval date per run | from job `created_at`: medical imaging **2026-07-12**, marine biology **2026-07-29**, migraine **2026-07-29**, cell segmentation **2026-07-29**, drug discovery **N/A** | `[LOGS: engine/jobs/*.json]` |

---

## PART C — TABLE III

`[RECOMPUTED: paper_eval/export_candidates.py]`

| Query | S2 papers | OpenAlex papers | Dups removed | Short/missing removed | Final corpus | Topics | Outliers | Cand. | Sent to agent | Passed θ=0.6 | Retained |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Medical imaging | NOT FOUND | NOT FOUND | NOT FOUND | NOT FOUND | **290** | **16** | NOT FOUND | **8** | **8** | **2** | **2** |
| Marine biology | NOT FOUND | NOT FOUND | NOT FOUND | NOT FOUND | **279** | **19** | NOT FOUND | **8** | **8** | **4** | **4** |
| Migraine research | NOT FOUND | NOT FOUND | NOT FOUND | NOT FOUND | **298** | **11** | NOT FOUND | **8** | **8** | **6** | **6** |
| Drug discovery | — | — | — | — | **NOT FOUND** | — | — | — | — | — | — |
| Cell segmentation | NOT FOUND | NOT FOUND | NOT FOUND | NOT FOUND | **299** | **16** | NOT FOUND | **4** | **4** | **1** | **0** |

**Per-source counts, duplicates removed, short-abstract removals and outlier counts are
NOT RECOVERABLE from stored data** — `collect_papers` returns only the merged, deduplicated
list and logs a single total `[CODE: fetch.py:284-315]`. Obtaining them requires either
instrumenting the pipeline and rerunning, or adding per-stage counters. `[NEEDS_HUMAN]`

**Exact query strings** (as submitted): `medical image segmentation`, `marine biology`,
`migraine prediction machine learning`, `the image-segmentation`. Note the cell-segmentation
run's real query string was **"the image-segmentation"**, not "cell segmentation".
`[LOGS: engine/jobs/*.json topic field]`

### Reconciliation of 36 / 24 / 10 / 6 / 14
- **"Retained" = CONFIRMED count.** Confirmed against marine biology: 4 CONFIRMED, matching the paper's 4. `[RECOMPUTED]`
- **"Passed θ" (10) vs "retained" (14) in the paper is not a real distinction** — but a related one exists: `confidence ≥ 0.6` (13) ≠ `CONFIRMED` (12), because WEAK candidates with 8–10 hits score ≥ 0.6. The paper has the inequality **backwards** (it reports fewer passing θ than retained, which is impossible when retention requires passing θ).
- **"24 scored"** has no mechanism in the code and no support in the data (28/28 scored). `[NEEDS_HUMAN]`
- **"6 retained with full confidence"**: full confidence (=1.0) means 0 recent hits. Stored data gives **7** across four queries.

---

## PART D — candidates_all.csv
`paper_eval/candidates_all.csv`, 28 rows `[RECOMPUTED: paper_eval/export_candidates.py]`.
`cited_paper_ids` and `rationale` are **empty by necessity** — the implementation never produces them (see A4).

Threshold sweep on logged confidences (no new LLM calls):

| θ | Candidates ≥ θ | of which CONFIRMED |
|---|---|---|
| 0.5 | 13 | 12 |
| 0.6 | 13 | 12 |
| 0.7 | 12 | 12 |
| 0.8 | 12 | 12 |

Because confidence is a deterministic function of the hit count, θ is nearly inert over
[0.5, 0.8]: it only ever moves the single WEAK candidate with 8–10 hits. **A threshold-
sensitivity analysis on this implementation cannot show meaningful variation**, and Table VI
should say so rather than presenting it as a tuned parameter.

---

## PART E — status
- **E1 (topic quality C_V/NPMI/diversity):** blocked. Topic *word lists* are stored (6 words/topic) but the **tokenised corpus is not** — `cache/{slug}_{n}.json` holds the papers, so coherence is recomputable *only* by re-deriving the topic model. Also, the paper specifies top-10 words; the code stores 6. `[NEEDS_HUMAN: rerun decision]`
- **E2 (per-stage timings):** per-stage durations ARE logged (`done in Xs` per stage) in `engine/logs/engine.log`, but only for runs still present in that log. Extraction script pending the rerun decision. `[LOGS: engine/logs/engine.log]`
- **E3 (scalability 150→5000):** requires reruns. The 1000 cap is UI-side only — `PAPER_COUNTS` `[CODE: ui/src/routes/input.tsx:13]`; the engine accepts any int `[CODE: engine/api.py:37]`, so a direct `POST /analyze {"papers": 5000}` bypasses it. **Note S2 caps `offset+limit` at 1000**, so corpora >1000 come almost entirely from OpenAlex.
- **E4/E5 (ablations, baselines):** not yet implemented — they consume the same corpus the rerun decision governs.

---

## §3. [NEEDS_HUMAN] ITEMS
1. **Rerun decision (A/B/C in §0)** — gates Tables III, VII, VIII, IX, XI, XII, XIII.
2. **Drug-discovery run** — absent; the paper's "2 retained" exists nowhere on disk.
3. **Which migraine run** — 4 equally-valid candidates.
4. **"24 of 36 scored"** — no code path produces it; confirm whether Fig. 6 was drawn from a different/earlier build.
5. **Per-source paper counts / duplicates / short-abstract removals / outlier counts** — need instrumentation.
6. **Expert annotators** (Tables IV, V, VIII ρ, IX, XIII) — count, qualifications, recruitment.
7. **Sec. III-C prose** — claims Unicode repair, HTML stripping and special-character removal that are not implemented.
8. **Fig. 5 caption** — a "medical" query is shown, but "medical" is not one of the five reported queries.

## §4. CODE↔PAPER INCONSISTENCIES
1. **Eqs. (1)–(4) are wrong** — different sparsity, unnormalised mass, different recency, and a product rather than a weighted sum. (Sec. III-E)
2. **w1,w2,w3, σ and n_min do not exist.** (Sec. III-E, Table II)
3. **Prominence is unbounded**, not in [0,1]. The paper already flags 44.16 as anomalous; the cause is the missing `/max_k n_k`.
4. **The agent does not judge anything.** No LLM verdict, no cited IDs, no rationale, no structured verdict object. (Sec. III-F)
5. **k (results per query) does not exist** — validation is count-only; no documents reach the model. (Sec. III-F)
6. **θ = 0.6 is not implemented.** (Sec. III-F, Table II)
7. **Hallucination controls (a) and (b) are not implemented** as described. (Sec. III-F)
8. **"24 of 36 scored"** contradicts an uncapped loop and 28/28 in the data. (Sec. V-C, Fig. 6)
9. **"Passed θ (10) < retained (14)"** is internally impossible. (Table III, Fig. 6)
10. **L is 200 characters, not words.** (Sec. III-C)
11. **No non-English filtering, no sentence segmentation, no HTML/Unicode cleaning.** (Sec. III-C)
12. **Δ is two different windows** — 10 years in the score, 3 years in the agent. The paper uses a single Δ.
13. **Dedup has no similarity threshold** — exact match only, so near-duplicate titles survive. This weakens the Sec. VI "deduplication required particular care" claim.
14. **Cell-segmentation query string was "the image-segmentation".**
15. **Recency uses topic mean years**, not a count of recent papers as Eq. (3) states.

---

## §5. LATE FINDINGS (report provenance) — affects Sec. V-L / Table XIII

`[RECOMPUTED: paper_eval/build_hallucination_sheet.py]`

| Query | Run | Report chars | LLM-written? |
|---|---|---|---|
| Medical imaging | `8277413e2e2b` | 4419 | **YES** |
| Marine biology | `ba8606412f6c` | 5828 | **YES** |
| Migraine research | `93d1eeca7b77` | 1900 | **NO — plain-text fallback** |
| Cell segmentation | `5f0266f32a73` | 2915 | **YES** |

**All four candidate migraine runs produced fallback reports** (`93d1eeca7b77`,
`52f817e76a55`, `7ede97a2950e` at 1900/1901/1900 chars; `3cd7863d13c6` at 1590).
A fallback report is emitted by `_plain_report()` when every Anthropic synthesis
attempt fails `[CODE: engine/engine/synth.py:75-80]` — the numbers in it are real,
but the prose is a template, not model output.

**Consequences:**
1. The statement pool for Table XIII is **39, not 50** — migraine contributes only
   **1** usable sentence. `N = 50` is unreachable from stored reports.
2. Hallucination cannot be measured on the migraine report at all: no LLM wrote it.
3. If the paper's Fig. 5 (report view) came from one of these runs, it is showing
   template output, not the system's LLM synthesis.

`[NEEDS_HUMAN #9]` Decide whether Table XIII is reported on N=39 across three
queries, or the runs are regenerated (see §0 option A).
