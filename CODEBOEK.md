# Codeboek - House of Neuro

Dit document bevat alle afspraken, beslissingen en referenties voor het project.
Laatst bijgewerkt: 10 januari 2026

---

## 📁 Project Structuur

### Frontend (React)
| Bestand | Doel |
|---------|------|
| `src/App.js` | Hoofdcomponent met routing en authenticatie |
| `src/Admin.js` | Admin dashboard voor studenten, groepen, badges beheren |
| `src/AdminRoster.js` | Roster/overzicht voor admin |
| `src/Student.js` | Student dashboard met punten, badges, leaderboard |
| `src/Bingo.js` | Bingo spellogica (matching met andere studenten) |
| `src/BingoEdit.js` | Invullen van bingo antwoorden |
| `src/BingoAdmin.js` | Admin overzicht van bingo antwoorden |
| `src/components/BadgeOverview.js` | Badge weergave component met popup details |
| `src/auth.js` | Hashing helpers voor wachtwoorden |
| `src/config.js` | API base configuratie voor lokaal/online |

### Global helpers
| Helper | Doel |
|--------|------|
| `window.attendanceRefreshCounter` | Trigger voor directe aanwezigheid updates |

### Hooks (Data Management)
| Hook | Tabel | Doel |
|------|-------|------|
| `useStudents` | `students` | Studenten data |
| `useGroups` | `groups` | Groepen data |
| `useAwards` | `awards` | Punten toekenningen |
| `useBadges` | `badge_defs` | Badge definities |
| `usePeerAwards` | `peer_awards` | Peer awards log |
| `usePeerEvents` | `peer_events` | Peer punten events |
| `useTeachers` | `teachers` | Docenten data |
| `useMeetings` | `meetings` | Bijeenkomsten data |
| `useAttendance` | `attendance` | Aanwezigheid per bijeenkomst |
| `useStreaks` | - | Aanwezigheidsstreaks berekening |
| `useLocalTable` | - | Lokale JSON data hook (alternatief voor Supabase) |
| `useSupabaseTable` | - | Generieke hook voor alle tabellen |

### Backend (Node.js Server)
| Bestand | Doel |
|---------|------|
| `server.js` | Express server met API endpoints en email |
| `server/dataStore.js` | JSON file opslag |
| `server/data/*.json` | Data bestanden |

---

## 📊 Data Modellen

### Student
```javascript
{
  id: string,           // UUID
  name: string,         // Naam
  email: string,        // @student.nhlstenden.com
  password: string,     // bcrypt hash
  groupId: string|null, // Referentie naar group.id
  points: number,       // Individuele punten
  badges: string[],     // Array van badge IDs
  photo: string,        // URL naar profielfoto
  bingo: {              // Bingo antwoorden (Q1-Q25)
    Q1: string[],
    Q2: string[],
    ...
    Q25: string[]
  },
  bingoMatches?: {      // Bingo matches (afgetekende vakjes)
    Q1?: { otherId: string, otherName: string, answer: string },
    ...
    Q25?: { otherId: string, otherName: string, answer: string }
  },
  resetToken?: string,  // Optioneel: voor wachtwoord reset
  tempCode?: string,    // Optioneel: tijdelijke login code
  lastWeekRewarded?: string,   // Laatste week (YYYY-W##) waarvoor streak bonus is gegeven
  showRankPublic?: boolean     // Toon positie op leaderboard voor anderen
}
```

### Group
```javascript
{
  id: string,      // UUID
  name: string,    // Groepsnaam
  points: number   // Groepsbonus punten
}
```

### Award
```javascript
{
  id: string,       // UUID
  ts: string,       // ISO timestamp
  target: string,   // 'student' of 'group'
  target_id: string,// ID van student of group
  amount: number,   // Punten (+/-)
  reason: string    // Reden
}
```

### Badge Definition
```javascript
{
  id: string,          // UUID
  title: string,       // Badge naam
  image: string,       // URL naar afbeelding
  requirement: string  // Beschrijving hoe te verdienen
}
```

