const AWARD_FIELDS = [
  'id',
  'ts',
  'target',
  'target_id',
  'semesterId',
  'amount',
  'reason',
];

const AWARD_OPTION_FIELDS = [
  'badgeId',
  'badgeAction',
  'lastWeekRewarded',
  'applyPoints',
  'repairPointsWhenMarkerMissing',
];

const PEER_AWARD_FIELDS = [
  'id',
  'ts',
  'from_student_id',
  'event_id',
  'target',
  'target_id',
  'semesterId',
  'amount',
  'total_amount',
  'reason',
  'recipients',
  'weekKey',
];

const hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value, key);

class ScoreMutationError extends Error {
  constructor(message, { code = 'invalid_score_mutation', statusCode = 400 } = {}) {
    super(message);
    this.name = 'ScoreMutationError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

const fail = (message, options) => {
  throw new ScoreMutationError(message, options);
};

const requireArray = (value, name) => {
  if (!Array.isArray(value)) fail(`${name} must be an array`);
  return value;
};

const requireId = (value, name) => {
  if (typeof value !== 'string' || !value.trim()) {
    fail(`${name} must be a non-empty string`);
  }
  return value;
};

const requireInteger = (value, name) => {
  const number = Number(value);
  if (!Number.isInteger(number)) fail(`${name} must be an integer`);
  return number;
};

const rejectUnknownFields = (value, allowedFields, name) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail(`${name} must be an object`);
  }
  const allowed = new Set(allowedFields);
  const unknown = Object.keys(value).filter((key) => !allowed.has(key));
  if (unknown.length) fail(`${name} contains unsupported fields: ${unknown.join(', ')}`);
};

const normalizeAward = (value, index, defaultTimestamp) => {
  const name = `p_awards[${index}]`;
  rejectUnknownFields(value, [...AWARD_FIELDS, ...AWARD_OPTION_FIELDS], name);

  const target = value.target;
  if (target !== 'student' && target !== 'group') {
    fail(`${name}.target must be student or group`);
  }

  if (hasOwn(value, 'ts') && (typeof value.ts !== 'string' || !value.ts.trim())) {
    fail(`${name}.ts must be a non-empty string when provided`);
  }
  if (hasOwn(value, 'applyPoints') && typeof value.applyPoints !== 'boolean') {
    fail(`${name}.applyPoints must be a boolean`);
  }
  if (
    hasOwn(value, 'repairPointsWhenMarkerMissing') &&
    typeof value.repairPointsWhenMarkerMissing !== 'boolean'
  ) {
    fail(`${name}.repairPointsWhenMarkerMissing must be a boolean`);
  }
  const hasBadgeId = hasOwn(value, 'badgeId');
  const hasBadgeAction = hasOwn(value, 'badgeAction');
  if (hasBadgeId !== hasBadgeAction) {
    fail(`${name}.badgeId and badgeAction must be provided together`);
  }
  if (hasBadgeId) {
    requireId(value.badgeId, `${name}.badgeId`);
    if (!['grant', 'revoke'].includes(value.badgeAction)) {
      fail(`${name}.badgeAction must be grant or revoke`);
    }
    if (target !== 'student') fail(`${name}.badgeId is only valid for students`);
  }
  if (hasOwn(value, 'lastWeekRewarded')) {
    if (typeof value.lastWeekRewarded !== 'string' || !value.lastWeekRewarded.trim()) {
      fail(`${name}.lastWeekRewarded must be a non-empty string`);
    }
    if (target !== 'student') {
      fail(`${name}.lastWeekRewarded is only valid for students`);
    }
  }
  if (value.repairPointsWhenMarkerMissing) {
    if (target !== 'student' || !hasOwn(value, 'lastWeekRewarded')) {
      fail(
        `${name}.repairPointsWhenMarkerMissing requires a student lastWeekRewarded marker`
      );
    }
  }
  if (hasBadgeId && hasOwn(value, 'lastWeekRewarded')) {
    fail(`${name} cannot combine a badge mutation with a weekly marker`);
  }

  const amount = requireInteger(value.amount, `${name}.amount`);
  if (amount === 0) fail(`${name}.amount must not be zero`);
  if (value.badgeAction === 'grant' && amount <= 0) {
    fail(`${name}.amount must be positive when granting a badge`);
  }
  if (value.badgeAction === 'revoke' && amount >= 0) {
    fail(`${name}.amount must be negative when revoking a badge`);
  }
  if (hasBadgeId && value.applyPoints === false) {
    fail(`${name}.applyPoints cannot be false for a badge mutation`);
  }

  return {
    row: {
      id: requireId(value.id, `${name}.id`),
      ts: value.ts || defaultTimestamp,
      target,
      target_id: requireId(value.target_id, `${name}.target_id`),
      semesterId: value.semesterId ?? null,
      amount,
      reason: value.reason ?? null,
    },
    options: {
      ...(hasBadgeId
        ? { badgeId: value.badgeId, badgeAction: value.badgeAction }
        : {}),
      ...(hasOwn(value, 'lastWeekRewarded')
        ? { lastWeekRewarded: value.lastWeekRewarded }
        : {}),
      applyPoints: value.applyPoints !== false,
      repairPointsWhenMarkerMissing: value.repairPointsWhenMarkerMissing === true,
      timestampProvided: hasOwn(value, 'ts'),
    },
  };
};

