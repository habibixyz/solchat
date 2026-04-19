import './index.css'
import './styles/theme.css'
import { Buffer } from "buffer";
import '@solana/wallet-adapter-react-ui/styles.css';


if (!(window as any).Buffer) {
  (window as any).Buffer = Buffer;
}

if (!(window as any).process) {
  (window as any).process = { env: {} };
}

import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

import { BrowserRouter } from "react-router-dom";
import { WalletContext } from "./wallet/WalletContext";

import "@solana/wallet-adapter-react-ui/styles.css";
import './styles/mobile-redesign.css';

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <WalletContext>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </WalletContext>
  </React.StrictMode>
);
