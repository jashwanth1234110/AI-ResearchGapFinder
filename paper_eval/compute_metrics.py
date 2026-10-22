"""PART F2: compute every expert-dependent table once filled sheets exist.

Place one filled copy of annotation_sheet.csv per annotator in
    paper_eval/labels/   e.g. labels/annotator_A.csv, labels/annotator_B.csv
then run:  python3 paper_eval/compute_metrics.py

Produces Tables IV, V, VI, VII, VIII(rho), IX. Computes nothing it cannot
derive from the sheets -- missing inputs are reported, never imputed.
"""
import csv, glob, os, sys, math, statistics as st
from collections import defaultdict

LAB = "paper_eval/labels"
if not os.path.isdir(LAB) or not glob.glob(f"{LAB}/*.csv"):
    sys.exit(f"No filled sheets in {LAB}/. Nothing to compute -- see paper_values.md NEEDS_HUMAN #6.")

key = {r["row_id"]: r for r in csv.DictReader(open("paper_eval/annotation_KEY.csv"))}
sheets = {os.path.basename(p): {r["row_id"]: r for r in csv.DictReader(open(p))}
          for p in sorted(glob.glob(f"{LAB}/*.csv"))}
names = list(sheets)
print(f"Annotators: {', '.join(names)}  ({len(names)})")

def yn(v): return str(v).strip().upper()[:1] if v else ""

# ---- majority label per candidate -------------------------------------
truth = {}
for rid in key:
    votes = [yn(sheets[n].get(rid,{}).get("genuine_gap_YN")) for n in names]
    votes = [v for v in votes if v in ("Y","N")]
    if not votes: continue
    truth[rid] = "Y" if votes.count("Y")*2 > len(votes) else "N"
print(f"Candidates with a majority label: {len(truth)}/{len(key)}")

# ---- Table IV: P/R/F1 per query and overall ---------------------------
def prf(rids):
    TP=FP=TN=FN=0
    for rid in rids:
        if rid not in truth: continue
        pred = key[rid]["retained"]=="Y"; gold = truth[rid]=="Y"
        if pred and gold: TP+=1
        elif pred and not gold: FP+=1
        elif not pred and not gold: TN+=1
        else: FN+=1
    P = TP/(TP+FP) if TP+FP else float("nan")
    R = TP/(TP+FN) if TP+FN else float("nan")
    F = 2*P*R/(P+R) if P+R and not math.isnan(P) and not math.isnan(R) and (P+R)>0 else float("nan")
    return TP,FP,TN,FN,P,R,F

byq = defaultdict(list)
for rid,k in key.items(): byq[k["query"]].append(rid)
print("\n=== TABLE IV: gap detection accuracy vs expert labels ===")
print(f"{'query':20} {'TP':>3} {'FP':>3} {'TN':>3} {'FN':>3} {'Prec':>6} {'Rec':>6} {'F1':>6}")
for q,rids in sorted(byq.items()):
    TP,FP,TN,FN,P,R,F = prf(rids)
    print(f"{q:20} {TP:>3} {FP:>3} {TN:>3} {FN:>3} {P:>6.3f} {R:>6.3f} {F:>6.3f}")
TP,FP,TN,FN,P,R,F = prf(list(key))
print(f"{'ALL':20} {TP:>3} {FP:>3} {TN:>3} {FN:>3} {P:>6.3f} {R:>6.3f} {F:>6.3f}")

# ---- kappa ------------------------------------------------------------
def cohen(a,b):
    rids=[r for r in key if yn(sheets[a].get(r,{}).get("genuine_gap_YN")) in "YN"
                        and yn(sheets[b].get(r,{}).get("genuine_gap_YN")) in "YN"]
    if not rids: return float("nan")
    A=[yn(sheets[a][r]["genuine_gap_YN"]) for r in rids]; B=[yn(sheets[b][r]["genuine_gap_YN"]) for r in rids]
    po=sum(x==y for x,y in zip(A,B))/len(rids)
    pe=sum((A.count(c)/len(A))*(B.count(c)/len(B)) for c in ("Y","N"))
    return (po-pe)/(1-pe) if pe<1 else float("nan")

def fleiss():
    rids=[r for r in key if all(yn(sheets[n].get(r,{}).get("genuine_gap_YN")) in "YN" for n in names)]
    if not rids: return float("nan")
    N,n_r=len(rids),len(names); cats=("Y","N")
    P_i=[];p_j={c:0 for c in cats}
    for r in rids:
        cnt={c:sum(1 for n in names if yn(sheets[n][r]["genuine_gap_YN"])==c) for c in cats}
        for c in cats: p_j[c]+=cnt[c]
        P_i.append((sum(v*v for v in cnt.values())-n_r)/(n_r*(n_r-1)))
    for c in cats: p_j[c]/=(N*n_r)
    Pbar=sum(P_i)/N; Pe=sum(v*v for v in p_j.values())
    return (Pbar-Pe)/(1-Pe) if Pe<1 else float("nan")