const normalizePeerAward = (value, index, defaultTimestamp) => {
  const name = `p_peer_awards[${index}]`;
  rejectUnknownFields(value, PEER_AWARD_FIELDS, name);
  if (hasOwn(value, 'ts') && (typeof value.ts !== 'string' || !value.ts.trim())) {
    fail(`${name}.ts must be a non-empty string when provided`);
  }
  if (!['student', 'group'].includes(value.target)) {
    fail(`${name}.target must be student or group`);
  }
  if (!Array.isArray(value.recipients)) {
    fail(`${name}.recipients must be an array`);
  }

  return {
    row: {
      id: requireId(value.id, `${name}.id`),
      ts: value.ts || defaultTimestamp,
      from_student_id: requireId(value.from_student_id, `${name}.from_student_id`),
      event_id: requireId(value.event_id, `${name}.event_id`),
      target: value.target,
      target_id: requireId(value.target_id, `${name}.target_id`),
      semesterId: value.semesterId ?? null,
      amount: requireInteger(value.amount, `${name}.amount`),
      total_amount: requireInteger(value.total_amount, `${name}.total_amount`),
      reason: value.reason ?? null,
      recipients: value.recipients.map((recipient, recipientIndex) =>
        requireId(recipient, `${name}.recipients[${recipientIndex}]`)
      ),
      weekKey: value.weekKey ?? null,
    },
    timestampProvided: hasOwn(value, 'ts'),
  };
};

const canonicalAward = (value) => ({
  id: value.id,
  ts: value.ts,
  target: value.target,
  target_id: value.target_id,
  semesterId: value.semesterId ?? null,
  amount: Number(value.amount),
  reason: value.reason ?? null,
});

const canonicalPeerAward = (value) => ({
  id: value.id,
  ts: value.ts,
  from_student_id: value.from_student_id,
  event_id: value.event_id,
  target: value.target,
  target_id: value.target_id,
  semesterId: value.semesterId ?? null,
  amount: Number(value.amount),
  total_amount: Number(value.total_amount),
  reason: value.reason ?? null,
  recipients: Array.isArray(value.recipients) ? [...value.recipients] : [],
  weekKey: value.weekKey ?? null,
});

const rowsEqual = (left, right) => JSON.stringify(left) === JSON.stringify(right);
const peerReplayKey = (row) => `${row.from_student_id}\u0000${row.event_id}`;
const scoreMatchKey = (target, targetId, amount) =>
  `${target}\u0000${String(targetId)}\u0000${Number(amount)}`;
const rowsEqualForReplay = (left, right, timestampProvided) => {
  if (timestampProvided) return rowsEqual(left, right);
  return rowsEqual({ ...left, ts: null }, { ...right, ts: null });
};

const mutationMeta = (options = {}) => ({
  applyPoints: options.applyPoints !== false,
  repairPointsWhenMarkerMissing: options.repairPointsWhenMarkerMissing === true,
  ...(hasOwn(options, 'badgeId')
    ? { badgeId: options.badgeId, badgeAction: options.badgeAction }
    : {}),
  ...(hasOwn(options, 'lastWeekRewarded')
    ? { lastWeekRewarded: options.lastWeekRewarded }
    : {}),
});

