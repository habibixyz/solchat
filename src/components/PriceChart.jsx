import { useEffect, useRef } from "react";

export default function PriceChart({ pool }) {

  const ref = useRef(null);

  useEffect(() => {

    if (!pool) return;

    const pair = pool.attributes.address;

    ref.current.innerHTML = "";

    const script = document.createElement("script");

    script.src =
      "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";

    script.type = "text/javascript";

    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol: `DEXSCREENER:${pair}`,
      interval: "5",
      theme: "dark",
      style: "1",
      locale: "en"
    });

    ref.current.appendChild(script);

  }, [pool]);

  return (
    <div
      ref={ref}
      style={{height:"400px"}}
    />
  );
}