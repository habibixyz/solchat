import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

import "./index.css";
import "./styles/theme.css";
import "./styles/mobile-redesign.css";

import { BrowserRouter } from "react-router-dom";
import { WalletContext } from "./wallet/WalletContext";

import { Buffer } from "buffer";
import "@solana/wallet-adapter-react-ui/styles.css";

if (typeof window !== "undefined") {
  (window as any).Buffer = Buffer;
  (window as any).process = { env: {} };
}

// ✅ Fix process (some libs expect it)
if (typeof window !== "undefined" && !(window as any).process) {
  (window as any).process = { env: {} };
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <WalletContext>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </WalletContext>
  </React.StrictMode>
);