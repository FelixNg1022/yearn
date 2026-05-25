// src/index.ts
import { openDb } from "./db.ts";
import { createLlm } from "./llm.ts";
import { closeSpectrum, initSpectrum } from "./spectrum/app.ts";
import { InboundDedup, inboundMessageKey } from "./spectrum/dedup.ts";
import { reconnectDelayMs, startupConnectDelayMs } from "./spectrum/reconnect.ts";
import { getSpectrumStatus, setSpectrumStatus } from "./spectrum/status.ts";
import { route } from "./router.ts";
import { createScheduler } from "./scheduler.ts";
import { closeRenderer } from "./card/render.ts";
import { config } from "./config.ts";
import path from "node:path";
import fs from "node:fs";

const PUBLIC_DIR = path.resolve(import.meta.dir, "../public");
const hasPublic = fs.existsSync(PUBLIC_DIR);
const port = Number(process.env.PORT ?? 3000);

// Health server starts synchronously — always responds before any async init runs.
// This ensures Railway's healthcheck passes even while the app is still connecting.
Bun.serve({
  port,
  async fetch(req) {
    const url = new URL(req.url);
    const cors = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }

    if (url.pathname === "/health") {
      const spectrum = getSpectrumStatus();
      // ok stays true so Railway healthchecks pass while Spectrum is still connecting.
      return Response.json({
        ok: true,
        spectrum: spectrum.status,
        spectrum_connected_at: spectrum.connectedAt,
        spectrum_last_error: spectrum.lastError,
      }, { headers: cors });
    }

    if (url.pathname === "/api/start" && req.method === "POST") {
      try {
        const body = await req.json() as { phone?: string };
        const raw = (body.phone ?? "").trim();
        const digits = raw.replace(/\D/g, "");
        if (!digits || digits.length < 7) {
          return Response.json({ error: "enter a valid phone number" }, { status: 400, headers: cors });
        }
        const phone = raw.startsWith("+") ? `+${digits}` : digits.length === 10 ? `+1${digits}` : `+${digits}`;

        const projectId = config.projectId();
        const auth = Buffer.from(`${projectId}:${config.projectSecret()}`).toString("base64");

        // Retry up to 3 times with backoff on 429 from Spectrum user creation.
        let createRes: Response | null = null;
        for (let attempt = 1; attempt <= 3; attempt++) {
          createRes = await fetch(`https://spectrum.photon.codes/projects/${projectId}/users/`, {
            method: "POST",
            headers: {
              "Authorization": `Basic ${auth}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ type: "shared", phoneNumber: phone }),
          });
          if (createRes.status !== 429) break;
          console.log(JSON.stringify({
            ts: new Date().toISOString(), level: "WARN", msg: "api/start spectrum 429 — retrying",
            attempt, phone: phone.slice(-4),
          }));
          if (attempt < 3) await Bun.sleep(2_000 * attempt);
        }
        if (!createRes!.ok) {
          const errText = await createRes!.text();
          console.error(JSON.stringify({
            ts: new Date().toISOString(), level: "ERROR", msg: "api/start spectrum user",
            status: createRes!.status, err: errText.slice(0, 300),
          }));
          return Response.json({ error: "couldn't reach the fortune line, try again" }, { status: 502, headers: cors });
        }
        const created = await createRes!.json() as { data?: { assignedPhoneNumber?: string } };
        const assigned = created.data?.assignedPhoneNumber;
        console.log(JSON.stringify({
          ts: new Date().toISOString(), level: "INFO", msg: "api/start ok",
          phone: phone.slice(-4), assigned: assigned ?? null,
        }));
        if (!assigned) {
          return Response.json({ error: "no fortune line assigned yet, try again later" }, { status: 502, headers: cors });
        }

        const greeting = encodeURIComponent("hi yearn");
        const smsUrl = `sms:${assigned}&body=${greeting}`;
        return Response.json({ ok: true, smsUrl, line: assigned }, { headers: cors });
      } catch (err) {
        console.error(JSON.stringify({ ts: new Date().toISOString(), level: "ERROR", msg: "api/start", err: String(err) }));
        return Response.json({ error: "something went wrong, try again" }, { status: 500, headers: cors });
      }
    }

    if (!hasPublic) {
      return new Response("not found", { status: 404 });
    }

    const isRoot = url.pathname === "/";
    const filePath = path.join(PUBLIC_DIR, isRoot ? "index.html" : url.pathname);
    const file = Bun.file(filePath);
    const noStore = { "Cache-Control": "no-store" } as const;
    if (await file.exists()) {
      const headers = isRoot || filePath.endsWith(".html") ? noStore : undefined;
      return new Response(file, headers ? { headers } : undefined);
    }
    return new Response(Bun.file(path.join(PUBLIC_DIR, "index.html")), { headers: noStore });
  },
});

console.log(JSON.stringify({ ts: new Date().toISOString(), level: "INFO", msg: `http on :${port}${hasPublic ? " (landing page + api)" : " (health only)"}` }));

// All app initialization runs async after the health server is already bound.
// Errors here are logged but don't crash the health server.
async function startApp(): Promise<void> {
  const dbUrl = config.tursoUrl();
  const dbToken = config.tursoToken();
  const schedulerMs = config.schedulerIntervalSeconds() * 1000;
  const demoSecs = config.demoFollowUpSeconds();

  const db = await openDb(dbUrl, dbToken);
  const llm = createLlm();
  const inboundDedup = new InboundDedup(10 * 60 * 1000);

  console.log(JSON.stringify({
    ts: new Date().toISOString(), level: "INFO",
    msg: "yearn online",
    default_follow_up_days: config.followUpDays(),
    follow_up_buffer_days: config.followUpBufferDays(),
    llm_horizon_fallback: config.useLlmHorizonFallback(),
    demo_follow_up_seconds: demoSecs ?? null,
    scheduler_interval_ms: schedulerMs,
  }));

  const scheduler = createScheduler({ db, llm, intervalMs: schedulerMs });
  scheduler.start();

  const shutdown = async (sig: string): Promise<void> => {
    console.log(JSON.stringify({ ts: new Date().toISOString(), level: "INFO", msg: `${sig} received` }));
    scheduler.stop();
    await closeSpectrum();
    await closeRenderer();
    await db.close();
    process.exit(0);
  };

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));

  const startupDelay = startupConnectDelayMs();
  if (startupDelay > 0) {
    console.log(JSON.stringify({
      ts: new Date().toISOString(), level: "INFO",
      msg: "waiting before spectrum connect (deploy overlap)",
      delay_ms: startupDelay,
    }));
    await Bun.sleep(startupDelay);
  }

  // Reconnect loop — if the Spectrum WebSocket drops, reinitialise and resume.
  let reconnectAttempt = 0;
  while (true) {
    try {
      await closeSpectrum();
      const liveApp = await initSpectrum();
      reconnectAttempt = 0;

      console.log(JSON.stringify({ ts: new Date().toISOString(), level: "INFO", msg: "inbound loop started" }));
      for await (const [space, message] of liveApp.messages) {
        const sender = (message as unknown as { sender?: { id?: string } }).sender;
        const phone = sender?.id ?? "";
        const spaceType = (space as unknown as { type?: string }).type;
        const spacePhone = (space as unknown as { phone?: string }).phone;
        const platform = (message as unknown as { platform?: string }).platform;
        const ctype = message.content.type;
        const text = ctype === "text" ? (message.content as { text: string }).text : "";

        console.log(JSON.stringify({
          ts: new Date().toISOString(), level: "INFO", msg: "inbound",
          platform, spaceType, spacePhone, sender_id: phone, ctype, text_len: text.length,
        }));

        if (!phone.startsWith("+")) { console.log(JSON.stringify({ ts: new Date().toISOString(), level: "DEBUG", msg: "skip: no + prefix", phone })); continue; }
        if (spaceType && spaceType !== "dm") { console.log(JSON.stringify({ ts: new Date().toISOString(), level: "DEBUG", msg: "skip: not dm", spaceType })); continue; }
        if (!text.trim()) { console.log(JSON.stringify({ ts: new Date().toISOString(), level: "DEBUG", msg: "skip: empty text" })); continue; }

        const dedupKey = inboundMessageKey(message, phone, text);
        const nowMs = Date.now();
        if (inboundDedup.isDuplicate(dedupKey, nowMs)) {
          console.log(JSON.stringify({ ts: new Date().toISOString(), level: "INFO", msg: "skip: duplicate inbound", dedupKey }));
          continue;
        }

        console.log(JSON.stringify({ ts: new Date().toISOString(), level: "INFO", msg: "routing", phone: phone.slice(-4), text_preview: text.slice(0, 20) }));
        try {
          await space.responding(async () => {
            console.log(JSON.stringify({ ts: new Date().toISOString(), level: "INFO", msg: "responding cb start" }));
            try {
              await route(phone, text, new Date(message.timestamp), { db, llm });
              console.log(JSON.stringify({ ts: new Date().toISOString(), level: "INFO", msg: "route ok" }));
            } catch (err) {
              console.error(JSON.stringify({
                ts: new Date().toISOString(), level: "ERROR", msg: "route threw",
                phone: phone.slice(-4), err: String(err),
                stack: err instanceof Error ? err.stack?.split("\n").slice(0, 4).join(" | ") : undefined,
              }));
              // Best-effort fallback so the user isn't left in silence
              try {
                const { sendText } = await import("./spectrum/send.ts");
                await sendText(phone, "something went sideways on our end 😅 try sending that again!");
              } catch { /* truly best-effort */ }
            }
          });
          console.log(JSON.stringify({ ts: new Date().toISOString(), level: "INFO", msg: "responding done" }));
        } catch (err) {
          console.error(JSON.stringify({ ts: new Date().toISOString(), level: "ERROR", msg: "responding threw", err: String(err) }));
        }
      }
      console.log(JSON.stringify({ ts: new Date().toISOString(), level: "WARN", msg: "inbound loop ended — reconnecting" }));
      setSpectrumStatus("disconnected");
    } catch (err) {
      reconnectAttempt += 1;
      const waitMs = reconnectDelayMs(reconnectAttempt, err);
      console.error(JSON.stringify({
        ts: new Date().toISOString(), level: "ERROR", msg: "spectrum connect failed — reconnecting",
        err: String(err), retry_in_ms: waitMs, attempt: reconnectAttempt,
      }));
      setSpectrumStatus("disconnected", err);
      await Bun.sleep(waitMs);
      continue;
    }

    // Brief pause before reconnect after a clean loop exit (stream ended).
    await Bun.sleep(reconnectDelayMs(1, new Error("stream ended")));
  }
}

startApp().catch((err) => {
  console.error(JSON.stringify({ ts: new Date().toISOString(), level: "FATAL", msg: String(err) }));
  // Do NOT exit — health server must stay alive for Railway to keep the container up.
  // Fix: add missing env vars in Railway dashboard, then redeploy.
});
