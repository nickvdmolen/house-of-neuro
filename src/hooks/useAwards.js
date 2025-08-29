import useServerState from './useServerState';
import seedAwards from '../data/awards.json';

export default function useAwards() {
  return useServerState('awards', seedAwards);
}
