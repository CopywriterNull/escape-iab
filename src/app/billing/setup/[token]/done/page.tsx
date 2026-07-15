import { brand } from "@/lib/branding";

export default function BillingSetupDone() {
  return (
    <main className="min-h-dvh flex items-center justify-center p-8">
      <div className="max-w-md text-center space-y-3">
        <h1 className="text-xl font-semibold">Card saved — you&apos;re all set</h1>
        <p className="text-sm opacity-70">
          {brand.name} bills monthly based on measured incremental revenue. Every
          invoice is itemized and emailed to you by Stripe.
        </p>
      </div>
    </main>
  );
}
