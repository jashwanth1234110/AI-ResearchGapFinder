import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { AnalyzeResponse, IdeaMeta } from "@/lib/api";

export type PendingRequest =
  | { mode: "keyword"; topic: string; papers: number }
  | { mode: "upload"; jobId: string; idea: IdeaMeta };

interface AnalysisState {
  pendingRequest: PendingRequest | null;
  /** The in-flight background job for pendingRequest, if one has been
   * created — lets /processing resume polling after a refresh instead of
   * firing a second, duplicate POST /analyze for the same request. */
  activeJobId: string | null;
  result: AnalyzeResponse | null;
  /** The job_id that produced `result` — kept alongside it (not cleared)
   * so /dashboard and /report can call job-scoped endpoints like chat. */
  jobId: string | null;
  setPendingRequest: (req: PendingRequest) => void;
  setActiveJobId: (jobId: string | null) => void;
  setResult: (result: AnalyzeResponse, jobId: string) => void;
  reset: () => void;
}

/** Last analysis, kept alive across the /processing -> /dashboard -> /report
 * navigation and restored from sessionStorage on refresh. */
export const useAnalysisStore = create<AnalysisState>()(
  persist(
    (set) => ({
      pendingRequest: null,
      activeJobId: null,
      result: null,
      jobId: null,
      setPendingRequest: (pendingRequest) => set({ pendingRequest, activeJobId: null }),
      setActiveJobId: (activeJobId) => set({ activeJobId }),
      setResult: (result, jobId) => set({ result, jobId, pendingRequest: null, activeJobId: null }),
      reset: () => set({ pendingRequest: null, activeJobId: null, result: null, jobId: null }),
    }),
    {
      name: "researchgap-analysis",
      storage: createJSONStorage(() => sessionStorage),
    },
  ),
);
