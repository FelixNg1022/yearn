/** True when Spectrum Cloud rejected the connect/token request (HTTP 429). */
export function isSpectrumRateLimited(err: unknown): boolean {
  const msg = String(err).toLowerCase();
  if (msg.includes("too many requests")) return true;
  const status = (err as { status?: number })?.status;
  return status === 429;
}

/** Backoff for reconnect loop after a failed session (non-429). */
export function reconnectDelayMs(attempt: number, err: unknown): number {
  if (isSpectrumRateLimited(err)) {
    // Spectrum token issuance is rate-limited — wait longer than the default 5s.
    const base = 30_000;
    const cap = 300_000;
    const exp = Math.min(base * 2 ** Math.max(0, attempt - 1), cap);
    return exp + Math.floor(Math.random() * 5_000);
  }
  const base = 5_000;
  const cap = 60_000;
  return Math.min(base * 2 ** Math.max(0, attempt - 1), cap) + Math.floor(Math.random() * 1_000);
}

/** Delay before the first connect so a rolling deploy can release the old session. */
export function startupConnectDelayMs(): number {
  // Default 20s — Railway keeps the old container alive ~15s after the new one is healthy,
  // so we need to wait long enough for the old Spectrum session to be released before connecting.
  const base = Number(process.env.SPECTRUM_STARTUP_DELAY_MS ?? 20_000);
  if (!Number.isFinite(base) || base <= 0) return 0;
  return base + Math.floor(Math.random() * 4_000);
}

/** In-loop retries while issuing Spectrum tokens (429 only). */
export function rateLimitRetryDelayMs(attempt: number): number {
  // First attempt uses a short delay — on startup a 429 just means the old instance
  // hasn't released its session yet; check back in 5s rather than 15s.
  const base = attempt === 1 ? 5_000 : 15_000;
  const cap = 120_000;
  return Math.min(base * attempt, cap) + Math.floor(Math.random() * 3_000);
}
