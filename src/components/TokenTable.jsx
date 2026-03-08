import { useEffect, useState } from "react";
import TokenRow from "./TokenRow";
import { getPools } from "../lib/geckoApi";

export default function TokenTable({ onSelect }) {

  const [tokens, setTokens] = useState([]);

  useEffect(() => {
    loadTokens();
  }, []);

  async function loadTokens() {
    const pools = await getPools(1);
    setTokens(pools);
  }

  return (
    <div>

      {tokens.map((token) => (
        <TokenRow
          key={token.id}
          token={token}
          onClick={() => onSelect(token)}
        />
      ))}

    </div>
  );
}