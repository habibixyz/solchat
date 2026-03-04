import { useEffect } from "react";

interface Props {
  mint: string;
  onClose: () => void;
}

export default function SwapDrawer({ mint, onClose }: Props) {

  useEffect(() => {

    const startJupiter = () => {

      const Jupiter = (window as any).Jupiter;
      if (!Jupiter) return false;

      Jupiter.init({
        displayMode: "integrated",
        integratedTargetId: "jupiter-terminal",

        formProps: {
          initialInputMint:
            "So11111111111111111111111111111111111111112",
          initialOutputMint: mint
        }
      });

      return true;
    };

    const interval = setInterval(() => {
      if (startJupiter()) clearInterval(interval);
    }, 200);

    return () => clearInterval(interval);

  }, [mint]);

  return (
    <>
      {/* Overlay */}
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.6)",
          zIndex: 9998
        }}
      />

      {/* Drawer */}
      <div
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          height: "520px",
          background: "#0b0f1f",
          borderTop: "2px solid #7c3aed",
          borderRadius: "16px 16px 0 0",
          padding: "16px",
          zIndex: 9999
        }}
      >
        <div style={{display:"flex",justifyContent:"space-between"}}>
          <h2 style={{color:"#a78bfa"}}>Swap Token</h2>

          <button
            onClick={onClose}
            style={{
              background:"transparent",
              border:"none",
              color:"white",
              fontSize:"18px",
              cursor:"pointer"
            }}
          >
            ✕
          </button>
        </div>

        {/* Jupiter mounts here */}
        <div
          id="jupiter-terminal"
          style={{
            width: "100%",
            height: "460px"
          }}
        />
      </div>
    </>
  );
}