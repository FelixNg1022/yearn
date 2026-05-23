import { useState, useEffect } from 'react'
import {
  motion,
  useMotionValue,
  useSpring,
  useTransform,
  useReducedMotion,
  AnimatePresence,
} from 'framer-motion'
import { GradientField } from './layers/GradientField'
import { ArchLayer } from './layers/ArchLayer'
import { CloudLayer } from './layers/CloudLayer'
import { TextAndCTA } from './layers/TextAndCTA'
import { Florals } from './layers/Florals'
import { MobileLayout } from './layers/MobileLayout'
import { PhoneModal } from './PhoneModal'

export function Hero() {
  const prefersReducedMotion = useReducedMotion()
  const rm = !!prefersReducedMotion
  const [wc, setWc] = useState(!rm)
  const [modalOpen, setModalOpen] = useState(false)

  useEffect(() => {
    if (!wc) return
    const t = setTimeout(() => setWc(false), 4000)
    return () => clearTimeout(t)
  }, [wc])

  const mouseX = useMotionValue(0)
  const mouseY = useMotionValue(0)
  const smoothX = useSpring(mouseX, { stiffness: 40, damping: 25 })
  const smoothY = useSpring(mouseY, { stiffness: 40, damping: 25 })

  useEffect(() => {
    if (rm || window.matchMedia('(pointer: coarse)').matches) return
    const onMove = (e: MouseEvent) => {
      mouseX.set((e.clientX / window.innerWidth) * 2 - 1)
      mouseY.set((e.clientY / window.innerHeight) * 2 - 1)
    }
    window.addEventListener('mousemove', onMove)
    return () => window.removeEventListener('mousemove', onMove)
  }, [rm, mouseX, mouseY])

  const archX = useTransform(smoothX, [-1, 1], [-4, 4])
  const archY = useTransform(smoothY, [-1, 1], [-4, 4])
  const textX = useTransform(smoothX, [-1, 1], [-3, 3])
  const textY = useTransform(smoothY, [-1, 1], [-3, 3])

  const willChange = wc ? 'transform' : 'auto'
  const openModal = () => setModalOpen(true)

  return (
    <main
      className="relative min-h-screen w-full overflow-hidden bg-honey-deep"
      aria-label="yearn — daily fortune"
    >
      <GradientField />

      {/* ── Desktop ── */}
      <motion.div className="absolute inset-0 z-10 pointer-events-none hidden md:block" style={{ x: archX, y: archY, willChange }}>
        <ArchLayer reduceMotion={rm} />
      </motion.div>
      <div className="absolute inset-0 z-20 pointer-events-none hidden md:block">
        <CloudLayer reduceMotion={rm} />
      </div>
      <motion.div className="absolute inset-0 z-30 pointer-events-none hidden md:block" style={{ x: textX, y: textY, willChange }}>
        <TextAndCTA reduceMotion={rm} onOpen={openModal} />
      </motion.div>
      <div className="absolute inset-0 z-40 pointer-events-none hidden md:block">
        <Florals reduceMotion={rm} />
      </div>

      {/* ── Mobile ── */}
      <div className="md:hidden">
        <MobileLayout reduceMotion={rm} onOpen={openModal} />
      </div>

      <AnimatePresence>
        {modalOpen && <PhoneModal onClose={() => setModalOpen(false)} />}
      </AnimatePresence>
    </main>
  )
}
