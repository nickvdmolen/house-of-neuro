const fs = require('fs/promises');
const path = require('path');

const dataDir = path.join(__dirname, 'data');
const seedDir = path.join(__dirname, '..', 'src', 'data');

async function readJson(filePath, fallback = []) {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    if (!raw.trim()) return fallback;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : fallback;
  } catch (err) {
    if (err && err.code === 'ENOENT') return fallback;
    throw err;
  }
}

async function writeJson(filePath, data) {
  const payload = JSON.stringify(data, null, 2);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${payload}\n`, 'utf8');
}

async function ensureSeed(collection, current) {
  if (current.length || collection !== 'badge_defs') return current;
  const seedPath = path.join(seedDir, 'badge_defs.json');
  const seed = await readJson(seedPath, []);
  if (seed.length) {
    const target = path.join(dataDir, `${collection}.json`);
    await writeJson(target, seed);
    return seed;
  }
  return current;
}

async function readData(collection) {
  const filePath = path.join(dataDir, `${collection}.json`);
  const current = await readJson(filePath, []);
  return ensureSeed(collection, current);
}

async function writeData(collection, items) {
  const filePath = path.join(dataDir, `${collection}.json`);
  const data = Array.isArray(items) ? items : [];
  await writeJson(filePath, data);
  return data;
}

async function addData(collection, items) {
  const current = await readData(collection);
  const nextItems = Array.isArray(items) ? items : [];
  const merged = current.concat(nextItems);
  await writeData(collection, merged);
  return merged;
}

module.exports = { readData, writeData, addData };
