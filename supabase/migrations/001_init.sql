# LeadPilot AI

LeadPilot AI is a working SaaS MVP for agencies that manage leads, automate personalized follow-up messaging, and track opportunities.

## Architecture overview

- Frontend: React + TypeScript + Vite + Tailwind CSS
- API: Express server with validation, quotas, and demo auth
- Data model: Supabase-ready PostgreSQL schema under `supabase/migrations/001_init.sql`
- AI adapter: configurable mock provider in the server environment for local development
- Demo mode: synthetic data is seeded automatically and clearly labeled in the UI

This repository is intentionally built to run without external credentials. A real deployment still needs a Supabase project, payment provider credentials, and any AI provider API keys.

## Project structure

- `src/` — React application and UI logic
- `server/` — Express API plus validation and scheduling logic
- `supabase/migrations/` — PostgreSQL schema and row-level security scaffolding
- `.env.example` — required environment variable placeholders

## Local setup

1. Install dependencies:
   npm install
2. Copy environment placeholders:
   cp .env.example .env
3. Start the app:
   npm run dev
4. Visit:
   - Frontend: http://localhost:5173
   - API: http://localhost:3001/api/health

Demo credentials:
- Email: demo@leadpilot.ai
- Password: password123

## Supabase setup

1. Create a new Supabase project.
2. Run the contents of `supabase/migrations/001_init.sql` in the SQL editor.
3. Enable Row Level Security and adapt policies for tenant-scoped access.
4. Add the project URL and anon/service role keys to `.env`.

## Production notes

- RLS and server-side validation are required for production access control.
- AI generation uses the mock provider by default in demo mode; replace it with a real model adapter behind the server.
- Payment integration is intentionally left as an interface layer and not enabled without real credentials.
- No secrets should be stored in frontend code or committed to Git.

## Running checks

- Test backend validation logic: `npm test`
- Build the frontend: `npm run build`

## Deployment

- Deploy the frontend to Cloudflare Pages or Vercel.
- Deploy the API to a serverless or managed Node runtime such as Railway, Render, or Cloudflare Workers + D1 if reworked for a production environment.
- Configure environment variables from `.env.example` and verify webhook signatures before enabling billing.
