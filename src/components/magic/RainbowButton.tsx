import Link from "next/link";

type CommonProps = {
  children: React.ReactNode;
  className?: string;
};

export function RainbowButton({
  href,
  type,
  children,
  className = "",
  ...rest
}: CommonProps & {
  href?: string;
  type?: "button" | "submit";
}) {
  const base =
    "rainbow-btn inline-flex items-center justify-center gap-2 px-5 h-11 rounded-full text-[var(--color-cta-fg)] text-[14px] font-medium press lift focus-ring whitespace-nowrap";
  if (href) {
    return (
      <Link href={href} className={`${base} ${className}`} {...rest}>
        {children}
      </Link>
    );
  }
  return (
    <button type={type ?? "button"} className={`${base} ${className}`} {...rest}>
      {children}
    </button>
  );
}
