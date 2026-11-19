# Browser tests

Use Node 22.12+ (Node 24 LTS recommended for this lockfile).

From `frontend/`: `npm ci`, then `npx playwright install chromium`.
Copy `.env.example` to `.env` and configure your DEVELOPMENT Supabase project.
Copy `.env.e2e.example` to `.env.e2e`; use a confirmed active regular user,
not an administrator (the login helper expects `/dashboard`). Keep credentials
out of Git. Start Flask in a separate terminal for tests using real resources.

Run `npm run lint`, `npm run build`, and `npm run test:e2e` from `frontend/`.
`npm run test:e2e -- --list` only discovers tests; it does not prove they passed.
The config starts Vite on localhost:5173. Stop unrelated Vite servers first.

Resource/error/duplicate-click cases mock API data; login still uses real
Supabase Auth. These are not live database correctness or Wi-Fi tests.
Mobile Chrome is viewport/touch emulation, not a real phone or iPhone/Safari.
The minimum live acceptance check is book -> history -> cancel -> refresh ->
rebook from two physical clients, plus SDSU/UCSD permission tests.

The HTML report, screenshots, traces and authentication state are ignored.
Never publish reports containing account information without sanitizing them.
