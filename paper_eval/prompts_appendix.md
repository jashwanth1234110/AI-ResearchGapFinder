# Prompt Appendix — ResearchGap AI

Extracted verbatim from source by `paper_eval/dump_prompts.py`.
Every prompt below is a *user* message unless marked SYSTEM.

## 1. Agentic validation — query generation (Stage 5)

Source: `engine/engine/agent.py` lines 42–59

Model: `AGENT_MODEL` (default `claude-haiku-4-5-20251001`). **temperature=0, max_tokens=200.** This is the ONLY LLM call in the validation stage — the LLM writes search queries; it does NOT judge the candidate.

```python
    prompt = (
        "Two research topics:\n"
        f"A: {', '.join(gap['keywords_a'])}\n"
        f"B: {', '.join(gap['keywords_b'])}\n"
        f"Write {QUERIES_PER_GAP} literature-search queries that would find papers combining BOTH "
        "topics. Each query must be exactly two double-quoted phrases: one core "
        "concept from topic A, one core concept from topic B, "
        'e.g. "graph neural networks" "drug discovery". '
        f"Respond ONLY with a JSON array of {QUERIES_PER_GAP} strings."
    )

    def attempt():
        return client.messages.create(
            model=os.getenv("AGENT_MODEL", "claude-haiku-4-5-20251001"),
            max_tokens=200,
            temperature=0,
            messages=[{"role": "user", "content": prompt}],
        )
```

## 2. Report synthesis (Stage 6)

Source: `engine/engine/synth.py` lines 36–66

Model: `SYNTH_MODEL` (default `claude-sonnet-4-6`). **max_tokens=2000, temperature NOT SET (SDK default).** Single user message, no system prompt.

```python
    # stack under call_with_retry below, multiplying the effective timeout.
    # 90s, not 30s: this call asks for up to 2000 tokens of report prose, and
    # a 30s ceiling was timing out on larger topic sets -- all three attempts
    # would fail and the run would silently degrade to _plain_report(), which
    # is correct but visibly worse output. Retries are still capped at 2 by
    # call_with_retry below, so worst case is bounded.
    client = anthropic.Anthropic(timeout=90.0, max_retries=0)
    payload = {
        "domain": topic,
        "topics_found": [
            {"label": t["label"], "size": t["size"], "mean_year": t["mean_year"]}
            for t in topics.values()
        ],
        "validated_gaps": survivors,
        "rejected_gaps": [
            {"topics": f"{g['topic_a']} x {g['topic_b']}", "recent_papers": g["recent_papers_found"]}
            for g in validated
            if g["verdict"] == "REJECTED"
        ],
    }
    prompt = (
        "You are the synthesis module of a research-gap finder. Below is REAL "
        "computed data: topic clusters from live literature and candidate gaps "
        "that survived agentic validation. Write a concise research-gap report:\n"
        "- one short paragraph on the domain's topic landscape\n"
        "- for each validated gap: a name, why it is a gap (use the bridge-paper "
        "and validation numbers), and a 2-3 step research agenda\n"
        "- one line acknowledging the rejected candidates\n"
        "Do NOT invent gaps that are not in the data. Ground every claim in the numbers.\n\n"
        f"DATA:\n{json.dumps(payload, indent=2)}"
    )
```

## 3. Report-grounded chat — SYSTEM prompt

Source: `engine/engine/chat.py` lines 28–52

Model: `CHAT_MODEL` (default `claude-haiku-4-5-20251001`). **max_tokens=1000, temperature NOT SET.** Passed as the `system=` parameter; conversation history is replayed as messages.

```python
def _build_system_prompt(job: dict) -> str:
    result = job["result"]
    core = {
        "topic": result["topic"],
        "papers_count": result["papers_count"],
        "topics": result["topics"],
        "gaps": result["gaps"],
        "confirmed_count": result["confirmed_count"],
        "weak_count": result["weak_count"],
        "rejected_count": result["rejected_count"],
        "unverified_count": result["unverified_count"],
        "report": result["report"],
    }
    return (
        "You are answering questions about ONE specific completed research-gap "
        "analysis job. Answer ONLY using the JOB DATA below -- do not use outside "
        "or general knowledge about the subject matter, do not search the web, and "
        "do not reference any other analysis or job. If a question asks about "
        "something this data doesn't cover (including anything unrelated to this "
        "analysis entirely), say so clearly rather than filling in with outside "
        "knowledge.\n\n"
        "Gaps are numbered in the order they appear below (gap 1, gap 2, ...) -- "
        "use that numbering when the user refers to \"gap N\".\n\n"
        f"JOB DATA:\n{json.dumps(core, indent=2)}"
    )
```

