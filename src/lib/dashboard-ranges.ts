export type DashboardRange = {
  key: string;
  label: string;
  days: number;
  subDay?: boolean;
  custom?: boolean;
};

export const DASHBOARD_RANGES: DashboardRange[] = [
  { key: "1h", label: "1h", days: 1 / 24, subDay: true },
  { key: "6h", label: "6h", days: 6 / 24, subDay: true },
  { key: "1d", label: "24h", days: 1 },
  { key: "7d", label: "7d", days: 7 },
  { key: "14d", label: "14d", days: 14 },
  { key: "30d", label: "30d", days: 30 },
  { key: "90d", label: "90d", days: 90 },
];

export function parseDashboardRange(value: string | undefined): DashboardRange {
  const preset = DASHBOARD_RANGES.find((range) => range.key === value);
  if (preset) return preset;

  const match = value?.match(/^(\d{1,3})(h|d)$/);
  if (match) {
    const rawAmount = Number(match[1]);
    const unit = match[2];
    if (Number.isFinite(rawAmount) && rawAmount > 0) {
      if (unit === "h") {
        const hours = Math.min(168, Math.max(1, Math.floor(rawAmount)));
        return {
          key: `${hours}h`,
          label: `${hours}h`,
          days: hours / 24,
          subDay: hours < 24,
          custom: true,
        };
      }
      const days = Math.min(365, Math.max(1, Math.floor(rawAmount)));
      return {
        key: `${days}d`,
        label: days === 1 ? "24h" : `${days}d`,
        days,
        custom: true,
      };
    }
  }

  return DASHBOARD_RANGES[4];
}
