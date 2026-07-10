const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const {
  ScoreMutationError,
  applyScoreMutationsToState,
} = require('../server/scoreMutations');
const { createDataStore } = require('../server/dataStore');

const NOW = '2026-07-10T10:00:00.000Z';
const DEFAULT_PEER_EVENT = {
  id: 'event-1',
  budget: 20,
  active: true,
  allowOwnGroup: true,
  allowOtherGroups: true,
  semesterId: 'semester-1',
};

const makeState = (overrides = {}) => ({
  students: [
    {
      id: 'student-1',
      points: 10,
      badges: [],
      groupId: 'group-1',
      semesterId: 'semester-1',
    },
    {
      id: 'student-2',
      points: 0,
      badges: [],
      groupId: 'group-2',
      semesterId: 'semester-1',
    },
  ],
  groups: [
    { id: 'group-1', points: 5, semesterId: 'semester-1' },
    { id: 'group-2', points: 0, semesterId: 'semester-1' },
  ],
  awards: [],
  peerAwards: [],
  peerEvents: [{ ...DEFAULT_PEER_EVENT }],
  scoreMutationClaims: [],
  ...overrides,
});

const makeAward = (overrides = {}) => ({
  id: 'award-1',
  target: 'student',
  target_id: 'student-1',
  amount: 5,
  reason: 'Goed gedaan',
  ...overrides,
});

const makePeerAward = (overrides = {}) => ({
  id: 'peer-1',
  from_student_id: 'student-1',
  event_id: 'event-1',
  target: 'student',
  target_id: 'student-2',
  amount: 20,
  total_amount: 20,
  reason: 'Peer feedback',
  recipients: ['student-2'],
  ...overrides,
});

const applyPure = (state, args) =>
  applyScoreMutationsToState(state, args, { now: () => NOW });

