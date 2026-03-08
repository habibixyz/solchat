const BASE =
  "https://api.geckoterminal.com/api/v2/networks/solana";

export async function getPools(page = 1) {
  const res = await fetch(`${BASE}/pools?page=${page}`);
  const json = await res.json();
  return json.data;
}

export async function getPool(poolAddress) {
  const res = await fetch(`${BASE}/pools/${poolAddress}`);
  const json = await res.json();
  return json.data;
}