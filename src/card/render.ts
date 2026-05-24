// src/card/render.ts
import { chromium, type Browser, type Page } from "playwright";
import http from "node:http";
import path from "node:path";
import fs from "node:fs";
import { execSync } from "node:child_process";
import QRCode from "qrcode";
import { normalizeStone, type LuckyStone } from "./stones.ts";

const HTML_DIR = path.resolve(import.meta.dir, "html");
const LANDING_URL = "https://yearn-three.vercel.app/";
const CARD_W = 380;
const CARD_H = 600;
const SCALE = 3; // 1140×1800 output

// ---------------------------------------------------------------------------
// Singleton HTTP server (serves the card HTML/CSS/JS/assets)
// ---------------------------------------------------------------------------

let _server: http.Server | null = null;
let _port = 0;

function getServer(): Promise<number> {
  if (_server) return Promise.resolve(_port);

  const MIME: Record<string, string> = {
    ".html": "text/html",
    ".css": "text/css",
    ".js": "text/javascript",
    ".json": "application/json",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".woff": "font/woff",
    ".woff2": "font/woff2",
  };

  return new Promise((resolve, reject) => {
    _server = http.createServer((req, res) => {
      const url = new URL(req.url ?? "/", "http://localhost");
      let filePath = path.join(HTML_DIR, decodeURIComponent(url.pathname));
      if (filePath.endsWith("/")) filePath += "index.html";
      const ext = path.extname(filePath);
      fs.readFile(filePath, (err, data) => {
        if (err) { res.writeHead(404); res.end("Not found"); return; }
        res.writeHead(200, { "Content-Type": MIME[ext] ?? "application/octet-stream" });
        res.end(data);
      });
    });
    _server.listen(0, "127.0.0.1", () => {
      const addr = _server!.address() as { port: number };
      _port = addr.port;
      resolve(_port);
    });
    _server.on("error", reject);
  });
}

// ---------------------------------------------------------------------------
// Singleton Playwright browser + reusable page
// ---------------------------------------------------------------------------

let _browser: Browser | null = null;
let _page: Page | null = null;

function findChromium(): string | undefined {
  const base = process.env.PLAYWRIGHT_BROWSERS_PATH;
  if (!base) return undefined;
  try {
    const found = execSync(`find "${base}" -name "chrome" -type f 2>/dev/null | head -1`).toString().trim();
    return found || undefined;
  } catch {
    return undefined;
  }
}

async function getPage(): Promise<Page> {
  if (!_browser) {
    const executablePath = findChromium();
    console.log(JSON.stringify({ ts: new Date().toISOString(), level: "INFO", msg: "chromium", executablePath: executablePath ?? "auto" }));
    _browser = await chromium.launch({ executablePath });
  }
  if (!_page || _page.isClosed()) {
    const ctx = await _browser.newContext({
      viewport: { width: CARD_W + 40, height: CARD_H + 40 },
      deviceScaleFactor: SCALE,
    });
    _page = await ctx.newPage();
  }
  return _page;
}

export async function closeRenderer(): Promise<void> {
  await _browser?.close();
  _browser = null;
  _page = null;
  _server?.close();
  _server = null;
}

// ---------------------------------------------------------------------------
// Core screenshot helper
// ---------------------------------------------------------------------------

async function qrDataUrl(text: string, width: number): Promise<string> {
  const url = (text || LANDING_URL).replace(/\/$/, "");
  return QRCode.toDataURL(url, {
    errorCorrectionLevel: "M",
    margin: 2,
    width,
  });
}

/** Replace broken client-side canvas QR with a scannable PNG before screenshot. */
async function injectShareQr(page: Page, shareUrl: string, cardType: string): Promise<void> {
  const width = cardType === "social" ? 216 : 192;
  const dataUrl = await qrDataUrl(shareUrl, width);
  await page.evaluate(({ dataUrl }) => {
    const fillSlot = (slot: Element | null) => {
      if (!slot) return;
      const img = document.createElement("img");
      img.src = dataUrl;
      img.className = slot.className || "card__footer-qr";
      img.alt = "QR code";
      slot.replaceWith(img);
    };

    fillSlot(document.querySelector(".card__footer .card__footer-qr"));
    fillSlot(document.querySelector(".card__footer canvas"));
    fillSlot(document.querySelector("#qr-slot"));
    fillSlot(document.querySelector(".social-qr canvas")?.parentElement ?? null);
  }, { dataUrl });
}

async function screenshotCard(params: URLSearchParams): Promise<Buffer> {
  const port = await getServer();
  const page = await getPage();

  const url = `http://127.0.0.1:${port}/index.html?${params.toString()}`;
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => (window as unknown as { __CARD_READY__: boolean }).__CARD_READY__ === true, { timeout: 15_000 });

  const shareUrl = params.get("shareUrl");
  const cardType = params.get("card") ?? "profile";
  if (shareUrl) await injectShareQr(page, shareUrl, cardType);

  const card = await page.$(".card");
  if (!card) throw new Error("Card element not found in rendered page");

  const buf = await card.screenshot({ type: "png" });
  return Buffer.from(buf);
}

// ---------------------------------------------------------------------------
// Public render functions
// ---------------------------------------------------------------------------

export interface ProfileRenderInput {
  name: string;
  luckyNumber: number;
  luckyColor: string; // palette name: orange | marigold | rose | magenta | violet | azure | teal | lime
  luckyStone: LuckyStone | string;
  millionaireChance: number;
  meetLoveAge: number;
  projection: string; // broad fortune reading text
  shareUrl?: string;
}

export async function renderProfileCard(input: ProfileRenderInput): Promise<Buffer> {
  const stone = normalizeStone(input.luckyStone);
  const p = new URLSearchParams({
    card: "profile",
    name: input.name,
    luckyNumber: String(input.luckyNumber),
    luckyColor: input.luckyColor,
    luckyStone: stone,
    millionaireChance: String(input.millionaireChance),
    meetLoveAge: String(input.meetLoveAge),
    projection: input.projection,
  });
  if (input.shareUrl) p.set("shareUrl", input.shareUrl);
  return screenshotCard(p);
}

export interface DailyRenderInput {
  name: string;
  date: Date;
  avoid: string;
  general: number;
  relationship: number;
  academic: number;
  career: number;
  shareUrl?: string;
}

export async function renderDailyReadingCard(input: DailyRenderInput): Promise<Buffer> {
  const dateStr = input.date.toLocaleDateString("en-US", {
    year: "numeric", month: "long", day: "numeric",
  }).toLowerCase();

  const p = new URLSearchParams({
    card: "daily",
    name: input.name,
    date: dateStr,
    avoid: input.avoid,
    general: String(input.general),
    relationship: String(input.relationship),
    academic: String(input.academic),
    career: String(input.career),
  });
  if (input.shareUrl) p.set("shareUrl", input.shareUrl);
  return screenshotCard(p);
}

export interface SocialRenderInput {
  name: string;
  shareUrl: string;
}

export async function renderSocialCard(input: SocialRenderInput): Promise<Buffer> {
  const p = new URLSearchParams({
    card: "social",
    name: input.name,
    shareUrl: input.shareUrl,
  });
  return screenshotCard(p);
}
