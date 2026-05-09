import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatNumber(val: number, isPercent: boolean = false, isIntegerMode: boolean = false): string {
  if (isPercent) {
    return isIntegerMode ? `${Math.round(val * 100)}%` : `${(val * 100).toFixed(2)}%`;
  }
  return isIntegerMode 
    ? Math.round(val).toLocaleString() 
    : val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
