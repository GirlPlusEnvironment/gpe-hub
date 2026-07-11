# gpe-community-hub-dcb-5316
The code base for the new Girl Plus Environment Community Hub webpage. Senior Capstone for team DCB 5316 at Georgia Tech.

## Design Documentation

Figma Link: https://www.figma.com/design/uSmks2mhzCPxV8dyQdQ5Ui/GPE-DS-v1?node-id=0-1&t=T2p69wgQDIauSHMO-1 

Notion Link: https://www.notion.so/GPE-DS-v1-Foundations-v1-0-28e5ed7294f380759b44db415a2b7297?source=copy_link 

## Supabase Setup

1. Duplicate `.env.example` to `.env.local` (or `.env`) and drop in your project credentials:

   ```
   VITE_SUPABASE_URL=your-project-url
   VITE_SUPABASE_ANON_KEY=your-anon-key
   ```

2. Restart `npm run dev` so Vite picks up the new environment variables.

3. The app expects the `profiles` table to exist (the Supabase quickstart creates it). The login screen handles sign up + sign in, and the Profile page reads/writes to that table via Supabase Auth.

## GitHub Pages Deployment

GitHub Pages deploys through `.github/workflows/deploy-pages.yml`.

Required GitHub repository secrets:

```
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
```

Before cutover:

1. In Supabase Auth, set the Site URL to `https://members.girlplusenvironment.org`.
2. Add redirect URLs for:
   - `https://members.girlplusenvironment.org/login`
   - `https://members.girlplusenvironment.org/sign-up`
3. Review the targeted SQL in `supabase/migrations/20260710_add_profile_trigger.sql` and `supabase/migrations/20260710_harden_storage_and_realtime.sql`.
4. If live verification is needed, run the read-only checks in `supabase/audits/live_backend_verification.sql`.

## Explore Listings Schema

To feed the Explore tabs from Supabase instead of mock data:

1. Open the Supabase SQL editor and run `supabase/listings-schema.sql`. This creates:
   - `public.listings` with enums (`listing_category`, `listing_status`) and metadata jsonb.
   - `public.listing_favorites` for per-user saves.
   - Seed rows (one per category) so the UI has something to show.
2. Published listings (`status = 'published'`) are visible to everyone. Drafts remain private to the submitting user.
3. Category-specific details are pulled from the `metadata` JSON. Keep the keys aligned with `src/lib/listings.ts` when adding new rows (e.g., `job_type`, `event_type`, `resource_type`, etc.).

When you wire up the “Make a Submission” flow later, insert new rows into `public.listings` using the same metadata structure and the UI will render them automatically.
