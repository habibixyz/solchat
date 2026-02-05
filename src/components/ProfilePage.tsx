import { useState } from "react";

type Profile = {
  name: string;
  bio: string;
};

type Props = {
  username: string;
  profile: Profile;
  setProfile: (p: Profile) => void;
  goBack: () => void;
};

export default function ProfilePage({
  profile,
  setProfile,
  goBack,
}: Props) {
  const [name, setName] = useState(profile.name);
  const [bio, setBio] = useState(profile.bio);

  const saveProfile = () => {
    if (!name.trim()) return;

    setProfile({
      name: name.trim(),
      bio: bio.trim(),
    });

    goBack(); // 🔥 THIS WAS MISSING
  };

  return (
    <div style={styles.wrap}>
      <button style={styles.back} onClick={goBack}>
        ← Back
      </button>

      <div style={styles.avatar}>
        {name.charAt(0).toUpperCase()}
      </div>

      <h2 style={styles.name}>{name}</h2>

      <input
        style={styles.input}
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Display name"
      />

      <textarea
        style={styles.textarea}
        value={bio}
        onChange={(e) => setBio(e.target.value)}
        placeholder="Your bio"
      />

      <button style={styles.save} onClick={saveProfile}>
        Save profile
      </button>
    </div>
  );
}

/* ---------- Styles ---------- */
const styles: any = {
  wrap: {
    maxWidth: 420,
    margin: "40px auto",
    display: "flex",
    flexDirection: "column",
    gap: 14,
    textAlign: "center",
  },

  back: {
    alignSelf: "flex-start",
    background: "none",
    border: "none",
    color: "#93c5fd",
    cursor: "pointer",
  },

  avatar: {
    width: 72,
    height: 72,
    borderRadius: "50%",
    background: "linear-gradient(135deg,#8b5cf6,#22d3ee)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 32,
    fontWeight: 700,
    margin: "0 auto",
  },

  name: {
    margin: 0,
  },

  input: {
    padding: 10,
    borderRadius: 10,
    border: "1px solid #1f2937",
    background: "#020617",
    color: "white",
  },

  textarea: {
    padding: 10,
    borderRadius: 10,
    border: "1px solid #1f2937",
    background: "#020617",
    color: "white",
    minHeight: 80,
  },

  save: {
    marginTop: 10,
    padding: "10px 16px",
    borderRadius: 999,
    border: "none",
    background: "linear-gradient(90deg,#8b5cf6,#22d3ee)",
    color: "white",
    fontWeight: 600,
    cursor: "pointer",
  },
};

