export type MetricSnapshot<T> = { value: T | null; at: number; stale: boolean };

export function createPaperMetricCache<T>(options: {
  namespace: string;
  ttl: number;
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
      // A miss written by another tab must not hide a known successful value.
      if (validEntry(stored) && (!entry ||
          (entry.value === null && stored.value !== null) ||
          (stored.at > entry.at && (entry.value === null || stored.value !== null)))) entry = stored;
    } catch { /* Memory cache still works if browser storage is disabled. */ }
    if (!entry) return undefined;
    const age = Date.now() - entry.at;
    // TTL controls revalidation, not retention: successful counts never expire.
    if (age < 0 || (entry.value === null && age >= options.missingTtl)) {
      memory.delete(key);
      return undefined;
    }
    memory.set(key, entry);
    return { ...entry, stale: age >= (entry.value === null ? options.missingTtl : options.ttl) };
  }

  function get(key: string, load: () => Promise<T | null>, force = false): Promise<T | null> {
    const cached = peek(key);
    if (!force && cached && !cached.stale) return Promise.resolve(cached.value);
    let request = pending.get(key);
    if (!request) {
      request = Promise.resolve().then(load).then((value) => {
        if (value !== null && !options.valid(value)) throw new Error("Invalid paper metric");
        // Missing data is not a new measurement. Preserve both the successful
        // count (including zero) and its actual retrieval time.
        const previous = peek(key);
        if (value !== null || previous?.value === null || !previous) {
          const entry = { value, at: Date.now() };
          memory.set(key, entry);
          try { localStorage.setItem(prefix + key, JSON.stringify(entry)); } catch { /* Optional persistence. */ }
        }
        return value;
      }).finally(() => pending.delete(key));
      pending.set(key, request);
    }
    // Failed refreshes leave the last successful entry available to the view.
    return request;
  }

  return { peek, get };
}
