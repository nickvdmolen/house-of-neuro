import { createClient } from '@supabase/supabase-js';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;
// Storage bucket for badge images
const supabaseBucket = 'hon';

const s3Endpoint = process.env.REACT_APP_SUPABASE_S3_ENDPOINT;
const s3AccessKeyId = process.env.REACT_APP_SUPABASE_S3_ACCESS_KEY_ID;
const s3SecretAccessKey = process.env.REACT_APP_SUPABASE_S3_SECRET_ACCESS_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

const s3Client = new S3Client({
  region: 'us-east-1',
  endpoint: s3Endpoint,
  credentials: {
    accessKeyId: s3AccessKeyId,
    secretAccessKey: s3SecretAccessKey,
  },
  forcePathStyle: true,
});

export const getImageUrl = (path) =>
  `${supabaseUrl}/storage/v1/object/public/${supabaseBucket}/images/${path}`;

export async function uploadImage(file) {
  if (!file) return null;

  const ext = file.name.split('.').pop();
  const name = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const key = `images/${name}`;

  try {
    const command = new PutObjectCommand({
      Bucket: supabaseBucket,
      Key: key,
      Body: file,
      ContentType: file.type,
    });
    await s3Client.send(command);
  } catch (error) {
    console.error('Error uploading image', error);
    alert('Afbeelding uploaden mislukt. Controleer de Supabase configuratie.');
    return null;
  }

  return getImageUrl(name);
}
