import { Canvas } from '@react-three/fiber'
import { ShaderField } from './ShaderField'

/**
 * GradientField — warm light + paper texture shader overlay.
 * Sits on top of everything, pointer-events-none.
 * mix-blend-overlay boosts saturation without darkening.
 */
export function GradientField() {
  return (
    <div className="absolute inset-0 z-[100] pointer-events-none mix-blend-overlay">
      <Canvas
        dpr={[1, 2]}
        gl={{ alpha: true, antialias: false, premultipliedAlpha: false }}
        orthographic
        camera={{ position: [0, 0, 1], zoom: 1 }}
        style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
        frameloop="always"
      >
        <ShaderField />
      </Canvas>
    </div>
  )
}
