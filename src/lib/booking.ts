// Single source of truth for the "book a time" link.
//
// Why this file exists: the install <script> tag used to be hand-written on five
// different surfaces, drifted, and shipped broken installs for months (see
// docs/OPERATIONS.md). The booking link had the same shape of bug — /l carried a
// TODO placeholder pointing at cal.com/getescapehatch, which 404s. Every surface
// that offers a call now imports from here, so changing the calendar is one edit.
//
// Set BOOKING_CAL_LINK in Vercel to move the calendar without a deploy of copy.

/** `<cal.com username>/<event slug>`. Override with env when the calendar moves. */
export const CAL_LINK = process.env.NEXT_PUBLIC_CAL_LINK || "lenny-mailtail/30min";

export const CAL_ORIGIN = "https://cal.com";

export type BookingPrefill = {
  /** Prospect's store domain, e.g. "odysseyproductsshop.com". */
  store?: string;
  /** Prospect's work email — prefills the Cal.com email field. */
  email?: string;
  /** Prospect's name — prefills the Cal.com name field. */
  name?: string;
  /** Where the link was sent from, for attribution ("followup", "digest", "l"). */
  src?: string;
};

/** Strip protocol/path/www so a pasted URL and a bare domain normalize the same. */
export function normalizeStore(raw?: string | null): string | undefined {
  if (!raw) return undefined;
  const s = raw.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").split(/[/?#]/)[0];
  return /^[a-z0-9.-]+\.[a-z]{2,}$/.test(s) ? s : undefined;
}

function isEmail(raw?: string | null): raw is string {
  return !!raw && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw.trim());
}

/**
 * The direct Cal.com URL with prefill applied. `name`, `email` and `notes` are
 * Cal.com's documented prefill params; anything unknown is dropped rather than
 * guessed at, so a bad param can never break the booker.
 */
export function calUrl(p: BookingPrefill = {}): string {
  const store = normalizeStore(p.store);
  const url = new URL(`${CAL_ORIGIN}/${CAL_LINK}`);
  // Only prefill the name field with a real person's name. Deriving one from the
  // domain fills their booking form with "Odysseyproductsshop", which reads worse
  // than an empty field.
  const name = p.name?.trim();
  if (name) url.searchParams.set("name", name);
  if (isEmail(p.email)) url.searchParams.set("email", p.email.trim());
  if (store) {
    url.searchParams.set("notes", `Store: ${store}`);
    // Surfaces on the booking record so the call prep isn't a guess.
    url.searchParams.set("metadata[store]", store);
  }
  if (p.src) url.searchParams.set("metadata[src]", p.src);
  return url.toString();
}

/**
 * The link to actually put in emails and Slack: branded, short, and swappable.
 * e.g. bookLink({ store: "getreviv.com", email: "…", src: "followup" })
 *   -> https://getescapehatch.com/book?s=getreviv.com&e=…&src=followup
 */
export function bookLink(p: BookingPrefill = {}, origin = "https://getescapehatch.com"): string {
  const url = new URL("/book", origin);
  const store = normalizeStore(p.store);
  if (store) url.searchParams.set("s", store);
  if (isEmail(p.email)) url.searchParams.set("e", p.email.trim());
  if (p.name?.trim()) url.searchParams.set("n", p.name.trim());
  if (p.src) url.searchParams.set("src", p.src);
  return url.toString();
}

/** Accepts both the short (s/e/n) and long (store/email/name) param spellings. */
export function prefillFromSearchParams(
  sp: Record<string, string | string[] | undefined>,
): BookingPrefill {
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  return {
    store: one(sp.s) ?? one(sp.store) ?? one(sp.website),
    email: one(sp.e) ?? one(sp.email),
    name: one(sp.n) ?? one(sp.name),
    src: one(sp.src) ?? one(sp.utm_source),
  };
}
