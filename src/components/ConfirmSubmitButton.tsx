"use client";

// Submit button for server-action forms that asks before submitting. Used on
// irreversible plain-form actions (delete merchant, reject signup, delete
// partner) that previously fired on a single stray click.
export function ConfirmSubmitButton({
  message,
  className,
  children,
}: {
  message: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="submit"
      className={className}
      onClick={(e) => {
        if (!confirm(message)) e.preventDefault();
      }}
    >
      {children}
    </button>
  );
}
