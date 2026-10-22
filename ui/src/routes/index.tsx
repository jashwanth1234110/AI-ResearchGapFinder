import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Search, Database, Layers, Network, Radar, ShieldCheck, FileText, ArrowRight, WifiOff } from "lucide-react";
import { ParticleField } from "@/components/ParticleField";
import { CountUp } from "@/components/CountUp";
import { getStats, type Stats } from "@/lib/api";

export const Route = createFileRoute("/")({
  component: Landing,
});

const STEPS = [
  { icon: Search, title: "Input", desc: "Search by keyword or upload your own papers." },
  { icon: Database, title: "Collect", desc: "Fetch related literature from OpenAlex and Semantic Scholar." },
  { icon: Layers, title: "Cluster", desc: "Group papers by topic with Sentence-BERT embeddings + BERTopic." },
  { icon: Radar, title: "Detect Gaps", desc: "Locate cross-topic sparsity in the knowledge map." },
  { icon: ShieldCheck, title: "Validate", desc: "An agentic pass re-checks each gap against OpenAlex." },
  { icon: FileText, title: "Synthesize", desc: "Generate a ranked, readable report." },
];

function Landing() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    getStats()
      .then(setStats)
      .catch(() => setOffline(true));
  }, []);

  return (
    <div className="relative min-h-screen bg-background text-foreground">
      {/* ambient glows */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute left-1/4 top-0 h-[520px] w-[520px] rounded-full bg-[var(--cyan)] opacity-[0.12] blur-[140px]" />
        <div className="absolute right-1/4 top-1/3 h-[480px] w-[480px] rounded-full bg-[var(--violet)] opacity-[0.12] blur-[140px]" />
      </div>

      {/* Nav */}
      <header className="relative z-20 mx-auto flex max-w-7xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--cyan)]/40 bg-[var(--cyan)]/10">
            <Network className="h-5 w-5 text-[var(--cyan)]" />
          </div>
          <span className="font-display text-sm font-semibold tracking-widest">RESEARCHGAP<span className="text-glow-cyan">AI</span></span>
        </div>
        <Link
          to="/input"
          className="glass glass-hover rounded-full px-5 py-2 font-mono text-xs tracking-wider"
        >
          LAUNCH
        </Link>
      </header>

      {/* Hero */}
      <section className="relative flex min-h-[88vh] flex-col items-center justify-center overflow-hidden px-6 text-center">
        <div className="absolute inset-0 grid-bg opacity-40" />
        <ParticleField />
        <div className="pointer-events-none absolute left-0 top-0 h-px w-full bg-gradient-to-r from-transparent via-[var(--cyan)]/60 to-transparent scanline" />

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="relative z-10 flex flex-col items-center"
        >
          <span className="glass mb-6 rounded-full px-4 py-1.5 font-mono text-[11px] tracking-widest text-[var(--cyan)]">
            AGENTIC LITERATURE INTELLIGENCE
          </span>
          <h1 className="max-w-4xl text-5xl font-bold leading-[1.05] tracking-tight md:text-7xl">
            Find the Gaps <br />
            <span className="text-glow-cyan">Others Missed.</span>
          </h1>
          <p className="mt-6 max-w-xl text-balance text-lg text-muted-foreground">
            Automated literature review that collects papers from OpenAlex and Semantic Scholar, clusters topics,
            maps a knowledge graph, and surfaces AI-validated research opportunities.
          </p>

          <div className="mt-10">
            <HudCta to="/input" icon={ArrowRight} label="Find Your Gap" primary />
          </div>

          <div className="mt-14 flex gap-10 font-mono">
            {offline ? (
              <span className="flex items-center gap-2 rounded-full bg-[var(--danger)]/10 px-4 py-2 text-xs tracking-widest text-[var(--danger)] ring-1 ring-[var(--danger)]/30">
                <WifiOff className="h-3.5 w-3.5" /> ENGINE OFFLINE
              </span>
            ) : (
              [
                { n: stats?.total_papers_analyzed ?? 0, s: "", l: "PAPERS ANALYZED" },
                { n: stats?.total_analyses ?? 0, s: "", l: "ANALYSES RUN" },
                { n: stats?.total_confirmed ?? 0, s: "", l: "GAPS CONFIRMED" },
              ].map((stat) => (
                <div key={stat.l} className="text-center">
                  <div className="font-display text-2xl font-bold text-glow-cyan">
                    <CountUp to={stat.n} suffix={stat.s} />
                  </div>
                  <div className="text-[10px] tracking-widest text-muted-foreground">{stat.l}</div>
                </div>
              ))
            )}
          </div>
        </motion.div>
      </section>

      {/* Pipeline / skill-tree */}
      <section className="relative mx-auto max-w-6xl px-6 py-24">
        <div className="mb-16 text-center">
          <span className="font-mono text-xs tracking-widest text-[var(--violet)]">THE PIPELINE</span>
          <h2 className="mt-3 text-3xl font-bold md:text-4xl">Six stages. One knowledge map.</h2>
        </div>

        <div className="relative grid gap-6 md:grid-cols-3">
          {/* connecting glow line */}
          <div className="pointer-events-none absolute inset-x-0 top-1/2 hidden h-px bg-gradient-to-r from-transparent via-[var(--cyan)]/30 to-transparent md:block" />
          {STEPS.map((s, i) => (
            <motion.div
              key={s.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.5, delay: (i % 3) * 0.1 }}
              className="glass glass-hover hud-corners relative rounded-2xl p-6"
            >
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-[var(--cyan)]/30 bg-[var(--cyan)]/10 pulse-glow">
                  <s.icon className="h-5 w-5 text-[var(--cyan)]" />
                </div>
                <span className="font-mono text-[10px] tracking-widest text-muted-foreground">
                  STAGE {String(i + 1).padStart(2, "0")}
                </span>
              </div>
              <h3 className="text-lg font-semibold">{s.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{s.desc}</p>
            </motion.div>
          ))}
        </div>

        <div className="mt-16 flex justify-center">
          <HudCta to="/input" icon={ArrowRight} label="Start Your Analysis" primary />
        </div>
      </section>

      <footer className="border-t border-border/50 py-8 text-center font-mono text-xs text-muted-foreground">
        RESEARCHGAP AI · AGENTIC RESEARCH INTELLIGENCE
      </footer>
    </div>
  );
}

function HudCta({
  to,
  icon: Icon,
  label,
  primary,
}: {
  to: string;
  icon: typeof Search;
  label: string;
  primary?: boolean;
}) {
  return (
    <Link to={to}>
      <motion.div
        whileHover={{ scale: 1.04 }}
        whileTap={{ scale: 0.98 }}
        className={`group flex items-center gap-3 rounded-xl px-7 py-4 font-mono text-sm font-medium tracking-wide transition-all ${
          primary
            ? "bg-[var(--cyan)]/15 text-[var(--cyan)] shadow-[0_0_30px_-6px_var(--cyan)] ring-1 ring-[var(--cyan)]/50 hover:bg-[var(--cyan)]/25"
            : "glass glass-hover text-foreground"
        }`}
      >
        <Icon className="h-4 w-4" />
        {label}
      </motion.div>
    </Link>
  );
}
