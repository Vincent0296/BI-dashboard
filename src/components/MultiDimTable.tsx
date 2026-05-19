import React, { useState, useMemo, useEffect } from 'react';
import * as XLSX from 'xlsx';
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Filter,
  Table as TableIcon,
  Save,
  Plus,
  X,
  Trash2,
  Bookmark,
  RefreshCcw,
  Edit2,
  Check,
  Printer,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Maximize2,
  Minimize2
} from 'lucide-react';
import { EnrichedRecord, AuthState, TablePreset, MetricMetadata, TimeGroupMetadata, MetricKey } from '../types';
import { supabase } from '../lib/supabase';
import { cn, formatNumber, isMoneyMetric, isRateMetric } from '../lib/utils';
import { TIME_SERIES_ALLOWED_METRICS, BUDGET_METRICS, THREE_YEAR_BENEFIT_METRICS, BUSINESS_METRICS } from '../constants/internalData';


interface MultiDimTableProps {
  data: EnrichedRecord[];
  categories: string[];
  selectedMonth: string;
  isIntegerMode: boolean;
  setIsIntegerMode: (val: boolean) => void;
  authState: AuthState;
  checkAuth: (action: () => void) => void;
  metricMetadata: MetricMetadata[];
  timeGroupMetadata: TimeGroupMetadata[];
}

const getContiguousSpan = (arr: any[], startIndex: number, keyExtractor: (item: any) => string) => {
  if (startIndex < 0 || startIndex >= arr.length) return 1;
  const targetValue = keyExtractor(arr[startIndex]);
  let span = 0;
  for (let i = startIndex; i < arr.length; i++) {
    if (keyExtractor(arr[i]) === targetValue) {
      span++;
    } else {
      break;
    }
  }
  return span;
};

const METRIC_GROUPS: { key: MetricKey; label: string }[] = [
  { key: 'YTD', label: '本年累计' },
  { key: 'LY', label: '去年同期' },
  { key: 'YoYDiff', label: '同比增减额' },
  { key: 'YoYPercent', label: '同比增减率' },
  { key: 'MTD', label: '当月发生额' },
  { key: 'PreMonth', label: '上月发生额' },
  { key: 'MoMDiff', label: '环比增减额' },
  { key: 'MoMPercent', label: '环比增减率' },
];

const DIMENSIONS = [
  { key: 'ownership', label: '产权口径' },
  { key: 'management', label: '管理口径' },
  { key: 'propertyType', label: '业态' },
  { key: 'secondaryPropertyType', label: '二级业态' },
  { key: 'projectName', label: '项目名称' },
  { key: 'isKeyProject', label: '重点项目' },
  { key: 'isExistingProject', label: '现有项目' },
  { key: 'reportCaliber', label: '报表口径' },
  { key: 'projectShortName', label: '项目简称' },
] as const;

