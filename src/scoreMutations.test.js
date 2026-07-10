import { ensureSession, supabase } from './supabase';
import applyScoreMutations, { toRpcAward, toRpcPeerAward } from './scoreMutations';

jest.mock('./supabase', () => ({
  ensureSession: jest.fn(),
  supabase: { rpc: jest.fn() },
}));

describe('applyScoreMutations', () => {
  beforeEach(() => {
    ensureSession.mockResolvedValue({ user: { id: 'test-user' } });
    supabase.rpc.mockResolvedValue({ data: { applied: true }, error: null });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('sends normalized score and peer mutations through one RPC', async () => {
    const result = await applyScoreMutations({
      awards: [
        {
          id: 'award-1',
          ts: '2026-07-10T10:00:00.000Z',
          target: 'student',
          target_id: 'student-1',
          amount: '5',
          reason: 'Goed gedaan',
        },
      ],
      peerAwards: [
        {
          id: 'peer-1',
          event_id: 'event-1',
          event_title: 'Verbeterweek',
          from_student_id: 'student-2',
          target: 'student',
          target_id: 'student-1',
          amount: '5',
          total_amount: '5',
        },
      ],
    });

    expect(result).toEqual({ data: { applied: true }, error: null });
    expect(supabase.rpc).toHaveBeenCalledWith('apply_score_mutations', {
      p_awards: [
        expect.objectContaining({
          id: 'award-1',
          amount: 5,
        }),
      ],
      p_peer_awards: [
        expect.not.objectContaining({ event_title: expect.anything() }),
      ],
    });
  });

  test('normalizes valid badge, weekly and peer metadata', () => {
    expect(
      toRpcAward({
        id: 'badge-1',
        target: 'student',
        target_id: 'student-1',
        amount: 50,
        badgeId: 'eeg',
        badgeAction: 'grant',
      })
    ).toEqual(
      expect.objectContaining({ badgeId: 'eeg', badgeAction: 'grant', amount: 50 })
    );
    expect(
      toRpcAward({
        id: 'week-1',
        target: 'student',
        target_id: 'student-1',
        amount: 50,
        lastWeekRewarded: '2026-W27',
        repairPointsWhenMarkerMissing: true,
      })
    ).toEqual(
      expect.objectContaining({
        lastWeekRewarded: '2026-W27',
        repairPointsWhenMarkerMissing: true,
      })
    );
    expect(
      toRpcPeerAward({
        id: 'peer-1',
        amount: 5,
        total_amount: 5,
      }).ts
    ).toEqual(expect.any(String));
  });

  test('rejects invalid targets and fractional points before opening a session', async () => {
    const invalidTarget = await applyScoreMutations({
      awards: [{ id: 'a', target: 'class', target_id: 'x', amount: 1 }],
    });
    const fractional = await applyScoreMutations({
      awards: [{ id: 'b', target: 'student', target_id: 'x', amount: 1.5 }],
    });
    const zero = await applyScoreMutations({
      awards: [{ id: 'c', target: 'student', target_id: 'x', amount: 0 }],
    });

    expect(invalidTarget.error).toBeInstanceOf(Error);
    expect(fractional.error).toBeInstanceOf(Error);
    expect(zero.error).toBeInstanceOf(Error);
    expect(ensureSession).not.toHaveBeenCalled();
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  test('rejects invalid combinations of badge and weekly options', async () => {
    const result = await applyScoreMutations({
      awards: [
        {
          id: 'a',
          target: 'student',
          target_id: 'student-1',
          amount: 50,
          badgeId: 'eeg',
          badgeAction: 'grant',
          lastWeekRewarded: '2026-W27',
        },
      ],
    });

    expect(result.error).toBeInstanceOf(Error);
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  test('rejects peer rows that do not match score mutations one-to-one', async () => {
    const result = await applyScoreMutations({
      awards: [
        {
          id: 'award-1',
          target: 'student',
          target_id: 'student-1',
          amount: 5,
        },
        {
          id: 'award-2',
          target: 'student',
          target_id: 'student-2',
          amount: 5,
        },
      ],
      peerAwards: [
        {
          id: 'peer-1',
          target: 'student',
          target_id: 'student-1',
          amount: 5,
          total_amount: 5,
        },
        {
          id: 'peer-2',
          target: 'student',
          target_id: 'student-1',
          amount: 5,
          total_amount: 5,
        },
      ],
    });

    expect(result.error).toBeInstanceOf(Error);
    expect(result.error.message).toMatch(/één-op-één/);
    expect(ensureSession).not.toHaveBeenCalled();
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  test('rejects peer score mutations with badge or week side effects', async () => {
    const result = await applyScoreMutations({
      awards: [
        {
          id: 'award-1',
          target: 'student',
          target_id: 'student-1',
          amount: 5,
          lastWeekRewarded: '2026-W27',
        },
      ],
      peerAwards: [
        {
          id: 'peer-1',
          target: 'student',
          target_id: 'student-1',
          amount: 5,
          total_amount: 5,
        },
      ],
    });

    expect(result.error).toBeInstanceOf(Error);
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  test('returns session and RPC failures without throwing', async () => {
    const sessionError = new Error('offline');
    ensureSession.mockRejectedValueOnce(sessionError);
    expect(
      await applyScoreMutations({
        awards: [{ id: 'a', target: 'student', target_id: 'x', amount: 1 }],
      })
    ).toEqual({ data: null, error: sessionError });

    const rpcError = new Error('transaction failed');
    supabase.rpc.mockResolvedValueOnce({ data: null, error: rpcError });
    expect(
      await applyScoreMutations({
        awards: [{ id: 'b', target: 'group', target_id: 'g1', amount: -2 }],
      })
    ).toEqual({ data: null, error: rpcError });
  });
});
