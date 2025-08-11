import usePersistentState from './usePersistentState';

const LS_KEY = 'nm_points_groups_v2';
const seedGroups = [
  { id: 'g1', name: 'Team EEG',       points: 20 },
  { id: 'g2', name: 'Team Eye-Track', points: 8  },
];

export default function useGroups() {
  return usePersistentState(LS_KEY, seedGroups);
}
