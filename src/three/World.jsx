import Particles from "./Particles";

export default function World() {
  return (
    <>
      {/* Light */}
      <ambientLight intensity={0.5} />

      {/* Background particles */}
      <Particles />
    </>
  );
}