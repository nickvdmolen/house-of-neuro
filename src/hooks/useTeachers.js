import useServerState from './useServerState';
import seedTeachers from '../data/teachers.json';

export default function useTeachers() {
  return useServerState('teachers', seedTeachers);
}
