import React, { useState, useMemo, useRef, useEffect } from 'react';
import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import {
  FilterState,
  MetricKey,
  PerformanceItem,
  DataRecord,
  EnrichedRecord,
  AuthState,
  User,
  FilterPreset,
  ProjectInfo,
  MetricMetadata,
  TimeGroupMetadata
} from '../types';
import { Slicer } from './Slicer';
import { MetricSelector } from './MetricSelector';
import { PerformanceChart } from './PerformanceChart';
import { TrendChart } from './TrendChart';
import { PieChartWidget } from './PieChartWidget';
import { CommentsSection } from './CommentsSection';
import { AuthModal } from './AuthModal';
import { FeedbackModal } from './FeedbackModal';
import { AdminPanel } from './AdminPanel';
import { MultiDimTable } from './MultiDimTable';
import { Search, Filter, Calendar, Upload, FileSpreadsheet, AlertCircle, HelpCircle, RotateCcw, Check, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Download, Camera, LogIn, User as UserIcon, LogOut, MessageSquareMore, ShieldCheck, Save, Bookmark, Trash2, Plus, X, Edit2, RefreshCcw, BookOpen, BarChart2, TrendingUp, PieChart as PieChartIcon, Table as TableIcon, GripVertical } from 'lucide-react';
import { cn, formatNumber, isMoneyMetric, isRateMetric } from '../lib/utils';
import { supabase } from '../lib/supabase';
import { DEFAULT_METRICS_METADATA, DEFAULT_TIME_GROUPS, DEFAULT_CATEGORIES_ORDER, MAIN_INDICATORS, OPERATING_METRICS, THREE_YEAR_BENEFIT_METRICS, BUSINESS_METRICS, BUDGET_METRICS, TIME_SERIES_ALLOWED_METRICS } from '../constants/internalData';

