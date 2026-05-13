import React, { useState, useMemo, useRef, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { FilterState, MetricKey, PerformanceItem, DataRecord } from '../types';
import { Slicer } from './Slicer';
import { MetricSelector } from './MetricSelector';
import { PerformanceChart } from './PerformanceChart';
import { TrendChart } from './TrendChart';
import { PieChartWidget } from './PieChartWidget';
import { CommentsSection } from './CommentsSection';
import { AuthModal } from './AuthModal';
import { FeedbackModal } from './FeedbackModal';
import { HelpModal } from './HelpModal';
import { AdminPanel } from './AdminPanel';
import { MultiDimTable } from './MultiDimTable';
import { Search, Filter, Calendar, Upload, FileSpreadsheet, AlertCircle, RotateCcw, ChevronDown, ChevronUp, Download, Camera, LogIn, User as UserIcon, LogOut, MessageSquareMore, ShieldCheck, Save, Bookmark, Trash2, Plus, X, Edit2, RefreshCcw, BookOpen, BarChart2, TrendingUp, PieChart as PieChartIcon, Table as TableIcon } from 'lucide-react';
import { cn, formatNumber } from '../lib/utils';
import { AuthState, User, FilterPreset } from '../types';
import { supabase } from '../lib/supabase';

export const Dashboard: React.FC = () => {
  // --- States ---
  const [sourceData, setSourceData] = useState<DataRecord[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [selectedMetric, setSelectedMetric] = useState<MetricKey>('YTD');
  const [isImporting, setIsImporting] = useState(false);
  const [selectedIndicators, setSelectedIndicators] = useState<string[]>([]);
  const [isSlicerVisible, setIsSlicerVisible] = useState(true);
  const [isIndicatorVisible, setIsIndicatorVisible] = useState(true);
  const [authState, setAuthState] = useState<AuthState>({ isLoggedIn: false, user: null });
  const [view, setView] = useState<'dashboard' | 'admin'>('dashboard');
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false);
  const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);
  
  const [isIntegerMode, setIsIntegerMode] = useState(false);
  const [clickedIndicator, setClickedIndicator] = useState<string | null>(null);
  const [tableDimension, setTableDimension] = useState<'产权口径' | '管理口径' | '业务业态' | '项目名称'>('业务业态');
  const [chartType, setChartType] = useState<'bar' | 'line' | 'pie' | 'table'>('bar');
  const [activePresetId, setActivePresetId] = useState<string | null>(null);
  const [isMultiDimTableVisible, setIsMultiDimTableVisible] = useState(true);

  const getMetricLabel = (key: MetricKey) => {
    switch(key) {
      case 'YTD': return '本年累计';
      case 'LY': return '去年同期';
      case 'YoYDiff': return '同比增减额';
      case 'YoYPercent': return '同比增减率';
      case 'MTD': return '当月发生额';
      case 'PreMonth': return '上月发生额';
      case 'MoMDiff': return '环比增减额';
      case 'MoMPercent': return '环比增减率';
    }
  };
  const [presets, setPresets] = useState<FilterPreset[]>([]);
  const [isSavingPreset, setIsSavingPreset] = useState(false);
  const [editingPresetId, setEditingPresetId] = useState<string | null>(null);
  const [newPresetName, setNewPresetName] = useState('');
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const chartRef = useRef<HTMLDivElement>(null);
  const dimTableScrollRef = useRef<HTMLDivElement>(null);

  const checkAuth = (action: () => void) => {
    if (!authState.isLoggedIn) {
      setPendingAction(() => action);
      setIsAuthModalOpen(true);
    } else {
      action();
    }
  };

  const handleLoginSuccess = (user: User) => {
    setAuthState({ isLoggedIn: true, user });
    if (pendingAction) {
      setTimeout(() => {
        pendingAction();
        setPendingAction(null);
      }, 500);
    }
  };

  const handleLogout = () => {
    setAuthState({ isLoggedIn: false, user: null });
  };

  const uniqueOptions = useMemo(() => {
    const months = [...new Set(sourceData.map(d => d.month))].sort().reverse();
    return {
      ownerships: [...new Set(sourceData.map(d => d.ownership))],
      managements: [...new Set(sourceData.map(d => d.management))],
      propertyTypes: [...new Set(sourceData.map(d => d.propertyType))],
      projectNames: [...new Set(sourceData.map(d => d.projectName))],
      months
    };
  }, [sourceData]);

  const [filters, setFilters] = useState<FilterState>({
    months: [],
    ownerships: [],
    managements: [],
    propertyTypes: [],
    projectNames: []
  });

  // Handle File Upload
  useEffect(() => {
    if (authState.isLoggedIn && authState.user) {
      fetchPresets(authState.user.id);
    } else {
      setPresets([]);
    }
  }, [authState.isLoggedIn, authState.user]);

  const fetchPresets = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('presets')
        .select('*')
        .eq('userId', userId)
        .order('timestamp', { ascending: false });
        
      if (!error && data) {
        setPresets(data);
      }
    } catch (err) {
      console.error('Failed to fetch presets', err);
    }
  };

  const handleSavePreset = async () => {
    if (!authState.isLoggedIn) {
      setPendingAction(() => handleSavePreset);
      setIsAuthModalOpen(true);
      return;
    }

    if (!newPresetName.trim()) {
      alert('请输入方案名称');
      return;
    }

    try {
      const newPreset = {
        id: Date.now().toString(),
        userId: authState.user?.id,
        name: newPresetName,
        filters: filters,
        selectedIndicators: selectedIndicators,
        timestamp: new Date().toISOString()
      };
      
      const { error } = await supabase.from('presets').insert([newPreset]);

      if (!error) {
        setPresets([newPreset, ...presets]);
        setNewPresetName('');
        setIsSavingPreset(false);
      }
    } catch (err) {
      console.error('Failed to save preset', err);
    }
  };

  const handleDeletePreset = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('确定要删除这个筛选方案吗？')) return;

    try {
      const { error } = await supabase.from('presets').delete().eq('id', id);
      if (!error) {
        setPresets(presets.filter(p => p.id !== id));
      }
    } catch (err) {
      console.error('Failed to delete preset', err);
    }
  };

  const applyPreset = (preset: FilterPreset) => {
    setFilters(preset.filters as any);
    if (preset.selectedIndicators) {
      setSelectedIndicators(preset.selectedIndicators);
    }
    setActivePresetId(preset.id);
  };

  const handleUpdatePreset = async (preset: FilterPreset, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`确定要将当前筛选和指标设置覆盖到方案 "${preset.name}" 吗？`)) return;

    try {
      const { error } = await supabase
        .from('presets')
        .update({
          filters: filters,
          selectedIndicators: selectedIndicators,
          timestamp: new Date().toISOString()
        })
        .eq('id', preset.id);

      if (!error) {
        setPresets(presets.map(p => p.id === preset.id ? { ...p, filters, selectedIndicators } as FilterPreset : p));
        alert('方案已成功更新');
      }
    } catch (err) {
      console.error('Failed to update preset', err);
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
        setPresets(presets.map(p => p.id === id ? { ...p, name: newName } : p));
      }
    } catch (err) {
      console.error('Failed to rename preset', err);
    } finally {
      setEditingPresetId(null);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        // Using raw: true to get the serial numbers for dates which is most reliable
        const rawData = XLSX.utils.sheet_to_json(ws, { raw: true }) as any[];

        const processed: DataRecord[] = rawData.map(row => {
          let monthStr = '';
          const rawDate = row['日期'];
          
          if (typeof rawDate === 'number') {
            // Excel Serial Date
            const dateObj = XLSX.SSF.parse_date_code(rawDate);
            monthStr = `${dateObj.y}-${dateObj.m.toString().padStart(2, '0')}`;
          } else if (rawDate) {
            const dateStr = String(rawDate);
            const match = dateStr.match(/(\d+)年(\d+)月/);
            const matchHyphen = dateStr.match(/(\d{4})[-/](\d{1,2})/);
            if (match) {
              monthStr = `${match[1]}-${match[2].padStart(2, '0')}`;
            } else if (matchHyphen) {
              monthStr = `${matchHyphen[1]}-${matchHyphen[2].padStart(2, '0')}`;
            }
          }

          const metrics: Record<string, number> = {};
          Object.keys(row).forEach(k => {
            if (!['产权口径', '管理口径', '业态', '项目名称', '日期', '项目编号'].includes(k)) {
              const val = row[k];
              metrics[k] = typeof val === 'number' ? val : (parseFloat(String(val).replace(/,/g, '')) || 0);
            }
          });

          return {
            month: monthStr,
            ownership: String(row['产权口径'] || '未分类'),
            management: String(row['管理口径'] || '未分类'),
            propertyType: String(row['业态'] || '未分类'),
            projectName: String(row['项目名称'] || '未分类'),
            metrics
          };
        }).filter(d => d.month.length >= 7);

        setSourceData(processed);
        
        // Extract Column Headers for Metrics (G1 to AR1) - KEEP ORDER
        if (rawData.length > 0) {
          const keys = Object.keys(rawData[0]);
          const dimensionKeys = ['产权口径', '管理口径', '业态', '项目名称', '日期', '项目编号'];
          const metricKeys = keys.filter(k => !dimensionKeys.includes(k));
          setCategories(metricKeys);
          setSelectedIndicators(metricKeys); // Default to all
        }

        const ms = [...new Set(processed.map(d => d.month))].sort().reverse();
        const owns = [...new Set(processed.map(d => d.ownership))];
        const mans = [...new Set(processed.map(d => d.management))];
        const pts = [...new Set(processed.map(d => d.propertyType))];
        const pns = [...new Set(processed.map(d => d.projectName))];

        setFilters({
          months: [],
          ownerships: owns,
          managements: mans,
          propertyTypes: pts,
          projectNames: pns
        });
        setSelectedMonth(ms[0] || '');

      } catch (err) {
        console.error('Import Error:', err);
        alert('文件导入失败，请检查文件格式。');
      } finally {
        setIsImporting(false);
      }
    };
    reader.readAsBinaryString(file);
  };

  const filteredData = useMemo(() => {
    return sourceData.filter(d => 
      filters.ownerships.includes(d.ownership) &&
      filters.managements.includes(d.management) &&
      filters.propertyTypes.includes(d.propertyType) &&
      filters.projectNames.includes(d.projectName)
    );
  }, [filters, sourceData]);

  const chartData = useMemo((): PerformanceItem[] => {
    if (!selectedMonth || !selectedMonth.includes('-')) return [];
    const [year, month] = selectedMonth.split('-').map(Number);
    
    const prevYear = year - 1;
    const isYTD = (d: DataRecord, y: number, m: number) => {
      const [dy, dm] = d.month.split('-').map(Number);
      return dy === y && dm <= m;
    };
    const isMTD = (d: DataRecord, y: number, m: number) => d.month === `${y}-${m.toString().padStart(2, '0')}`;
    const pm = month === 1 ? { y: year - 1, m: 12 } : { y: year, m: month - 1 };

    const calculateValue = (cat: string, metric: MetricKey): number | null => {
      const sum = (data: DataRecord[]) => data.reduce((acc, curr) => acc + (curr.metrics[cat] || 0), 0);
      
      const ytdData = filteredData.filter(d => isYTD(d, year, month));
      const lyData = filteredData.filter(d => isYTD(d, prevYear, month));
      const mtdData = filteredData.filter(d => isMTD(d, year, month));
      const preMonthData = filteredData.filter(d => isMTD(d, pm.y, pm.m));

      const ytd = sum(ytdData);
      const ly = sum(lyData);
      const mtd = sum(mtdData);
      const preMonth = sum(preMonthData);

      // If switching to YoY and there's no data for LAST year, we should return null or 0 to indicate invalid
      const hasLY = lyData.length > 0;
      const hasPM = preMonthData.length > 0;

      switch (metric) {
        case 'YTD': return ytd;
        case 'LY': return hasLY ? ly : 0;
        case 'YoYDiff': return hasLY ? (ytd - ly) : 0;
        case 'YoYPercent': return (hasLY && ly !== 0) ? (ytd - ly) / Math.abs(ly) : 0;
        case 'MTD': return mtd;
        case 'PreMonth': return hasPM ? preMonth : 0;
        case 'MoMDiff': return hasPM ? (mtd - preMonth) : 0;
        case 'MoMPercent': return (hasPM && preMonth !== 0) ? (mtd - preMonth) / Math.abs(preMonth) : 0;
        default: return 0;
      }
    };

    const isRate = selectedMetric.includes('Percent');
    const isYoY = selectedMetric.startsWith('YoY') || selectedMetric === 'LY';
    
    // Check if the current year has any data at all for the selected month
    const hasCurrentData = filteredData.some(d => isYTD(d, year, month));
    if (!hasCurrentData) return [];

    return categories
      .filter(cat => selectedIndicators.includes(cat))
      .map(cat => {
        const val = calculateValue(cat, selectedMetric);
        return {
          id: cat,
          category: cat,
          value: val ?? 0,
          displayValue: '', 
          isPercent: isRate
        };
      })
      .filter(item => {
        // If it's a YoY metric and there's no data for the previous year, 
        // and the value is 0, we can choose to hide it or keep it. 
        // User says it "should not exist".
        if (isYoY) {
          const lyExists = filteredData.some(d => isYTD(d, prevYear, month));
          if (!lyExists) return false;
        }
        return true;
      });
  }, [selectedMonth, selectedMetric, filteredData, categories, selectedIndicators]);

  const trendChartData = useMemo(() => {
    if (chartType !== 'line') return [];
    
    // All available months from sourceData, sorted ascending and >= 2025-01
    const allMonths = (Array.from(new Set(sourceData.map(d => d.month))) as string[])
      .filter(m => m >= '2025-01')
      .sort();
    
    return allMonths.map((monthStr: string) => {
      const [year, month] = monthStr.split('-').map(Number);
      const prevYear = year - 1;
      const pm = month === 1 ? { y: year - 1, m: 12 } : { y: year, m: month - 1 };

      const isYTD = (d: DataRecord, y: number, m: number) => {
        const [dy, dm] = d.month.split('-').map(Number);
        return dy === y && dm <= m;
      };
      const isMTD = (d: DataRecord, y: number, m: number) => d.month === `${y}-${m.toString().padStart(2, '0')}`;

      const sum = (data: DataRecord[], cat: string) => data.reduce((acc, curr) => acc + (curr.metrics[cat] || 0), 0);
      
      const calculateValue = (cat: string): number => {
        const mtdData = filteredData.filter(d => isMTD(d, year, month));
        return sum(mtdData, cat);
      };

      const point: any = { month: (monthStr as string).replace('-', '') };
      selectedIndicators.forEach(cat => {
        point[cat] = calculateValue(cat) ?? 0;
      });
      return point;
    });
  }, [chartType, sourceData, filteredData, selectedIndicators]);

  const exportToExcel = () => {
    if (categories.length === 0 || !selectedMonth || !selectedMonth.includes('-')) return;
    
    const [year, month] = selectedMonth.split('-').map(Number);
    const prevYear = year - 1;
    const pm = month === 1 ? { y: year - 1, m: 12 } : { y: year, m: month - 1 };

    const isYTD = (d: DataRecord, y: number, m: number) => {
      const [dy, dm] = d.month.split('-').map(Number);
      return dy === y && dm <= m;
    };
    const isMTD = (d: DataRecord, y: number, m: number) => d.month === `${y}-${m.toString().padStart(2, '0')}`;

    const ytdData = filteredData.filter(d => isYTD(d, year, month));
    const lyData = filteredData.filter(d => isYTD(d, prevYear, month));
    const mtdData = filteredData.filter(d => isMTD(d, year, month));
    const preMonthData = filteredData.filter(d => isMTD(d, pm.y, pm.m));

    const sum = (data: DataRecord[], cat: string) => data.reduce((acc, curr) => acc + (curr.metrics[cat] || 0), 0);

    const calculateForExport = (cat: string, metric: MetricKey): number => {
      const ytd = sum(ytdData, cat);
      const ly = sum(lyData, cat);
      const mtd = sum(mtdData, cat);
      const preMonth = sum(preMonthData, cat);

      const hasLY = lyData.length > 0;
      const hasPM = preMonthData.length > 0;

      switch (metric) {
        case 'YTD': return ytd;
        case 'LY': return hasLY ? ly : 0;
        case 'YoYDiff': return hasLY ? (ytd - ly) : 0;
        case 'YoYPercent': return (hasLY && ly !== 0) ? (ytd - ly) / Math.abs(ly) : 0;
        case 'MTD': return mtd;
        case 'PreMonth': return hasPM ? preMonth : 0;
        case 'MoMDiff': return hasPM ? (mtd - preMonth) : 0;
        case 'MoMPercent': return (hasPM && preMonth !== 0) ? (mtd - preMonth) / Math.abs(preMonth) : 0;
        default: return 0;
      }
    };

    // 1. 准备汇总数据 (包含所有指标)
    const metricKeys: MetricKey[] = ['YTD', 'LY', 'YoYDiff', 'YoYPercent', 'MTD', 'PreMonth', 'MoMDiff', 'MoMPercent'];
    const metricNames = ['本年累计', '去年同期', '同比增减额', '同比增减率', '当月发生额', '上月发生额', '环比增减额', '环比增减率'];

    const exportData = categories
      .filter(cat => selectedIndicators.includes(cat))
      .map(cat => {
        const row: Record<string, string | number> = { '指标名称': cat };
        metricKeys.forEach((key, index) => {
          const value = calculateForExport(cat, key);
          const isRate = key.includes('Percent');
          row[metricNames[index]] = isRate ? (value * 100).toFixed(2) + '%' : value.toLocaleString('zh-CN', { minimumFractionDigits: 2 });
        });
        return row;
      });

    // 2. 准备筛选条件汇总
    const filterSummary = [
      { '维度': '数据月份', '已选范围': selectedMonth },
      { '维度': '产权口径', '已选范围': filters.ownerships.length === sourceData.map(d => d.ownership).filter((v, i, a) => a.indexOf(v) === i).length ? '全部已选' : filters.ownerships.join(', ') },
      { '维度': '管理口径', '已选范围': filters.managements.length === sourceData.map(d => d.management).filter((v, i, a) => a.indexOf(v) === i).length ? '全部已选' : filters.managements.join(', ') },
      { '维度': '业务业态', '已选范围': filters.propertyTypes.length === sourceData.map(d => d.propertyType).filter((v, i, a) => a.indexOf(v) === i).length ? '全部已选' : filters.propertyTypes.join(', ') },
      { '维度': '项目名称', '已选范围': filters.projectNames.length === sourceData.map(d => d.projectName).filter((v, i, a) => a.indexOf(v) === i).length ? '全部已选' : filters.projectNames.join(', ') }
    ];

    const wb = XLSX.utils.book_new();
    
    // 添加第一个工作表：指标数据
    const wsData = XLSX.utils.json_to_sheet(exportData);
    XLSX.utils.book_append_sheet(wb, wsData, "分析结果");
    
    // 添加第二个工作表：筛选条件说明
    const wsFilters = XLSX.utils.json_to_sheet(filterSummary);
    XLSX.utils.book_append_sheet(wb, wsFilters, "筛选条件说明");

    XLSX.writeFile(wb, `BI_Export_${selectedMonth}_All_Metrics.xlsx`);
  };

  const exportChartToPDF = () => {
    checkAuth(() => window.print());
  };

  const renderDimensionTable = () => {
    if (!clickedIndicator) {
      return (
        <div className="bg-slate-50/50 rounded-3xl p-8 border-2 border-dashed border-slate-200 mt-6 text-center print:hidden transition-all hover:bg-slate-50">
          <p className="text-slate-500 font-bold flex items-center justify-center gap-3 text-sm">
            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse shadow-sm shadow-blue-300"></span>
            请在上方柱状图中点击任意数据柱，即可在此查看该指标的多维度下钻分析。
          </p>
        </div>
      );
    }

    const activeIndicator = clickedIndicator;
    if (!selectedMonth || !selectedMonth.includes('-')) return null;

    const dimKeyMap: Record<string, keyof DataRecord> = {
      '产权口径': 'ownership',
      '管理口径': 'management',
      '业务业态': 'propertyType',
      '项目名称': 'projectName'
    };
    const dimKey = dimKeyMap[tableDimension];
    
    // Get unique values for chosen dimension present in filtered data
    const dimValues = Array.from(new Set(filteredData.map(d => String(d[dimKey]))));
    
    const [year, month] = selectedMonth.split('-').map(Number);
    const prevYear = year - 1;
    const isYTD = (d: DataRecord, y: number, m: number) => {
      const [dy, dm] = d.month.split('-').map(Number);
      return dy === y && dm <= m;
    };
    const isMTD = (d: DataRecord, y: number, m: number) => d.month === `${y}-${m.toString().padStart(2, '0')}`;
    const pm = month === 1 ? { y: year - 1, m: 12 } : { y: year, m: month - 1 };

    const calculateForSlice = (dataSlice: DataRecord[]) => {
      const sum = (data: DataRecord[]) => data.reduce((acc, curr) => acc + (curr.metrics[activeIndicator] || 0), 0);
      const ytdData = dataSlice.filter(d => isYTD(d, year, month));
      const lyData = dataSlice.filter(d => isYTD(d, prevYear, month));
      const mtdData = dataSlice.filter(d => isMTD(d, year, month));
      const preMonthData = dataSlice.filter(d => isMTD(d, pm.y, pm.m));

      const ytd = sum(ytdData);
      const ly = sum(lyData);
      const mtd = sum(mtdData);
      const preMonth = sum(preMonthData);

      const hasLY = lyData.length > 0;
      const hasPM = preMonthData.length > 0;

      switch (selectedMetric) {
        case 'YTD': return ytd;
        case 'LY': return hasLY ? ly : 0;
        case 'YoYDiff': return hasLY ? (ytd - ly) : 0;
        case 'YoYPercent': return (hasLY && ly !== 0) ? (ytd - ly) / Math.abs(ly) : 0;
        case 'MTD': return mtd;
        case 'PreMonth': return hasPM ? preMonth : 0;
        case 'MoMDiff': return hasPM ? (mtd - preMonth) : 0;
        case 'MoMPercent': return (hasPM && preMonth !== 0) ? (mtd - preMonth) / Math.abs(preMonth) : 0;
        default: return 0;
      }
    };

    const rowData = dimValues.map(dv => {
      const slice = filteredData.filter(d => String(d[dimKey]) === dv);
      return { dimValue: dv, val: calculateForSlice(slice) };
    }).sort((a, b) => a.val - b.val);
    const totalVal = calculateForSlice(filteredData);
    
    const isRate = selectedMetric.includes('Percent');

    const exportTableToExcel = () => {
      checkAuth(() => {
        const exportData = rowData.map(r => ({
          [tableDimension]: r.dimValue,
          [`${activeIndicator} (${getMetricLabel(selectedMetric)})`]: isRate ? (r.val * 100).toFixed(2) + '%' : r.val
        }));
        
        exportData.push({
          [tableDimension]: '合计',
          [`${activeIndicator} (${getMetricLabel(selectedMetric)})`]: isRate ? (totalVal * 100).toFixed(2) + '%' : totalVal
        });

        const filterSummary = [
          { '维度': '数据月份', '已选范围': selectedMonth },
          { '维度': '产权口径', '已选范围': filters.ownerships.length === sourceData.map(d => d.ownership).filter((v, i, a) => a.indexOf(v) === i).length ? '全部已选' : filters.ownerships.join(', ') },
          { '维度': '管理口径', '已选范围': filters.managements.length === sourceData.map(d => d.management).filter((v, i, a) => a.indexOf(v) === i).length ? '全部已选' : filters.managements.join(', ') },
          { '维度': '业务业态', '已选范围': filters.propertyTypes.length === sourceData.map(d => d.propertyType).filter((v, i, a) => a.indexOf(v) === i).length ? '全部已选' : filters.propertyTypes.join(', ') },
          { '维度': '项目名称', '已选范围': filters.projectNames.length === sourceData.map(d => d.projectName).filter((v, i, a) => a.indexOf(v) === i).length ? '全部已选' : filters.projectNames.join(', ') }
        ];

        const wb = XLSX.utils.book_new();
        const wsData = XLSX.utils.json_to_sheet(exportData);
        XLSX.utils.book_append_sheet(wb, wsData, "维度拆解");

        const wsFilters = XLSX.utils.json_to_sheet(filterSummary);
        XLSX.utils.book_append_sheet(wb, wsFilters, "数据说明");

        XLSX.writeFile(wb, `BI_Dimension_${activeIndicator}_${tableDimension}.xlsx`);
      });
    };

    const scrollTable = (direction: 'start' | 'end') => {
      if (dimTableScrollRef.current) {
        const scrollWidth = dimTableScrollRef.current.scrollWidth;
        dimTableScrollRef.current.scrollTo({ left: direction === 'start' ? 0 : scrollWidth, behavior: 'smooth' });
      }
    };

    return (
      <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 mt-6 print:break-before-auto">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
          <div className="flex items-center gap-3">
            <div className="w-1 h-8 bg-indigo-500 rounded-full"></div>
            <h3 className="text-lg font-black text-slate-800">
              {activeIndicator} <span className="text-slate-400 text-sm font-bold">({getMetricLabel(selectedMetric)}) 维度拆解</span>
            </h3>
          </div>
          
          <div className="flex flex-col xl:flex-row gap-3 xl:items-center">
            <div className="flex bg-slate-100 p-1 rounded-xl overflow-x-auto">
              {['产权口径', '管理口径', '业务业态', '项目名称'].map(dim => (
                <button
                  key={dim}
                  onClick={() => setTableDimension(dim as any)}
                  className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                    tableDimension === dim ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {dim}
                </button>
              ))}
            </div>
            
            <div className="flex items-center gap-2">
              <button 
                onClick={() => scrollTable('start')} 
                className="px-3 py-1.5 bg-slate-50 text-slate-600 rounded-lg text-xs font-bold hover:bg-slate-100 border border-slate-200 transition-colors active:scale-95"
              >
                跳到开头
              </button>
              <button 
                onClick={() => scrollTable('end')} 
                className="px-3 py-1.5 bg-slate-50 text-slate-600 rounded-lg text-xs font-bold hover:bg-slate-100 border border-slate-200 transition-colors active:scale-95"
              >
                跳到结尾
              </button>
              <button 
                onClick={exportTableToExcel} 
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-600 rounded-lg text-xs font-bold hover:bg-emerald-100 border border-emerald-200 transition-colors active:scale-95"
              >
                <Download className="w-3.5 h-3.5" />
                导出 Excel
              </button>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-100 scroll-smooth" ref={dimTableScrollRef}>
          <table className="w-full text-left border-collapse">
            <thead>
              <tr>
                <th className="p-4 border-b border-slate-200 text-slate-500 font-bold text-xs bg-slate-50 whitespace-nowrap">指标 \ 维度</th>
                {rowData.map(r => (
                  <th key={r.dimValue} className="p-4 border-b border-slate-200 text-slate-800 font-black text-sm whitespace-nowrap bg-slate-50">
                    {r.dimValue}
                  </th>
                ))}
                <th className="p-4 border-b border-indigo-200 text-indigo-700 font-black text-sm bg-indigo-50/50 whitespace-nowrap">
                  合计
                </th>
              </tr>
            </thead>
            <tbody>
              <tr className="hover:bg-slate-50 transition-colors">
                <td className="p-4 border-b border-slate-100 text-slate-700 font-bold text-sm whitespace-nowrap">
                  {getMetricLabel(selectedMetric)}
                </td>
                {rowData.map(r => (
                  <td key={r.dimValue} className="p-4 border-b border-slate-100 text-slate-600 font-medium text-sm whitespace-nowrap">
                    {formatNumber(r.val, isRate, isIntegerMode)}
                  </td>
                ))}
                <td className="p-4 border-b border-indigo-100 text-indigo-700 font-bold text-sm bg-indigo-50/30 whitespace-nowrap">
                  {formatNumber(totalVal, isRate, isIntegerMode)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  if (view === 'admin') {
    return <AdminPanel onBack={() => setView('dashboard')} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900">
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between sticky top-0 z-50 shadow-sm print:hidden">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 p-2 rounded-lg shadow-lg shadow-blue-200">
            <FileSpreadsheet className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-800 tracking-tight">企业数据 BI 仪表盘</h1>
            <p className="text-[10px] uppercase font-bold text-slate-400 tracking-widest text-emerald-500">
              {sourceData.length > 0 ? 'Data Loaded' : 'Waiting for Data Import'}
            </p>
          </div>
          <button
            onClick={() => setIsHelpModalOpen(true)}
            className="ml-4 flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-xl text-xs font-bold hover:bg-blue-100 transition-colors active:scale-95"
          >
            <BookOpen className="w-4 h-4" />
            <span className="hidden sm:inline">使用指南</span>
          </button>
        </div>
        
        <div className="flex items-center gap-4">
          {sourceData.length > 0 && (
            <button 
              onClick={() => {
                const ms = [...new Set(sourceData.map(d => d.month))].sort().reverse();
                setFilters({
                  months: [],
                  ownerships: [...new Set(sourceData.map(d => d.ownership))],
                  managements: [...new Set(sourceData.map(d => d.management))],
                  propertyTypes: [...new Set(sourceData.map(d => d.propertyType))],
                  projectNames: [...new Set(sourceData.map(d => d.projectName))]
                });
                setSelectedIndicators(categories);
                setSelectedMonth(ms[0] || '');
                setActivePresetId(null);
              }}
              className="flex items-center gap-2 bg-slate-100 text-slate-600 px-4 py-2 rounded-xl text-sm font-bold hover:bg-slate-200 transition-all active:scale-95"
            >
              <RotateCcw className="w-4 h-4" />
              一键重置
            </button>
          )}

          <div className="h-8 w-px bg-slate-200 mx-2"></div>

          <div className="flex bg-slate-100 p-1 rounded-xl mr-2">
            <button
              onClick={() => setChartType('bar')}
              className={cn(
                "px-3 py-1.5 rounded-lg text-sm font-bold transition-all flex items-center gap-1.5",
                chartType === 'bar' ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
              )}
            >
              <BarChart2 className="w-4 h-4" />
              <span className="hidden sm:inline">柱状图</span>
            </button>
            <button
              onClick={() => setChartType('line')}
              className={cn(
                "px-3 py-1.5 rounded-lg text-sm font-bold transition-all flex items-center gap-1.5",
                chartType === 'line' ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
              )}
            >
              <TrendingUp className="w-4 h-4" />
              <span className="hidden sm:inline">趋势图</span>
            </button>
            <button
              onClick={() => {
                setChartType('pie');
                if (!['YTD', 'LY', 'MTD', 'PreMonth'].includes(selectedMetric)) {
                  setSelectedMetric('YTD');
                }
              }}
              className={cn(
                "px-3 py-1.5 rounded-lg text-sm font-bold transition-all flex items-center gap-1.5",
                chartType === 'pie' ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
              )}
            >
              <PieChartIcon className="w-4 h-4" />
              <span className="hidden sm:inline">饼图</span>
            </button>
            <button
              onClick={() => setChartType('table')}
              className={cn(
                "px-3 py-1.5 rounded-lg text-sm font-bold transition-all flex items-center gap-1.5",
                chartType === 'table' ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
              )}
            >
              <TableIcon className="w-4 h-4" />
              <span className="hidden sm:inline">数据表</span>
            </button>
          </div>

          <div className="flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-full border border-slate-200">
            <Calendar className="w-4 h-4 text-slate-400" />
            <select 
              className="bg-transparent text-sm font-bold outline-none cursor-pointer"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              disabled={sourceData.length === 0}
            >
              {[...new Set(sourceData.map(d => d.month))].sort().reverse().map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileUpload} 
            accept=".xlsx,.xls" 
            className="hidden" 
          />
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-blue-600 transition-all shadow-md active:scale-95 disabled:opacity-50"
            disabled={isImporting}
          >
            {isImporting ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : <Upload className="w-4 h-4" />}
            {sourceData.length > 0 ? '重新导入数据' : '导入 Excel 数据'}
          </button>



          {authState.isLoggedIn ? (
            <div className="flex items-center gap-3 bg-slate-50 pl-2 pr-4 py-1.5 rounded-2xl border border-slate-200">
              <img src={authState.user?.avatar} alt="avatar" className="w-7 h-7 rounded-full border border-white shadow-sm" />
              <div className="flex flex-col">
                <span className="text-xs font-black text-slate-700 leading-tight">{authState.user?.nickname}</span>
                {authState.user?.username === 'admin' && (
                  <button 
                    onClick={() => setView('admin')}
                    className="text-[9px] font-black text-blue-600 flex items-center gap-0.5 hover:underline"
                  >
                    <ShieldCheck className="w-2.5 h-2.5" />
                    进入后台
                  </button>
                )}
              </div>
              <button 
                onClick={handleLogout}
                className="ml-2 text-slate-400 hover:text-red-500 transition-colors"
                title="退出登录"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button 
              onClick={() => setIsAuthModalOpen(true)}
              className="flex items-center gap-2 bg-emerald-50 text-emerald-600 px-4 py-2 rounded-xl text-sm font-black hover:bg-emerald-100 transition-all active:scale-95 border border-emerald-100"
            >
              <LogIn className="w-4 h-4" />
              登录
            </button>
          )}
        </div>
      </header>

      <main className="flex-1 p-6 space-y-6 max-w-[1600px] mx-auto w-full">
        {sourceData.length === 0 ? (
          <div className="flex flex-col items-center justify-center min-h-[60vh] bg-white rounded-[2.5rem] border-2 border-dashed border-slate-200 p-12 text-center">
            <div className="p-8 bg-blue-50 rounded-full mb-6">
              <Upload className="w-16 h-16 text-blue-600 animate-bounce" />
            </div>
            <h2 className="text-3xl font-black text-slate-900 mb-4">开始您的数据分析</h2>
            <p className="text-slate-500 max-w-md mx-auto mb-8 font-medium leading-relaxed">
              请上传您的 “项目利润表” Excel 文件。系统将动态解析 38 个关键指标并为您生成实时可视化报表。数据仅在浏览器本地处理，确保您的数据安全性。
            </p>
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="bg-blue-600 text-white px-10 py-5 rounded-2xl font-black text-lg hover:bg-slate-900 transition-all shadow-2xl shadow-blue-200 active:scale-95"
            >
              立即导入数据表
            </button>
          </div>
        ) : (
          <>
            <section className="bg-white rounded-2xl border border-slate-200 shadow-sm sticky top-[73px] z-40 print:hidden">
              <div 
                className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-50 transition-colors"
                onClick={() => setIsSlicerVisible(!isSlicerVisible)}
              >
                <div className="flex items-center gap-2">
                  <Filter className="w-5 h-5 text-blue-600" />
                  <h3 className="font-bold text-slate-800 uppercase tracking-wider text-sm">维度切片器</h3>
                </div>
                {isSlicerVisible ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
              </div>
              
              {isSlicerVisible && (
                <div className="p-4 pt-0 border-t border-slate-50">
                  {/* 方案管理工具栏 */}
                  <div className="flex items-center justify-between py-3 border-b border-slate-50 mb-4">
                    <div className="flex items-center gap-3 flex-wrap">
                      <div className="flex items-center gap-1.5 text-slate-400 mr-2">
                        <Bookmark className="w-3.5 h-3.5" />
                        <span className="text-[11px] font-bold uppercase tracking-wider">预设方案</span>
                      </div>
                      
                      {presets.map(preset => (
                        <div 
                          key={preset.id}
                          onClick={() => applyPreset(preset)}
                          className={cn(
                            "group flex items-center gap-2 px-3 py-1.5 bg-slate-50 hover:bg-blue-50 border border-slate-200 hover:border-blue-200 rounded-xl cursor-pointer transition-all animate-in fade-in slide-in-from-left-2",
                            editingPresetId === preset.id && "bg-white border-blue-500 ring-2 ring-blue-100",
                            activePresetId === preset.id && "bg-blue-100 border-blue-400 ring-1 ring-blue-200"
                          )}
                        >
                          {editingPresetId === preset.id ? (
                            <input
                              autoFocus
                              className="text-[11px] font-bold bg-transparent outline-none w-24"
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
                              <span className="text-[11px] font-bold text-slate-600 group-hover:text-blue-600">{preset.name}</span>
                              <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity ml-1">
                                <button 
                                  onClick={(e) => { e.stopPropagation(); setEditingPresetId(preset.id); }}
                                  title="重命名"
                                  className="p-1 hover:bg-blue-100 rounded text-slate-400 hover:text-blue-600 transition-all"
                                >
                                  <Edit2 className="w-3 h-3" />
                                </button>
                                <button 
                                  onClick={(e) => handleUpdatePreset(preset, e)}
                                  title="覆盖更新当前设置"
                                  className="p-1 hover:bg-emerald-100 rounded text-slate-400 hover:text-emerald-600 transition-all"
                                >
                                  <RefreshCcw className="w-3 h-3" />
                                </button>
                                <button 
                                  onClick={(e) => handleDeletePreset(preset.id, e)}
                                  title="删除"
                                  className="p-1 hover:bg-red-100 rounded text-slate-400 hover:text-red-500 transition-all"
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
                            placeholder="方案名称..."
                            value={newPresetName}
                            onChange={(e) => setNewPresetName(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSavePreset()}
                            className="text-[11px] font-bold px-3 py-1 bg-white border-2 border-blue-500 rounded-lg outline-none w-32"
                          />
                          <button onClick={handleSavePreset} className="p-1 bg-blue-600 text-white rounded-md hover:bg-blue-700">
                            <Plus className="w-4 h-4" />
                          </button>
                          <button onClick={() => setIsSavingPreset(false)} className="p-1 bg-slate-100 text-slate-500 rounded-md hover:bg-slate-200">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <button 
                          onClick={() => setIsSavingPreset(true)}
                          className="flex items-center gap-1.5 px-3 py-1 text-blue-600 font-bold hover:bg-blue-50 rounded-lg border border-dashed border-blue-200 transition-all"
                        >
                          <Save className="w-3.5 h-3.5" />
                          <span className="text-[11px]">保存当前配置</span>
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
                    <Slicer 
                      label="产权口径" 
                      options={[...new Set(sourceData.filter(d => 
                        filters.managements.includes(d.management) &&
                        filters.propertyTypes.includes(d.propertyType) &&
                        filters.projectNames.includes(d.projectName)
                      ).map(d => d.ownership))]} 
                      selected={filters.ownerships} 
                      onChange={(val) => { setFilters({...filters, ownerships: val}); setActivePresetId(null); }} 
                    />
                    <Slicer 
                      label="管理口径" 
                      options={[...new Set(sourceData.filter(d => 
                        filters.ownerships.includes(d.ownership) &&
                        filters.propertyTypes.includes(d.propertyType) &&
                        filters.projectNames.includes(d.projectName)
                      ).map(d => d.management))]} 
                      selected={filters.managements} 
                      onChange={(val) => { setFilters({...filters, managements: val}); setActivePresetId(null); }} 
                    />
                    <Slicer 
                      label="业务业态" 
                      options={[...new Set(sourceData.filter(d => 
                        filters.ownerships.includes(d.ownership) &&
                        filters.managements.includes(d.management) &&
                        filters.projectNames.includes(d.projectName)
                      ).map(d => d.propertyType))]} 
                      selected={filters.propertyTypes} 
                      onChange={(val) => { setFilters({...filters, propertyTypes: val}); setActivePresetId(null); }} 
                    />
                    <Slicer 
                      label="项目名称" 
                      options={[...new Set(sourceData.filter(d => 
                        filters.ownerships.includes(d.ownership) &&
                        filters.managements.includes(d.management) &&
                        filters.propertyTypes.includes(d.propertyType)
                      ).map(d => d.projectName))]} 
                      selected={filters.projectNames} 
                      onChange={(val) => { setFilters({...filters, projectNames: val}); setActivePresetId(null); }} 
                      showSearch 
                    />
                  </div>
                </div>
              )}
            </section>

            <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div 
                className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-50 transition-colors"
                onClick={() => setIsIndicatorVisible(!isIndicatorVisible)}
              >
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4 text-emerald-600" />
                  <h4 className="font-bold text-slate-700 text-sm">选择显示指标</h4>
                </div>
                <div className="flex items-center gap-4">
                  {isIndicatorVisible && (
                    <div className="flex gap-2 mr-2">
                      <button 
                        onClick={(e) => { e.stopPropagation(); setSelectedIndicators(categories); setActivePresetId(null); }}
                        className="text-[10px] font-bold text-blue-600 hover:underline"
                      >
                        全选
                      </button>
                      <button 
                        onClick={(e) => { e.stopPropagation(); setSelectedIndicators([]); setActivePresetId(null); }}
                        className="text-[10px] font-bold text-slate-400 hover:underline"
                      >
                        清空
                      </button>
                    </div>
                  )}
                  {isIndicatorVisible ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
                </div>
              </div>

              {isIndicatorVisible && (
                <div className="p-4 pt-0 border-t border-slate-50">
                  <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2 mt-4">
                    {categories.map(indicator => (
                      <label 
                        key={indicator} 
                        className={cn(
                          "flex items-center gap-2 p-2 rounded-lg border transition-all cursor-pointer select-none",
                          selectedIndicators.includes(indicator) 
                            ? "bg-emerald-50 border-emerald-200 ring-1 ring-emerald-200" 
                            : "bg-white border-slate-200 hover:border-slate-300"
                        )}
                      >
                        <input 
                          type="checkbox" 
                          className="hidden"
                          checked={selectedIndicators.includes(indicator)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedIndicators([...selectedIndicators, indicator]);
                            } else {
                              setSelectedIndicators(selectedIndicators.filter(i => i !== indicator));
                            }
                            setActivePresetId(null);
                          }}
                        />
                        <div className={cn(
                          "w-3 h-3 rounded-sm border flex items-center justify-center",
                          selectedIndicators.includes(indicator) ? "bg-emerald-500 border-emerald-500" : "bg-white border-slate-300"
                        )}>
                          {selectedIndicators.includes(indicator) && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                        </div>
                        <span className={cn(
                          "text-[11px] font-bold truncate",
                          selectedIndicators.includes(indicator) ? "text-emerald-700" : "text-slate-500"
                        )}>
                          {indicator}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </section>

            {(chartType === 'bar' || chartType === 'pie') && (
              <div className="print:hidden">
                <MetricSelector 
                  selected={selectedMetric} 
                  onChange={setSelectedMetric} 
                  allowedKeys={chartType === 'pie' ? ['YTD', 'LY', 'MTD', 'PreMonth'] : undefined}
                />
              </div>
            )}

            <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100" id="printable-chart" ref={chartRef}>
              {chartType === 'bar' && (
                <PerformanceChart 
                  data={chartData} 
                  title={`${selectedMonth} 多维指标 ${getMetricLabel(selectedMetric)}`}
                  isIntegerMode={isIntegerMode}
                  setIsIntegerMode={setIsIntegerMode}
                  onBarClick={setClickedIndicator}
                />
              )}
              {chartType === 'line' && (
                <TrendChart
                  data={trendChartData}
                  indicators={selectedIndicators}
                  title={`单月指标趋势`}
                  isIntegerMode={isIntegerMode}
                  setIsIntegerMode={setIsIntegerMode}
                  onLineClick={setClickedIndicator}
                  isRate={false}
                />
              )}
              {chartType === 'pie' && (
                <PieChartWidget
                  data={chartData}
                  title={`指标分布 ${getMetricLabel(selectedMetric)}`}
                  isIntegerMode={isIntegerMode}
                  setIsIntegerMode={setIsIntegerMode}
                  onPieClick={setClickedIndicator}
                  isRate={selectedMetric.includes('Percent')}
                />
              )}
              {chartType === 'table' && (
                <MultiDimTable 
                  data={filteredData}
                  categories={categories}
                  selectedMonth={selectedMonth}
                  isIntegerMode={isIntegerMode}
                />
              )}
              <div className={cn("flex justify-end gap-2 mt-2 pt-4 border-t border-slate-100 print:hidden", chartType === 'table' && "hidden")}>
                <button 
                  onClick={exportChartToPDF}
                  className="flex items-center gap-2 bg-blue-50 text-blue-600 px-4 py-2 rounded-xl text-sm font-bold hover:bg-blue-100 transition-all active:scale-95 border border-blue-100"
                >
                  <Camera className="w-4 h-4" />
                  保存 PDF
                </button>
                <button 
                  onClick={() => checkAuth(exportToExcel)}
                  className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-emerald-700 transition-all shadow-md active:scale-95"
                >
                  <Download className="w-4 h-4" />
                  导出报表
                </button>
              </div>
            </div>

            {renderDimensionTable()}

            {filteredData.length === 0 && (
              <div className="bg-amber-50 border border-amber-200 p-8 rounded-2xl text-center">
                <AlertCircle className="w-8 h-8 text-amber-600 mx-auto mb-4" />
                <h3 className="text-lg font-bold text-amber-900">未找到匹配数据</h3>
                <p className="text-amber-700">请尝试调整切片器选项以查看结果。</p>
              </div>
            )}

            {sourceData.length > 0 && (
              <CommentsSection 
                authState={authState}
                selectedMonth={selectedMonth}
                filteredData={filteredData}
                onAuthRequired={() => {
                  setPendingAction(null);
                  setIsAuthModalOpen(true);
                }}
              />
            )}
          </>
        )}
      </main>

      <footer className="bg-white border-t border-slate-200 p-4 text-center mt-auto">
        <p className="text-xs text-slate-400 font-bold tracking-widest uppercase">
          Confidential Data Analysis System • No Cloud Storage
        </p>
      </footer>

      {/* Floating Feedback Button */}
      <button 
        onClick={() => checkAuth(() => setIsFeedbackModalOpen(true))}
        className="fixed bottom-8 right-8 w-14 h-14 bg-slate-900 text-white rounded-2xl shadow-2xl flex items-center justify-center hover:bg-blue-600 hover:scale-110 transition-all group z-[90] active:scale-95"
        title="意见反馈"
      >
        <MessageSquareMore className="w-6 h-6 group-hover:rotate-12 transition-transform" />
        <div className="absolute right-full mr-4 bg-slate-900 text-white px-3 py-1.5 rounded-lg text-xs font-bold opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
          反馈建议
        </div>
      </button>

      {/* Modals */}
      {isAuthModalOpen && <AuthModal isOpen={isAuthModalOpen} onClose={() => { setIsAuthModalOpen(false); setPendingAction(null); }} onLoginSuccess={handleLoginSuccess} />}
      {isFeedbackModalOpen && <FeedbackModal isOpen={isFeedbackModalOpen} onClose={() => setIsFeedbackModalOpen(false)} />}
      {isHelpModalOpen && <HelpModal onClose={() => setIsHelpModalOpen(false)} />}
    </div>
  );
};
