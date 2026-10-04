export type MetricSnapshot<T> = { value: T | null; at: number; stale: boolean };

export function createPaperMetricCache<T>(options: {
  namespace: string;
  ttl: number;
  maxAge: number;
  missingTtl: number;
  valid: (value: unknown) => value is T;
}) {
  type Entry = { value: T | null; at: number };
  const memory = new Map<string, Entry>();
  const pending = new Map<string, Promise<T | null>>();
  const prefix = `arxivhub:${options.namespace}:`;

  function validEntry(value: unknown): value is Entry {
    return Boolean(value && typeof value === "object" && "value" in value && "at" in value &&
      typeof value.at === "number" && Number.isFinite(value.at) && value.at <= Date.now() &&
      (value.value === null || options.valid(value.value)));
  }

  function peek(key: string): MetricSnapshot<T> | undefined {
    let entry = memory.get(key);
    try {
      const stored: unknown = JSON.parse(localStorage.getItem(prefix + key) ?? "null");
      if (validEntry(stored) && (!entry || stored.at > entry.at)) entry = stored;
    } catch { /* Memory cache still works if browser storage is disabled. */ }
    if (!entry) return undefined;
    const age = Date.now() - entry.at;
    if (age < 0 || age >= (entry.value === null ? options.missingTtl : options.maxAge)) {
      memory.delete(key);
      return undefined;
    }
    memory.set(key, entry);
    return { ...entry, stale: age >= (entry.value === null ? options.missingTtl : options.ttl) };
  }

  function get(key: string, load: () => Promise<T | null>): Promise<T | null> {
    const cached = peek(key);
    if (cached && !cached.stale) return Promise.resolve(cached.value);
    let request = pending.get(key);
    if (!request) {
      request = load().then((value) => {
        if (value !== null && !options.valid(value)) throw new Error("Invalid paper metric");
        const entry = { value, at: Date.now() };
        memory.set(key, entry);
        try { localStorage.setItem(prefix + key, JSON.stringify(entry)); } catch { /* Optional persistence. */ }
        return value;
      }).finally(() => pending.delete(key));
      pending.set(key, request);
    }
    // Failed refreshes leave the last successful entry available to the view.
    return request;
  }

  return { peek, get };
}
