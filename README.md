# AI Powered Research Gap Finder

Type any research topic and the system pulls live literature, clusters it,
finds under-explored areas between the clusters, re-verifies each candidate
gap against the literature, and writes up a report. Nothing is canned: a
different topic gives different papers, clusters and gaps.

## Pipeline

| Stage | Module | What happens |
|-------|--------|--------------|
| 1. Input | `engine/main.py`, `engine/api.py` | Topic comes in from the CLI or the web UI |
| 2. Collection | `engine/engine/fetch.py` | Live paper search via Semantic Scholar + OpenAlex |
| 3. NLP | `engine/engine/nlp.py` | Local Sentence-BERT embeddings + BERTopic clustering |
| 4. Gap detection | `engine/engine/gaps.py` | Finds sparse regions between topic clusters |
| 5. Agent verification | `engine/engine/agent.py` | Re-queries OpenAlex per gap and rejects ones already covered |
| 6. Synthesis | `engine/engine/synth.py` | Claude turns the computed results into a readable report |

## Stack

- **Engine:** Python, FastAPI (uvicorn), Sentence-BERT, BERTopic
- **UI:** React + TypeScript + Vite
- **LLM:** Claude API (Anthropic). Optional: without a key the engine still runs and produces a plain-text report.

## Repo layout

```
engine/       FastAPI backend + pipeline (port 8001)
ui/           React/Vite frontend (port 3001)
paper_eval/   Evaluation scripts and results for the paper
scripts/      Dev helpers (npm run doctor)
```

## Setup

Requires Node (see `.nvmrc`) and Python 3.

```bash
# UI
cd ui && npm install && cd ..

# Engine
cd engine
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
cp .env.example .env        # then fill in your keys
cd ..

# Root (installs concurrently)
npm install
```

The first run downloads the Sentence-BERT model (~80 MB) once.

### Environment variables (`engine/.env`)

| Variable | Required | Purpose |
|----------|----------|---------|
| `ANTHROPIC_API_KEY` | Optional | Claude API: LLM verification queries and the polished report |
| `OPENALEX_MAILTO` | Recommended | Your email for the OpenAlex polite pool (free, no signup) |
| `OPENALEX_API_KEY` | Optional | OpenAlex API key |
| `S2_API_KEY` | Optional | Semantic Scholar key for higher rate limits |
| `AGENT_MODEL`, `SYNTH_MODEL`, `CHAT_MODEL` | Optional | Override the Claude models used per stage |

See `.env.example` for a template. Never commit the real `.env`.

## Run

```bash
npm run dev
```

- UI: http://localhost:3001
- Engine API: http://127.0.0.1:8001

If startup fails, run `npm run doctor` for an environment check with fix-it hints.

Engine only, from the CLI:

```bash
cd engine && .venv/bin/python main.py "federated learning in healthcare"
```
