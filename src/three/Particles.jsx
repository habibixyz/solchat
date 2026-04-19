import { useRef } from "react";
import { useFrame } from "@react-three/fiber";

export default function Particles() {
  const mesh = useRef();

  useFrame(() => {
    if (mesh.current) {
      mesh.current.rotation.y += 0.0008;
      mesh.current.rotation.x += 0.0003;
    }
  });

  return (
    <points ref={mesh}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={500}
          array={new Float32Array(
            Array.from({ length: 1500 }, () => (Math.random() - 0.5) * 20)
          )}
          itemSize={3}
        />
      </bufferGeometry>

      <pointsMaterial
        size={0.05}
        color="#00ffcc"
        sizeAttenuation
        depthWrite={false}
      />
    </points>
  );
}