import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;
// Storage bucket for badge images
const supabaseBucket = 'hon';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
  },
});

async function ensureSession() {
  const { data } = await supabase.auth.getSession();
  if (data.session) return data.session;

  const { data: anon, error } = await supabase.auth.signInAnonymously();
  if (error) throw new Error(`Anonymous sign-in failed: ${error.message}`);
  return anon.session;
}

export const getImageUrl = (path) =>
  `${supabaseUrl}/storage/v1/object/public/${supabaseBucket}/images/${path}`;

export async function uploadImage(file) {
  if (!file) return null;

  await ensureSession();

  const { data: userData, error: userError } = await supabase.auth.getUser();
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

  const { error } = await supabase.storage
    .from(supabaseBucket)
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type || 'image/jpeg',
    });

  if (error) {
    console.error('Error uploading image', { error, filePath, file });
    alert(`Afbeelding uploaden mislukt: ${error.message}`);
    return null;
  }

  const { data } = supabase.storage.from(supabaseBucket).getPublicUrl(filePath);
  return data.publicUrl;
}
