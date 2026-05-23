import { motion } from 'framer-motion'
import { BackWindow } from '@/components/svg/BackWindow'

import { EXPO } from '@/lib/easing'

export function ArchLayer({ reduceMotion: rm }: { reduceMotion: boolean }) {
  return (
    <>
      {/* Desktop: 4 arches in a row */}
      <div
        className="absolute left-[6vw] top-1/2 -translate-y-1/2 pointer-events-none h-[85vh] hidden md:flex"
        style={{ gap: '3vw' }}
      >
        {[0, 1, 2, 3].map((i) => (
          <motion.div
            key={i}
            className="h-full w-[25vw] shrink-0"
            initial={rm ? false : { opacity: 0, y: -40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.15, duration: 0.8, ease: EXPO }}
          >
            <BackWindow instanceId={`arch-${i + 1}`} className="h-full w-full" />
          </motion.div>
        ))}
      </div>

      {/* Mobile: 1 centered arch, tall, top-aligned */}
      <div className="absolute top-0 left-0 right-0 flex justify-center pointer-events-none h-[70vh] md:hidden">
        <motion.div
          className="h-full w-[75vw]"
          initial={rm ? false : { opacity: 0, y: -40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: EXPO }}
        >
          <BackWindow instanceId="arch-mobile" className="h-full w-full" />
        </motion.div>
      </div>
    </>
  )
}
