import { useState } from 'react';

export default function usePersistentState(key, initial) {
  const [state, setState] = useState(initial);
  return [state, setState];
}
