import { describe, expect, test } from 'bun:test'
import { castLiuren } from '../../src/kernel/liuren.ts'

describe('castLiuren', () => {
  // Tests use `new Date(Y, M-1, D, H, Min)` — these construct wall-clock times
  // in the machine's local TZ, which is exactly what `Solar.fromDate` reads,
  // making the tests portable across TZs.

  test('output is deterministic for a fixed Date', () => {
    const at = new Date(2024, 5, 15, 14, 30)
    const a = castLiuren(at)
    const b = castLiuren(at)
    expect(a).toEqual(b)
  })

  test('math fields match palace indices', () => {
    const r = castLiuren(new Date(2024, 5, 15, 14, 30))
    const expectedMonthIdx = (r.math.lunar_month - 1) % 6
    const expectedDayIdx = (expectedMonthIdx + r.math.lunar_day - 1) % 6
    const expectedHourIdx = (expectedDayIdx + r.math.hour_zhi_num - 1) % 6

    expect(r.math.month_palace_index).toBe(expectedMonthIdx)
    expect(r.math.day_palace_index).toBe(expectedDayIdx)
    expect(r.math.hour_palace_index).toBe(expectedHourIdx)
  })

  test('known case 1: 2024-06-15 14:30 local (lunar 5/10 未时) → 小吉 / 留连 / 速喜', () => {
    const r = castLiuren(new Date(2024, 5, 15, 14, 30))
    expect(r.lunar.month).toBe(5)
    expect(r.lunar.day).toBe(10)
    expect(r.math.hour_zhi_num).toBe(8) // 未 = 8th (子=1)
    expect(r.month_palace.name).toBe('小吉')
    expect(r.day_palace.name).toBe('留连')
    expect(r.hour_palace.name).toBe('速喜')
  })

  test('known case 2: 2023 中秋 (2023-09-29 18:00 local, 八月十五 酉时) → 留连 / 赤口 / 大安', () => {
    const r = castLiuren(new Date(2023, 8, 29, 18, 0))
    expect(r.lunar.month).toBe(8)
    expect(r.lunar.day).toBe(15)
    expect(r.math.hour_zhi_num).toBe(10) // 酉 = 10th
    expect(r.month_palace.name).toBe('留连')
    expect(r.day_palace.name).toBe('赤口')
    expect(r.hour_palace.name).toBe('大安')
  })
})
