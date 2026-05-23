import { motion } from 'framer-motion'
import { FlowerGroup } from '@/components/svg/FlowerGroup'

import { EXPO } from '@/lib/easing'

export function Florals({ reduceMotion: rm }: { reduceMotion: boolean }) {
  return (
    <>
      {/* Desktop: right-aligned, stems bleed off bottom */}
      <motion.div
        className="absolute right-[5vw] bottom-0 pointer-events-auto w-[38vw] overflow-hidden hidden md:block"
        initial={rm ? false : { opacity: 0, y: '20%' }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 2.2, duration: 1.2, ease: EXPO }}
      >
        <FlowerGroup className="w-full h-auto block" reduceMotion={rm} />
      </motion.div>

      {/* Mobile: centered, show petals + upper stems, clip bottom */}
      <motion.div
        className="absolute bottom-[12vh] left-0 right-0 flex justify-center pointer-events-auto md:hidden"
        initial={rm ? false : { opacity: 0, y: 60 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.6, duration: 1.2, ease: EXPO }}
      >
        <div className="w-[90vw] h-[55vh] overflow-hidden">
          <FlowerGroup
            className="w-full h-auto block"
            reduceMotion={rm}
          />
        </div>
      </motion.div>
    </>
  )
}
