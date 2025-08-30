import { createClient } from '@supabase/supabase-js';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;
const supabaseBucket = process.env.REACT_APP_SUPABASE_BUCKET || 'hon';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

const s3 = new S3Client({
  region: 'us-east-1',
  endpoint: process.env.REACT_APP_SUPABASE_S3_ENDPOINT,
  credentials: {
    accessKeyId: process.env.REACT_APP_SUPABASE_S3_ACCESS_KEY_ID,
    secretAccessKey: process.env.REACT_APP_SUPABASE_S3_SECRET_ACCESS_KEY,
  },
  forcePathStyle: true,
});

export const getImageUrl = (path) =>
  `${supabaseUrl}/storage/v1/object/public/${supabaseBucket}/images/${path}`;

export async function uploadImage(file) {
  const ext = file.name.split('.').pop();
  const name = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const key = `images/${name}`;
  try {
    await s3.send(
      new PutObjectCommand({
        Bucket: supabaseBucket,
        Key: key,
        Body: file,
        ContentType: file.type,
      })
    );
    return getImageUrl(name);
  } catch (error) {
    console.error('Error uploading image', error);
    return null;
  }
}
