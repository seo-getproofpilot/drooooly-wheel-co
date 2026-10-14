/* One DROOOLY sign-in, shared with the rest of the site (account.js on the
   static pages). Email code on Supabase; the session lives in this origin's
   localStorage under the library's default key, so a shopper signed in on
   the shop pages is signed in here and the other way round. The library is
   imported on first use, so the main bundle does not carry it. Design:
   docs/superpowers/specs/2026-10-13-accounts-design.md. */
import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { Catalog } from "./types";
import type { Build } from "../flow";
import { encode } from "../flow";
import { describe } from "../ui/describe";

/* Public by design: the publishable key, with row level security behind it. */
export const SUPABASE_URL = "https://xooinsjucurjsefdtidu.supabase.co";
export const SUPABASE_KEY = "sb_publishable_Bwsl2Xib5ZGm07nybIbZcQ_pkaoug8L";

export interface AccountUser { id: string; email: string }
export interface BuildRow { source: "visualize"; name: string; url: string; still_key: string | null }

let clientP: Promise<SupabaseClient> | null = null;
export function getClient(): Promise<SupabaseClient> {
  if (!clientP) {
    clientP = import("@supabase/supabase-js").then(({ createClient }) =>
      createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } }));
  }
  return clientP;
}

const toUser = (u: User | null | undefined): AccountUser | null => (u && u.email ? { id: u.id, email: u.email } : null);

export async function currentUser(): Promise<AccountUser | null> {
  const c = await getClient();
  const { data } = await c.auth.getSession();
  return toUser(data.session?.user);
}

/** Calls back with the user now and on every change; returns the unsubscribe. */
export function onAuth(cb: (u: AccountUser | null) => void): () => void {
  let off: (() => void) | null = null;
  let gone = false;
  getClient().then((c) => {
    if (gone) return;
    c.auth.getSession().then(({ data }) => { if (!gone) cb(toUser(data.session?.user)); });
    const { data } = c.auth.onAuthStateChange((_e, s) => cb(toUser(s?.user)));
    off = () => data.subscription.unsubscribe();
  });
  return () => { gone = true; off?.(); };
}

export async function sendCode(email: string): Promise<void> {
  const c = await getClient();
  const { error } = await c.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
  if (error) throw error;
}

export async function verifyCode(email: string, code: string): Promise<AccountUser> {
  const c = await getClient();
  const { data, error } = await c.auth.verifyOtp({ email, token: code.replace(/\D/g, ""), type: "email" });
  if (error) throw error;
  const u = toUser(data.user);
  if (!u) throw new Error("no user");
  return u;
}

export async function signOut(): Promise<void> {
  const c = await getClient();
  await c.auth.signOut();
}

/** The row for the build on stage: a readable name, the share path, the studio key if one was rendered. */
export function buildRow(cat: Catalog, b: Build, stillKey: string | null = null): BuildRow {
  const d = describe(cat, b);
  const name = [d.truck, d.paint, d.wheel, d.finish].filter(Boolean).join(", ").slice(0, 80);
  return { source: "visualize", name, url: "/visualize/" + encode(b), still_key: stillKey };
}

export async function saveBuild(row: BuildRow): Promise<{ id: string }> {
  const c = await getClient();
  const { data: s } = await c.auth.getSession();
  const uid = s.session?.user.id;
  if (!uid) throw new Error("not signed in");
  const { data, error } = await c.from("builds").insert({ user_id: uid, ...row }).select("id").single();
  if (error) throw error;
  return { id: (data as { id: string }).id };
}

/* Friendly text for the two failures a shopper can meet. */
export const isRateLimit = (err: unknown) => /rate|too many|seconds/i.test(String((err as Error)?.message ?? ""));
export const isBadCode = (err: unknown) => /expired|invalid/i.test(String((err as Error)?.message ?? ""));
