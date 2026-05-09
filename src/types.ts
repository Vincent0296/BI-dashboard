export type MetricKey = 'YTD' | 'LY' | 'YoYDiff' | 'YoYPercent' | 'MTD' | 'PreMonth' | 'MoMDiff' | 'MoMPercent';

export interface PerformanceItem {
  id: string;
  category: string; // e.g. "收入", "成本", "利润"
  value: number;
  displayValue: string;
  isPercent: boolean;
}

export interface DataRecord {
  month: string;
  ownership: string;
  management: string;
  propertyType: string;
  projectName: string;
  metrics: Record<string, number>;
}

export interface FilterState {
  months: string[];
  ownerships: string[];
  managements: string[];
  propertyTypes: string[];
  projectNames: string[];
}

export interface User {
  id: string;
  nickname: string;
  avatar: string;
}

export interface AuthState {
  isLoggedIn: boolean;
  user: User | null;
}
