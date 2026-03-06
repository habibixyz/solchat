import express from "express";
import cors from "cors";

const app = express();
const PORT = 4000;

app.use(cors());
app.use(express.json());

const mintStart = new Date("2026-03-09T12:00:00Z");

app.get("/mint-status", (req, res) => {

  const now = new Date();
  const diff = mintStart - now;

  const seconds = Math.max(0, Math.floor(diff / 1000));

  res.json({
    mintStart,
    secondsRemaining: seconds,
    isLive: seconds === 0
  });

});

app.listen(PORT, () => {
  console.log(`Mint server running on port ${PORT}`);
});