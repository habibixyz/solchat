import { useNavigate, useParams } from "react-router-dom";

// ── Post content ────────────────────────────────────────────────────────────

interface Section {
  type: "h2" | "p" | "quote" | "callout" | "divider";
  text?: string;
  label?: string;
}

interface Post {
  slug: string;
  title: string;
  date: string;
  tag: string;
  readTime: string;
  intro: string;
  sections: Section[];
}

const POSTS: Record<string, Post> = {
  "why-every-crypto-community-needs-a-social-layer": {
    slug: "why-every-crypto-community-needs-a-social-layer",
    title: "Why Every Crypto Community Needs a Social Layer",
    date: "March 24, 2026",
    tag: "VISION",
    readTime: "4 min read",
    intro:
      "Every crypto project has a token. Most have a Discord. Almost none have a social layer that actually belongs to the chain. Here's why that's the missing piece — and why it matters more than most people realize.",
    sections: [
      {
        type: "h2",
        text: "The problem with Discord",
      },
      {
        type: "p",
        text: "When a crypto project launches, the community ends up in a Discord server. This isn't a bad choice — Discord is fast, familiar, and free. But it creates a fundamental mismatch: your community lives on a centralized platform that has no idea who holds your token, who has contributed, or who is actually aligned with the project.",
      },
      {
        type: "p",
        text: "Anyone can join. Anyone can fake conviction. The loudest voices win, not the most committed ones. And when Discord goes down, or bans your server, or changes its algorithm — your community evaporates. You don't own it. You never did.",
      },
      {
        type: "quote",
        text: "The community is the product. But right now, every crypto project is building its product on rented land.",
      },
      {
        type: "h2",
        text: "What a social layer actually means",
      },
      {
        type: "p",
        text: "A social layer isn't just a chat app with a wallet login. It's infrastructure that understands onchain context. It knows who holds what, who has been here since the beginning, who has skin in the game. It lets that context shape the conversation.",
      },
      {
        type: "p",
        text: "Imagine a community where wallet reputation is visible. Where long-term holders have different signal weight than one-day accounts. Where paying to post isn't a tax — it's a proof of alignment. That's a social layer.",
      },
      {
        type: "h2",
        text: "Why Solana is the right place to build it",
      },
      {
        type: "p",
        text: "Speed and cost make or break social applications. A social layer that charges $2 per message or takes 30 seconds to confirm is dead on arrival. Solana's 400ms finality and sub-cent fees mean the blockchain becomes invisible — which is exactly what it needs to be.",
      },
      {
        type: "p",
        text: "When the infrastructure disappears, what's left is the community. That's the goal.",
      },
      {
        type: "callout",
        label: "The Solchat thesis",
        text: "Solchat is building the social layer that Solana communities deserve. Pay-to-post, wallet-native identity, AI oracle, real skin in the game. The conversation belongs on the chain.",
      },
      {
        type: "h2",
        text: "What happens next",
      },
      {
        type: "p",
        text: "The projects that win the next cycle will not be the ones with the best tokenomics or the most VC backing. They'll be the ones with the strongest, most aligned communities. And those communities will need infrastructure that reflects their values — transparent, permissionless, and owned by no one.",
      },
      {
        type: "p",
        text: "That's what a social layer is. And it's what crypto has been missing.",
      },
    ],
  },

  "pay-to-talk-how-skin-in-the-game-kills-crypto-spam": {
    slug: "pay-to-talk-how-skin-in-the-game-kills-crypto-spam",
    title: "Pay-to-Talk: How Skin in the Game Kills Crypto Spam",
    date: "March 24, 2026",
    tag: "PRODUCT",
    readTime: "5 min read",
    intro:
      "0.001 SOL per message sounds trivial. Roughly $0.10-$0.20 depending on the day. But it's not about the money — it's about commitment. When every message costs something, the signal-to-noise ratio changes completely.",
    sections: [
      {
        type: "h2",
        text: "The spam problem is an incentive problem",
      },
      {
        type: "p",
        text: "In every free-to-use crypto community — Twitter, Discord, Telegram — the same pattern plays out. Bots flood the feed. Shillers post hundreds of times a day. Coordinated FUD campaigns run for pennies. The marginal cost of posting is zero, so the rational move is to post infinitely.",
      },
      {
        type: "p",
        text: "Moderation can't keep up. It's a whack-a-mole game where the attackers have infinite resources and the defenders have finite time. The fundamental incentive structure is broken.",
      },
      {
        type: "quote",
        text: "If sending a message is free, the only people who benefit from the price are the spammers.",
      },
      {
        type: "h2",
        text: "What 0.001 SOL actually does",
      },
      {
        type: "p",
        text: "A single message costs 0.001 SOL. For a human having a genuine conversation, this is negligible. Over a month of active posting — say 200 messages — that's 0.2 SOL. Nothing. For a spam bot sending 10,000 messages a day, that's 10 SOL per day. Suddenly the economics of spam collapse.",
      },
      {
        type: "p",
        text: "But the effect goes deeper than economics. When you pay for something, your relationship to it changes. You don't post reflexively. You think for half a second. Is this worth saying? That half-second of friction is the difference between noise and signal.",
      },
      {
        type: "h2",
        text: "Skin in the game as a social norm",
      },
      {
        type: "p",
        text: "Nassim Taleb's concept of skin in the game is about accountability through shared risk. In crypto, it's become almost a meme — but it's a meme that points at something true. When people have real stakes, their behavior changes.",
      },
      {
        type: "p",
        text: "Pay-to-talk is skin in the game applied to communication. Every message on Solchat is a micro-commitment. The sender is saying: I believe this is worth saying enough to pay for it on-chain. That's a fundamentally different posture than a free tweet.",
      },
      {
        type: "callout",
        label: "The math",
        text: "0.001 SOL per message × 10,000 daily spam messages = 10 SOL/day cost to spam. At current prices, a coordinated spam campaign costs $1,500+ per day. The economics of attack become unfavorable.",
      },
      {
        type: "h2",
        text: "What this unlocks",
      },
      {
        type: "p",
        text: "When spam is economically irrational, the feed becomes something rare in crypto: a place where the signal actually comes through. Where the community can have a real conversation without fighting through 90% noise.",
      },
      {
        type: "p",
        text: "That's what Solchat is building. Not another free chat that becomes unusable the moment it gets attention. A communication layer where the cost of entry is the guarantee of quality.",
      },
    ],
  },

  "solana-is-fast-your-community-should-be-too": {
    slug: "solana-is-fast-your-community-should-be-too",
    title: "Solana is Fast. Your Community Should Be Too.",
    date: "March 24, 2026",
    tag: "TECH",
    readTime: "3 min read",
    intro:
      "400ms finality. Sub-cent fees. Tens of thousands of transactions per second. Solana wasn't built for DeFi alone — it was built for exactly this kind of social coordination at the speed of thought.",
    sections: [
      {
        type: "h2",
        text: "Speed is a UX requirement, not a feature",
      },
      {
        type: "p",
        text: "Social applications live or die by feel. A message that takes 3 seconds to confirm doesn't feel like a message — it feels like a transaction. That cognitive overhead kills the experience before it starts. If users are aware of the blockchain, something has gone wrong.",
      },
      {
        type: "p",
        text: "Solana's average confirmation time is under 400 milliseconds. For reference, a human blink takes 150-400ms. The blockchain is operating at the speed of human perception. That's the threshold where infrastructure becomes invisible.",
      },
      {
        type: "quote",
        text: "The best technology disappears. You stop thinking about it and start using it.",
      },
      {
        type: "h2",
        text: "The fee problem on other chains",
      },
      {
        type: "p",
        text: "Building a social application on Ethereum mainnet in 2021 was instructive. Gas fees during high congestion periods made microtransactions — the bread and butter of social interactions — completely impractical. $15 to send a message is not a social layer. It's a toll booth.",
      },
      {
        type: "p",
        text: "On Solana, the average transaction fee is a fraction of a cent. 0.001 SOL per message on Solchat works out to roughly $0.10-$0.20. That's a meaningful economic signal without being a meaningful financial burden. The fee can do its job — filter signal from noise — without pricing out real users.",
      },
      {
        type: "h2",
        text: "What throughput means for communities",
      },
      {
        type: "p",
        text: "Solana processes 65,000+ transactions per second at peak. For social applications, this means the network can handle conversation at scale without degrading. A viral moment — a community rallying around a token launch, a breaking event — won't congest the chain.",
      },
      {
        type: "callout",
        label: "Why it matters",
        text: "Fast chains enable fast communities. When confirmation is instant, the chat feels like chat. When fees are negligible, every interaction can be onchain. When throughput is high, scale is not a ceiling.",
      },
      {
        type: "h2",
        text: "The social layer needs the fastest chain",
      },
      {
        type: "p",
        text: "Communication is real-time by nature. The infrastructure underneath it needs to match that rhythm. Solana does. That's not a marketing claim — it's why Solchat is built here and not anywhere else.",
      },
    ],
  },

  "what-is-a-trust-layer-in-crypto": {
    slug: "what-is-a-trust-layer-in-crypto",
    title: "What is a Trust Layer in Crypto?",
    date: "March 24, 2026",
    tag: "ESSAY",
    readTime: "6 min read",
    intro:
      "In crypto, your wallet is your identity. But right now that identity is anonymous, context-free, and easily gamed. A trust layer changes everything — and it may be the most important infrastructure crypto hasn't built yet.",
    sections: [
      {
        type: "h2",
        text: "The identity problem",
      },
      {
        type: "p",
        text: "When you interact with someone onchain, you know their wallet address. That's it. You know nothing about their history, their reputation, their alignment. A wallet that's been active for 3 years in the Solana ecosystem looks identical to a wallet that was created 20 minutes ago by a shill campaign.",
      },
      {
        type: "p",
        text: "This is a fundamental problem. Trust is the foundation of coordination. Without trust, communities devolve into zero-sum games where the most cynical actors win. Web3 was supposed to solve coordination problems — but without identity infrastructure, it's recreated them.",
      },
      {
        type: "quote",
        text: "Anonymity is not the same as privacy. One hides who you are. The other protects what you do.",
      },
      {
        type: "h2",
        text: "What a trust layer is",
      },
      {
        type: "p",
        text: "A trust layer is infrastructure that creates verifiable context about wallets without requiring them to reveal personal information. It answers questions like: How long has this wallet been active? What protocols have they interacted with? Do they hold skin in this ecosystem? Have they been vouched for by wallets I trust?",
      },
      {
        type: "p",
        text: "Critically, a trust layer is not a KYC system. It doesn't ask for your name or your ID. It reads what's already onchain — transaction history, token holdings, protocol interactions — and derives a reputation signal from that public data.",
      },
      {
        type: "h2",
        text: "Reputation as a public good",
      },
      {
        type: "p",
        text: "The closest analogy is credit scores — but decentralized, permissionless, and not controlled by any institution. Your onchain reputation is your history, made legible. It can be read by anyone, but it cannot be faked without actually doing the work.",
      },
      {
        type: "p",
        text: "This changes the social dynamics of crypto communities dramatically. When reputation is visible, long-term participants have inherently more signal weight. Shill campaigns become harder to execute because new wallets carry no reputation. Quality rises because the people with the most context are the most audible.",
      },
      {
        type: "callout",
        label: "The Solchat approach",
        text: "Solchat's pay-to-post model is the first layer of trust. Every message creates an onchain record. Over time, a wallet's message history — what they said, when they said it, what they were right about — becomes its own form of reputation.",
      },
      {
        type: "h2",
        text: "Why this matters for the next cycle",
      },
      {
        type: "p",
        text: "The 2021-2022 cycle was chaotic in part because no one knew who to trust. Anonymous accounts with no track record could move markets. Project founders could rug and start fresh with a new wallet. Influencers could shill projects they had obvious conflicts of interest with, and no one could verify.",
      },
      {
        type: "p",
        text: "A trust layer doesn't eliminate these problems overnight. But it raises the cost of bad behavior and lowers the cost of finding credible voices. Over time, that's transformative.",
      },
      {
        type: "h2",
        text: "The long game",
      },
      {
        type: "p",
        text: "Trust infrastructure takes time to build. Reputations are earned through consistent behavior over months and years, not minted instantly. The wallets that start building their onchain reputation today — through genuine participation, through real communication, through skin in the game — will have an enormous advantage in every crypto community they touch.",
      },
      {
        type: "p",
        text: "That's the trust layer. And it starts with showing up and saying something real.",
      },
    ],
  },
};

