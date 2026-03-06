import { useEffect, useState } from "react";

export default function useMintCountdown() {

  const [timeLeft, setTimeLeft] = useState("Loading...");

  useEffect(() => {

    const loadCountdown = async () => {

      const res = await fetch("http://localhost:4000/mint-status");
      const data = await res.json();

      let seconds = data.secondsRemaining;

      const interval = setInterval(() => {

        if (seconds <= 0) {
          setTimeLeft("Mint Live");
          clearInterval(interval);
          return;
        }

        const days = Math.floor(seconds / 86400);
        const hours = Math.floor((seconds % 86400) / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);

        setTimeLeft(`${days}d ${hours}h ${minutes}m`);

        seconds--;

      }, 1000);

    };

    loadCountdown();

  }, []);

  return timeLeft;

}