export const Dashboard: React.FC = () => {
  // --- States ---
  const [sourceData, setSourceData] = useState<EnrichedRecord[]>([]);
  const [projectInfoMap, setProjectInfoMap] = useState<Record<string, ProjectInfo>>({});
  const [metricMetadata, setMetricMetadata] = useState<MetricMetadata[]>(DEFAULT_METRICS_METADATA);
  const [timeGroupMetadata, setTimeGroupMetadata] = useState<TimeGroupMetadata[]>(DEFAULT_TIME_GROUPS);
  const [categoriesOrder, setCategoriesOrder] = useState<string[]>(DEFAULT_CATEGORIES_ORDER);

  const [categories, setCategories] = useState<string[]>(DEFAULT_CATEGORIES_ORDER);
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [selectedMetric, setSelectedMetric] = useState<string>('本年累计');
  const [isImporting, setIsImporting] = useState(false);
  const [selectedIndicators, setSelectedIndicators] = useState<string[]>(['收入YTD', '利润YTD']);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [isSlicerVisible, setIsSlicerVisible] = useState(true);
  const [isIndicatorVisible, setIsIndicatorVisible] = useState(true);
  const [authState, setAuthState] = useState<AuthState>({ isLoggedIn: false, user: null });
  const [view, setView] = useState<'dashboard' | 'admin'>('dashboard');
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false);

  const [isIntegerMode, setIsIntegerMode] = useState(false);
  const [exportProgress, setExportProgress] = useState<{ active: boolean; status: string; percent: number } | null>(null);
  const [clickedIndicator, setClickedIndicator] = useState<string | null>(null);
  const [tableDimension, setTableDimension] = useState<'产权口径' | '管理口径' | '业务业态' | '项目名称'>('业务业态');
  const [chartType, setChartType] = useState<'bar' | 'line' | 'pie' | 'table'>('bar');
  const [activePresetId, setActivePresetId] = useState<string | null>(null);
  const [isMultiDimTableVisible, setIsMultiDimTableVisible] = useState(true);

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragEnter = (index: number) => {
    if (draggedIndex === null || draggedIndex === index) return;
    const updated = [...selectedIndicators];
    const [draggedItem] = updated.splice(draggedIndex, 1);
    updated.splice(index, 0, draggedItem);
    setSelectedIndicators(updated);
    setDraggedIndex(index);
    setActivePresetId(null);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  const getMetricLabel = (key: string) => {
    const group = timeGroupMetadata.find(g => g.name === key);
    return group ? group.name : key;
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


  const [filters, setFilters] = useState<FilterState>({
    months: [],
    ownerships: [],
    managements: [],
    propertyTypes: [],
    secondaryPropertyTypes: [],
    projectNames: [],
    isKeyProjects: [],
    isExistingProjects: [],
    reportCalibers: [],
    projectShortNames: [],
    projectNos: []
  });

  const handleResetFilters = () => {
    const months = [...new Set(sourceData.map(d => d.month))].sort().reverse();
    setFilters({
      months: [],
      ownerships: [...new Set(sourceData.map(d => d.ownership))],
      managements: [...new Set(sourceData.map(d => d.management))],
      propertyTypes: [...new Set(sourceData.map(d => d.propertyType))],
      secondaryPropertyTypes: [...new Set(sourceData.map(d => d.secondaryPropertyType))],
      projectNames: [...new Set(sourceData.map(d => d.projectName))],
      isKeyProjects: [...new Set(sourceData.map(d => d.isKeyProject))],
      isExistingProjects: [...new Set(sourceData.map(d => d.isExistingProject))],
      reportCalibers: [...new Set(sourceData.map(d => d.reportCaliber))],
      projectShortNames: [...new Set(sourceData.map(d => d.projectShortName))],
      projectNos: [...new Set(sourceData.map(d => d.projectNo))]
    });
    setActivePresetId(null);
  };

  const slicerOptions = useMemo(() => {
    const getOptions = (dim: keyof EnrichedRecord, excludedDim: keyof FilterState) => {
      const filtered = sourceData.filter(d => {
        return (
          (excludedDim === 'ownerships' || (filters.ownerships.length === 0 || filters.ownerships.includes(d.ownership))) &&
          (excludedDim === 'managements' || (filters.managements.length === 0 || filters.managements.includes(d.management))) &&
          (excludedDim === 'propertyTypes' || (filters.propertyTypes.length === 0 || filters.propertyTypes.includes(d.propertyType))) &&
          (excludedDim === 'secondaryPropertyTypes' || (filters.secondaryPropertyTypes.length === 0 || filters.secondaryPropertyTypes.includes(d.secondaryPropertyType))) &&
          (excludedDim === 'projectNames' || (filters.projectNames.length === 0 || filters.projectNames.includes(d.projectName))) &&
          (excludedDim === 'isKeyProjects' || (filters.isKeyProjects.length === 0 || filters.isKeyProjects.includes(d.isKeyProject))) &&
          (excludedDim === 'isExistingProjects' || (filters.isExistingProjects.length === 0 || filters.isExistingProjects.includes(d.isExistingProject))) &&
          (excludedDim === 'reportCalibers' || (filters.reportCalibers.length === 0 || filters.reportCalibers.includes(d.reportCaliber))) &&
          (excludedDim === 'projectShortNames' || (filters.projectShortNames.length === 0 || filters.projectShortNames.includes(d.projectShortName))) &&
          (excludedDim === 'projectNos' || (filters.projectNos.length === 0 || (filters.projectNos || []).includes(d.projectNo)))
        );
      });
      return [...new Set(filtered.map(d => String(d[dim])))].sort();
    };

    return {
      ownerships: getOptions('ownership', 'ownerships'),
      managements: getOptions('management', 'managements'),
      propertyTypes: getOptions('propertyType', 'propertyTypes'),
      secondaryPropertyTypes: getOptions('secondaryPropertyType', 'secondaryPropertyTypes'),
      projectNames: getOptions('projectName', 'projectNames'),
      isKeyProjects: getOptions('isKeyProject', 'isKeyProjects'),
      isExistingProjects: getOptions('isExistingProject', 'isExistingProjects'),
      reportCalibers: getOptions('reportCaliber', 'reportCalibers'),
      projectShortNames: getOptions('projectShortName', 'projectShortNames'),
      projectNos: getOptions('projectNo', 'projectNos')
    };
  }, [sourceData, filters]);

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
        // Filter out table presets from the main dashboard presets
        setPresets(data.filter((p: any) => !p.filters?.isTablePreset));
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
    setFilters({
      projectNos: [],
      ...preset.filters
    } as any);
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

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsImporting(true);

    let tempProjectInfo: Record<string, ProjectInfo> = { ...projectInfoMap };
    let allFactRecords: DataRecord[] = [];
    let staticProjectMetrics: Record<string, Record<string, number>> = {};
    let currentOrder = [...categoriesOrder];
    try {
      console.log('Starting file upload...', files.length, 'files');
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const data = await file.arrayBuffer();
        const workbook = XLSX.read(data, { type: 'array' });

        workbook.SheetNames.forEach(sheetName => {
          const ws = workbook.Sheets[sheetName];
          const cleanSheetName = sheetName.trim().toLowerCase();
          const EXCLUDED_KEYS = ['项目编号', '日期', '项目名称', '项目代码', '项目ID', 'ProjectNo', '月份', '时间', 'Period', 'Name'];

          // Branch 1: Project Bridge/Info Sheet
          if (cleanSheetName.includes('项目基本信息') || cleanSheetName.includes('项目桥表') || cleanSheetName.includes('bridge')) {
            const json = XLSX.utils.sheet_to_json(ws, { raw: true }) as any[];
            json.forEach(row => {
              const pNo = String(row['项目编号'] || row['项目代码'] || row['项目ID'] || row['ProjectNo'] || '');
              if (pNo) {
                tempProjectInfo[pNo] = {
                  projectNo: pNo,
                  projectName: String(row['项目名称'] || row['Name'] || ''),
                  ownership: String(row['产权口径'] || row['Ownership'] || ''),
                  management: String(row['管理口径'] || row['Management'] || ''),
                  propertyType: String(row['业态'] || row['Type'] || ''),
                  secondaryPropertyType: String(row['二级业态'] || ''),
                  isKeyProject: String(row['重点项目'] || row['Key'] || '否'),
                  isExistingProject: String(row['现有项目'] || '否'),
                  reportCaliber: String(row['报表口径'] || ''),
                  projectShortName: String(row['项目简称'] || '')
                };
              }
            });
          }

          // Branch 2: Operating Data Sheet — defines core 38-column slicer order
          else if (cleanSheetName.includes('经营数据')) {
            const dataRows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];

            // Find the actual header row
            let headerIdx = 0;
            for (let r = 0; r < Math.min(10, dataRows.length); r++) {
              if (dataRows[r]?.includes('项目编号') || dataRows[r]?.includes('日期')) {
                headerIdx = r;
                break;
              }
            }

            const headersRow = dataRows[headerIdx] || [];
            const dateColIdx = headersRow.indexOf('日期');
            const projectNoColIdx = headersRow.indexOf('项目编号');

            // Extract strictly the core metric columns (C1:AN1 area): no __EMPTY, no dimension keys
            const coreMetricHeaders: string[] = headersRow
              .map(h => {
                let cleanH = String(h || '').trim().replace(/R$/, '').replace(/^目标[-－\s]*/, '目标');
                if (cleanH.includes('百元收入')) {
                  cleanH = cleanH.replace('百元收入', '') + '占收比';
                }
                return cleanH;
              })
              .filter(h => h && !h.startsWith('__EMPTY') && !EXCLUDED_KEYS.includes(h));

            // Set as definitive slicer order
            currentOrder = [
              ...coreMetricHeaders,
              ...currentOrder.filter(h => !coreMetricHeaders.includes(h))
            ];
            setCategoriesOrder(currentOrder);

            // Parse data rows
            const factRecords: DataRecord[] = dataRows.slice(headerIdx + 1).map(row => {
              const projectNo = String(row[projectNoColIdx] || '');
              const rawDate = row[dateColIdx];
              let monthStr = '';
              if (typeof rawDate === 'number') {
                const dateObj = XLSX.SSF.parse_date_code(rawDate);
                monthStr = `${dateObj.y}-${dateObj.m.toString().padStart(2, '0')}`;
              } else if (rawDate) {
                const s = String(rawDate).trim();
                const match = s.match(/(\d{4})[-/.]( \d{1,2})/);
                const match2 = s.match(/(\d{4})[-\/.]( \d{1,2})/);
                const m2 = s.match(/(\d{4})[-\/.](\d{1,2})/);
                if (m2) monthStr = `${m2[1]}-${m2[2].padStart(2, '0')}`;
                else if (s.includes('年') && s.includes('月')) {
                  const y = s.match(/(\d{4})年/)?.[1];
                  const m = s.match(/(\d{1,2})月/)?.[1];
                  if (y && m) monthStr = `${y}-${m.padStart(2, '0')}`;
                }
              }
              const metrics: Record<string, number> = {};
              headersRow.forEach((h, idx) => {
                let key = String(h || '').trim().replace(/R$/, '');
                if (key.includes('百元收入')) {
                  key = key.replace('百元收入', '') + '占收比';
                }
                if (key && !key.startsWith('__EMPTY') && idx !== dateColIdx && idx !== projectNoColIdx) {
                  const val = parseFloat(String(row[idx] ?? '0').replace(/,/g, ''));
                  metrics[key] = isNaN(val) ? 0 : val;
                }
              });
              return { month: monthStr, projectNo, metrics };
            }).filter(r => r.month.length >= 7 && r.projectNo);

            allFactRecords = [...allFactRecords, ...factRecords];
          }

          // Branch 3: Other Data Sheets (no month → static project-level metrics)
          else {
            const isFactSheet =
              cleanSheetName.includes('数据') ||
              cleanSheetName.includes('指标') ||
              cleanSheetName.includes('达标') ||
              cleanSheetName.includes('预算') ||
              cleanSheetName.includes('fact');

            if (isFactSheet) {
              const json = XLSX.utils.sheet_to_json(ws, { raw: true }) as any[];
              json.forEach(row => {
                const pNo = String(row['项目编号'] || row['项目代码'] || row['项目ID'] || row['ProjectNo'] || '');
                if (!pNo) return;
                const metrics: Record<string, number> = {};
                const isWanYuanSheet = cleanSheetName.includes('万元');
                Object.keys(row).forEach(k => {
                  const val = row[k];
                  if (!k.startsWith('__EMPTY') && !EXCLUDED_KEYS.includes(k)) {
                    let num = typeof val === 'number' ? val : (parseFloat(String(val).replace(/,/g, '')) || 0);
                    if (isWanYuanSheet) num *= 10000; // 统一转换为元
                    let cleanK = k.trim().replace(/^目标[-－\s]*/, '目标').replace(/R$/, '');
                    if (cleanK.includes('百元收入')) {
                      cleanK = cleanK.replace('百元收入', '') + '占收比';
                    }
                    metrics[cleanK] = num;
                  }
                });
                if (!staticProjectMetrics[pNo]) staticProjectMetrics[pNo] = {};
                staticProjectMetrics[pNo] = { ...staticProjectMetrics[pNo], ...metrics };
              });
            }
          }
        });
      }


      if (allFactRecords.length === 0) {
        alert('未在文件中找到包含“月份/日期”的经营数据。');
        return;
      }

      // Merge records with same month and projectNo
      const mergedMap: Record<string, DataRecord> = {};
      allFactRecords.forEach(r => {
        const key = `${r.month}_${r.projectNo}`;
        if (!mergedMap[key]) {
          mergedMap[key] = { ...r };
        } else {
          mergedMap[key].metrics = { ...mergedMap[key].metrics, ...r.metrics };
        }
      });

      // Enrich and Broadcast static metrics
      const enriched: EnrichedRecord[] = Object.values(mergedMap).map(r => {
        const info = tempProjectInfo[r.projectNo] || {
          projectName: r.projectNo || '未知项目',
          ownership: '未分类',
          management: '未分类',
          propertyType: '未分类',
          secondaryPropertyType: '未分类',
          isKeyProject: '否',
          isExistingProject: '否',
          reportCaliber: '未分类',
          projectShortName: '未分类'
        };

        // Combine monthly metrics with static metrics from other sheets
        const staticMetrics = staticProjectMetrics[r.projectNo] || {};
        const metrics = { ...staticMetrics, ...r.metrics };

        // Derived Logic
        const getM = (k: string) => metrics[k] || 0;
        const profitTotal = getM('36利润总额');
        const nonOp = getM('32营业外收支净额');
        const otherInc = getM('34其他收益');
        const invInc = getM('33投资收益');
        const assetDisp = getM('30资产处置损益');

        if (info.propertyType === '酒店业务') {
          metrics['对标利润'] = profitTotal + getM('18租赁费') + getM('23折旧折耗及摊销') + getM('22财产性税费') + getM('26信用减值损失') + nonOp + otherInc + invInc + assetDisp;
        } else {
          metrics['对标利润'] = profitTotal + nonOp + otherInc + invInc + assetDisp + getM('31资产减值损失');
        }

        return { ...r, ...info, metrics };
      });

      if (enriched.length === 0) {
        alert('解析后的有效记录数为0，请检查项目编号匹配情况。');
        return;
      }

      setProjectInfoMap(tempProjectInfo);
      setSourceData(enriched);

      // Merge all built-in metadata with any new metrics found in the Excel
      const allMetricKeys = new Set<string>();
      enriched.forEach(r => Object.keys(r.metrics).forEach(k => allMetricKeys.add(k)));
      DEFAULT_METRICS_METADATA.forEach(m => allMetricKeys.add(m.name));

      const mergedMetadata = [...DEFAULT_METRICS_METADATA];
      allMetricKeys.forEach(name => {
        if (!mergedMetadata.some(m => m.name === name)) {
          mergedMetadata.push({ name, formula: '', source: 'operating', unit: '元' });
        }
      });

      const sortedCategories = Array.from(allMetricKeys).sort((a, b) => {
        const idxA = currentOrder.indexOf(a);
        const idxB = currentOrder.indexOf(b);
        if (idxA === -1 && idxB === -1) return a.localeCompare(b);
        if (idxA === -1) return 1;
        if (idxB === -1) return -1;
        return idxA - idxB;
      });

      setMetricMetadata(mergedMetadata);
      setCategories(sortedCategories);
      
      // Default to only showing Revenue and Profit YTD after import
      const defaultIndicators = sortedCategories.filter(cat => ['收入YTD', '利润YTD'].includes(cat));
      setSelectedIndicators(defaultIndicators.length > 0 ? defaultIndicators : sortedCategories);

      const ms = [...new Set(enriched.map(d => d.month))].sort().reverse();
      setSelectedMonth(ms[0] || '');

      setFilters({
        months: [],
        ownerships: [...new Set(enriched.map(d => d.ownership))],
        managements: [...new Set(enriched.map(d => d.management))],
        propertyTypes: [...new Set(enriched.map(d => d.propertyType))],
        secondaryPropertyTypes: [...new Set(enriched.map(d => d.secondaryPropertyType))],
        projectNames: [...new Set(enriched.map(d => d.projectName))],
        isKeyProjects: [...new Set(enriched.map(d => d.isKeyProject))],
        isExistingProjects: [...new Set(enriched.map(d => d.isExistingProject))],
        reportCalibers: [...new Set(enriched.map(d => d.reportCaliber))],
        projectShortNames: [...new Set(enriched.map(d => d.projectShortName))],
        projectNos: [...new Set(enriched.map(d => d.projectNo))]
      });

      alert(`导入成功！共加载 ${enriched.length} 条项目月度数据。`);

    } catch (err) {
      console.error('Import Error:', err);
      alert('文件解析过程出错，请检查控制台详情。');
    } finally {
      setIsImporting(false);
    }
  };

  function getSumWithFuzzyInternal(items: EnrichedRecord[], name: string, timeGroupName: string, year: number, month: number, prevYear: number, pm: { y: number, m: number }): number {
    const isYTD = (d: EnrichedRecord, y: number, m: number) => {
      const [dy, dm] = d.month.split('-').map(Number);
      return dy === y && dm <= m;
    };
    const isMTD = (d: EnrichedRecord, y: number, m: number) => d.month === `${y}-${m.toString().padStart(2, '0')}`;

    const getSumWithFuzzy = (dataList: EnrichedRecord[], targetName: string) => {
      const isStatic = BUDGET_METRICS.includes(targetName) || THREE_YEAR_BENEFIT_METRICS.includes(targetName) || BUSINESS_METRICS.includes(targetName);
      const calculateSum = (name: string) => {
        if (isStatic) {
          const projectMap: Record<string, number> = {};
          dataList.forEach(d => {
            if (!(d.projectNo in projectMap)) projectMap[d.projectNo] = d.metrics[name] || 0;
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

    if (timeGroupName === '本年累计') return getSumWithFuzzy(items.filter(d => isYTD(d, year, month)), name);
    if (timeGroupName === '去年同期') return getSumWithFuzzy(items.filter(d => isYTD(d, prevYear, month)), name);
    if (timeGroupName === '当月发生额') return getSumWithFuzzy(items.filter(d => isMTD(d, year, month)), name);
    if (timeGroupName === '上月发生额') return getSumWithFuzzy(items.filter(d => isMTD(d, pm.y, pm.m)), name);
    return getSumWithFuzzy(items.filter(d => isMTD(d, year, month)), name);
  }
  function getMetricValue(data: EnrichedRecord[], metricName: string, timeGroupName: string, year: number, month: number): number {
    if (['重点项目个数', '未达标个数', '重点项目未达标数'].includes(metricName)) {
      return NaN;
    }
    if (['利润率下降项目数', '效益下降项目数'].includes(metricName)) {
      if (timeGroupName !== '本年累计') {
        return NaN;
      }
      const isYTD = (d: EnrichedRecord, y: number, m: number) => {
        const [dy, dm] = d.month.split('-').map(Number);
        return dy === y && dm <= m;
      };

      const curSlice = data.filter(d => isYTD(d, year, month));
      const prevSlice = data.filter(d => isYTD(d, year - 1, month));

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
    if (['项目个数', '亏损个数'].includes(metricName)) {
      if (['本年累计', '去年同期', '当月发生额', '上月发生额'].includes(timeGroupName)) {
        const prevYear = year - 1;
        const pm = month === 1 ? { y: year - 1, m: 12 } : { y: year, m: month - 1 };

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
          filteredSlice = data.filter(d => isYTD(d, year, month));
        } else if (timeGroupName === '去年同期') {
          filteredSlice = data.filter(d => isYTD(d, prevYear, month));
        } else if (timeGroupName === '当月发生额') {
          filteredSlice = data.filter(d => isMTD(d, year, month));
        } else if (timeGroupName === '上月发生额') {
          filteredSlice = data.filter(d => isMTD(d, pm.y, pm.m));
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
    if (metricName === '人工成本') {
      const s1 = getMetricValue(data, '15用工薪酬成本', timeGroupName, year, month);
      const s2 = getMetricValue(data, '16外包劳务支出', timeGroupName, year, month);
      return s1 + s2;
    }
    if (metricName === '能源成本') {
      const s1 = getMetricValue(data, '8外购燃料', timeGroupName, year, month);
      const s2 = getMetricValue(data, '9外购动力', timeGroupName, year, month);
      return s1 + s2;
    }
    const prevYear = year - 1;
    const pm = month === 1 ? { y: year - 1, m: 12 } : { y: year, m: month - 1 };

    if (timeGroupName === '同比增减额') {
      return getMetricValue(data, metricName, '本年累计', year, month) - getMetricValue(data, metricName, '去年同期', year, month);
    }
    if (timeGroupName === '环比增减额') {
      return getMetricValue(data, metricName, '当月发生额', year, month) - getMetricValue(data, metricName, '上月发生额', year, month);
    }
    if (timeGroupName === '同比增减率') {
      const current = getMetricValue(data, metricName, '本年累计', year, month);
      const previous = getMetricValue(data, metricName, '去年同期', year, month);
      return previous !== 0 ? (current - previous) / Math.abs(previous) : NaN;
    }
    if (timeGroupName === '环比增减率') {
      const current = getMetricValue(data, metricName, '当月发生额', year, month);
      const previous = getMetricValue(data, metricName, '上月发生额', year, month);
      return previous !== 0 ? (current - previous) / Math.abs(previous) : NaN;
    }

    const meta = metricMetadata.find(m => m.name === metricName);
    if (!meta) {
      return getSumWithFuzzyInternal(data, metricName, timeGroupName, year, month, prevYear, pm);
    }

    const formula = meta.formula || '';
    if (formula.startsWith('=') || formula.startsWith('‘=')) {
      const cleanFormula = formula.replace(/^‘?=/, '').trim();
      if (!cleanFormula.includes('/') && !cleanFormula.includes('+') && !cleanFormula.includes('-') && !cleanFormula.includes('*')) {
        return getMetricValue(data, cleanFormula, timeGroupName, year, month);
      }
      if (cleanFormula.includes('ABS(')) {
        // Handle Budget Profit Completion Rate formula: (1+(利润YTD-Budget)/ABS(Budget))
        const budgetMatch = cleanFormula.match(/ABS\(([^)]+)\)/);
        const budgetName = budgetMatch ? budgetMatch[1].trim() : '';
        const currentName = cleanFormula.includes('利润YTD') ? '利润YTD' : '';
        
        if (budgetName && currentName) {
          const current = getMetricValue(data, currentName, timeGroupName, year, month);
          const budget = getMetricValue(data, budgetName, timeGroupName, year, month);
          if (budget === 0 || isNaN(budget)) return NaN;
          return 1 + (current - budget) / Math.abs(budget);
        }
      }

      if (cleanFormula.includes('/') && !cleanFormula.includes('+')) {
        const parts = cleanFormula.replace(/\*100/g, '').split('/').map(s => s.trim());
        if (parts.length === 2) {
          const num = getMetricValue(data, parts[0], timeGroupName, year, month);
          const den = getMetricValue(data, parts[1], timeGroupName, year, month);
          const val = den !== 0 ? num / den : NaN;
          // Only scale by 100 if the formula explicitly has *100 AND we want to return the raw scaled number
          // But our formatNumber handles scaling, so we generally want to return the ratio.
          return cleanFormula.includes('*100') ? (isNaN(val) ? NaN : val * 100) : val;
        }
      }

      if (cleanFormula.includes('15用工薪酬成本') || cleanFormula.includes('用工薪酬成本')) {
        const s1 = getMetricValue(data, '15用工薪酬成本', timeGroupName, year, month);
        const s2 = getMetricValue(data, '16外包劳务支出', timeGroupName, year, month);
        const den = getMetricValue(data, '收入YTD', timeGroupName, year, month);
        const val = den !== 0 ? (s1 + s2) / den : NaN;
        return cleanFormula.includes('*100') ? (isNaN(val) ? NaN : val * 100) : val;
      }

      if (cleanFormula.includes('8外购燃料') || cleanFormula.includes('外购燃料')) {
        const s1 = getMetricValue(data, '8外购燃料', timeGroupName, year, month);
        const s2 = getMetricValue(data, '9外购动力', timeGroupName, year, month);
        const den = getMetricValue(data, '收入YTD', timeGroupName, year, month);
        const val = den !== 0 ? (s1 + s2) / den : NaN;
        return cleanFormula.includes('*100') ? (isNaN(val) ? NaN : val * 100) : val;
      }
    }
    return getSumWithFuzzyInternal(data, metricName, timeGroupName, year, month, prevYear, pm);
  }

  const filteredData = useMemo(() => {
    return sourceData.filter(d =>
      (filters.ownerships || []).includes(d.ownership) &&
      (filters.managements || []).includes(d.management) &&
      (filters.propertyTypes || []).includes(d.propertyType) &&
      (filters.secondaryPropertyTypes || []).includes(d.secondaryPropertyType) &&
      (filters.projectNames || []).includes(d.projectName) &&
      (filters.isKeyProjects || []).includes(d.isKeyProject) &&
      (filters.isExistingProjects || []).includes(d.isExistingProject) &&
      (filters.reportCalibers || []).includes(d.reportCaliber) &&
      (filters.projectShortNames || []).includes(d.projectShortName) &&
      (filters.projectNos || []).includes(d.projectNo)
    );
  }, [filters, sourceData]);

  const chartData = useMemo((): PerformanceItem[] => {
    if (!selectedMonth || !selectedMonth.includes('-')) return [];
    const [year, month] = selectedMonth.split('-').map(Number);

    const calcForCategory = (cat: string, timeGroupName: string): number | null => {
      if (timeGroupName !== '本年累计' && !TIME_SERIES_ALLOWED_METRICS.includes(cat)) {
        return 0;
      }
      return getMetricValue(filteredData, cat, timeGroupName, year, month);
    };

    return selectedIndicators
      .filter(cat => categories.includes(cat))
      .map(cat => {
        const val = calcForCategory(cat, selectedMetric);
        const finalVal = (val === null || isNaN(val as number)) ? NaN : val;
        // Determine if this specific combination should be treated as a rate
        const isFinalRate = isRateMetric(cat) || isRateMetric(selectedMetric);

        return {
          id: cat,
          category: cat,
          value: finalVal as number,
          displayValue: '',
          isPercent: isFinalRate,
          isWanYuan: !isFinalRate && isMoneyMetric(cat)
        };
      });
  }, [selectedMonth, selectedMetric, filteredData, categories, selectedIndicators, metricMetadata, timeGroupMetadata]);

  const trendChartData = useMemo(() => {
    if (chartType !== 'line') return [];

    // All available months from sourceData, sorted ascending and >= 2025-01
    const allMonths = (Array.from(new Set(sourceData.map(d => d.month))) as string[])
      .filter(m => m >= '2025-01')
      .sort();

    return allMonths.map((monthStr: string) => {
      const [y, m] = monthStr.split('-').map(Number);

      const calculateValue = (cat: string): number => {
        // 对于趋势图，我们一律按“当月发生额”逻辑计算
        return getMetricValue(filteredData, cat, '当月发生额', y, m);
      };

      const point: any = { month: (monthStr as string).replace('-', '') };
      selectedIndicators.forEach(cat => {
        point[cat] = calculateValue(cat) ?? 0;
      });
      return point;
    });
  }, [chartType, sourceData, filteredData, selectedIndicators, getMetricValue]);

  const exportToExcel = () => {
    if (categories.length === 0 || !selectedMonth || !selectedMonth.includes('-')) return;
    const [year, month] = selectedMonth.split('-').map(Number);

    const calculateForExport = (cat: string, metric: MetricKey): number => {
      const mapping: Record<string, string> = {
        'YTD': '本年累计',
        'LY': '去年同期',
        'YoYDiff': '同比增减额',
        'YoYPercent': '同比增减率',
        'MTD': '当月发生额',
        'PreMonth': '上月发生额',
        'MoMDiff': '环比增减额',
        'MoMPercent': '环比增减率'
      };
      return getMetricValue(filteredData, cat, mapping[metric], year, month);
    };

    // 1. 准备汇总数据 (包含所有指标)
    const metricKeys: MetricKey[] = ['YTD', 'LY', 'YoYDiff', 'YoYPercent', 'MTD', 'PreMonth', 'MoMDiff', 'MoMPercent'];
    const metricNames = ['本年累计', '去年同期', '同比增减额', '同比增减率', '当月发生额', '上月发生额', '环比增减额', '环比增减率'];

    const exportData = selectedIndicators
      .filter(cat => categories.includes(cat))
      .map(cat => {
        const row: Record<string, string | number> = { '指标名称': cat };
        metricKeys.forEach((key, index) => {
          // 只对 38个核心指标和 6个经营指标适用计算组筛选
          // 其他指标只适用“本年累计”
          if (key !== 'YTD' && !TIME_SERIES_ALLOWED_METRICS.includes(cat)) {
            row[metricNames[index]] = '-';
            return;
          }

          const value = calculateForExport(cat, key);
          const isRate = isRateMetric(key) || isRateMetric(cat);
          const isMoney = isMoneyMetric(cat);
          if (isNaN(value) || value === 0) {
            row[metricNames[index]] = '-';
          } else if (isRate) {
            row[metricNames[index]] = value.toFixed(2) + '%';
          } else if (isMoney) {
            row[metricNames[index]] = (value / 10000).toLocaleString('zh-CN', { minimumFractionDigits: 2 });
          } else {
            row[metricNames[index]] = value.toLocaleString('zh-CN', { minimumFractionDigits: 2 });
          }
        });
        return row;
      });

    // 2. 准备筛选条件汇总
    const filterSummary = [
      { '维度': '数据月份', '已选范围': selectedMonth },
      { '维度': '产权口径', '已选范围': filters.ownerships.length === sourceData.map(d => d.ownership).filter((v, i, a) => a.indexOf(v) === i).length ? '全部已选' : filters.ownerships.join(', ') },
      { '维度': '管理口径', '已选范围': filters.managements.length === sourceData.map(d => d.management).filter((v, i, a) => a.indexOf(v) === i).length ? '全部已选' : filters.managements.join(', ') },
      { '维度': '业务业态', '已选范围': filters.propertyTypes.length === sourceData.map(d => d.propertyType).filter((v, i, a) => a.indexOf(v) === i).length ? '全部已选' : filters.propertyTypes.join(', ') },
      { '维度': '项目编号', '已选范围': (filters.projectNos || []).length === sourceData.map(d => d.projectNo).filter((v, i, a) => a.indexOf(v) === i).length ? '全部已选' : (filters.projectNos || []).join(', ') },
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

  const exportDimensionPackages = async () => {
    if (sourceData.length === 0 || !selectedMonth || !selectedMonth.includes('-')) {
      alert('无可导出的数据或未选择有效月份');
      return;
    }

    setExportProgress({ active: true, status: '正在初始化...', percent: 0 });

    setTimeout(async () => {
      try {
        const [year, month] = selectedMonth.split('-').map(Number);

        setExportProgress({ active: true, status: '正在从服务器加载 Excel 模版...', percent: 2 });
        const response = await fetch('./模版.xlsx');
        if (!response.ok) {
          throw new Error('加载模版文件失败，请确认模版存在且服务正常。');
        }
        const templateBuffer = await response.arrayBuffer();

        setExportProgress({ active: true, status: '正在解析模版架构...', percent: 5 });
        const tempWorkbook = new ExcelJS.Workbook();
        await tempWorkbook.xlsx.load(templateBuffer);
        
        const templateSheet = tempWorkbook.getWorksheet('项目1');
        if (!templateSheet) {
          throw new Error('未在模版中找到“项目1”工作表。');
        }

        const rowLabels: string[] = [];
        const cleanLabelsMap: Record<string, string> = {};
        for (let r = 2; r <= templateSheet.rowCount; r++) {
          const val = templateSheet.getCell(`A${r}`).value;
          const rawLabel = val ? String(val).trim() : '';
          if (rawLabel) {
            rowLabels.push(rawLabel);
            cleanLabelsMap[rawLabel] = rawLabel.replace(/R$/, '');
          }
        }

        const allProjects: ProjectInfo[] = [];
        const seen = new Set<string>();
        
        // Collect from projectInfoMap first
        Object.values(projectInfoMap).forEach(p => {
          if (p.projectNo && !seen.has(p.projectNo)) {
            seen.add(p.projectNo);
            allProjects.push(p);
          }
        });

        // Collect any missing projects that are in sourceData
        sourceData.forEach(d => {
          if (d.projectNo && !seen.has(d.projectNo)) {
            seen.add(d.projectNo);
            allProjects.push({
              projectNo: d.projectNo,
              projectName: d.projectName || d.projectNo,
              ownership: d.ownership || '未分类',
              management: d.management || '未分类',
              propertyType: d.propertyType || '未分类',
              secondaryPropertyType: d.secondaryPropertyType || '未分类',
              isKeyProject: d.isKeyProject || '否',
              isExistingProject: d.isExistingProject || '否',
              reportCaliber: d.reportCaliber || '未分类',
              projectShortName: d.projectShortName || d.projectName || '未分类'
            });
          }
        });

        const buildGroupWorkbook = async (groupProjects: ProjectInfo[], isWanYuan: boolean): Promise<ArrayBuffer> => {
          const wb = new ExcelJS.Workbook();
          await wb.xlsx.load(templateBuffer);

          const sheetTotal = wb.getWorksheet('合计');
          const sheetProj1 = wb.getWorksheet('项目1');

          if (!sheetTotal || !sheetProj1) {
            throw new Error('未在模版中找到“合计”或“项目1”工作表');
          }

          const groupProjectNos = groupProjects.map(p => p.projectNo);
          const groupRecords = sourceData.filter(d => groupProjectNos.includes(d.projectNo));

          // Fill Total Sheet
          for (let r = 2; r <= 39; r++) {
            const rawLabel = rowLabels[r - 2];
            if (!rawLabel) continue;
            const cleanLabel = cleanLabelsMap[rawLabel];

            const valB = getMetricValue(groupRecords, cleanLabel, '本年累计', year, month);
            const valC = getMetricValue(groupRecords, cleanLabel, '去年同期', year, month);
            const valD = valB - valC;
            const valE = getMetricValue(groupRecords, cleanLabel, '当月发生额', year, month);
            const valF = getMetricValue(groupRecords, cleanLabel, '上月发生额', year, month);
            const valG = valE - valF;

            const cols = ['B', 'C', 'D', 'E', 'F', 'G'];
            const vals = [valB, valC, valD, valE, valF, valG];

            cols.forEach((col, idx) => {
              let val = vals[idx];
              const cell = sheetTotal.getCell(`${col}${r}`);
              if (isNaN(val) || val === null || val === undefined) {
                cell.value = null;
              } else {
                const isCount = ['项目个数', '亏损个数', '重点项目个数', '未达标个数', '重点项目未达标数', '利润率下降项目数', '效益下降项目数'].includes(cleanLabel);
                if (isWanYuan && !isCount) {
                  val = val / 10000;
                  cell.value = val;
                  cell.numFmt = '#,##0.00;-#,##0.00;"-"';
                } else {
                  cell.value = val;
                  cell.numFmt = isCount 
                    ? '#,##0;-#,##0;"-"'
                    : (isIntegerMode ? '#,##0;-#,##0;"-"' : '#,##0.00;-#,##0.00;"-"');
                }
              }
            });
          }

          // Create sheet for each project in this group
          const sheetNamesUsed = new Set<string>();
          for (const project of groupProjects) {
            let baseName = project.projectName.replace(/[\\\/\?\*\[\]]/g, '').trim();
            if (!baseName) baseName = project.projectNo;

            let sheetName = baseName.slice(0, 30);
            if (sheetNamesUsed.has(sheetName)) {
              const suffix = `_${project.projectNo}`;
              sheetName = baseName.slice(0, 30 - suffix.length) + suffix;
              
              let counter = 1;
              while (sheetNamesUsed.has(sheetName)) {
                const counterSuffix = `_${counter++}`;
                sheetName = baseName.slice(0, 30 - suffix.length - counterSuffix.length) + suffix + counterSuffix;
              }
            }
            sheetNamesUsed.add(sheetName);
            const newSheet = wb.addWorksheet(sheetName);

            // Copy Columns configuration
            newSheet.columns = sheetProj1.columns.map(col => ({
              width: col.width,
              style: col.style
            }));

            // Copy Rows and Cell styles
            for (let r = 1; r <= sheetProj1.rowCount; r++) {
              const srcRow = sheetProj1.getRow(r);
              const destRow = newSheet.getRow(r);
              destRow.height = srcRow.height;

              for (let c = 1; c <= sheetProj1.columnCount; c++) {
                const srcCell = srcRow.getCell(c);
                const destCell = destRow.getCell(c);
                destCell.value = srcCell.value;
                destCell.style = srcCell.style;
              }
            }

            const projectRecords = sourceData.filter(d => d.projectNo === project.projectNo);

            // Fill Project Sheet Data
            for (let r = 2; r <= 39; r++) {
              const rawLabel = rowLabels[r - 2];
              if (!rawLabel) continue;
              const cleanLabel = cleanLabelsMap[rawLabel];

              const valB = getMetricValue(projectRecords, cleanLabel, '本年累计', year, month);
              const valC = getMetricValue(projectRecords, cleanLabel, '去年同期', year, month);
              const valD = valB - valC;
              const valE = getMetricValue(projectRecords, cleanLabel, '当月发生额', year, month);
              const valF = getMetricValue(projectRecords, cleanLabel, '上月发生额', year, month);
              const valG = valE - valF;

              const cols = ['B', 'C', 'D', 'E', 'F', 'G'];
              const vals = [valB, valC, valD, valE, valF, valG];

              cols.forEach((col, idx) => {
                let val = vals[idx];
                const cell = newSheet.getCell(`${col}${r}`);
                if (isNaN(val) || val === null || val === undefined) {
                  cell.value = null;
                } else {
                  const isCount = ['项目个数', '亏损个数', '重点项目个数', '未达标个数', '重点项目未达标数', '利润率下降项目数', '效益下降项目数'].includes(cleanLabel);
                  if (isWanYuan && !isCount) {
                    val = val / 10000;
                    cell.value = val;
                    cell.numFmt = '#,##0.00;-#,##0.00;"-"';
                  } else {
                    cell.value = val;
                    cell.numFmt = isCount 
                      ? '#,##0;-#,##0;"-"'
                      : (isIntegerMode ? '#,##0;-#,##0;"-"' : '#,##0.00;-#,##0.00;"-"');
                  }
                }
              });
            }
          }

          wb.removeWorksheet('项目1');
          wb.removeWorksheet('项目2');

          const buf = await wb.xlsx.writeBuffer();
          return buf as ArrayBuffer;
        };

        const buildTotalWorkbook = async (
          groups: { name: string; records: EnrichedRecord[] }[],
          grandTotalRecords: EnrichedRecord[],
          isWanYuan: boolean
        ): Promise<ArrayBuffer> => {
          const wb = new ExcelJS.Workbook();
          await wb.xlsx.load(templateBuffer);

          const sheetTotal = wb.getWorksheet('合计');
          const sheetProj1 = wb.getWorksheet('项目1');

          if (!sheetTotal || !sheetProj1) {
            throw new Error('未在模版中找到“合计”或“项目1”工作表');
          }

          // Fill Total Sheet with Grand Total of the entire package
          for (let r = 2; r <= 39; r++) {
            const rawLabel = rowLabels[r - 2];
            if (!rawLabel) continue;
            const cleanLabel = cleanLabelsMap[rawLabel];

            const valB = getMetricValue(grandTotalRecords, cleanLabel, '本年累计', year, month);
            const valC = getMetricValue(grandTotalRecords, cleanLabel, '去年同期', year, month);
            const valD = valB - valC;
            const valE = getMetricValue(grandTotalRecords, cleanLabel, '当月发生额', year, month);
            const valF = getMetricValue(grandTotalRecords, cleanLabel, '上月发生额', year, month);
            const valG = valE - valF;

            const cols = ['B', 'C', 'D', 'E', 'F', 'G'];
            const vals = [valB, valC, valD, valE, valF, valG];

            cols.forEach((col, idx) => {
              let val = vals[idx];
              const cell = sheetTotal.getCell(`${col}${r}`);
              if (isNaN(val) || val === null || val === undefined) {
                cell.value = null;
              } else {
                const isCount = ['项目个数', '亏损个数', '重点项目个数', '未达标个数', '重点项目未达标数', '利润率下降项目数', '效益下降项目数'].includes(cleanLabel);
                if (isWanYuan && !isCount) {
                  val = val / 10000;
                  cell.value = val;
                  cell.numFmt = '#,##0.00;-#,##0.00;"-"';
                } else {
                  cell.value = val;
                  cell.numFmt = isCount 
                    ? '#,##0;-#,##0;"-"'
                    : (isIntegerMode ? '#,##0;-#,##0;"-"' : '#,##0.00;-#,##0.00;"-"');
                }
              }
            });
          }

          // Create sheet for each caliber group
          const sheetNamesUsed = new Set<string>();
          for (const g of groups) {
            let baseName = g.name.replace(/[\\\/\?\*\[\]]/g, '').trim();
            if (!baseName) baseName = '未命名分类';

            let sheetName = baseName.slice(0, 30);
            if (sheetNamesUsed.has(sheetName)) {
              let counter = 1;
              while (sheetNamesUsed.has(sheetName)) {
                const counterSuffix = `_${counter++}`;
                sheetName = baseName.slice(0, 30 - counterSuffix.length) + counterSuffix;
              }
            }
            sheetNamesUsed.add(sheetName);
            const newSheet = wb.addWorksheet(sheetName);

            // Copy Columns configuration
            newSheet.columns = sheetProj1.columns.map(col => ({
              width: col.width,
              style: col.style
            }));

            // Copy Rows and Cell styles
            for (let r = 1; r <= sheetProj1.rowCount; r++) {
              const srcRow = sheetProj1.getRow(r);
              const destRow = newSheet.getRow(r);
              destRow.height = srcRow.height;

              for (let c = 1; c <= sheetProj1.columnCount; c++) {
                const srcCell = srcRow.getCell(c);
                const destCell = destRow.getCell(c);
                destCell.value = srcCell.value;
                destCell.style = srcCell.style;
              }
            }

            // Fill Group Data
            for (let r = 2; r <= 39; r++) {
              const rawLabel = rowLabels[r - 2];
              if (!rawLabel) continue;
              const cleanLabel = cleanLabelsMap[rawLabel];

              const valB = getMetricValue(g.records, cleanLabel, '本年累计', year, month);
              const valC = getMetricValue(g.records, cleanLabel, '去年同期', year, month);
              const valD = valB - valC;
              const valE = getMetricValue(g.records, cleanLabel, '当月发生额', year, month);
              const valF = getMetricValue(g.records, cleanLabel, '上月发生额', year, month);
              const valG = valE - valF;

              const cols = ['B', 'C', 'D', 'E', 'F', 'G'];
              const vals = [valB, valC, valD, valE, valF, valG];

              cols.forEach((col, idx) => {
                let val = vals[idx];
                const cell = newSheet.getCell(`${col}${r}`);
              if (isNaN(val) || val === null || val === undefined) {
                cell.value = null;
              } else {
                const isCount = ['项目个数', '亏损个数', '重点项目个数', '未达标个数', '重点项目未达标数', '利润率下降项目数', '效益下降项目数'].includes(cleanLabel);
                if (isWanYuan && !isCount) {
                  val = val / 10000;
                  cell.value = val;
                  cell.numFmt = '#,##0.00;-#,##0.00;"-"';
                } else {
                  cell.value = val;
                  cell.numFmt = isCount 
                    ? '#,##0;-#,##0;"-"'
                    : (isIntegerMode ? '#,##0;-#,##0;"-"' : '#,##0.00;-#,##0.00;"-"');
                }
              }
            });
          }
        }

        wb.removeWorksheet('项目1');
        wb.removeWorksheet('项目2');

        const buf = await wb.xlsx.writeBuffer();
        return buf as ArrayBuffer;
      };

      const exportDimension = async (
        dimKey: 'management' | 'ownership' | 'propertyType',
        dimLabel: string,
        startPercent: number,
        isWanYuan: boolean
      ) => {
        const suffix = isWanYuan ? ' (万元版)' : '';
        const fileSuffix = isWanYuan ? '_万元版' : '';
        setExportProgress({ active: true, status: `正在生成 “${dimLabel}” 报表包${suffix}...`, percent: startPercent });

        const groups: Record<string, ProjectInfo[]> = {};
        allProjects.forEach(p => {
          const val = p[dimKey] || '未分类';
          if (!groups[val]) groups[val] = [];
          groups[val].push(p);
        });

        const zip = new JSZip();
        const entries = Object.entries(groups);
        for (let i = 0; i < entries.length; i++) {
          const [val, projs] = entries[i];
          setExportProgress({ 
            active: true, 
            status: `正在生成 “${dimLabel}”${suffix} - ${val} (${i + 1}/${entries.length})...`, 
            percent: startPercent + Math.floor((i / entries.length) * 10) 
          });
          const buf = await buildGroupWorkbook(projs, isWanYuan);
          zip.file(`${val}.xlsx`, buf);
        }

        // Generate total sheet
        setExportProgress({ active: true, status: `正在生成 “${dimLabel}”${suffix} 总合计表...`, percent: startPercent + 11 });
        const totalGroups = Object.entries(groups).map(([val, projs]) => {
          const groupProjectNos = projs.map(p => p.projectNo);
          const records = sourceData.filter(d => groupProjectNos.includes(d.projectNo));
          return { name: val, records };
        });
        const totalBuf = await buildTotalWorkbook(totalGroups, sourceData, isWanYuan);
        zip.file(`总合计表.xlsx`, totalBuf);

        const blob = await zip.generateAsync({ type: 'blob' });
        saveAs(blob, `${dimLabel}_报表包_${selectedMonth}${fileSuffix}.zip`);
      };

      // --- 1. 管理口径 (元版 & 万元版) ---
      await exportDimension('management', '管理口径', 10, false);
      await new Promise(r => setTimeout(r, 800));
      await exportDimension('management', '管理口径', 25, true);
      await new Promise(r => setTimeout(r, 800));

      // --- 2. 产权口径 (元版 & 万元版) ---
      await exportDimension('ownership', '产权口径', 40, false);
      await new Promise(r => setTimeout(r, 800));
      await exportDimension('ownership', '产权口径', 55, true);
      await new Promise(r => setTimeout(r, 800));

      // --- 3. 业态 (元版 & 万元版) ---
      await exportDimension('propertyType', '业态', 70, false);
      await new Promise(r => setTimeout(r, 800));
      await exportDimension('propertyType', '业态', 85, true);

      setExportProgress({ active: true, status: '所有报表包已成功生成，开始下载！', percent: 100 });
      setTimeout(() => setExportProgress(null), 1500);

    } catch (err: any) {
      console.error('Batch export failed:', err);
      alert(`批量导出失败: ${err.message || err}`);
      setExportProgress(null);
    }
  }, 100);
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

    const dimKeyMap: Record<string, keyof EnrichedRecord> = {
      '产权口径': 'ownership',
      '管理口径': 'management',
      '业态': 'propertyType',
      '二级业态': 'secondaryPropertyType',
      '项目名称': 'projectName',
      '重点项目': 'isKeyProject',
      '现有项目': 'isExistingProject',
      '报表口径': 'reportCaliber',
      '项目简称': 'projectShortName'
    };
    const dimKey = dimKeyMap[tableDimension] || 'projectName';

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
      if (!selectedMonth || !selectedMonth.includes('-')) return 0;
      return getMetricValue(dataSlice as EnrichedRecord[], activeIndicator, selectedMetric, year, month);
    };

    const rowData = dimValues.map(dv => {
      const slice = filteredData.filter(d => String(d[dimKey]) === dv);
      return { dimValue: dv, val: calculateForSlice(slice) };
    }).sort((a, b) => a.val - b.val);
    const totalVal = calculateForSlice(filteredData);

    const isRate = isRateMetric(selectedMetric) || isRateMetric(activeIndicator);
    const isWanYuan = isMoneyMetric(activeIndicator);

    const exportTableToExcel = () => {
      checkAuth(() => {
        const exportData = rowData.map(r => ({
          [tableDimension]: r.dimValue,
          [`${activeIndicator} (${getMetricLabel(selectedMetric)})`]: (isNaN(r.val) || r.val === 0) ? '-' : (isRate ? (r.val * 100).toFixed(2) + '%' : r.val)
        }));

        exportData.push({
          [tableDimension]: '合计',
          [`${activeIndicator} (${getMetricLabel(selectedMetric)})`]: (isNaN(totalVal) || totalVal === 0) ? '-' : (isRate ? (totalVal * 100).toFixed(2) + '%' : totalVal)
        });

        const filterSummary = [
          { '维度': '数据月份', '已选范围': selectedMonth },
          { '维度': '产权口径', '已选范围': filters.ownerships.length === sourceData.map(d => d.ownership).filter((v, i, a) => a.indexOf(v) === i).length ? '全部已选' : filters.ownerships.join(', ') },
          { '维度': '管理口径', '已选范围': filters.managements.length === sourceData.map(d => d.management).filter((v, i, a) => a.indexOf(v) === i).length ? '全部已选' : filters.managements.join(', ') },
          { '维度': '业务业态', '已选范围': filters.propertyTypes.length === sourceData.map(d => d.propertyType).filter((v, i, a) => a.indexOf(v) === i).length ? '全部已选' : filters.propertyTypes.join(', ') },
          { '维度': '项目编号', '已选范围': (filters.projectNos || []).length === sourceData.map(d => d.projectNo).filter((v, i, a) => a.indexOf(v) === i).length ? '全部已选' : (filters.projectNos || []).join(', ') },
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
                  className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${tableDimension === dim ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
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
                    {formatNumber(r.val, isRate, isIntegerMode, isWanYuan)}
                  </td>
                ))}
                <td className="p-4 border-b border-indigo-100 text-indigo-700 font-bold text-sm bg-indigo-50/30 whitespace-nowrap">
                  {formatNumber(totalVal, isRate, isIntegerMode, isWanYuan)}
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
      <header className="sticky top-0 z-[60] glass-card border-b border-slate-200/60 px-6 py-3 flex items-center justify-between print:hidden">
        <div className="flex items-center gap-4">
          <div className="bg-gradient-to-br from-indigo-600 to-blue-500 p-2.5 rounded-2xl shadow-lg shadow-indigo-200 animate-float">
            <BarChart2 className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              BI 经营分析中心
              <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full border border-slate-200 font-bold uppercase tracking-widest">Enterprise</span>
            </h1>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em]">Financial Intelligence Dashboard</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={() => window.open('guide.html', '_blank')}
            className="flex items-center gap-2 text-slate-500 hover:text-indigo-600 px-3 py-1.5 rounded-xl text-xs font-black transition-all hover:bg-slate-100 active:scale-95 border border-transparent hover:border-slate-200"
          >
            <HelpCircle className="w-4 h-4" />
            使用说明
          </button>
          <button
            onClick={() => window.open('month_end_closing_guide.html', '_blank')}
            className="flex items-center gap-2 text-slate-500 hover:text-indigo-600 px-3 py-1.5 rounded-xl text-xs font-black transition-all hover:bg-slate-100 active:scale-95 border border-transparent hover:border-slate-200"
          >
            <BookOpen className="w-4 h-4" />
            结账合规指引
          </button>
          <div className="flex items-center gap-1 bg-slate-100/80 p-1 rounded-xl border border-slate-200/50">
            <button
              onClick={() => {
                setChartType('bar');
                const allowed = [...MAIN_INDICATORS, ...OPERATING_METRICS];
                setSelectedIndicators(prev => prev.filter(i => allowed.includes(i)));
              }}
              className={cn(
                "px-4 py-1.5 rounded-lg text-xs font-black transition-all flex items-center gap-2",
                chartType === 'bar' ? "bg-white text-indigo-600 shadow-sm premium-shadow" : "text-slate-500 hover:text-slate-700 hover:bg-white/50"
              )}
            >
              <BarChart2 className="w-3.5 h-3.5" />
              柱状图
            </button>
            <button
              onClick={() => {
                setChartType('line');
                const allowed = [...MAIN_INDICATORS, ...OPERATING_METRICS];
                setSelectedIndicators(prev => prev.filter(i => allowed.includes(i)));
              }}
              className={cn(
                "px-4 py-1.5 rounded-lg text-xs font-black transition-all flex items-center gap-2",
                chartType === 'line' ? "bg-white text-indigo-600 shadow-sm premium-shadow" : "text-slate-500 hover:text-slate-700 hover:bg-white/50"
              )}
            >
              <TrendingUp className="w-3.5 h-3.5" />
              趋势图
            </button>
            <button
              onClick={() => {
                setChartType('pie');
                if (!['YTD', 'LY', 'MTD', 'PreMonth'].includes(selectedMetric)) setSelectedMetric('YTD');
                setSelectedIndicators(prev => prev.filter(i => MAIN_INDICATORS.includes(i)));
              }}
              className={cn(
                "px-4 py-1.5 rounded-lg text-xs font-black transition-all flex items-center gap-2",
                chartType === 'pie' ? "bg-white text-indigo-600 shadow-sm premium-shadow" : "text-slate-500 hover:text-slate-700 hover:bg-white/50"
              )}
            >
              <PieChartIcon className="w-3.5 h-3.5" />
              饼图
            </button>
            <button
              onClick={() => setChartType('table')}
              className={cn(
                "px-4 py-1.5 rounded-lg text-xs font-black transition-all flex items-center gap-2",
                chartType === 'table' ? "bg-white text-indigo-600 shadow-sm premium-shadow" : "text-slate-500 hover:text-slate-700 hover:bg-white/50"
              )}
            >
              <TableIcon className="w-3.5 h-3.5" />
              数据表
            </button>
          </div>

          <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-sm transition-all hover:border-indigo-300">
            <Calendar className="w-4 h-4 text-indigo-500" />
            <select
              className="bg-transparent text-xs font-black outline-none cursor-pointer text-slate-700"
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
            className="group relative flex items-center gap-2 bg-slate-900 text-white px-5 py-2 rounded-xl text-xs font-black hover:bg-indigo-600 transition-all shadow-lg active:scale-95 disabled:opacity-50 overflow-hidden"
            disabled={isImporting}
          >
            <span className="relative z-10 flex items-center gap-2">
              {isImporting ? <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : <Upload className="w-3.5 h-3.5" />}
              {sourceData.length > 0 ? '重新导入' : '导入数据'}
            </span>
          </button>

          {sourceData.length > 0 && (
            <button
              onClick={() => checkAuth(exportDimensionPackages)}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 rounded-xl text-xs font-black transition-all shadow-lg active:scale-95"
            >
              <Download className="w-3.5 h-3.5" />
              分维度批量导出
            </button>
          )}

          {authState.isLoggedIn ? (
            <div className="flex items-center gap-3 bg-white pl-1.5 pr-4 py-1.5 rounded-2xl border border-slate-200 shadow-sm">
              <img src={authState.user?.avatar} alt="avatar" className="w-8 h-8 rounded-xl border border-slate-100 shadow-sm object-cover" />
              <div className="flex flex-col">
                <span className="text-[11px] font-black text-slate-800 leading-tight">{authState.user?.nickname}</span>
                {authState.user?.username === 'admin' && (
                  <button
                    onClick={() => setView('admin')}
                    className="text-[9px] font-black text-indigo-600 flex items-center gap-0.5 hover:underline uppercase tracking-tighter"
                  >
                    控制台
                  </button>
                )}
              </div>
              <button
                onClick={handleLogout}
                className="ml-2 p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
                title="退出登录"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setIsAuthModalOpen(true)}
              className="flex items-center gap-2 bg-indigo-50 text-indigo-600 px-5 py-2 rounded-xl text-xs font-black hover:bg-indigo-100 transition-all active:scale-95 border border-indigo-100"
            >
              <LogIn className="w-4 h-4" />
              登录
            </button>
          )}
        </div>
      </header>


      <main className="flex-1 p-6 space-y-6 max-w-[1600px] mx-auto w-full">
        {sourceData.length === 0 ? (
          <div className="flex flex-col items-center justify-center min-h-[70vh] bg-white/50 backdrop-blur-sm rounded-[3rem] border-2 border-dashed border-slate-200 p-12 text-center animate-in fade-in zoom-in duration-500">
            <div className="p-10 bg-gradient-to-br from-indigo-50 to-blue-50 rounded-full mb-8 shadow-inner">
              <Upload className="w-16 h-16 text-indigo-600 animate-bounce" />
            </div>
            <h2 className="text-4xl font-black text-slate-900 mb-4 tracking-tight">智见数据，决策未来</h2>
            <p className="text-slate-500 max-w-lg mx-auto mb-10 text-lg font-medium leading-relaxed">
              上传您的 “导入表” Excel 文件。我们将为您呈现多维度的实时可视化分析报告。
              <span className="block mt-2 text-sm text-slate-400 font-normal">您的数据仅在本地处理，隐私安全始终如一。</span>
            </p>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="group relative bg-slate-900 text-white px-12 py-5 rounded-2xl font-black text-lg hover:bg-indigo-600 transition-all shadow-2xl shadow-slate-200 active:scale-95 overflow-hidden"
            >
              <span className="relative z-10 flex items-center gap-3">
                <FileSpreadsheet className="w-6 h-6" />
                立即开启智能分析
              </span>
              <div className="absolute inset-0 bg-gradient-to-r from-indigo-600 to-blue-600 opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
          </div>
        ) : (

          <>
            <section className="bg-white/70 backdrop-blur-md rounded-3xl border border-slate-200/60 shadow-sm sticky top-[80px] z-[55] print:hidden overflow-visible premium-shadow transition-all hover:shadow-md">
              <div
                className="flex items-center justify-between p-5 cursor-pointer hover:bg-white/80 transition-colors"
                onClick={() => setIsSlicerVisible(!isSlicerVisible)}
              >
                <div className="flex items-center gap-3">
                  <div className="bg-indigo-50 p-2 rounded-xl">
                    <Filter className="w-5 h-5 text-indigo-600" />
                  </div>
                  <div>
                    <h3 className="font-black text-slate-800 uppercase tracking-widest text-xs">分析维度</h3>
                    <div className="flex items-center gap-2">
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">项目多维切片器</p>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleResetFilters();
                        }}
                        className="flex items-center gap-1.5 px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-lg transition-all text-[10px] font-black border border-indigo-100 shadow-sm hover:shadow active:scale-95 uppercase tracking-wider"
                        title="重置所有筛选维度到初始状态"
                      >
                        <RotateCcw className="w-3 h-3" />
                        一键重置
                      </button>
                    </div>
                  </div>
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
                      options={slicerOptions.ownerships}
                      selected={filters.ownerships}
                      onChange={(val) => { setFilters({ ...filters, ownerships: val }); setActivePresetId(null); }}
                    />
                    <Slicer
                      label="报表口径"
                      options={slicerOptions.reportCalibers}
                      selected={filters.reportCalibers}
                      onChange={(val) => { setFilters({ ...filters, reportCalibers: val }); setActivePresetId(null); }}
                    />
                    <Slicer
                      label="管理口径"
                      options={slicerOptions.managements}
                      selected={filters.managements}
                      onChange={(val) => { setFilters({ ...filters, managements: val }); setActivePresetId(null); }}
                    />
                    <Slicer
                      label="业态"
                      options={slicerOptions.propertyTypes}
                      selected={filters.propertyTypes}
                      onChange={(val) => { setFilters({ ...filters, propertyTypes: val }); setActivePresetId(null); }}
                    />
                    <Slicer
                      label="二级业态"
                      options={slicerOptions.secondaryPropertyTypes}
                      selected={filters.secondaryPropertyTypes}
                      onChange={(val) => { setFilters({ ...filters, secondaryPropertyTypes: val }); setActivePresetId(null); }}
                    />
                    <Slicer
                      label="项目编号"
                      options={slicerOptions.projectNos}
                      selected={filters.projectNos}
                      onChange={(val) => { setFilters({ ...filters, projectNos: val }); setActivePresetId(null); }}
                      showSearch
                    />
                    <Slicer
                      label="项目名称"
                      options={slicerOptions.projectNames}
                      selected={filters.projectNames}
                      onChange={(val) => { setFilters({ ...filters, projectNames: val }); setActivePresetId(null); }}
                      showSearch
                    />
                    <Slicer
                      label="项目简称"
                      options={slicerOptions.projectShortNames}
                      selected={filters.projectShortNames}
                      onChange={(val) => { setFilters({ ...filters, projectShortNames: val }); setActivePresetId(null); }}
                      showSearch
                    />
                    <Slicer
                      label="重点项目"
                      options={slicerOptions.isKeyProjects}
                      selected={filters.isKeyProjects}
                      onChange={(val) => { setFilters({ ...filters, isKeyProjects: val }); setActivePresetId(null); }}
                    />
                    <Slicer
                      label="现有项目"
                      options={slicerOptions.isExistingProjects}
                      selected={filters.isExistingProjects}
                      onChange={(val) => { setFilters({ ...filters, isExistingProjects: val }); setActivePresetId(null); }}
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
                  <h4 className="font-bold text-slate-700 text-sm">导入表 (切片器)</h4>
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
                <div className="p-4 pt-0 border-t border-slate-50 space-y-6">
                  {/* Section 1: Main Indicators (38) */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h5 className="text-xs font-black text-emerald-600 uppercase tracking-widest flex items-center gap-2">
                        <div className="w-1 h-3 bg-emerald-500 rounded-full" />
                        利润表项目
                      </h5>
                      <div className="flex gap-3">
                        <button
                          onClick={() => {
                            const group = categories.filter(c => MAIN_INDICATORS.includes(c));
                            setSelectedIndicators(Array.from(new Set([...selectedIndicators, ...group])));
                            setActivePresetId(null);
                          }}
                          className="text-[10px] font-bold text-blue-600 hover:underline"
                        >
                          全选
                        </button>
                        <button
                          onClick={() => {
                            const group = categories.filter(c => MAIN_INDICATORS.includes(c));
                            setSelectedIndicators(selectedIndicators.filter(i => !group.includes(i)));
                            setActivePresetId(null);
                          }}
                          className="text-[10px] font-bold text-slate-400 hover:underline"
                        >
                          清空
                        </button>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2">
                      {categories.filter(c => MAIN_INDICATORS.includes(c)).map(indicator => (
                        <IndicatorCheckbox
                          key={indicator}
                          indicator={indicator}
                          selectedIndicators={selectedIndicators}
                          onChange={(val) => {
                            if (val) setSelectedIndicators([...selectedIndicators, indicator]);
                            else setSelectedIndicators(selectedIndicators.filter(i => i !== indicator));
                            setActivePresetId(null);
                          }}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Section 2: Operating Metrics */}
                  {chartType !== 'pie' && (
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <h5 className="text-xs font-black text-blue-600 uppercase tracking-widest flex items-center gap-2">
                          <div className="w-1 h-3 bg-blue-500 rounded-full" />
                          经营指标
                        </h5>
                        <div className="flex gap-3">
                          <button
                            onClick={() => {
                              const group = categories.filter(c => OPERATING_METRICS.includes(c));
                              setSelectedIndicators(Array.from(new Set([...selectedIndicators, ...group])));
                              setActivePresetId(null);
                            }}
                            className="text-[10px] font-bold text-blue-600 hover:underline"
                          >
                            全选
                          </button>
                          <button
                            onClick={() => {
                              const group = categories.filter(c => OPERATING_METRICS.includes(c));
                              setSelectedIndicators(selectedIndicators.filter(i => !group.includes(i)));
                              setActivePresetId(null);
                            }}
                            className="text-[10px] font-bold text-slate-400 hover:underline"
                          >
                            清空
                          </button>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2">
                        {categories.filter(c => OPERATING_METRICS.includes(c)).map(indicator => (
                          <IndicatorCheckbox
                            key={indicator}
                            indicator={indicator}
                            selectedIndicators={selectedIndicators}
                            onChange={(val) => {
                              if (val) setSelectedIndicators([...selectedIndicators, indicator]);
                              else setSelectedIndicators(selectedIndicators.filter(i => i !== indicator));
                              setActivePresetId(null);
                            }}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Section 3: 3-Year Benefit Metrics */}
                  {chartType === 'table' && (
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <h5 className="text-xs font-black text-amber-600 uppercase tracking-widest flex items-center gap-2">
                          <div className="w-1 h-3 bg-amber-500 rounded-full" />
                          三年效益达标指标
                        </h5>
                        <div className="flex gap-3">
                          <button
                            onClick={() => {
                              const group = categories.filter(c => THREE_YEAR_BENEFIT_METRICS.includes(c));
                              setSelectedIndicators(Array.from(new Set([...selectedIndicators, ...group])));
                              setActivePresetId(null);
                            }}
                            className="text-[10px] font-bold text-blue-600 hover:underline"
                          >
                            全选
                          </button>
                          <button
                            onClick={() => {
                              const group = categories.filter(c => THREE_YEAR_BENEFIT_METRICS.includes(c));
                              setSelectedIndicators(selectedIndicators.filter(i => !group.includes(i)));
                              setActivePresetId(null);
                            }}
                            className="text-[10px] font-bold text-slate-400 hover:underline"
                          >
                            清空
                          </button>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2">
                        {categories.filter(c => THREE_YEAR_BENEFIT_METRICS.includes(c)).map(indicator => (
                          <IndicatorCheckbox
                            key={indicator}
                            indicator={indicator}
                            selectedIndicators={selectedIndicators}
                            onChange={(val) => {
                              if (val) setSelectedIndicators([...selectedIndicators, indicator]);
                              else setSelectedIndicators(selectedIndicators.filter(i => i !== indicator));
                              setActivePresetId(null);
                            }}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Section 4: Budget Metrics */}
                  {chartType === 'table' && (
                    <div className="mt-6">
                      <div className="flex items-center justify-between mb-3">
                        <h5 className="text-xs font-black text-rose-600 uppercase tracking-widest flex items-center gap-2">
                          <div className="w-1 h-3 bg-rose-500 rounded-full" />
                          预算指标
                        </h5>
                        <div className="flex gap-3">
                          <button
                            onClick={() => {
                              const group = categories.filter(c => BUDGET_METRICS.includes(c));
                              setSelectedIndicators(Array.from(new Set([...selectedIndicators, ...group])));
                              setActivePresetId(null);
                            }}
                            className="text-[10px] font-bold text-blue-600 hover:underline"
                          >
                            全选
                          </button>
                          <button
                            onClick={() => {
                              const group = categories.filter(c => BUDGET_METRICS.includes(c));
                              setSelectedIndicators(selectedIndicators.filter(i => !group.includes(i)));
                              setActivePresetId(null);
                            }}
                            className="text-[10px] font-bold text-slate-400 hover:underline"
                          >
                            清空
                          </button>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2">
                        {categories.filter(c => BUDGET_METRICS.includes(c)).map(indicator => (
                          <IndicatorCheckbox
                            key={indicator}
                            indicator={indicator}
                            selectedIndicators={selectedIndicators}
                            onChange={(val) => {
                              if (val) setSelectedIndicators([...selectedIndicators, indicator]);
                              else setSelectedIndicators(selectedIndicators.filter(i => i !== indicator));
                              setActivePresetId(null);
                            }}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Section 5: Business Metrics */}
                  {chartType === 'table' && (
                    <div className="mt-6">
                      <div className="flex items-center justify-between mb-3">
                        <h5 className="text-xs font-black text-indigo-600 uppercase tracking-widest flex items-center gap-2">
                          <div className="w-1 h-3 bg-indigo-500 rounded-full" />
                          业务指标
                        </h5>
                        <div className="flex gap-3">
                          <button
                            onClick={() => {
                              const group = categories.filter(c => BUSINESS_METRICS.includes(c));
                              setSelectedIndicators(Array.from(new Set([...selectedIndicators, ...group])));
                              setActivePresetId(null);
                            }}
                            className="text-[10px] font-bold text-blue-600 hover:underline"
                          >
                            全选
                          </button>
                          <button
                            onClick={() => {
                              const group = categories.filter(c => BUSINESS_METRICS.includes(c));
                              setSelectedIndicators(selectedIndicators.filter(i => !group.includes(i)));
                              setActivePresetId(null);
                            }}
                            className="text-[10px] font-bold text-slate-400 hover:underline"
                          >
                            清空
                          </button>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2">
                        {categories.filter(c => BUSINESS_METRICS.includes(c)).map(indicator => (
                          <IndicatorCheckbox
                            key={indicator}
                            indicator={indicator}
                            selectedIndicators={selectedIndicators}
                            onChange={(val) => {
                              if (val) setSelectedIndicators([...selectedIndicators, indicator]);
                              else setSelectedIndicators(selectedIndicators.filter(i => i !== indicator));
                              setActivePresetId(null);
                            }}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </section>

            {/* 已选指标排序微调面板 (Option 2) */}
            {selectedIndicators.length > 0 && (
              <section className="bg-white rounded-3xl border border-slate-200 p-5 shadow-sm print:hidden">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-1 h-3.5 bg-indigo-500 rounded-full" />
                    <h4 className="font-bold text-slate-800 text-sm flex items-center gap-2 flex-wrap">
                      已选指标顺序微调
                      <span className="text-xs text-slate-450 font-normal">
                        (共 {selectedIndicators.length} 个, 可通过左右箭头调整表格和图表中的显示位置)
                      </span>
                    </h4>
                  </div>
                  <button
                    onClick={() => {
                      const resetOrder = categories.filter(c => selectedIndicators.includes(c));
                      setSelectedIndicators(resetOrder);
                      setActivePresetId(null);
                    }}
                    className="self-end sm:self-auto text-xs font-bold text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100/80 px-3 py-1.5 rounded-xl transition-all active:scale-95 flex items-center gap-1.5"
                    title="将指标顺序恢复为系统财务科目的默认顺序"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    恢复系统默认排序
                  </button>
                </div>
                <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto p-3.5 bg-slate-50/50 rounded-2xl border border-slate-100 scrollbar-thin">
                  {selectedIndicators.map((indicator, index) => (
                    <div
                      key={indicator}
                      draggable
                      onDragStart={(e) => handleDragStart(e, index)}
                      onDragEnter={() => handleDragEnter(index)}
                      onDragOver={handleDragOver}
                      onDragEnd={handleDragEnd}
                      className={cn(
                        "group flex items-center gap-2 bg-white hover:bg-indigo-50/10 border border-slate-200 hover:border-indigo-200 px-3 py-1.5 rounded-xl shadow-xs hover:shadow-sm transition-all duration-200 select-none cursor-grab active:cursor-grabbing",
                        draggedIndex === index && "opacity-40 border-dashed border-indigo-400 bg-indigo-50/30 scale-95"
                      )}
                    >
                      <GripVertical className="w-3.5 h-3.5 text-slate-300 group-hover:text-indigo-400 transition-colors pointer-events-none" />
                      <span className="text-xs font-bold text-slate-700 select-none">
                        {indicator}
                      </span>
                      <div 
                        className="flex items-center gap-0.5 border-l border-slate-200 pl-1.5 ml-1"
                        onDragStart={(e) => e.stopPropagation()}
                      >
                        <button
                          onClick={() => {
                            if (index > 0) {
                              const newOrder = [...selectedIndicators];
                              [newOrder[index], newOrder[index - 1]] = [newOrder[index - 1], newOrder[index]];
                              setSelectedIndicators(newOrder);
                              setActivePresetId(null);
                            }
                          }}
                          disabled={index === 0}
                          className={`p-1 rounded-lg hover:bg-slate-100 active:scale-90 transition-all ${
                            index === 0 ? 'text-slate-200 cursor-not-allowed' : 'text-slate-500 hover:text-indigo-600'
                          }`}
                          title="前移/左移一列"
                        >
                          <ChevronLeft className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            if (index < selectedIndicators.length - 1) {
                              const newOrder = [...selectedIndicators];
                              [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]];
                              setSelectedIndicators(newOrder);
                              setActivePresetId(null);
                            }
                          }}
                          disabled={index === selectedIndicators.length - 1}
                          className={`p-1 rounded-lg hover:bg-slate-100 active:scale-90 transition-all ${
                            index === selectedIndicators.length - 1 ? 'text-slate-200 cursor-not-allowed' : 'text-slate-500 hover:text-indigo-600'
                          }`}
                          title="后移/右移一列"
                        >
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            setSelectedIndicators(selectedIndicators.filter(i => i !== indicator));
                            setActivePresetId(null);
                          }}
                          className="p-1 ml-0.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 active:scale-90 transition-all"
                          title="取消选择该指标"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {(chartType === 'bar' || chartType === 'pie') && (
              <div className="print:hidden">
                <MetricSelector
                  selected={selectedMetric}
                  onChange={setSelectedMetric}
                  options={timeGroupMetadata}
                  allowedKeys={chartType === 'pie' ? ['本年累计', '去年同期', '当月发生额', '上月发生额'] : undefined}
                />
              </div>
            )}

            <div
              className={cn(
                "bg-white rounded-3xl p-6 shadow-sm border border-slate-100",
                chartType !== 'table' && "print-area print-no-overflow"
              )}
              id="printable-chart"
              ref={chartRef}
            >
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
                  isRate={selectedIndicators.length > 0 && isRateMetric(selectedIndicators[0])}
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
                  categories={selectedIndicators.filter(cat => categories.includes(cat))}
                  selectedMonth={selectedMonth}
                  isIntegerMode={isIntegerMode}
                  setIsIntegerMode={setIsIntegerMode}
                  authState={authState}
                  checkAuth={checkAuth}
                  metricMetadata={metricMetadata}
                  timeGroupMetadata={timeGroupMetadata}
                />
              )}
              <div className={cn("flex justify-end gap-2 mt-2 pt-6 border-t border-slate-100 print:hidden", chartType === 'table' && "hidden")}>
                <button
                  onClick={exportChartToPDF}
                  className="flex items-center gap-2 bg-white text-slate-600 px-5 py-2.5 rounded-xl text-xs font-black hover:bg-slate-50 transition-all active:scale-95 border border-slate-200 shadow-sm"
                >
                  <Camera className="w-4 h-4 text-indigo-500" />
                  截图保存
                </button>
                <button
                  onClick={() => checkAuth(exportToExcel)}
                  className="flex items-center gap-2 bg-slate-900 text-white px-5 py-2.5 rounded-xl text-xs font-black hover:bg-indigo-600 transition-all shadow-lg active:scale-95"
                >
                  <Download className="w-4 h-4" />
                  导出报告
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

      <footer className="glass-card border-t border-slate-200/60 p-6 text-center mt-auto">
        <p className="text-[10px] text-slate-400 font-bold tracking-[0.3em] uppercase">
          内部机密数据分析系统 • 安全本地实例 • v2.0.4
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

      {exportProgress && exportProgress.active && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[999] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl border border-slate-100 flex flex-col items-center">
            <div className="relative w-20 h-20 mb-6 flex items-center justify-center">
              <div className="absolute inset-0 rounded-full border-4 border-slate-100 border-t-indigo-600 animate-spin"></div>
              <span className="text-sm font-black text-indigo-600">{exportProgress.percent}%</span>
            </div>
            
            <h3 className="text-lg font-black text-slate-800 mb-2">正在导出维度报表包</h3>
            <p className="text-sm text-slate-600 text-center mb-6">{exportProgress.status}</p>
            
            <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden mb-4">
              <div 
                className="bg-indigo-600 h-full rounded-full transition-all duration-300 shadow-sm shadow-indigo-200"
                style={{ width: `${exportProgress.percent}%` }}
              ></div>
            </div>
            
            <span className="text-[10px] text-amber-500 font-bold uppercase tracking-wider flex items-center gap-1.5 bg-amber-50 px-3.5 py-1.5 rounded-xl border border-amber-200/50">
              <AlertCircle className="w-3.5 h-3.5" />
              提示：浏览器连续下载多个文件时请允许
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

const IndicatorCheckbox: React.FC<{
  indicator: string;
  selectedIndicators: string[];
  onChange: (val: boolean) => void;
}> = ({ indicator, selectedIndicators, onChange }) => (
  <label
    className={cn(
      "flex items-center gap-3 p-2.5 rounded-xl border transition-all cursor-pointer select-none hover-lift",
      selectedIndicators.includes(indicator)
        ? "bg-indigo-50/50 border-indigo-200 ring-1 ring-indigo-100"
        : "bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50"
    )}
  >
    <input
      type="checkbox"
      className="hidden"
      checked={selectedIndicators.includes(indicator)}
      onChange={(e) => onChange(e.target.checked)}
    />
    <div className={cn(
      "w-4 h-4 rounded-lg border-2 flex items-center justify-center transition-all",
      selectedIndicators.includes(indicator) ? "bg-indigo-500 border-indigo-500 shadow-sm" : "bg-white border-slate-300 group-hover:border-indigo-300"
    )}>
      {selectedIndicators.includes(indicator) && <Check className="w-2.5 h-2.5 text-white stroke-[3]" />}
    </div>
    <span className={cn(
      "text-[11px] font-bold truncate transition-colors",
      selectedIndicators.includes(indicator) ? "text-indigo-900" : "text-slate-505"
    )}>
      {indicator}
    </span>
  </label>
);