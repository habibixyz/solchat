import { useEffect, useState } from "react";
import Feed from "./ChatWindow";
import Composer from "./MessageInput";
import ProfilePage from "./ProfilePage";

/* ---------- Types ---------- */
type Message = {
  user: string;
  text: string;
  time: number;
};

type Profile = {
  name: string;
  bio: string;
};

/* ---------- Component ---------- */
export default function ChatLayout() {
  /* ---------- Profile ---------- */
  const [profile, setProfile] = useState<Profile>(() => {
    const saved = localStorage.getItem("solchat_profile");
    return saved
      ? JSON.parse(saved)
      : { name: `guest${Math.floor(Math.random() * 9000)}`, bio: "" };
  });

  /* ---------- Messages ---------- */
  const [messages, setMessages] = useState<Message[]>(() => {
    const saved = localStorage.getItem("solchat_messages");
    return saved ? JSON.parse(saved) : [];
  });

  /* ---------- Navigation ---------- */
  const [activeUser, setActiveUser] = useState<string | null>(null);

  /* ---------- Persist ---------- */
  useEffect(() => {
    localStorage.setItem("solchat_profile", JSON.stringify(profile));
  }, [profile]);

  useEffect(() => {
    localStorage.setItem("solchat_messages", JSON.stringify(messages));
  }, [messages]);

  /* ---------- Handlers ---------- */
  const onPost = (text: string) => {
    if (!text.trim()) return;

    setMessages((prev) => [
      ...prev,
      {
        user: profile.name,
        text,
        time: Date.now(),
      },
    ]);
  };

  const onUserClick = (username: string) => {
    setActiveUser(username);
  };

  const goBack = () => setActiveUser(null);

  /* ---------- Render ---------- */
  return (
    <main style={styles.main}>
      {activeUser ? (
        <ProfilePage
          username={activeUser}
          profile={profile}
          setProfile={setProfile}
          goBack={goBack}
        />
      ) : (
        <>
          <div style={styles.brand}>
            <div style={styles.logo}>Solchat</div>
            <div style={styles.tagline}>lets create value</div>
          </div>

          <Composer onPost={onPost} />

          <Feed messages={messages} onUserClick={onUserClick} />
        </>
      )}
    </main>
  );
}

/* ---------- Styles ---------- */
const styles: any = {
  main: {
    maxWidth: 720,
    margin: "0 auto",
    padding: 24,
    minHeight: "100vh",
    color: "white",
  },

  brand: {
    marginBottom: 20,
  },

  logo: {
    fontSize: 28,
    fontWeight: 800,
    background: "linear-gradient(90deg,#8b5cf6,#22d3ee)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
  },

  tagline: {
    fontSize: 12,
    color: "#9ca3af",
    marginTop: 4,
  },
};