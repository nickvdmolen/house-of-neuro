import useServerState from './useServerState';
import seedGroups from '../data/groups.json';

export default function useGroups() {
  return useServerState('groups', seedGroups);
}
