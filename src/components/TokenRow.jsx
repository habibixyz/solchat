export default function TokenRow({ token, onClick }) {

  const a = token.attributes;

  return (
    <div
      onClick={onClick}
      style={{
        padding: "10px",
        borderBottom: "1px solid rgba(255,255,255,0.05)",
        cursor: "pointer"
      }}
    >

      <div style={{fontWeight:"600"}}>
        {a.name}
      </div>

      <div style={{fontSize:"12px",opacity:0.7}}>
        ${Number(a.base_token_price_usd).toFixed(6)}
      </div>

    </div>
  );
}