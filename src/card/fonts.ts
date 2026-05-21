// src/card/fonts.ts
import { join } from "node:path";

const FONTS_DIR = join(import.meta.dir, "fonts");

export interface FontData {
  name: string;
  data: ArrayBuffer;
  weight: 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900;
  style: "normal" | "italic";
}

async function loadFont(filename: string): Promise<ArrayBuffer> {
  return Bun.file(join(FONTS_DIR, filename)).arrayBuffer();
}

let _fonts: FontData[] | null = null;

export async function loadFonts(): Promise<FontData[]> {
  if (_fonts) return _fonts;
  const [inter, noto, mono] = await Promise.all([
    loadFont("inter-400.woff2"),
    loadFont("noto-sans-sc-400.woff2"),
    loadFont("jetbrains-mono-400.woff2"),
  ]);
  _fonts = [
    { name: "Inter", data: inter, weight: 400, style: "normal" },
    { name: "Noto Sans SC", data: noto, weight: 400, style: "normal" },
    { name: "JetBrains Mono", data: mono, weight: 400, style: "normal" },
  ];
  return _fonts;
}
