import { attachment } from "spectrum-ts";
import { imessage } from "spectrum-ts/providers";
import type { Lang } from "../db.ts";
import { STRINGS } from "../lang.ts";
import { getApp } from "./app.ts";

async function getSpace(phone: string) {
  const iMsg = imessage(getApp());
  const user = await iMsg.user(phone);
  return iMsg.space(user);
}

export async function sendText(phone: string, text: string): Promise<void> {
  try {
    const space = await getSpace(phone);
    await space.send(text);
  } catch (err) {
    console.error(JSON.stringify({
      ts: new Date().toISOString(), level: "ERROR", msg: "sendText failed",
      phone: phone.slice(-4), err: String(err),
    }));
    throw err;
  }
}

export async function sendCard(phone: string, text: string, png: Buffer): Promise<void> {
  const space = await getSpace(phone);
  await space.send(text);
  await space.send(attachment(png, { mimeType: "image/png", name: "cast.png" }));
}

export async function sendFollowUp(phone: string, question: string, lang: Lang, days: number): Promise<void> {
  const q = question.length > 80 ? question.slice(0, 77) + "…" : question;
  const text =
    lang === "zh"
      ? `${days} 天前你问：「${q}」——后来怎么样？回 yes / no / mixed（可以加备注）✨`
      : `checking in ✨ ${days} day${days === 1 ? "" : "s"} ago you asked: "${q}" — did it play out? reply yes / no / mixed (drop a note if you want!)`;
  await sendText(phone, text);
}

export async function sendShareInvite(phone: string, lang: Lang): Promise<void> {
  await sendText(phone, STRINGS.sharePrompt[lang]);
}
