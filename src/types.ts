export type MetricKey = string; // Now dynamic based on metadata

export interface PerformanceItem {
  id: string;
  category: string; 
  value: number;
  displayValue: string;
  isPercent: boolean;
  isWanYuan: boolean;
}

// Relational Data Structures
export interface ProjectInfo {
  projectNo: string;
  projectName: string;
  ownership: string;       // 产权口径
  management: string;      // 管理口径
  propertyType: string;    // 业态
  secondaryPropertyType: string; // 二级业态
  isKeyProject: string;    // 重点项目
  isExistingProject: string; // 现有项目
  reportCaliber: string;     // 报表口径
  projectShortName: string;   // 项目简称
}

export interface MetricMetadata {
  name: string;
  formula: string;
  source: 'operating' | 'calculated' | 'other';
  unit: string;
}

export interface TimeGroupMetadata {
  name: string;
  formula: string;
  applyToAll: boolean; // "本年累计" is true, others false
}

export interface DataRecord {
  month: string;
  projectNo: string;
  metrics: Record<string, number>;
}

// Joined Record (Enriched with ProjectInfo)
export interface EnrichedRecord extends DataRecord {
  projectName: string;
  ownership: string;
  management: string;
  propertyType: string;
  secondaryPropertyType: string;
  isKeyProject: string;
  isExistingProject: string;
  reportCaliber: string;
  projectShortName: string;
}

export interface FilterState {
  months: string[];
  ownerships: string[];
  managements: string[];
  propertyTypes: string[];
  secondaryPropertyTypes: string[];
  projectNames: string[];
  isKeyProjects: string[];
  isExistingProjects: string[];
  reportCalibers: string[];
  projectShortNames: string[];
}

export interface User {
  id: string;
  username: string;
  nickname: string;
  avatar: string;
  lastLoginIp?: string;
  lastLoginTime?: string;
}

export interface AuthState {
  isLoggedIn: boolean;
  user: User | null;
}

export interface FilterPreset {
  id: string;
  userId: string;
  name: string;
  filters: any;
  selectedIndicators: string[];
  timestamp: string;
}

export interface TablePreset {
  id: string;
  userId: string;
  name: string;
  selectedYDim: string;
  selectedYDim2: string;
  selectedYDim3?: string;
  selectedYDim4?: string;
  selectedMetricGroups: string[];
  isXAxisSwapped: boolean;
  showSubtotals: boolean;
  printIndicatorsPerPage?: number;
  timestamp: string;
}



export interface CommentItem {
  id: string;
  project: string;
  dimension: string;
  text: string;
  period: string;
  date: string;
  management: string;
  propertyType: string;
  authorId: string;
  authorName: string;
}
