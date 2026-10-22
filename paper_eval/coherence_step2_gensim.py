"""Table VIII step 2 (COHERENCE venv): C_V and NPMI via gensim, plus diversity."""
import json, pathlib, warnings
warnings.filterwarnings("ignore")
from gensim.corpora import Dictionary
from gensim.models import CoherenceModel

ROOT = pathlib.Path("/Users/suchithreddy/Desktop/Developer/researchgap-ai")
data = json.loads((ROOT/"paper_eval/coherence_input.json").read_text())
rows = []
for label, d in data.items():
    tokens = d["tokens"]
    dct = Dictionary(tokens)
    # Keep only topic words present in the dictionary; gensim errors otherwise.
    def keep(ts): return [[w for w in t if w in dct.token2id] for t in ts]
    t10 = [t for t in keep(d["topics_top10"]) if len(t) >= 2]
    res = {"query": label, "n_topics": d["n_topics"], "n_docs": d["n_docs"],
           "topics_scored": len(t10)}
    for metric, key in (("c_v", "C_V"), ("c_npmi", "NPMI")):
        try:
            cm = CoherenceModel(topics=t10, texts=tokens, dictionary=dct,
                                coherence=metric, topn=10)
            res[key] = round(float(cm.get_coherence()), 4)
        except Exception as e:
            res[key] = f"ERROR: {type(e).__name__}"
    # Diversity = unique words / total words across the top-25 of every topic.
    all25 = [w for t in d["topics_top25"] for w in t]
    res["Diversity"] = round(len(set(all25))/len(all25), 4) if all25 else None
    res["diversity_basis"] = f"{len(set(all25))} unique / {len(all25)} total"
    rows.append(res)
    print(f"  {label:20} topics={res['n_topics']:>3} scored={res['topics_scored']:>3} "
          f"C_V={res['C_V']} NPMI={res['NPMI']} Div={res['Diversity']}  ({res['diversity_basis']})")
(ROOT/"paper_eval/coherence_results.json").write_text(json.dumps(rows, indent=2))
print("\nwrote paper_eval/coherence_results.json")
print("Tokenisation: sklearn CountVectorizer analyzer, english stop words + query")
print("tokens removed, ngram_range=(1,2) -- identical to the topic model's vectorizer.")