const canonicalMutationMeta = (value = {}) => {
  const source = value && typeof value === 'object' ? value : {};
  return {
    applyPoints: source.applyPoints !== false,
    repairPointsWhenMarkerMissing: source.repairPointsWhenMarkerMissing === true,
    ...(hasOwn(source, 'badgeId')
      ? { badgeId: source.badgeId, badgeAction: source.badgeAction }
      : {}),
    ...(hasOwn(source, 'lastWeekRewarded')
      ? { lastWeekRewarded: source.lastWeekRewarded }
      : {}),
  };
};

const finishResult = (result, awardCount, peerCount) => {
  const allReplayed =
    result.applied_award_ids.length === 0 &&
    result.repaired_award_ids.length === 0 &&
    result.noop_award_ids.length === 0 &&
    result.replayed_award_ids.length === awardCount &&
    (peerCount === 0 || result.peer_replay);
  return {
    ...result,
    applied: !allReplayed,
    replayed: allReplayed,
    peerApplied: peerCount > 0 && !result.peer_replay,
  };
};

const cloneState = (state) => ({
  students: requireArray(state?.students ?? [], 'state.students').map((row) => ({
    ...row,
    ...(Array.isArray(row?.badges) ? { badges: [...row.badges] } : {}),
  })),
  groups: requireArray(state?.groups ?? [], 'state.groups').map((row) => ({ ...row })),
  awards: requireArray(state?.awards ?? [], 'state.awards').map((row) => ({ ...row })),
  peerAwards: requireArray(state?.peerAwards ?? [], 'state.peerAwards').map((row) => ({
    ...row,
    ...(Array.isArray(row?.recipients) ? { recipients: [...row.recipients] } : {}),
  })),
  peerEvents: requireArray(state?.peerEvents ?? [], 'state.peerEvents').map((row) => ({
    ...row,
  })),
  scoreMutationClaims: requireArray(
    state?.scoreMutationClaims ?? [],
    'state.scoreMutationClaims'
  ).map((row) => ({
    ...row,
    ...(row?.mutation_meta && typeof row.mutation_meta === 'object'
      ? { mutation_meta: { ...row.mutation_meta } }
      : {}),
  })),
});

const assertUniqueIds = (rows, name, getRow = (row) => row) => {
  const ids = new Set();
  rows.forEach((entry) => {
    const row = getRow(entry);
    if (ids.has(row.id)) fail(`${name} contains duplicate id ${row.id}`);
    ids.add(row.id);
  });
};

