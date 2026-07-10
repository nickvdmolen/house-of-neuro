# House of Neuro

This project uses a `.env` file for configuration. The committed `.env` contains placeholder values only.

## 🚀 Quick Start

### Lokale Testing (Tijdelijk)
Voor snelle testing zonder Supabase setup:
```bash
# Start lokale server + React app
npm start
```
Dit gebruikt automatisch `.env.local` met `REACT_APP_USE_LOCAL_SERVER=true`.

### Productie Setup
Voor echte deployment naar Supabase, zie sectie hieronder.

## Environment variables
Set the following in `.env` before running the app:

```
REACT_APP_SUPABASE_URL=https://rgyukpzginlyihyijbfk.supabase.co
REACT_APP_SUPABASE_ANON_KEY=<your-anon-key>
REACT_APP_API_BASE=/api
```

## Database setup
Use the SQL in [`supabase-schema.sql`](./supabase-schema.sql) in the Supabase SQL editor to create the required tables and seed badge definitions. Then run [`supabase-score-mutations.sql`](./supabase-score-mutations.sql) to install the atomic points/history RPC. The tables store all students, groups, semesters, awards, teachers and badges. Authentication for both students and teachers is performed against these tables.

The `students` table must include:
- `bingo` (jsonb)
- `bingoMatches` (jsonb)
- `lastWeekRewarded` (text)
- `showRankPublic` (boolean, default true)
- `semesterId` (text)

For an existing Supabase project, run the complete `supabase-score-mutations.sql` migration before deploying this frontend. It converts `awards.target_id` to `text`, adds mutation bookkeeping and installs `apply_score_mutations`.

In the teacher dashboard under **Scores**, configure the semester name, start date and end date. The student score chart then always spans that complete period, marks today and shows the remaining time. Existing unscoped awards are included by timestamp; newly created students and score awards receive the active semester ID automatically.

The RPC is deliberately `SECURITY INVOKER`: it does not bypass table privileges or RLS. The current custom teacher/student login is not linked to `auth.uid()`, so atomicity is enforced but caller identity is not yet a database authorization boundary.

## Storage bucket
Create a public storage bucket named `hon` and upload badge images under an `images/` folder. The client is hard-coded to use this bucket when generating URLs and uploading files.

Enable Row Level Security on the `storage.objects` table and allow authenticated users to write to the `images` folder. In the Supabase SQL editor run:

```sql
create policy "authenticated can upload images"
  on storage.objects
  for insert
  to authenticated
  with check (bucket_id = 'hon' and (storage.foldername(name))[1] = 'images');
```

## 🧪 Lokale Testing Mode

### Waarom?
Tijdelijke oplossing om te testen voordat we naar Supabase gaan. Gebruikt dezelfde lokale JSON data als voorheen.

### Hoe starten?
```bash
# Terminal 1: Lokale server
npm run server

# Terminal 2: React app
npm start
```

### Environment
Maak `.env.local` aan met:
```env
REACT_APP_USE_LOCAL_SERVER=true
REACT_APP_TEACHER_TOKEN=test-token-123
REACT_APP_API_BASE=/api
## Optioneel voor aparte frontend
# CORS_ORIGIN=http://localhost:3000
```

### Terug naar Supabase
- Verwijder `REACT_APP_USE_LOCAL_SERVER=true`
- Voeg echte Supabase credentials toe
- Herstart app

## Deployment naar productie

### Stap 1: Supabase Database Opzetten
1. Maak nieuw Supabase project aan
2. Voer `supabase-schema.sql` uit in SQL Editor
3. Voer `supabase-score-mutations.sql` uit in SQL Editor
4. Update `.env` met echte Supabase credentials

### Stap 2: Data Migreren
```bash
# Export huidige lokale data naar Supabase
node migrate-to-supabase.js
```

### Stap 3: Supabase Mode Activeren
De app gebruikt automatisch Supabase na het bijwerken van environment variables.

### Stap 4: Deploy
```bash
npm run build
# Deploy build/ folder naar hosting service
```
