import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatNumber(
  val: number,
  isPercent: boolean = false,
  isIntegerMode: boolean = false,
  isWanYuan: boolean = false
): string {
  if (isPercent) {
    // Percent values are already scaled (e.g. 85.23 → "85.23%")
    return `${val.toFixed(2)}%`;
  }
  if (isWanYuan) {
    const wan = val / 10000;
    return isIntegerMode
      ? `${Math.round(wan).toLocaleString()}`
      : `${wan.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  return isIntegerMode
    ? Math.round(val).toLocaleString()
    : val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Returns true if the metric should be displayed in 万元 (i.e. it's a money amount, not a rate or ratio) */
export function isMoneyMetric(metricName: string): boolean {
  if (!metricName) return false;
  // Percentage/rate metrics — keep as is
  if (metricName.includes('率') || metricName.includes('Percent')) return false;
  // "百元收入" ratio metrics — these are per-100-yuan ratios, not absolute yuan amounts
  if (metricName.includes('百元收入')) return false;
  // Everything else from 经营数据 is a money amount (元 → 万元)
  return true;
}
