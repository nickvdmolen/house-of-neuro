import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;
const supabaseBucket = process.env.REACT_APP_SUPABASE_BUCKET || 'hon';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export const getImageUrl = (path) => {
  const { data } = supabase.storage
    .from(supabaseBucket)
    .getPublicUrl(`images/${path}`);
  return data?.publicUrl;
};

export async function uploadImage(file) {
  const ext = file.name.split('.').pop();
  const name = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const filePath = `images/${name}`;
  const { error } = await supabase.storage
    .from(supabaseBucket)
    .upload(filePath, file, { upsert: true });
  if (error) {
    console.error('Error uploading image', error);
    return null;
  }
  const { data } = supabase.storage
    .from(supabaseBucket)
    .getPublicUrl(filePath);
  return data?.publicUrl || null;
}
