// ============================================
// HYBRID MODE - Automatisch switch tussen Local en Supabase
// Gebruik REACT_APP_USE_LOCAL_SERVER=true voor lokale testing
// Fallback: gebruik local server als Supabase env ontbreekt
// ============================================

import { API_BASE } from './config';

const EXPLICIT_LOCAL_SERVER = process.env.REACT_APP_USE_LOCAL_SERVER === 'true';
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;
const HAS_SUPABASE_CONFIG = Boolean(supabaseUrl && supabaseAnonKey);
const USE_LOCAL_SERVER = EXPLICIT_LOCAL_SERVER || !HAS_SUPABASE_CONFIG;

let supabaseClient;
let ensureSessionFn;
let getImageUrlFn;
let uploadImageFn;

if (USE_LOCAL_SERVER) {
  // LOCAL SERVER MODE - Voor development/testing
  console.log('🔧 Using LOCAL SERVER mode');
  if (!HAS_SUPABASE_CONFIG && !EXPLICIT_LOCAL_SERVER) {
    console.warn('Supabase env missing; falling back to local server mode.');
  }

  const TEACHER_TOKEN = process.env.REACT_APP_TEACHER_TOKEN || '';

  const localSupabase = {
    from: (table) => ({
      select: async () => {
        try {
          const res = await fetch(`${API_BASE}/${table}`);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const data = await res.json();
          return { data, error: null };
        } catch (err) {
          console.error('Error fetching', table, err);
          return { data: [], error: err };
        }
      },
      insert: async (rows) => {
        try {
          const res = await fetch(`${API_BASE}/${table}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-teacher-token': TEACHER_TOKEN,
            },
            body: JSON.stringify(rows),
          });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const data = await res.json();
          return { data, error: null };
        } catch (err) {
          console.error('Error inserting', table, err);
          return { data: null, error: err };
        }
      },
      upsert: async (rows) => {
        try {
          const res = await fetch(`${API_BASE}/${table}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'x-teacher-token': TEACHER_TOKEN,
            },
            body: JSON.stringify(rows),
          });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const data = await res.json();
          return { data, error: null };
        } catch (err) {
          console.error('Error upserting', table, err);
          return { data: null, error: err };
        }
      },
      update: (updates) => ({
        eq: async (field, value) => {
          try {
            const res = await fetch(`${API_BASE}/${table}`);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            const updated = data.map(r => r[field] === value ? { ...r, ...updates } : r);

            const putRes = await fetch(`${API_BASE}/${table}`, {
              method: 'PUT',
              headers: {
                'Content-Type': 'application/json',
                'x-teacher-token': TEACHER_TOKEN,
              },
              body: JSON.stringify(updated),
            });
            if (!putRes.ok) throw new Error(`HTTP ${putRes.status}`);
            return { data: null, error: null };
          } catch (err) {
            console.error('Error updating', table, err);
            return { data: null, error: err };
          }
        },
      }),
      delete: () => ({
        eq: async (field, value) => {
          try {
            const res = await fetch(`${API_BASE}/${table}`);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            const filtered = data.filter(r => r[field] !== value);

            const putRes = await fetch(`${API_BASE}/${table}`, {
              method: 'PUT',
              headers: {
                'Content-Type': 'application/json',
                'x-teacher-token': TEACHER_TOKEN,
              },
              body: JSON.stringify(filtered),
            });
            if (!putRes.ok) throw new Error(`HTTP ${putRes.status}`);
            return { data: null, error: null };
          } catch (err) {
            console.error('Error deleting from', table, err);
            return { data: null, error: err };
          }
        },
        in: async (field, values) => {
          try {
            const res = await fetch(`${API_BASE}/${table}`);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            const set = new Set(values);
            const filtered = data.filter(r => !set.has(r[field]));

            const putRes = await fetch(`${API_BASE}/${table}`, {
              method: 'PUT',
              headers: {
                'Content-Type': 'application/json',
                'x-teacher-token': TEACHER_TOKEN,
              },
              body: JSON.stringify(filtered),
            });
            if (!putRes.ok) throw new Error(`HTTP ${putRes.status}`);
            return { data: null, error: null };
          } catch (err) {
            console.error('Error deleting from', table, err);
            return { data: null, error: err };
          }
        },
      }),
    }),
    auth: {
      getSession: () => Promise.resolve({ data: { session: { user: { id: 'local-user' } } } }),
      getUser: () => Promise.resolve({ data: { user: { id: 'local-user' } }, error: null }),
      signInAnonymously: () => Promise.resolve({ data: { session: { user: { id: 'local-user' } } }, error: null }),
    },
    storage: {
      from: () => ({
        upload: () => Promise.resolve({ error: null }),
        getPublicUrl: (path) => ({ data: { publicUrl: `/images/${path}` } }),
      }),
    },
  };

  supabaseClient = localSupabase;
  ensureSessionFn = async () => ({ user: { id: 'local-user' } });
  getImageUrlFn = (path) => `/images/${path}`;
  uploadImageFn = async (file) => {
    if (!file) return null;
    return URL.createObjectURL(file);
  };

} else {
  // SUPABASE MODE - Voor productie
  console.log('☁️ Using SUPABASE mode');

  const { createClient } = require('@supabase/supabase-js');
  const supabaseBucket = 'hon';

  supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  ensureSessionFn = async () => {
    const { data } = await supabaseClient.auth.getSession();
    if (data.session) return data.session;

    const { data: anon, error } = await supabaseClient.auth.signInAnonymously();
    if (error) throw new Error(`Anonymous sign-in failed: ${error.message}`);
    return anon.session;
  };

  getImageUrlFn = (path) =>
    `${supabaseUrl}/storage/v1/object/public/${supabaseBucket}/images/${path}`;

  uploadImageFn = async (file) => {
    if (!file) return null;

    await ensureSessionFn();

    const { data: userData, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !userData?.user) {
      console.error('No Supabase user', { userError, user: userData });
      alert(
        `Afbeelding uploaden mislukt: geen Supabase gebruiker gevonden (${userError?.message})`
      );
      return null;
    }

    const uid = userData.user.id;
    const ext = file.name.split('.').pop() || 'jpg';
    const filePath = `${uid}/badges/${Date.now()}.${ext}`;

    const { error } = await supabaseClient.storage
      .from(supabaseBucket)
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (error) {
      console.error('Upload error', error);
      alert(`Afbeelding uploaden mislukt: ${error.message}`);
      return null;
    }

    return getImageUrlFn(filePath);
  };
}

// Exports op hoogste niveau (vereist voor ES6 modules)
export const supabase = supabaseClient;
export const ensureSession = ensureSessionFn;
export const getImageUrl = getImageUrlFn;
export const uploadImage = uploadImageFn;
