# Epikaizo Guesthouse website

Meridian build for Epikaizo Guesthouse: public site, room and restaurant booking requests, and an admin area for staff.

| Folder | What | Owner |
| --- | --- | --- |
| `api/` | Express + TypeScript API, PostgreSQL via Drizzle ORM | Dev B |
| `web/` | Next.js site and admin area | Dev A, Dev C |
| `docs/` | Requirements, API contract, test plan | Everyone |

## Run it locally

You need Node.js 20 or newer, and Docker Desktop (or PostgreSQL 16 installed directly).

```bash
# 1. Start the database (from the repo root)
docker compose up -d

# 2. Install and configure the API
cd api
npm install
cp .env.example .env

# 3. Create the tables and add fake starter data
npm run db:migrate
npm run db:seed

# 4. Start the API (restarts on every save)
npm run dev
```

Check it works: open http://localhost:4000/health/db and http://localhost:4000/rooms.

## API scripts (run inside `api/`)

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the API with auto-restart |
| `npm run typecheck` | Check types without building |
| `npm run build` then `npm start` | Build to `dist/` and run it, as the host will |
| `npm run db:generate` | After editing `src/db/schema.ts`, create a migration in `api/drizzle/` |
| `npm run db:migrate` | Apply new migrations to the database in `DATABASE_URL` |
| `npm run db:seed` | Wipe and refill rooms, menu and page text with fake data (never in production) |
| `npm run db:studio` | Browse the database in your browser |

## Working rules

- `main` is always deployable; one branch per task, e.g. `b/availability`.
- Every pull request gets one review before merging.
- Never commit `.env` files or passwords.
- Changing the database: edit `src/db/schema.ts`, run `npm run db:generate`, commit the new file in `api/drizzle/` with your code.
- Changing an endpoint: update `docs/api.md` in the same pull request.
