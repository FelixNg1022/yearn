import { describe, expect, test } from 'bun:test'
import { computeBazi } from '../../src/kernel/bazi.ts'

describe('computeBazi', () => {
  test('Felix birth 2002-10-22 18:00 Shenzhen (UTC+8) yields 壬午 庚戌 癸亥 辛酉', () => {
    // The original build plan predicted 戊子 day / 戊 earth, but lunar-typescript
    // returns 癸亥 day / 癸 water. The plan explicitly said to trust the library.
    // Independently consistent: by 五鼠遁, both 戊 and 癸 days start 子时 at 壬子,
    // so 酉时 = 辛酉 in both cases, matching the computed hour pillar.
    const bazi = computeBazi('2002-10-22T18:00:00+08:00')
    expect(bazi.year_pillar.gan_zhi).toBe('壬午')
    expect(bazi.month_pillar.gan_zhi).toBe('庚戌')
    expect(bazi.day_pillar.gan_zhi).toBe('癸亥')
    expect(bazi.hour_pillar.gan_zhi).toBe('辛酉')
    expect(bazi.day_master).toBe('癸')
    expect(bazi.day_master_element).toBe('水')
  })

  test('result is deterministic for the same input', () => {
    const iso = '2002-10-22T18:00:00+08:00'
    const a = computeBazi(iso)
    const b = computeBazi(iso)
    expect(a).toEqual(b)
  })

  test('invalid ISO throws', () => {
    expect(() => computeBazi('not-a-date')).toThrow()
  })

  test('gan/zhi decomposition matches the pillar string', () => {
    const bazi = computeBazi('2002-10-22T18:00:00+08:00')
    expect(bazi.year_pillar.gan + bazi.year_pillar.zhi).toBe(bazi.year_pillar.gan_zhi)
    expect(bazi.month_pillar.gan + bazi.month_pillar.zhi).toBe(bazi.month_pillar.gan_zhi)
    expect(bazi.day_pillar.gan + bazi.day_pillar.zhi).toBe(bazi.day_pillar.gan_zhi)
    expect(bazi.hour_pillar.gan + bazi.hour_pillar.zhi).toBe(bazi.hour_pillar.gan_zhi)
  })
})
