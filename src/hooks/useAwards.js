import usePersistentState from './usePersistentState';
import seedAwards from '../data/awards.json';

const LS_KEY = 'nm_points_awards_v2';

export default function useAwards() {
  return usePersistentState(LS_KEY, seedAwards);
}
