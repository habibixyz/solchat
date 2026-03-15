import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

import { BrowserRouter } from "react-router-dom";
import { WalletContext } from "./wallet/WalletContext";

import "@solana/wallet-adapter-react-ui/styles.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <WalletContext>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </WalletContext>
  </React.StrictMode>
);