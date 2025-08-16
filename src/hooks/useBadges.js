import usePersistentState from './usePersistentState';
import { BADGE_DEFS } from '../badgeDefs';

const LS_KEY = 'nm_points_badges_v1';

export default function useBadges() {
  return usePersistentState(LS_KEY, BADGE_DEFS);
}
