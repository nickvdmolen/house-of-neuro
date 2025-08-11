import usePersistentState from './usePersistentState';

const LS_KEY = 'nm_points_awards_v2';
const seedAwards = [
  { id: 'a1', ts: Date.now() - 1000 * 60 * 60, type: 'group',   targetId: 'g1', amount: 10, reason: 'Kick-off pitch' },
  { id: 'a2', ts: Date.now() - 1000 * 60 * 50, type: 'student', targetId: 's3', amount: 4,  reason: 'Reading quiz'   },
];

export default function useAwards() {
  return usePersistentState(LS_KEY, seedAwards);
}
