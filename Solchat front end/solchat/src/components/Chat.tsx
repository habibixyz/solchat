export default function Chat() {
  return (
    <div style={{
      flex: 1,
      padding: "20px",
      width: "100%",
      maxWidth: "800px",
      margin: "0 auto"
    }}>
      <div style={{
        border: "1px solid #22d3ee",
        padding: "16px",
        height: "300px",
        overflowY: "auto",
        marginBottom: "12px"
      }}>
        <p><b>User1:</b> gm 🚀</p>
        <p><b>User2:</b> solana looks strong 👀</p>
      </div>

      <input
        placeholder="Type your message..."
        style={{
          width: "100%",
          padding: "12px",
          background: "black",
          border: "1px solid #22d3ee",
          color: "#22d3ee"
        }}
      />
    </div>
  )
}
