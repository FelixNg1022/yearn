import { Spectrum, SpectrumCloudError } from "spectrum-ts";
import { imessage, terminal } from "spectrum-ts/providers";
import { config } from "../config.ts";
import { isSpectrumRateLimited, rateLimitRetryDelayMs } from "./reconnect.ts";
import { setSpectrumStatus } from "./status.ts";

export type SpectrumApp = Awaited<ReturnType<typeof Spectrum>>;

let _app: SpectrumApp | null = null;
let _connecting: Promise<SpectrumApp> | null = null;

/** Tear down the active Spectrum client so reconnects don't leave duplicate listeners. */
export async function closeSpectrum(): Promise<void> {
  if (!_app) return;
  const stopping = _app;
  _app = null;
  setSpectrumStatus("disconnected");
  await stopping.stop();
}

async function connectSpectrum(): Promise<SpectrumApp> {
  const providers = [
    imessage.config(),
    ...(config.isDev() ? [terminal.config()] : []),
  ];

  return Spectrum({
    projectId: config.projectId(),
    projectSecret: config.projectSecret(),
    providers,
  });
}

/**
 * Connect to Spectrum, retrying token issuance when Cloud returns 429.
 * Only one connect runs at a time — concurrent callers share the same promise.
 */
export async function initSpectrum(): Promise<SpectrumApp> {
  if (_app) return _app;
  if (_connecting) return _connecting;

  _connecting = (async () => {
    setSpectrumStatus("connecting");
    await closeSpectrum();

    const maxAttempts = 5;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        _app = await connectSpectrum();
        setSpectrumStatus("connected");
        return _app;
      } catch (err) {
        if (isSpectrumRateLimited(err) && attempt < maxAttempts) {
          const waitMs = rateLimitRetryDelayMs(attempt);
          console.error(JSON.stringify({
            ts: new Date().toISOString(),
            level: "WARN",
            msg: "spectrum rate limited on connect — retrying",
            attempt,
            wait_ms: waitMs,
            err: err instanceof SpectrumCloudError ? err.message : String(err),
          }));
          await Bun.sleep(waitMs);
          continue;
        }
        setSpectrumStatus("disconnected", err);
        throw err;
      }
    }
    throw new Error("initSpectrum: exhausted rate-limit retries");
  })();

  try {
    return await _connecting;
  } finally {
    _connecting = null;
  }
}

export function getApp(): SpectrumApp {
  if (!_app) throw new Error("Spectrum not initialized — call initSpectrum() first");
  return _app;
}
