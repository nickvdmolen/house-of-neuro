import usePersistentState from './usePersistentState';
import seedTeachers from '../data/teachers.json';

const LS_KEY = 'nm_points_teachers_v1';

export default function useTeachers() {
  return usePersistentState(LS_KEY, seedTeachers);
}