### Meeting
```javascript
{
  id: string,          // UUID
  date: string,        // YYYY-MM-DD
  time: string,        // HH:MM (optioneel)
  type: string,        // 'lecture', 'workshop', 'seminar', etc.
  title: string,       // Titel van de bijeenkomst
  created_by: string,  // Teacher ID die het aanmaakte
  created_at: string   // ISO timestamp
}
```

### Attendance
```javascript
{
  id: string,          // UUID
  meeting_id: string,  // Referentie naar meeting.id
  student_id: string,  // Referentie naar student.id
  present: boolean,    // true = aanwezig, false = afwezig
  marked_at: string    // ISO timestamp wanneer gemarkeerd
}
```

### Peer Award
```javascript
{
  id: string,            // UUID
  ts: string,            // ISO timestamp
  from_student_id: string,// Student die punten geeft
  event_id?: string,     // Event ID (kan ontbreken als event verwijderd is)
  event_title?: string,  // Event titel bij toekenning
  target: string,        // 'student', 'group' of 'class'
  target_id: string,     // Student ID, group ID of 'class'
  amount: number,        // Punten per student
  total_amount: number,  // Totaal vergeven punten (amount × recipients)
  reason: string,        // Reden
  recipients: string[]   // Array van student IDs die punten ontvingen
}
```

### Peer Event
```javascript
{
  id: string,         // UUID
  title: string,      // Event titel
  description: string,// Omschrijving
  budget: number,     // Budget per student voor dit event
  active: boolean,    // Actief/inactief
  allowOwnGroup: boolean,   // Eigen groep toegestaan
  allowOtherGroups: boolean,// Andere groepen toegestaan
  created_at: string  // ISO timestamp
}
```

### Teacher
```javascript
{
  id: string,           // UUID
  email: string,        // @nhlstenden.com
  passwordHash: string, // bcrypt hash
  approved: boolean,    // Goedgekeurd door admin
  resetToken?: string   // Optioneel: voor wachtwoord reset
}
```

---

## 🔗 Bingo Vragen (Q1-Q25)

Gedefinieerd in `src/bingoData.js`:
- Q1-Q25: 25 vragen voor een 5x5 bingo kaart
- Elke student vult 3 antwoorden per vraag in
- Matching gebeurt op basis van gelijke antwoorden (case-insensitive)

---

## 🔐 Authenticatie

### Email domeinen
- **Studenten**: `@student.nhlstenden.com`
- **Docenten**: `@nhlstenden.com`
- **Super Admin**: via `REACT_APP_SUPERADMIN_EMAIL` env var

### Wachtwoord hashing
- Gebruikt `bcryptjs` met default rounds (10)
- Studentenwachtwoorden worden altijd gehasht opgeslagen
- Legacy plaintext wachtwoorden worden bij succesvolle login automatisch geüpgraded naar hash

---

## 🌐 API Endpoints (server.js)

| Method | Endpoint | Auth | Doel |
|--------|----------|------|------|
| GET | `/api/:collection` | - | Lees data |
| POST | `/api/:collection` | Teacher* | Voeg data toe |
| PUT | `/api/:collection` | Teacher* | Update data |
| POST | `/api/send-reset` | - | Verstuur reset email |

Collections: `awards`, `attendance`, `badge_defs`, `groups`, `meetings`, `peer_awards`, `peer_events`, `students`, `teachers`

*Studenten mogen `students` POST/PUT gebruiken voor eigen registratie.*

---

## ⚙️ Environment Variables

```env
REACT_APP_SUPABASE_URL=...
REACT_APP_SUPABASE_ANON_KEY=...
REACT_APP_SUPERADMIN_EMAIL=...
REACT_APP_SUPERADMIN_PASSWORD=...
REACT_APP_TEACHER_TOKEN=...
REACT_APP_API_BASE=/api
REACT_APP_USE_LOCAL_SERVER=true

SMTP_HOST=...
SMTP_PORT=...
SMTP_USER=...
SMTP_PASS=...
SMTP_FROM=...
SMTP_SERVICE=...
CORS_ORIGIN=http://localhost:3000
SERVER_PORT=3001
```

