# Forming the LLC — Tennessee, start to finish

Chris: *"Give me everything I need to have this done and completed today in terms
of where to go about doing it."*

Researched Sunday 2026-10-11 from sos.tn.gov, tn.gov/revenue, irs.gov, fincen.gov
and fentresscountytn.gov. Not legal or tax advice — §6 lists what a CPA should
look at before the first return.

Short version, before the detail:

- **The order is forced.** Articles → EIN → Revenue (TNTAP) + county license →
  bank. Each step asks for a number the previous one hands you.
- **Tonight you can file the LLC, not finish it.** The state reviews filings by
  hand. Its search page on Oct 11 read *"we have processed all corporate filings
  received in our office through October 7"* — about two business days behind —
  so a filing made tonight most likely comes back **around Wednesday Oct 14**.
  The IRS says to form the entity *before* the EIN, so the EIN waits for that
  acceptance.
- **Monday is a normal state workday** — Tennessee moved Columbus Day to the
  Friday after Thanksgiving. **Banks are closed Monday** (Federal Reserve holiday).
- **The step that matters most for the business is TNTAP.** It issues the
  **Certificate of Resale** that every distributor asks for on a dealer
  application. Up to 10 business days, so file it the moment you have the EIN.
- **Cost to stand up: about $315** — $300 state filing + card fee, $15 county
  license. EIN, TNTAP and BOI are free / not required.

---

## 0. Decide before you open the form

| Field | Pick | Why |
|---|---|---|
| **Legal name** | **`DROOOLY Wheel & Tire LLC`** — decided 2026-10-11 | Exactly that: D-R-O-O-O-L-Y, **three O's** (this repo's folder has four; the folder is the typo). Matches the site, the logo and drooolywt.com, so no assumed-name filing. **No comma before LLC and no periods in it**: the IRS only accepts A–Z, 0–9, `-` and `&` in a name, so `, L.L.C.` would be stripped there and the state and IRS records would disagree — which is what banks, processors and distributors check. Capitals don't matter legally (the state ignores case when comparing names; the IRS stores everything uppercase), so match the wordmark. Use this exact string everywhere: TNCaB, IRS, TNTAP, county, bank, Stripe, dealer applications. |
| **Members** | **One — Chris.** Decided 2026-10-11 | $300 filing fee. Disregarded entity for federal tax: Schedule C on your 1040. Still owes Tennessee franchise & excise. |
| **Management** | Member-managed | The owner runs it. |
| **Registered agent** | You, at the Grimsley street address — **only if you live in Tennessee** | The statute says an individual agent must *reside* in the state, at a TN street address (no PO box). The address becomes public record. If you don't reside in TN, use a commercial registered agent with a TN office. |
| **Principal office** | Grimsley street address, **Fentress County** | Street address required. Mailing address can be a PO box. |
| **Business email** | One you actually read | Every state reminder — including the annual report — goes only here. |
| **Fiscal year end** | December | The default. Makes the annual report due April 1. |
| **NAICS codes** | 441340 Tire Dealers · 441330 Automotive Parts & Accessories Retailers | My pick; the form takes up to three. |
| **Obligated Member Entity** | **No** | "Yes" makes the members personally liable for the LLC's debts — the opposite of why you're forming it. |
| **Effective date** | Date of filing | Formation date starts the 15-day Revenue clock (§2). |
| **Additional designation** | None | Not professional, series, etc. |

---

## 1. Tonight — Sunday Oct 11

**1a. Name check** — https://tncab.tnsos.gov/portal/business-entity-search
Search *Contains* "drool" with *Active Entities Only* unchecked. The page puts a
"verify you are human" check in front of results, so this one has to be done by
hand. The name must be distinguishable from every name on file (true, assumed
and reserved) and end in "LLC", "L.L.C." or "Limited Liability Company".

**1b. Trademark knock-out search** — https://tmsearch.uspto.gov/
Search DROOL / DROOOLY and "Wheel & Tire" in the wheel, tire and retail classes.
USPTO itself says its search isn't full clearance; this is the 15-minute check
that you aren't walking into someone's registered mark.

**1c. File the Articles of Organization** — https://tncab.tnsos.gov/portal
- **TNBear is retired.** The system is **TNCaB**, live since Feb 2025. Old
  bookmarks and most third-party guides still point at TNBear.
- Create an account first. **Click the verification email right away** — the
  link dies after 24 hours. Drafts are kept 14 days.
- Form **SS-4270, Articles of Organization (LLC)**. Fee **$50 per member, $300
  minimum, $3,000 max** — $300 for you. Card, debit or e-check plus a
  convenience fee the state doesn't publish.
- Staff review it; no published turnaround. The office runs Mon–Fri 8:00–4:30
  Central, and on Oct 11 it was working through filings received Oct 7, so
  expect acceptance **around Wednesday**. When it comes back, keep the
  **9-digit SOS control number** — TNTAP and the county both ask for it.

