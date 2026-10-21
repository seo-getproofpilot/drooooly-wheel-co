/* account-config.js — the Supabase project behind DROOOLY sign-in.
 *
 * Both values are public by design: the key is the project's publishable key
 * and every row is guarded by row level security on the server, so a visitor
 * holding this key sees only their own garage. The secret key is never in
 * this repo. Project, schema and auth settings live in supabase/ and the
 * design in docs/superpowers/specs/2026-10-13-accounts-design.md. */
window.DROOOLY_ACCOUNT = {
  URL: "https://xooinsjucurjsefdtidu.supabase.co",
  KEY: "sb_publishable_Bwsl2Xib5ZGm07nybIbZcQ_pkaoug8L"
};