---

## 🏆 Punten Systeem

- **Badge behaald**: +50 punten (BADGE_POINTS constant)
- **Badge ingetrokken**: -50 punten
- **Handmatige awards**: Variabel bedrag
- **Peer awards**: Studenten kunnen punten uitdelen via events (door admin aangemaakt)
  - Budget per student per event
  - Doelgroep per event: alle studenten, eigen groep of andere groepen dan eigen (één keuze)
  - Doelgroep is door docent bepaald; student verdeelt punten binnen die scope
  - Scope "alle studenten" of "eigen groep": invulveld per student
  - Scope "andere groepen dan eigen": invulveld per groep (punten per student, groep krijgt totaal)
  - Studenten kunnen nooit punten aan zichzelf geven
  - Totaal = `punten × aantal ontvangers` (groep = aantal studenten in die groep)
  - Bij doelgroep "andere groep dan eigen" gaan de punten naar `group.points` (groepsbonus)
  - Reden is verplicht bij elke toekenning
  - Opslaan kan alleen als het volledige budget is verdeeld; daarna is het event vergrendeld en verdwijnt het event voor die student

### Leaderboard berekening
- **Individueel**: Gesorteerd op `student.points`
- **Groepen**: `avgIndiv + bonus`
  - `avgIndiv` = gemiddelde punten van groepsleden
  - `bonus` = `group.points`
- **Privacy**: Iedereen ziet top 3 + eigen positie; studenten met `showRankPublic` verschijnen ook in de lijst van anderen.

---

## 📝 Belangrijke Afspraken & Beslissingen

### 2026-01-08: Local Server Mode
- Supabase mock in `src/supabase.js` communiceert met lokale server op poort 3001
- Echte Supabase setup beschikbaar via `supabase.js.backup`

### Bingo regels
- Student kan antwoorden niet meer wijzigen na eerste opslag (per vraag)
- Matching is case-insensitive
- 5x5 grid met Q1-Q25
- Afgetekende vakjes (matches) worden opgeslagen in `student.bingoMatches`

---

## 🐛 Bekende Issues & Fixes

### 2026-01-08: Badge toekennen probleem opgelost
- **Probleem**: Admins konden badges toekennen maar studenten zagen ze niet
- **Oorzaak**: `badge_defs` tabel was leeg - geen seed data voor badge definities
- **Oplossing**: 
  - Badge definities toegevoegd aan `src/data/badge_defs.json` seed file
  - `dataStore.js` bijgewerkt om `badge_defs` te initialiseren met seed data
  - Badge definities gekopieerd naar `server/data/badge_defs.json`

Badge toekennen werkt nu via:
1. Admin gebruikt `toggleStudentBadge()` in Admin.js
2. Badge wordt toegevoegd aan `student.badges` array
3. Punten worden toegevoegd (+50 BADGE_POINTS)
4. Award wordt aangemaakt voor geschiedenis
5. Student ziet badge in BadgeOverview component

### 2026-01-10: Peer awards crash bij punten geven
- **Probleem**: Student dashboard crashte met `setPeerReason is not defined` bij openen van de peer awards kaart.
- **Oorzaak**: `setPeerReason('')` bleef staan na refactor; redenen zitten per toekenning in `peerAllocations`.
- **Oplossing**: Overbodige setter verwijderd in `src/Student.js`.

---

## 🧪 Lokale Testing Mode (Tijdelijke Oplossing)

### Waarom Lokale Testing?
Voordat we naar productie gaan met Supabase, kunnen we tijdelijk een lokale server draaien die dezelfde API endpoints simuleert. Dit geeft ons de mogelijkheid om alle functionaliteit te testen zonder Supabase setup.

