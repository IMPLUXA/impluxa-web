"use client";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float } from "@react-three/drei";
import { useRef, useMemo } from "react";
import * as THREE from "three";

function IXATexture() {
  return useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 512;
    c.height = 256;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "rgba(0,0,0,0)";
    ctx.fillRect(0, 0, 512, 256);
    ctx.fillStyle = "#e8dcc4";
    ctx.font = 'bold 180px "Cormorant Garamond", Georgia, serif';
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("IXA", 256, 128);
    const tex = new THREE.CanvasTexture(c);
    tex.needsUpdate = true;
    return tex;
  }, []);
}

function Monolith() {
  const ref = useRef<THREE.Mesh>(null);
  const tex = IXATexture();
  useFrame((_, delta) => {
    if (ref.current) ref.current.rotation.y += delta * 0.05;
  });
  return (
    <Float speed={1.2} rotationIntensity={0.1} floatIntensity={0.4}>
      <mesh ref={ref}>
        <boxGeometry args={[1.2, 4, 0.6]} />
        <meshStandardMaterial color="#0e0e0e" roughness={0.2} metalness={0.6} />
      </mesh>
      <mesh position={[0, 0, 0.31]}>
        <planeGeometry args={[1.0, 0.5]} />
        <meshBasicMaterial map={tex} transparent />
      </mesh>
    </Float>
  );
}

export function Hero3D() {
  return (
    <Canvas
      className="absolute inset-0 -z-10"
      camera={{ position: [0, 0, 6], fov: 35 }}
      dpr={[1, 1.5]}
      gl={{ antialias: true, alpha: true }}
    >
      <ambientLight intensity={0.15} />
      <spotLight
        position={[0, 6, 4]}
        angle={0.5}
        penumbra={1}
        intensity={2.2}
        color="#f0e6d2"
      />
      <pointLight position={[-3, -2, 2]} intensity={0.3} color="#e8dcc4" />
      <Monolith />
      <fog attach="fog" args={["#0a0a0a", 5, 14]} />
    </Canvas>
  );
}