// ── Tag styles ───────────────────────────────────────────────────────────────
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

// ── Section renderer ─────────────────────────────────────────────────────────
function renderSection(section: Section, i: number) {
  switch (section.type) {
    case "h2":
      return (
        <h2 key={i} style={{
          fontSize: "clamp(20px, 2.8vw, 26px)", fontWeight: 700,
          color: "#dde6f0", margin: "48px 0 16px", lineHeight: 1.3,
          letterSpacing: -0.3,
        }}>
          {section.text}
        </h2>
      );
    case "p":
      return (
        <p key={i} style={{
          fontSize: 16, color: "#8899aa", lineHeight: 1.85,
          margin: "0 0 20px",
        }}>
          {section.text}
        </p>
      );
    case "quote":
      return (
        <blockquote key={i} style={{
          margin: "36px 0",
          padding: "20px 28px",
          borderLeft: "3px solid #22d3ee",
          background: "rgba(34,211,238,0.04)",
          borderRadius: "0 8px 8px 0",
        }}>
          <p style={{
            fontSize: 18, color: "#dde6f0", fontStyle: "italic",
            lineHeight: 1.6, margin: 0, fontWeight: 500,
          }}>
            "{section.text}"
          </p>
        </blockquote>
      );
    case "callout":
      return (
        <div key={i} style={{
          margin: "36px 0",
          padding: "20px 24px",
          background: "rgba(34,211,238,0.05)",
          border: "1px solid rgba(34,211,238,0.15)",
          borderRadius: 10,
        }}>
          <div style={{
            fontSize: 9, fontFamily: "'IBM Plex Mono', monospace",
            letterSpacing: 2, color: "#22d3ee", marginBottom: 10,
            fontWeight: 700,
          }}>
            {section.label}
          </div>
          <p style={{
            fontSize: 15, color: "#dde6f0", lineHeight: 1.7, margin: 0,
          }}>
            {section.text}
          </p>
        </div>
      );
    case "divider":
      return (
        <div key={i} style={{
          height: 1, background: "rgba(255,255,255,0.06)",
          margin: "40px 0",
        }} />
      );
    default:
      return null;
  }
}

