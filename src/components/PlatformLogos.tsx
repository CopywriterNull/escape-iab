// Simplified platform marks rendered inline as SVG. Used for editorial /
// illustrative purposes — these are the in-app browsers EscapeHatch escapes
// from, named directly. Not the official brand SVGs.

export type PlatformId =
  | "instagram"
  | "facebook"
  | "snap"
  | "discord"
  | "pinterest"
  | "tiktok"
  | "messenger"
  | "x";

const PLATFORM_META: Record<
  PlatformId,
  {
    name: string;
    bgStyle: React.CSSProperties;
    glyph: React.ReactNode;
  }
> = {
  instagram: {
    name: "Instagram",
    bgStyle: {
      background:
        "linear-gradient(135deg, #f9ce34 0%, #ee2a7b 50%, #6228d7 100%)",
    },
    glyph: (
      <g fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="14" y="14" width="36" height="36" rx="9" />
        <circle cx="32" cy="32" r="8.5" />
        <circle cx="42" cy="22" r="1.6" fill="white" />
      </g>
    ),
  },
  facebook: {
    name: "Facebook",
    bgStyle: { background: "#1877f2" },
    glyph: (
      <g fill="white">
        <path d="M37 22h-4c-1.5 0-2 .8-2 2.5V28h6l-1 6h-5v14h-6V34h-4v-6h4v-4.5C25 19 27.5 16 32 16h5v6z" />
      </g>
    ),
  },
  snap: {
    name: "Snapchat",
    bgStyle: { background: "#fffc00" },
    glyph: (
      <g fill="white" stroke="#000" strokeWidth="0.8">
        <path d="M32 12c-7 0-10 5-10 11 0 1.5.2 3.5.2 4.5-1.3.7-2.5 0-3.2 0-1 0-1.5.5-1.5 1.2 0 1.2 2.2 3.2 4.5 3.5-.8 2-3 4-5 4.5-.5.2-.8.5-.8 1 0 1 .8 1.5 2.5 1.7 0 1 .2 2 .8 2.4.7.5 1.7.2 3-.2 1 .3 2 1.8 4 3 1 .6 2.3 1 4 1 1.7 0 3-.4 4-1 2-1.2 3-2.7 4-3 1.3.4 2.3.7 3 .2.6-.4.8-1.4.8-2.4 1.7-.2 2.5-.7 2.5-1.7 0-.5-.3-.8-.8-1-2-.5-4.2-2.5-5-4.5 2.3-.3 4.5-2.3 4.5-3.5 0-.7-.5-1.2-1.5-1.2-.7 0-1.9.7-3.2 0 0-1 .2-3 .2-4.5 0-6-3-11-10-11z" />
      </g>
    ),
  },
  discord: {
    name: "Discord",
    bgStyle: { background: "#5865f2" },
    glyph: (
      <g fill="white">
        <path d="M44.5 19.7c-2.7-1.2-5.6-2.1-8.6-2.6-.4.7-.8 1.6-1.1 2.3-3.2-.5-6.4-.5-9.6 0-.3-.8-.7-1.6-1.1-2.3-3 .5-5.9 1.4-8.6 2.6-5.5 8.2-7 16.2-6.3 24 3.6 2.7 7.1 4.3 10.5 5.4.8-1.1 1.6-2.4 2.2-3.7-1.2-.5-2.3-1-3.4-1.6.3-.2.6-.4.8-.6 6.6 3.1 13.8 3.1 20.3 0 .3.2.5.4.8.6-1.1.6-2.2 1.2-3.4 1.6.6 1.3 1.4 2.5 2.2 3.7 3.5-1.1 6.9-2.7 10.5-5.4 1-9.3-1.5-17.2-6.3-24zm-21.5 19.2c-2.1 0-3.8-1.9-3.8-4.3 0-2.4 1.7-4.3 3.8-4.3s3.9 1.9 3.8 4.3c0 2.4-1.7 4.3-3.8 4.3zm14 0c-2.1 0-3.8-1.9-3.8-4.3 0-2.4 1.7-4.3 3.8-4.3s3.8 1.9 3.8 4.3c0 2.4-1.7 4.3-3.8 4.3z" />
      </g>
    ),
  },
  pinterest: {
    name: "Pinterest",
    bgStyle: { background: "#bd081c" },
    glyph: (
      <g fill="white">
        <path d="M32 14c-9.9 0-18 8.1-18 18 0 7.6 4.7 14.1 11.4 16.7-.2-1.4-.3-3.6 0-5.1.3-1.4 2.1-9 2.1-9s-.6-1.1-.6-2.7c0-2.6 1.5-4.5 3.4-4.5 1.6 0 2.4 1.2 2.4 2.6 0 1.6-1 4-1.5 6.2-.4 1.9.9 3.4 2.8 3.4 3.4 0 6-3.6 6-8.7 0-4.6-3.3-7.8-8-7.8-5.4 0-8.6 4.1-8.6 8.3 0 1.6.6 3.4 1.4 4.4.2.2.2.3.1.6-.2.8-.6 2.3-.6 2.6-.1.4-.3.5-.7.3-2.6-1.2-4.2-5-4.2-8 0-6.5 4.7-12.5 13.6-12.5 7.1 0 12.7 5.1 12.7 11.9 0 7.1-4.5 12.8-10.7 12.8-2.1 0-4-1.1-4.7-2.4l-1.3 4.8c-.5 1.8-1.7 4-2.6 5.4 1.9.6 4 .9 6.1.9 9.9 0 18-8.1 18-18S41.9 14 32 14z" />
      </g>
    ),
  },
  tiktok: {
    name: "TikTok",
    bgStyle: { background: "#000000" },
    glyph: (
      <g>
        <path
          fill="#25f4ee"
          d="M38 16c0 4.5 3.6 8.2 8 8.4v6.6c-3.1.1-6-.7-8-2.1v13.6c0 5.8-4.7 10.5-10.5 10.5S17 48.3 17 42.5 21.7 32 27.5 32c.5 0 1 0 1.5.1v6.6c-.5-.1-1-.2-1.5-.2-2.1 0-3.9 1.7-3.9 3.9s1.7 3.9 3.9 3.9 3.9-1.7 3.9-3.9V16h6.6z"
        />
        <path
          fill="#fe2c55"
          d="M40 18c0 4.5 3.6 8.2 8 8.4v6.6c-3.1.1-6-.7-8-2.1v13.6c0 5.8-4.7 10.5-10.5 10.5S19 50.3 19 44.5 23.7 34 29.5 34c.5 0 1 0 1.5.1v6.6c-.5-.1-1-.2-1.5-.2-2.1 0-3.9 1.7-3.9 3.9s1.7 3.9 3.9 3.9 3.9-1.7 3.9-3.9V18H40z"
        />
        <path
          fill="white"
          d="M39 17c0 4.5 3.6 8.2 8 8.4v6.6c-3.1.1-6-.7-8-2.1v13.6c0 5.8-4.7 10.5-10.5 10.5S18 49.3 18 43.5 22.7 33 28.5 33c.5 0 1 0 1.5.1v6.6c-.5-.1-1-.2-1.5-.2-2.1 0-3.9 1.7-3.9 3.9s1.7 3.9 3.9 3.9 3.9-1.7 3.9-3.9V17H39z"
        />
      </g>
    ),
  },
  messenger: {
    name: "Messenger",
    bgStyle: {
      background:
        "linear-gradient(180deg, #00b2ff 0%, #006aff 50%, #a532ff 100%)",
    },
    glyph: (
      <g fill="white">
        <path d="M32 12c-11 0-19 8-19 18 0 5.5 2.5 10.4 6.5 13.7v6.3l5.9-3.2c1.8.5 3.7.8 5.6.8 11 0 19-8 19-18s-7-17.6-18-17.6zm2 24.3l-4.8-5.2-9.4 5.2 10.3-11 5 5.2 9.4-5.2-10.5 11z" />
      </g>
    ),
  },
  x: {
    name: "X",
    bgStyle: { background: "#000000" },
    glyph: (
      <g fill="white">
        <path d="M40.8 14h5.4l-11.8 13.5L48 50h-10.8l-8.5-11.1L18.9 50h-5.4l12.6-14.4L12 14h11l7.7 10.2L40.8 14zm-1.9 32.8h3l-19.4-25.7h-3.2l19.6 25.7z" />
      </g>
    ),
  },
};

export function PlatformLogo({
  id,
  size = 80,
  className = "",
}: {
  id: PlatformId;
  size?: number;
  className?: string;
}) {
  const meta = PLATFORM_META[id];
  return (
    <div
      className={`rounded-[22%] grid place-items-center overflow-hidden ${className}`}
      style={{ width: size, height: size, ...meta.bgStyle }}
      title={meta.name}
      aria-label={meta.name}
    >
      <svg viewBox="0 0 64 64" width="100%" height="100%">
        {meta.glyph}
      </svg>
    </div>
  );
}

export function platformLabel(id: PlatformId): string {
  return PLATFORM_META[id].name;
}
