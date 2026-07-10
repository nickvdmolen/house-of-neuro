const isPageSize = (value) => Number.isInteger(value) && value > 0;

export default async function fetchTableRows(
  client,
  table,
  pageSize = null,
  orderBy = 'id'
) {
  let query = client.from(table).select('*');

  // The local API adapter returns a Promise and already returns the full table.
  if (!isPageSize(pageSize) || typeof query?.range !== 'function') {
    return query;
  }

  const rows = [];
  const orderColumns = String(orderBy || 'id')
    .split(',')
    .map((column) => column.trim())
    .filter(Boolean);
  let offset = 0;

  while (true) {
    if (typeof query.order === 'function') {
      orderColumns.forEach((column) => {
        query = query.order(column, { ascending: true });
      });
    }

    const { data: pageRows, error } = await query.range(
      offset,
      offset + pageSize - 1
    );
    if (error) return { data: null, error };

    const safePageRows = Array.isArray(pageRows) ? pageRows : [];
    if (safePageRows.length === 0) {
      return { data: rows, error: null };
    }

    rows.push(...safePageRows);
    offset += safePageRows.length;
    query = client.from(table).select('*');
    if (typeof query?.range !== 'function') {
      return {
        data: null,
        error: new Error(`Pagination is not supported for table ${table}`),
      };
    }
  }
}
