import { Spectrum } from "spectrum-ts";
import { imessage, terminal } from "spectrum-ts/providers";
import { config } from "../config.ts";

export type SpectrumApp = Awaited<ReturnType<typeof Spectrum>>;

let _app: SpectrumApp | null = null;

/** Tear down the active Spectrum client so reconnects don't leave duplicate listeners. */
export async function closeSpectrum(): Promise<void> {
  if (!_app) return;
  const stopping = _app;
  _app = null;
  await stopping.stop();
}

export async function initSpectrum(): Promise<SpectrumApp> {
  await closeSpectrum();

  const providers = [
    imessage.config(),
    ...(config.isDev() ? [terminal.config()] : []),
  ];

  _app = await Spectrum({
    projectId: config.projectId(),
    projectSecret: config.projectSecret(),
    providers,
  });

  return _app;
}

export function getApp(): SpectrumApp {
  if (!_app) throw new Error("Spectrum not initialized — call initSpectrum() first");
  return _app;
}
