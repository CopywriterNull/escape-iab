import { brand } from "@/lib/branding";

/** Canonical public origin for links we mint (invite accept URLs, emails).
 *  `||` (not ??) deliberately: an empty-string NEXT_PUBLIC_SITE_URL is a
 *  known failure mode in this repo and must still fall back to prod. */
export function siteOrigin(): string {
  return process.env.NEXT_PUBLIC_SITE_URL || `https://${brand.domain}`;
}
