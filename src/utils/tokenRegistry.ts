export interface TokenInfo {
  symbol: string;
  address: string;
  decimals: number;
  logoURI?: string;
}

// Minimal safe registry (expand later)
const TOKENS: TokenInfo[] = [
  {
    symbol: "SOL",
    address: "So11111111111111111111111111111111111111112",
    decimals: 9,
  },
  {
    symbol: "USDC",
    address: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkGkVY4j",
    decimals: 6,
  }
];

let symbolMap: Record<string, TokenInfo> = {};
let mintMap: Record<string, TokenInfo> = {};

export function loadTokenRegistry() {
  TOKENS.forEach((token) => {
    symbolMap[token.symbol.toUpperCase()] = token;
    mintMap[token.address] = token;
  });
}

export function getTokenBySymbol(symbol: string) {
  return symbolMap[symbol.toUpperCase()] || null;
}

export function getTokenByMint(mint: string) {
  return mintMap[mint] || null;
}