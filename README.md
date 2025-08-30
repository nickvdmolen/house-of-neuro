# House of Neuro

This project uses Supabase for persistence and asset hosting. Configuration is provided via the committed `.env` file; update it with your own Supabase credentials before running the app.

## Environment variables
Set the following in `.env` before running the app:

```
REACT_APP_SUPABASE_URL=https://rgyukpzginlyihyijbfk.supabase.co
REACT_APP_SUPABASE_ANON_KEY=<your-anon-key>
REACT_APP_SUPABASE_BUCKET=hon
REACT_APP_SUPABASE_S3_ENDPOINT=https://rgyukpzginlyihyijbfk.storage.supabase.co/storage/v1/s3
REACT_APP_SUPABASE_S3_ACCESS_KEY_ID=<your-s3-access-key-id>
REACT_APP_SUPABASE_S3_SECRET_ACCESS_KEY=<your-s3-secret-access-key>
```

## Database setup
Use the SQL in [`supabase-schema.sql`](./supabase-schema.sql) in the Supabase SQL editor to create the required tables and seed badge definitions. The tables store all students, groups, awards, teachers and badges. Authentication for both students and teachers is performed against these tables.

## Storage bucket
Create a public storage bucket named `hon` and upload badge images under an `images/` folder. The client builds public URLs at runtime via Supabase storage.
