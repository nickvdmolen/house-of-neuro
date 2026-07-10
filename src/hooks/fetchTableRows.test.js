import fetchTableRows from './fetchTableRows';

describe('fetchTableRows', () => {
  test('uses a single request for adapters without range support', async () => {
    const rows = [{ id: '1' }, { id: '2' }];
    const select = jest.fn().mockResolvedValue({ data: rows, error: null });
    const client = { from: jest.fn(() => ({ select })) };

    await expect(fetchTableRows(client, 'awards', 500)).resolves.toEqual({
      data: rows,
      error: null,
    });
    expect(client.from).toHaveBeenCalledTimes(1);
    expect(select).toHaveBeenCalledWith('*');
  });

  test('loads every page in a deterministic order', async () => {
    const rows = Array.from({ length: 1201 }, (_, index) => ({ id: String(index) }));
    const requestedRanges = [];
    const client = {
      from: jest.fn(() => ({
        select: () => {
          const query = {
            order: jest.fn(() => query),
            range: jest.fn(async (from, to) => {
              requestedRanges.push([from, to]);
              return { data: rows.slice(from, to + 1), error: null };
            }),
          };
          return query;
        },
      })),
    };

    const result = await fetchTableRows(client, 'awards', 500, 'ts,id');

    expect(result).toEqual({ data: rows, error: null });
    expect(requestedRanges).toEqual([
      [0, 499],
      [500, 999],
      [1000, 1499],
      [1201, 1700],
    ]);
  });

  test('continues when the server returns fewer rows than requested', async () => {
    const rows = Array.from({ length: 1201 }, (_, index) => ({ id: String(index) }));
    const requestedOffsets = [];
    const client = {
      from: jest.fn(() => ({
        select: () => {
          const query = {
            order: jest.fn(() => query),
            range: jest.fn(async (from) => {
              requestedOffsets.push(from);
              return { data: rows.slice(from, from + 500), error: null };
            }),
          };
          return query;
        },
      })),
    };

    const result = await fetchTableRows(client, 'awards', 1000);

    expect(result).toEqual({ data: rows, error: null });
    expect(requestedOffsets).toEqual([0, 500, 1000, 1201]);
  });

  test('returns an error instead of incomplete rows when a page fails', async () => {
    const fetchError = new Error('page failed');
    let request = 0;
    const client = {
      from: jest.fn(() => ({
        select: () => {
          const query = {
            order: jest.fn(() => query),
            range: jest.fn(async () => {
              request += 1;
              return request === 1
                ? { data: Array.from({ length: 2 }, (_, index) => ({ id: index })), error: null }
                : { data: null, error: fetchError };
            }),
          };
          return query;
        },
      })),
    };

    await expect(fetchTableRows(client, 'awards', 2)).resolves.toEqual({
      data: null,
      error: fetchError,
    });
  });
});
