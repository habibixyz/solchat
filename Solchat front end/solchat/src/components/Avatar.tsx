type Props = {
  avatar: string
  onChange: (a: string) => void
}

const avatars = ["😎", "👽", "🧠", "🔥", "🐸", "🚀", "💎"]

export default function Avatar({ avatar, onChange }: Props) {
  return (
    <div style={{ display: "flex", gap: 10 }}>
      {avatars.map(a => (
        <button
          key={a}
          onClick={() => onChange(a)}
          style={{
            background: "black",
            border: avatar === a ? "2px solid cyan" : "1px solid gray",
            fontSize: "20px",
            cursor: "pointer"
          }}
        >
          {a}
        </button>
      ))}
    </div>
  )
}
