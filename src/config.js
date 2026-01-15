const useLocalServer = process.env.REACT_APP_USE_LOCAL_SERVER === 'true';
const defaultApiBase = useLocalServer ? 'http://localhost:3001/api' : '/api';
const rawApiBase =
  process.env.REACT_APP_API_BASE ||
  process.env.REACT_APP_LOCAL_API_BASE ||
  defaultApiBase;

const normalizedApiBase = rawApiBase.endsWith('/')
  ? rawApiBase.slice(0, -1)
  : rawApiBase;

const localOverride =
  useLocalServer && normalizedApiBase === '/api'
    ? 'http://localhost:3001/api'
    : normalizedApiBase;

export const API_BASE = localOverride;

export const apiUrl = (path) =>
  `${API_BASE}${path.startsWith('/') ? path : `/${path}`}`;
