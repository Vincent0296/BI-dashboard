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

/** Returns true if the metric should be treated as a percentage/rate */
export function isRateMetric(metricName: string): boolean {
  if (!metricName) return false;
  return metricName.includes('率') || metricName.includes('Percent') || metricName.includes('百元');
}

/** Returns true if the metric should be displayed in 万元 (i.e. it's a money amount, not a rate or ratio) */
export function isMoneyMetric(metricName: string): boolean {
  if (!metricName) return false;
  const nonMoneyMetrics = [
    '重点项目个数', '未达标个数', '重点项目未达标数',
    '项目人数', '用餐人数', '实际服务面积', '总服务面积',
    '项目个数', '亏损个数', '利润率下降项目数', '效益下降项目数'
  ];
  if (nonMoneyMetrics.includes(metricName)) return false;
  return !isRateMetric(metricName);
}
