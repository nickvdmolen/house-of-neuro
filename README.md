# House of Neuro

This project uses Supabase for persistence and asset hosting. Configuration is provided via a `.env` file; the committed `.env` contains placeholder values only.

## Environment variables
Set the following in `.env` before running the app:

```
REACT_APP_SUPABASE_URL=https://rgyukpzginlyihyijbfk.supabase.co
REACT_APP_SUPABASE_ANON_KEY=<your-anon-key>
REACT_APP_SUPABASE_BUCKET=hon
```

## Database setup
Use the SQL in [`supabase-schema.sql`](./supabase-schema.sql) in the Supabase SQL editor to create the required tables and seed badge definitions. The tables store all students, groups, awards, teachers and badges. Authentication for both students and teachers is performed against these tables.

## Storage bucket
Create a public storage bucket named `hon` and upload badge images under an `images/` folder. The client builds public URLs at runtime via Supabase storage.
