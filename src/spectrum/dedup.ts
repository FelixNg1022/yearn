/** Drop duplicate inbound messages (e.g. from overlapping Spectrum connections). */
export class InboundDedup {
  private seen = new Map<string, number>();

  constructor(private ttlMs: number) {}

  /** Returns true if this key was already processed within the TTL window. */
  isDuplicate(key: string, now: number): boolean {
    this.prune(now);
    if (this.seen.has(key)) return true;
    this.seen.set(key, now);
    return false;
  }

  private prune(now: number): void {
    for (const [key, seenAt] of this.seen) {
      if (now - seenAt > this.ttlMs) this.seen.delete(key);
    }
  }
}

export function inboundMessageKey(
  message: { id?: string; timestamp?: number | string | Date },
  phone: string,
  text: string,
): string {
  if (message.id) return message.id;
  const ts = message.timestamp instanceof Date
    ? message.timestamp.getTime()
    : Number(message.timestamp ?? 0);
  return `${phone}:${ts}:${text}`;
}
