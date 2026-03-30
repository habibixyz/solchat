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
    initialInputMint: "So11111111111111111111111111111111111111112",
    initialOutputMint: mint,
  },
  platformFeeAndAccounts: {
    referralAccount: "HLtC6FYq1uJjkh2Hqz2LXoKWXMKV1Z22SmhAch5fJDii",
    feeBps: 50,
  },
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
          position: "fixed", inset: 0,
          background: "rgba(0,0,0,0.75)",
          zIndex: 9998,
          backdropFilter: "blur(4px)",
        }}
      />

      {/* Centered modal */}
      <div style={{
        position: "fixed",
        top: "50%", left: "50%",
        transform: "translate(-50%, -50%)",
        width: "420px",
        maxWidth: "95vw",
        background: "#0a0f1e",
        border: "1px solid rgba(0,247,255,0.15)",
        borderRadius: "16px",
        padding: "20px",
        zIndex: 9999,
        boxShadow: "0 0 60px rgba(0,0,0,0.8)",
      }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
          <div>
            <div style={{ fontFamily: "'Space Mono', monospace", fontSize: "10px", letterSpacing: "3px", color: "#00f7ff", opacity: 0.6, textTransform: "uppercase", marginBottom: "2px" }}>
              Solchat · Swap
            </div>
            <div style={{ fontFamily: "'Syne', sans-serif", fontSize: "16px", fontWeight: 800, color: "#e2edf8" }}>
              Buy Token
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.1)",
              color: "#8ab8cc",
              fontSize: "16px",
              cursor: "pointer",
              borderRadius: "8px",
              width: "32px", height: "32px",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            ✕
          </button>
        </div>

        {/* Jupiter mounts here */}
        <div
          id="jupiter-terminal"
          style={{ width: "100%", height: "420px", borderRadius: "12px", overflow: "hidden" }}
        />
      </div>
    </>
  );
}