export const MultiDimTable: React.FC<MultiDimTableProps> = ({
  data,
  categories,
  selectedMonth,
  isIntegerMode,
  setIsIntegerMode,
  authState,
  checkAuth,
  metricMetadata,
  timeGroupMetadata
}) => {
  const [selectedYDim, setSelectedYDim] = useState<typeof DIMENSIONS[number]['key']>('propertyType');
  const [selectedYDim2, setSelectedYDim2] = useState<typeof DIMENSIONS[number]['key'] | 'none'>('none');
  const [selectedYDim3, setSelectedYDim3] = useState<typeof DIMENSIONS[number]['key'] | 'none'>('none');

  const handleSelectYDim = (val: typeof DIMENSIONS[number]['key']) => {
    setSelectedYDim(val);
    setActivePresetId(null);
    if (selectedYDim2 === val) {
      setSelectedYDim2('none');
      setSelectedYDim3('none');
    } else if (selectedYDim3 === val) {
      setSelectedYDim3('none');
    }
  };

  const handleSelectYDim2 = (val: typeof DIMENSIONS[number]['key'] | 'none') => {
    setSelectedYDim2(val);
    setActivePresetId(null);
    if (val === 'none') {
      setSelectedYDim3('none');
    } else if (selectedYDim3 === val) {
      setSelectedYDim3('none');
    }
  };

  const handleSelectYDim3 = (val: typeof DIMENSIONS[number]['key'] | 'none') => {
    setSelectedYDim3(val);
    setActivePresetId(null);
  };

  const [isXAxisSwapped, setIsXAxisSwapped] = useState(false);
  // 初始状态：默认全选
  const [selectedMetricGroups, setSelectedMetricGroups] = useState<string[]>(() => {
    return timeGroupMetadata.map(g => g.name);
  });
  const [currentPage, setCurrentPage] = useState(0);

  // --- Preset States ---
  const [tablePresets, setTablePresets] = useState<TablePreset[]>([]);
  const [isSavingPreset, setIsSavingPreset] = useState(false);
  const [newPresetName, setNewPresetName] = useState('');
  const [activePresetId, setActivePresetId] = useState<string | null>(null);
  const [editingPresetId, setEditingPresetId] = useState<string | null>(null);
  const [showSubtotals, setShowSubtotals] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' | null }>({
    key: '',
    direction: null,
  });
  const [printIndicatorsPerPage, setPrintIndicatorsPerPage] = useState<number>(4); // 每页打印指标数限制，默认4
  const itemsPerPage = printIndicatorsPerPage; // 数据表每页显示的指标数与打印每页指标数同步

  const [isFocusMode, setIsFocusMode] = useState(false);
  const [showConfig, setShowConfig] = useState(true);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsFocusMode(false);
    };
    if (isFocusMode) {
      window.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [isFocusMode]);

  const totalPages = Math.ceil(categories.length / itemsPerPage);

  useEffect(() => {
    if (currentPage >= totalPages && totalPages > 0) {
      setCurrentPage(totalPages - 1);
    }
  }, [categories.length, totalPages, currentPage]);

  // 移除之前的强制初始化 useEffect，保留 Preset 加载逻辑

  // Fetch presets on mount/auth change
  useEffect(() => {
    if (authState.isLoggedIn && authState.user) {
      fetchTablePresets(authState.user.id);
    } else {
      setTablePresets([]);
    }
  }, [authState.isLoggedIn, authState.user]);

  const fetchTablePresets = async (userId: string) => {
    try {
      const { data: rawData, error } = await supabase
        .from('presets')
        .select('*')
        .eq('userId', userId)
        .order('timestamp', { ascending: false });

      if (!error && rawData) {
        const tableOnly = rawData
          .filter((p: any) => p.filters?.isTablePreset)
          .map((p: any) => {
            // 增加兼容性转换：将英文 Key 转换为中文 Name
            const groups = (p.filters.selectedMetricGroups || []).map((g: string) => {
              const match = METRIC_GROUPS.find(m => m.key === g || m.label === g);
              return match ? match.label : g;
            });
            return {
              id: p.id,
              userId: p.userId,
              name: p.name,
              selectedYDim: p.filters.selectedYDim,
              selectedYDim2: p.filters.selectedYDim2 || 'none',
              selectedYDim3: p.filters.selectedYDim3 || 'none',
              selectedMetricGroups: groups,
              isXAxisSwapped: p.filters.isXAxisSwapped || false,
              showSubtotals: p.filters.showSubtotals || false,
              printIndicatorsPerPage: p.filters.printIndicatorsPerPage || 4,
              timestamp: p.timestamp
            };
          });
        setTablePresets(tableOnly);
      }
    } catch (err) {
      console.error('Failed to fetch table presets', err);
    }
  };

  const handleSavePreset = async () => {
    if (!authState.isLoggedIn) {
      alert('请先登录以保存方案');
      return;
    }

    if (!newPresetName.trim()) {
      alert('请输入方案名称');
      return;
    }

    try {
      const newPresetObj = {
        id: Date.now().toString(),
        userId: authState.user?.id,
        name: newPresetName,
        filters: {
          isTablePreset: true,
          selectedYDim,
          selectedYDim2,
          selectedYDim3,
          selectedMetricGroups,
          isXAxisSwapped,
          showSubtotals,
          printIndicatorsPerPage
        },
        selectedIndicators: [], // Not used for table presets but required by schema
        timestamp: new Date().toISOString()
      };

      const { error } = await supabase.from('presets').insert([newPresetObj]);

      if (!error) {
        const mappedPreset: TablePreset = {
          id: newPresetObj.id,
          userId: newPresetObj.userId!,
          name: newPresetObj.name,
          selectedYDim: newPresetObj.filters.selectedYDim,
          selectedYDim2: newPresetObj.filters.selectedYDim2,
          selectedYDim3: newPresetObj.filters.selectedYDim3,
          selectedMetricGroups: newPresetObj.filters.selectedMetricGroups as string[],
          isXAxisSwapped: newPresetObj.filters.isXAxisSwapped,
          showSubtotals: newPresetObj.filters.showSubtotals,
          printIndicatorsPerPage: newPresetObj.filters.printIndicatorsPerPage,
          timestamp: newPresetObj.timestamp
        };
        setTablePresets([mappedPreset, ...tablePresets]);
        setNewPresetName('');
        setIsSavingPreset(false);
        setActivePresetId(mappedPreset.id);
      }
    } catch (err) {
      console.error('Failed to save table preset', err);
    }
  };

  const applyPreset = (preset: TablePreset) => {
    setSelectedYDim(preset.selectedYDim as any);
    setSelectedYDim2(preset.selectedYDim2 as any);
    setSelectedYDim3((preset.selectedYDim3 || 'none') as any);
    setSelectedMetricGroups(preset.selectedMetricGroups);
    setIsXAxisSwapped(preset.isXAxisSwapped);
    setShowSubtotals(preset.showSubtotals || false);
    if (preset.printIndicatorsPerPage !== undefined) {
      setPrintIndicatorsPerPage(preset.printIndicatorsPerPage);
    }
    setActivePresetId(preset.id);
  };

  const handleDeletePreset = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('确定要删除这个数据表方案吗？')) return;

    try {
      const { error } = await supabase.from('presets').delete().eq('id', id);
      if (!error) {
        setTablePresets(tablePresets.filter(p => p.id !== id));
        if (activePresetId === id) setActivePresetId(null);
      }
    } catch (err) {
      console.error('Failed to delete table preset', err);
    }
  };

  const handleRenamePreset = async (id: string, newName: string) => {
    if (!newName.trim()) {
      setEditingPresetId(null);
      return;
    }
    try {
      const { error } = await supabase
        .from('presets')
        .update({ name: newName })
        .eq('id', id);

      if (!error) {
        setTablePresets(tablePresets.map(p => p.id === id ? { ...p, name: newName } : p));
      }
    } catch (err) {
      console.error('Failed to rename table preset', err);
    } finally {
      setEditingPresetId(null);
    }
  };

  const handleUpdatePreset = async (preset: TablePreset, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`确定要将当前表格维度和计算组设置覆盖到方案 "${preset.name}" 吗？`)) return;

    try {
      const { error } = await supabase
        .from('presets')
        .update({
          filters: {
            isTablePreset: true,
            selectedYDim,
            selectedYDim2,
            selectedYDim3,
            selectedMetricGroups,
            isXAxisSwapped,
            showSubtotals,
            printIndicatorsPerPage
          },
          timestamp: new Date().toISOString()
        })
        .eq('id', preset.id);

      if (!error) {
        setTablePresets(tablePresets.map(p => p.id === preset.id ? { ...p, selectedYDim, selectedYDim2, selectedYDim3, selectedMetricGroups, isXAxisSwapped, showSubtotals, printIndicatorsPerPage } as TablePreset : p));
        alert('方案已成功更新');
      }
    } catch (err) {
      console.error('Failed to update table preset', err);
    }
  };

  const currentIndicators = isPrinting ? categories : categories.slice(currentPage * itemsPerPage, (currentPage + 1) * itemsPerPage);

  const getGroupIndicators = (groupName: string) => {
    if (groupName === '本年累计') return currentIndicators;
    return currentIndicators.filter(cat => TIME_SERIES_ALLOWED_METRICS.includes(cat));
  };

  const dimValues = useMemo(() => {
    const getDimOrder = (dim: string, values: string[]) => {
      if (dim === 'propertyType') {
        const order = ['酒店业务', '物业业务', '餐饮业务', '租赁业务', '其他业务', '管理业务'];
        return values.sort((a, b) => {
          const idxA = order.indexOf(a);
          const idxB = order.indexOf(b);
          if (idxA !== -1 && idxB !== -1) return idxA - idxB;
          if (idxA !== -1) return -1;
          if (idxB !== -1) return 1;
          return a.localeCompare(b);
        });
      }
      if (dim === 'management') {
        const order = ['上海酒店项目部', '上海物业项目部', '常州项目部', '南京项目部', '无锡宜兴项目', '浙江项目部', '南通项目部', '上海本部'];
        return values.sort((a, b) => {
          const idxA = order.indexOf(a);
          const idxB = order.indexOf(b);
          if (idxA !== -1 && idxB !== -1) return idxA - idxB;
          if (idxA !== -1) return -1;
          if (idxB !== -1) return 1;
          return a.localeCompare(b);
        });
      }
      if (dim === 'ownership') {
        const order = ['上海母公司', '常州酒店', '南京酒店', '无锡酒店', '宜兴（华东分）', '黄山酒店', '合并抵消', '华东分抵消'];
        return values.sort((a, b) => {
          const idxA = order.indexOf(a);
          const idxB = order.indexOf(b);
          if (idxA !== -1 && idxB !== -1) return idxA - idxB;
          if (idxA !== -1) return -1;
          if (idxB !== -1) return 1;
          return a.localeCompare(b);
        });
      }
      return values.sort((a, b) => a.localeCompare(b));
    };

    if (selectedYDim2 === 'none') {
      const rawValues = Array.from(new Set(data.map(d => String(d[selectedYDim])))) as string[];
      return getDimOrder(selectedYDim, rawValues).map(v => ({ v1: v, v2: null, v3: null }));
    } else if (selectedYDim3 === 'none') {
      const pairSet = new Set<string>();
      data.forEach(d => {
        pairSet.add(`${d[selectedYDim]}|${d[selectedYDim2]}`);
      });
      const pairs = Array.from(pairSet).map(p => {
        const [v1, v2] = p.split('|');
        return { v1, v2 };
      });
      const sortedV1s = getDimOrder(selectedYDim, Array.from(new Set(pairs.map(p => p.v1))));
      return sortedV1s.flatMap(v1 => {
        const v2sForV1 = pairs.filter(p => p.v1 === v1).map(p => p.v2);
        const sortedV2s = getDimOrder(selectedYDim2, v2sForV1);
        return sortedV2s.map(v2 => ({ v1, v2, v3: null }));
      });
    } else {
      const tripletSet = new Set<string>();
      data.forEach(d => {
        tripletSet.add(`${d[selectedYDim]}|${d[selectedYDim2]}|${d[selectedYDim3]}`);
      });
      const triplets = Array.from(tripletSet).map(p => {
        const [v1, v2, v3] = p.split('|');
        return { v1, v2, v3 };
      });
      const sortedV1s = getDimOrder(selectedYDim, Array.from(new Set(triplets.map(p => p.v1))));
      return sortedV1s.flatMap(v1 => {
        const v2sForV1 = Array.from(new Set(triplets.filter(p => p.v1 === v1).map(p => p.v2)));
        const sortedV2s = getDimOrder(selectedYDim2, v2sForV1);
        return sortedV2s.flatMap(v2 => {
          const v3sForV2 = triplets.filter(p => p.v1 === v1 && p.v2 === v2).map(p => p.v3);
          const sortedV3s = getDimOrder(selectedYDim3, v3sForV2);
          return sortedV3s.map(v3 => ({ v1, v2, v3 }));
        });
      });
    }
  }, [data, selectedYDim, selectedYDim2, selectedYDim3]);

  const getMetricAggregatedValue = (dataSlice: EnrichedRecord[], metricName: string, timeGroupName: string): number => {
    if (!selectedMonth || !selectedMonth.includes('-')) return 0;
    const [year, month] = selectedMonth.split('-').map(Number);
    const prevYear = year - 1;
    const pm = month === 1 ? { y: year - 1, m: 12 } : { y: year, m: month - 1 };

    if (['项目个数', '亏损个数'].includes(metricName)) {
      if (['本年累计', '去年同期', '当月发生额', '上月发生额'].includes(timeGroupName)) {
        const isYTD = (d: EnrichedRecord, y: number, m: number) => {
          const [dy, dm] = d.month.split('-').map(Number);
          return dy === y && dm <= m;
        };
        const isMTD = (d: EnrichedRecord, y: number, m: number) => {
          const [dy, dm] = d.month.split('-').map(Number);
          return dy === y && dm === m;
        };

        let filteredSlice: EnrichedRecord[] = [];
        if (timeGroupName === '本年累计') {
          filteredSlice = dataSlice.filter(d => isYTD(d, year, month));
        } else if (timeGroupName === '去年同期') {
          filteredSlice = dataSlice.filter(d => isYTD(d, prevYear, month));
        } else if (timeGroupName === '当月发生额') {
          filteredSlice = dataSlice.filter(d => isMTD(d, year, month));
        } else if (timeGroupName === '上月发生额') {
          filteredSlice = dataSlice.filter(d => isMTD(d, pm.y, pm.m));
        }

        const projectsMap: Record<string, EnrichedRecord[]> = {};
        filteredSlice.forEach(r => {
          if (!projectsMap[r.projectNo]) {
            projectsMap[r.projectNo] = [];
          }
          projectsMap[r.projectNo].push(r);
        });

        let projectCount = 0;
        let lossCount = 0;
        Object.entries(projectsMap).forEach(([projectNo, records]) => {
          const pName = records[0]?.projectName || '';
          if (pName.includes('代理') || pName.includes('抵消')) {
            return;
          }
          const projectRevenueYTD = records.reduce((sum, r) => sum + (r.metrics['收入YTD'] || 0), 0);
          const projectProfitYTD = records.reduce((sum, r) => sum + (r.metrics['利润YTD'] || 0), 0);
          if (metricName === '项目个数') {
            if (projectRevenueYTD !== 0 || projectProfitYTD !== 0) {
              projectCount++;
            }
          } else if (metricName === '亏损个数') {
            if (projectProfitYTD < 0) {
              lossCount++;
            }
          }
        });
        return metricName === '项目个数' ? projectCount : lossCount;
      }
    }

    if (['利润率下降项目数', '效益下降项目数'].includes(metricName)) {
      if (timeGroupName !== '本年累计') {
        return NaN;
      }
      const isYTD = (d: EnrichedRecord, y: number, m: number) => {
        const [dy, dm] = d.month.split('-').map(Number);
        return dy === y && dm <= m;
      };

      const curSlice = dataSlice.filter(d => isYTD(d, year, month));
      const prevSlice = dataSlice.filter(d => isYTD(d, year - 1, month));

      const curProjects: Record<string, EnrichedRecord[]> = {};
      curSlice.forEach(r => {
        if (!curProjects[r.projectNo]) curProjects[r.projectNo] = [];
        curProjects[r.projectNo].push(r);
      });

      const prevProjects: Record<string, EnrichedRecord[]> = {};
      prevSlice.forEach(r => {
        if (!prevProjects[r.projectNo]) prevProjects[r.projectNo] = [];
        prevProjects[r.projectNo].push(r);
      });

      let count = 0;
      Object.entries(curProjects).forEach(([projectNo, currentRecords]) => {
        const pName = currentRecords[0]?.projectName || '';
        if (pName.includes('代理') || pName.includes('抵消')) {
          return;
        }

        const prevRecords = prevProjects[projectNo] || [];

        if (metricName === '利润率下降项目数') {
          const curRevenue = currentRecords.reduce((sum, r) => sum + (r.metrics['收入YTD'] || 0), 0);
          const curProfit = currentRecords.reduce((sum, r) => sum + (r.metrics['利润YTD'] || 0), 0);
          const curRate = curRevenue !== 0 ? curProfit / curRevenue : 0;

          const prevRevenue = prevRecords.reduce((sum, r) => sum + (r.metrics['收入YTD'] || 0), 0);
          const prevProfit = prevRecords.reduce((sum, r) => sum + (r.metrics['利润YTD'] || 0), 0);
          const prevRate = prevRevenue !== 0 ? prevProfit / prevRevenue : 0;

          if (curRate < prevRate) {
            count++;
          }
        } else if (metricName === '效益下降项目数') {
          const curProfit = currentRecords.reduce((sum, r) => sum + (r.metrics['利润YTD'] || 0), 0);
          const prevProfit = prevRecords.reduce((sum, r) => sum + (r.metrics['利润YTD'] || 0), 0);

          if (curProfit < prevProfit) {
            count++;
          }
        }
      });
      return count;
    }

    if (metricName === '人工成本') {
      const s1 = getMetricAggregatedValue(dataSlice, '15用工薪酬成本', timeGroupName);
      const s2 = getMetricAggregatedValue(dataSlice, '16外包劳务支出', timeGroupName);
      return s1 + s2;
    }
    if (metricName === '能源成本') {
      const s1 = getMetricAggregatedValue(dataSlice, '8外购燃料', timeGroupName);
      const s2 = getMetricAggregatedValue(dataSlice, '9外购动力', timeGroupName);
      return s1 + s2;
    }

    if (['重点项目个数', '未达标个数', '重点项目未达标数'].includes(metricName)) {
      if (timeGroupName !== '本年累计') {
        return NaN;
      }

      if (metricName === '重点项目个数') {
        const uniqueProjects = new Set<string>();
        dataSlice.forEach(r => {
          if (r.isKeyProject === '是') {
            uniqueProjects.add(r.projectNo);
          }
        });
        return uniqueProjects.size;
      }

      // For "未达标个数" and "重点项目未达标数"
      const isYTD = (d: EnrichedRecord, y: number, m: number) => {
        const [dy, dm] = d.month.split('-').map(Number);
        return dy === y && dm <= m;
      };

      const ytdSlice = dataSlice.filter(d => isYTD(d, year, month));
      const projectsMap: Record<string, EnrichedRecord[]> = {};
      ytdSlice.forEach(r => {
        if (!projectsMap[r.projectNo]) {
          projectsMap[r.projectNo] = [];
        }
        projectsMap[r.projectNo].push(r);
      });

      let nonCompliantCount = 0;
      let keyNonCompliantCount = 0;

      Object.entries(projectsMap).forEach(([projectNo, records]) => {
        const ytdProfit = records.reduce((sum, r) => sum + (r.metrics['对标利润'] || 0), 0);
        const ytdRevenue = records.reduce((sum, r) => sum + (r.metrics['收入YTD'] || 0), 0);
        const projectYtdProfitRate = ytdRevenue !== 0 ? ytdProfit / ytdRevenue : 0;

        const targetProfit = records[0].metrics['目标利润'] || 0;
        const targetRevenue = records[0].metrics['目标收入'] || 0;
        const projectTargetProfitRate = targetRevenue !== 0 ? targetProfit / targetRevenue : 0;

        if (projectYtdProfitRate < projectTargetProfitRate) {
          nonCompliantCount++;
          if (records[0].isKeyProject === '是') {
            keyNonCompliantCount++;
          }
        }
      });

      return metricName === '未达标个数' ? nonCompliantCount : keyNonCompliantCount;
    }


    // 1. 处理计算类时间组（同比/环比）
    // 对于率类指标，增减额应等于“结果之差”，例如 (当月率 - 上月率)
    if (timeGroupName === '同比增减额') {
      return getMetricAggregatedValue(dataSlice, metricName, '本年累计') - getMetricAggregatedValue(dataSlice, metricName, '去年同期');
    }
    if (timeGroupName === '环比增减额') {
      return getMetricAggregatedValue(dataSlice, metricName, '当月发生额') - getMetricAggregatedValue(dataSlice, metricName, '上月发生额');
    }
    if (timeGroupName === '同比增减率') {
      const current = getMetricAggregatedValue(dataSlice, metricName, '本年累计');
      const previous = getMetricAggregatedValue(dataSlice, metricName, '去年同期');
      return previous !== 0 ? (current - previous) / Math.abs(previous) : NaN;
    }
    if (timeGroupName === '环比增减率') {
      const current = getMetricAggregatedValue(dataSlice, metricName, '当月发生额');
      const previous = getMetricAggregatedValue(dataSlice, metricName, '上月发生额');
      return previous !== 0 ? (current - previous) / Math.abs(previous) : NaN;
    }

    // 2. 基础时间组逻辑 (本年累计, 去年同期, 当月, 上月)
    const meta = metricMetadata.find(m => m.name === metricName);
    if (!meta) {
      return getSumWithFuzzyInternal(dataSlice, metricName, timeGroupName, year, month, prevYear, pm);
    }

    const formula = meta.formula || '';
    if (formula.startsWith('=') || formula.startsWith('‘=')) {
      const cleanFormula = formula.replace(/^‘?=/, '').trim();

      if (!cleanFormula.includes('/') && !cleanFormula.includes('+') && !cleanFormula.includes('-') && !cleanFormula.includes('*')) {
        return getMetricAggregatedValue(dataSlice, cleanFormula, timeGroupName);
      }

      // Handle Budget Profit Completion Rate formula: (1+(利润YTD-Budget)/ABS(Budget))
      if (cleanFormula.includes('ABS(')) {
        const budgetMatch = cleanFormula.match(/ABS\(([^)]+)\)/);
        const budgetName = budgetMatch ? budgetMatch[1].trim() : '';
        const currentName = cleanFormula.includes('利润YTD') ? '利润YTD' : '';

        if (budgetName && currentName) {
          const current = getMetricAggregatedValue(dataSlice, currentName, timeGroupName);
          const budget = getMetricAggregatedValue(dataSlice, budgetName, timeGroupName);
          if (budget === 0 || isNaN(budget)) return NaN;
          return 1 + (current - budget) / Math.abs(budget);
        }
      }

      if (cleanFormula.includes('/') && !cleanFormula.includes('+')) {
        const parts = cleanFormula.replace(/\*100/g, '').split('/').map(s => s.trim());
        if (parts.length === 2) {
          const num = getMetricAggregatedValue(dataSlice, parts[0], timeGroupName);
          const den = getMetricAggregatedValue(dataSlice, parts[1], timeGroupName);
          const val = den !== 0 ? num / den : NaN;
          return val;
        }
      }

      if (cleanFormula.includes('15用工薪酬成本') || cleanFormula.includes('用工薪酬成本')) {
        const s1 = getMetricAggregatedValue(dataSlice, '15用工薪酬成本', timeGroupName);
        const s2 = getMetricAggregatedValue(dataSlice, '16外包劳务支出', timeGroupName);
        const den = getMetricAggregatedValue(dataSlice, '收入YTD', timeGroupName);
        const val = den !== 0 ? (s1 + s2) / den : NaN;
        return val;
      }

      if (cleanFormula.includes('8外购燃料') || cleanFormula.includes('外购燃料')) {
        const s1 = getMetricAggregatedValue(dataSlice, '8外购燃料', timeGroupName);
        const s2 = getMetricAggregatedValue(dataSlice, '9外购动力', timeGroupName);
        const den = getMetricAggregatedValue(dataSlice, '收入YTD', timeGroupName);
        const val = den !== 0 ? (s1 + s2) / den : NaN;
        return val;
      }
    }

    return getSumWithFuzzyInternal(dataSlice, metricName, timeGroupName, year, month, prevYear, pm);
  };

  function getSumWithFuzzyInternal(
    items: EnrichedRecord[],
    name: string,
    timeGroupName: string,
    year: number,
    month: number,
    prevYear: number,
    pm: { y: number, m: number }
  ): number {
    const isYTD = (d: EnrichedRecord, y: number, m: number) => {
      const [dy, dm] = d.month.split('-').map(Number);
      return dy === y && dm <= m;
    };
    const isMTD = (d: EnrichedRecord, y: number, m: number) => d.month === `${y}-${m.toString().padStart(2, '0')}`;

    const getSumWithFuzzy = (dataList: EnrichedRecord[], targetName: string) => {
      const isStatic =
        BUDGET_METRICS.includes(targetName) ||
        THREE_YEAR_BENEFIT_METRICS.includes(targetName) ||
        BUSINESS_METRICS.includes(targetName);

      const calculateSum = (name: string) => {
        if (isStatic) {
          const projectMap: Record<string, number> = {};
          dataList.forEach(d => {
            if (!(d.projectNo in projectMap)) {
              projectMap[d.projectNo] = d.metrics[name] || 0;
            }
          });
          return Object.values(projectMap).reduce((a, b) => a + b, 0);
        }
        return dataList.reduce((acc, curr) => acc + (curr.metrics[name] || 0), 0);
      };

      let total = calculateSum(targetName);
      if (total !== 0) return total;
      const cleanName = targetName.replace(/^\d+/, '');
      if (cleanName !== targetName) total = calculateSum(cleanName);
      return total;
    };

    const isStatic = BUDGET_METRICS.includes(name) || THREE_YEAR_BENEFIT_METRICS.includes(name) || BUSINESS_METRICS.includes(name);
    if (isStatic) return getSumWithFuzzy(items, name);

    const ytdData = items.filter(d => isYTD(d, year, month));
    const lyData = items.filter(d => isYTD(d, prevYear, month));
    const mtdData = items.filter(d => isMTD(d, year, month));
    const preMonthData = items.filter(d => isMTD(d, pm.y, pm.m));

    if (timeGroupName === '本年累计') return getSumWithFuzzy(ytdData, name);
    if (timeGroupName === '去年同期') return getSumWithFuzzy(lyData, name);
    if (timeGroupName === '当月发生额') return getSumWithFuzzy(mtdData, name);
    if (timeGroupName === '上月发生额') return getSumWithFuzzy(preMonthData, name);
    return getSumWithFuzzy(mtdData, name);
  }

  const calculateValue = (dataSlice: EnrichedRecord[], cat: string, timeGroupName: string) => {
    return getMetricAggregatedValue(dataSlice, cat, timeGroupName);
  };

  const tableData = useMemo(() => {
    const rawData = dimValues.map(dv => {
      const slice = data.filter(d =>
        String(d[selectedYDim]) === dv.v1 &&
        (dv.v2 === null || String(d[selectedYDim2]) === dv.v2) &&
        (dv.v3 === null || String(d[selectedYDim3]) === dv.v3)
      );
      const metrics: Record<string, number> = {};

      selectedMetricGroups.forEach(groupName => {
        categories.forEach(cat => {
          metrics[`${groupName}_${cat}`] = calculateValue(slice, cat, groupName);
        });
      });

      return { dimValue: dv.v1, dimValue2: dv.v2, dimValue3: dv.v3, metrics };
    });

    if (sortConfig.key && sortConfig.direction) {
      const sorted = [...rawData].sort((a, b) => {
        const aVal = a.metrics[sortConfig.key] || 0;
        const bVal = b.metrics[sortConfig.key] || 0;
        return sortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal;
      });
      return sorted;
    }

    // Inject subtotals if showSubtotals is on and we have a secondary dimension
    if (showSubtotals && selectedYDim2 !== 'none') {
      const finalData: any[] = [];
      const dim1Values = Array.from(new Set(rawData.map(d => d.dimValue)));

      dim1Values.forEach(v1 => {
        if (selectedYDim3 === 'none') {
          // Only Y1 and Y2 active
          const group = rawData.filter(d => d.dimValue === v1);
          finalData.push(...group);

          // Calculate subtotal for this v1
          const slice = data.filter(d => String(d[selectedYDim]) === v1);
          const subtotalMetrics: Record<string, number> = {};
          selectedMetricGroups.forEach(groupName => {
            categories.forEach(cat => {
              subtotalMetrics[`${groupName}_${cat}`] = calculateValue(slice, cat, groupName);
            });
          });
          finalData.push({
            dimValue: v1,
            dimValue2: '小计',
            dimValue3: ' ',
            metrics: subtotalMetrics,
            isSubtotal: true,
            subtotalLevel: 1
          });
        } else {
          // Y1, Y2, and Y3 all active!
          const v2Values = Array.from(new Set(rawData.filter(d => d.dimValue === v1).map(d => d.dimValue2)));
          v2Values.forEach(v2 => {
            const subGroup = rawData.filter(d => d.dimValue === v1 && d.dimValue2 === v2);
            finalData.push(...subGroup);

            // Calculate Level 2 subtotal for v1 + v2
            const sliceL2 = data.filter(d => String(d[selectedYDim]) === v1 && String(d[selectedYDim2]) === v2);
            const subtotalMetricsL2: Record<string, number> = {};
            selectedMetricGroups.forEach(groupName => {
              categories.forEach(cat => {
                subtotalMetricsL2[`${groupName}_${cat}`] = calculateValue(sliceL2, cat, groupName);
              });
            });
            finalData.push({
              dimValue: v1,
              dimValue2: v2,
              dimValue3: '小计',
              metrics: subtotalMetricsL2,
              isSubtotal: true,
              subtotalLevel: 2
            });
          });

          // After all subGroups under v1, calculate Level 1 subtotal for this v1
          const sliceL1 = data.filter(d => String(d[selectedYDim]) === v1);
          const subtotalMetricsL1: Record<string, number> = {};
          selectedMetricGroups.forEach(groupName => {
            categories.forEach(cat => {
              subtotalMetricsL1[`${groupName}_${cat}`] = calculateValue(sliceL1, cat, groupName);
            });
          });
          finalData.push({
            dimValue: v1,
            dimValue2: '小计',
            dimValue3: ' ',
            metrics: subtotalMetricsL1,
            isSubtotal: true,
            subtotalLevel: 1
          });
        }
      });
      return finalData;
    }

    return rawData;
  }, [data, dimValues, selectedYDim, selectedYDim2, selectedYDim3, selectedMetricGroups, categories, selectedMonth, metricMetadata, timeGroupMetadata, sortConfig, showSubtotals]);

  const handleSort = (key: string) => {
    setSortConfig(prev => {
      if (prev.key === key) {
        if (prev.direction === 'asc') return { key, direction: 'desc' };
        if (prev.direction === 'desc') return { key: '', direction: null };
      }
      return { key, direction: 'asc' };
    });
  };

  const totalRow = useMemo(() => {
    const metrics: Record<string, number> = {};
    selectedMetricGroups.forEach(groupName => {
      categories.forEach(cat => {
        metrics[`${groupName}_${cat}`] = calculateValue(data, cat, groupName);
      });
    });
    return metrics;
  }, [data, selectedMetricGroups, categories, selectedMonth, metricMetadata, timeGroupMetadata]);

  const exportToExcel = () => {
    // Export ALL indicators from 'categories' prop, not just 'currentIndicators'
    const showSecondary = selectedYDim2 !== 'none';
    const showTertiary = selectedYDim2 !== 'none' && selectedYDim3 !== 'none';
    const dim1Label = DIMENSIONS.find(d => d.key === selectedYDim)?.label || '维度1';
    const dim2Label = DIMENSIONS.find(d => d.key === selectedYDim2)?.label || '维度2';
    const dim3Label = DIMENSIONS.find(d => d.key === selectedYDim3)?.label || '维度3';

    let header1: string[] = [];
    let header2: string[] = [];

    const dimColsHeader1 = [dim1Label, ...(showSecondary ? [dim2Label] : []), ...(showTertiary ? [dim3Label] : [])];
    const dimColsHeader2 = ['', ...(showSecondary ? [''] : []), ...(showTertiary ? [''] : [])];

    if (!isXAxisSwapped) {
      header1 = [...dimColsHeader1, ...selectedMetricGroups.flatMap(g => Array(categories.length).fill(g))];
      header2 = [...dimColsHeader2, ...selectedMetricGroups.flatMap(() => categories)];
    } else {
      header1 = [...dimColsHeader1, ...categories.flatMap(cat => Array(selectedMetricGroups.length).fill(cat))];
      header2 = [...dimColsHeader2, ...categories.flatMap(() => selectedMetricGroups)];
    }

    const rows = tableData.map(row => [
      row.dimValue,
      ...(showSecondary ? [row.dimValue2] : []),
      ...(showTertiary ? [row.dimValue3] : []),
      ...(!isXAxisSwapped
        ? selectedMetricGroups.flatMap(g =>
          categories.map(cat => {
            const val = row.metrics[`${g}_${cat}`];
            const isRate = isRateMetric(g) || isRateMetric(cat);
            if (isNaN(val) || val === 0) return '-';
            return isRate ? (val * 100).toFixed(2) + '%' : val;
          })
        )
        : categories.flatMap(cat =>
          selectedMetricGroups.map(g => {
            const val = row.metrics[`${g}_${cat}`];
            const isRate = isRateMetric(g) || isRateMetric(cat);
            if (isNaN(val) || val === 0) return '-';
            return isRate ? (val * 100).toFixed(2) + '%' : val;
          })
        )
      )
    ]);

    const totalLine = [
      '合计',
      ...(showSecondary ? [''] : []),
      ...(showTertiary ? [''] : []),
      ...(!isXAxisSwapped
        ? selectedMetricGroups.flatMap(g =>
          categories.map(cat => {
            const val = totalRow[`${g}_${cat}`];
            const isRate = isRateMetric(g) || isRateMetric(cat);
            if (isNaN(val) || val === 0) return '-';
            return isRate ? (val * 100).toFixed(2) + '%' : val;
          })
        )
        : categories.flatMap(cat =>
          selectedMetricGroups.map(g => {
            const val = totalRow[`${g}_${cat}`];
            const isRate = isRateMetric(g) || isRateMetric(cat);
            if (isNaN(val) || val === 0) return '-';
            return isRate ? (val * 100).toFixed(2) + '%' : val;
          })
        )
      )
    ];

    const worksheet = XLSX.utils.aoa_to_sheet([header1, header2, ...rows, totalLine]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "多维分析表");
    XLSX.writeFile(workbook, `MultiDim_Analysis_All_${selectedMonth}.xlsx`);
  };

  const exportToPDF = () => {
    setIsPrinting(true);
    // 给 React 时间准备分段表格，特别是多维层级渲染较慢
    setTimeout(() => {
      window.print();
      // 在打印对话框关闭后恢复
      setTimeout(() => {
        setIsPrinting(false);
      }, 100);
    }, 1000);
  };

  // 核心逻辑：横向切分指标
  const indicatorChunks = useMemo(() => {
    const chunks: string[][] = [];
    for (let i = 0; i < categories.length; i += printIndicatorsPerPage) {
      chunks.push(categories.slice(i, i + printIndicatorsPerPage));
    }
    return chunks;
  }, [categories, printIndicatorsPerPage]);

  if (isPrinting) {
    // 预计算 span 以优化性能
    const v1Spans = new Map<string, number>();
    const v2Spans = new Map<string, number>();
    if (selectedYDim2 !== 'none') {
      tableData.forEach(row => {
        v1Spans.set(row.dimValue, (v1Spans.get(row.dimValue) || 0) + 1);
        if (selectedYDim3 !== 'none') {
          const key = `${row.dimValue}|${row.dimValue2}`;
          v2Spans.set(key, (v2Spans.get(key) || 0) + 1);
        }
      });
    }

    return (
      <div className="bg-white min-h-screen p-8 print:p-0 print-area print-no-overflow">
        <style>
          {`
            @media print {
              @page { size: landscape; margin: 10mm; }
              body { -webkit-print-color-adjust: exact; }
              .print-page-break { page-break-after: always; }
            }
          `}
        </style>

        <div className="flex flex-col space-y-12">
          {indicatorChunks.map((chunk, chunkIdx) => (
            <div key={chunkIdx} className={cn("flex flex-col space-y-4", chunkIdx < indicatorChunks.length - 1 && "print-page-break")}>
              <div className="flex items-center justify-between border-b-2 border-slate-800 pb-2">
                <div className="flex flex-col">
                  <h2 className="text-[22px] font-black text-slate-800">多维交叉数据分析表 (第 {chunkIdx + 1}/{indicatorChunks.length} 部分)</h2>
                  <p className="text-[12px] font-bold text-slate-400 uppercase tracking-widest">
                    维度: {DIMENSIONS.find(d => d.key === selectedYDim)?.label} {selectedYDim2 !== 'none' ? `+ ${DIMENSIONS.find(d => d.key === selectedYDim2)?.label}` : ''} {selectedYDim3 !== 'none' ? `+ ${DIMENSIONS.find(d => d.key === selectedYDim3)?.label}` : ''} | 期间: {selectedMonth}
                  </p>
                </div>
                <div className="text-[12px] font-black text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full">
                  内部报表
                </div>
              </div>

              <div className="border border-slate-200">
                <table className="w-full text-left border-collapse table-fixed">
                  <thead>
                    <tr className="bg-slate-800 text-white">
                      <th
                         className={cn(
                          "p-3 border border-slate-700 font-black text-[12px] text-center",
                          selectedYDim2 === 'none' ? "w-[150px]" : (selectedYDim3 === 'none' ? "w-[260px]" : "w-[330px]")
                        )}
                        colSpan={selectedYDim2 === 'none' ? 1 : (selectedYDim3 === 'none' ? 2 : 3)}
                      >
                        维度
                      </th>
                      {!isXAxisSwapped ? (
                        selectedMetricGroups.map(group => {
                          const indicatorsInChunk = chunk.filter(cat =>
                            group === '本年累计' || TIME_SERIES_ALLOWED_METRICS.includes(cat)
                          );
                          if (indicatorsInChunk.length === 0) return null;
                          return (
                            <th
                              key={group}
                              colSpan={indicatorsInChunk.length}
                              className="p-3 border border-slate-700 font-black text-[13px] text-center uppercase tracking-wider"
                            >
                              {group}
                            </th>
                          );
                        })
                      ) : (
                        chunk.map(cat => {
                          const groupsForCat = selectedMetricGroups.filter(g =>
                            g === '本年累计' || TIME_SERIES_ALLOWED_METRICS.includes(cat)
                          );
                          if (groupsForCat.length === 0) return null;
                          return (
                            <th
                              key={cat}
                              colSpan={groupsForCat.length}
                              className="p-3 border border-slate-700 font-black text-[13px] text-center uppercase tracking-wider"
                            >
                              {cat}
                            </th>
                          );
                        })
                      )}
                    </tr>
                    <tr className="bg-slate-100">
                      <th className="p-3 border border-slate-200 text-slate-800 font-black text-[12px] text-center w-full">
                        {DIMENSIONS.find(d => d.key === selectedYDim)?.label}
                      </th>
                      {selectedYDim2 !== 'none' && (
                        <th className="p-3 border border-slate-200 text-slate-800 font-black text-[12px] text-center w-full">
                          {DIMENSIONS.find(d => d.key === selectedYDim2)?.label}
                        </th>
                      )}
                      {selectedYDim2 !== 'none' && selectedYDim3 !== 'none' && (
                        <th className="p-3 border border-slate-200 text-slate-800 font-black text-[12px] text-center w-full">
                          {DIMENSIONS.find(d => d.key === selectedYDim3)?.label}
                        </th>
                      )}
                      {!isXAxisSwapped ? (
                        selectedMetricGroups.map(group => (
                          chunk.filter(cat =>
                            group === '本年累计' || TIME_SERIES_ALLOWED_METRICS.includes(cat)
                          ).map(cat => (
                            <th
                              key={`${group}_${cat}`}
                              className="p-3 border border-slate-200 text-slate-600 font-black text-[12px] text-center"
                            >
                              {cat}
                            </th>
                          ))
                        ))
                      ) : (
                        chunk.map(cat => {
                          const groupsForCat = selectedMetricGroups.filter(g =>
                            g === '本年累计' || TIME_SERIES_ALLOWED_METRICS.includes(cat)
                          );
                          return groupsForCat.map(group => (
                            <th
                              key={`${group}_${cat}`}
                              className="p-3 border border-slate-200 text-slate-600 font-black text-[12px] text-center"
                            >
                              {group}
                            </th>
                          ));
                        })
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {tableData.map((row, idx) => {
                      const isFirstOfV1 = selectedYDim2 !== 'none' && (idx === 0 || tableData[idx - 1].dimValue !== row.dimValue);
                      const v1Span = v1Spans.get(row.dimValue) || 1;

                      const isFirstOfV2 = selectedYDim2 !== 'none' && selectedYDim3 !== 'none' && (idx === 0 || tableData[idx - 1].dimValue !== row.dimValue || tableData[idx - 1].dimValue2 !== row.dimValue2);
                      const v2Span = selectedYDim2 !== 'none' && selectedYDim3 !== 'none' ? (v2Spans.get(`${row.dimValue}|${row.dimValue2}`) || 1) : 1;

                      return (
                        <tr key={`${row.dimValue}-${row.dimValue2}-${row.dimValue3 || ''}-${idx}`} className={cn(row.isSubtotal ? "bg-slate-50" : "bg-white")}>
                          {selectedYDim2 === 'none' ? (
                            <td className="p-2 border border-slate-200 text-slate-700 font-bold text-[12px] text-center">
                              {row.dimValue}
                            </td>
                          ) : selectedYDim3 === 'none' ? (
                            <>
                              {isFirstOfV1 && (
                                <td rowSpan={v1Span} className="p-2 border border-slate-200 text-slate-800 font-black text-[12px] text-center align-middle">
                                  {row.dimValue}
                                </td>
                              )}
                              <td className={cn(
                                "p-2 border border-slate-200 text-center leading-tight",
                                row.isSubtotal ? "bg-slate-50 text-indigo-600 font-black text-[12px]" : "text-slate-600 font-medium text-[11px]"
                              )}>
                                {row.dimValue2}
                              </td>
                            </>
                          ) : (
                            <>
                              {isFirstOfV1 && (
                                <td rowSpan={v1Span} className="p-2 border border-slate-200 text-slate-800 font-black text-[12px] text-center align-middle">
                                  {row.dimValue}
                                </td>
                              )}
                              {row.isSubtotal && row.subtotalLevel === 1 ? (
                                <td colSpan={2} className="p-2 border border-slate-200 text-center leading-tight bg-slate-50 text-indigo-600 font-black text-[12px]">
                                  {row.dimValue2}
                                </td>
                              ) : (
                                <>
                                  {isFirstOfV2 && (
                                    <td rowSpan={v2Span} className="p-2 border border-slate-200 text-slate-800 font-black text-[12px] text-center align-middle">
                                      {row.dimValue2}
                                    </td>
                                  )}
                                  <td className={cn(
                                    "p-2 border border-slate-200 text-center leading-tight",
                                    row.isSubtotal ? "bg-slate-50 text-indigo-600 font-black text-[12px]" : "text-slate-550 font-medium text-[11px]"
                                  )}>
                                    {row.dimValue3}
                                  </td>
                                </>
                              )}
                            </>
                          )}
                          {!isXAxisSwapped ? (
                            selectedMetricGroups.map(group => (
                              chunk.filter(cat =>
                                group === '本年累计' || TIME_SERIES_ALLOWED_METRICS.includes(cat)
                              ).map(cat => {
                                const val = row.metrics[`${group}_${cat}`];
                                const isRate = isRateMetric(group) || isRateMetric(cat);
                                return (
                                  <td
                                    key={`${group}_${cat}`}
                                    className={cn(
                                      "p-2 border border-slate-200 text-[12px] text-center font-bold",
                                      row.isSubtotal && "bg-slate-50",
                                      group.includes('\u589e\u51cf')
                                        ? (val >= 0 ? "text-emerald-600" : "text-rose-600")
                                        : (row.isSubtotal ? "text-indigo-600" : "text-slate-600")
                                    )}
                                  >
                                    {formatNumber(val, isRate, isIntegerMode, !isRate && isMoneyMetric(cat))}
                                  </td>
                                );
                              })
                            ))
                          ) : (
                            chunk.map(cat => {
                              const groupsForCat = selectedMetricGroups.filter(g =>
                                g === '本年累计' || TIME_SERIES_ALLOWED_METRICS.includes(cat)
                              );
                              return groupsForCat.map(group => {
                                const val = row.metrics[`${group}_${cat}`];
                                const isRate = isRateMetric(group) || isRateMetric(cat);
                                return (
                                  <td
                                    key={`${group}_${cat}`}
                                    className={cn(
                                      "p-2 border border-slate-200 text-[12px] text-center font-bold",
                                      row.isSubtotal && "bg-slate-50",
                                      group.includes('\u589e\u51cf')
                                        ? (val >= 0 ? "text-emerald-600" : "text-rose-600")
                                        : (row.isSubtotal ? "text-indigo-600" : "text-slate-600")
                                    )}
                                  >
                                    {formatNumber(val, isRate, isIntegerMode, !isRate && isMoneyMetric(cat))}
                                  </td>
                                );
                              });
                            })
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="table-footer-group">
                    <tr className="bg-slate-800 text-white font-bold">
                      <td className="p-2 border border-slate-700 text-center text-[12px]" colSpan={selectedYDim2 === 'none' ? 1 : (selectedYDim3 === 'none' ? 2 : 3)}>合计</td>
                      {!isXAxisSwapped ? (
                        selectedMetricGroups.map(group => (
                          chunk.filter(cat =>
                            group === '本年累计' || TIME_SERIES_ALLOWED_METRICS.includes(cat)
                          ).map(cat => {
                            const val = totalRow[`${group}_${cat}`];
                            const isRate = isRateMetric(group) || isRateMetric(cat);
                            return (
                              <td
                                key={`${group}_${cat}`}
                                className={cn(
                                  "p-2 border border-slate-700 text-[12px] text-center",
                                  group.includes('\u589e\u51cf')
                                    ? (val >= 0 ? "text-emerald-400" : "text-rose-400")
                                    : "text-white"
                                )}
                              >
                                {formatNumber(val, isRate, isIntegerMode, !isRate && isMoneyMetric(cat))}
                              </td>
                            );
                          })
                        ))
                      ) : (
                        chunk.map(cat => {
                          const groupsForCat = selectedMetricGroups.filter(g =>
                            g === '本年累计' || TIME_SERIES_ALLOWED_METRICS.includes(cat)
                          );
                          return groupsForCat.map(group => {
                            const val = totalRow[`${group}_${cat}`];
                            const isRate = isRateMetric(group) || isRateMetric(cat);
                            return (
                              <td
                                key={`${group}_${cat}`}
                                className={cn(
                                  "p-2 border border-slate-700 text-[12px] text-center",
                                  group.includes('\u589e\u51cf')
                                    ? (val >= 0 ? "text-emerald-400" : "text-rose-400")
                                    : "text-white"
                                )}
                              >
                                {formatNumber(val, isRate, isIntegerMode, !isRate && isMoneyMetric(cat))}
                              </td>
                            );
                          });
                        })
                      )}
                    </tr>
                  </tfoot>
                </table>
              </div>
              <div className="flex justify-between items-center text-[10px] text-slate-400 font-bold">
                <span>导出时间: {new Date().toLocaleString()}</span>
                <span>报表数据期: {selectedMonth}</span>
                <span>第 {chunkIdx + 1} / {indicatorChunks.length} 页</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <>
      <div className={cn(
        "flex flex-col transition-all duration-300",
        isFocusMode
          ? "fixed inset-0 z-50 bg-slate-950 text-slate-100 p-8 overflow-hidden flex flex-col h-screen space-y-4"
          : "w-full space-y-6",
        isPrinting && "hidden"
      )}>
        {/* Header Section */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600 p-2 rounded-xl shadow-lg shadow-indigo-100">
              <TableIcon className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className={cn("text-lg font-black", isFocusMode ? "text-white" : "text-slate-800")}>多维交叉数据分析表</h3>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">多维性能分析矩阵</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 print:hidden">
            <button
              onClick={() => setIsIntegerMode(!isIntegerMode)}
              className={cn(
                "px-4 py-2 text-[10px] font-black rounded-xl border transition-all hover-lift active:scale-95 uppercase tracking-wider",
                isIntegerMode
                  ? "bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-100"
                  : (isFocusMode ? "bg-slate-900 text-slate-300 border-slate-800 hover:bg-slate-800" : "bg-white text-slate-500 border-slate-200")
              )}
            >
              {isIntegerMode ? '取整模式' : '默认视图'}
            </button>
            {/* 打印每页指标数配置 */}
            <div className={cn(
              "flex items-center gap-2 px-3.5 py-1.5 rounded-xl shadow-sm transition-all border",
              isFocusMode ? "bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700" : "bg-white border-slate-200 text-slate-600 hover:border-indigo-100"
            )}>
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1">
                <Printer className="w-3.5 h-3.5 text-indigo-500" />
                打印每页指标数:
              </span>
              <div className={cn(
                "flex items-center gap-1 border rounded-lg p-0.5",
                isFocusMode ? "bg-slate-950 border-slate-800" : "bg-slate-50 border-slate-200"
              )}>
                <button
                  type="button"
                  onClick={() => setPrintIndicatorsPerPage(prev => Math.max(1, prev - 1))}
                  className={cn(
                    "w-5 h-5 flex items-center justify-center rounded active:scale-95 transition-all text-xs font-bold",
                    isFocusMode ? "text-slate-400 hover:bg-slate-800 hover:text-white" : "text-slate-500 hover:bg-white hover:text-indigo-600 hover:shadow-sm"
                  )}
                >
                  -
                </button>
                <span className="w-6 text-center text-xs font-black text-indigo-400">
                  {printIndicatorsPerPage}
                </span>
                <button
                  type="button"
                  onClick={() => setPrintIndicatorsPerPage(prev => Math.min(20, prev + 1))}
                  className={cn(
                    "w-5 h-5 flex items-center justify-center rounded active:scale-95 transition-all text-xs font-bold",
                    isFocusMode ? "text-slate-400 hover:bg-slate-800 hover:text-white" : "text-slate-500 hover:bg-white hover:text-indigo-600 hover:shadow-sm"
                  )}
                >
                  +
                </button>
              </div>
            </div>
            <button
              onClick={() => checkAuth(exportToPDF)}
              className={cn(
                "flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-black transition-all active:scale-95 border shadow-sm",
                isFocusMode ? "bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800" : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
              )}
            >
              <Printer className="w-3.5 h-3.5 text-indigo-500" />
              打印 PDF
            </button>
            <button
              onClick={() => checkAuth(exportToExcel)}
              className={cn(
                "flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-black transition-all active:scale-95 shadow-lg border",
                isFocusMode ? "bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800 shadow-slate-950" : "bg-slate-900 border-slate-900 text-white hover:bg-indigo-600 shadow-slate-200"
              )}
            >
              <Download className="w-3.5 h-3.5" />
              导出 EXCEL
            </button>
            <button
              onClick={() => setShowConfig(!showConfig)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all active:scale-95 border shadow-sm",
                isFocusMode
                  ? "bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800"
                  : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
              )}
            >
              <Filter className="w-3.5 h-3.5 text-purple-500" />
              {showConfig ? '隐藏配置' : '展开配置'}
            </button>
            <button
              onClick={() => setIsFocusMode(!isFocusMode)}
              className={cn(
                "flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-black transition-all active:scale-95 border shadow-sm",
                isFocusMode
                  ? "bg-rose-500 hover:bg-rose-600 text-white border-rose-500 shadow-lg shadow-rose-950/20"
                  : "bg-white hover:bg-slate-50 text-slate-600 border-slate-200"
              )}
            >
              {isFocusMode ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
              {isFocusMode ? '退出聚焦' : '聚焦模式'}
            </button>
          </div>
        </div>

        {showConfig && (
          <>
            {/* Separate Preset Management for Table */}
            <div className={cn(
              "backdrop-blur-sm p-5 rounded-2xl border shadow-sm print:hidden",
              isFocusMode
                ? "bg-slate-900/50 border-slate-800/80 text-slate-200"
                : "bg-white/50 border-slate-200/60"
            )}>
              <div className="flex items-center gap-4 flex-wrap">
                <div className="flex items-center gap-2 text-slate-400 mr-2">
                  <Bookmark className="w-4 h-4" />
                  <span className="text-[10px] font-black uppercase tracking-[0.2em]">表格方案预设</span>
                </div>

                {tablePresets.map(preset => (
                  <div
                    key={preset.id}
                    onClick={() => applyPreset(preset)}
                    className={cn(
                      "group flex items-center gap-2 px-4 py-2 border rounded-xl cursor-pointer transition-all hover-lift",
                      isFocusMode
                        ? (activePresetId === preset.id
                          ? "bg-indigo-950 border-indigo-700 ring-1 ring-indigo-800 shadow-sm"
                          : "bg-slate-900/80 hover:bg-slate-800 border-slate-850 hover:border-slate-700")
                        : (activePresetId === preset.id
                          ? "bg-indigo-100 border-indigo-400 ring-1 ring-indigo-200 shadow-sm"
                          : "bg-white/80 hover:bg-indigo-50 border-slate-200 hover:border-indigo-200")
                    )}
                  >
                    {editingPresetId === preset.id ? (
                      <input
                        autoFocus
                        className="text-[10px] font-bold bg-transparent outline-none w-24 text-slate-800 dark:text-white"
                        defaultValue={preset.name}
                        onBlur={(e) => handleRenamePreset(preset.id, e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleRenamePreset(preset.id, (e.target as HTMLInputElement).value);
                          if (e.key === 'Escape') setEditingPresetId(null);
                        }}
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : (
                      <>
                        <span className={cn("text-[11px] font-bold", isFocusMode ? "text-slate-300 group-hover:text-indigo-400" : "text-slate-700 group-hover:text-indigo-600")}>{preset.name}</span>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-1">
                          <button
                            onClick={(e) => handleUpdatePreset(preset, e)}
                            title="更新为当前配置"
                            className="p-1 hover:bg-white rounded-lg text-slate-400 hover:text-emerald-500 transition-all dark:hover:bg-slate-800"
                          >
                            <RefreshCcw className="w-3 h-3" />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); setEditingPresetId(preset.id); }}
                            className="p-1 hover:bg-white rounded-lg text-slate-400 hover:text-indigo-600 transition-all dark:hover:bg-slate-800"
                          >
                            <Edit2 className="w-3 h-3" />
                          </button>
                          <button
                            onClick={(e) => handleDeletePreset(preset.id, e)}
                            className="p-1 hover:bg-white rounded-lg text-slate-400 hover:text-rose-500 transition-all dark:hover:bg-slate-800"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))}

                {isSavingPreset ? (
                  <div className="flex items-center gap-2 animate-in zoom-in-95 duration-200">
                    <input
                      autoFocus
                      type="text"
                      placeholder="新方案名称..."
                      value={newPresetName}
                      onChange={(e) => setNewPresetName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSavePreset()}
                      className={cn(
                        "text-[11px] font-bold px-4 py-2 border rounded-xl outline-none w-40 shadow-xl",
                        isFocusMode
                          ? "bg-slate-900 border-indigo-700 text-white shadow-indigo-950/20"
                          : "bg-white border-indigo-500 shadow-indigo-100"
                      )}
                    />
                    <button onClick={handleSavePreset} className="p-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 shadow-lg active:scale-95">
                      <Plus className="w-4 h-4" />
                    </button>
                    <button onClick={() => setIsSavingPreset(false)} className={cn("p-2 rounded-xl border active:scale-95", isFocusMode ? "bg-slate-900 text-slate-400 border-slate-800 hover:bg-slate-800" : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50")}>
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      if (!authState.isLoggedIn) {
                        alert('请先登录');
                        return;
                      }
                      setIsSavingPreset(true);
                    }}
                    className={cn(
                      "flex items-center gap-2 px-4 py-2 font-black text-[10px] rounded-xl border border-dashed transition-all active:scale-95 uppercase tracking-wider",
                      isFocusMode
                        ? "text-indigo-400 hover:bg-indigo-950/30 border-indigo-900/60"
                        : "text-indigo-600 hover:bg-indigo-50 border-indigo-200"
                    )}
                  >
                    <Save className="w-3.5 h-3.5" />
                    保存布局
                  </button>
                )}
              </div>
            </div>

            {/* Controls Section */}
            <div className={cn(
              "grid grid-cols-1 xl:grid-cols-3 gap-8 p-8 rounded-[2rem] border shadow-sm premium-shadow print:hidden",
              isFocusMode
                ? "bg-slate-900 border-slate-800 text-slate-200"
                : "bg-white border-slate-200/60"
            )}>
              {/* Y-Axis Selection */}
              <div className="space-y-5">
                <div className="flex items-center gap-3">
                  <div className={cn("p-2 rounded-lg", isFocusMode ? "bg-indigo-950/40" : "bg-indigo-50")}>
                    <Filter className={cn("w-4 h-4", isFocusMode ? "text-indigo-400" : "text-indigo-600")} />
                  </div>
                  <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">主要维度 (Y1)</h4>
                </div>
                <div className="flex flex-wrap gap-2">
                  {DIMENSIONS.map(dim => (
                    <button
                      key={dim.key}
                      onClick={() => handleSelectYDim(dim.key)}
                      className={cn(
                        "px-5 py-2.5 rounded-xl text-xs font-black transition-all hover-lift active:scale-95",
                        selectedYDim === dim.key
                          ? "bg-indigo-600 text-white shadow-xl shadow-indigo-100 dark:shadow-indigo-950/30"
                          : (isFocusMode
                            ? "bg-slate-800 text-slate-400 border border-slate-700 hover:bg-slate-700"
                            : "bg-slate-50 text-slate-500 hover:bg-slate-100 border border-slate-200/60")
                      )}
                    >
                      {dim.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-5">
                <div className="flex items-center gap-3">
                  <div className={cn("p-2 rounded-lg", isFocusMode ? "bg-purple-950/40" : "bg-purple-50")}>
                    <Filter className={cn("w-4 h-4", isFocusMode ? "text-purple-400" : "text-purple-600")} />
                  </div>
                  <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">次级维度 (Y2)</h4>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => handleSelectYDim2('none')}
                    className={cn(
                      "px-5 py-2.5 rounded-xl text-xs font-black transition-all hover-lift active:scale-95",
                      selectedYDim2 === 'none'
                        ? "bg-purple-600 text-white shadow-xl shadow-purple-100 dark:shadow-purple-950/30"
                        : (isFocusMode
                          ? "bg-slate-800 text-slate-400 border border-slate-700 hover:bg-slate-700"
                          : "bg-slate-50 text-slate-500 hover:bg-slate-100 border border-slate-200/60")
                    )}
                  >
                    无
                  </button>
                  {DIMENSIONS.filter(d => d.key !== selectedYDim).map(dim => (
                    <button
                      key={dim.key}
                      onClick={() => handleSelectYDim2(dim.key)}
                      className={cn(
                        "px-5 py-2.5 rounded-xl text-xs font-black transition-all hover-lift active:scale-95",
                        selectedYDim2 === dim.key
                          ? "bg-purple-600 text-white shadow-xl shadow-purple-100 dark:shadow-purple-950/30"
                          : (isFocusMode
                            ? "bg-slate-800 text-slate-400 border border-slate-700 hover:bg-slate-700"
                            : "bg-slate-50 text-slate-500 hover:bg-slate-100 border border-slate-200/60")
                      )}
                    >
                      {dim.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-5">
                <div className="flex items-center gap-3">
                  <div className={cn("p-2 rounded-lg", isFocusMode ? "bg-pink-950/40" : "bg-pink-50")}>
                    <Filter className={cn("w-4 h-4", isFocusMode ? "text-pink-400" : "text-pink-600")} />
                  </div>
                  <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">三级维度 (Y3)</h4>
                </div>
                {selectedYDim2 === 'none' ? (
                  <div className={cn(
                    "text-xs font-medium p-3 rounded-xl border border-dashed text-center",
                    isFocusMode ? "text-slate-500 border-slate-800" : "text-slate-400 border-slate-200"
                  )}>
                    请先选择次级维度以启用三级维度
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => handleSelectYDim3('none')}
                      className={cn(
                        "px-5 py-2.5 rounded-xl text-xs font-black transition-all hover-lift active:scale-95",
                        selectedYDim3 === 'none'
                          ? "bg-pink-600 text-white shadow-xl shadow-pink-100 dark:shadow-pink-950/30"
                          : (isFocusMode
                            ? "bg-slate-800 text-slate-400 border border-slate-700 hover:bg-slate-700"
                            : "bg-slate-50 text-slate-500 hover:bg-slate-100 border border-slate-200/60")
                      )}
                    >
                      无
                    </button>
                    {DIMENSIONS.filter(d => d.key !== selectedYDim && d.key !== selectedYDim2).map(dim => (
                      <button
                        key={dim.key}
                        onClick={() => handleSelectYDim3(dim.key)}
                        className={cn(
                          "px-5 py-2.5 rounded-xl text-xs font-black transition-all hover-lift active:scale-95",
                          selectedYDim3 === dim.key
                            ? "bg-pink-600 text-white shadow-xl shadow-pink-100 dark:shadow-pink-950/30"
                            : (isFocusMode
                              ? "bg-slate-800 text-slate-400 border border-slate-700 hover:bg-slate-700"
                              : "bg-slate-50 text-slate-500 hover:bg-slate-100 border border-slate-200/60")
                        )}
                      >
                        {dim.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* X-Axis Metric Group Selection */}
              <div className="space-y-5 xl:col-span-3">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-3">
                    <div className={cn("p-2 rounded-lg", isFocusMode ? "bg-indigo-950/40" : "bg-indigo-50")}>
                      <Filter className={cn("w-4 h-4", isFocusMode ? "text-indigo-400" : "text-indigo-600")} />
                    </div>
                    <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">指标计算组</h4>
                  </div>
                  <div className="flex gap-4 flex-wrap">
                    <button
                      onClick={() => setIsXAxisSwapped(!isXAxisSwapped)}
                      className={cn(
                        "flex items-center gap-2 px-3 py-1 rounded-lg text-[10px] font-black transition-all border",
                        isXAxisSwapped
                          ? "bg-amber-500 text-white border-amber-500"
                          : (isFocusMode ? "bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-750" : "bg-white text-slate-500 border-slate-200")
                      )}
                    >
                      <RefreshCcw className="w-3 h-3" />
                      交换 X 轴层级
                    </button>
                    <button
                      onClick={() => setShowSubtotals(!showSubtotals)}
                      className={cn(
                        "flex items-center gap-2 px-3 py-1 rounded-lg text-[10px] font-black transition-all border",
                        showSubtotals
                          ? "bg-emerald-500 text-white border-emerald-500"
                          : (isFocusMode ? "bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-750" : "bg-white text-slate-500 border-slate-200")
                      )}
                    >
                      <Plus className="w-3 h-3" />
                      显示小计
                    </button>
                    <button
                      onClick={() => {
                        const allNames = timeGroupMetadata.map(g => g.name);
                        setSelectedMetricGroups(allNames);
                        setActivePresetId(null);
                      }}
                      className="text-[10px] font-black text-indigo-500 dark:text-indigo-400 hover:underline uppercase tracking-wider"
                    >
                      全选
                    </button>
                    <button
                      onClick={() => {
                        setSelectedMetricGroups([]);
                        setActivePresetId(null);
                      }}
                      className="text-[10px] font-black text-slate-400 hover:underline uppercase tracking-wider"
                    >
                      清空
                    </button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {timeGroupMetadata.map(group => (
                    <label
                      key={group.name}
                      className={cn(
                        "flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer border hover-lift",
                        selectedMetricGroups.includes(group.name)
                          ? (isFocusMode
                            ? "bg-indigo-950/40 border-indigo-800 text-indigo-300 shadow-sm"
                            : "bg-indigo-50/50 border-indigo-200 text-indigo-900 shadow-sm")
                          : (isFocusMode
                            ? "bg-slate-800 border-slate-700 text-slate-450 hover:bg-slate-700"
                            : "bg-slate-50 border-slate-200/60 text-slate-500 hover:bg-white")
                      )}
                    >
                      <input
                        type="checkbox"
                        className="hidden"
                        checked={selectedMetricGroups.includes(group.name)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedMetricGroups([...selectedMetricGroups, group.name]);
                          } else {
                            setSelectedMetricGroups(selectedMetricGroups.filter(k => k !== group.name));
                          }
                          setActivePresetId(null);
                        }}
                      />
                      <div className={cn(
                        "w-4 h-4 rounded-lg border-2 flex items-center justify-center transition-all",
                        selectedMetricGroups.includes(group.name)
                          ? "bg-indigo-500 border-indigo-500 shadow-sm"
                          : (isFocusMode ? "bg-slate-900 border-slate-750" : "bg-white border-slate-300")
                      )}>
                        {selectedMetricGroups.includes(group.name) && <Check className="w-3 h-3 text-white stroke-[3]" />}
                      </div>
                      {group.name}
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}

        {/* Pagination Controls */}
        <div className={cn(
          "flex items-center justify-between px-2 py-1 print:hidden rounded-xl",
          isFocusMode ? "bg-slate-950 text-slate-300" : "bg-white"
        )}>
          <div className="text-xs font-bold text-slate-400">
            指标分页: <span className="text-indigo-500">{currentPage + 1}</span> / {totalPages} (共 {categories.length} 个指标)
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(prev => Math.max(0, prev - 1))}
              disabled={currentPage === 0}
              className={cn(
                "p-2 rounded-lg transition-colors disabled:opacity-30",
                isFocusMode ? "bg-slate-900 text-slate-400 hover:bg-slate-800" : "bg-slate-50 text-slate-600 hover:bg-slate-100"
              )}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="flex gap-1">
              {Array.from({ length: totalPages }).map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentPage(i)}
                  className={cn(
                    "w-6 h-6 rounded-md text-[10px] font-bold transition-all",
                    currentPage === i
                      ? "bg-indigo-600 text-white"
                      : (isFocusMode ? "bg-slate-900 text-slate-400 hover:bg-slate-800" : "bg-slate-50 text-slate-400 hover:bg-slate-100")
                  )}
                >
                  {i + 1}
                </button>
              ))}
            </div>
            <button
              onClick={() => setCurrentPage(prev => Math.min(totalPages - 1, prev + 1))}
              disabled={currentPage === totalPages - 1}
              className={cn(
                "p-2 rounded-lg transition-colors disabled:opacity-30",
                isFocusMode ? "bg-slate-900 text-slate-400 hover:bg-slate-800" : "bg-slate-50 text-slate-600 hover:bg-slate-100"
              )}
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Table Container */}
        <div className={cn(
          "overflow-auto rounded-2xl border shadow-inner transition-all duration-300",
          isFocusMode
            ? "flex-1 border-slate-800 bg-slate-900"
            : "max-h-[600px] border-slate-100 bg-white"
        )}>
          <table className="w-full text-left border-collapse min-w-max">
            <thead>
              {/* Level 1 Header */}
              <tr className={isFocusMode ? "bg-slate-900 text-white" : "bg-slate-800 text-white"}>
                <th
                  className={cn(
                    "p-4 border-b border-r font-black text-[11px] sticky top-0 left-0 z-50 shadow-[2px_0_5px_rgba(0,0,0,0.2)] text-center",
                    selectedYDim2 === 'none'
                      ? "w-[140px] min-w-[140px] max-w-[140px] truncate"
                      : (selectedYDim3 === 'none' ? "w-[280px] min-w-[280px] max-w-[280px] truncate" : "w-[420px] min-w-[420px] max-w-[420px] truncate"),
                    isFocusMode ? "bg-slate-900 border-slate-800 text-slate-200" : "bg-slate-800 border-slate-700 text-white"
                  )}
                  colSpan={selectedYDim2 === 'none' ? 1 : (selectedYDim3 === 'none' ? 2 : 3)}
                >
                  维度 \ {isXAxisSwapped ? '指标' : '计算组'}
                </th>
                {!isXAxisSwapped ? (
                  selectedMetricGroups.map(group => {
                    const indicators = getGroupIndicators(group);
                    if (indicators.length === 0) return null;
                    return (
                      <th
                        key={group}
                        colSpan={indicators.length}
                        className={cn(
                          "p-3 border-b border-r font-black text-[11px] text-center uppercase tracking-[0.2em] sticky top-0 z-30",
                          isFocusMode ? "bg-slate-900 border-slate-800 text-slate-200" : "bg-slate-800 border-slate-700 text-white"
                        )}
                      >
                        {group}
                      </th>
                    );
                  })
                ) : (
                  currentIndicators.map(cat => {
                    const groupsForCat = selectedMetricGroups.filter(g =>
                      g === '本年累计' || TIME_SERIES_ALLOWED_METRICS.includes(cat)
                    );
                    if (groupsForCat.length === 0) return null;
                    return (
                      <th
                        key={cat}
                        colSpan={groupsForCat.length}
                        className={cn(
                          "p-3 border-b border-r font-black text-[11px] text-center uppercase tracking-[0.2em] sticky top-0 z-30",
                          isFocusMode ? "bg-slate-900 border-slate-800 text-slate-200" : "bg-slate-800 border-slate-700 text-white"
                        )}
                      >
                        {cat}
                      </th>
                    );
                  })
                )}
              </tr>
              {/* Level 2 Header */}
              <tr className={isFocusMode ? "bg-slate-800" : "bg-slate-100"}>
                <th
                  className={cn(
                    "p-4 border-b border-r font-black text-xs sticky top-[45px] left-0 z-50 shadow-[2px_0_5px_rgba(0,0,0,0.1)] text-center w-[140px] min-w-[140px] max-w-[140px] truncate",
                    isFocusMode ? "bg-slate-800 text-slate-200 border-slate-700" : "bg-slate-100 text-slate-800 border-slate-200"
                  )}
                >
                  {DIMENSIONS.find(d => d.key === selectedYDim)?.label}
                </th>
                {selectedYDim2 !== 'none' && (
                  <th
                    className={cn(
                      "p-4 border-b border-r font-black text-xs sticky top-[45px] left-[140px] z-50 shadow-[2px_0_5px_rgba(0,0,0,0.1)] text-center w-[140px] min-w-[140px] max-w-[140px] truncate",
                      isFocusMode ? "bg-slate-800 text-slate-200 border-slate-700" : "bg-slate-100 text-slate-800 border-slate-200"
                    )}
                  >
                    {DIMENSIONS.find(d => d.key === selectedYDim2)?.label}
                  </th>
                )}
                {selectedYDim2 !== 'none' && selectedYDim3 !== 'none' && (
                  <th
                    className={cn(
                      "p-4 border-b border-r font-black text-xs sticky top-[45px] left-[280px] z-50 shadow-[2px_0_5px_rgba(0,0,0,0.1)] text-center w-[140px] min-w-[140px] max-w-[140px] truncate",
                      isFocusMode ? "bg-slate-800 text-slate-200 border-slate-700" : "bg-slate-100 text-slate-800 border-slate-200"
                    )}
                  >
                    {DIMENSIONS.find(d => d.key === selectedYDim3)?.label}
                  </th>
                )}
                {!isXAxisSwapped ? (
                  selectedMetricGroups.map(group => (
                    getGroupIndicators(group).map(cat => {
                      const sortKey = `${group}_${cat}`;
                      const isSorting = sortConfig.key === sortKey;
                      return (
                        <th
                          key={sortKey}
                          onClick={() => handleSort(sortKey)}
                          className={cn(
                            "p-3 border-b border-r text-[10px] font-black min-w-[120px] text-center cursor-pointer hover:bg-slate-200 transition-all group/sort sticky top-[45px] z-30",
                            isFocusMode
                              ? (isSorting ? "bg-indigo-950 text-indigo-300 border-slate-700 hover:bg-indigo-900" : "bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700")
                              : (isSorting ? "bg-indigo-50 text-indigo-700 border-slate-200" : "bg-slate-100 text-slate-600 border-slate-200")
                          )}
                        >
                          <div className="flex items-center justify-center gap-1.5">
                            {cat}
                            <div className={cn(
                              "transition-all",
                              isSorting ? "opacity-100 scale-110" : "opacity-0 group-hover/sort:opacity-100 scale-100"
                            )}>
                              {isSorting ? (
                                sortConfig.direction === 'asc' ? <ArrowUp className="w-3.5 h-3.5" /> : <ArrowDown className="w-3.5 h-3.5" />
                              ) : (
                                <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                              )}
                            </div>
                          </div>
                        </th>
                      );
                    })
                  ))
                ) : (
                  currentIndicators.map(cat => {
                    const groupsForCat = selectedMetricGroups.filter(g =>
                      g === '本年累计' || TIME_SERIES_ALLOWED_METRICS.includes(cat)
                    );
                    return groupsForCat.map(group => {
                      const sortKey = `${group}_${cat}`;
                      const isSorting = sortConfig.key === sortKey;
                      return (
                        <th
                          key={sortKey}
                          onClick={() => handleSort(sortKey)}
                          className={cn(
                            "p-3 border-b border-r text-[10px] font-black min-w-[120px] text-center cursor-pointer hover:bg-slate-200 transition-all group/sort sticky top-[45px] z-30",
                            isFocusMode
                              ? (isSorting ? "bg-indigo-950 text-indigo-300 border-slate-700 hover:bg-indigo-900" : "bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700")
                              : (isSorting ? "bg-indigo-50 text-indigo-700 border-slate-200" : "bg-slate-100 text-slate-600 border-slate-200")
                          )}
                        >
                          <div className="flex items-center justify-center gap-1.5">
                            {group}
                            <div className={cn(
                              "transition-all",
                              isSorting ? "opacity-100 scale-110" : "opacity-0 group-hover/sort:opacity-100 scale-100"
                            )}>
                              {isSorting ? (
                                sortConfig.direction === 'asc' ? <ArrowUp className="w-3.5 h-3.5" /> : <ArrowDown className="w-3.5 h-3.5" />
                              ) : (
                                <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                              )}
                            </div>
                          </div>
                        </th>
                      );
                    });
                  })
                )}
              </tr>
            </thead>
            <tbody>
              {tableData.map((row, idx) => {
                // Calculate row spans
                const isFirstOfV1 = selectedYDim2 !== 'none' && (idx === 0 || tableData[idx - 1].dimValue !== row.dimValue);
                const v1Span = selectedYDim2 !== 'none' ? tableData.filter(r => r.dimValue === row.dimValue).length : 1;

                const isFirstOfV2 = selectedYDim2 !== 'none' && selectedYDim3 !== 'none' && (idx === 0 || tableData[idx - 1].dimValue !== row.dimValue || tableData[idx - 1].dimValue2 !== row.dimValue2);
                const v2Span = selectedYDim2 !== 'none' && selectedYDim3 !== 'none' ? tableData.filter(r => r.dimValue === row.dimValue && r.dimValue2 === row.dimValue2).length : 1;

                return (
                  <tr key={`${row.dimValue}-${row.dimValue2}-${row.dimValue3 || ''}-${idx}`} className={cn(
                    "transition-colors",
                    isFocusMode
                      ? (row.isSubtotal ? "bg-indigo-950/20 hover:bg-indigo-900/30" : (idx % 2 === 0 ? "bg-slate-900 hover:bg-slate-800" : "bg-slate-900/50 hover:bg-slate-800/80"))
                      : (row.isSubtotal ? "bg-indigo-50/30 hover:bg-indigo-100/40" : (idx % 2 === 0 ? "bg-white hover:bg-slate-50/50" : "bg-slate-50/20 hover:bg-slate-50/50"))
                  )}>
                    {selectedYDim2 === 'none' ? (
                      <td className={cn(
                        "p-4 border-b border-r text-sm font-bold sticky left-0 z-20 text-center w-[140px] min-w-[140px] max-w-[140px] truncate",
                        isFocusMode ? "border-slate-800" : "border-slate-100",
                        row.isSubtotal
                          ? (isFocusMode ? "bg-[#1e1b4b] text-indigo-400 font-black text-xs" : "bg-indigo-50 text-indigo-600 font-black text-xs")
                          : (idx % 2 === 0
                            ? (isFocusMode ? "bg-slate-900 text-slate-300" : "bg-white text-slate-700")
                            : (isFocusMode ? "bg-[#1e293b] text-slate-300" : "bg-slate-50 text-slate-700")
                          )
                      )}>
                        {row.dimValue}
                      </td>
                    ) : selectedYDim3 === 'none' ? (
                      <>
                        {isFirstOfV1 && (
                          <td
                            rowSpan={v1Span}
                            className={cn(
                              "p-4 border-b border-r text-sm font-black sticky left-0 z-20 text-center align-middle shadow-[2px_0_5px_rgba(0,0,0,0.05)] w-[140px] min-w-[140px] max-w-[140px] truncate",
                              isFocusMode
                                ? "bg-slate-900 text-slate-100 border-slate-800"
                                : "bg-white text-slate-800 border-slate-100"
                            )}
                          >
                            {row.dimValue}
                          </td>
                        )}
                        <td className={cn(
                          "p-4 border-b border-r sticky left-[140px] z-20 text-center w-[140px] min-w-[140px] max-w-[140px] truncate",
                          isFocusMode ? "border-slate-800" : "border-slate-100",
                          row.isSubtotal
                            ? (isFocusMode ? "bg-[#1e1b4b] text-indigo-400 font-black text-xs" : "bg-indigo-50 text-indigo-600 font-black text-xs")
                            : (idx % 2 === 0
                              ? (isFocusMode ? "bg-slate-900 text-slate-300" : "bg-white text-slate-600 font-medium text-xs")
                              : (isFocusMode ? "bg-[#1e293b] text-slate-300" : "bg-slate-50 text-slate-600 font-medium text-xs")
                            )
                        )}>
                          {row.dimValue2}
                        </td>
                      </>
                    ) : (
                      <>
                        {isFirstOfV1 && (
                          <td
                            rowSpan={v1Span}
                            className={cn(
                              "p-4 border-b border-r text-sm font-black sticky left-0 z-20 text-center align-middle shadow-[2px_0_5px_rgba(0,0,0,0.05)] w-[140px] min-w-[140px] max-w-[140px] truncate",
                              isFocusMode
                                ? "bg-slate-900 text-slate-100 border-slate-800"
                                : "bg-white text-slate-800 border-slate-100"
                            )}
                          >
                            {row.dimValue}
                          </td>
                        )}
                        {row.isSubtotal && row.subtotalLevel === 1 ? (
                          <td
                            colSpan={2}
                            className={cn(
                              "p-4 border-b border-r sticky left-[140px] z-20 text-center w-[280px] min-w-[280px] max-w-[280px] truncate",
                              isFocusMode ? "border-slate-800 bg-[#1e1b4b] text-indigo-400 font-black text-xs" : "border-slate-100 bg-indigo-50 text-indigo-600 font-black text-xs"
                            )}
                          >
                            {row.dimValue2}
                          </td>
                        ) : (
                          <>
                            {isFirstOfV2 && (
                              <td
                                rowSpan={v2Span}
                                className={cn(
                                  "p-4 border-b border-r sticky left-[140px] z-20 text-center w-[140px] min-w-[140px] max-w-[140px] truncate",
                                  isFocusMode ? "border-slate-800" : "border-slate-100",
                                  idx % 2 === 0
                                    ? (isFocusMode ? "bg-slate-900 text-slate-300" : "bg-white text-slate-600 font-medium text-xs")
                                    : (isFocusMode ? "bg-[#1e293b] text-slate-300" : "bg-slate-50 text-slate-600 font-medium text-xs")
                                )}
                              >
                                {row.dimValue2}
                              </td>
                            )}
                            <td className={cn(
                              "p-4 border-b border-r sticky left-[280px] z-20 text-center w-[140px] min-w-[140px] max-w-[140px] truncate",
                              isFocusMode ? "border-slate-800" : "border-slate-100",
                              row.isSubtotal
                                ? (isFocusMode ? "bg-[#1e1b4b] text-indigo-400 font-black text-xs" : "bg-indigo-50 text-indigo-600 font-black text-xs")
                                : (idx % 2 === 0
                                  ? (isFocusMode ? "bg-slate-900 text-slate-300" : "bg-white text-slate-500 font-normal text-xs")
                                  : (isFocusMode ? "bg-[#1e293b] text-slate-300" : "bg-slate-50 text-slate-500 font-normal text-xs")
                                )
                            )}>
                              {row.dimValue3}
                            </td>
                          </>
                        )}
                      </>
                    )}

                    {!isXAxisSwapped ? (
                      selectedMetricGroups.map(group => (
                        getGroupIndicators(group).map(cat => {
                          const val = row.metrics[`${group}_${cat}`];
                          const isRate = isRateMetric(group) || isRateMetric(cat);
                          const isWanYuan = !isRate && isMoneyMetric(cat);
                          return (
                            <td
                              key={`${group}_${cat}`}
                              className={cn(
                                "p-3 border-b border-r text-sm font-medium text-center",
                                isFocusMode ? "border-slate-800" : "border-slate-50",
                                row.isSubtotal && (isFocusMode ? "bg-indigo-950/20" : "bg-indigo-50/30"),
                                group.includes('增减')
                                  ? (val >= 0
                                    ? (isFocusMode ? "text-emerald-400" : "text-emerald-600")
                                    : (isFocusMode ? "text-rose-400" : "text-rose-600")
                                  )
                                  : (row.isSubtotal
                                    ? (isFocusMode ? "text-indigo-400 font-bold" : "text-indigo-600 font-bold")
                                    : (isFocusMode ? "text-slate-300" : "text-slate-600")
                                  )
                              )}
                            >
                              {formatNumber(val, isRate, isIntegerMode, isWanYuan)}
                            </td>
                          );
                        })
                      ))
                    ) : (
                      currentIndicators.map(cat => {
                        const groupsForCat = selectedMetricGroups.filter(g =>
                          g === '本年累计' || TIME_SERIES_ALLOWED_METRICS.includes(cat)
                        );
                        return groupsForCat.map(group => {
                          const val = row.metrics[`${group}_${cat}`];
                          const isRate = isRateMetric(group) || isRateMetric(cat);
                          const isWanYuan = !isRate && isMoneyMetric(cat);
                          return (
                            <td
                              key={`${group}_${cat}`}
                              className={cn(
                                "p-3 border-b border-r text-sm font-medium text-center",
                                isFocusMode ? "border-slate-800" : "border-slate-50",
                                row.isSubtotal && (isFocusMode ? "bg-indigo-950/20" : "bg-indigo-50/30"),
                                group.includes('增减')
                                  ? (val >= 0
                                    ? (isFocusMode ? "text-emerald-400" : "text-emerald-600")
                                    : (isFocusMode ? "text-rose-400" : "text-rose-600")
                                  )
                                  : (row.isSubtotal
                                    ? (isFocusMode ? "text-indigo-400 font-bold" : "text-indigo-600 font-bold")
                                    : (isFocusMode ? "text-slate-300" : "text-slate-600")
                                  )
                              )}
                            >
                              {formatNumber(val, isRate, isIntegerMode, isWanYuan)}
                            </td>
                          );
                        });
                      })
                    )}
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              {/* Total Row */}
              <tr className="bg-indigo-900 text-white font-black">
                <td
                  className={cn(
                    "p-4 border-b border-r text-white text-sm sticky bottom-0 left-0 z-45 shadow-[2px_0_5px_rgba(0,0,0,0.2)] text-center",
                    selectedYDim2 === 'none'
                      ? "w-[140px] min-w-[140px] max-w-[140px] truncate"
                      : (selectedYDim3 === 'none' ? "w-[280px] min-w-[280px] max-w-[280px] truncate" : "w-[420px] min-w-[420px] max-w-[420px] truncate"),
                    isFocusMode ? "bg-indigo-950 border-indigo-900" : "bg-indigo-900 border-indigo-800"
                  )}
                  colSpan={selectedYDim2 === 'none' ? 1 : (selectedYDim3 === 'none' ? 2 : 3)}
                >
                  合计
                </td>
                {!isXAxisSwapped ? (
                  selectedMetricGroups.map(group => (
                    getGroupIndicators(group).map(cat => {
                      const val = totalRow[`${group}_${cat}`];
                      const isRate = isRateMetric(group) || isRateMetric(cat);
                      const isWanYuan = !isRate && isMoneyMetric(cat);
                      return (
                        <td
                          key={`${group}_${cat}`}
                          className={cn(
                            "p-3 border-b border-r text-sm text-center sticky bottom-0 z-35",
                            isFocusMode ? "bg-indigo-950 border-indigo-900" : "bg-indigo-900 border-indigo-800",
                            group.includes('增减')
                              ? (val >= 0 ? "text-emerald-400" : "text-rose-400")
                              : "text-white"
                          )}
                        >
                          {formatNumber(val, isRate, isIntegerMode, isWanYuan)}
                        </td>
                      );
                    })
                  ))
                ) : (
                  currentIndicators.map(cat => {
                    const groupsForCat = selectedMetricGroups.filter(g =>
                      g === '本年累计' || TIME_SERIES_ALLOWED_METRICS.includes(cat)
                    );
                    return groupsForCat.map(group => {
                      const val = totalRow[`${group}_${cat}`];
                      const isRate = isRateMetric(group) || isRateMetric(cat);
                      const isWanYuan = !isRate && isMoneyMetric(cat);
                      return (
                        <td
                          key={`${group}_${cat}`}
                          className={cn(
                            "p-3 border-b border-r text-sm text-center sticky bottom-0 z-35",
                            isFocusMode ? "bg-indigo-950 border-indigo-900" : "bg-indigo-900 border-indigo-800",
                            group.includes('增减')
                              ? (val >= 0 ? "text-emerald-400" : "text-rose-400")
                              : "text-white"
                          )}
                        >
                          {formatNumber(val, isRate, isIntegerMode, isWanYuan)}
                        </td>
                      );
                    });
                  })
                )}
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Footer info */}
        <div className={cn(
          "flex items-center gap-4 text-[10px] font-bold uppercase tracking-[0.2em]",
          isFocusMode ? "text-slate-500" : "text-slate-400"
        )}>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
            正值 / 增长
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-rose-500"></div>
            负值 / 下降
          </div>
          <div className="ml-auto">
            数据更新至: {selectedMonth}
          </div>
        </div>
      </div>
    </>
  );
};

