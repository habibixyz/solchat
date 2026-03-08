import { useEffect, useState } from "react";
import { getPools } from "../services/geckoApi";

export default function TokenList({ onSelect }) {

  const [tokens, setTokens] = useState([]);

  useEffect(() => {
    load();
  }, []);

  const load = async () => {

    const pools = await getPools(1);

    setTokens(pools.slice(0, 40));
  };

  return (
    <div>

      {tokens.map((t) => {

        const attr = t.attributes;

        return (
          <div
            key={t.id}
            className="token-row"
            onClick={() => onSelect(t)}
          >

            <div>
              {attr.name}
            </div>

            <div>
              ${Number(attr.base_token_price_usd).toFixed(6)}
            </div>

          </div>
        );
      })}
    </div>
  );
}