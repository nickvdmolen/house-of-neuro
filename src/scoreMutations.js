import { ensureSession, supabase } from './supabase';

const hasOwn = (value, key) =>
  Object.prototype.hasOwnProperty.call(value || {}, key);

const toRpcAward = (award) => ({
  id: award.id,
  ts: award.ts ?? new Date().toISOString(),
  target: award.target,
  target_id: award.target_id,
  semesterId: award.semesterId ?? null,
  amount: Number(award.amount),
  reason: award.reason ?? null,
  ...(award.badgeId ? { badgeId: award.badgeId } : {}),
  ...(award.badgeAction ? { badgeAction: award.badgeAction } : {}),
  ...(hasOwn(award, 'lastWeekRewarded')
    ? { lastWeekRewarded: award.lastWeekRewarded ?? null }
    : {}),
  ...(hasOwn(award, 'applyPoints')
    ? { applyPoints: award.applyPoints !== false }
    : {}),
  ...(award.repairPointsWhenMarkerMissing
    ? { repairPointsWhenMarkerMissing: true }
    : {}),
});

const toRpcPeerAward = (entry) => {
  const { event_title, eventTitle, ...row } = entry;
  return {
    ...row,
    ts: row.ts ?? new Date().toISOString(),
    amount: Number(row.amount),
    total_amount: Number(row.total_amount),
  };
};

const validateAwards = (awards) => {
  if (!Array.isArray(awards) || awards.length === 0) {
    return new Error('Minimaal één scoremutatie is vereist.');
  }
  for (const award of awards) {
    if (!award?.id || !award?.target_id) {
      return new Error('Scoremutatie mist een id of doel.');
    }
    if (!['student', 'group'].includes(award.target)) {
      return new Error(`Ongeldig scoredoel: ${award.target || 'onbekend'}.`);
    }
    const amount = Number(award.amount);
    if (!Number.isInteger(amount)) {
      return new Error('Punten moeten een geheel getal zijn.');
    }
    if (amount === 0) {
      return new Error('Punten mogen niet nul zijn.');
    }
    if (
      (award.badgeId || award.badgeAction) &&
      (!award.badgeId || !['grant', 'revoke'].includes(award.badgeAction))
    ) {
      return new Error('Badge-mutatie mist een geldige badgeactie.');
    }
    if (award.badgeId && award.target !== 'student') {
      return new Error('Badges kunnen alleen aan studenten worden gekoppeld.');
    }
    const markerProvided = hasOwn(award, 'lastWeekRewarded');
    if (
      markerProvided &&
      (typeof award.lastWeekRewarded !== 'string' || !award.lastWeekRewarded.trim())
    ) {
      return new Error('Weekmutatie mist een geldige weekmarker.');
    }
    if (award.badgeId && (markerProvided || award.applyPoints === false)) {
      return new Error('Badge- en weekmutaties mogen niet worden gecombineerd.');
    }
    if (
      award.repairPointsWhenMarkerMissing &&
      (award.target !== 'student' || !markerProvided || award.badgeId)
    ) {
      return new Error('Weekreparatie vereist één student en weekmarker.');
    }
    if (
      (award.badgeAction === 'grant' && amount < 0) ||
      (award.badgeAction === 'revoke' && amount > 0)
    ) {
      return new Error('Het teken van de badgepunten past niet bij de badgeactie.');
    }
  }
  return null;
};

const scoreKey = (target, targetId, amount) =>
  `${target}\u0000${targetId}\u0000${Number(amount)}`;

const validatePeerBatch = (awards, peerAwards) => {
  if (peerAwards.length === 0) return null;
  if (peerAwards.length !== awards.length) {
    return new Error('Elke peerregel vereist precies één scoremutatie.');
  }
  const scoreCounts = new Map();
  awards.forEach((award) => {
    if (
      award.badgeId ||
      award.badgeAction ||
      hasOwn(award, 'lastWeekRewarded') ||
      award.repairPointsWhenMarkerMissing ||
      award.applyPoints === false
    ) {
      return;
    }
    const key = scoreKey(award.target, award.target_id, award.amount);
    scoreCounts.set(key, (scoreCounts.get(key) || 0) + 1);
  });
  if (scoreCounts.size === 0 && awards.length > 0) {
    return new Error('Peerpunten mogen geen badge- of weekopties bevatten.');
  }
  const peerCounts = new Map();
  for (const entry of peerAwards) {
    const amount = Number(entry.amount);
    const totalAmount = Number(entry.total_amount);
    if (!Number.isInteger(amount) || amount <= 0 || !Number.isInteger(totalAmount) || totalAmount <= 0) {
      return new Error('Peerpunten moeten positieve gehele getallen zijn.');
    }
    const key = scoreKey(entry.target, entry.target_id, totalAmount);
    peerCounts.set(key, (peerCounts.get(key) || 0) + 1);
  }
  const matches =
    scoreCounts.size === peerCounts.size &&
    [...scoreCounts].every(([key, count]) => peerCounts.get(key) === count);
  return matches ? null : new Error('Peerregels en scoremutaties komen niet één-op-één overeen.');
};

export default async function applyScoreMutations({
  awards,
  peerAwards = [],
} = {}) {
  const validationError = validateAwards(awards);
  if (validationError) return { data: null, error: validationError };
  if (!Array.isArray(peerAwards)) {
    return { data: null, error: new Error('Peer-awards moeten een lijst zijn.') };
  }
  const peerValidationError = validatePeerBatch(awards, peerAwards);
  if (peerValidationError) return { data: null, error: peerValidationError };

  try {
    await ensureSession();
    const { data, error } = await supabase.rpc('apply_score_mutations', {
      p_awards: awards.map(toRpcAward),
      p_peer_awards: peerAwards.map(toRpcPeerAward),
    });
    return { data: data ?? null, error: error || null };
  } catch (error) {
    return { data: null, error };
  }
}

export { toRpcAward, toRpcPeerAward, validateAwards, validatePeerBatch };
