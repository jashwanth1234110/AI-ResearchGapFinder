export const API_BASE = "http://127.0.0.1:8001";

export interface Topic {
  label: string;
  keywords: string[];
  size: number;
  mean_year: number | null;
  x: number;
  y: number;
}

export type GapVerdict = "CONFIRMED" | "WEAK" | "REJECTED" | "UNVERIFIED";

export interface Gap {
  topic_a: string;
  topic_b: string;
  keywords_a: string[];
  keywords_b: string[];
  bridge_papers: number;
  size_a: number;
  size_b: number;
  prominence: number;
  verification_queries: string[];
  recent_papers_found: number;
  verdict: GapVerdict;
  confidence: number;
}

export interface IdeaMeta {
  title: string;
  core_topic: string;
  keywords: string[];
  related_terms: string[];
  summary: string;
  confidence: "high" | "medium" | "low";
}

export interface TopicScore {
  label: string;
  score: number;
}

export interface GapScore {
  topic_a: string;
  topic_b: string;
  verdict: GapVerdict;
  prominence: number;
  score: number;
}

export interface IdeaLanding {
  idea: IdeaMeta;
  closest_topic: TopicScore | null;
  topic_scores: TopicScore[];
  closest_gap: GapScore | null;
  gap_scores: GapScore[];
}

export interface AnalyzeResponse {
  topic: string;
  papers_count: number;
  topics: Topic[];
  gaps: Gap[];
  confirmed_count: number;
  weak_count: number;
  rejected_count: number;
  unverified_count: number;
  report: string;
  /** "llm" when Claude wrote the report, "fallback_*" when synthesis failed
   * and the plain-text report was used instead. Optional: jobs recorded
   * before this field existed simply omit it. */
  report_source?: "llm" | "fallback_no_api_key" | "fallback_llm_unavailable";
  idea_landing?: IdeaLanding | null;
}

export interface Stats {
  total_papers_analyzed: number;
  total_analyses: number;
  total_gaps_found: number;
  total_confirmed: number;
}

export type JobStatus = "pending" | "running" | "done" | "error";

export interface Job {
  job_id: string;
  status: JobStatus;
  topic: string;
  papers: number;
  idea?: IdeaMeta | null;
  stage: number;
  stage_label: string;
  created_at: number;
  updated_at: number;
  result: AnalyzeResponse | null;
  error: string | null;
}

/** The backend is unreachable — network failure, not an application error. */
export class EngineOfflineError extends Error {
  constructor() {
    super("ENGINE OFFLINE");
    this.name = "EngineOfflineError";
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, init);
  } catch {
    throw new EngineOfflineError();
  }
  if (!res.ok) {
    const detail = await res.json().catch(() => null);
    throw new Error(detail?.detail ?? `Request failed with status ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export function getStats(): Promise<Stats> {
  return request<Stats>("/stats");
}

/** Kicks off the pipeline server-side and returns immediately with a job id
 * to poll — the pipeline itself can take minutes, so this must never be the
 * call that's left holding an HTTP connection open. */
export function startAnalysis(topic: string, papers: number): Promise<{ job_id: string }> {
  return request<{ job_id: string }>("/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ topic, papers }),
  });
}

export function getJob(jobId: string): Promise<Job> {
  return request<Job>(`/jobs/${jobId}`);
}

/** Extracts a topic/keywords from one uploaded PDF (Claude reads it
 * directly, server-side) then kicks off the same background pipeline
 * /analyze uses. This call itself blocks for the extraction step (a few
 * seconds), then returns a job_id to poll exactly like /analyze does. */
export function startIdeaCheck(file: File): Promise<{ job_id: string; idea: IdeaMeta }> {
  const form = new FormData();
  form.append("file", file);
  return request<{ job_id: string; idea: IdeaMeta }>("/idea-check", {
    method: "POST",
    body: form,
  });
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

/** Asks a question about one completed job, grounded only in that job's own
 * data. Stateless -- the full conversation so far is sent every call, since
 * nothing is persisted server-side. */
export function chatAboutJob(jobId: string, message: string, history: ChatMessage[]): Promise<{ answer: string }> {
  return request<{ answer: string }>(`/jobs/${jobId}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, history }),
  });
}

export type GapExportFormat = "report_style" | "ieee" | "acm" | "apa";

/** Generates fresh content scoped to one gap. "report_style" mirrors the
 * existing report's per-gap section; ieee/acm/apa produce an academic-paper
 * draft citing real papers from this job's verification evidence -- fails
 * clearly (see the 422 case) rather than inventing citations if this job
 * predates the verification feature. */
export function exportGap(
  jobId: string,
  gapIndex: number,
  format: GapExportFormat,
): Promise<{ content: string; format: GapExportFormat }> {
  return request<{ content: string; format: GapExportFormat }>(`/jobs/${jobId}/gaps/${gapIndex}/export`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ format }),
  });
}

/** Renders already-generated gap-export content (the exact text already on
 * screen, e.g. from exportGap) into a typeset PDF -- no regeneration, so
 * what downloads always matches exactly what was displayed. Returns a Blob
 * rather than JSON, so this can't reuse request<T>() (which always parses
 * the response as JSON). */
export async function exportGapPdf(
  jobId: string,
  gapIndex: number,
  content: string,
  format: GapExportFormat,
  gapNumber: number,
): Promise<Blob> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/jobs/${jobId}/gaps/${gapIndex}/export/pdf`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content, format, gap_number: gapNumber }),
    });
  } catch {
    throw new EngineOfflineError();
  }
  if (!res.ok) {
    const detail = await res.json().catch(() => null);
    throw new Error(detail?.detail ?? `Request failed with status ${res.status}`);
  }
  return res.blob();
}
