import { useEffect, useState } from "react";

export default function DiscoverPage() {

  const [tokens,setTokens] = useState([]);
  const [selected,setSelected] = useState(null);

  useEffect(()=>{

    fetch("http://localhost:4000/pairs")
      .then(r=>r.json())
      .then(data=>{
        setTokens(data);
        setSelected(data[0]);
      });

  },[]);

  return (

    <div className="discover-layout">

      {/* LEFT TOKEN LIST */}

      <div className="discover-left">

        <div style={{padding:16,fontWeight:600}}>
          SolScreener
        </div>

        {tokens.map((t,i)=>(

          <div
            key={i}
            style={{
              padding:12,
              borderBottom:"1px solid rgba(255,255,255,0.03)",
              cursor:"pointer"
            }}
            onClick={()=>setSelected(t)}
          >

            <div>{t.pair}</div>

            <div style={{fontSize:12,opacity:.6}}>
              ${Number(t.price).toFixed(6)}
            </div>

          </div>

        ))}

      </div>

      {/* CENTER CHART */}

      <div className="discover-center">

        {selected && (

          <div style={{padding:20}}>

            <h2 style={{marginBottom:10}}>
              {selected.pair}
            </h2>

            <iframe
              src={`https://dexscreener.com/solana/${selected.address}?embed=1&theme=dark`}
              width="100%"
              height="500"
              frameBorder="0"
            />

          </div>

        )}

      </div>

      {/* RIGHT INFO */}

      <div className="discover-right">

        {selected && (

          <div style={{padding:20}}>

            <h3>Token Info</h3>

            <div style={{marginTop:10}}>
              Price: ${Number(selected.price).toFixed(6)}
            </div>

            <div>
              Liquidity: ${Number(selected.liquidity).toLocaleString()}
            </div>

            <div>
              Volume 24h: ${Number(selected.volume24h).toLocaleString()}
            </div>

          </div>

        )}

      </div>

    </div>

  );
} 