"""Table VIII step 1 (ENGINE venv): re-derive the topic model for each rerun
corpus and dump top-10 topic words + the tokenised corpus for gensim.

Deterministic: same cached corpus + UMAP random_state=42 as the run itself, so
this reproduces the run's clustering rather than making a new one.
Tokenisation: the SAME CountVectorizer analyzer the topic model uses
(english stop words + query tokens removed, ngram_range=(1,2)), so that
bigram topic words exist in the token space gensim scores against.
"""
import json, sys, re, pathlib
sys.path.insert(0, "/Users/suchithreddy/Desktop/Developer/researchgap-ai/engine")
import warnings; warnings.filterwarnings("ignore")
from engine import nlp

QUERIES = {
    "medical imaging":   ("medical image segmentation", "medical-image-segmentation"),
    "marine biology":    ("marine biology", "marine-biology"),
    "migraine research": ("migraine prediction machine learning", "migraine-prediction-machine-learning"),
    "drug discovery":    ("graph neural networks drug discovery", "graph-neural-networks-drug-discovery"),
    "cell segmentation": ("cell segmentation", "cell-segmentation"),
}
ROOT = pathlib.Path("/Users/suchithreddy/Desktop/Developer/researchgap-ai")
CACHE = ROOT / "engine/cache"
out = {}
for label, (query, slug) in QUERIES.items():
    p = CACHE / f"{slug}_300.json"
    if not p.exists():
        print(f"[skip] {label}: no cache at {p}"); continue
    papers = nlp.clean_papers(json.loads(p.read_text()))
    emb = nlp.embed_papers(papers)

    # Rebuild the identical model to read top-10 words (the pipeline keeps 6).
    import numpy as np
    from bertopic import BERTopic
    from hdbscan import HDBSCAN
    from sklearn.feature_extraction.text import CountVectorizer
    from umap import UMAP
    stop = list(CountVectorizer(stop_words="english").get_stop_words())
    stop += [w.lower() for w in re.findall(r"[a-zA-Z]+", query)]
    vect = CountVectorizer(stop_words=stop, ngram_range=(1, 2))
    model = BERTopic(
        umap_model=UMAP(n_neighbors=15, n_components=5, min_dist=0.0,
                        metric="cosine", low_memory=False, random_state=42),
        vectorizer_model=vect,
        hdbscan_model=HDBSCAN(min_cluster_size=max(6, len(papers)//40), min_samples=2),
        calculate_probabilities=False,
    )
    docs = [f"{x['title']}. {x['abstract']}" for x in papers]
    assignments, _ = model.fit_transform(docs, np.asarray(emb))

    topics_words, topics_words25 = [], []
    for tid in sorted(set(assignments)):
        if tid == -1: continue
        words = [w for w, _ in model.get_topic(tid)]
        topics_words.append(words[:10])
        topics_words25.append(words[:25])

    analyzer = vect.build_analyzer()
    tokens = [analyzer(d) for d in docs]
    out[label] = {"query": query, "n_docs": len(papers),
                  "n_topics": len(topics_words),
                  "outliers": int(sum(1 for a in assignments if a == -1)),
                  "topics_top10": topics_words, "topics_top25": topics_words25,
                  "tokens": tokens}
    print(f"  {label:20} docs={len(papers):>4} topics={len(topics_words):>3} outliers={out[label]['outliers']:>3}")

(ROOT / "paper_eval/coherence_input.json").write_text(json.dumps(out))
print(f"\nwrote paper_eval/coherence_input.json ({len(out)} queries)")
