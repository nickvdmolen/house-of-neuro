import useServerState from './useServerState';
import seedStudents from '../data/students.json';

export default function useStudents() {
  return useServerState('students', seedStudents);
}
