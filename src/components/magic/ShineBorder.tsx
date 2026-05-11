// Wrap a child node to give it an animated conic-gradient shine border.
// Pure CSS; the border lives in a ::before pseudo so it doesn't shift content.
export function ShineBorder({
  children,
  radius = 18,
  className = "",
}: {
  children: React.ReactNode;
  radius?: number;
  className?: string;
}) {
  return (
    <div
      className={`shine-border ${className}`}
      style={{ borderRadius: radius }}
    >
      {children}
    </div>
  );
}
