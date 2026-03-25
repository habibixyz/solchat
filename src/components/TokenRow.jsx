export default function TokenRow({ token, onClick }) {

  const pair = token.pair;

  const name = pair?.baseToken?.name || "Unknown";
  const symbol = pair?.baseToken?.symbol || "";
  const price = Number(pair?.priceUsd || 0);
  const volume = Number(pair?.volume?.h24 || 0);
  const mcap = Number(pair?.marketCap || 0);

  return (
    <div
      onClick={onClick}
      style={{
        padding: "12px",
        borderBottom: "1px solid rgba(255,255,255,0.05)",
        cursor: "pointer",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center"
      }}
    >

      {/* LEFT */}
      <div>
        <div style={{ fontWeight: "600" }}>
          {name} ({symbol})
        </div>

        <div style={{ fontSize: "12px", opacity: 0.7 }}>
          MCAP: ${mcap.toLocaleString()}
        </div>
      </div>

      {/* RIGHT */}
      <div style={{ textAlign: "right" }}>
        <div style={{ fontWeight: "600" }}>
          ${price.toFixed(6)}
        </div>

        <div style={{ fontSize: "12px", opacity: 0.7 }}>
          Vol: ${volume.toLocaleString()}
        </div>
      </div>

    </div>
  );
}