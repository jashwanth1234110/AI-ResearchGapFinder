"""Table VII variants on the STORED 2026-09-18 corpora. Deterministic, no LLM.

Variants (each selects G=8 candidates, matching the full system):
  full            the implemented pipeline's candidates (= "no validation" pool)
  recency_off     prominence with r := 1
  sparsity_off    prominence with s := 1
  single_topic    single-topic sparsity instead of cross-topic pairs
  no_clustering   keyword co-occurrence pairs, no topic model at all
  lda             LDA topics (sklearn) in place of BERTopic, same gap logic
"""
import json, sys, re, pathlib, itertools, warnings
warnings.filterwarnings("ignore")
ROOT = pathlib.Path("/Users/suchithreddy/Desktop/Developer/researchgap-ai")
sys.path.insert(0, str(ROOT/"engine"))
import numpy as np
from engine import nlp
from engine.gaps import BRIDGE_SIM

QUERIES = {
    "medical imaging":   ("medical image segmentation", "medical-image-segmentation"),
    "marine biology":    ("marine biology", "marine-biology"),
    "migraine research": ("migraine prediction machine learning", "migraine-prediction-machine-learning"),
    "drug discovery":    ("graph neural networks drug discovery", "graph-neural-networks-drug-discovery"),
    "cell segmentation": ("cell segmentation", "cell-segmentation"),
}
G = 8

def recency_of(ta, tb, Y):
    yrs = [y for y in (ta["mean_year"], tb["mean_year"]) if y]
    if not (yrs and Y): return 1.0
    return 1.0 + 0.5*max(0.0, 1.0 - (Y - min(yrs))/10.0)

def pair_candidates(topics, emb, Y, use_s=True, use_r=True):
    out = []
    for a, b in itertools.combinations(topics.keys(), 2):
        ta, tb = topics[a], topics[b]
        br = int(np.sum((emb @ ta["centroid"] > BRIDGE_SIM) & (emb @ tb["centroid"] > BRIDGE_SIM)))
        s = 1.0/(1.0+br) if use_s else 1.0
        m = float(np.sqrt(ta["size"]*tb["size"]))
        r = recency_of(ta, tb, Y) if use_r else 1.0
        out.append({"topic_a": ta["label"], "topic_b": tb["label"],
                    "keywords_a": ta["keywords"], "keywords_b": tb["keywords"],
                    "size_a": ta["size"], "size_b": tb["size"], "bridge_papers": br,
                    "prominence": round(s*m*r, 2)})
    out.sort(key=lambda c: c["prominence"], reverse=True)
    sparse = [c for c in out if c["bridge_papers"] <= 3]
    return (sparse or out)[:G]

def lda_topics(papers, emb, query, k):
    from sklearn.decomposition import LatentDirichletAllocation
    from sklearn.feature_extraction.text import CountVectorizer
    stop = list(CountVectorizer(stop_words="english").get_stop_words())
    stop += [w.lower() for w in re.findall(r"[a-zA-Z]+", query)]
    vect = CountVectorizer(stop_words=stop, max_df=0.95, min_df=2)
    X = vect.fit_transform([f"{p['title']}. {p['abstract']}" for p in papers])
    lda = LatentDirichletAllocation(n_components=k, random_state=42, learning_method="batch")
    doc_topic = lda.fit_transform(X)
    assign = doc_topic.argmax(axis=1)
    vocab = np.array(vect.get_feature_names_out())
    topics = {}
    for t in range(k):
        idxs = [i for i, a in enumerate(assign) if a == t]
        if len(idxs) < 2: continue
        words = list(vocab[np.argsort(lda.components_[t])[::-1][:6]])
        yrs = [papers[i]["year"] for i in idxs if papers[i]["year"]]
        topics[t] = {"keywords": words, "label": " / ".join(words[:3]), "size": len(idxs),
                     "centroid": emb[idxs].mean(axis=0),
                     "mean_year": round(float(np.mean(yrs)), 1) if yrs else None}
    return topics

