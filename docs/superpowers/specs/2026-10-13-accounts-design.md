# Accounts: one DROOOLY sign-in that saves builds across the site

Written 2026-10-13. Matthew: "Let them create an account to save a build", then "Lets use
supabase" and "set it up for Droooly in general, not just this tool". So this is the site's
account layer, not a configurator feature: the same sign-in on every page, one list of saved
builds, and the quote form knowing who is asking.

## What the shopper gets

- **Sign in by email code.** Enter an email, get a six digit code, type it, done. No passwords,
  no password resets. The session lives in the browser for the site's whole origin, so signing
  in on the visualizer signs you in on the shop pages and the other way round.
- **Save a build** from the visualizer ("Save my build") and from every brand builder
  ("Save this build"). The first save asks for the email; after that it is one tap.
- **My garage** (`garage.html`): every saved build with its picture, name, date, Open,
  Rename and Delete, plus the signed-in email and Sign out. The header shows "Sign in" or
  "My garage" on every page.
- **Quote forms** prefill the email of a signed-in shopper and carry the account id in the
  submission, so a quote can be matched to a garage.

## Where it runs

- **Supabase project `DROOOLY`** (ref `xooinsjucurjsefdtidu`, us-east-1, Matthew's org
  `frswvmcfppaoyqwjpynr`, created 2026-10-13 by the CLI). Auth with email OTP, one table,
  row level security. Config and migrations live in `supabase/` and are pushed with
  `supabase db push` and `supabase config push`. The publishable key is public and sits in
  `account-config.js`; the secret key is never in the repo.
- **Static pages** load `@supabase/supabase-js` (UMD, pinned version, from jsdelivr; the
  Railway CSP allows https scripts) and `account.js`, which owns the header control, the
  sign-in sheet, and `window.DrooolyAccount` for the builder, the garage page and the forms.
- **The configurator** uses the same library from npm (`configurator/src/data/account.ts`)
  against the same project, so it shares the session through the origin's localStorage.

## Data

```sql
create table public.builds (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  source text not null check (source in ('visualize', 'builder')),
  name text not null default '' check (char_length(name) <= 80),
  url text not null check (char_length(url) <= 2048),   -- how to reopen it on this site
  data jsonb,                                            -- the builder's serialised build; null for visualize
  still_key text,                                        -- studio shot key when one was rendered
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

RLS: a signed-in user can select, insert, update and delete rows where `user_id = auth.uid()`;
nobody else sees anything. `url` is a same-origin path and the garage page renders it as a
link only after checking it starts with `/` or a known page name. No price is stored on a
visualize row; the builder row keeps the builder's own `total`, which is a quote input and is
never printed while `showPrices` is off (same rule as the builder itself).

## Sign-in sheet (static pages and the configurator alike)

Two states. Email: "Save your builds to your garage" with one email field and "Send my code".
Code: "We sent a six digit code to <email>" with the code field, "Sign in", and "Use another
email". Errors stay inline under the field. No modal warnings; the sheet is a form the shopper
asked for. A one line privacy note: "Your email is used to sign you in and nothing else."

## Rules carried over

No "guaranteed fit" anywhere. No price on a saved visualize build. Email is the only personal
field collected. Copy through slopcheck. The saved build never changes what the quote form
sends except the two prefills above.

## Email delivery

Supabase's built in sender only delivers to the project's own team addresses and is rate
limited; it is enough to verify the flow with Matthew's address. Public sign-ins need custom
SMTP in the Supabase dashboard (Resend's free tier fits), which also needs DNS records on
drooolywt.com. Until that is set, the sheet stays honest: a send failure shows "We could not
send a code right now. Your build still works as a share link." LAUNCH-CHECKLIST carries it.

## Verification

- `supabase db push` applied; RLS checked with the anon key (no rows without a session).
- Configurator: unit tests for the account module's state and payloads; e2e for Save my
  build with the network mocked.
- Static site: `tools/test-pages.js` covers garage.html and the header control; a manual run
  of the code flow on staging with Matthew's email.
