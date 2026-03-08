import { Connection, PublicKey } from "@solana/web3.js";

const RPC = "https://api.mainnet-beta.solana.com";

const connection = new Connection(RPC, "confirmed");

const RAYDIUM_PROGRAM = new PublicKey(
  "675kPX9MHTjS2zt1qfr1NYHcY7R6mZ9uV9X6p6j8H5y"
);

console.log("Listening for new Raydium pools...");

connection.onLogs(
  RAYDIUM_PROGRAM,
  async (logInfo) => {

    const logs = logInfo.logs;

    if (!logs) return;

    const isPoolCreation = logs.some(log =>
      log.includes("initialize")
    );

    if (!isPoolCreation) return;

    console.log("NEW POOL DETECTED");
    console.log("Signature:", logInfo.signature);

  },
  "confirmed"
);