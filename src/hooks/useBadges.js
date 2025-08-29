import useServerState from './useServerState';
import seedBadges from '../data/badges.json';

export default function useBadges() {
  return useServerState('badges', seedBadges);
}
