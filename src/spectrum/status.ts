export type SpectrumConnectionStatus = "connecting" | "connected" | "disconnected";

let status: SpectrumConnectionStatus = "disconnected";
let lastError: string | null = null;
let connectedAt: number | null = null;

export function setSpectrumStatus(next: SpectrumConnectionStatus, err?: unknown): void {
  status = next;
  if (next === "connected") {
    lastError = null;
    connectedAt = Date.now();
  } else if (next === "disconnected" && err != null) {
    lastError = String(err);
    connectedAt = null;
  }
}

export function getSpectrumStatus(): {
  status: SpectrumConnectionStatus;
  lastError: string | null;
  connectedAt: number | null;
} {
  return { status, lastError, connectedAt };
}
