/* form-config.js — where quote requests go.
 *
 * WHY THIS IS ITS OWN FILE. Until 2026-10-11 every form on this site showed
 * "Sent ✓" and delivered nothing. Somebody could spec a $9,000 set, hit the
 * button, see a tick, and we would never know they existed. That is the worst
 * failure mode a quote-first site has, because the quote form IS the product.
 *
 * ONE VALUE TO FILL IN. Set ACCESS_KEY below and every form on the site starts
 * delivering. Nothing else needs touching.
 *
 * HOW TO GET IT (about two minutes, no account):
 *   1. Go to https://web3forms.com
 *   2. Enter the business inbox address. They email an access key.
 *   3. Paste it as ACCESS_KEY. Submissions arrive at that inbox.
 *
 * Web3Forms was chosen over Formspree because it needs no account and no
 * dashboard, which suits a static site on Railway with no backend. Swapping to
 * anything else is a change to ENDPOINT and the body shape in script.js's
 * sendForm(), in one place.
 *
 * UNTIL THE KEY IS SET the forms do NOT pretend. They show the customer the
 * phone number and tell them to call, which is honest and still gets us the
 * lead. Never restore a fake success state.
 */
window.DROOOLY_FORMS = {
  /* Paste the Web3Forms access key here. Empty = forms tell the customer to
     call instead of silently failing. */
  ACCESS_KEY: "",

  /* Where Web3Forms posts. Only change this if we move off Web3Forms. */
  ENDPOINT: "https://api.web3forms.com/submit",

  /* Shown on the form and in the failure message. */
  PHONE_DISPLAY: "602-332-5400",
  PHONE_HREF: "+16023325400",

  /* Prefixes the email subject so quote requests sort in the inbox. */
  SUBJECT_PREFIX: "DROOOLY quote request"
};
