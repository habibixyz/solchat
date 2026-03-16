import { useEffect, useState } from "react";

export default function useMintCountdown() {
  const [timeLeft, setTimeLeft] = useState("Loading...");

  useEffect(() => {
    // Set your actual mint date here
    const mintDate = new Date("2026-04-01T18:00:00Z");

    const interval = setInterval(() => {
      const seconds = Math.floor((mintDate.getTime() - Date.now()) / 1000);

      if (seconds <= 0) {
        setTimeLeft("Mint Live");
        clearInterval(interval);
        return;
      }

      const days = Math.floor(seconds / 86400);
      const hours = Math.floor((seconds % 86400) / 3600);
      const mins = Math.floor((seconds % 3600) / 60);
      setTimeLeft(`${days}d ${hours}h ${mins}m`);
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  return timeLeft;
}