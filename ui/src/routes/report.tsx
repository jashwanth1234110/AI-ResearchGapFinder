import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Network, Download, Check, ArrowLeft } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { KnowledgeMap } from "@/components/KnowledgeMap";
import { GapCard } from "@/components/GapDetail";
import { GapExportPanel } from "@/components/GapExportPanel";
import { useAnalysisStore } from "@/store/analysis";
import { gapKey } from "@/lib/gap";

export const Route = createFileRoute("/report")({
  head: () => ({
    meta: [
      { title: "Analysis Report — ResearchGap AI" },
      { name: "description", content: "Synthesized research-gap report from live literature data." },
    ],
  }),
  component: Report,
});

function Report() {
  const navigate = useNavigate();
  const result = useAnalysisStore((s) => s.result);
  const jobId = useAnalysisStore((s) => s.jobId);
  const [exported, setExported] = useState(false);
  const [selectedGapIndex, setSelectedGapIndex] = useState<number | null>(null);

  useEffect(() => {
    if (!result) navigate({ to: "/input" });
  }, [result, navigate]);

  if (!result) return null;

  const { topic, topics, gaps, papers_count, confirmed_count, report } = result;
  const selectedGap = selectedGapIndex !== null ? gaps[selectedGapIndex] : null;

  const doExport = () => {
    const blob = new Blob([report], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "report.md";
    a.click();
    URL.revokeObjectURL(url);
    setExported(true);
    setTimeout(() => setExported(false), 2200);
  };

  return (
    <div className="relative min-h-screen bg-background text-foreground">
      <div className="pointer-events-none fixed inset-0 -z-10 grid-bg opacity-20" />
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute right-1/4 top-0 h-[420px] w-[420px] rounded-full bg-[var(--violet)] opacity-[0.1] blur-[140px]" />
      </div>

      <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-6">
        <Link to="/dashboard" className="flex items-center gap-2 font-mono text-xs tracking-wider text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> BACK TO MAP
        </Link>
        <div className="flex items-center gap-2">
          <Network className="h-4 w-4 text-[var(--cyan)]" />
          <span className="font-display text-sm font-semibold tracking-widest">RESEARCHGAP<span className="text-glow-cyan">AI</span></span>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 pb-24">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
          <span className="font-mono text-xs tracking-[0.3em] text-[var(--violet)]">SYNTHESIZED REPORT</span>
          <h1 className="mt-3 text-4xl font-bold">{topic}</h1>
          <p className="mt-2 font-mono text-sm text-muted-foreground">
            {papers_count} papers · {topics.length} topics · {gaps.length} candidate gaps · {confirmed_count} confirmed
          </p>
        </motion.div>

        <div className="mt-8 grid gap-4 md:grid-cols-[1fr_260px]">
          <div className="glass hud-corners overflow-hidden rounded-2xl">
            <div className="border-b border-border/60 px-4 py-3 font-mono text-[11px] tracking-widest text-muted-foreground">
              KNOWLEDGE MAP SNAPSHOT
            </div>
            <div className="h-72">
              <KnowledgeMap topics={topics} gaps={gaps} compact />
            </div>
          </div>
          <div className="glass flex flex-col justify-center gap-4 rounded-2xl p-6">
            <div>
              <div className="font-mono text-4xl font-bold text-glow-cyan">{topics.length}</div>
              <div className="font-mono text-[10px] tracking-widest text-muted-foreground">TOPICS MAPPED</div>
            </div>
            <div>
              <div className="font-mono text-4xl font-bold text-[var(--violet)]">{confirmed_count}</div>
              <div className="font-mono text-[10px] tracking-widest text-muted-foreground">CONFIRMED GAPS</div>
            </div>
          </div>
        </div>

        {/* Per-gap cards -- click one to select/highlight it and reveal export options */}
        <div className="mt-10 flex gap-3 overflow-x-auto pb-2">
          {gaps.map((g, i) => (
            <div key={gapKey(g)} className="w-72 flex-none">
              <GapCard
                gap={g}
                selected={selectedGapIndex === i}
                onOpen={() => setSelectedGapIndex(selectedGapIndex === i ? null : i)}
              />
            </div>
          ))}
        </div>

        {selectedGap && jobId ? (
          <GapExportPanel
            jobId={jobId}
            gapIndex={selectedGapIndex!}
            gap={selectedGap}
            onBack={() => setSelectedGapIndex(null)}
          />
        ) : selectedGap ? (
          <p className="glass hud-corners mt-10 rounded-2xl p-6 text-sm text-muted-foreground">
            Per-gap export isn't available for this analysis (no job id on record).
          </p>
        ) : (
          <>
            {/* Real synthesized report markdown */}
            <div className="glass hud-corners mt-10 overflow-hidden rounded-2xl">
              <div className="border-b border-border/60 px-4 py-3 font-mono text-[11px] tracking-widest text-muted-foreground">
                REPORT.MD
              </div>
              <article className="report-md px-6 py-6 font-serif text-[15px] leading-relaxed text-foreground/90 md:px-10 md:py-8">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{report}</ReactMarkdown>
              </article>
            </div>

            <div className="mt-12 flex justify-center">
              <motion.button
                onClick={doExport}
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.97 }}
                className="flex items-center gap-3 rounded-xl bg-[var(--cyan)]/15 px-8 py-4 font-mono text-sm font-medium tracking-wide text-[var(--cyan)] shadow-[0_0_30px_-6px_var(--cyan)] ring-1 ring-[var(--cyan)]/50"
              >
                <Download className="h-4 w-4" /> Export Report (report.md)
              </motion.button>
            </div>
          </>
        )}
      </main>

      <AnimatePresence>
        {exported && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-background/60 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className="glass hud-corners flex flex-col items-center rounded-2xl px-12 py-10"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 300, damping: 18, delay: 0.1 }}
                className="flex h-20 w-20 items-center justify-center rounded-full bg-[var(--cyan)]/15 ring-2 ring-[var(--cyan)] pulse-glow"
              >
                <Check className="h-10 w-10 text-[var(--cyan)]" strokeWidth={3} />
              </motion.div>
              <p className="mt-5 font-mono text-sm tracking-widest text-[var(--cyan)]">REPORT EXPORTED</p>
              <p className="mt-1 text-xs text-muted-foreground">report.md downloaded</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
