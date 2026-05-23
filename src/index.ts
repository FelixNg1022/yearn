// src/index.ts
import { openDb } from "./db.ts";
import { createLlm } from "./llm.ts";
import { initSpectrum } from "./spectrum/app.ts";
import { route } from "./router.ts";
import { createScheduler } from "./scheduler.ts";
import { closeRenderer } from "./card/render.ts";
import { config } from "./config.ts";
import path from "node:path";
import fs from "node:fs";

async function main(): Promise<void> {
  const dbUrl = config.tursoUrl();
  const dbToken = config.tursoToken();
  const demoSecs = config.demoFollowUpSeconds();
  const schedulerMs = config.schedulerIntervalSeconds() * 1000;

  const db = await openDb(dbUrl, dbToken);
  const llm = createLlm();
  const app = await initSpectrum();

  const PUBLIC_DIR = path.resolve(import.meta.dir, "../public");
  const hasPublic = fs.existsSync(PUBLIC_DIR);
  const port = Number(process.env.PORT ?? 3000);

  Bun.serve({
    port,
    async fetch(req) {
      const url = new URL(req.url);

      if (url.pathname === "/health") {
        return Response.json({ ok: true });
      }

      if (!hasPublic) {
        return new Response("not found", { status: 404 });
      }

      if (url.pathname === "/api/start" && req.method === "POST") {
        try {
          const body = await req.json() as { phone?: string };
          const raw = (body.phone ?? "").trim();
          const digits = raw.replace(/\D/g, "");
          if (!digits || digits.length < 7) {
            return Response.json({ error: "enter a valid phone number" }, { status: 400 });
          }
          const phone = raw.startsWith("+") ? `+${digits}` : digits.length === 10 ? `+1${digits}` : `+${digits}`;

          const projectId = config.projectId();
          const auth = Buffer.from(`${projectId}:${config.projectSecret()}`).toString("base64");
          const createRes = await fetch(`https://spectrum.photon.codes/projects/${projectId}/users/`, {
            method: "POST",
            headers: {
              "Authorization": `Basic ${auth}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ type: "shared", phoneNumber: phone }),
          });
          if (!createRes.ok) {
            const errText = await createRes.text();
            console.error(JSON.stringify({
              ts: new Date().toISOString(), level: "ERROR", msg: "api/start spectrum user",
              status: createRes.status, err: errText.slice(0, 300),
            }));
            return Response.json({ error: "couldn't reach the fortune line, try again" }, { status: 502 });
          }
          const created = await createRes.json() as { data?: { assignedPhoneNumber?: string } };
          const assigned = created.data?.assignedPhoneNumber;
          if (!assigned) {
            return Response.json({ error: "no fortune line assigned yet, try again later" }, { status: 502 });
          }

          const greeting = encodeURIComponent("hi yearn");
          const smsUrl = `sms:${assigned}&body=${greeting}`;
          return Response.json({ ok: true, smsUrl, line: assigned });
        } catch (err) {
          console.error(JSON.stringify({ ts: new Date().toISOString(), level: "ERROR", msg: "api/start", err: String(err) }));
          return Response.json({ error: "something went wrong, try again" }, { status: 500 });
        }
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

  console.log(JSON.stringify({ ts: new Date().toISOString(), level: "INFO", msg: "inbound loop started" }));
  for await (const [space, message] of app.messages) {
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

    if (!phone.startsWith("+")) continue;
    if (spaceType && spaceType !== "dm") continue;
    if (!text.trim()) continue;

    await space.responding(async () => {
      try {
        await route(phone, text, new Date(message.timestamp), { db, llm });
      } catch (err) {
        console.error(JSON.stringify({
          ts: new Date().toISOString(), level: "ERROR",
          phone: phone.slice(-4), err: String(err),
          stack: err instanceof Error ? err.stack?.split("\n").slice(0, 4).join(" | ") : undefined,
        }));
      }
    });
  }
  console.log(JSON.stringify({ ts: new Date().toISOString(), level: "WARN", msg: "inbound loop ended" }));

  const shutdown = async (sig: string): Promise<void> => {
    console.log(JSON.stringify({ ts: new Date().toISOString(), level: "INFO", msg: `${sig} received` }));
    scheduler.stop();
    await closeRenderer();
    await db.close();
    process.exit(0);
  };

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

main().catch((err) => {
  console.error("fatal:", err);
  process.exit(1);
});
