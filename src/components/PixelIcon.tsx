// Pixel-art icon set, hand-drawn on a 16x16 grid to match the
// Streamline "Pixel" aesthetic without using their licensed SVGs.
// `shape-rendering: crispEdges` keeps the chunky pixel look at any size.

type IconName =
  | "home"
  | "terminal"
  | "gear"
  | "chart"
  | "dollar"
  | "bolt"
  | "eye"
  | "check"
  | "clock"
  | "arrow-up"
  | "arrow-down-right"
  | "arrow-up-right"
  | "user"
  | "cart"
  | "wave"
  | "search";

export function PixelIcon({
  name,
  size = 14,
  className = "",
}: {
  name: IconName;
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="currentColor"
      shapeRendering="crispEdges"
      className={className}
      aria-hidden="true"
    >
      {RECTS[name]}
    </svg>
  );
}

const RECTS: Record<IconName, React.ReactNode> = {
  home: (
    <>
      <rect x="7" y="2" width="2" height="1" />
      <rect x="6" y="3" width="4" height="1" />
      <rect x="5" y="4" width="6" height="1" />
      <rect x="4" y="5" width="8" height="1" />
      <rect x="3" y="6" width="10" height="1" />
      <rect x="4" y="7" width="2" height="6" />
      <rect x="10" y="7" width="2" height="6" />
      <rect x="6" y="7" width="4" height="2" />
      <rect x="7" y="9" width="2" height="4" />
    </>
  ),
  terminal: (
    <>
      <rect x="2" y="3" width="12" height="1" />
      <rect x="2" y="12" width="12" height="1" />
      <rect x="2" y="4" width="1" height="8" />
      <rect x="13" y="4" width="1" height="8" />
      {/* > prompt */}
      <rect x="4" y="6" width="1" height="1" />
      <rect x="5" y="7" width="1" height="1" />
      <rect x="6" y="8" width="1" height="1" />
      <rect x="5" y="9" width="1" height="1" />
      <rect x="4" y="10" width="1" height="1" />
      {/* underscore */}
      <rect x="8" y="10" width="4" height="1" />
    </>
  ),
  gear: (
    <>
      {/* outer cog teeth */}
      <rect x="7" y="1" width="2" height="2" />
      <rect x="7" y="13" width="2" height="2" />
      <rect x="1" y="7" width="2" height="2" />
      <rect x="13" y="7" width="2" height="2" />
      <rect x="3" y="3" width="2" height="2" />
      <rect x="11" y="3" width="2" height="2" />
      <rect x="3" y="11" width="2" height="2" />
      <rect x="11" y="11" width="2" height="2" />
      {/* ring */}
      <rect x="5" y="3" width="6" height="1" />
      <rect x="5" y="12" width="6" height="1" />
      <rect x="3" y="5" width="1" height="6" />
      <rect x="12" y="5" width="1" height="6" />
      <rect x="4" y="4" width="8" height="1" />
      <rect x="4" y="11" width="8" height="1" />
      <rect x="4" y="5" width="1" height="6" />
      <rect x="11" y="5" width="1" height="6" />
      {/* center hole */}
      <rect x="7" y="7" width="2" height="2" />
    </>
  ),
  chart: (
    <>
      <rect x="2" y="13" width="12" height="1" />
      {/* bars (left to right, rising) */}
      <rect x="3" y="9" width="2" height="4" />
      <rect x="6" y="7" width="2" height="6" />
      <rect x="9" y="5" width="2" height="8" />
      <rect x="12" y="3" width="2" height="10" />
    </>
  ),
  dollar: (
    <>
      {/* vertical $ stroke */}
      <rect x="7" y="1" width="2" height="14" />
      {/* top arc */}
      <rect x="5" y="3" width="6" height="1" />
      <rect x="4" y="4" width="1" height="2" />
      <rect x="11" y="4" width="1" height="2" />
      {/* middle */}
      <rect x="5" y="6" width="6" height="1" />
      <rect x="5" y="7" width="1" height="2" />
      <rect x="10" y="7" width="1" height="2" />
      <rect x="5" y="9" width="6" height="1" />
      {/* bottom arc */}
      <rect x="4" y="10" width="1" height="2" />
      <rect x="11" y="10" width="1" height="2" />
      <rect x="5" y="12" width="6" height="1" />
    </>
  ),
  bolt: (
    <>
      <rect x="9" y="1" width="2" height="1" />
      <rect x="7" y="2" width="3" height="1" />
      <rect x="5" y="3" width="3" height="1" />
      <rect x="4" y="4" width="3" height="1" />
      <rect x="3" y="5" width="3" height="1" />
      <rect x="3" y="6" width="6" height="1" />
      <rect x="5" y="7" width="6" height="1" />
      <rect x="9" y="8" width="3" height="1" />
      <rect x="9" y="9" width="2" height="1" />
      <rect x="8" y="10" width="2" height="1" />
      <rect x="7" y="11" width="2" height="1" />
      <rect x="6" y="12" width="2" height="1" />
      <rect x="5" y="13" width="2" height="1" />
    </>
  ),
  eye: (
    <>
      <rect x="4" y="5" width="8" height="1" />
      <rect x="2" y="6" width="2" height="1" />
      <rect x="12" y="6" width="2" height="1" />
      <rect x="2" y="7" width="2" height="3" />
      <rect x="12" y="7" width="2" height="3" />
      <rect x="4" y="9" width="1" height="1" />
      <rect x="11" y="9" width="1" height="1" />
      <rect x="4" y="10" width="8" height="1" />
      {/* pupil */}
      <rect x="6" y="6" width="4" height="1" />
      <rect x="5" y="7" width="6" height="3" />
    </>
  ),
  check: (
    <>
      <rect x="11" y="3" width="2" height="1" />
      <rect x="10" y="4" width="2" height="1" />
      <rect x="9" y="5" width="2" height="1" />
      <rect x="8" y="6" width="2" height="1" />
      <rect x="7" y="7" width="2" height="1" />
      <rect x="6" y="8" width="2" height="1" />
      <rect x="5" y="9" width="2" height="1" />
      <rect x="4" y="10" width="2" height="1" />
      <rect x="3" y="9" width="1" height="1" />
      <rect x="2" y="8" width="2" height="1" />
      <rect x="3" y="9" width="2" height="2" />
      <rect x="4" y="10" width="1" height="1" />
    </>
  ),
  clock: (
    <>
      {/* circle */}
      <rect x="5" y="2" width="6" height="1" />
      <rect x="5" y="13" width="6" height="1" />
      <rect x="3" y="4" width="1" height="2" />
      <rect x="3" y="10" width="1" height="2" />
      <rect x="12" y="4" width="1" height="2" />
      <rect x="12" y="10" width="1" height="2" />
      <rect x="4" y="3" width="1" height="1" />
      <rect x="11" y="3" width="1" height="1" />
      <rect x="4" y="12" width="1" height="1" />
      <rect x="11" y="12" width="1" height="1" />
      <rect x="2" y="6" width="1" height="4" />
      <rect x="13" y="6" width="1" height="4" />
      {/* hands */}
      <rect x="7" y="5" width="2" height="3" />
      <rect x="8" y="8" width="3" height="1" />
    </>
  ),
  "arrow-up": (
    <>
      <rect x="7" y="2" width="2" height="11" />
      <rect x="6" y="3" width="4" height="1" />
      <rect x="5" y="4" width="6" height="1" />
      <rect x="4" y="5" width="8" height="1" />
      <rect x="3" y="6" width="10" height="1" />
    </>
  ),
  "arrow-down-right": (
    <>
      <rect x="3" y="3" width="2" height="2" />
      <rect x="5" y="5" width="2" height="2" />
      <rect x="7" y="7" width="2" height="2" />
      <rect x="9" y="9" width="2" height="2" />
      <rect x="11" y="11" width="2" height="2" />
      <rect x="11" y="7" width="2" height="1" />
      <rect x="11" y="8" width="2" height="1" />
      <rect x="11" y="9" width="2" height="2" />
      <rect x="7" y="11" width="6" height="2" />
    </>
  ),
  "arrow-up-right": (
    <>
      <rect x="3" y="11" width="2" height="2" />
      <rect x="5" y="9" width="2" height="2" />
      <rect x="7" y="7" width="2" height="2" />
      <rect x="9" y="5" width="2" height="2" />
      <rect x="11" y="3" width="2" height="2" />
      <rect x="7" y="3" width="6" height="2" />
      <rect x="11" y="5" width="2" height="6" />
    </>
  ),
  user: (
    <>
      <rect x="6" y="2" width="4" height="1" />
      <rect x="5" y="3" width="6" height="1" />
      <rect x="5" y="4" width="6" height="4" />
      <rect x="6" y="8" width="4" height="1" />
      <rect x="4" y="10" width="8" height="1" />
      <rect x="3" y="11" width="10" height="1" />
      <rect x="2" y="12" width="12" height="3" />
    </>
  ),
  cart: (
    <>
      <rect x="2" y="3" width="2" height="1" />
      <rect x="4" y="4" width="1" height="1" />
      <rect x="5" y="5" width="9" height="1" />
      <rect x="6" y="6" width="7" height="1" />
      <rect x="6" y="7" width="7" height="1" />
      <rect x="6" y="8" width="7" height="1" />
      <rect x="6" y="9" width="7" height="1" />
      <rect x="6" y="10" width="1" height="1" />
      <rect x="12" y="10" width="1" height="1" />
      {/* wheels */}
      <rect x="6" y="12" width="2" height="2" />
      <rect x="11" y="12" width="2" height="2" />
    </>
  ),
  wave: (
    <>
      <rect x="2" y="8" width="2" height="2" />
      <rect x="4" y="6" width="2" height="2" />
      <rect x="6" y="4" width="2" height="2" />
      <rect x="8" y="6" width="2" height="2" />
      <rect x="10" y="8" width="2" height="2" />
      <rect x="12" y="6" width="2" height="2" />
    </>
  ),
  search: (
    <>
      <rect x="3" y="2" width="6" height="1" />
      <rect x="2" y="3" width="1" height="6" />
      <rect x="9" y="3" width="1" height="6" />
      <rect x="3" y="9" width="6" height="1" />
      <rect x="9" y="9" width="2" height="2" />
      <rect x="11" y="11" width="2" height="2" />
      <rect x="13" y="13" width="2" height="2" />
    </>
  ),
};