describe('pure score mutations', () => {
  test('updates points and persists award audit metadata', () => {
    const original = makeState();
    const { state, result, changedCollections } = applyPure(original, {
      p_awards: [
        makeAward({ badgeId: 'eeg', badgeAction: 'grant' }),
        makeAward({
          id: 'award-2',
          target: 'group',
          target_id: 'group-1',
          amount: -2,
          reason: 'Correctie',
        }),
      ],
    });

    expect(state.students[0]).toMatchObject({ points: 15, badges: ['eeg'] });
    expect(state.groups[0].points).toBe(3);
    expect(state.awards).toEqual([
      expect.objectContaining({
        id: 'award-1',
        ts: NOW,
        target: 'student',
        target_id: 'student-1',
        semesterId: null,
        amount: 5,
        reason: 'Goed gedaan',
        mutation_meta: {
          applyPoints: true,
          repairPointsWhenMarkerMissing: false,
          badgeId: 'eeg',
          badgeAction: 'grant',
        },
        mutation_applied: true,
        previous_points: 10,
        resulting_points: 15,
      }),
      expect.objectContaining({
        id: 'award-2',
        ts: NOW,
        target: 'group',
        target_id: 'group-1',
        semesterId: null,
        amount: -2,
        reason: 'Correctie',
        mutation_meta: {
          applyPoints: true,
          repairPointsWhenMarkerMissing: false,
        },
        mutation_applied: true,
        previous_points: 5,
        resulting_points: 3,
      }),
    ]);
    expect(changedCollections).toEqual(
      expect.arrayContaining(['students', 'groups', 'awards'])
    );
    expect(result).toMatchObject({ applied: true, replayed: false, peerApplied: false });
    expect(result.applied_award_ids).toEqual(['award-1', 'award-2']);
    expect(original.students[0]).toMatchObject({
      id: 'student-1',
      points: 10,
      badges: [],
    });
    expect(original.awards).toEqual([]);
  });

  test.each([
    ['grant', ['eeg'], 50],
    ['revoke', [], -50],
  ])('treats an already desired badge %s as a no-op without an award', (action, badges, amount) => {
    const { state, result, changedCollections } = applyPure(
      makeState({ students: [{ id: 'student-1', points: 10, badges }] }),
      {
        p_awards: [
          makeAward({
            amount,
            badgeId: 'eeg',
            badgeAction: action,
          }),
        ],
      }
    );

    expect(state.students[0]).toEqual({ id: 'student-1', points: 10, badges });
    expect(state.awards).toEqual([]);
    expect(state.scoreMutationClaims).toEqual([
      expect.objectContaining({
        id: 'award-1',
        claim_type: 'badge_noop',
        mutation_applied: false,
        previous_points: 10,
        resulting_points: 10,
      }),
    ]);
    expect(result).toMatchObject({ applied: true, replayed: false });
    expect(result.noop_award_ids).toEqual(['award-1']);
    expect(changedCollections).toEqual(['score_mutation_claims']);
  });

  test('replays a durable badge no-op claim after badge state changes', () => {
    const request = makeAward({
      ts: NOW,
      amount: 50,
      badgeId: 'eeg',
      badgeAction: 'grant',
    });
    const first = applyPure(
      makeState({ students: [{ id: 'student-1', points: 10, badges: ['eeg'] }] }),
      { p_awards: [request] }
    );
    const changedAfterClaim = {
      ...first.state,
      students: [{ id: 'student-1', points: 10, badges: [] }],
    };
    const replay = applyPure(changedAfterClaim, { p_awards: [request] });

    expect(replay.state.students[0]).toEqual({
      id: 'student-1',
      points: 10,
      badges: [],
    });
    expect(replay.state.awards).toEqual([]);
    expect(replay.state.scoreMutationClaims).toHaveLength(1);
    expect(replay.result.replayed_award_ids).toEqual(['award-1']);

    expect(() =>
      applyPure(changedAfterClaim, {
        p_awards: [{ ...request, reason: 'Andere payload' }],
      })
    ).toThrow(expect.objectContaining({ code: 'award_id_conflict' }));
  });

  test('replays an existing award without applying points twice and rejects ID collisions', () => {
    const existing = {
      id: 'award-1',
      ts: '2026-07-01T10:00:00.000Z',
      target: 'student',
      target_id: 'student-1',
      semesterId: null,
      amount: 5,
      reason: 'Goed gedaan',
    };
    const state = makeState({ awards: [existing] });
    const replay = applyPure(state, { p_awards: [makeAward()] });

    expect(replay.state.students[0].points).toBe(10);
    expect(replay.state.awards).toHaveLength(1);
    expect(replay.result).toMatchObject({ applied: false, replayed: true });
    expect(replay.result.replayed_award_ids).toEqual(['award-1']);

    expect(() =>
      applyPure(state, { p_awards: [makeAward({ amount: 6 })] })
    ).toThrow(
      expect.objectContaining({
        name: 'ScoreMutationError',
        code: 'award_id_conflict',
        statusCode: 409,
      })
    );
    expect(state.students[0].points).toBe(10);
  });

  test('repairs a weekly marker exactly once when its stable award already exists', () => {
    const award = {
      ...makeAward({ amount: 50, reason: 'Aanwezigheidsstreak 2026-W27' }),
      ts: '2026-07-01T10:00:00.000Z',
      semesterId: null,
    };
    const request = {
      ...makeAward({
        ts: NOW,
        amount: 50,
        reason: 'Aanwezigheidsstreak 2026-W27',
      }),
      lastWeekRewarded: '2026-W27',
      repairPointsWhenMarkerMissing: true,
    };
    const first = applyPure(makeState({ awards: [award] }), { p_awards: [request] });

    expect(first.state.students[0]).toMatchObject({
      points: 60,
      lastWeekRewarded: '2026-W27',
    });
    expect(first.state.awards).toHaveLength(1);
    expect(first.result.repaired_award_ids).toEqual(['award-1']);

    const second = applyPure(first.state, { p_awards: [request] });
    expect(second.state.students[0].points).toBe(60);
    expect(second.result.repaired_award_ids).toEqual([]);
  });

  test('never reapplies an RPC-owned old weekly award after a newer marker', () => {
    const request = {
      ...makeAward({
        ts: NOW,
        amount: 50,
        reason: 'Aanwezigheidsstreak 2026-W27',
      }),
      lastWeekRewarded: '2026-W27',
      repairPointsWhenMarkerMissing: true,
    };
    const first = applyPure(makeState(), { p_awards: [request] });
    const afterNewerWeek = {
      ...first.state,
      students: [
        {
          ...first.state.students[0],
          points: 110,
          lastWeekRewarded: '2026-W28',
        },
      ],
    };
    const replay = applyPure(afterNewerWeek, { p_awards: [request] });

    expect(replay.state.students[0]).toMatchObject({
      points: 110,
      lastWeekRewarded: '2026-W28',
    });
    expect(replay.result.repaired_award_ids).toEqual([]);
    expect(replay.result.replayed_award_ids).toEqual(['award-1']);
  });

  test('does not repair a legacy weekly award behind a newer week marker', () => {
    const legacyAward = {
      ...makeAward({ amount: 50, reason: 'Aanwezigheidsstreak 2026-W27' }),
      ts: '2026-07-01T10:00:00.000Z',
      semesterId: null,
    };
    const state = makeState({
      students: [
        {
          id: 'student-1',
          points: 110,
          badges: [],
          lastWeekRewarded: '2026-W28',
        },
      ],
      awards: [legacyAward],
    });
    const result = applyPure(state, {
      p_awards: [
        makeAward({
          amount: 50,
          reason: 'Aanwezigheidsstreak 2026-W27',
          lastWeekRewarded: '2026-W27',
          repairPointsWhenMarkerMissing: true,
        }),
      ],
    });

    expect(result.state.students[0]).toMatchObject({
      points: 110,
      lastWeekRewarded: '2026-W28',
    });
    expect(result.result).toMatchObject({ replayed: true, applied: false });
  });

  test('rejects a new weekly award behind a newer week marker', () => {
    const state = makeState({
      students: [
        {
          id: 'student-1',
          points: 110,
          badges: [],
          lastWeekRewarded: '2026-W28',
        },
      ],
    });

    expect(() =>
      applyPure(state, {
        p_awards: [
          makeAward({
            id: 'award-old-week',
            amount: 50,
            reason: 'Aanwezigheidsstreak 2026-W27',
            lastWeekRewarded: '2026-W27',
            repairPointsWhenMarkerMissing: true,
          }),
        ],
      })
    ).toThrow(expect.objectContaining({ code: 'stale_week_marker' }));
    expect(state.students[0]).toMatchObject({
      points: 110,
      lastWeekRewarded: '2026-W28',
    });
    expect(state.awards).toEqual([]);
  });

  test('inserts missing weekly history without adding points when the marker exists', () => {
    const state = makeState({
      students: [
        {
          id: 'student-1',
          points: 60,
          badges: [],
          lastWeekRewarded: '2026-W27',
        },
      ],
    });
    const { state: next } = applyPure(state, {
      p_awards: [
        makeAward({
          amount: 50,
          reason: 'Aanwezigheidsstreak 2026-W27',
          lastWeekRewarded: '2026-W27',
          repairPointsWhenMarkerMissing: true,
        }),
      ],
    });

    expect(next.students[0].points).toBe(60);
    expect(next.awards).toHaveLength(1);
  });

  test('can insert history without applying points', () => {
    const { state } = applyPure(makeState(), {
      p_awards: [makeAward({ applyPoints: false })],
    });
    expect(state.students[0].points).toBe(10);
    expect(state.awards).toHaveLength(1);
  });

  test('rejects unsupported award extras and invalid badge signs', () => {
    expect(() =>
      applyPure(makeState(), { p_awards: [makeAward({ badges: ['eeg'] })] })
    ).toThrow(ScoreMutationError);
    expect(() =>
      applyPure(makeState(), {
        p_awards: [makeAward({ amount: -50, badgeId: 'eeg', badgeAction: 'grant' })],
      })
    ).toThrow(ScoreMutationError);
  });

  test('validates a peer event and atomically applies its score and log', () => {
    const { state, result } = applyPure(makeState(), {
      p_awards: [makeAward({ target_id: 'student-2', amount: 20 })],
      p_peer_awards: [makePeerAward()],
    });

    expect(state.students[0].points).toBe(10);
    expect(state.students[1].points).toBe(20);
    expect(state.awards).toHaveLength(1);
    expect(state.peerAwards).toHaveLength(1);
    expect(state.peerAwards[0].ts).toBe(NOW);
    expect(result).toMatchObject({ applied: true, replayed: false, peerApplied: true });
  });

  test('honors a legacy recipientScope when boolean event flags are absent', () => {
    const { state } = applyPure(
      makeState({
        peerEvents: [
          {
            id: 'event-1',
            budget: 20,
            active: true,
            recipientScope: 'all',
            semesterId: 'semester-1',
          },
        ],
      }),
      {
        p_awards: [makeAward({ target_id: 'student-2', amount: 20 })],
        p_peer_awards: [makePeerAward()],
      }
    );

    expect(state.students[1].points).toBe(20);
    expect(state.peerAwards).toHaveLength(1);
  });

  test('accepts another-group awards only with the exact current member list', () => {
    const groupPeerAward = makePeerAward({
      target: 'group',
      target_id: 'group-2',
      recipients: ['student-2'],
    });
    const otherGroupsEvent = {
      ...DEFAULT_PEER_EVENT,
      allowOwnGroup: false,
      allowOtherGroups: true,
    };
    const applied = applyPure(
      makeState({ peerEvents: [otherGroupsEvent] }),
      {
        p_awards: [
          makeAward({ target: 'group', target_id: 'group-2', amount: 20 }),
        ],
        p_peer_awards: [groupPeerAward],
      }
    );

    expect(applied.state.groups[1].points).toBe(20);
    expect(applied.state.peerAwards[0].recipients).toEqual(['student-2']);

    expect(() =>
      applyPure(makeState({ peerEvents: [otherGroupsEvent] }), {
        p_awards: [
          makeAward({ target: 'group', target_id: 'group-2', amount: 20 }),
        ],
        p_peer_awards: [
          { ...groupPeerAward, recipients: ['student-1', 'student-2'] },
        ],
      })
    ).toThrow(expect.objectContaining({ code: 'peer_scope_violation' }));
  });

  test('rejects a target group containing a student from another semester', () => {
    const baseState = makeState();
    const state = makeState({
      students: [
        baseState.students[0],
        { ...baseState.students[1], semesterId: 'semester-2' },
      ],
      peerEvents: [
        {
          ...DEFAULT_PEER_EVENT,
          allowOwnGroup: false,
          allowOtherGroups: true,
        },
      ],
    });

    expect(() =>
      applyPure(state, {
        p_awards: [
          makeAward({ target: 'group', target_id: 'group-2', amount: 20 }),
        ],
        p_peer_awards: [
          makePeerAward({
            target: 'group',
            target_id: 'group-2',
            recipients: ['student-2'],
          }),
        ],
      })
    ).toThrow(expect.objectContaining({ code: 'peer_scope_violation' }));
  });

  test('accepts only an exact peer payload replay and rejects a different submission', () => {
    const args = {
      p_awards: [makeAward({ target_id: 'student-2', amount: 20 })],
      p_peer_awards: [makePeerAward()],
    };
    const first = applyPure(makeState(), args);
    const replay = applyPure(first.state, args);

    expect(replay.state).toEqual(first.state);
    expect(replay.result).toMatchObject({
      applied: false,
      replayed: true,
      peerApplied: false,
      peer_replay: true,
    });
    expect(replay.result.replayed_peer_award_ids).toEqual(['peer-1']);

    const inactiveReplay = applyPure(
      {
        ...first.state,
        peerEvents: [{ ...DEFAULT_PEER_EVENT, active: false }],
      },
      args
    );
    expect(inactiveReplay.result).toMatchObject({ replayed: true, peer_replay: true });

    expect(() =>
      applyPure(first.state, {
        ...args,
        p_peer_awards: [makePeerAward({ id: 'peer-2' })],
      })
    ).toThrow(
      expect.objectContaining({
        code: 'peer_submission_conflict',
        statusCode: 409,
      })
    );
  });

  test('rejects a peer self-award', () => {
    const state = makeState();
    expect(() =>
      applyPure(state, {
        p_awards: [makeAward({ target_id: 'student-1', amount: 20 })],
        p_peer_awards: [
          makePeerAward({ target_id: 'student-1', recipients: ['student-1'] }),
        ],
      })
    ).toThrow(expect.objectContaining({ code: 'peer_scope_violation' }));
    expect(state.students[0].points).toBe(10);
    expect(state.awards).toEqual([]);
  });

  test('rejects incorrect student recipients and an incompatible target scope', () => {
    const validScoreAward = makeAward({ target_id: 'student-2', amount: 20 });
    expect(() =>
      applyPure(makeState(), {
        p_awards: [validScoreAward],
        p_peer_awards: [makePeerAward({ recipients: ['student-1'] })],
      })
    ).toThrow(expect.objectContaining({ code: 'peer_scope_violation' }));

    expect(() =>
      applyPure(
        makeState({
          peerEvents: [
            {
              ...DEFAULT_PEER_EVENT,
              allowOwnGroup: false,
              allowOtherGroups: true,
            },
          ],
        }),
        {
          p_awards: [validScoreAward],
          p_peer_awards: [makePeerAward()],
        }
      )
    ).toThrow(expect.objectContaining({ code: 'peer_scope_violation' }));
  });

  test('requires a one-to-one peer and score-award multiset match', () => {
    const state = makeState();
    expect(() =>
      applyPure(state, {
        p_awards: [
          makeAward({ id: 'award-1', target_id: 'student-2', amount: 10 }),
          makeAward({
            id: 'award-2',
            target: 'group',
            target_id: 'group-1',
            amount: 10,
          }),
        ],
        p_peer_awards: [
          makePeerAward({
            id: 'peer-1',
            target_id: 'student-2',
            amount: 10,
            total_amount: 10,
            recipients: ['student-2'],
          }),
          makePeerAward({
            id: 'peer-2',
            target_id: 'student-2',
            amount: 10,
            total_amount: 10,
            recipients: ['student-2'],
          }),
        ],
      })
    ).toThrow(expect.objectContaining({ code: 'peer_score_mismatch' }));
    expect(state.students[1].points).toBe(0);
    expect(state.awards).toEqual([]);
  });

  test('rejects peer score awards that suppress points or carry side-effect options', () => {
    expect(() =>
      applyPure(makeState(), {
        p_awards: [
          makeAward({ target_id: 'student-2', amount: 20, applyPoints: false }),
        ],
        p_peer_awards: [makePeerAward()],
      })
    ).toThrow(expect.objectContaining({ code: 'peer_score_options_invalid' }));
  });

  test.each([
    ['missing', [], 'peer_event_not_found'],
    ['inactive', [{ ...DEFAULT_PEER_EVENT, active: false }], 'peer_event_inactive'],
    ['wrong budget', [{ ...DEFAULT_PEER_EVENT, budget: 21 }], 'peer_budget_mismatch'],
  ])('rejects a %s peer event before changing state', (_label, peerEvents, code) => {
    const state = makeState({ peerEvents });
    expect(() =>
      applyPure(state, {
        p_awards: [makeAward({ target_id: 'student-2', amount: 20 })],
        p_peer_awards: [makePeerAward()],
      })
    ).toThrow(expect.objectContaining({ code }));
    expect(state.students[0].points).toBe(10);
    expect(state.awards).toEqual([]);
  });

  test('does not expose partial changes when a later mutation is invalid', () => {
    const state = makeState();
    expect(() =>
      applyPure(state, {
        p_awards: [
          makeAward(),
          makeAward({ id: 'award-2', target_id: 'missing-student' }),
        ],
      })
    ).toThrow(expect.objectContaining({ code: 'score_target_not_found' }));
    expect(state.students[0].points).toBe(10);
    expect(state.awards).toEqual([]);
  });
});