### Hoe Werkt Het?
- `src/supabase.js` heeft een **HYBRID MODE** die automatisch switcht
- Gebruik `REACT_APP_USE_LOCAL_SERVER=true` om lokale mode te activeren
- Lokale server draait op `http://localhost:3001` met dezelfde data als voorheen
- API base is instelbaar via `REACT_APP_API_BASE` (standaard `/api`)

### Stap 1: Lokale Testing Inschakelen
```bash
# Start de lokale server (in terminal 1)
npm run server

# Start de React app met lokale mode (in terminal 2)
npm start
```

De app gebruikt automatisch `.env.local` als die bestaat, anders `.env`.

### Stap 2: Environment Variables
`.env.local` bevat:
```env
REACT_APP_USE_LOCAL_SERVER=true
REACT_APP_TEACHER_TOKEN=test-token-123
REACT_APP_API_BASE=/api
SERVER_PORT=3001
# ... andere SMTP/admin vars
```

### Stap 3: Terug naar Supabase
Als je klaar bent met testen:
1. Verwijder `REACT_APP_USE_LOCAL_SERVER=true` uit `.env.local`
2. Of verwijder `.env.local` helemaal
3. Voeg echte Supabase credentials toe aan `.env`
4. Herstart de app

### ⚠️ Belangrijke Opmerkingen
- **Tijdelijk**: Dit is alleen voor development/testing
- **Data**: Gebruikt dezelfde JSON bestanden als voorheen
- **API**: Dezelfde endpoints als Supabase mode
- **Images**: Lokale images worden geserveerd vanaf `/images/` path
- **Auth**: Simuleert Supabase auth met dummy user
- **Hosted API**: Zet `REACT_APP_API_BASE` naar je online server URL (bijv. `https://api.jouwdomein.nl/api`)
- **CORS**: Stel `CORS_ORIGIN` op de server in op de frontend URL

---

## ☁️ Deployment naar Server (Supabase)

