import fs from 'fs';
import path from 'path';

const dbPath = path.resolve('mining_db.json');

export function loadDb() {
  try {
    if (!fs.existsSync(dbPath)) {
      fs.writeFileSync(dbPath, JSON.stringify({ players: {}, usedSignatures: [] }, null, 2));
    }
    const raw = fs.readFileSync(dbPath, 'utf8');
    const data = JSON.parse(raw);
    if (!data.usedSignatures) data.usedSignatures = [];
    return data;
  } catch (err) {
    console.error("Error reading database file, resetting:", err);
    const defaultData = { players: {}, usedSignatures: [] };
    fs.writeFileSync(dbPath, JSON.stringify(defaultData, null, 2));
    return defaultData;
  }
}

export function saveDb(data) {
  try {
    fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error("Error writing database file:", err);
  }
}

export function getPlayer(wallet) {
  const db = loadDb();
  if (!db.players[wallet]) {
    db.players[wallet] = {
      chips: 0,
      rigs: { cpu: 0, gpu: 0, asic: 0, validator: 0, quantum: 0, ai: 0 },
      clicks: { carbon: 0, laser: 0, plasma: 0, antimatter: 0 },
      lastSync: Date.now(),
      totalClaimed: 0,
      dailyMined: 0,
      lastDailyReset: new Date().toISOString().split('T')[0],
      hasSigilNft: false
    };
    saveDb(db);
  } else if (db.players[wallet].hasSigilNft === undefined) {
    db.players[wallet].hasSigilNft = false;
    saveDb(db);
  }
  return db.players[wallet];
}

export function syncPlayer(wallet, chips, rigs, clicks, dailyMined, lastDailyReset, hasSigilNft) {
  const db = loadDb();
  const player = db.players[wallet] || { totalClaimed: 0, hasSigilNft: false };
  
  db.players[wallet] = {
    chips: parseFloat(chips),
    rigs: rigs || { cpu: 0, gpu: 0, asic: 0, validator: 0, quantum: 0, ai: 0 },
    clicks: clicks || { carbon: 0, laser: 0, plasma: 0, antimatter: 0 },
    lastSync: Date.now(),
    totalClaimed: player.totalClaimed || 0,
    dailyMined: dailyMined !== undefined ? parseFloat(dailyMined) : (player.dailyMined || 0),
    lastDailyReset: lastDailyReset !== undefined ? lastDailyReset : (player.lastDailyReset || ''),
    hasSigilNft: hasSigilNft !== undefined ? !!hasSigilNft : !!player.hasSigilNft
  };
  saveDb(db);
  return db.players[wallet];
}

export function deductChips(wallet, amount) {
  const db = loadDb();
  if (db.players[wallet]) {
    db.players[wallet].chips = Math.max(0, db.players[wallet].chips - amount);
    db.players[wallet].totalClaimed = (db.players[wallet].totalClaimed || 0) + amount;
    saveDb(db);
    return db.players[wallet];
  }
  return null;
}

export function isSignatureUsed(signature) {
  const db = loadDb();
  return (db.usedSignatures || []).includes(signature);
}

export function markSignatureUsed(signature) {
  const db = loadDb();
  if (!db.usedSignatures) db.usedSignatures = [];
  if (!db.usedSignatures.includes(signature)) {
    db.usedSignatures.push(signature);
    saveDb(db);
  }
}

export function activateSigilNft(wallet) {
  const db = loadDb();
  if (!db.players[wallet]) {
    getPlayer(wallet); // initialize
  }
  db.players[wallet].hasSigilNft = true;
  saveDb(db);
  return db.players[wallet];
}
