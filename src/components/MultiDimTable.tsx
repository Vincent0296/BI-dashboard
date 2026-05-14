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
  Edit2
} from 'lucide-react';
import { EnrichedRecord, AuthState, TablePreset, MetricMetadata, TimeGroupMetadata, MetricKey } from '../types';
import { supabase } from '../lib/supabase';
import { cn, formatNumber, isMoneyMetric } from '../lib/utils';
import { TIME_SERIES_ALLOWED_METRICS, BUDGET_METRICS, THREE_YEAR_BENEFIT_METRICS, BUSINESS_METRICS } from '../constants/internalData';


interface MultiDimTableProps {
  data: EnrichedRecord[];
  categories: string[];
  selectedMonth: string;
  isIntegerMode: boolean;
  setIsIntegerMode: (val: boolean) => void;
  authState: AuthState;
  metricMetadata: MetricMetadata[];
  timeGroupMetadata: TimeGroupMetadata[];
}

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
] as const;

export const MultiDimTable: React.FC<MultiDimTableProps> = ({ 
  data, 
  categories, 
  selectedMonth,
  isIntegerMode,
  setIsIntegerMode,
  authState,
  metricMetadata,
  timeGroupMetadata
}) => {
  const [selectedYDim, setSelectedYDim] = useState<typeof DIMENSIONS[number]['key']>('propertyType');
  // 初始状态：默认全选
  const [selectedMetricGroups, setSelectedMetricGroups] = useState<string[]>(() => {
    return timeGroupMetadata.map(g => g.name);
  });
  const [currentPage, setCurrentPage] = useState(0);
  const itemsPerPage = 5; 

  // --- Preset States ---
  const [tablePresets, setTablePresets] = useState<TablePreset[]>([]);
  const [isSavingPreset, setIsSavingPreset] = useState(false);
  const [newPresetName, setNewPresetName] = useState('');
  const [activePresetId, setActivePresetId] = useState<string | null>(null);
  const [editingPresetId, setEditingPresetId] = useState<string | null>(null);

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
        // Only keep table-specific presets
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
              selectedMetricGroups: groups,
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
          selectedMetricGroups
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
          selectedMetricGroups: newPresetObj.filters.selectedMetricGroups as MetricKey[],
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
    setSelectedMetricGroups(preset.selectedMetricGroups);
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
            selectedMetricGroups
          },
          timestamp: new Date().toISOString()
        })
        .eq('id', preset.id);

      if (!error) {
        setTablePresets(tablePresets.map(p => p.id === preset.id ? { ...p, selectedYDim, selectedMetricGroups } as TablePreset : p));
        alert('方案已成功更新');
      }
    } catch (err) {
      console.error('Failed to update table preset', err);
    }
  };

  const currentIndicators = categories.slice(currentPage * itemsPerPage, (currentPage + 1) * itemsPerPage);

  const getGroupIndicators = (groupName: string) => {
    if (groupName === '本年累计') return currentIndicators;
    return currentIndicators.filter(cat => TIME_SERIES_ALLOWED_METRICS.includes(cat));
  };

  const dimValues = useMemo(() => {
    const rawValues = Array.from(new Set(data.map(d => String(d[selectedYDim]))));
    if (selectedYDim === 'propertyType') {
      const order = ['酒店业务', '物业业务', '餐饮业务', '租赁业务', '其他业务', '管理业务'];
      return rawValues.sort((a: string, b: string) => {
        const idxA = order.indexOf(a);
        const idxB = order.indexOf(b);
        if (idxA !== -1 && idxB !== -1) return idxA - idxB;
        if (idxA !== -1) return -1;
        if (idxB !== -1) return 1;
        return a.localeCompare(b);
      });
    }
    if (selectedYDim === 'management') {
      const order = ['上海酒店项目部', '上海物业项目部', '常州项目部', '南京项目部', '无锡宜兴项目', '浙江项目部', '南通项目部', '上海本部'];
      return rawValues.sort((a: string, b: string) => {
        const idxA = order.indexOf(a);
        const idxB = order.indexOf(b);
        if (idxA !== -1 && idxB !== -1) return idxA - idxB;
        if (idxA !== -1) return -1;
        if (idxB !== -1) return 1;
        return a.localeCompare(b);
      });
    }
    if (selectedYDim === 'ownership') {
      const order = ['上海母公司', '常州酒店', '南京酒店', '无锡酒店', '宜兴（华东分）', '黄山酒店', '合并抵消', '华东分抵消'];
      return rawValues.sort((a: string, b: string) => {
        const idxA = order.indexOf(a);
        const idxB = order.indexOf(b);
        if (idxA !== -1 && idxB !== -1) return idxA - idxB;
        if (idxA !== -1) return -1;
        if (idxB !== -1) return 1;
        return a.localeCompare(b);
      });
    }
    return rawValues.sort((a: string, b: string) => a.localeCompare(b));
  }, [data, selectedYDim]);

  const getMetricAggregatedValue = (dataSlice: EnrichedRecord[], metricName: string, timeGroupName: string): number => {
    if (!selectedMonth || !selectedMonth.includes('-')) return 0;
    const [year, month] = selectedMonth.split('-').map(Number);
    const prevYear = year - 1;
    const pm = month === 1 ? { y: year - 1, m: 12 } : { y: year, m: month - 1 };

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
      return previous !== 0 ? (current - previous) / Math.abs(previous) : 0;
    }
    if (timeGroupName === '环比增减率') {
      const current = getMetricAggregatedValue(dataSlice, metricName, '当月发生额');
      const previous = getMetricAggregatedValue(dataSlice, metricName, '上月发生额');
      return previous !== 0 ? (current - previous) / Math.abs(previous) : 0;
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

      if (cleanFormula.includes('/') && !cleanFormula.includes('+') && !cleanFormula.includes('*100')) {
        const [numName, denName] = cleanFormula.split('/').map(s => s.trim());
        const num = getMetricAggregatedValue(dataSlice, numName, timeGroupName);
        const den = getMetricAggregatedValue(dataSlice, denName, timeGroupName);
        return den !== 0 ? num / den : 0;
      }
      
      if (cleanFormula.includes('15用工薪酬成本') || cleanFormula.includes('用工薪酬成本')) {
        const s1 = getMetricAggregatedValue(dataSlice, '15用工薪酬成本', timeGroupName);
        const s2 = getMetricAggregatedValue(dataSlice, '16外包劳务支出', timeGroupName);
        const den = getMetricAggregatedValue(dataSlice, '收入YTD', timeGroupName);
        const val = den !== 0 ? (s1 + s2) / den : 0;
        return cleanFormula.includes('*100') ? val * 100 : val;
      }
      if (cleanFormula.includes('8外购燃料') || cleanFormula.includes('外购燃料')) {
        const s1 = getMetricAggregatedValue(dataSlice, '8外购燃料', timeGroupName);
        const s2 = getMetricAggregatedValue(dataSlice, '9外购动力', timeGroupName);
        const den = getMetricAggregatedValue(dataSlice, '收入YTD', timeGroupName);
        const val = den !== 0 ? (s1 + s2) / den : 0;
        return cleanFormula.includes('*100') ? val * 100 : val;
      }

      if (cleanFormula.includes('*100')) {
        const base = cleanFormula.replace('*100', '').replace(/^\(|\)$/g, '').trim();
        if (base.includes('ABS(')) {
          // Handle the new profit completion formula: (1+(利润YTD-Budget)/ABS(Budget))*100
          const isInternal = metricName.includes('内部');
          const budgetName = isInternal ? '2026全年预算利润-内部' : '2026全年预算利润';
          const profit = getMetricAggregatedValue(dataSlice, '利润YTD', timeGroupName);
          const budget = getMetricAggregatedValue(dataSlice, budgetName, timeGroupName);
          if (budget === 0) return 0;
          return (1 + (profit - budget) / Math.abs(budget)) * 100;
        }
        if (base.includes('/')) {
          const [numName, denName] = base.split('/').map(s => s.trim());
          const num = getMetricAggregatedValue(dataSlice, numName, timeGroupName);
          const den = getMetricAggregatedValue(dataSlice, denName, timeGroupName);
          const val = den !== 0 ? num / den : 0;
          return val * 100;
        }
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
    return dimValues.map(dv => {
      const slice = data.filter(d => String(d[selectedYDim]) === dv);
      const metrics: Record<string, number> = {};
      
      selectedMetricGroups.forEach(groupName => {
        categories.forEach(cat => {
          metrics[`${groupName}_${cat}`] = calculateValue(slice, cat, groupName);
        });
      });
      
      return { dimValue: dv, metrics };
    });
  }, [data, dimValues, selectedYDim, selectedMetricGroups, categories, selectedMonth, metricMetadata, timeGroupMetadata]);

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
    const header1 = ['维度', ...selectedMetricGroups.flatMap(g => Array(currentIndicators.length).fill(g))];
    const header2 = ['', ...selectedMetricGroups.flatMap(() => currentIndicators)];
    
    const rows = tableData.map(row => [
      row.dimValue,
      ...selectedMetricGroups.flatMap(g => 
        currentIndicators.map(cat => {
          const val = row.metrics[`${g}_${cat}`];
          const isRate = g.includes('率') || g.includes('Percent');
          return isRate ? (val * 100).toFixed(2) + '%' : val;
        })
      )
    ]);

    const totalLine = [
      '合计',
      ...selectedMetricGroups.flatMap(g => 
        currentIndicators.map(cat => {
          const val = totalRow[`${g}_${cat}`];
          const isRate = g.includes('率') || g.includes('Percent');
          return isRate ? (val * 100).toFixed(2) + '%' : val;
        })
      )
    ];

    const worksheet = XLSX.utils.aoa_to_sheet([header1, header2, ...rows, totalLine]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "多维分析表");
    XLSX.writeFile(workbook, `MultiDim_Analysis_${selectedMonth}.xlsx`);
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col space-y-6">
        {/* Header Section */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600 p-2 rounded-xl shadow-lg shadow-indigo-100">
              <TableIcon className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-800">多维交叉数据分析表</h3>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Multidimensional Performance Matrix</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => setIsIntegerMode(!isIntegerMode)}
              className="px-3 py-1.5 text-[11px] font-bold rounded-lg border transition-all hover:opacity-80 active:scale-95"
              style={{
                borderColor: isIntegerMode ? '#4f46e5' : '#e2e8f0',
                backgroundColor: isIntegerMode ? '#eef2ff' : '#ffffff',
                color: isIntegerMode ? '#4338ca' : '#64748b'
              }}
            >
              {isIntegerMode ? '恢复默认' : '切换整数显示'}
            </button>
            <button 
              onClick={exportToExcel}
              className="flex items-center gap-2 bg-emerald-50 text-emerald-600 px-4 py-2 rounded-xl text-sm font-bold hover:bg-emerald-100 transition-all active:scale-95 border border-emerald-100"
            >
              <Download className="w-4 h-4" />
              Excel 导出
            </button>
          </div>
        </div>

        {/* Separate Preset Management for Table */}
        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1.5 text-slate-400 mr-2">
              <Bookmark className="w-3.5 h-3.5" />
              <span className="text-[10px] font-black uppercase tracking-wider">表格预设方案</span>
            </div>
            
            {tablePresets.map(preset => (
              <div 
                key={preset.id}
                onClick={() => applyPreset(preset)}
                className={cn(
                  "group flex items-center gap-2 px-3 py-1.5 bg-slate-50 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-200 rounded-xl cursor-pointer transition-all",
                  editingPresetId === preset.id && "bg-white border-indigo-500 ring-2 ring-indigo-100",
                  activePresetId === preset.id && "bg-indigo-100 border-indigo-400 ring-1 ring-indigo-200"
                )}
              >
                {editingPresetId === preset.id ? (
                  <input
                    autoFocus
                    className="text-[10px] font-bold bg-transparent outline-none w-24"
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
                    <span className="text-[10px] font-bold text-slate-600 group-hover:text-indigo-600">{preset.name}</span>
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity ml-1">
                      <button 
                        onClick={(e) => { e.stopPropagation(); setEditingPresetId(preset.id); }}
                        title="重命名"
                        className="p-1 hover:bg-indigo-100 rounded text-slate-400 hover:text-indigo-600 transition-all"
                      >
                        <Edit2 className="w-2.5 h-2.5" />
                      </button>
                      <button 
                        onClick={(e) => handleUpdatePreset(preset, e)}
                        title="覆盖更新当前设置"
                        className="p-1 hover:bg-emerald-100 rounded text-slate-400 hover:text-emerald-600 transition-all"
                      >
                        <RefreshCcw className="w-2.5 h-2.5" />
                      </button>
                      <button 
                        onClick={(e) => handleDeletePreset(preset.id, e)}
                        title="删除"
                        className="p-1 hover:bg-red-100 rounded text-slate-400 hover:text-red-500 transition-all"
                      >
                        <Trash2 className="w-2.5 h-2.5" />
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
                  placeholder="方案名称..."
                  value={newPresetName}
                  onChange={(e) => setNewPresetName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSavePreset()}
                  className="text-[10px] font-bold px-3 py-1 bg-white border-2 border-indigo-500 rounded-lg outline-none w-32"
                />
                <button onClick={handleSavePreset} className="p-1 bg-indigo-600 text-white rounded-md hover:bg-indigo-700">
                  <Plus className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => setIsSavingPreset(false)} className="p-1 bg-slate-100 text-slate-500 rounded-md hover:bg-slate-200">
                  <X className="w-3.5 h-3.5" />
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
                className="flex items-center gap-1.5 px-3 py-1 text-indigo-600 font-bold hover:bg-indigo-50 rounded-lg border border-dashed border-indigo-200 transition-all"
              >
                <Save className="w-3 h-3" />
                <span className="text-[10px]">保存当前表格配置</span>
              </button>
            )}
          </div>
        </div>

        {/* Controls Section */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 bg-slate-50/50 p-6 rounded-2xl border border-slate-100">
          {/* Y-Axis Selection */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-slate-500 font-bold text-xs uppercase tracking-widest">
              <Filter className="w-3.5 h-3.5" />
              Y轴维度选择
            </div>
            <div className="flex flex-wrap gap-2">
              {DIMENSIONS.map(dim => (
                <button
                  key={dim.key}
                  onClick={() => {
                    setSelectedYDim(dim.key);
                    setActivePresetId(null);
                  }}
                  className={cn(
                    "px-4 py-2 rounded-xl text-xs font-black transition-all",
                    selectedYDim === dim.key 
                      ? "bg-indigo-600 text-white shadow-md shadow-indigo-100" 
                      : "bg-white text-slate-500 hover:bg-slate-100 border border-slate-200"
                  )}
                >
                  {dim.label}
                </button>
              ))}
            </div>
          </div>

          {/* X-Axis Metric Group Selection */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-slate-500 font-bold text-xs uppercase tracking-widest">
                <Filter className="w-3.5 h-3.5" />
                X轴计算组多选
              </div>
              <div className="flex gap-3">
                <button 
                  onClick={() => {
                    const allNames = timeGroupMetadata.map(g => g.name);
                    setSelectedMetricGroups(allNames);
                    setActivePresetId(null);
                  }}
                  className="text-[10px] font-bold text-indigo-600 hover:underline"
                >
                  全选
                </button>
                <button 
                  onClick={() => {
                    setSelectedMetricGroups([]);
                    setActivePresetId(null);
                  }}
                  className="text-[10px] font-bold text-slate-400 hover:underline"
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
                    "flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer border",
                    selectedMetricGroups.includes(group.name)
                      ? "bg-blue-50 border-blue-200 text-blue-700"
                      : "bg-white border-slate-200 text-slate-400 hover:border-slate-300"
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
                    "w-3 h-3 rounded-sm border",
                    selectedMetricGroups.includes(group.name) ? "bg-blue-500 border-blue-500" : "bg-white border-slate-300"
                  )} />
                  {group.name}
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Pagination Controls */}
        <div className="flex items-center justify-between bg-white px-2 py-1">
          <div className="text-xs font-bold text-slate-400">
            指标分页: <span className="text-indigo-600">{currentPage + 1}</span> / {totalPages} (共 {categories.length} 个指标)
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(prev => Math.max(0, prev - 1))}
              disabled={currentPage === 0}
              className="p-2 rounded-lg bg-slate-50 text-slate-600 disabled:opacity-30 hover:bg-slate-100 transition-colors"
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
                    currentPage === i ? "bg-indigo-600 text-white" : "bg-slate-50 text-slate-400 hover:bg-slate-100"
                  )}
                >
                  {i + 1}
                </button>
              ))}
            </div>
            <button
              onClick={() => setCurrentPage(prev => Math.min(totalPages - 1, prev + 1))}
              disabled={currentPage === totalPages - 1}
              className="p-2 rounded-lg bg-slate-50 text-slate-600 disabled:opacity-30 hover:bg-slate-100 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Table Container */}
        <div className="overflow-x-auto rounded-2xl border border-slate-100 shadow-inner">
          <table className="w-full text-left border-collapse min-w-max">
            <thead>
              {/* Level 1 Header */}
              <tr className="bg-slate-800 text-white">
                <th className="p-4 border-b border-r border-slate-700 font-black text-[11px] sticky left-0 bg-slate-800 z-30 w-48 shadow-[2px_0_5px_rgba(0,0,0,0.2)]">
                  维度 \ 计算组
                </th>
                {selectedMetricGroups.map(group => {
                  const indicators = getGroupIndicators(group);
                  if (indicators.length === 0) return null;
                  return (
                    <th 
                      key={group} 
                      colSpan={indicators.length}
                      className="p-3 border-b border-r border-slate-700 font-black text-[11px] text-center uppercase tracking-[0.2em] bg-slate-800"
                    >
                      {group}
                    </th>
                  );
                })}
              </tr>
              {/* Level 2 Header */}
              <tr className="bg-slate-100">
                <th className="p-4 border-b border-r border-slate-200 text-slate-800 font-black text-xs sticky left-0 bg-slate-100 z-30 shadow-[2px_0_5px_rgba(0,0,0,0.1)]">
                  {DIMENSIONS.find(d => d.key === selectedYDim)?.label}
                </th>
                {selectedMetricGroups.map(group => (
                  getGroupIndicators(group).map(cat => (
                    <th 
                      key={`${group}_${cat}`}
                      className="p-3 border-b border-r border-slate-200 text-slate-600 font-black text-[10px] bg-slate-100 min-w-[120px]"
                    >
                      {cat}
                    </th>
                  ))
                ))}
              </tr>
            </thead>
            <tbody>
              {tableData.map((row, idx) => (
                <tr key={row.dimValue} className={cn("hover:bg-slate-50/50 transition-colors", idx % 2 === 0 ? "bg-white" : "bg-slate-50/20")}>
                  <td className="p-4 border-b border-r border-slate-100 text-slate-700 font-bold text-sm sticky left-0 bg-inherit z-10">
                    {row.dimValue}
                  </td>
                  {selectedMetricGroups.map(group => (
                    getGroupIndicators(group).map(cat => {
                      const val = row.metrics[`${group}_${cat}`];
                      const isRate = group.includes('率') || group.includes('Percent') || cat.includes('率') || cat.includes('Percent');
                      const isWanYuan = !isRate && isMoneyMetric(cat);
                      return (
                        <td 
                          key={`${group}_${cat}`}
                          className={cn(
                            "p-3 border-b border-r border-slate-50 text-sm font-medium",
                            (isRate || group === '同比增减额' || group === '环比增减额') 
                              ? (val >= 0 ? "text-emerald-600" : "text-rose-600") 
                              : "text-slate-600"
                          )}
                        >
                          {formatNumber(val, isRate, isIntegerMode, isWanYuan)}
                        </td>
                      );
                    })
                  ))}
                </tr>
              ))}
              {/* Total Row */}
              <tr className="bg-indigo-900 text-white font-black">
                <td className="p-4 border-b border-r border-indigo-800 text-white text-sm sticky left-0 bg-indigo-900 z-10 shadow-[2px_0_5px_rgba(0,0,0,0.2)]">
                  合计
                </td>
                {selectedMetricGroups.map(group => (
                  getGroupIndicators(group).map(cat => {
                    const val = totalRow[`${group}_${cat}`];
                    const isRate = group.includes('率') || group.includes('Percent') || cat.includes('率') || cat.includes('Percent');
                    const isWanYuan = !isRate && isMoneyMetric(cat);
                    return (
                      <td 
                        key={`${group}_${cat}`}
                        className={cn(
                          "p-3 border-b border-r border-indigo-800 text-sm",
                          (isRate || group === '同比增减额' || group === '环比增减额') 
                            ? (val >= 0 ? "text-emerald-400" : "text-rose-400") 
                            : "text-white"
                        )}
                      >
                        {formatNumber(val, isRate, isIntegerMode, isWanYuan)}
                      </td>
                    );
                  })
                ))}
              </tr>
            </tbody>
          </table>
        </div>
        
        {/* Footer info */}
        <div className="flex items-center gap-4 text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em]">
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
    </div>
  );
};

