import { useNavigate } from "react-router-dom";

const POSTS = [
  {
    slug: "why-every-crypto-community-needs-a-social-layer",
    title: "Why Every Crypto Community Needs a Social Layer",
    date: "March 24, 2026",
    tag: "VISION",
    readTime: "4 min read",
    excerpt:
      "Every crypto project has a token. Most have a Discord. Almost none have a social layer that actually belongs to the chain. Here's why that's the missing piece.",
  },
  {
    slug: "pay-to-talk-how-skin-in-the-game-kills-crypto-spam",
    title: "Pay-to-Talk: How Skin in the Game Kills Crypto Spam",
    date: "March 24, 2026",
    tag: "PRODUCT",
    readTime: "5 min read",
    excerpt:
      "0.001 SOL per message sounds trivial. But it's not about the money — it's about commitment. When every message costs something, the signal-to-noise ratio changes completely.",
  },
  {
    slug: "solana-is-fast-your-community-should-be-too",
    title: "Solana is Fast. Your Community Should Be Too.",
    date: "March 24, 2026",
    tag: "TECH",
    readTime: "3 min read",
    excerpt:
      "400ms finality. Sub-cent fees. Tens of thousands of transactions per second. Solana wasn't built for DeFi alone — it was built for exactly this kind of social coordination.",
  },
  {
    slug: "what-is-a-trust-layer-in-crypto",
    title: "What is a Trust Layer in Crypto?",
    date: "March 24, 2026",
    tag: "ESSAY",
    readTime: "6 min read",
    excerpt:
      "In crypto, your wallet is your identity. But right now that identity is anonymous, context-free, and easily gamed. A trust layer changes everything.",
  },
];

const TAG_COLORS: Record<string, string> = {
  VISION:  "rgba(34,211,238,0.12)",
  PRODUCT: "rgba(34,197,94,0.12)",
  TECH:    "rgba(139,92,246,0.12)",
  ESSAY:   "rgba(245,158,11,0.12)",
};
const TAG_TEXT: Record<string, string> = {
  VISION:  "#22d3ee",
  PRODUCT: "#22c55e",
  TECH:    "#a78bfa",
  ESSAY:   "#f59e0b",
};

export default function Blog() {
  const navigate = useNavigate();

  return (
    <div style={{
      minHeight: "100vh",
      background: "#080c14",
      fontFamily: "'DM Sans', 'Inter', sans-serif",
      color: "#dde6f0",
    }}>
      {/* Ambient background glow */}
      <div style={{
        position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0,
        background: "radial-gradient(ellipse 80% 50% at 50% -10%, rgba(34,211,238,0.06) 0%, transparent 70%)",
      }} />

      <div style={{ position: "relative", zIndex: 1, maxWidth: 760, margin: "0 auto", padding: "80px 24px 120px" }}>

        {/* Header */}
        <div style={{ marginBottom: 64 }}>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            fontSize: 11, fontFamily: "'IBM Plex Mono', monospace",
            letterSpacing: 3, color: "#22d3ee", opacity: 0.7,
            marginBottom: 20,
          }}>
            <span style={{ display: "inline-block", width: 20, height: 1, background: "#22d3ee", opacity: 0.5 }} />
            SOLCHAT JOURNAL
          </div>

          <h1 style={{
            fontSize: "clamp(32px, 5vw, 52px)",
            fontWeight: 800,
            lineHeight: 1.1,
            color: "#fff",
            margin: "0 0 16px",
            letterSpacing: -1.5,
          }}>
            Thoughts on the<br />
            <span style={{ color: "#22d3ee" }}>onchain social layer.</span>
          </h1>

          <p style={{
            fontSize: 16, color: "#8899aa", lineHeight: 1.7, margin: 0,
            maxWidth: 480,
          }}>
            Essays on communication, trust, and what crypto-native social actually means.
          </p>
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: "rgba(255,255,255,0.06)", marginBottom: 48 }} />

        {/* Post list */}
        <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
          {POSTS.map((post, i) => (
            <article
              key={post.slug}
              onClick={() => navigate(`/blog/${post.slug}`)}
              style={{
                padding: "32px 0",
                borderBottom: i < POSTS.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none",
                cursor: "pointer",
                transition: "all 0.15s",
              }}
              onMouseOver={e => {
                (e.currentTarget as HTMLElement).style.paddingLeft = "12px";
                (e.currentTarget as HTMLElement).style.borderLeft = "2px solid #22d3ee";
              }}
              onMouseOut={e => {
                (e.currentTarget as HTMLElement).style.paddingLeft = "0";
                (e.currentTarget as HTMLElement).style.borderLeft = "2px solid transparent";
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                <span style={{
                  fontSize: 9, fontFamily: "'IBM Plex Mono', monospace", fontWeight: 700,
                  letterSpacing: 2, padding: "3px 8px", borderRadius: 4,
                  background: TAG_COLORS[post.tag] || "rgba(255,255,255,0.06)",
                  color: TAG_TEXT[post.tag] || "#8899aa",
                  border: `1px solid ${TAG_TEXT[post.tag] || "#8899aa"}22`,
                }}>
                  {post.tag}
                </span>
                <span style={{ fontSize: 11, color: "#3a4d62", fontFamily: "'IBM Plex Mono', monospace" }}>
                  {post.date}
                </span>
                <span style={{ fontSize: 11, color: "#3a4d62", fontFamily: "'IBM Plex Mono', monospace" }}>
                  · {post.readTime}
                </span>
              </div>

              <h2 style={{
                fontSize: "clamp(18px, 2.5vw, 22px)",
                fontWeight: 700,
                color: "#dde6f0",
                margin: "0 0 10px",
                lineHeight: 1.3,
                letterSpacing: -0.3,
              }}>
                {post.title}
              </h2>

              <p style={{
                fontSize: 14, color: "#8899aa", lineHeight: 1.7,
                margin: "0 0 16px", maxWidth: 600,
              }}>
                {post.excerpt}
              </p>

              <span style={{
                fontSize: 12, color: "#22d3ee", fontFamily: "'IBM Plex Mono', monospace",
                letterSpacing: 1, display: "inline-flex", alignItems: "center", gap: 6,
              }}>
                READ →
              </span>
            </article>
          ))}
        </div>

        {/* Footer note */}
        <div style={{
          marginTop: 80, padding: "24px 0", borderTop: "1px solid rgba(255,255,255,0.05)",
          display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12,
        }}>
          <span style={{ fontSize: 12, color: "#3a4d62", fontFamily: "'IBM Plex Mono', monospace" }}>
            SOLCHAT.FUN · BUILT ON SOLANA
          </span>
          <button
            onClick={() => navigate("/")}
            style={{
              background: "none", border: "1px solid rgba(34,211,238,0.2)", borderRadius: 6,
              color: "#22d3ee", fontFamily: "'IBM Plex Mono', monospace", fontSize: 11,
              letterSpacing: 1, padding: "6px 14px", cursor: "pointer",
            }}
          >
            ← BACK TO CHAT
          </button>
        </div>
      </div>
    </div>
  );
}