describe('file-backed score mutation transaction', () => {
  let dataDir;

  beforeEach(async () => {
    dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'hon-score-mutations-'));
  });

  afterEach(async () => {
    await fs.rm(dataDir, { recursive: true, force: true });
  });

  const seedStore = async (store) => {
    await store.writeData('students', [
      { id: 'student-1', name: 'Een', points: 0, badges: [] },
      { id: 'student-2', name: 'Twee', points: 0, badges: [] },
    ]);
    await store.writeData('groups', []);
    await store.writeData('awards', []);
    await store.writeData('peer_awards', []);
    await store.writeData('peer_events', []);
    await store.writeData('score_mutation_claims', []);
  };

  test('serializes concurrent increments without losing awards', async () => {
    const store = createDataStore({ dataDir, seedDir: dataDir });
    await seedStore(store);

    await Promise.all(
      Array.from({ length: 25 }, (_, index) =>
        store.applyScoreMutations([
          makeAward({ id: `award-${index}`, amount: 1, reason: `Punt ${index}` }),
        ])
      )
    );

    const students = await store.readData('students');
    const awards = await store.readData('awards');
    expect(students.find((row) => row.id === 'student-1').points).toBe(25);
    expect(awards).toHaveLength(25);
    expect(new Set(awards.map((row) => row.id)).size).toBe(25);
  });

  test('rolls an earlier file back when a later atomic rename fails', async () => {
    let failAwardsRename = false;
    const fileOps = {
      readFile: fs.readFile,
      mkdir: fs.mkdir,
      writeFile: fs.writeFile,
      unlink: fs.unlink,
      rename: async (from, to) => {
        if (failAwardsRename && to === path.join(dataDir, 'awards.json')) {
          failAwardsRename = false;
          const error = new Error('injected awards rename failure');
          error.code = 'EIO';
          throw error;
        }
        return fs.rename(from, to);
      },
    };
    const store = createDataStore({ dataDir, seedDir: dataDir, fileOps });
    await seedStore(store);
    failAwardsRename = true;

    await expect(store.applyScoreMutations([makeAward()])).rejects.toThrow(
      'injected awards rename failure'
    );

    expect((await store.readData('students'))[0].points).toBe(0);
    expect(await store.readData('awards')).toEqual([]);
  });

  test('persists badge no-op claims and replays them after a state change', async () => {
    const store = createDataStore({ dataDir, seedDir: dataDir });
    await seedStore(store);
    await store.patchData('students', 'id', 'student-1', { badges: ['eeg'] });
    const request = makeAward({
      ts: NOW,
      amount: 50,
      badgeId: 'eeg',
      badgeAction: 'grant',
    });

    await store.applyScoreMutations([request]);
    expect(await store.readData('score_mutation_claims')).toEqual([
      expect.objectContaining({ id: 'award-1', claim_type: 'badge_noop' }),
    ]);
    await store.patchData('students', 'id', 'student-1', { badges: [] });
    const replay = await store.applyScoreMutations([request]);

    expect(replay.replayed_award_ids).toEqual(['award-1']);
    expect((await store.readData('students'))[0]).toMatchObject({
      points: 0,
      badges: [],
    });
    expect(await store.readData('awards')).toEqual([]);
  });

  test('rolls students and awards back when the claim-file commit fails', async () => {
    let failClaimRename = false;
    const fileOps = {
      readFile: fs.readFile,
      mkdir: fs.mkdir,
      writeFile: fs.writeFile,
      unlink: fs.unlink,
      rename: async (from, to) => {
        if (
          failClaimRename &&
          to === path.join(dataDir, 'score_mutation_claims.json')
        ) {
          failClaimRename = false;
          const error = new Error('injected claim rename failure');
          error.code = 'EIO';
          throw error;
        }
        return fs.rename(from, to);
      },
    };
    const store = createDataStore({ dataDir, seedDir: dataDir, fileOps });
    await seedStore(store);
    failClaimRename = true;

    await expect(
      store.applyScoreMutations([
        makeAward({ id: 'award-normal', target_id: 'student-2', amount: 5 }),
        makeAward({
          id: 'award-noop',
          amount: -50,
          badgeId: 'eeg',
          badgeAction: 'revoke',
        }),
      ])
    ).rejects.toThrow('injected claim rename failure');

    expect((await store.readData('students')).map((row) => row.points)).toEqual([0, 0]);
    expect(await store.readData('awards')).toEqual([]);
    expect(await store.readData('score_mutation_claims')).toEqual([]);
  });

  test('serializes field patches and deletes with score transactions', async () => {
    const store = createDataStore({ dataDir, seedDir: dataDir });
    await seedStore(store);

    await Promise.all([
      store.applyScoreMutations([makeAward({ amount: 7 })]),
      store.patchData('students', 'id', 'student-2', { name: 'Aangepast' }),
    ]);
    await Promise.all([
      store.applyScoreMutations([makeAward({ id: 'award-2', amount: 3 })]),
      store.deleteData('students', 'id', ['student-2']),
    ]);

    const students = await store.readData('students');
    expect(students).toEqual([
      expect.objectContaining({ id: 'student-1', points: 10, name: 'Een' }),
    ]);
    expect(await store.readData('awards')).toHaveLength(2);
  });
});
