import usePersistentState from './usePersistentState';

const LS_KEY = 'nm_points_students_v2';
const seedStudents = [
  { id: 's1', name: 'Alex',  email: 'alex@student.nhlstenden.com',  groupId: 'g1', points: 10, badges: [] },
  { id: 's2', name: 'Bo',    email: 'bo@student.nhlstenden.com',    groupId: 'g1', points: 5,  badges: [] },
  { id: 's3', name: 'Casey', email: 'casey@student.nhlstenden.com', groupId: 'g2', points: 12, badges: [] },
];

export default function useStudents() {
  return usePersistentState(LS_KEY, seedStudents);
}
