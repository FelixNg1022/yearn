import { Solar } from 'lunar-typescript'

const STEM_ELEMENT: Readonly<Record<string, string>> = {
  甲: '木', 乙: '木',
  丙: '火', 丁: '火',
  戊: '土', 己: '土',
  庚: '金', 辛: '金',
  壬: '水', 癸: '水',
}

function stemElement(stem: string): string {
  const e = STEM_ELEMENT[stem]
  if (!e) throw new Error(`Unknown heavenly stem: ${stem}`)
  return e
}

export interface Pillar {
  gan_zhi: string
  gan: string
  zhi: string
  hide_gan: readonly string[]
  wu_xing: string
  na_yin: string
}

export interface BaziResult {
  birth_iso: string
  solar: { year: number; month: number; day: number; hour: number; minute: number }
  lunar: { year: string; month: number; day: number; hour_zhi: string }
  year_pillar: Pillar
  month_pillar: Pillar
  day_pillar: Pillar
  hour_pillar: Pillar
  day_master: string
  day_master_element: string
}

const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?(?:Z|[+-]\d{2}:?\d{2})?$/

export function computeBazi(birthIso: string): BaziResult {
  const match = ISO_RE.exec(birthIso)
  if (!match) {
    throw new Error(`Invalid birth_iso: ${birthIso}`)
  }
  const [, yyyy, mm, dd, hh, mi, ss = '0'] = match
  const year = Number(yyyy)
  const month = Number(mm)
  const day = Number(dd)
  const hour = Number(hh)
  const minute = Number(mi)
  const second = Number(ss)

  // Intentionally ignore the TZ offset — 八字 uses the wall-clock time in the
  // birth timezone, not UTC. Passing the local components directly to
  // lunar-typescript gives the correct pillars regardless of the machine's TZ.
  const solar = Solar.fromYmdHms(year, month, day, hour, minute, second)
  const lunar = solar.getLunar()
  const ec = lunar.getEightChar()

  return {
    birth_iso: birthIso,
    solar: {
      year: solar.getYear(),
      month: solar.getMonth(),
      day: solar.getDay(),
      hour: solar.getHour(),
      minute,
    },
    lunar: {
      year: lunar.getYearInGanZhi(),
      month: Math.abs(lunar.getMonth()),
      day: lunar.getDay(),
      hour_zhi: lunar.getTimeZhi(),
    },
    year_pillar: {
      gan_zhi: ec.getYear(),
      gan: ec.getYearGan(),
      zhi: ec.getYearZhi(),
      hide_gan: ec.getYearHideGan(),
      wu_xing: ec.getYearWuXing(),
      na_yin: ec.getYearNaYin(),
    },
    month_pillar: {
      gan_zhi: ec.getMonth(),
      gan: ec.getMonthGan(),
      zhi: ec.getMonthZhi(),
      hide_gan: ec.getMonthHideGan(),
      wu_xing: ec.getMonthWuXing(),
      na_yin: ec.getMonthNaYin(),
    },
    day_pillar: {
      gan_zhi: ec.getDay(),
      gan: ec.getDayGan(),
      zhi: ec.getDayZhi(),
      hide_gan: ec.getDayHideGan(),
      wu_xing: ec.getDayWuXing(),
      na_yin: ec.getDayNaYin(),
    },
    hour_pillar: {
      gan_zhi: ec.getTime(),
      gan: ec.getTimeGan(),
      zhi: ec.getTimeZhi(),
      hide_gan: ec.getTimeHideGan(),
      wu_xing: ec.getTimeWuXing(),
      na_yin: ec.getTimeNaYin(),
    },
    day_master: ec.getDayGan(),
    day_master_element: stemElement(ec.getDayGan()),
  }
}
