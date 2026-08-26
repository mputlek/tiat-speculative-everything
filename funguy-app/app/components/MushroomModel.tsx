"use client"

import { useEffect, useRef } from "react"
import { Canvas } from "@react-three/fiber"
import { useGLTF, Environment, OrbitControls } from "@react-three/drei"
import * as THREE from "three"

const NORMALIZED_SIZE = 2.6 * 1.3 // 30% larger than the previous fixed 2.6
const VERTICAL_OFFSET = 0.5 // shifts the model down after centering, so it reads centered in its short container instead of floating high with empty space below

function Mushroom() {
  const { scene } = useGLTF("/assets/mushroom-scan.glb")
  const ref = useRef<THREE.Group>(null)

  useEffect(() => {
    if (!ref.current) return
    const box = new THREE.Box3().setFromObject(ref.current)
    const size = new THREE.Vector3()
    box.getSize(size)
    const maxDim = Math.max(size.x, size.y, size.z)
    const scale = NORMALIZED_SIZE / maxDim
    ref.current.scale.setScalar(scale)
    const centre = new THREE.Vector3()
    box.getCenter(centre)
    ref.current.position.sub(centre.multiplyScalar(scale))
    ref.current.position.y -= VERTICAL_OFFSET
  }, [scene])

  return <primitive ref={ref} object={scene} />
}

export default function MushroomModel() {
  return (
    <Canvas
      camera={{ position: [0, 0, 3.5], fov: 40 }}
      style={{ width: "100%", height: "100%" }}
      gl={{ alpha: true }}
    >
      <ambientLight intensity={1.5} />
      <directionalLight position={[3, 5, 3]} intensity={1.2} />
      <directionalLight position={[-3, -2, -3]} intensity={0.4} />
      <Environment preset="park" />
      <OrbitControls
        enableZoom={false}
        enablePan={false}
        autoRotate
        autoRotateSpeed={2}
      />
      <Mushroom />
    </Canvas>
  )
}