function applyScoreMutationsToState(
  state,
  { p_awards: awardInput = [], p_peer_awards: peerAwardInput = [] } = {},
  { now = () => new Date().toISOString() } = {}
) {
  const defaultTimestamp = now();
  const requestedAwards = requireArray(awardInput, 'p_awards').map((value, index) =>
    normalizeAward(value, index, defaultTimestamp)
  );
  const requestedPeerAwards = requireArray(peerAwardInput, 'p_peer_awards').map(
    (value, index) => normalizePeerAward(value, index, defaultTimestamp)
  );
  if (requestedAwards.length === 0 || requestedAwards.length > 500) {
    fail('p_awards must contain between 1 and 500 rows');
  }
  if (requestedPeerAwards.length > 500) {
    fail('p_peer_awards may contain at most 500 rows');
  }
  assertUniqueIds(requestedAwards, 'p_awards', (entry) => entry.row);
  assertUniqueIds(requestedPeerAwards, 'p_peer_awards', (entry) => entry.row);
  const next = cloneState(state);
  const changedCollections = new Set();
  const result = {
    applied_award_ids: [],
    replayed_award_ids: [],
    repaired_award_ids: [],
    noop_award_ids: [],
    applied_peer_award_ids: [],
    replayed_peer_award_ids: [],
    peer_replay: false,
    results: [],
  };

  // A peer event can only be submitted once by a student. A replay is accepted
  // only when both the peer rows and their score awards exactly match the first call.
  if (requestedPeerAwards.length) {
    if (requestedPeerAwards.length !== requestedAwards.length) {
      fail('every peer award requires one score award');
    }
    const hasNonPlainScoreAward = requestedAwards.some(({ options }) =>
      !options.applyPoints ||
      options.repairPointsWhenMarkerMissing ||
      hasOwn(options, 'badgeId') ||
      hasOwn(options, 'lastWeekRewarded')
    );
    if (hasNonPlainScoreAward) {
      fail('peer score awards cannot contain badge, marker or point-suppression options', {
        code: 'peer_score_options_invalid',
        statusCode: 409,
      });
    }
    const requestedKeys = new Set(requestedPeerAwards.map(({ row }) => peerReplayKey(row)));
    if (requestedKeys.size !== 1) {
      fail('p_peer_awards must describe one student event submission');
    }
    const replayKey = requestedKeys.values().next().value;
    const firstPeerAward = requestedPeerAwards[0].row;
    const event = next.peerEvents.find(
      (row) => String(row.id) === String(firstPeerAward.event_id)
    );
    const existingForEvent = next.peerAwards.filter(
      (row) => peerReplayKey(canonicalPeerAward(row)) === replayKey
    );
    if (existingForEvent.length) {
      const existingById = new Map(
        existingForEvent.map((row) => [String(row.id), canonicalPeerAward(row)])
      );
      const peerPayloadMatches =
        existingForEvent.length === requestedPeerAwards.length &&
        requestedPeerAwards.every(({ row, timestampProvided }) => {
          const existing = existingById.get(String(row.id));
          return (
            existing && rowsEqualForReplay(existing, row, timestampProvided)
          );
        });
      const existingAwardsById = new Map(
        next.awards.map((row) => [String(row.id), canonicalAward(row)])
      );
      const awardPayloadMatches = requestedAwards.every(({ row, options }) => {
        const existing = existingAwardsById.get(String(row.id));
        return (
          existing &&
          rowsEqualForReplay(existing, row, options.timestampProvided)
        );
      });
      if (!peerPayloadMatches || !awardPayloadMatches) {
        fail('peer event was already submitted with different data', {
          code: 'peer_submission_conflict',
          statusCode: 409,
        });
      }
      result.peer_replay = true;
    } else {
      if (!event) {
        fail(`peer event ${firstPeerAward.event_id} was not found`, {
          code: 'peer_event_not_found',
          statusCode: 404,
        });
      }
      if (event.active !== true) {
        fail(`peer event ${firstPeerAward.event_id} is not active`, {
          code: 'peer_event_inactive',
          statusCode: 409,
        });
      }
      const actor = next.students.find(
        (row) => String(row.id) === firstPeerAward.from_student_id
      );
      if (!actor) {
        fail(`student ${firstPeerAward.from_student_id} was not found`, {
          code: 'peer_sender_not_found',
          statusCode: 404,
        });
      }
      const legacyScope = ['all', 'own_group', 'other_groups'].includes(
        event.recipientScope
      )
        ? event.recipientScope
        : null;
      const allowOwnGroup = legacyScope
        ? legacyScope === 'all' || legacyScope === 'own_group'
        : event.allowOwnGroup ?? event.allow_own_group ?? false;
      const allowOtherGroups = legacyScope
        ? legacyScope === 'all' || legacyScope === 'other_groups'
        : event.allowOtherGroups ?? event.allow_other_groups ?? true;
      const eventSemesterId = event.semesterId ?? event.semester_id ?? null;
      const actorSemesterId = actor.semesterId ?? actor.semester_id ?? null;
      const actorGroupId = actor.groupId ?? actor.group_id ?? null;
      if (
        eventSemesterId != null &&
        String(actorSemesterId ?? '') !== String(eventSemesterId)
      ) {
        fail('peer sender is outside the event semester', {
          code: 'peer_scope_violation',
          statusCode: 409,
        });
      }
      if (!allowOwnGroup && !allowOtherGroups) {
        fail('peer event has no eligible recipient scope', {
          code: 'peer_scope_violation',
          statusCode: 409,
        });
      }
      const expectedTarget = allowOwnGroup ? 'student' : 'group';
      requestedPeerAwards.forEach(({ row }) => {
        if (row.target !== expectedTarget) {
          fail(`peer event requires ${expectedTarget} targets`, {
            code: 'peer_scope_violation',
            statusCode: 409,
          });
        }
        if (row.target === 'student') {
          if (String(row.target_id) === String(actor.id)) {
            fail('students cannot award themselves', {
              code: 'peer_scope_violation',
              statusCode: 409,
            });
          }
          const recipient = next.students.find(
            (student) => String(student.id) === String(row.target_id)
          );
          if (!recipient) {
            fail(`student ${row.target_id} was not found`, {
              code: 'score_target_not_found',
              statusCode: 404,
            });
          }
          const sameGroup =
            actorGroupId != null &&
            String(actorGroupId) === String(recipient.groupId ?? recipient.group_id ?? '');
          if ((sameGroup && !allowOwnGroup) || (!sameGroup && !allowOtherGroups)) {
            fail('student target is outside the event recipient scope', {
              code: 'peer_scope_violation',
              statusCode: 409,
            });
          }
          if (
            eventSemesterId != null &&
            String(recipient.semesterId ?? recipient.semester_id ?? '') !==
              String(eventSemesterId)
          ) {
            fail('student target is outside the event semester', {
              code: 'peer_scope_violation',
              statusCode: 409,
            });
          }
          if (
            row.recipients.length !== 1 ||
            String(row.recipients[0]) !== String(row.target_id)
          ) {
            fail('student peer recipients must contain exactly the target student', {
              code: 'peer_scope_violation',
              statusCode: 409,
            });
          }
        } else {
          const targetGroup = next.groups.find(
            (group) => String(group.id) === String(row.target_id)
          );
          if (!targetGroup || String(targetGroup.id) === String(actorGroupId ?? '')) {
            fail('group target is missing or belongs to the sender', {
              code: 'peer_scope_violation',
              statusCode: 409,
            });
          }
          if (
            eventSemesterId != null &&
            String(targetGroup.semesterId ?? targetGroup.semester_id ?? '') !==
              String(eventSemesterId)
          ) {
            fail('group target is outside the event semester', {
              code: 'peer_scope_violation',
              statusCode: 409,
            });
          }
          const targetMembers = next.students.filter(
            (student) =>
              String(student.groupId ?? student.group_id ?? '') ===
              String(targetGroup.id)
          );
          if (
            eventSemesterId != null &&
            targetMembers.some(
              (student) =>
                String(student.semesterId ?? student.semester_id ?? '') !==
                String(eventSemesterId)
            )
          ) {
            fail('group target contains students outside the event semester', {
              code: 'peer_scope_violation',
              statusCode: 409,
            });
          }
          const expectedRecipients = targetMembers
            .map((student) => String(student.id))
            .sort();
          const actualRecipients = row.recipients.map(String).sort();
          if (
            expectedRecipients.length === 0 ||
            !rowsEqual(expectedRecipients, actualRecipients)
          ) {
            fail('group peer recipients must match all current group members', {
              code: 'peer_scope_violation',
              statusCode: 409,
            });
          }
        }
      });
      const eventBudget = Number(event.budget);
      const submittedTotal = requestedPeerAwards.reduce(
        (sum, { row }) => sum + row.total_amount,
        0
      );
      if (!Number.isInteger(eventBudget) || submittedTotal !== eventBudget) {
        fail(`peer award total must equal the event budget of ${event.budget}`, {
          code: 'peer_budget_mismatch',
          statusCode: 409,
        });
      }

      const scoreAwardCounts = new Map();
      requestedAwards.forEach(({ row }) => {
        const key = scoreMatchKey(row.target, row.target_id, row.amount);
        scoreAwardCounts.set(key, (scoreAwardCounts.get(key) || 0) + 1);
      });
      const peerScoreCounts = new Map();
      requestedPeerAwards.forEach(({ row }) => {
        const key = scoreMatchKey(row.target, row.target_id, row.total_amount);
        peerScoreCounts.set(key, (peerScoreCounts.get(key) || 0) + 1);
      });
      const scoreMatches =
        scoreAwardCounts.size === peerScoreCounts.size &&
        [...scoreAwardCounts].every(
          ([key, count]) => peerScoreCounts.get(key) === count
        );
      if (
        !scoreMatches ||
        requestedPeerAwards.some(
          ({ row }) => row.amount <= 0 || row.total_amount <= 0
        )
      ) {
        fail('peer rows must have positive amounts and matching score awards', {
          code: 'peer_score_mismatch',
          statusCode: 409,
        });
      }

    }
  }

  const studentsById = new Map(next.students.map((row, index) => [String(row.id), index]));
  const groupsById = new Map(next.groups.map((row, index) => [String(row.id), index]));
  const awardsById = new Map(next.awards.map((row) => [String(row.id), row]));
  const claimsById = new Map(
    next.scoreMutationClaims.map((row) => [String(row.id), row])
  );

  requestedAwards.forEach(({ row, options }) => {
    const requestedMeta = mutationMeta(options);
    const claim = claimsById.get(String(row.id));
    const existing = awardsById.get(String(row.id));
    if (claim && existing) {
      fail(`award ${row.id} has both an award row and a mutation claim`, {
        code: 'award_id_conflict',
        statusCode: 409,
      });
    }
    if (claim) {
      const claimMatches =
        rowsEqualForReplay(canonicalAward(claim), row, options.timestampProvided) &&
        rowsEqual(canonicalMutationMeta(claim.mutation_meta), requestedMeta);
      if (!claimMatches) {
        fail(`award claim ${row.id} already exists with different data`, {
          code: 'award_id_conflict',
          statusCode: 409,
        });
      }
      result.replayed_award_ids.push(row.id);
      result.results.push({
        id: row.id,
        status: 'replayed',
        applied: false,
        replayed: true,
        pointsApplied: false,
        previousPoints: claim.previous_points ?? null,
        resultingPoints: claim.resulting_points ?? null,
      });
      return;
    }

    const rpcOwned = Boolean(existing && hasOwn(existing, 'mutation_meta'));
    if (
      existing &&
      !rowsEqualForReplay(
        canonicalAward(existing),
        row,
        rpcOwned && !options.repairPointsWhenMarkerMissing
          ? options.timestampProvided
          : false
      )
    ) {
      fail(`award ${row.id} already exists with different data`, {
        code: 'award_id_conflict',
        statusCode: 409,
      });
    }
    if (
      rpcOwned &&
      !rowsEqual(canonicalMutationMeta(existing.mutation_meta), requestedMeta)
    ) {
      fail(`award ${row.id} already exists with different options`, {
        code: 'award_options_conflict',
        statusCode: 409,
      });
    }
    if (rpcOwned || (existing && !options.repairPointsWhenMarkerMissing)) {
      result.replayed_award_ids.push(row.id);
      result.results.push({
        id: row.id,
        status: 'replayed',
        applied: false,
        replayed: true,
        pointsApplied: false,
        previousPoints: existing.previous_points ?? null,
        resultingPoints: existing.resulting_points ?? null,
      });
      return;
    }

    const targetRows = row.target === 'student' ? next.students : next.groups;
    const targetIndex = (row.target === 'student' ? studentsById : groupsById).get(
      String(row.target_id)
    );
    if (targetIndex === undefined) {
      fail(`${row.target} ${row.target_id} was not found`, {
        code: 'score_target_not_found',
        statusCode: 404,
      });
    }

    const target = targetRows[targetIndex];
    const previousPoints = Number(target.points) || 0;
    const markerProvided = hasOwn(options, 'lastWeekRewarded');
    const markerMissing =
      markerProvided && target.lastWeekRewarded !== options.lastWeekRewarded;
    const legacyRepair = Boolean(
      existing && !rpcOwned && options.repairPointsWhenMarkerMissing && markerProvided
    );
    const currentMarker = target.lastWeekRewarded;
    const isoWeekPattern = /^\d{4}-W\d{2}$/;
    const canLegacyRepair =
      currentMarker == null ||
      (isoWeekPattern.test(String(currentMarker)) &&
        isoWeekPattern.test(String(options.lastWeekRewarded)) &&
        String(currentMarker) < String(options.lastWeekRewarded));
    const staleNewWeekMarker =
      !existing &&
      markerProvided &&
      isoWeekPattern.test(String(currentMarker)) &&
      isoWeekPattern.test(String(options.lastWeekRewarded)) &&
      String(currentMarker) > String(options.lastWeekRewarded);
    if (staleNewWeekMarker) {
      fail(
        `weekly marker ${options.lastWeekRewarded} is older than ${currentMarker}`,
        {
          code: 'stale_week_marker',
          statusCode: 409,
        }
      );
    }
    if (legacyRepair && !canLegacyRepair) {
      existing.mutation_meta = requestedMeta;
      existing.mutation_applied = true;
      changedCollections.add('awards');
      result.replayed_award_ids.push(row.id);
      result.results.push({
        id: row.id,
        status: 'replayed',
        applied: false,
        replayed: true,
        pointsApplied: false,
        previousPoints: existing.previous_points ?? null,
        resultingPoints: existing.resulting_points ?? null,
      });
      return;
    }
    const shouldApplyPoints = existing
      ? legacyRepair && markerMissing && canLegacyRepair && options.applyPoints
      : options.applyPoints && !(markerProvided && !markerMissing);
    let targetChanged = false;

    const badgeProvided = hasOwn(options, 'badgeId');
    const currentBadges = Array.isArray(target.badges) ? target.badges : [];
    const badgeAlreadyDesired =
      badgeProvided &&
      (options.badgeAction === 'grant'
        ? currentBadges.includes(options.badgeId)
        : !currentBadges.includes(options.badgeId));

    if (!existing && badgeAlreadyDesired) {
      const claimRow = {
        ...row,
        claim_type: 'badge_noop',
        mutation_meta: requestedMeta,
        mutation_applied: false,
        previous_points: previousPoints,
        resulting_points: previousPoints,
      };
      next.scoreMutationClaims.push(claimRow);
      claimsById.set(String(row.id), claimRow);
      changedCollections.add('score_mutation_claims');
      result.noop_award_ids.push(row.id);
      result.results.push({
        id: row.id,
        status: 'noop',
        applied: false,
        replayed: false,
        pointsApplied: false,
        previousPoints,
        resultingPoints: previousPoints,
      });
      return;
    }

    if (shouldApplyPoints) {
      target.points = previousPoints + row.amount;
      targetChanged = true;
    }
    if (!existing && badgeProvided) {
      const badges = new Set(currentBadges);
      if (options.badgeAction === 'grant') badges.add(options.badgeId);
      else badges.delete(options.badgeId);
      target.badges = [...badges];
      targetChanged = true;
    }
    if (markerProvided && (!existing || legacyRepair)) {
      if (target.lastWeekRewarded !== options.lastWeekRewarded) {
        target.lastWeekRewarded = options.lastWeekRewarded;
        targetChanged = true;
      }
    }

    const resultingPoints = Number(target.points) || 0;
    if (targetChanged) changedCollections.add(row.target === 'student' ? 'students' : 'groups');
    if (existing) {
      existing.mutation_meta = requestedMeta;
      existing.mutation_applied = markerMissing ? shouldApplyPoints : true;
      existing.previous_points = previousPoints;
      existing.resulting_points = resultingPoints;
      changedCollections.add('awards');
      result.repaired_award_ids.push(row.id);
      result.results.push({
        id: row.id,
        status: 'repaired',
        applied: true,
        replayed: false,
        pointsApplied: shouldApplyPoints,
        previousPoints,
        resultingPoints,
      });
      return;
    }

    const storedAward = {
      ...row,
      mutation_meta: requestedMeta,
      mutation_applied: shouldApplyPoints,
      previous_points: previousPoints,
      resulting_points: resultingPoints,
    };
    next.awards.push(storedAward);
    awardsById.set(String(row.id), storedAward);
    changedCollections.add('awards');
    result.applied_award_ids.push(row.id);
    result.results.push({
      id: row.id,
      status: 'applied',
      applied: true,
      replayed: false,
      pointsApplied: shouldApplyPoints,
      previousPoints,
      resultingPoints,
    });
  });

  const peerAwardsById = new Map(next.peerAwards.map((row) => [String(row.id), row]));
  requestedPeerAwards.forEach(({ row, timestampProvided }) => {
    const existing = peerAwardsById.get(String(row.id));
    if (
      existing &&
      !rowsEqualForReplay(canonicalPeerAward(existing), row, timestampProvided)
    ) {
      fail(`peer award ${row.id} already exists with different data`, {
        code: 'peer_award_id_conflict',
        statusCode: 409,
      });
    }
    if (existing) {
      result.replayed_peer_award_ids.push(row.id);
      return;
    }
    next.peerAwards.push(row);
    peerAwardsById.set(String(row.id), row);
    changedCollections.add('peer_awards');
    result.applied_peer_award_ids.push(row.id);
  });

  return {
    state: next,
    result: finishResult(result, requestedAwards.length, requestedPeerAwards.length),
    changedCollections: [...changedCollections],
  };
}

module.exports = {
  ScoreMutationError,
  applyScoreMutationsToState,
};