**1d. Operating agreement** — not filed with the state, and Tennessee doesn't
require it in writing, but **banks do ask for it** (Chase lists it as an
ownership document). Single-member is one or two pages. Sign and date it tonight.

**1e. EIN — wait for acceptance (instructions here so they're in one place)**
https://www.irs.gov/businesses/small-businesses-self-employed/get-an-employer-identification-number
- IRS: *"form your entity through the secretary of state before you apply for an
  EIN."* Apply against an LLC that doesn't exist yet and a rejected or changed
  name leaves you with an EIN in the wrong name.
- Online hours (Eastern): Mon–Fri 6 a.m.–1 a.m. · Sat 6 a.m.–9 p.m. ·
  **Sun 6 p.m.–midnight** — that's **5–11 p.m. Central tonight**.
- **Free.** Any site charging for an EIN is not the IRS.
- 15-minute inactivity timeout, no saving, and **one EIN per responsible party
  per day** — a mistake can't be redone until tomorrow.
- **Download the confirmation letter (CP 575) before you close the window.** The
  IRS says the original can't be recreated, and the bank and the county both
  want it.

---

## 2. The day the Articles are accepted (likely ~Wed Oct 14)

Monday Oct 12 the state is open and banks are closed; use it for the call in §2c.

**2a. EIN** the same day the Articles are accepted (§1e), Mon–Fri 6 a.m.–1 a.m.
Eastern.

**2b. Register with Revenue on TNTAP** — https://tntap.tn.gov/eservices/_/ →
*View Registration Links* → *Register a New Business*.
One application covers **sales & use tax, business tax, franchise & excise, and
the tire fee**. Free. Have ready:
- EIN and SOS control number
- Start date, fiscal year end (December)
- County: Fentress · Business tax **Classification 2** (it lists "parts and
  accessories, tires and batteries")
- NAICS code, description of what you sell
- Your SSN, address, email

**Deadline:** within **15 days of formation** (franchise & excise starts the day
the LLC exists). Processing is up to 10 business days; the **Certificate of
Resale** follows within a few days and reprints from TNTAP any time. That
certificate goes to Wheel Pros, ATD, Keystone and the rest with each dealer
application. The Streamlined Sales Tax exemption form marked "Resale" with your
TN account number also works.

**2c. Call the Fentress County Clerk** — Amanda Hicks, **931-879-8014**
(alt 931-879-8438). Ask three things before driving to Jamestown:
1. **Which address.** The county site says 101 N Main St; the state directory
   says 101 Main St South. Jamestown 38556.
2. **Hours, and whether they're open on Columbus Day.** The state directory says
   Mon–Fri 8–4 and Sat 8–noon; the county site lists none.
3. **Whether they want TNTAP registration done first.** The county and the state
   describe the order differently.

---

## 3. The day after the EIN

**3a. County business license** — in person at the Clerk, **$15**. No online
option. Bring your driver's license, SSN, and the **EIN letter** ("FEIN
assignment page"). https://fentresscountytn.gov/business-license/
- Under $3,000 gross: no license. $3,000–$100,000: minimal activity license.
  $100,000+: standard license. (Thresholds changed in 2023; old guides say $10k.)
- At $5k–$12k a ticket, $100k is 10–20 orders, so expect the **standard license**.
  Nationwide sales count toward the threshold.
- Grimsley is unincorporated, so **no city license**.

**3b. Business bank account.** Bring:
- Two IDs, one of them government-issued
- EIN letter
- Filed Articles, or a printout of active status from TNCaB
- Operating agreement

Chase wants every member of a member-managed LLC present. Open it before the
first dollar comes in — commingling is how the liability protection gets
argued away.

**3c. Processor / Stripe** — `PAYMENTS.md` §3 and `PAYMENTS-PLAN.md` §6 said this
waits on "a real entity." It no longer does once 3b is done.

**3d. Certificate of Existence**, only if a distributor or processor asks — $20
on TNCaB. Needs a Revenue tax clearance, so it comes after TNTAP.

---

## 4. What the LLC owes, and when

| Obligation | Amount | Due |
|---|---|---|
| **Sales & use tax** | **9.5%** on Tennessee deliveries: 7% state + 2.5% Fentress. Tennessee doesn't tax deliveries out of state; other states' tax is separate (§6). | **Monthly, the 20th.** Quarterly only after 12 months averaging ≤$1,000/month. |
| **Single-article rule** | Local tax only on the first $1,600 of one item, plus 2.75% state on $1,600–$3,200. Items "sold in sets… at a single price" are *not* single articles. | With the sales tax return |
| **Tire count on the return** | Since July 2025 the monthly return (SLS450 line 19) asks for net taxable sales of new and used tires. | Monthly |
| **TN tire pre-disposal fee** | **$1.35 per new tire** delivered in Tennessee. Keep $0.10 of it if you file on time. **Not owed on tires shipped out of state.** The distributor won't charge it (resale). If you pass it to the customer, sales tax applies to the fee. | **Quarterly, the 25th** of Jan/Apr/Jul/Oct |
| **Business tax** (standard license) | Classification 2: **0.15%** of gross retail. Out-of-state deliveries are deductible. $22 minimum. | 15th of the 4th month after year end |
| **Franchise & excise** | Excise **6.5%** of net earnings + franchise **0.25%** of net worth, **$100 minimum** even if inactive. A single-member LLC owned by a person still owes it. | First return (2026 short year): **April 15, 2027** |
| **SOS annual report** | **$300** (1–6 members). Needs the EIN. | **April 1, 2027**, then every April 1. Missing it by 2 months leads to administrative dissolution. |
| **Federal income tax** | Single member: Schedule C on your 1040. Two or more: Form 1065. | With your return |

**Not owed:**
- **BOI report.** FinCEN's final rule (effective Aug 14, 2026) exempts US
  companies.
- **Federal tire excise tax.** It falls on manufacturers and importers, so it's
  only ours if we ever import tires directly.
- **TDEC registration.** Only for those who haul or process used tires.

---

## 5. Mail and websites to ignore

- **Paid EIN sites.** The EIN is free on irs.gov.
- **"Tennessee Business Filing Center" mailers** selling annual-report filing.
  The Secretary of State warned about these in Jan 2026.
- **BOI letters.** FinCEN has no "Form 4022" or "Form 5102". Mail from a
  "US Business Regulations Dept." is a scam, and filing BOI never cost a fee.

---

## 6. What this doesn't settle

- **SOS turnaround and card fee.** Neither is published. TNCaB's language
  ("accepted / rejected") points to staff review rather than instant approval.
- **The county's address and the order of steps** — §2c.
- **Sets under the single-article rule.** Itemizing wheels on the invoice isn't
  automatically cheaper. On a $2,500 forged wheel the 2.75% single-article tax
  can cost more than 2.5% local on the whole set. CPA question; it only touches
  Tennessee deliveries.
- **S-corp election (Form 2553).** CPA question. For an election effective from
  formation, the window closes around **Dec 25, 2026**.
- **Other states.** Drop-shipping nationwide means economic nexus elsewhere,
  starting with whichever state passes its threshold first.
- **Correction to `PAYMENTS-PLAN.md` §6 row 7.** It reads "TN: $100k over 12
  months." That's the *remote-seller* threshold. A Tennessee-based seller
  registers from the first sale. The row already says "TN registration now," so
  only the parenthetical is wrong.

---

## Sources

- TN Secretary of State: https://sos.tn.gov/businesses · FAQ https://sos.tn.gov/businesses/faqs ·
  forms & fees https://sos.tn.gov/businesses/services/business-forms-fees ·
  TNCaB https://tncab.tnsos.gov/portal · state holidays https://www.tn.gov/about-tn/state-holidays.html
- TN Revenue: TNTAP https://tntap.tn.gov/eservices/_/ ·
  registration guide https://www.tn.gov/content/dam/tn/revenue/documents/forms/general/f13005_1.pdf ·
  business tax https://www.tn.gov/revenue/taxes/business-tax/registration-and-licensing.html ·
  classifications https://www.tn.gov/revenue/taxes/business-tax/classifications.html ·
  tire fee https://www.tn.gov/revenue/taxes/oil-and-tire-fees/due-dates-and-tax-rates.html ·
  F&E https://www.tn.gov/revenue/taxes/franchise---excise-tax.html ·
  sales tax manual (Aug 2026) https://www.tn.gov/content/dam/tn/revenue/documents/tax_manuals/august-2026/sales-use-tax-manual.pdf
- IRS: EIN https://www.irs.gov/businesses/small-businesses-self-employed/get-an-employer-identification-number ·
  CP 575 https://www.irs.gov/individuals/understanding-your-cp575-notice ·
  LLC classification https://www.irs.gov/businesses/small-businesses-self-employed/limited-liability-company-llc ·
  Form 720 https://www.irs.gov/instructions/i720
- FinCEN BOI: https://www.fincen.gov/boi
- Fentress County: clerk https://fentresscountytn.gov/county-clerk/ ·
  license https://fentresscountytn.gov/business-license/ ·
  communities https://fentresscountytn.gov/communities/
- Banks: https://www.chase.com/business/resources/business-bank-account-information ·
  Fed holidays https://www.federalreserve.gov/aboutthefed/k8.htm
- USPTO: https://tmsearch.uspto.gov/

*Companion to `PAYMENTS.md` and `PAYMENTS-PLAN.md`, which both stall on "apply
with a real entity." Read 2026-10-11; fees and forms change, so check the form
in TNCaB matches before relying on a figure here.*
