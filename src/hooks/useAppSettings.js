import { useCallback, useMemo } from 'react';
import useSupabaseTable from './useSupabaseTable';

const DEFAULT_SETTINGS = {
  id: 'global',
  bingoHintsEnabled: false,
};

const toDb = (row) => {
  if (!row) return row;
  return {
    id: row.id,
    bingoHintsEnabled: row.bingoHintsEnabled ?? false,
  };
};

export default function useAppSettings(options = {}) {
  const [rows, setRows, meta] = useSupabaseTable('app_settings', { autoSave: false, toDb, ...options });

  const settings = useMemo(() => {
    const row = rows.find((r) => r?.id === DEFAULT_SETTINGS.id);
    return {
      ...DEFAULT_SETTINGS,
      ...row,
      bingoHintsEnabled: Boolean(row?.bingoHintsEnabled),
    };
  }, [rows]);

  const updateSettings = useCallback(
    (updater) => {
      setRows((prev) => {
        const current = prev.find((r) => r?.id === DEFAULT_SETTINGS.id) || DEFAULT_SETTINGS;
        const patch = typeof updater === 'function' ? updater(current) : updater;
        const nextRow = {
          ...DEFAULT_SETTINGS,
          ...current,
          ...(patch || {}),
          id: DEFAULT_SETTINGS.id,
        };
        const rest = prev.filter((r) => r?.id !== DEFAULT_SETTINGS.id);
        return [...rest, nextRow];
      });
    },
    [setRows]
  );

  return [settings, updateSettings, meta];
}
