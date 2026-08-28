# CLAUDE.md — Droooly Wheel Co

Drop this folder at the root of the site repo. Claude Code reads `CLAUDE.md` automatically on every session, so this is the persistent brief — no re-explaining the project.

---

## What this is

An e-commerce site selling aftermarket wheel and tire packages, specializing in **lifted trucks, duallys, and 8-lug HD applications**. Tennessee-based, launching online-first, fulfilling by distributor drop-ship.

**The homepage already exists.** Layout is modeled on Boosted Wheels & Tires: wheel style → available configurations (dually / single / super single) → color options → CTA. Match the existing design language. Do not redesign what's already built unless asked.

## The differentiator

Fitment accuracy and willingness to handle setups other shops refuse — aggressive duallys, wide wheels, tire-to-rim-width combinations chain shops turn away. The site should reflect expertise, not just a catalog.

## Non-negotiable rules

These come from legal review and business constraints. Do not "improve" past them.

1. **Never promise fitment as a guarantee.** No "guaranteed to bolt right up," "guaranteed fit," "fits perfectly." Promise the *process*: "Fitment verified before we build it." A guarantee on the page contradicts the Terms of Sale and creates real liability.

2. **No warning popups, modals, or interstitials.** This audience knows what they're buying. Specs are visible on the product page; the record lives in the order confirmation. See `specs/03-copy-rules.md`.

3. **Never display a brand we aren't authorized to sell.** The brand wall stays placeholder-driven until distributor accounts clear. Brand list must be data-driven so it can be swapped in one file.

4. **Pricing is MAP-constrained.** Most wheel brands enforce Minimum Advertised Price; some prohibit advertising price at all. Build price fields into the schema now, leave them null, and gate display per-brand. See `specs/02-data-schema.md`.

5. **One hard stop in the fitment flow.** If a customer discloses a tow/haul weight and the assembly's load rating falls short, the buy button is replaced with a contact CTA. Everything else is the customer's call.

6. **Mounted mail-order is not a default option.** It's a premium service with freight stated separately. Never present it as free shipping.

## Spec files

| File | Contents |
|---|---|
| `specs/01-fitment-logic.md` | The fitment finder decision tree, rim width check, hard stops |
| `specs/02-data-schema.md` | Product, tire, vehicle, and brand data shapes |
| `specs/03-copy-rules.md` | Approved and forbidden language, order confirmation format |
| `specs/04-pages.md` | Page-by-page build spec and component list |
| `data/*.example.json` | Example data files showing expected shape |

## Stack notes

*[Fill in: framework, hosting, cart/checkout platform once decided.]*

Requirements regardless of stack:
- Product data must be file- or CMS-driven, never hardcoded in components
- Fitment logic lives in one module, testable independently of UI
- Order confirmation email template is a first-class deliverable, not an afterthought
- Mobile first — this audience shops on phones from job sites

## Things that are NOT built yet

- Real product catalog (waiting on distributor accounts)
- Real pricing (waiting on dealer cost + MAP terms)
- Payment processor integration
- Tire rim-width reference data (needs populating from manufacturer specs)

Build these as clearly-marked stubs with realistic example data so the site is fully functional and swap-ready.
