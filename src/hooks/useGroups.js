import usePersistentState from './usePersistentState';
import seedGroups from '../data/groups.json';

const LS_KEY = 'nm_points_groups_v2';

export default function useGroups() {
  return usePersistentState(LS_KEY, seedGroups);
}
