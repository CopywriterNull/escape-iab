import { NextRequest, NextResponse } from "next/server";
import { calUrl, prefillFromSearchParams } from "@/lib/booking";

/**
 * Branded, prefilled booking link: getescapehatch.com/book?s=<store>&e=<email>&n=<name>&src=<where>
 *
 * Why a redirect and not a page with the Cal.com inline embed: embed.js is
 * third-party JS that content blockers routinely drop (verified — it loads as
 * 0 bytes behind a common blocker), which would leave a prospect staring at an
 * empty box. This is the primary CTA in outbound email, so it takes zero
 * client-side dependencies.
 *
 * What we still get over pasting a cal.com URL into an email:
 *   - the link reads getescapehatch.com, not another company's calendar
 *   - name/email/store are prefilled so booking is two clicks
 *   - the store lands in the booking notes + metadata, so call prep isn't a guess
 *   - src= tags where the link was sent from
 *   - moving calendars is one env var, not a search-and-replace across surfaces
 */
export function GET(req: NextRequest) {
  const sp = Object.fromEntries(req.nextUrl.searchParams.entries());
  return NextResponse.redirect(calUrl(prefillFromSearchParams(sp)), 307);
}
