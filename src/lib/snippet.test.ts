import { describe, it, expect } from "vitest";
import { buildSnippet } from "./snippet";

const base = {
  merchantId: "11111111-1111-4111-8111-111111111111",
  ingestUrl: "https://example.com/api/track",
};

describe("buildSnippet utm_term A/B tagging", () => {
  it("embeds the tagging helper and bucket value when utmTagging is true", () => {
    const s = buildSnippet({ ...base, utmTagging: true });
    expect(s).toContain("UT_TAG=true");
    expect(s).toContain("function tagUtm()");
    expect(s).toContain('"escapehatch-"+bk');
    // Called in both escape paths.
    expect(s.match(/tagUtm\(\);/g)?.length).toBe(2);
  });

  it("keeps the helper wired but disabled when utmTagging is false", () => {
    const s = buildSnippet({ ...base, utmTagging: false });
    expect(s).toContain("UT_TAG=false");
  });

  it("defaults to disabled when utmTagging is omitted", () => {
    const s = buildSnippet({ ...base });
    expect(s).toContain("UT_TAG=false");
  });

  it("only tags when utm_term is absent (never clobbers merchant/ad UTMs)", () => {
    const s = buildSnippet({ ...base, utmTagging: true });
    expect(s).toContain('qsP.has("utm_term")');
  });

  it("skips tagging on the post-escape (Safari) side", () => {
    const s = buildSnippet({ ...base, utmTagging: true });
    // Guard: enabled AND bucketed AND not post-escape.
    expect(s).toContain("if(!UT_TAG||!bk||postEscape)return;");
  });
});
