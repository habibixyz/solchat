const express = require("express");
const router = express.Router();

const mintStart = new Date("2026-03-09T12:00:00Z");

router.get("/mint-status", (req, res) => {

  const now = new Date();
  const diff = mintStart - now;

  const seconds = Math.max(0, Math.floor(diff / 1000));

  res.json({
    mintStart,
    secondsRemaining: seconds,
    isLive: seconds === 0
  });

});

module.exports = router;