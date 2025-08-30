import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;
const supabaseBucket = process.env.REACT_APP_SUPABASE_BUCKET || 'hon';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export const getImageUrl = (path) =>
  `${supabaseUrl}/storage/v1/object/public/${supabaseBucket}/images/${path}`;

export async function uploadImage(file) {
  const ext = file.name.split('.').pop();
  const name = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const path = `images/${name}`;
  const { error } = await supabase.storage.from(supabaseBucket).upload(path, file);
  if (error) {
    console.error('Error uploading image', error);
    return null;
  }
  return getImageUrl(name);
}
