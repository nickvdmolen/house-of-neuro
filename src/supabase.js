import { createClient } from '@supabase/supabase-js';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;
// Storage bucket for badge images
const supabaseBucket = 'hon';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export const getImageUrl = (path) =>
  `${supabaseUrl}/storage/v1/object/public/${supabaseBucket}/images/${path}`;

export async function uploadImage(file) {
  if (!file) return null;

  const ext = file.name.split('.').pop();
  const name = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const key = `images/${name}`;

  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();
  if (sessionError || !session) {
    console.error('No Supabase session', sessionError);
    alert('Afbeelding uploaden mislukt. Controleer de Supabase configuratie.');
    return null;
  }

  const projectRef = new URL(supabaseUrl).host.split('.')[0];
  const region = process.env.REACT_APP_SUPABASE_REGION || 'us-east-1';
  const client = new S3Client({
    forcePathStyle: true,
    region,
    endpoint: `https://${projectRef}.storage.supabase.co/storage/v1/s3`,
    credentials: {
      accessKeyId: projectRef,
      secretAccessKey: supabaseAnonKey,
      sessionToken: session.access_token,
    },
  });

  try {
    await client.send(
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
    alert('Afbeelding uploaden mislukt. Controleer de Supabase configuratie.');
    return null;
  }
}
