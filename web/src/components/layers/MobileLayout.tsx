import { motion } from 'framer-motion'
import flowerSvg from '@/assets/svg/flower-group.svg'
import archSvg from '@/assets/svg/back-window.svg'

import { EXPO, SOFT } from '@/lib/easing'

export function MobileLayout({ reduceMotion: rm, onOpen }: { reduceMotion: boolean; onOpen: () => void }) {
  return (
    <div className="absolute inset-0">
      {/* Arch BG — behind everything */}
      <motion.div
        className="absolute top-0 left-0 right-0 flex justify-center z-10"
        initial={rm ? false : { opacity: 0, y: -30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: EXPO }}
      >
        <img src={archSvg} alt="" className="mt-[5vh]" style={{ width: '80vw' }} />
      </motion.div>

      {/* yearn text */}
      <div className="absolute top-[13vh] left-0 right-0 text-center z-20">
        <motion.h1
          className="font-display font-semibold text-marigold-hi"
          style={{ fontSize: 'clamp(4rem, 18vw, 8rem)', lineHeight: '1', letterSpacing: '-0.03em' }}
          initial={rm ? false : { opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.0, duration: 1.0, ease: EXPO }}
        >
          yearn
        </motion.h1>
      </div>

      {/* Flowers — entrance + gentle sway */}
      <motion.div
        className="absolute bottom-[12vh] left-0 right-0 flex justify-center z-30"
        initial={rm ? false : { opacity: 0, y: 40, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ delay: 2.2, duration: 0.8, ease: EXPO }}
      >
        <motion.img
          src={flowerSvg}
          alt=""
          className="w-[90vw]"
          style={{ maxHeight: '55vh', objectFit: 'contain', objectPosition: 'top center', transformOrigin: '50% 100%' }}
          animate={rm ? undefined : { rotate: [0, 1.5, 0, -1, 0] }}
          transition={rm ? undefined : { duration: 8, ease: SOFT, repeat: Infinity, delay: 3 }}
        />
      </motion.div>

      {/* CTA */}
      <div className="absolute bottom-[6vh] left-0 right-0 flex justify-center z-40">
        <motion.div
          initial={rm ? false : { opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{
            delay: 2.2,
            opacity: { delay: 2.2, duration: 0.4, ease: EXPO },
            scale: { delay: 2.2, type: 'spring', stiffness: 300, damping: 14 },
          }}
        >
          <button
            onClick={onOpen}
            aria-label="Get your daily fortune"
            className="relative flex flex-col items-center justify-center rounded-[28px] bg-white
              overflow-hidden
              shadow-[0_4px_24px_-8px_rgba(255,107,0,0.25)]
              active:scale-[0.97] transition-transform duration-300 ease-out
              focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-marigold-hi/40
              focus-visible:ring-offset-2 focus-visible:ring-offset-honey-deep"
            style={{ padding: '32px 56px 36px', gap: '16px', minWidth: '240px' }}
          >
            {!rm && (
              <span
                className="pointer-events-none absolute inset-0
                  bg-gradient-to-r from-transparent via-white/[0.15] to-transparent
                  animate-[shine_6s_ease-in-out_3s_infinite]"
                aria-hidden="true"
              />
            )}
            <span className="relative flex items-center justify-center rounded-full bg-[#34DA51] w-14 h-14">
              <svg viewBox="0 0 24 24" className="w-7 h-7" fill="white" aria-hidden="true">
                <path d="M12 2C6.48 2 2 6.04 2 11c0 2.52 1.18 4.79 3.08 6.41-.32 1.18-.97 2.74-1.88 3.59 1.65-.16 3.59-.83 5.07-1.84.9.25 1.85.39 2.83.39 5.52 0 10-4.04 10-9S17.52 2 12 2z" />
              </svg>
            </span>
            <span className="relative font-display font-medium text-marigold-hi text-center leading-tight" style={{ fontSize: '28px' }}>
              get your<br />daily fortune
            </span>
          </button>
        </motion.div>
      </div>
    </div>
  )
}
