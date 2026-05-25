// src/profileUpdate.ts
import type { Db, UserRow } from "./db.ts";
import type { LlmClient } from "./llm.ts";
import { resolveTimezone } from "./lang.ts";
import { parseDate, buildBirthIso, type DateParts, type TimeParts } from "./onboarding.ts";
import { encryptToJson, decryptFromJson } from "./crypto.ts";
import { computeBazi } from "./kernel/bazi.ts";

export type UpdateField = "name" | "birthday" | "city";

export interface ProfileUpdateIntent {
  field: UpdateField;
  value: string;
}

// Requires both a change-intent word and a profile field keyword
const CHANGE_INTENT = /\b(change|update|fix|correct|edit|set|修改|更改|改|更新)\b/i;
const PROFILE_FIELD = /\b(name|birthday|birth\s*day|bday|city|location|born|名字|生日|城市|出生地)\b/i;

export function looksLikeProfileUpdate(text: string): boolean {
  return CHANGE_INTENT.test(text) && PROFILE_FIELD.test(text);
}

export async function parseProfileUpdateIntent(
  text: string,
  lang: string,
  llm: LlmClient,
): Promise<ProfileUpdateIntent | null> {
  return llm.parseProfileUpdate(text, lang);
}

export async function applyProfileUpdate(
  intent: ProfileUpdateIntent,
  user: UserRow,
  db: Db,
  llm: LlmClient,
): Promise<string> {
  const lang = user.lang;

  switch (intent.field) {
    case "name": {
      const newName = intent.value.trim().slice(0, 50);
      if (!newName) {
        return lang === "zh" ? "名字好像是空的，再发一次？" : "that name came out empty — try again?";
      }
      await db.setUserName(user.phone, newName);
      return lang === "zh"
        ? `好的，名字已改为 ${newName} ✨`
        : `got it, updating your name to ${newName} ✨`;
    }

    case "birthday": {
      const date = parseDate(intent.value);
      if (!date) {
        return lang === "zh"
          ? "没认出那个日期，能再说一遍吗？比如：2002-10-22 或 October 22, 2002"
          : "couldn't parse that date — try something like 2002-10-22 or October 22, 2002";
      }
      if (!user.birth_iso_encrypted || !user.birth_tz) {
        return lang === "zh"
          ? "还没有出生信息，发 /setup 来重新设置 ✨"
          : "no birth info on file yet — send /setup to set it up ✨";
      }

      let existingTime: TimeParts | null = null;
      try {
        const existingIso = decryptFromJson(user.birth_iso_encrypted);
        const timePart = existingIso.match(/T(\d{2}):(\d{2}):/);
        if (timePart && user.has_hour_pillar) {
          existingTime = { hour: +timePart[1]!, minute: +timePart[2]! };
        }
      } catch { /* use null time */ }

      const newBirthIso = buildBirthIso(date, existingTime, user.birth_tz);
      const encrypted = encryptToJson(newBirthIso);
      const bazi = computeBazi(newBirthIso);

      await db.setOnboardingState(user.phone, "complete", {
        birth_iso_encrypted: encrypted,
        bazi_pillars: JSON.stringify(bazi),
      });

      const mm = String(date.month).padStart(2, "0");
      const dd = String(date.day).padStart(2, "0");
      return lang === "zh"
        ? `生日已更新为 ${date.year}年${mm}月${dd}日，八字重算完毕 ✨`
        : `birthday updated to ${date.year}-${mm}-${dd} and your 八字 has been recomputed ✨`;
    }

    case "city": {
      if (!user.birth_iso_encrypted) {
        return lang === "zh"
          ? "还没有出生信息，发 /setup 来重新设置 ✨"
          : "no birth info on file yet — send /setup to set it up ✨";
      }

      let newTz: string | null = resolveTimezone(intent.value);
      if (!newTz) newTz = await llm.resolveTimezone(intent.value);
      if (!newTz) {
        return lang === "zh"
          ? `没认出 "${intent.value}"，能发个具体城市名吗？比如：Shanghai、Los Angeles`
          : `couldn't recognize "${intent.value}" — try a city name like Shanghai or Los Angeles`;
      }

      let existingDate: DateParts | null = null;
      let existingTime: TimeParts | null = null;
      try {
        const existingIso = decryptFromJson(user.birth_iso_encrypted);
        const datePart = existingIso.match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (datePart) {
          existingDate = { year: +datePart[1]!, month: +datePart[2]!, day: +datePart[3]! };
        }
        const timePart = existingIso.match(/T(\d{2}):(\d{2}):/);
        if (timePart && user.has_hour_pillar) {
          existingTime = { hour: +timePart[1]!, minute: +timePart[2]! };
        }
      } catch { /* fallthrough */ }

      if (!existingDate) {
        return lang === "zh"
          ? "出生日期数据有问题，发 /setup 来重新设置 ✨"
          : "something went wrong with your birth data — send /setup to reset ✨";
      }

      const newBirthIso = buildBirthIso(existingDate, existingTime, newTz);
      const encrypted = encryptToJson(newBirthIso);
      const bazi = computeBazi(newBirthIso);

      await db.setOnboardingState(user.phone, "complete", {
        birth_iso_encrypted: encrypted,
        birth_tz: newTz,
        bazi_pillars: JSON.stringify(bazi),
      });

      return lang === "zh"
        ? `出生地已更新为 ${intent.value}，八字重算完毕 ✨`
        : `birth location updated to ${intent.value} and your 八字 has been recomputed ✨`;
    }
  }
}
