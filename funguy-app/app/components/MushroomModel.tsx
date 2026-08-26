"use client"

import { useEffect, useRef } from "react"
import { Canvas } from "@react-three/fiber"
import { useGLTF, Environment, OrbitControls } from "@react-three/drei"
import * as THREE from "three"

function Mushroom() {
  const { scene } = useGLTF("/assets/mushroom-scan.glb")
  const ref = useRef<THREE.Group>(null)

  useEffect(() => {
    if (!ref.current) return
    const box = new THREE.Box3().setFromObject(ref.current)
    const size = new THREE.Vector3()
    box.getSize(size)
    const maxDim = Math.max(size.x, size.y, size.z)
    ref.current.scale.setScalar(2.6 / maxDim)
    const centre = new THREE.Vector3()
    box.getCenter(centre)
    ref.current.position.sub(centre.multiplyScalar(2.6 / maxDim))
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
