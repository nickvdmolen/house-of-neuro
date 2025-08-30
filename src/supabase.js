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
