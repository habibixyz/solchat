import { useNavigate } from "react-router-dom";

export default function ManifestoPage() {
  const navigate = useNavigate();

  const styles: Record<string, React.CSSProperties> = {
    wrap: { maxWidth: 640, margin: "0 auto", padding: "48px 24px 80px", fontFamily: "'Space Mono', monospace", color: "#8aa0b8" },
    eyebrow: { fontSize: 10, letterSpacing: 4, color: "#00f7ff", textTransform: "uppercase", opacity: 0.6, marginBottom: 16 },
    title: { fontFamily: "'Syne', sans-serif", fontSize: 36, fontWeight: 800, color: "#e2edf8", letterSpacing: -1, margin: "0 0 6px" },
    sub: { fontSize: 12, color: "#3a5a6a", letterSpacing: 2, textTransform: "uppercase", marginBottom: 48 },
    divider: { width: "100%", height: 1, background: "rgba(255,255,255,0.05)", margin: "40px 0" },
    label: { fontSize: 10, letterSpacing: 3, color: "#00f7ff", opacity: 0.5, textTransform: "uppercase", marginBottom: 16 },
    lead: { fontFamily: "'Syne', sans-serif", fontSize: 18, fontWeight: 700, color: "#c8ddf0", lineHeight: 1.4, margin: "0 0 20px" },
    p: { fontSize: 12, lineHeight: 2, color: "#5a7a8a", margin: "0 0 12px" },
    hi: { fontSize: 12, lineHeight: 2, color: "#8ab8cc", margin: "0 0 12px" },
    vline: { width: 1, height: 32, background: "linear-gradient(180deg, transparent, rgba(0,247,255,0.25), transparent)", margin: "24px 0" },
    sigilName: { fontFamily: "'Syne', sans-serif", fontSize: 24, fontWeight: 800, color: "#e2edf8", letterSpacing: -0.5, margin: "0 0 4px" },
    closing: { fontFamily: "'Syne', sans-serif", fontSize: 15, fontWeight: 700, color: "#8ab8cc", lineHeight: 1.5, margin: "20px 0 12px" },
    welcome: { fontSize: 11, color: "#00f7ff", opacity: 0.5, letterSpacing: 2, marginBottom: 28 },
  };

  const listItem: React.CSSProperties = { fontSize: 12, color: "#5a7a8a", padding: "10px 0", borderBottom: "1px solid rgba(255,255,255,0.04)", display: "flex", gap: 10, lineHeight: 1.7, listStyle: "none" };

  return (
    <div style={styles.wrap}>
      <div style={styles.eyebrow}>Manifesto · 2026</div>
      <div style={styles.title}>SOL<span style={{ color: "#00f7ff", opacity: 0.8 }}>CHAT</span></div>
      <div style={styles.sub}>A Social Layer Built For Crypto</div>
      <div style={styles.divider} />

      <div style={styles.label}>The Problem</div>
      <div style={styles.lead}>Our conversations live on platforms never designed for this world.</div>
      <p style={styles.p}>Crypto moves fast. Markets react in seconds. Communities form overnight. Yet when it's time to talk, coordinate, and react — we leave the surface.</p>
      <p style={styles.hi}>Solchat exists to close that gap.</p>
      <div style={styles.vline} />

      <div style={styles.label}>Why It Matters</div>
      <div style={styles.lead}>The internet was not built for sovereign identity.</div>
      <ul style={{ padding: 0, margin: "16px 0 20px" }}>
        {["Not built for transparent liquidity", "Not built for real-time global coordination", "Not built for permissionless, trustless communication"].map((item, i) => (
          <li key={i} style={listItem}><span style={{ color: "#00f7ff", opacity: 0.4, flexShrink: 0 }}>—</span>{item}</li>
        ))}
      </ul>
      <p style={styles.p}>Crypto rebuilt the financial layer. Now it's time to rebuild the social one.</p>
      <p style={styles.hi}>Culture is not an afterthought. It is infrastructure.</p>
      <div style={styles.vline} />

      <div style={styles.label}>What We're Building</div>
      <div style={styles.lead}>Something native to crypto.</div>
      <ul style={{ padding: 0, margin: "16px 0 20px" }}>
        {["A shared surface for builders, traders, creators, and communities", "Conversation that moves as fast as liquidity", "Attention expressed, not extracted"].map((item, i) => (
          <li key={i} style={listItem}><span style={{ color: "#00f7ff", opacity: 0.4, flexShrink: 0 }}>—</span>{item}</li>
        ))}
      </ul>
      <p style={styles.p}>Not replacing existing platforms. Creating something aligned with the world we are building.</p>
      <div style={styles.divider} />

      <div style={styles.label}>Origin Signal</div>
      <div style={styles.sigilName}>NULL <span style={{ color: "#00f7ff" }}>SIGIL</span></div>
      <p style={{ ...styles.p, marginTop: 12 }}>Before networks scale, they begin as signals. Null Sigil marks the first signal of Solchat's cultural layer. Not hype. Not noise. An early imprint on a new surface.</p>
      <div style={styles.vline} />

      <div style={styles.closing}>Crypto does not need another social app.<br />It needs a social layer.</div>
      <div style={styles.welcome}>// Welcome to the surface.</div>
      <button
        onClick={() => navigate("/chat")}
        style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 20px", background: "transparent", border: "1px solid rgba(0,247,255,0.3)", color: "#00f7ff", fontFamily: "'Space Mono', monospace", fontSize: 11, letterSpacing: 2, textTransform: "uppercase", cursor: "pointer" }}
      >
        Enter the feed →
      </button>
    </div>
  );
}