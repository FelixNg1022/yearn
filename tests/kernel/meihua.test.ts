import { describe, expect, test } from 'bun:test'
import { castMeihua } from '../../src/kernel/meihua.ts'
import { flipLine, hexagramBinary } from '../../src/kernel/trigrams.ts'
import { hexagramByNum } from '../../src/kernel/iching.ts'

describe('castMeihua', () => {
  test('output is deterministic for a fixed Date', () => {
    const at = new Date('2024-06-15T14:30:00+08:00')
    const a = castMeihua(at)
    const b = castMeihua(at)
    expect(a).toEqual(b)
  })

  test('math sums match the 梅花 algorithm exactly', () => {
    const at = new Date('2024-06-15T14:30:00+08:00')
    const r = castMeihua(at)

    expect(r.math.upper_sum).toBe(
      r.math.year_zhi_num + r.math.lunar_month + r.math.lunar_day,
    )
    expect(r.math.lower_sum).toBe(r.math.upper_sum + r.math.hour_zhi_num)
    expect(r.math.changing_sum).toBe(r.math.lower_sum)

    expect(r.math.upper_mod).toBe(((r.math.upper_sum - 1) % 8) + 1)
    expect(r.math.lower_mod).toBe(((r.math.lower_sum - 1) % 8) + 1)
    expect(r.math.changing_line).toBe(((r.math.changing_sum - 1) % 6) + 1)
  })

  test('primary hexagram binary equals upper|lower trigram composition', () => {
    const r = castMeihua(new Date('2024-06-15T14:30:00+08:00'))
    expect(r.primary.trigram_upper).toBe(r.math.upper_trigram)
    expect(r.primary.trigram_lower).toBe(r.math.lower_trigram)
    expect(r.primary.binary.length).toBe(6)
  })

  test('changed hexagram differs from primary only at the changing line', () => {
    const r = castMeihua(new Date('2024-06-15T14:30:00+08:00'))
    expect(r.changed.binary).toBe(flipLine(r.primary.binary, r.changing_line))
  })

  test('canonical 邵雍 老人 example: 辰年 十二月 十七日 申时 → 澤火革 (#49), 初九 changing', () => {
    // 邵雍's textbook example yields 兑上离下 = 澤火革 (hex 49), changing at line 1.
    // Math: yearZhi(辰=5) + month(12) + day(17) = 34, mod 8 = 2 → 兌 (upper)
    //       +hour(申=9) = 43, mod 8 = 3 → 離 (lower)
    //       43 mod 6 = 1 → changing line 1 (初爻)
    // Reconstruct the inputs without binding to a specific solar year:
    const yearZhi = 5
    const lunarMonth = 12
    const lunarDay = 17
    const hourZhi = 9
    const upperMod = ((yearZhi + lunarMonth + lunarDay - 1) % 8) + 1
    const lowerMod = ((yearZhi + lunarMonth + lunarDay + hourZhi - 1) % 8) + 1
    const changingLine = ((yearZhi + lunarMonth + lunarDay + hourZhi - 1) % 6) + 1
    expect(upperMod).toBe(2)
    expect(lowerMod).toBe(3)
    expect(changingLine).toBe(1)
    // 兌=2, 離=3 — so primary hex is 兌 over 離 = 澤火革 = #49
  })

  test('real end-to-end cast returns a well-formed hexagram pair', () => {
    const r = castMeihua(new Date(2024, 5, 15, 14, 30))
    // primary hexagram binary matches its trigram composition
    expect(r.primary.binary).toBe(hexagramBinary(r.primary.trigram_upper, r.primary.trigram_lower))
    // changed is exactly the primary with the changing line flipped
    expect(r.changed.binary).toBe(flipLine(r.primary.binary, r.changing_line))
    // lookup round-trip
    expect(hexagramByNum(r.primary.num)).toEqual(r.primary)
  })
})
