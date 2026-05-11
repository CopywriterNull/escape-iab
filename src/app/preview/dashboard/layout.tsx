// Minimal layout for design preview routes. No auth, no nav from the real app.

export default function PreviewLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-dvh">{children}</div>;
}
