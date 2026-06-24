const MAX_REVENUE_CENTS = 99_999_99;

export type PurchaseRevenue = {
  valueCents: number | null;
  currency: string | null;
  valueCurrency: string | null;
  originalValueCents: number | null;
  originalCurrency: string | null;
};

function normalizeCurrency(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().toUpperCase();
  return trimmed.length > 0 ? trimmed.slice(0, 8) : null;
}

function parseAmount(value: unknown): number | null {
  const num =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? parseFloat(value)
        : NaN;
  return Number.isFinite(num) && num > 0 ? num : null;
}

function amountToCents(amount: unknown): number | null {
  const parsed = parseAmount(amount);
  if (parsed == null) return null;
  const cents = Math.round(parsed * 100);
  return cents > MAX_REVENUE_CENTS ? null : cents;
}

function usdRevenue(cents: number | null): Pick<PurchaseRevenue, "valueCents" | "valueCurrency"> {
  return cents == null
    ? { valueCents: null, valueCurrency: null }
    : { valueCents: cents, valueCurrency: "USD" };
}

export function normalizePixelPurchaseRevenue(
  amount: unknown,
  currencyValue: unknown,
): PurchaseRevenue {
  const originalCurrency = normalizeCurrency(currencyValue);
  const originalValueCents = amountToCents(amount);
  const normalized =
    originalCurrency === "USD" ? usdRevenue(originalValueCents) : usdRevenue(null);

  return {
    ...normalized,
    currency: normalized.valueCurrency ?? originalCurrency,
    originalValueCents,
    originalCurrency,
  };
}

function moneySetUsdCents(order: Record<string, unknown>, key: string): number | null {
  const set = order[key];
  if (!set || typeof set !== "object") return null;
  const shopMoney = (set as Record<string, unknown>).shop_money;
  if (!shopMoney || typeof shopMoney !== "object") return null;
  const money = shopMoney as Record<string, unknown>;
  if (normalizeCurrency(money.currency_code) !== "USD") return null;
  return amountToCents(money.amount);
}

export function normalizeShopifyOrderRevenue(order: Record<string, unknown>): PurchaseRevenue {
  const originalCurrency =
    normalizeCurrency(order.presentment_currency) ?? normalizeCurrency(order.currency);
  const originalValueCents = amountToCents(order.total_price);
  const totalPriceUsd = amountToCents(order.total_price_usd);
  const setUsd =
    moneySetUsdCents(order, "current_total_price_set") ??
    moneySetUsdCents(order, "total_price_set");
  const originalUsd = originalCurrency === "USD" ? originalValueCents : null;
  const normalized = usdRevenue(totalPriceUsd ?? setUsd ?? originalUsd);

  return {
    ...normalized,
    currency: normalized.valueCurrency ?? originalCurrency,
    originalValueCents,
    originalCurrency,
  };
}
