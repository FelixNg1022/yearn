import { motion } from 'framer-motion'

import { EXPO } from '@/lib/easing'

export function TextAndCTA({ reduceMotion: rm, onOpen }: { reduceMotion: boolean; onOpen: () => void }) {
  return (
    <div
      className="absolute left-[8vw] top-[calc(28vh-40px)] flex flex-col"
      style={{ gap: '3vw' }}
    >
      {/* Title */}
      <h1
        className="font-display font-semibold text-marigold-hi text-left"
        style={{ fontSize: 'clamp(3.5rem, 7.5vw, 108px)', lineHeight: '1.1', letterSpacing: '-0.02em' }}
      >
        <motion.span
          className="block"
          initial={rm ? false : { opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.0, duration: 1.0, ease: EXPO }}
        >
          yearn delivers
        </motion.span>
        <motion.span
          className="block"
          initial={rm ? false : { opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 2.4, duration: 1.0, ease: EXPO }}
        >
          your daily fortune
        </motion.span>
      </h1>

      {/* Button */}
      <motion.div
        className="pointer-events-auto"
        initial={rm ? false : { opacity: 0, scale: 0.5 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{
          delay: 3.6,
          opacity: { delay: 3.6, duration: 0.4, ease: EXPO },
          scale: { delay: 3.6, type: 'spring', stiffness: 300, damping: 14 },
        }}
      >
        <button
          onClick={onOpen}
          aria-label="Get your daily fortune"
          className="group relative inline-flex items-center justify-center rounded-full bg-white
            overflow-hidden
            shadow-[0_0.15vw_1vw_-0.3vw_rgba(255,107,0,0.2)]
            hover:scale-[1.04] hover:rotate-[-1.5deg]
            active:scale-[0.97]
            transition-transform duration-300 ease-out
            focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-marigold-hi/40
            focus-visible:ring-offset-2 focus-visible:ring-offset-honey-deep"
          style={{ padding: '0.7vw 2vw 0.7vw 0.8vw', gap: '0.7vw' }}
        >
          {!rm && (
            <span
              className="pointer-events-none absolute inset-0
                bg-gradient-to-r from-transparent via-white/[0.15] to-transparent
                animate-[shine_6s_ease-in-out_3s_infinite]"
              aria-hidden="true"
            />
          )}
          <span
            className="relative shrink-0 flex items-center justify-center rounded-full bg-[#34DA51]"
            style={{ width: '2.2vw', height: '2.2vw', minWidth: '24px', minHeight: '24px' }}
          >
            <svg viewBox="0 0 24 24" className="w-1/2 h-1/2" fill="white" aria-hidden="true">
              <path d="M12 2C6.48 2 2 6.04 2 11c0 2.52 1.18 4.79 3.08 6.41-.32 1.18-.97 2.74-1.88 3.59 1.65-.16 3.59-.83 5.07-1.84.9.25 1.85.39 2.83.39 5.52 0 10-4.04 10-9S17.52 2 12 2z" />
            </svg>
          </span>
          <span
            className="relative font-display font-medium text-marigold-hi whitespace-nowrap"
            style={{ fontSize: 'clamp(16px, 1.7vw, 24px)' }}
          >
            get your daily fortune
          </span>
        </button>
      </motion.div>
    </div>
  )
}