// ── Component ────────────────────────────────────────────────────────────────
export default function BlogPost() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const post = slug ? POSTS[slug] : null;

  if (!post) {
    return (
      <div style={{
        minHeight: "100vh", background: "#080c14", color: "#dde6f0",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontFamily: "'DM Sans', sans-serif",
      }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.2 }}>⟁</div>
          <p style={{ color: "#8899aa", marginBottom: 24 }}>Post not found.</p>
          <button onClick={() => navigate("/blog")} style={{
            background: "none", border: "1px solid rgba(34,211,238,0.3)",
            borderRadius: 6, color: "#22d3ee", fontFamily: "'IBM Plex Mono', monospace",
            fontSize: 11, letterSpacing: 1, padding: "8px 18px", cursor: "pointer",
          }}>
            ← BACK TO JOURNAL
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: "100vh",
      background: "#080c14",
      fontFamily: "'DM Sans', 'Inter', sans-serif",
      color: "#dde6f0",
    }}>
      {/* Ambient glow */}
      <div style={{
        position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0,
        background: "radial-gradient(ellipse 80% 40% at 50% -5%, rgba(34,211,238,0.05) 0%, transparent 70%)",
      }} />

      <div style={{ position: "relative", zIndex: 1, maxWidth: 680, margin: "0 auto", padding: "64px 24px 120px" }}>

        {/* Back nav */}
        <button
          onClick={() => navigate("/blog")}
          style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            background: "none", border: "none", cursor: "pointer",
            color: "#3a4d62", fontFamily: "'IBM Plex Mono', monospace",
            fontSize: 11, letterSpacing: 1, padding: 0, marginBottom: 48,
            transition: "color 0.15s",
          }}
          onMouseOver={e => (e.currentTarget.style.color = "#22d3ee")}
          onMouseOut={e => (e.currentTarget.style.color = "#3a4d62")}
        >
          ← JOURNAL
        </button>

        {/* Meta */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 24 }}>
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
            {post.date} · {post.readTime}
          </span>
        </div>

        {/* Title */}
        <h1 style={{
          fontSize: "clamp(28px, 4.5vw, 44px)",
          fontWeight: 800,
          lineHeight: 1.15,
          color: "#fff",
          margin: "0 0 28px",
          letterSpacing: -1,
        }}>
          {post.title}
        </h1>

        {/* Intro */}
        <p style={{
          fontSize: 18, color: "#aab8c8", lineHeight: 1.75,
          margin: "0 0 48px", fontWeight: 400,
        }}>
          {post.intro}
        </p>

        {/* Divider */}
        <div style={{
          height: 1, background: "rgba(255,255,255,0.06)",
          margin: "0 0 8px",
        }} />

        {/* Body */}
        <div style={{ paddingTop: 8 }}>
          {post.sections.map((s, i) => renderSection(s, i))}
        </div>

        {/* Footer */}
        <div style={{
          marginTop: 80,
          padding: "32px 0 0",
          borderTop: "1px solid rgba(255,255,255,0.06)",
        }}>
          <div style={{ marginBottom: 32 }}>
            <div style={{
              fontSize: 11, fontFamily: "'IBM Plex Mono', monospace",
              letterSpacing: 2, color: "#3a4d62", marginBottom: 10,
            }}>
              WRITTEN BY
            </div>
            <div style={{ fontSize: 14, color: "#8899aa" }}>
              <span style={{ color: "#dde6f0", fontWeight: 600 }}>Tanvir</span>
              {" · "}Building Solchat · Solana social infrastructure
            </div>
          </div>

          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <button onClick={() => navigate("/blog")} style={{
              background: "none", border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 6, color: "#8899aa", fontFamily: "'IBM Plex Mono', monospace",
              fontSize: 11, letterSpacing: 1, padding: "8px 18px", cursor: "pointer",
            }}>
              ← ALL POSTS
            </button>
            <button onClick={() => navigate("/")} style={{
              background: "rgba(34,211,238,0.08)",
              border: "1px solid rgba(34,211,238,0.25)",
              borderRadius: 6, color: "#22d3ee", fontFamily: "'IBM Plex Mono', monospace",
              fontSize: 11, letterSpacing: 1, padding: "8px 18px", cursor: "pointer",
            }}>
              ENTER SOLCHAT →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
