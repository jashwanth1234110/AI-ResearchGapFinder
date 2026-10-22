import { motion, AnimatePresence } from "framer-motion";
import { X, Check, ShieldCheck, ShieldAlert, ShieldOff, ShieldQuestion, Search } from "lucide-react";
import type { Gap, Topic } from "@/lib/api";
import { ProminenceGauge } from "./ProminenceGauge";
import { KnowledgeMap } from "./KnowledgeMap";

function VerdictBadge({ verdict }: { verdict: Gap["verdict"] }) {
  if (verdict === "CONFIRMED") {
    return (
      <span className="flex items-center gap-1.5 rounded-full bg-[var(--cyan)]/15 px-3 py-1 font-mono text-[10px] tracking-wider text-[var(--cyan)] ring-1 ring-[var(--cyan)]/30">
        <ShieldCheck className="h-3 w-3" /> CONFIRMED
      </span>
    );
  }
  if (verdict === "WEAK") {
    return (
      <span className="flex items-center gap-1.5 rounded-full bg-[var(--amber)]/15 px-3 py-1 font-mono text-[10px] tracking-wider text-[var(--amber)] ring-1 ring-[var(--amber)]/30">
        <ShieldAlert className="h-3 w-3" /> WEAK
      </span>
    );
  }
  if (verdict === "UNVERIFIED") {
    return (
      <span className="flex items-center gap-1.5 rounded-full bg-muted/40 px-3 py-1 font-mono text-[10px] tracking-wider text-muted-foreground ring-1 ring-border">
        <ShieldQuestion className="h-3 w-3" /> UNVERIFIED
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1.5 rounded-full bg-muted/40 px-3 py-1 font-mono text-[10px] tracking-wider text-muted-foreground ring-1 ring-border">
      <ShieldOff className="h-3 w-3" /> REJECTED
    </span>
  );
}

function KeywordGroup({ title, keywords }: { title: string; keywords: string[] }) {
  return (
    <div>
      <p className="mb-1.5 font-mono text-[10px] tracking-widest text-muted-foreground">{title}</p>
      <div className="flex flex-wrap gap-1.5">
        {keywords.map((k) => (
          <span key={k} className="rounded-full bg-[var(--cyan)]/10 px-2.5 py-0.5 font-mono text-[11px] text-[var(--cyan)] ring-1 ring-[var(--cyan)]/20">
            {k}
          </span>
        ))}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="glass rounded-lg p-3 text-center">
      <div className="font-mono text-lg font-bold text-glow-cyan">{value}</div>
      <div className="font-mono text-[9px] tracking-widest text-muted-foreground">{label}</div>
    </div>
  );
}

interface DetailProps {
  gap: Gap;
  topics: Topic[];
  gaps: Gap[];
  gapId: string;
  onClose: () => void;
}

export function GapDetail({ gap, topics, gaps, gapId, onClose }: DetailProps) {
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 p-4 backdrop-blur-sm"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 20 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          onClick={(e) => e.stopPropagation()}
          className="glass hud-corners relative grid max-h-[88vh] w-full max-w-4xl gap-6 overflow-y-auto rounded-2xl p-6 md:grid-cols-[1fr_320px] md:p-8"
        >
          <button
            onClick={onClose}
            className="absolute right-4 top-4 z-10 flex h-8 w-8 items-center justify-center rounded-full glass glass-hover"
          >
            <X className="h-4 w-4" />
          </button>

          {/* Main */}
          <div>
            <VerdictBadge verdict={gap.verdict} />
            <h2 className="mt-4 text-2xl font-bold leading-tight">
              {gap.topic_a} <span className="text-muted-foreground">×</span> {gap.topic_b}
            </h2>

            <p className="mt-5 font-serif text-[17px] leading-relaxed text-foreground/90">
              These two topics share only <span className="text-[var(--cyan)]">{gap.bridge_papers}</span> bridge
              papers across a combined <span className="text-[var(--cyan)]">{gap.size_a + gap.size_b}</span> papers
              examined, for a prominence score of <span className="text-[var(--cyan)]">{gap.prominence}</span>.
              Independent verification against OpenAlex found{" "}
              <span className="text-[var(--cyan)]">{gap.recent_papers_found}</span> recent papers directly at this
              intersection.
            </p>

            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="BRIDGE PAPERS" value={gap.bridge_papers} />
              <Stat label="RECENT HITS" value={gap.recent_papers_found} />
              <Stat label="PROMINENCE" value={gap.prominence} />
              <Stat label="TOPIC SIZES" value={`${gap.size_a} / ${gap.size_b}`} />
            </div>

            <div className="mt-7 grid gap-4 sm:grid-cols-2">
              <KeywordGroup title={`TOPIC A · ${gap.topic_a}`} keywords={gap.keywords_a} />
              <KeywordGroup title={`TOPIC B · ${gap.topic_b}`} keywords={gap.keywords_b} />
            </div>

            <h3 className="mb-3 mt-7 flex items-center gap-2 font-mono text-xs tracking-widest text-[var(--violet)]">
              <Search className="h-3.5 w-3.5" /> VERIFICATION QUERIES (OPENALEX)
            </h3>
            <ul className="space-y-2">
              {gap.verification_queries.map((q, i) => (
                <li key={i} className="flex gap-2 font-mono text-[12px] text-foreground/80">
                  <Check className="mt-0.5 h-3 w-3 flex-none text-[var(--cyan)]" />
                  {q}
                </li>
              ))}
            </ul>
          </div>

          {/* Side rail */}
          <div className="space-y-5">
            <div className="glass flex flex-col items-center rounded-xl p-5">
              <ProminenceGauge score={Math.round(gap.confidence * 100)} size={120} strokeWidth={10} label="CONFIDENCE" />
              <p className="mt-2 text-center font-mono text-[10px] tracking-wider text-muted-foreground">
                AGENTIC VALIDATION CONFIDENCE
              </p>
            </div>

            <div className="glass rounded-xl p-4">
              <p className="mb-2 font-mono text-[10px] tracking-widest text-muted-foreground">POSITION ON MAP</p>
              <div className="h-40 overflow-hidden rounded-lg ring-1 ring-border">
                <KnowledgeMap
                  topics={topics}
                  gaps={gaps}
                  highlightTopics={[gap.topic_a, gap.topic_b]}
                  activeGapId={gapId}
                  compact
                />
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

export function GapCard({
  gap,
  onOpen,
  selected,
}: {
  gap: Gap;
  onOpen: () => void;
  selected?: boolean;
}) {
  const rejected = gap.verdict === "REJECTED" || gap.verdict === "UNVERIFIED";
  return (
    <motion.button
      onClick={onOpen}
      whileHover={{ y: -3 }}
      className={`glass glass-hover w-full rounded-xl p-4 text-left ${rejected ? "opacity-45" : ""} ${
        selected ? "ring-2 ring-[var(--cyan)]" : ""
      }`}
    >
      <div className="flex items-start gap-4">
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex items-center gap-2">
            <VerdictBadge verdict={gap.verdict} />
          </div>
          <h3 className="text-sm font-semibold leading-snug">
            {gap.topic_a} × {gap.topic_b}
          </h3>
          <p className="mt-1 font-mono text-xs text-muted-foreground">
            {gap.bridge_papers} bridge papers · {gap.recent_papers_found} recent hits · prominence{" "}
            {gap.prominence}
          </p>
        </div>
        <ProminenceGauge score={Math.round(gap.confidence * 100)} size={64} strokeWidth={6} label="CONF" animateOnMount={false} />
      </div>
    </motion.button>
  );
}
