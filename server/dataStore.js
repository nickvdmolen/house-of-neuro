const fs = require('fs/promises');
const path = require('path');
const { applyScoreMutationsToState } = require('./scoreMutations');

const defaultDataDir = path.join(__dirname, 'data');
const defaultSeedDir = path.join(__dirname, '..', 'src', 'data');

function createDataStore({
  dataDir = defaultDataDir,
  seedDir = defaultSeedDir,
  fileOps = fs,
} = {}) {
  let operationQueue = Promise.resolve();
  let tempFileSequence = 0;

  const withLock = (operation) => {
    const result = operationQueue.then(operation, operation);
    operationQueue = result.catch(() => undefined);
    return result;
  };

  async function readJson(filePath, fallback = []) {
    try {
      const raw = await fileOps.readFile(filePath, 'utf8');
      if (!raw.trim()) return fallback;
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : fallback;
    } catch (err) {
      if (err && err.code === 'ENOENT') return fallback;
      throw err;
    }
  }

  async function writeJsonAtomic(filePath, data) {
    const payload = `${JSON.stringify(data, null, 2)}\n`;
    const tempPath = `${filePath}.${process.pid}.${Date.now()}.${tempFileSequence += 1}.tmp`;
    await fileOps.mkdir(path.dirname(filePath), { recursive: true });
    try {
      await fileOps.writeFile(tempPath, payload, 'utf8');
      await fileOps.rename(tempPath, filePath);
    } catch (err) {
      try {
        await fileOps.unlink(tempPath);
      } catch (cleanupError) {
        if (!cleanupError || cleanupError.code !== 'ENOENT') {
          err.cleanupError = cleanupError;
        }
      }
      throw err;
    }
  }

  async function ensureSeedUnlocked(collection, current) {
    if (current.length || collection !== 'badge_defs') return current;
    const seedPath = path.join(seedDir, 'badge_defs.json');
    const seed = await readJson(seedPath, []);
    if (seed.length) {
      const target = path.join(dataDir, `${collection}.json`);
      await writeJsonAtomic(target, seed);
      return seed;
    }
    return current;
  }

  async function readDataUnlocked(collection) {
    const filePath = path.join(dataDir, `${collection}.json`);
    const current = await readJson(filePath, []);
    return ensureSeedUnlocked(collection, current);
  }

  async function writeDataUnlocked(collection, items) {
    const filePath = path.join(dataDir, `${collection}.json`);
    const data = Array.isArray(items) ? items : [];
    await writeJsonAtomic(filePath, data);
    return data;
  }

  const readData = (collection) => withLock(() => readDataUnlocked(collection));

  const writeData = (collection, items) =>
    withLock(() => writeDataUnlocked(collection, items));

  const addData = (collection, items) =>
    withLock(async () => {
      const current = await readDataUnlocked(collection);
      const nextItems = Array.isArray(items) ? items : [];
      const merged = current.concat(nextItems);
      await writeDataUnlocked(collection, merged);
      return merged;
    });

  const patchData = (collection, field, value, updates) =>
    withLock(async () => {
      if (typeof field !== 'string' || !field) {
        const error = new Error('patch field must be a non-empty string');
        error.code = 'invalid_patch';
        error.statusCode = 400;
        throw error;
      }
      if (!updates || typeof updates !== 'object' || Array.isArray(updates)) {
        const error = new Error('patch updates must be an object');
        error.code = 'invalid_patch';
        error.statusCode = 400;
        throw error;
      }
      const current = await readDataUnlocked(collection);
      let matched = false;
      const next = current.map((row) => {
        if (row?.[field] !== value) return row;
        matched = true;
        return { ...row, ...updates };
      });
      if (matched) await writeDataUnlocked(collection, next);
      return next;
    });

  const deleteData = (collection, field, values) =>
    withLock(async () => {
      if (typeof field !== 'string' || !field || !Array.isArray(values)) {
        const error = new Error('delete field and values are required');
        error.code = 'invalid_delete';
        error.statusCode = 400;
        throw error;
      }
      const current = await readDataUnlocked(collection);
      const valueSet = new Set(values);
      const next = current.filter((row) => !valueSet.has(row?.[field]));
      if (next.length !== current.length) await writeDataUnlocked(collection, next);
      return next;
    });

  const applyScoreMutations = (pAwards = [], pPeerAwards = []) =>
    withLock(async () => {
      const snapshots = {
        students: await readDataUnlocked('students'),
        groups: await readDataUnlocked('groups'),
        awards: await readDataUnlocked('awards'),
        peerAwards: await readDataUnlocked('peer_awards'),
        peerEvents: await readDataUnlocked('peer_events'),
        scoreMutationClaims: await readDataUnlocked('score_mutation_claims'),
      };
      const plan = applyScoreMutationsToState(snapshots, {
        p_awards: pAwards,
        p_peer_awards: pPeerAwards,
      });
      const collectionValues = {
        students: plan.state.students,
        groups: plan.state.groups,
        awards: plan.state.awards,
        peer_awards: plan.state.peerAwards,
        score_mutation_claims: plan.state.scoreMutationClaims,
      };
      const snapshotValues = {
        students: snapshots.students,
        groups: snapshots.groups,
        awards: snapshots.awards,
        peer_awards: snapshots.peerAwards,
        score_mutation_claims: snapshots.scoreMutationClaims,
      };
      const commitOrder = [
        'students',
        'groups',
        'awards',
        'score_mutation_claims',
        'peer_awards',
      ].filter((collection) => plan.changedCollections.includes(collection));
      const committed = [];

      try {
        for (const collection of commitOrder) {
          await writeDataUnlocked(collection, collectionValues[collection]);
          committed.push(collection);
        }
      } catch (commitError) {
        const rollbackErrors = [];
        for (const collection of [...committed].reverse()) {
          try {
            await writeDataUnlocked(collection, snapshotValues[collection]);
          } catch (rollbackError) {
            rollbackErrors.push({ collection, error: rollbackError });
          }
        }
        if (rollbackErrors.length) {
          const error = new Error('Score mutation failed and could not be fully rolled back');
          error.code = 'score_mutation_rollback_failed';
          error.statusCode = 500;
          error.cause = commitError;
          error.rollbackErrors = rollbackErrors;
          throw error;
        }
        throw commitError;
      }

      return plan.result;
    });

  return {
    readData,
    writeData,
    addData,
    patchData,
    deleteData,
    applyScoreMutations,
  };
}

const defaultStore = createDataStore();

module.exports = {
  ...defaultStore,
  createDataStore,
};
