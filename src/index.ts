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

  // Serve the landing page on port 3000
  const PUBLIC_DIR = path.resolve(import.meta.dir, "../public");
  if (fs.existsSync(PUBLIC_DIR)) {
    const landingPage = Bun.file(path.join(PUBLIC_DIR, "index.html"));
    Bun.serve({
      port: 3000,
      fetch(req) {
        const url = new URL(req.url);
        let filePath = path.join(PUBLIC_DIR, url.pathname === "/" ? "index.html" : url.pathname);
        const file = Bun.file(filePath);
        return new Response(file);
      },
    });
    console.log(JSON.stringify({ ts: new Date().toISOString(), level: "INFO", msg: "landing page on :3000" }));
  }

  console.log(JSON.stringify({
    ts: new Date().toISOString(), level: "INFO",
    msg: "运 online",
    default_follow_up_days: config.followUpDays(),
    follow_up_buffer_days: config.followUpBufferDays(),
    llm_horizon_fallback: config.useLlmHorizonFallback(),
    demo_follow_up_seconds: demoSecs ?? null,
    scheduler_interval_ms: schedulerMs,
  }));

  const scheduler = createScheduler({ db, intervalMs: schedulerMs });
  scheduler.start();

  for await (const [space, message] of app.messages) {
    const phone = (space as unknown as { phone: string }).phone;
    if (!phone) continue;

    const spaceType = (space as unknown as { type?: string }).type;
    if (spaceType && spaceType !== "dm") continue;

    const text = message.content.type === "text" ? message.content.text : "";
    if (!text.trim()) continue;

    await space.responding(async () => {
      try {
        await route(phone, text, new Date(message.timestamp), { db, llm });
      } catch (err) {
        console.error(JSON.stringify({
          ts: new Date().toISOString(), level: "ERROR",
          phone: phone.slice(-4), err: String(err),
        }));
      }
    });
  }

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
