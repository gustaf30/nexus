/** Safely parse a JSON string, returning `fallback` on null input or parse failure. */
export function safeParseJson<T>(raw: string | null, fallback: T): T {
  if (raw == null) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}