### Stap 1: Supabase Project Opzetten
1. Ga naar [supabase.com](https://supabase.com) en maak een nieuw project
2. Noteer je **Project URL** en **anon public key**

### Stap 2: Environment Variables Bijwerken
Update `.env` met je echte Supabase credentials:
```env
REACT_APP_SUPABASE_URL=https://jouw-project.supabase.co
REACT_APP_SUPABASE_ANON_KEY=jouw-anon-key-hier
```

### Stap 3: Database Schema Uitvoeren
1. Ga naar Supabase Dashboard → SQL Editor
2. Voer `supabase-schema.sql` uit - dit creëert alle tabellen en seed data

### Stap 4: Storage Bucket Opzetten
1. Ga naar Supabase Dashboard → Storage
2. Maak bucket aan genaamd `hon`
3. Upload badge images naar `hon/images/` folder
4. Stel Row Level Security policies in (zie README.md)

### Stap 5: Supabase Mode Activeren
De app gebruikt nu automatisch Supabase dankzij `src/supabase.js`

### Stap 6: Deploy naar Hosting
- Build de app: `npm run build`
- Deploy `build/` folder naar hosting service (Vercel, Netlify, etc.)
- Of serveer statisch: `npm install -g serve && serve -s build`

### ⚠️ Belangrijke Opmerkingen
- **Data migratie**: Export huidige data uit lokale server voordat je switcht
- **Authentication**: Supabase gebruikt anonieme auth voor uploads
- **Storage**: Badge images worden geüpload naar Supabase Storage
- **Email**: SMTP configuratie blijft werken voor wachtwoord resets

---

| Route | Component | Auth Required |
|-------|-----------|---------------|
| `/` | Auth | - |
| `/admin` | Admin | Admin |
| `/admin/preview` | AdminPreview | Admin |
| `/admin/bingo` | BingoAdmin | Admin |
| `/student` | Student | Student |
| `/student/profile` | Student (profile) | Student |
| `/bingo` | Bingo | Student |
| `/bingo/edit` | BingoEdit | Student |
| `/roster` | AdminRoster | Admin |
| `/reset/:token` | Auth (reset) | - |

---

## 🛠️ Development Setup

### Pre-start Script
Om crashes van Visual Studio Code te voorkomen door bezette poorten en lopende Node.js processen, is een `prestart` script toegevoegd aan `package.json`.

Het script wordt automatisch uitgevoerd voordat `npm start` draait en doet het volgende:
1. Killt alle lopende Node.js processen (`pkill node`)
2. Killt processen die luisteren op poort 3000 (React dev server) en 3001 (Node.js server) (`lsof -ti:3000,3001 | xargs kill -9`)

Dit zorgt ervoor dat de poorten altijd vrij zijn voordat de servers starten.

Toegevoegd op: 8 januari 2026

---

## 🧯 Backup & Herstel
- Backup bevat `students`, `groups`, `awards`, `badges`, `teachers`, `meetings`, `attendance`, `peerAwards` en `peerEvents`
- Herstel zet deze datasets terug en meldt welke onderdelen zijn mislukt

---

## � Aanwezigheidsstreak Systeem

### Functionaliteit
- **Docenten** kunnen bijeenkomsten aanmaken en aanwezigheid markeren
- **Studenten** zien hun aanwezigheidsstreak op het dashboard
- **Automatische beloning**: 50 punten bij start van de volgende week als vorige week volledig aanwezig was
- **Gamification**: Streaks motiveren consistente deelname

### Componenten
| Component | Doel |
|-----------|------|
| `Admin.js` (sectie) | Bijeenkomsten beheren en aanwezigheid markeren |
| `Student.js` (card) | Streak teller weergeven |
| `useStreaks` | Streak berekening (huidig, langste, week compleet) |
| `useMeetings` | Bijeenkomsten data |
| `useAttendance` | Aanwezigheid per bijeenkomst |

### Data Flow
1. Docent maakt bijeenkomst aan → opgeslagen in `meetings.json`
2. Docent markeert aanwezigheid → opgeslagen in `attendance.json`
3. Student ziet streak → berekend uit attendance data
4. Vorige week compleet → 50 punten toegekend bij start van nieuwe week
   - Award reden: `Aanwezigheidsstreak YYYY-W##`
   - Student krijgt `lastWeekRewarded` zodat het maar 1x gebeurt

### Real-time Updates
- **Event-driven**: Admin verhoogt `window.attendanceRefreshCounter` bij aanwezigheidssave
- **Auto-refresh**: Student dashboard ververst ook elke 2 seconden als fallback
- **Immediate feedback**: Na aanwezigheid markeren ziet student direct bijgewerkte streak
- **Performance**: Event-driven systeem voorkomt onnodige polling

### Streak freezes
- Studenten hebben per semester 2 streak freezes die automatisch worden ingezet bij de eerste twee afwezigheden.
- Een freeze voorkomt dat de streak breekt en telt ook mee als aanwezig in de weekstatistiek.
- UI toont twee kleine iconen in de streakkaart:
  - Beschikbaar: `public/images/streak-freeze.png`
  - Gebruikt: `public/images/streak-freeze-used.png`

Toegevoegd op: 9 januari 2026

---

## �🔧 Server Configuratie

### Environment Variables
De server gebruikt de volgende environment variables (gedefinieerd in `.env.local`):

- `REACT_APP_TEACHER_TOKEN`: Token voor authenticatie van admin/teacher acties (bijv. "test-token-123")
- `SERVER_PORT`: Poort voor de Node.js server (standaard 3001)
- `CORS_ORIGIN`: Toegestane frontend origin(s), komma-gescheiden of `*`
- SMTP instellingen voor email: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`

**Belangrijk**: De server leest `REACT_APP_TEACHER_TOKEN` (niet `TEACHER_TOKEN`) om consistent te zijn met de client-side configuratie. De server laadt environment variables uit `.env.local`.

Toegevoegd op: 8 januari 2026
