import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatNumber(
  val: number | null | undefined,
  isPercent: boolean = false,
  isIntegerMode: boolean = false,
  isWanYuan: boolean = false
): string {
  if (val === null || val === undefined || isNaN(val as number)) {
    return '-';
  }
  
  const numVal = val as number;
  if (numVal === 0) return '-';

  if (isPercent) {
    const percentVal = numVal * 100;
    
    // Cap at 10000% for aesthetic reasons and to prevent UI breaking
    if (percentVal > 10000) return "10000%+";
    if (percentVal < -10000) return "-10000%-";

    if (isIntegerMode) {
      return `${Math.round(percentVal)}%`;
    }
    const fixedVal = percentVal.toFixed(1);
    
    // Handle very small values that round to 0.0 but are not 0
    if (fixedVal === "0.0" && percentVal > 0) return "0.1%";
    if (fixedVal === "0.0" && percentVal < 0) return "-0.1%";
    if (fixedVal === "-0.0") return "-0.1%";
    
    return `${fixedVal}%`;
  }

  if (isWanYuan) {
    const wan = numVal / 10000;
    if (isIntegerMode) {
      return `${Math.round(wan).toLocaleString()}`;
    }
    return `${wan.toFixed(2).replace(/\.00$/, '')}`;
  }

  if (isIntegerMode) {
    return `${Math.round(numVal).toLocaleString()}`;
  }
  return `${numVal.toLocaleString()}`;
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
