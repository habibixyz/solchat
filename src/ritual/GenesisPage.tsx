import useMintCountdown from "../utils/useMintCountdown";

function GenesisPage() {

  const countdown = useMintCountdown();

  return (

    <div className="mint-page">

       {/* giant sigil */}
      <div className="ritual-sigil"></div>

      <div className="mint-card">

        <h1 className="mint-title">NULL SIGIL</h1>

        <p className="mint-sub">
          The first signal precedes the system.
        </p>

      <div className="sigil-loader">

  <span>⟁</span>
  <span>⟁</span>
  <span>⟁</span>

</div>

<p className="mint-countdown">
  Sigil Awakening {countdown === "Loading..." ? "Soon" : countdown}
</p>

        

        <div className="mint-info">

          <span>Supply: 1000</span>
          <span>Public Mint: 900</span>
          <span>Price: FREE</span>
          <span>Max per wallet: 2</span>

        </div>

        <button
          className="mint-button"
          disabled={countdown !== "Mint Live"}
        >

          {countdown === "Mint Live"
            ? "SUMMON SIGIL"
            : "SIGIL DORMANT"}

        </button>

      </div>

    </div>

  );
}

export default GenesisPage;