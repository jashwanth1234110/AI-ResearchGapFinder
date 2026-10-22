import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, Check, Loader2, RotateCcw, WifiOff } from "lucide-react";
import { ParticleField } from "@/components/ParticleField";
import { useAnalysisStore, type PendingRequest } from "@/store/analysis";
import { startAnalysis, getJob, EngineOfflineError, type Job } from "@/lib/api";

export const Route = createFileRoute("/processing")({
  component: Processing,
});

// Dispatching a job (POST /analyze) is expensive and non-idempotent — it
// spawns a real background pipeline run. Module-level (not component/ref)
// so the guard survives any number of remounts of this route, StrictMode's
// dev double-invoke included.
let inFlightKey: string | null = null;
type KeywordRequest = Extract<PendingRequest, { mode: "keyword" }>;
function keyFor(req: KeywordRequest | null, attempt: number) {
  return req ? `${req.topic}::${req.papers}::${attempt}` : null;
}

const STAGES = [
  "Input accepted",
  "Fetching papers — Semantic Scholar + OpenAlex",
  "Embedding (Sentence-BERT) & clustering (BERTopic)",
  "Detecting gaps — cross-topic sparsity",
  "Agentic validation against OpenAlex",
  "Synthesizing report",
];

const POLL_INTERVAL_MS = 3000;

// A crashed engine is caught immediately (fetch fails -> EngineOfflineError)
// and a job orphaned by a restart is caught server-side by reap_orphaned_jobs.
// This is the last-resort backstop for the remaining case: engine alive and
// answering, but the worker thread wedged, so updated_at simply stops moving.
// Deliberately well past the advertised 1-6 min run time -- the engine only
// touches updated_at on stage transitions, and stage 5 can legitimately sit
// quiet for minutes behind a rate-limited API, so a tighter bound would risk
// showing a false failure mid-demo.
const STALL_TIMEOUT_MS = 480_000;
const STALL_MESSAGE =
  "The engine stopped making progress for 8 minutes and is likely wedged. Restart it and run this again.";

