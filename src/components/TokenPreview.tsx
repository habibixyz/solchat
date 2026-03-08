import PriceChart from "./PriceChart";
import TransactionList from "./TransactionList";

export default function TokenPreview({ token }) {

  if (!token) {
    return <div style={{padding:"20px"}}>Select a token</div>;
  }

  const a = token.attributes;

  return (
    <div style={{padding:"20px"}}>

      <h2>{a.name}</h2>

      <div style={{marginBottom:"10px"}}>
        Price: ${a.base_token_price_usd}
      </div>

      <div style={{marginBottom:"10px"}}>
        Liquidity: ${a.reserve_in_usd}
      </div>

      <div style={{marginBottom:"20px"}}>
        Volume 24h: ${a.volume_usd.h24}
      </div>

      <PriceChart pool={token} />

      <TransactionList pool={token} />

    </div>
  );
}