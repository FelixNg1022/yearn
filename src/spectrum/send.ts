import { attachment } from "spectrum-ts";
import { imessage } from "spectrum-ts/providers";
import type { Lang } from "../db.ts";
import { STRINGS } from "../lang.ts";
import { getApp } from "./app.ts";

async function getSpace(phone: string) {
  const iMsg = imessage(getApp());
  return iMsg.space({ phone });
}

export async function sendText(phone: string, text: string): Promise<void> {
  const space = await getSpace(phone);
  await space.send(text);
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
      ? `${days} 天前你问：「${q}」——后来怎么样？回 yes / no / mixed（可加一句备注）。`
      : `${days} days ago you asked: "${q}" — how did it play out? reply: yes / no / mixed (feel free to add a note).`;
  await sendText(phone, text);
}

export async function sendShareInvite(phone: string, lang: Lang): Promise<void> {
  await sendText(phone, STRINGS.sharePrompt[lang]);
}