function formatElapsed(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function Processing() {
  const navigate = useNavigate();
  const setResult = useAnalysisStore((s) => s.setResult);
  const setActiveJobId = useAnalysisStore((s) => s.setActiveJobId);
  // Captured once at mount: store writes later (setResult clearing
  // pendingRequest, etc.) must not make this page re-derive its inputs.
  const [{ request, resumeJobId }] = useState(() => {
    const s = useAnalysisStore.getState();
    return { request: s.pendingRequest, resumeJobId: s.activeJobId };
  });
  const [stage, setStage] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const startedAtMsRef = useRef<number>(Date.now());
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stallRef = useRef<{ updatedAt: number; sinceMs: number } | null>(null);

  // Stalled == the job's own updated_at has not moved for STALL_TIMEOUT_MS.
  // Wall-clock elapsed is the wrong signal: a long run is not a broken one.
  const isStalled = (job: Job) => {
    const now = Date.now();
    const seen = stallRef.current;
    if (!seen || seen.updatedAt !== job.updated_at) {
      stallRef.current = { updatedAt: job.updated_at, sinceMs: now };
      return false;
    }
    return now - seen.sinceMs > STALL_TIMEOUT_MS;
  };

  useEffect(() => {
    if (!request) {
      navigate({ to: "/input" });
    }
  }, [request, navigate]);

  useEffect(() => {
    startedAtMsRef.current = Date.now();
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - startedAtMsRef.current) / 1000)), 1000);
    return () => clearInterval(id);
  }, [attempt]);

  useEffect(() => {
    if (!request) return;
    stallRef.current = null;

    if (request.mode === "upload") {
      // The job was already created by /idea-check on /input, before we
      // ever navigated here — nothing to dispatch, just poll it. A plain
      // GET is naturally safe to repeat (StrictMode double-invoke, retry,
      // refresh), so this needs none of the inFlightKey dispatch-guarding
      // the keyword-mode path below requires.
      let cancelled = false;
      const pollUpload = async (jobId: string) => {
        if (cancelled) return;
        try {
          const job = await getJob(jobId);
          if (cancelled) return;
          setStage(job.stage);
          startedAtMsRef.current = job.created_at * 1000;
          if (job.status === "done" && job.result) {
            setResult(job.result, jobId);
            navigate({ to: "/dashboard" });
            return;
          }
          if (job.status === "error") {
            setError(job.error ?? "Analysis failed.");
            return;
          }
          if (isStalled(job)) {
            setError(STALL_MESSAGE);
            return;
          }
          pollTimer.current = setTimeout(() => pollUpload(jobId), POLL_INTERVAL_MS);
        } catch (e) {
          if (cancelled) return;
          if (e instanceof EngineOfflineError) setOffline(true);
          else setError(e instanceof Error ? e.message : "Analysis failed.");
        }
      };
      pollUpload(request.jobId);
      return () => {
        cancelled = true;
        if (pollTimer.current) clearTimeout(pollTimer.current);
      };
    }

    const key = keyFor(request, attempt);
    const isResume = attempt === 0 && !!resumeJobId;

    // Only the dispatch path (a real, non-idempotent POST /analyze) needs
    // the synchronous cross-remount guard. Resuming just re-polls an
    // existing job — idempotent, so a StrictMode double-invoke costs an
    // extra GET at worst, never a duplicate pipeline run.
    if (!isResume) {
      if (inFlightKey === key) return;
      inFlightKey = key;
    }

    setStage(0);
    setError(null);
    setOffline(false);

    // Ownership is tracked module-level, not per-closure. A local
    // `cancelled` flag set by a StrictMode-simulated cleanup would abandon
    // the *winning* invocation's own continuation the instant its promise
    // resolved — the dispatch would fire for real, the backend job would
    // run to completion, and the browser would just never notice. Checking
    // inFlightKey instead survives replay because ownership isn't tied to
    // which invocation happens to be asking.
    const stillOwns = () => isResume || inFlightKey === key;
    const release = () => {
      if (inFlightKey === key) inFlightKey = null;
    };

    const poll = async (jobId: string) => {
      if (!stillOwns()) return;
      try {
        const job = await getJob(jobId);
        if (!stillOwns()) return;
        setStage(job.stage);
        startedAtMsRef.current = job.created_at * 1000;
        if (job.status === "done" && job.result) {
          release();
          setResult(job.result, jobId);
          navigate({ to: "/dashboard" });
          return;
        }
        if (job.status === "error") {
          release();
          setError(job.error ?? "Analysis failed.");
          return;
        }
        if (isStalled(job)) {
          release();
          setError(STALL_MESSAGE);
          return;
        }
        pollTimer.current = setTimeout(() => poll(jobId), POLL_INTERVAL_MS);
      } catch (e) {
        if (!stillOwns()) return;
        release();
        if (e instanceof EngineOfflineError) setOffline(true);
        else setError(e instanceof Error ? e.message : "Analysis failed.");
      }
    };

    if (isResume) {
      poll(resumeJobId!);
    } else {
      startAnalysis(request.topic, request.papers)
        .then((res) => {
          if (!stillOwns()) return;
          setActiveJobId(res.job_id);
          poll(res.job_id);
        })
        .catch((e) => {
          if (!stillOwns()) return;
          release();
          if (e instanceof EngineOfflineError) setOffline(true);
          else setError(e instanceof Error ? e.message : "Analysis failed.");
        });
    }

    return () => {
      if (pollTimer.current) clearTimeout(pollTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request, attempt]);

  const retry = () => setAttempt((a) => a + 1);

  const failed = offline || !!error;

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-6 text-foreground">
      <div className="pointer-events-none absolute inset-0 grid-bg opacity-40" />
      <ParticleField density={0.00006} />
      <div className="pointer-events-none absolute left-0 top-0 h-px w-full bg-gradient-to-r from-transparent via-[var(--cyan)]/60 to-transparent scanline" />
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-1/2 h-[560px] w-[560px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--violet)] opacity-[0.1] blur-[150px]" />
      </div>

      <div className="relative z-10 w-full max-w-2xl">
        {!failed ? (
          <>
            <div className="mb-8 text-center">
              <span className="font-mono text-xs tracking-[0.3em] text-[var(--cyan)]">RESEARCHGAP ENGINE · LIVE</span>
              <h1 className="mt-3 text-3xl font-bold">Analyzing the field</h1>
              <div className="mt-4 flex items-center justify-center gap-3">
                <Loader2 className="h-4 w-4 animate-spin text-[var(--violet)]" />
                <span className="font-mono text-sm font-bold text-glow-cyan">{formatElapsed(elapsed)} elapsed</span>
              </div>
            </div>

            <div className="glass hud-corners rounded-2xl p-4 md:p-6">
              {STAGES.map((label, i) => {
                const n = i + 1;
                const done = n < stage;
                const active = n === stage;
                return (
                  <motion.div
                    key={label}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: done || active ? 1 : 0.4, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className={`flex items-center gap-4 rounded-xl px-3 py-3 transition-colors ${
                      active ? "bg-[var(--violet)]/10" : ""
                    }`}
                  >
                    <div
                      className={`flex h-9 w-9 flex-none items-center justify-center rounded-full border ${
                        done
                          ? "border-[var(--cyan)]/50 bg-[var(--cyan)]/15"
                          : active
                            ? "pulse-glow border-[var(--violet)]/40 bg-[var(--violet)]/10"
                            : "border-border bg-transparent"
                      }`}
                    >
                      {done ? (
                        <Check className="h-4 w-4 text-[var(--cyan)]" strokeWidth={3} />
                      ) : (
                        <span className={`font-mono text-[10px] ${active ? "text-[var(--violet)]" : "text-muted-foreground"}`}>
                          {n}
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-medium">{label}</p>
                    {active && <Loader2 className="h-3.5 w-3.5 flex-none animate-spin text-[var(--violet)]" />}
                  </motion.div>
                );
              })}
            </div>

            <p className="mt-6 text-center font-mono text-[11px] tracking-widest text-muted-foreground">
              REAL PIPELINE RUNNING · TYPICALLY 1-6 MIN · SAFE TO CLOSE THIS TAB
            </p>
          </>
        ) : (
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            className="glass hud-corners flex flex-col items-center rounded-2xl px-8 py-12 text-center"
          >
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--danger)]/15 ring-2 ring-[var(--danger)]/50">
              {offline ? (
                <WifiOff className="h-8 w-8 text-[var(--danger)]" />
              ) : (
                <AlertTriangle className="h-8 w-8 text-[var(--danger)]" />
              )}
            </div>
            <p className="mt-5 font-mono text-sm tracking-widest text-[var(--danger)]">
              {offline ? "ENGINE OFFLINE" : "ANALYSIS FAILED"}
            </p>
            <p className="mt-2 max-w-sm text-sm text-muted-foreground">
              {offline
                ? "Could not reach the ResearchGap engine at 127.0.0.1:8001. Make sure the API server is running."
                : error}
            </p>
            <motion.button
              onClick={retry}
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.97 }}
              className="mt-6 flex items-center gap-2 rounded-xl bg-[var(--cyan)]/15 px-6 py-3 font-mono text-xs tracking-wider text-[var(--cyan)] ring-1 ring-[var(--cyan)]/40"
            >
              <RotateCcw className="h-3.5 w-3.5" /> RETRY
            </motion.button>
          </motion.div>
        )}
      </div>
    </div>
  );
}
