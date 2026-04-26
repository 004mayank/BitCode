type RunStatus = "running" | "done" | "error";

export type RunRecord = {
  id: string;
  status: RunStatus;
  createdAt: number;
  logs: string[];
  result: any | null;
  error: string | null;
};

const runs = new Map<string, RunRecord>();

export const RunStore = {
  create(id: string): RunRecord {
    const r: RunRecord = { id, status: "running", createdAt: Date.now(), logs: [], result: null, error: null };
    runs.set(id, r);
    return r;
  },
  get(id: string) {
    return runs.get(id) || null;
  },
  appendLog(id: string, line: string) {
    const r = runs.get(id);
    if (!r) return;
    r.logs.push(line);
    // cap
    if (r.logs.length > 2000) r.logs = r.logs.slice(-2000);
  },
  setResult(id: string, result: any) {
    const r = runs.get(id);
    if (!r) return;
    r.status = "done";
    r.result = result;
  },
  setError(id: string, err: string) {
    const r = runs.get(id);
    if (!r) return;
    r.status = "error";
    r.error = err;
  }
};

