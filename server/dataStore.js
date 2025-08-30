const fs = require('fs').promises;
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');

const seedFiles = {
  awards: path.join(__dirname, '..', 'src', 'data', 'awards.json'),
  groups: path.join(__dirname, '..', 'src', 'data', 'groups.json'),
  students: path.join(__dirname, '..', 'src', 'data', 'students.json'),
  teachers: path.join(__dirname, '..', 'src', 'data', 'teachers.json'),
};

async function ensureFile(type) {
  const file = path.join(DATA_DIR, `${type}.json`);
  try {
    await fs.access(file);
  } catch {
    let seed = [];
    const seedFile = seedFiles[type];
    if (seedFile) {
      try {
        const raw = await fs.readFile(seedFile, 'utf8');
        seed = JSON.parse(raw);
      } catch {
        seed = [];
      }
    }
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(file, JSON.stringify(seed, null, 2));
  }
  return file;
}

async function readData(type) {
  const file = await ensureFile(type);
  const raw = await fs.readFile(file, 'utf8');
  return JSON.parse(raw);
}

async function writeData(type, data) {
  const file = await ensureFile(type);
  await fs.writeFile(file, JSON.stringify(data, null, 2));
  return data;
}

async function addData(type, items) {
  const current = await readData(type);
  const next = current.concat(items);
  await writeData(type, next);
  return next;
}

module.exports = { readData, writeData, addData };