print("\n=== INTER-ANNOTATOR AGREEMENT ===")
if len(names)==2: print(f"  Cohen's kappa = {cohen(*names):.3f}")
elif len(names)>2:
    print(f"  Fleiss' kappa = {fleiss():.3f}")
    for i in range(len(names)):
        for j in range(i+1,len(names)): print(f"    pairwise Cohen {names[i]} vs {names[j]}: {cohen(names[i],names[j]):.3f}")
else: print("  only one annotator -- kappa undefined")

# ---- Table V ----------------------------------------------------------
print("\n=== TABLE V: expert assessment of RETAINED gaps ===")
ret=[r for r in key if key[r]["retained"]=="Y"]
for col,lab in [("genuine_gap_YN","Gap is genuinely present"),
                ("already_addressed_YN","Gap is not already addressed"),
                ("meaningful_1to5","Research direction is meaningful"),
                ("evidence_sufficient_1to5","Supporting evidence is sufficient")]:
    vals=[]
    for r in ret:
        for n in names:
            v=sheets[n].get(r,{}).get(col,"")
            if col.endswith("_YN"):
                v=yn(v)
                if v in "YN": vals.append(1.0 if (v=="Y")!=(col=="already_addressed_YN") else 0.0)
            else:
                try: vals.append(float(v))
                except ValueError: pass
    if vals: print(f"  {lab:38} mean={st.mean(vals):.2f}  sd={(st.stdev(vals) if len(vals)>1 else 0):.2f}  n={len(vals)}")
    else:    print(f"  {lab:38} NO DATA")

# ---- Table VI ---------------------------------------------------------
print("\n=== TABLE VI: threshold sensitivity (expert-scored) ===")
print(f"{'setting':16} {'reported':>9} {'TP':>4} {'FP':>4} {'Prec':>6} {'Rec':>6} {'F1':>6}")
allg=sum(1 for r in truth if truth[r]=="Y")
for lab,sel in [("no validation", lambda k: True)] + [
        (f"theta={t}", (lambda t: (lambda k: float(k['agent_confidence'])>=t and k['agent_label']=='CONFIRMED'))(t))
        for t in (0.5,0.6,0.7,0.8)]:
    rep=[r for r in key if sel(key[r])]
    TPn=sum(1 for r in rep if truth.get(r)=="Y"); FPn=sum(1 for r in rep if truth.get(r)=="N")
    Pn=TPn/(TPn+FPn) if TPn+FPn else float("nan"); Rn=TPn/allg if allg else float("nan")
    Fn=2*Pn*Rn/(Pn+Rn) if Pn+Rn and (Pn+Rn)>0 else float("nan")
    print(f"{lab:16} {len(rep):>9} {TPn:>4} {FPn:>4} {Pn:>6.3f} {Rn:>6.3f} {Fn:>6.3f}")

# ---- Spearman ---------------------------------------------------------
print("\n=== TABLE VIII: Spearman rho (prominence vs mean expert importance rank) ===")
def spearman(x,y):
    n=len(x)
    if n<3: return float("nan"),float("nan")
    def rank(v):
        s=sorted(range(n),key=lambda i:v[i]); r=[0.0]*n
        for pos,i in enumerate(s): r[i]=pos+1
        return r
    rx,ry=rank(x),rank(y); d2=sum((a-b)**2 for a,b in zip(rx,ry))
    rho=1-6*d2/(n*(n*n-1))
    t=rho*math.sqrt((n-2)/max(1e-12,1-rho*rho))
    p=2*(1-0.5*(1+math.erf(abs(t)/math.sqrt(2))))
    return rho,p
for q,rids in sorted(byq.items()):
    xs,ys=[],[]
    for r in rids:
        ranks=[]
        for n in names:
            try: ranks.append(float(sheets[n].get(r,{}).get("importance_rank","")))
            except ValueError: pass
        if ranks: xs.append(float(key[r]["prominence"])); ys.append(st.mean(ranks))
    if len(xs)>=3:
        rho,p=spearman(xs,ys); print(f"  {q:20} rho={rho:+.3f}  p={p:.4f}  n={len(xs)}")
    else: print(f"  {q:20} insufficient importance_rank data (n={len(xs)})")

print("\n=== FULL-CONFIDENCE CHECK ===")
fc=[r for r in key if float(key[r]["agent_confidence"])>=1.0]
g=sum(1 for r in fc if truth.get(r)=="Y")
print(f"  {g}/{len(fc)} of the confidence==1.0 candidates were judged genuine")
print("\nTables VII and IX need ablation/baseline candidate pools (paper_eval/ablations.py,")
print("baselines.py) which are blocked on the rerun decision -- see paper_values.md sec 0.")
