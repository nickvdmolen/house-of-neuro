import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { ensureSession, supabase } from '../supabase';
import useSupabaseTable from './useSupabaseTable';

jest.mock('../supabase', () => ({
  ensureSession: jest.fn(),
  supabase: { from: jest.fn() },
}));

let latestHookValue;

function HookHarness() {
  const [rows, update, api] = useSupabaseTable('awards', {
    autoSave: false,
    preserveLocalRowsOnFetch: true,
  });
  latestHookValue = { rows, update, api };
  return null;
}

describe('useSupabaseTable inserts', () => {
  let container;
  let root;
  let insert;
  let consoleErrorSpy;

  beforeEach(async () => {
    global.IS_REACT_ACT_ENVIRONMENT = true;
    latestHookValue = null;
    insert = jest.fn();
    ensureSession.mockResolvedValue({ user: { id: 'test-user' } });
    supabase.from.mockImplementation(() => ({
      select: jest.fn().mockResolvedValue({ data: [], error: null }),
      insert,
    }));
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root.render(<HookHarness />);
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(latestHookValue.api.loaded).toBe(true);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    consoleErrorSpy.mockRestore();
    jest.clearAllMocks();
    delete global.IS_REACT_ACT_ENVIRONMENT;
  });

  test('inserts multiple rows with one targeted request', async () => {
    const rows = [{ id: 'award-1' }, { id: 'award-2' }];
    insert.mockResolvedValue({ error: null });

    let result;
    await act(async () => {
      result = await latestHookValue.api.insertRows(rows);
    });

    expect(result).toEqual({ error: null });
    expect(insert).toHaveBeenCalledWith(rows);
    expect(latestHookValue.rows).toEqual(rows);
  });

  test('rolls back optimistic rows when the insert fails', async () => {
    const insertError = new Error('insert failed');
    insert.mockResolvedValue({ error: insertError });

    let result;
    await act(async () => {
      result = await latestHookValue.api.insertRows([{ id: 'award-1' }]);
    });

    expect(result).toEqual({ error: insertError });
    expect(latestHookValue.rows).toEqual([]);
  });

  test('keeps an existing row when a duplicate insert fails', async () => {
    const existingRow = { id: 'award-1', reason: 'existing' };
    insert.mockResolvedValueOnce({ error: null });
    await act(async () => {
      await latestHookValue.api.insertRows([existingRow]);
    });

    const insertError = new Error('duplicate');
    insert.mockResolvedValueOnce({ error: insertError });
    await act(async () => {
      await latestHookValue.api.insertRows([{ id: 'award-1', reason: 'duplicate' }]);
    });

    expect(latestHookValue.rows).toEqual([existingRow]);
  });

  test('preserves a successful insert when an older refetch finishes', async () => {
    let resolveFetch;
    const pendingFetch = new Promise((resolve) => {
      resolveFetch = resolve;
    });
    insert.mockResolvedValue({ error: null });
    supabase.from.mockImplementation(() => ({
      select: () => pendingFetch,
      insert,
    }));

    let refetchPromise;
    act(() => {
      refetchPromise = latestHookValue.api.refetch();
    });
    const insertedRow = { id: 'award-1' };
    await act(async () => {
      await latestHookValue.api.insertRows([insertedRow]);
    });
    await act(async () => {
      resolveFetch({ data: [], error: null });
      await refetchPromise;
    });

    expect(latestHookValue.rows).toEqual([insertedRow]);
  });

  test('does not preserve an unsaved whole-table update across a refetch', async () => {
    act(() => {
      latestHookValue.update([{ id: 'local-only' }]);
    });
    expect(latestHookValue.api.dirty).toBe(true);

    await act(async () => {
      await latestHookValue.api.refetch();
    });

    expect(latestHookValue.rows).toEqual([]);
    expect(latestHookValue.api.dirty).toBe(false);
  });

  test('ignores an older refetch result that finishes last', async () => {
    const pendingFetches = [];
    supabase.from.mockImplementation(() => ({
      select: () =>
        new Promise((resolve) => {
          pendingFetches.push(resolve);
        }),
      insert,
    }));

    let firstRefetch;
    let secondRefetch;
    await act(async () => {
      firstRefetch = latestHookValue.api.refetch();
      secondRefetch = latestHookValue.api.refetch();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(pendingFetches).toHaveLength(2);
    await act(async () => {
      pendingFetches[1]({ data: [{ id: 'newer' }], error: null });
      await secondRefetch;
    });
    await act(async () => {
      pendingFetches[0]({ data: [{ id: 'older' }], error: null });
      await firstRefetch;
    });

    expect(latestHookValue.rows).toEqual([{ id: 'newer' }]);
  });
});
