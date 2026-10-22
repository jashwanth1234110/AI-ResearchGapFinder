import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { Send, Loader2, AlertTriangle, MessageCircle } from "lucide-react";
import { chatAboutJob, EngineOfflineError, type ChatMessage } from "@/lib/api";

export function ChatPanel({ jobId }: { jobId: string }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, sending]);

  const send = async () => {
    const text = draft.trim();
    if (!text || sending) return;

    const history = messages;
    const next: ChatMessage[] = [...history, { role: "user", content: text }];
    setMessages(next);
    setDraft("");
    setError(null);
    setSending(true);

    try {
      const { answer } = await chatAboutJob(jobId, text, history);
      setMessages([...next, { role: "assistant", content: answer }]);
    } catch (e) {
      setError(
        e instanceof EngineOfflineError
          ? "Could not reach the ResearchGap engine."
          : e instanceof Error
            ? e.message
            : "Could not get a response.",
      );
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto pr-1">
        {messages.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-10 text-center text-muted-foreground">
            <MessageCircle className="h-6 w-6" />
            <p className="text-sm">Ask about this analysis — a gap, a cluster, or how they compare.</p>
          </div>
        )}
        {messages.map((m, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className={`rounded-xl px-3 py-2 text-sm ${
              m.role === "user"
                ? "ml-6 bg-[var(--cyan)]/15 text-foreground"
                : "mr-6 glass text-foreground/90"
            }`}
          >
            {m.content}
          </motion.div>
        ))}
        {sending && (
          <div className="mr-6 flex items-center gap-2 rounded-xl glass px-3 py-2 text-sm text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Thinking…
          </div>
        )}
        {error && (
          <p className="flex items-start gap-2 rounded-lg bg-[var(--danger)]/10 p-3 text-xs text-[var(--danger)] ring-1 ring-[var(--danger)]/30">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-none" />
            {error}
          </p>
        )}
      </div>

      <div className="mt-3 flex items-center gap-2 rounded-xl border border-input bg-background/40 p-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), send())}
          placeholder="Ask about this analysis…"
          disabled={sending}
          className="min-w-0 flex-1 bg-transparent px-2 py-1 text-sm outline-none placeholder:text-muted-foreground"
        />
        <button
          onClick={send}
          disabled={sending || !draft.trim()}
          className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-[var(--cyan)]/15 text-[var(--cyan)] disabled:opacity-40"
        >
          <Send className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
