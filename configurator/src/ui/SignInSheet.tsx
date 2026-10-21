/* Sign in by email code, over the configurator. Two steps: the email, then
   the six digit code. Escape and the scrim close it; focus stays inside.
   On success `onDone(user)` runs (the save that asked for it) and the sheet
   closes. Errors stay inline under the field, never a modal warning. The
   same words as account.js on the shop pages. */
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent, type MouseEvent } from "react";
import { createPortal } from "react-dom";
import { isBadCode, isRateLimit, sendCode, verifyCode, type AccountUser } from "../data/account";
import { copy } from "./copy";

export interface SignInSheetProps { lead?: string; onDone: (u: AccountUser) => void; onClose: () => void; returnFocus?: () => HTMLElement | null }

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function SignInSheet({ lead, onDone, onClose, returnFocus }: SignInSheetProps) {
  const box = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; (returnFocus?.() ?? opener)?.focus?.(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!busy) setTimeout(() => field.current?.focus(), 30); }, [step, busy]);

  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape") { e.preventDefault(); onClose(); return; }
    if (e.key !== "Tab" || !box.current) return;
    const items = [...box.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
    if (!items.length) return;
    const first = items[0], last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  };
  const onScrim = (e: MouseEvent) => { if (e.target === e.currentTarget) onClose(); };

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!e.currentTarget.checkValidity()) { e.currentTarget.reportValidity(); return; }
    setBusy(true); setError(null);
    try {
      if (step === "email") {
        const em = email.trim().toLowerCase();
        setEmail(em);
        await sendCode(em);
        setStep("code"); setCode("");
      } else {
        const u = await verifyCode(email, code);
        onDone(u);
      }
    } catch (err) {
      setError(step === "email"
        ? (isRateLimit(err) ? copy.accountRateLimited : copy.accountSendFailed)
        : (isBadCode(err) ? copy.accountCodeWrong : copy.accountCodeFailed));
    } finally { setBusy(false); }
  };

  return createPortal(
    <div className="acct-scrim" onClick={onScrim} onKeyDown={onKey}>
      <div className="acct-sheet" role="dialog" aria-modal="true" aria-labelledby="acctTitle" ref={box}>
        <div className="acct-sheet__head">
          <h2 id="acctTitle">{step === "code" ? copy.accountCodeTitle : copy.accountTitle}</h2>
          <button type="button" className="acct-sheet__close" onClick={onClose} aria-label={copy.close}>✕</button>
        </div>
        <form className="acct-form" onSubmit={submit} noValidate>
          {step === "email" ? (
            <>
              <p className="acct-lead">{lead ?? copy.accountLead}</p>
              <label className="acct-label" htmlFor="acctEmail">{copy.accountEmail}</label>
              <input className="acct-input" id="acctEmail" ref={field} type="email" autoComplete="email" required disabled={busy}
                value={email} onChange={(e) => setEmail(e.target.value)} />
              {error && <p className="acct-err" role="alert">{error}</p>}
              <button type="submit" className="btn btn--primary acct-submit" disabled={busy} aria-busy={busy}>
                <span className="btn-txt">{busy ? copy.accountSending : copy.accountSend}</span>
              </button>
              <p className="acct-fine">{copy.accountFine}</p>
            </>
          ) : (
            <>
              <p className="acct-lead">{copy.accountCodeLead(email)}</p>
              <label className="acct-label" htmlFor="acctCode">{copy.accountCode}</label>
              <input className="acct-input acct-input--code" id="acctCode" ref={field} inputMode="numeric" autoComplete="one-time-code"
                pattern="[0-9]{6}" maxLength={6} required disabled={busy} value={code} onChange={(e) => setCode(e.target.value)} />
              {error && <p className="acct-err" role="alert">{error}</p>}
              <button type="submit" className="btn btn--primary acct-submit" disabled={busy} aria-busy={busy}>
                <span className="btn-txt">{busy ? copy.accountChecking : copy.accountSignIn}</span>
              </button>
              <button type="button" className="acct-link" onClick={() => { setStep("email"); setError(null); }}>{copy.accountOtherEmail}</button>
            </>
          )}
        </form>
      </div>
    </div>,
    document.body,
  );
}
