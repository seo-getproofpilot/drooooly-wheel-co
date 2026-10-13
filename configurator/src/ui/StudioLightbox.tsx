/* The studio shot, shown over the configurator: the JPEG centred and
   contained on a dark scrim, with Save photo, Copy link and a way back to the
   3D view. Escape and the scrim close it; focus stays inside while it is open
   and goes back to whatever opened it. The build is never touched. */
import { useEffect, useRef, useState, type KeyboardEvent, type MouseEvent } from "react";
import { createPortal } from "react-dom";
import { copy } from "./copy";

export interface StudioLightboxProps {
  url: string; alt: string; onClose: () => void;
  /** where focus goes on close; defaults to whatever had focus when it opened */
  returnFocus?: () => HTMLElement | null;
}

const FOCUSABLE = 'a[href], button:not([disabled]), input, [tabindex]:not([tabindex="-1"])';

export function StudioLightbox({ url, alt, onClose, returnFocus }: StudioLightboxProps) {
  const box = useRef<HTMLDivElement>(null);
  const closeBtn = useRef<HTMLButtonElement>(null);
  const [note, setNote] = useState<{ text: string; url?: string } | null>(null);

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    closeBtn.current?.focus();
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; (returnFocus?.() ?? opener)?.focus?.(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape") { e.preventDefault(); onClose(); return; }
    if (e.key !== "Tab" || !box.current) return;
    const items = [...box.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
    if (!items.length) return;
    const first = items[0], last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  };

  const copyLink = async () => {
    try { await navigator.clipboard.writeText(url); setNote({ text: copy.studioCopied }); }
    catch { setNote({ text: copy.studioCopyThis, url }); }
  };

  /* A cross-origin <a download> opens the image instead of saving it, so the
     click fetches the JPEG and saves it from a blob. When that fails the image
     opens in a new tab, where a long press or right click saves it. */
  const saveBlob = async (e: MouseEvent<HTMLAnchorElement>) => {
    if (new URL(url, location.href).origin === location.origin) return; // the browser saves same-origin links itself
    e.preventDefault();
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(String(res.status));
      const href = URL.createObjectURL(await res.blob());
      const a = document.createElement("a");
      a.href = href; a.download = "droooly-studio-shot.jpg"; a.click();
      setTimeout(() => URL.revokeObjectURL(href), 10_000);
    } catch { window.open(url, "_blank", "noopener"); }
  };

  const root = document.getElementById("app") ?? document.body;
  return createPortal(
    <div className="lightbox" role="dialog" aria-modal="true" aria-label={copy.studioTitle} ref={box} onKeyDown={onKey}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <figure className="lightbox__frame">
        <img className="lightbox__img" src={url} alt={alt} />
      </figure>
      <div className="lightbox__bar">
        <a className="btn btn--primary btn--sm" href={url} download="droooly-studio-shot.jpg" onClick={saveBlob}><span className="btn-txt">{copy.studioSave}</span></a>
        <button type="button" className="btn btn--secondary btn--sm" onClick={copyLink}><span className="btn-txt">{copy.studioCopy}</span></button>
        <button type="button" className="btn btn--secondary btn--sm" ref={closeBtn} onClick={onClose}><span className="btn-txt">{copy.studioClose}</span></button>
      </div>
      <div className="lightbox__note" aria-live="polite">
        {note?.text}
        {note?.url && <input readOnly value={note.url} aria-label={copy.studioCopy} onFocus={(e) => e.target.select()} />}
      </div>
    </div>,
    root,
  );
}
