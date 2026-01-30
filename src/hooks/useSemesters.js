import useSupabaseTable from './useSupabaseTable';

const fromDb = (row) => {
  if (!row) return row;
  const { start_date, end_date, ...rest } = row;
  return {
    ...rest,
    startDate: start_date ?? row.startDate ?? null,
    endDate: end_date ?? row.endDate ?? null,
  };
};

const toDb = (row) => {
  if (!row) return row;
  const cleaned = { ...row };
  const startDate = row.startDate ?? row.start_date ?? null;
  const endDate = row.endDate ?? row.end_date ?? null;
  delete cleaned.startDate;
  delete cleaned.endDate;
  delete cleaned.start_date;
  delete cleaned.end_date;
  return {
    ...cleaned,
    start_date: startDate,
    end_date: endDate,
  };
};

export default function useSemesters() {
  return useSupabaseTable('semesters', { fromDb, toDb });
}
