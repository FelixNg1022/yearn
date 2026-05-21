import { Solar } from 'lunar-typescript'

export type Palace = '大安' | '留连' | '速喜' | '赤口' | '小吉' | '空亡'

export interface PalaceMeaning {
  name: Palace
  meaning_zh: string
  meaning_en: string
}

const PALACES: readonly Palace[] = ['大安', '留连', '速喜', '赤口', '小吉', '空亡']

const MEANINGS: Readonly<Record<Palace, { zh: string; en: string }>> = {
  大安: { zh: '安稳，事情稳定，主静。', en: 'Peace and stability; matters rest still.' },
  留连: { zh: '拖延反复，纠缠不清。', en: 'Delay and entanglement; matters drag on.' },
  速喜: { zh: '喜讯速来，事情成就。', en: 'Swift joy; good news arrives quickly.' },
  赤口: { zh: '口舌是非，争执冲突。', en: 'Quarrels and sharp tongues; conflict.' },
  小吉: { zh: '小有所得，和合之象。', en: 'Small fortune; gentle gains, harmony.' },
  空亡: { zh: '空无结果，落空之象。', en: 'Emptiness; nothing comes of it.' },
}

export interface LiurenLunar {
  month: number
  day: number
  hour_zhi: string
}

export interface LiurenMath {
  lunar_month: number
  lunar_day: number
  hour_zhi_num: number
  month_palace_index: number
  day_palace_index: number
  hour_palace_index: number
}

export interface LiurenResult {
  method: 'liuren'
  cast_at_iso: string
  lunar: LiurenLunar
  math: LiurenMath
  month_palace: PalaceMeaning
  day_palace: PalaceMeaning
  hour_palace: PalaceMeaning
}

export function castLiuren(at: Date): LiurenResult {
  const solar = Solar.fromDate(at)
  const lunar = solar.getLunar()

  const lunarMonth = Math.abs(lunar.getMonth())
  const lunarDay = lunar.getDay()
  const hourZhiNum = lunar.getTimeZhiIndex() + 1

  const monthIdx = (lunarMonth - 1) % 6
  const dayIdx = (monthIdx + lunarDay - 1) % 6
  const hourIdx = (dayIdx + hourZhiNum - 1) % 6

  return {
    method: 'liuren',
    cast_at_iso: at.toISOString(),
    lunar: {
      month: lunarMonth,
      day: lunarDay,
      hour_zhi: lunar.getTimeZhi(),
    },
    math: {
      lunar_month: lunarMonth,
      lunar_day: lunarDay,
      hour_zhi_num: hourZhiNum,
      month_palace_index: monthIdx,
      day_palace_index: dayIdx,
      hour_palace_index: hourIdx,
    },
    month_palace: palaceAt(monthIdx),
    day_palace: palaceAt(dayIdx),
    hour_palace: palaceAt(hourIdx),
  }
}

function palaceAt(index: number): PalaceMeaning {
  const name = PALACES[index]
  if (!name) throw new RangeError(`palaceAt: index out of range: ${index}`)
  const meaning = MEANINGS[name]
  return { name, meaning_zh: meaning.zh, meaning_en: meaning.en }
}
