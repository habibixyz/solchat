import { useNavigate } from "react-router-dom";

const mono = "'IBM Plex Mono','Space Mono',monospace";
const sans = "'DM Sans','Inter',sans-serif";

const C = {
  bg: "#08090b",
  panel: "rgba(5, 5, 7, 0.78)",
  panelSoft: "rgba(255,255,255,0.025)",
  border: "#16181c",
  accent: "#1d9e75",
  gold: "#e1b84b",
  text: "#e7e9ea",
  textMid: "#a4adb5",
  textDim: "#71767b",
};

const rewardSteps = [
  {
    label: "Open Tanvir's Bullpen",
    body: "Start at the official Bullpen profile and check the newest reward tasks, posts, or quests before acting.",
  },
  {
    label: "Bring the signal back",
    body: "Share useful context in Solchat so other builders can coordinate, ask questions, and move faster together.",
  },
  {
    label: "Earn through consistency",
    body: "Focus on real contributions: replies, referrals, social proof, token research, and helpful community action.",
  },
];

const rewardTips = [
  "Keep your wallet connected before joining reward flows.",
  "Use the same social identity where possible so your activity is easy to verify.",
  "Post proof only when the campaign asks for it.",
  "Avoid spam. Higher quality participation is easier to reward and easier to trust.",
];

export default function BullpenPage() {
  const navigate = useNavigate();

  return (
    <div
      style={{
        minHeight: "calc(100vh - 52px)",
        width: "100%",
        background: C.bg,
        color: C.text,
        fontFamily: sans,
        overflowY: "auto",
      }}
    >
      <div style={{ maxWidth: 1120, margin: "0 auto", padding: "28px 18px 96px" }}>
        <section
          style={{
            border: `1px solid ${C.border}`,
            borderRadius: 16,
            background:
              "linear-gradient(135deg, rgba(29,158,117,0.16), rgba(5,5,7,0.9) 52%, rgba(225,184,75,0.08))",
            padding: "clamp(20px, 4vw, 42px)",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: 24,
            alignItems: "center",
          }}
        >
          <div>
            <div
              style={{
                color: C.accent,
                fontFamily: mono,
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: 2,
                textTransform: "uppercase",
                marginBottom: 12,
              }}
            >
              Solchat rewards route
            </div>
            <h1
              style={{
                margin: 0,
                color: "#fff",
                fontSize: "clamp(30px, 7vw, 64px)",
                lineHeight: 0.96,
                fontWeight: 900,
                letterSpacing: 0,
              }}
            >
              Tanvir Bullpen
            </h1>
            <p
              style={{
                margin: "18px 0 0",
                color: C.textMid,
                fontSize: 16,
                lineHeight: 1.75,
                maxWidth: 620,
              }}
            >
              A focused hub for Solchat users who want to follow Tanvir's
              Bullpen profile, find reward opportunities, and turn community
              activity into visible, useful contribution.
            </p>

            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 24 }}>
              <a
                href="https://bullpen.fi/@tanvir"
                target="_blank"
                rel="noreferrer"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  minHeight: 42,
                  padding: "0 18px",
                  borderRadius: 8,
                  background: C.accent,
                  border: `1px solid ${C.accent}`,
                  color: "#fff",
                  textDecoration: "none",
                  fontFamily: mono,
                  fontSize: 12,
                  fontWeight: 800,
                  letterSpacing: 1,
                  textTransform: "uppercase",
                }}
              >
                Open Bullpen
              </a>
              <button
                onClick={() => navigate("/")}
                style={{
                  minHeight: 42,
                  padding: "0 18px",
                  borderRadius: 8,
                  background: "transparent",
                  border: "1px solid rgba(255,255,255,0.14)",
                  color: C.text,
                  cursor: "pointer",
                  fontFamily: mono,
                  fontSize: 12,
                  fontWeight: 800,
                  letterSpacing: 1,
                  textTransform: "uppercase",
                }}
              >
                Back to chat
              </button>
            </div>
          </div>

          <div
            style={{
              border: "1px solid rgba(29,158,117,0.25)",
              borderRadius: 14,
              background: "rgba(0,0,0,0.35)",
              padding: 18,
            }}
          >
            <div style={{ fontFamily: mono, color: C.textDim, fontSize: 11, marginBottom: 8 }}>
              PROFILE
            </div>
            <div style={{ fontSize: 22, fontWeight: 850, color: "#fff" }}>@tanvir</div>
            <div style={{ fontFamily: mono, color: C.accent, fontSize: 12, marginTop: 6 }}>
              bullpen.fi/@tanvir
            </div>
            <div style={{ height: 1, background: "rgba(255,255,255,0.08)", margin: "18px 0" }} />
            <div style={{ display: "grid", gap: 10 }}>
              {["Rewards", "Community tasks", "Solchat coordination"].map((item) => (
                <div
                  key={item}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 12,
                    padding: "10px 12px",
                    borderRadius: 8,
                    background: C.panelSoft,
                    border: `1px solid ${C.border}`,
                    color: C.textMid,
                    fontSize: 13,
                  }}
                >
                  <span>{item}</span>
                  <span style={{ color: C.gold, fontFamily: mono }}>ACTIVE</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: 14,
            marginTop: 18,
          }}
        >
          {rewardSteps.map((step, index) => (
            <article
              key={step.label}
              style={{
                background: C.panel,
                border: `1px solid ${C.border}`,
                borderRadius: 12,
                padding: 18,
              }}
            >
              <div style={{ color: C.accent, fontFamily: mono, fontSize: 11, fontWeight: 800 }}>
                0{index + 1}
              </div>
              <h2 style={{ margin: "10px 0 8px", color: "#fff", fontSize: 18 }}>
                {step.label}
              </h2>
              <p style={{ margin: 0, color: C.textDim, lineHeight: 1.65, fontSize: 14 }}>
                {step.body}
              </p>
            </article>
          ))}
        </section>

        <section
          style={{
            marginTop: 18,
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: 18,
          }}
        >
          <div
            style={{
              background: C.panel,
              border: `1px solid ${C.border}`,
              borderRadius: 12,
              padding: 20,
            }}
          >
            <div style={{ color: C.accent, fontFamily: mono, fontSize: 11, letterSpacing: 2 }}>
              MAXIMISE REWARDS
            </div>
            <h2 style={{ margin: "10px 0 12px", color: "#fff", fontSize: 24 }}>
              Make every action easy to verify.
            </h2>
            <p style={{ margin: 0, color: C.textMid, lineHeight: 1.75, fontSize: 15 }}>
              Rewards usually favor clear participation. Keep your Bullpen
              activity connected to a recognizable identity, bring useful
              updates back into Solchat, and avoid low-effort noise. The best
              path is simple: follow the campaign instructions, add context,
              help others participate, and keep proof organized.
            </p>
          </div>

          <div
            style={{
              background: C.panel,
              border: `1px solid ${C.border}`,
              borderRadius: 12,
              padding: 20,
            }}
          >
            <div style={{ color: C.gold, fontFamily: mono, fontSize: 11, letterSpacing: 2 }}>
              QUICK CHECKLIST
            </div>
            <div style={{ display: "grid", gap: 10, marginTop: 14 }}>
              {rewardTips.map((tip) => (
                <div
                  key={tip}
                  style={{
                    padding: "10px 0",
                    borderBottom: "1px solid rgba(255,255,255,0.06)",
                    color: C.textDim,
                    fontSize: 13,
                    lineHeight: 1.55,
                  }}
                >
                  {tip}
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