def keyword_pairs(papers, query):
    """No topic model: take the 30 most frequent content terms, form pairs, and
    score pairs that are individually common but rarely co-occur in one abstract.
    sparsity = 1/(1+co-occurrences); mass = sqrt(df_a*df_b); recency omitted (=1)."""
    from sklearn.feature_extraction.text import CountVectorizer
    stop = list(CountVectorizer(stop_words="english").get_stop_words())
    stop += [w.lower() for w in re.findall(r"[a-zA-Z]+", query)]
    vect = CountVectorizer(stop_words=stop, max_features=30, binary=True, min_df=3)
    X = vect.fit_transform([f"{p['title']}. {p['abstract']}" for p in papers]).toarray()
    terms = vect.get_feature_names_out(); df = X.sum(axis=0)
    out = []
    for i, j in itertools.combinations(range(len(terms)), 2):
        co = int(np.sum((X[:, i] > 0) & (X[:, j] > 0)))
        out.append({"topic_a": terms[i], "topic_b": terms[j],
                    "keywords_a": [terms[i]], "keywords_b": [terms[j]],
                    "size_a": int(df[i]), "size_b": int(df[j]), "bridge_papers": co,
                    "prominence": round((1.0/(1.0+co))*float(np.sqrt(df[i]*df[j])), 2)})
    out.sort(key=lambda c: c["prominence"], reverse=True)
    return out[:G]

def single_topic(topics, emb, Y):
    """Single-topic sparsity: a topic is 'sparse' when few corpus papers outside
    it are close to its centroid. sparsity = 1/(1+outside_neighbours)."""
    out = []
    for t in topics.values():
        near = int(np.sum(emb @ t["centroid"] > BRIDGE_SIM))
        outside = max(0, near - t["size"])
        r = 1.0 + 0.5*max(0.0, 1.0 - (Y - t["mean_year"])/10.0) if (t["mean_year"] and Y) else 1.0
        out.append({"topic_a": t["label"], "topic_b": "(single topic)",
                    "keywords_a": t["keywords"], "keywords_b": [],
                    "size_a": t["size"], "size_b": 0, "bridge_papers": outside,
                    "prominence": round((1.0/(1.0+outside))*float(t["size"])*r, 2)})
    out.sort(key=lambda c: c["prominence"], reverse=True)
    return out[:G]

results = {}
for label, (query, slug) in QUERIES.items():
    papers = nlp.clean_papers(json.loads((ROOT/f"engine/cache/{slug}_300.json").read_text()))
    emb = np.asarray(nlp.embed_papers(papers))
    topics = nlp.cluster_topics(papers, emb, query=query)["topics"]
    Y = max((p["year"] or 0) for p in papers)
    results[label] = {
        "full":          pair_candidates(topics, emb, Y, True,  True),
        "recency_off":   pair_candidates(topics, emb, Y, True,  False),
        "sparsity_off":  pair_candidates(topics, emb, Y, False, True),
        "single_topic":  single_topic(topics, emb, Y),
        "no_clustering": keyword_pairs(papers, query),
        "lda":           pair_candidates(lda_topics(papers, emb, query, len(topics)), emb, Y, True, True),
    }
    print(f"  {label:20} " + "  ".join(f"{k}={len(v)}" for k, v in results[label].items()), flush=True)

(ROOT/"paper_eval/ablation_candidates.json").write_text(json.dumps(results, indent=2, default=str))

def sig(c): return (str(c["topic_a"]), str(c["topic_b"]))
allc = {}
for q, vs in results.items():
    for v, cs in vs.items():
        for c in cs: allc.setdefault((q, sig(c)), set()).add(v)
base = {(q, sig(c)) for q, vs in results.items() for c in vs["full"]}
print(f"\n  total candidate slots  : {sum(len(c) for v in results.values() for c in v.values())}")
print(f"  UNIQUE candidates      : {len(allc)}")
print(f"  already judged (full)  : {len(base)}")
print(f"  NEW needing judging    : {len(allc) - len(base)}")
