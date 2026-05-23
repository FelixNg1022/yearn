import { useRef, useEffect, useMemo, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useReducedMotion } from 'framer-motion'
import * as THREE from 'three'

import vertexShader from './shaders/vertex.glsl'
import fragmentShader from './shaders/fragment.glsl'

function hexToVec3(hex: string): [number, number, number] {
  const c = hex.replace('#', '')
  return [
    parseInt(c.slice(0, 2), 16) / 255,
    parseInt(c.slice(2, 4), 16) / 255,
    parseInt(c.slice(4, 6), 16) / 255,
  ]
}

function readCSSColor(varName: string, fallback: string): [number, number, number] {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(varName).trim()
  return hexToVec3(raw || fallback)
}

export function ShaderField() {
  const materialRef = useRef<THREE.ShaderMaterial>(null)
  const { size } = useThree()
  const rm = !!useReducedMotion()
  const [paused, setPaused] = useState(false)

  const colors = useMemo(
    () => ({
      a: readCSSColor('--color-honey-mid', '#FFB700'),
      b: readCSSColor('--color-marigold', '#FF7301'),
      c: readCSSColor('--color-cream', '#FAF7F0'),
    }),
    [],
  )

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uResolution: { value: new THREE.Vector2(size.width, size.height) },
      uMouse: { value: new THREE.Vector2(0.5, 0.5) },
      uColorA: { value: new THREE.Vector3(...colors.a) },
      uColorB: { value: new THREE.Vector3(...colors.b) },
      uColorC: { value: new THREE.Vector3(...colors.c) },
      uIntensity: { value: 1.0 },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  /* keep resolution in sync */
  useEffect(() => {
    uniforms.uResolution.value.set(size.width, size.height)
  }, [size, uniforms])

  /* mouse tracking */
  useEffect(() => {
    if (rm) return
    const onMove = (e: MouseEvent) => {
      uniforms.uMouse.value.set(
        e.clientX / window.innerWidth,
        1 - e.clientY / window.innerHeight,
      )
    }
    window.addEventListener('mousemove', onMove)
    return () => window.removeEventListener('mousemove', onMove)
  }, [rm, uniforms])

  /* pause when tab hidden */
  useEffect(() => {
    const onChange = () => setPaused(document.hidden)
    document.addEventListener('visibilitychange', onChange)
    return () => document.removeEventListener('visibilitychange', onChange)
  }, [])

  /* drive uTime each frame */
  useFrame((state) => {
    if (!materialRef.current || paused) return
    if (rm) {
      materialRef.current.uniforms.uTime.value = 0
      return
    }
    materialRef.current.uniforms.uTime.value = state.clock.elapsedTime
  })

  return (
    <mesh>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial
        ref={materialRef}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        transparent
        depthTest={false}
        depthWrite={false}
      />
    </mesh>
  )
}
