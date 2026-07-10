describe('local Supabase mutation adapter', () => {
  let originalFetch;
  let originalUseLocalServer;
  let originalApiBase;
  let consoleLogSpy;
  let consoleWarnSpy;
  let consoleErrorSpy;

  beforeEach(() => {
    jest.resetModules();
    originalFetch = global.fetch;
    originalUseLocalServer = process.env.REACT_APP_USE_LOCAL_SERVER;
    originalApiBase = process.env.REACT_APP_API_BASE;
    process.env.REACT_APP_USE_LOCAL_SERVER = 'true';
    process.env.REACT_APP_API_BASE = '/api';
    global.fetch = jest.fn();
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    global.fetch = originalFetch;
    if (originalUseLocalServer === undefined) delete process.env.REACT_APP_USE_LOCAL_SERVER;
    else process.env.REACT_APP_USE_LOCAL_SERVER = originalUseLocalServer;
    if (originalApiBase === undefined) delete process.env.REACT_APP_API_BASE;
    else process.env.REACT_APP_API_BASE = originalApiBase;
    consoleLogSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    jest.resetModules();
  });

  const response = (payload = {}, options = {}) => ({
    ok: options.ok ?? true,
    status: options.status ?? 200,
    json: jest.fn().mockResolvedValue(payload),
  });

  test('maps apply_score_mutations RPC arguments to the atomic local route', async () => {
    global.fetch.mockResolvedValue(
      response({ applied: true, replayed: false, peerApplied: false })
    );
    const { supabase } = require('./supabase');
    const args = { p_awards: [{ id: 'award-1' }], p_peer_awards: [] };

    await expect(supabase.rpc('apply_score_mutations', args)).resolves.toEqual({
      data: { applied: true, replayed: false, peerApplied: false },
      error: null,
    });
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/score-mutations$/),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify(args),
      })
    );
  });

  test('returns the server error code and status from the local RPC', async () => {
    global.fetch.mockResolvedValue(
      response(
        { error: 'collision', code: 'award_id_conflict' },
        { ok: false, status: 409 }
      )
    );
    const { supabase } = require('./supabase');

    const result = await supabase.rpc('apply_score_mutations', {
      p_awards: [],
      p_peer_awards: [],
    });
    expect(result.data).toBeNull();
    expect(result.error).toMatchObject({
      message: 'collision',
      code: 'award_id_conflict',
      status: 409,
    });
  });

  test('uses a targeted PATCH instead of GET plus whole-table PUT', async () => {
    global.fetch.mockResolvedValue(response([]));
    const { supabase } = require('./supabase');

    await expect(
      supabase.from('students').update({ name: 'Nieuw' }).eq('id', 'student-1')
    ).resolves.toEqual({ data: null, error: null });
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/students$/),
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({
          field: 'id',
          value: 'student-1',
          updates: { name: 'Nieuw' },
        }),
      })
    );
  });

  test('uses targeted DELETE requests for eq and in filters', async () => {
    global.fetch.mockResolvedValue(response([]));
    const { supabase } = require('./supabase');
    const table = supabase.from('students');

    await table.delete().eq('id', 'student-1');
    await table.delete().in('id', ['student-2', 'student-3']);

    expect(global.fetch).toHaveBeenNthCalledWith(
      1,
      expect.stringMatching(/\/api\/students$/),
      expect.objectContaining({
        method: 'DELETE',
        body: JSON.stringify({ field: 'id', value: 'student-1' }),
      })
    );
    expect(global.fetch).toHaveBeenNthCalledWith(
      2,
      expect.stringMatching(/\/api\/students$/),
      expect.objectContaining({
        method: 'DELETE',
        body: JSON.stringify({ field: 'id', values: ['student-2', 'student-3'] }),
      })
    );
  });
});
