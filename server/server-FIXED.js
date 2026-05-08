import express from "express";
import fetch from "node-fetch";
import cors from "cors";

const app = express();
app.use(cors());

const BASE = "https://api.geckoterminal.com/api/v2/networks/solana";

async function getPage(page){

  const r = await fetch(
    `${BASE}/pools?page=${page}&order=h24_volume_usd_desc`
  );

  const j = await r.json();

  return j.data || [];

}

app.get("/pairs", async (req,res)=>{

  try{

    const pages = await Promise.all([
      getPage(1),
      getPage(2),
      getPage(3)
    ]);

    const pools = pages.flat();

    const tokens = pools
      .map(p=>{

        const a = p.attributes;

        return {

          pair: a.name,

          price: Number(a.base_token_price_usd) || 0,

          liquidity: Number(a.reserve_in_usd) || 0,

          volume24h: Number(a.volume_usd?.h24) || 0,

          address: p.id.split("_")[1]

        };

      })

      .filter(t =>
        t.pair &&
        t.pair.includes("/") &&
        t.liquidity > 50000 &&
        t.volume24h > 50000
      )

      .sort((a,b)=>b.volume24h-a.volume24h)

      .slice(0,150);

    res.json(tokens);

  }catch(e){

    console.error(e);
    res.status(500).json({error:"failed"});

  }

});

app.listen(4000,()=>{
  console.log("SolScreener API running on 4000");
});