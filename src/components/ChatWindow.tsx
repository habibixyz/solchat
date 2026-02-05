type Message = {
  user: string;
  text: string;
  time: number;
};

export default function Feed({
  messages = [],
  onUserClick,
}: {
  messages?: Message[];
  onUserClick: (user: string) => void;
}) {
  return (
    <div style={styles.feed}>
      {messages.length === 0 && (
        <div style={styles.empty}>No posts yet 👀</div>
      )}

      {messages.map((msg, i) => (
        <div
  key={i}
  style={styles.card}
  onMouseEnter={(e) =>
    (e.currentTarget.style.border = "1px solid #4338ca")
  }
  onMouseLeave={(e) =>
    (e.currentTarget.style.border = "1px solid transparent")
  }
>

          <div style={styles.header}>
            <span
              style={styles.username}
              onClick={() => onUserClick(msg.user)}
            >
              {msg.user}
            </span>

            <span style={styles.time}>
              {new Date(msg.time).toLocaleTimeString()}
            </span>
          </div>

          <div style={styles.body}>{msg.text}</div>
        </div>
      ))}
    </div>
  );
}

const styles: any = {
  feed: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  card: {
  background: "#111827",
  borderRadius: 14,
  padding: 14,
  transition: "all 0.2s ease",
  border: "1px solid transparent",
},
  header: {
    display: "flex",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  username: {
    fontWeight: 600,
    color: "#818cf8",
    cursor: "pointer",
  },
  time: {
    fontSize: 12,
    color: "#6b7280",
  },
  body: {
    color: "#e5e7eb",
    wordBreak: "break-word",
    overflowWrap: "anywhere",
    lineHeight: 1.5,
  },
  empty: {
    color: "#6b7280",
    textAlign: "center",
    marginTop: 40,
  },
};

