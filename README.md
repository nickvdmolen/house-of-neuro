# House of Neuro

This project uses Supabase for persistence and asset hosting. Configuration is provided via the committed `.env` file; update it with your own Supabase credentials before running the app.

## Environment variables
Set the following in `.env` before running the app:

```
REACT_APP_SUPABASE_URL=https://rgyukpzginlyihyijbfk.supabase.co
REACT_APP_SUPABASE_ANON_KEY=<your-anon-key>
```

## Database setup
Use the SQL in [`supabase-schema.sql`](./supabase-schema.sql) in the Supabase SQL editor to create the required tables and seed badge definitions. The tables store all students, groups, awards, teachers and badges. Authentication for both students and teachers is performed against these tables.

## Storage bucket
Create a public storage bucket named `hon` and upload badge images under an `images/` folder. The client is hard-coded to use this bucket when generating URLs and uploading files.

Enable Row Level Security on the `storage.objects` table and allow authenticated users to write to the `images` folder. In the Supabase SQL editor run:

```sql
create policy "authenticated can upload images"
  on storage.objects
  for insert
  to authenticated
  with check (bucket_id = 'hon' and (storage.foldername(name))[1] = 'images');

create policy "authenticated can update images"
  on storage.objects
  for update
  to authenticated
  using (bucket_id = 'hon' and (storage.foldername(name))[1] = 'images');
```
