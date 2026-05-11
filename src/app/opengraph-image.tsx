import { ImageResponse } from "next/og";
import { brand } from "@/lib/branding";

// nodejs runtime per 2026 best practice for OG images:
// - no edge bundle 500KB ceiling
// - more reliable font fetch from Google Fonts
// - platforms cache for days anyway, no latency advantage to edge
export const runtime = "nodejs";
export const alt = brand.ogTitle;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

async function loadGoogleFont(
  family: string,
  axisQuery: string, // e.g. "wght@600" or "ital,wght@1,400"
): Promise<ArrayBuffer | null> {
  try {
    const cssUrl = `https://fonts.googleapis.com/css2?family=${family.replace(/ /g, "+")}:${axisQuery}&display=swap`;
    const css = await fetch(cssUrl, {
      headers: { "User-Agent": "Mozilla/5.0" },
    }).then((r) => r.text());
    const match = css.match(/src:\s*url\((https:\/\/[^)]+)\)/);
    if (!match) return null;
    return fetch(match[1]).then((r) => r.arrayBuffer());
  } catch {
    return null;
  }
}

export default async function OpengraphImage() {
  const [geistData, geistBoldData, instrumentData] = await Promise.all([
    loadGoogleFont("Geist", "wght@500"),
    loadGoogleFont("Geist", "wght@700"),
    loadGoogleFont("Instrument Serif", "ital,wght@1,400"),
  ]);

  const fonts: Array<{
    name: string;
    data: ArrayBuffer;
    weight: 500 | 700;
    style: "normal" | "italic";
  }> = [];
  if (geistData) fonts.push({ name: "Geist", data: geistData, weight: 500, style: "normal" });
  if (geistBoldData) fonts.push({ name: "Geist", data: geistBoldData, weight: 700, style: "normal" });
  if (instrumentData)
    fonts.push({ name: "Instrument Serif", data: instrumentData, weight: 500, style: "italic" });

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#fafafa",
          display: "flex",
          flexDirection: "column",
          padding: 80,
          fontFamily: "Geist, system-ui, sans-serif",
        }}
      >
        {/* Top: brand wordmark + status */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div
              style={{
                width: 36,
                height: 36,
                background: "#4f7cff",
                borderRadius: 10,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <svg
                viewBox="0 0 24 24"
                width="22"
                height="22"
                fill="none"
                stroke="#fafafa"
                strokeWidth="2.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M14 4h6v6" />
                <path d="M20 4l-8 8" />
                <path d="M18 13v5a2 2 0 01-2 2H6a2 2 0 01-2-2V8a2 2 0 012-2h5" />
              </svg>
            </div>
            <div
              style={{
                fontSize: 28,
                fontWeight: 700,
                color: "#09090b",
                letterSpacing: "-0.022em",
              }}
            >
              {brand.name}
            </div>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              fontSize: 16,
              color: "#52525b",
              border: "1px solid #e4e4e7",
              borderRadius: 9999,
              padding: "8px 16px",
              background: "rgba(255,255,255,0.7)",
            }}
          >
            <div
              style={{ width: 8, height: 8, borderRadius: 9999, background: "#16a34a" }}
            />
            <span style={{ fontWeight: 500 }}>Now in private beta</span>
          </div>
        </div>

        {/* Spacer */}
        <div style={{ flex: 1, display: "flex" }} />

        {/* Two-line H1 */}
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              fontSize: 78,
              fontWeight: 700,
              color: "#09090b",
              letterSpacing: "-0.04em",
              lineHeight: 0.98,
            }}
          >
            Your Instagram ads work.
          </div>
          <div
            style={{
              fontSize: 78,
              fontFamily: "Instrument Serif, Georgia, serif",
              fontStyle: "italic",
              color: "#4f7cff",
              letterSpacing: "-0.015em",
              lineHeight: 1,
              marginTop: 6,
            }}
          >
            Your Instagram checkout doesn’t.
          </div>
        </div>

        {/* Spacer */}
        <div style={{ flex: 1, display: "flex" }} />

        {/* Footer: url */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            color: "#52525b",
            fontSize: 18,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span>Detects Instagram’s in-app browser, reopens in Safari.</span>
          </div>
          <div style={{ fontWeight: 500, color: "#09090b" }}>{brand.domain}</div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: fonts.length > 0 ? fonts : undefined,
    },
  );
}
