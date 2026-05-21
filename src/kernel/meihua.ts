import { Solar } from 'lunar-typescript'
import type { Trigram } from './trigrams.ts'
import { trigramByXianTian } from './trigrams.ts'
import type { Hexagram } from './iching.ts'
import { changedHexagram, hexagramByTrigrams } from './iching.ts'

export interface MeihuaMath {
  year_zhi_num: number
  lunar_month: number
  lunar_day: number
  hour_zhi_num: number
  upper_sum: number
  upper_mod: number
  upper_trigram: Trigram
  lower_sum: number
  lower_mod: number
  lower_trigram: Trigram
  changing_sum: number
  changing_line: number
}

export interface MeihuaLunar {
  year_gz: string
  month: number
  day: number
  hour_zhi: string
}

export interface MeihuaResult {
  method: 'meihua'
  cast_at_iso: string
  lunar: MeihuaLunar
  math: MeihuaMath
  primary: Hexagram
  changed: Hexagram
  changing_line: number
}

export function castMeihua(at: Date): MeihuaResult {
  const solar = Solar.fromDate(at)
  const lunar = solar.getLunar()

  const yearZhiNum = lunar.getYearZhiIndex() + 1
  const lunarMonth = Math.abs(lunar.getMonth())
  const lunarDay = lunar.getDay()
  const hourZhiNum = lunar.getTimeZhiIndex() + 1

  const upperSum = yearZhiNum + lunarMonth + lunarDay
  const lowerSum = upperSum + hourZhiNum
  const changingSum = lowerSum

  const upperMod = modOrN(upperSum, 8)
  const lowerMod = modOrN(lowerSum, 8)
  const changingLine = modOrN(changingSum, 6)

  const upperT = trigramByXianTian(upperMod)
  const lowerT = trigramByXianTian(lowerMod)

  const primary = hexagramByTrigrams(upperT, lowerT)
  const changed = changedHexagram(primary, changingLine)

  return {
    method: 'meihua',
    cast_at_iso: at.toISOString(),
    lunar: {
      year_gz: lunar.getYearInGanZhi(),
      month: lunarMonth,
      day: lunarDay,
      hour_zhi: lunar.getTimeZhi(),
    },
    math: {
      year_zhi_num: yearZhiNum,
      lunar_month: lunarMonth,
      lunar_day: lunarDay,
      hour_zhi_num: hourZhiNum,
      upper_sum: upperSum,
      upper_mod: upperMod,
      upper_trigram: upperT,
      lower_sum: lowerSum,
      lower_mod: lowerMod,
      lower_trigram: lowerT,
      changing_sum: changingSum,
      changing_line: changingLine,
    },
    primary,
    changed,
    changing_line: changingLine,
  }
}

function modOrN(value: number, n: number): number {
  const m = value % n
  return m === 0 ? n : m
}
