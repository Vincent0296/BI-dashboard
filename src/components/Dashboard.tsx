import React, { useState, useMemo, useRef } from 'react';
import * as XLSX from 'xlsx';
import { FilterState, MetricKey, PerformanceItem, DataRecord } from '../types';
import { Slicer } from './Slicer';
import { MetricSelector } from './MetricSelector';
import { PerformanceChart } from './PerformanceChart';
import { Search, Filter, Calendar, Upload, FileSpreadsheet, AlertCircle, RotateCcw, ChevronDown, ChevronUp, Download, Camera } from 'lucide-react';
import { cn } from '../lib/utils';

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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chartRef = useRef<HTMLDivElement>(null);

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

  const getMetricLabel = (key: MetricKey) => {
    const labels: Record<string, string> = {
      YTD: '本年累计', LY: '去年同期', YoYDiff: '同比增减额', YoYPercent: '同比增减率',
      MTD: '当月发生额', PreMonth: '上月发生额', MoMDiff: '环比增减额', MoMPercent: '环比增减率'
    };
    return labels[key];
  };

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

  const exportChartToImage = () => {
    if (!chartRef.current) return;
    
    const svgElement = chartRef.current.querySelector('svg');
    if (!svgElement) return;

    // 1. 克隆并显式处理样式与命名空间
    const clonedSvg = svgElement.cloneNode(true) as SVGElement;
    const width = svgElement.clientWidth || 1000;
    const height = svgElement.clientHeight || 500;
    
    clonedSvg.setAttribute('width', width.toString());
    clonedSvg.setAttribute('height', height.toString());
    clonedSvg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    clonedSvg.style.backgroundColor = 'white';

    // 2. 转换为 Data URL (使用现代 UTF-8 兼容方案)
    const svgData = new XMLSerializer().serializeToString(clonedSvg);
    const svgBase64 = window.btoa(encodeURIComponent(svgData).replace(/%([0-9A-F]{2})/g, (match, p1) => {
      return String.fromCharCode(parseInt(p1, 16));
    }));
    const url = `data:image/svg+xml;base64,${svgBase64}`;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    
    const scale = 2; 
    canvas.width = width * scale;
    canvas.height = height * scale;

    img.onload = () => {
      if (ctx) {
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        
        const pngUrl = canvas.toDataURL('image/png', 1.0);
        const link = document.createElement('a');
        link.href = pngUrl;
        link.download = `BI_Chart_${selectedMonth}.png`;
        link.click();
      }
    };

    img.onerror = (err) => {
      console.error('SVG 图片加载失败，可能由于格式无效：', err);
      alert('图片生成失败，请检查控制台以获取更多信息。');
    };

    img.src = url;
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900">
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between sticky top-0 z-50 shadow-sm">
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
              }}
              className="flex items-center gap-2 bg-slate-100 text-slate-600 px-4 py-2 rounded-xl text-sm font-bold hover:bg-slate-200 transition-all active:scale-95"
            >
              <RotateCcw className="w-4 h-4" />
              一键重置
            </button>
          )}
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

          <div className="h-8 w-px bg-slate-200"></div>

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
            <section className="bg-white rounded-2xl border border-slate-200 shadow-sm sticky top-[73px] z-40">
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
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
                    <Slicer 
                      label="产权口径" 
                      options={[...new Set(sourceData.filter(d => 
                        filters.managements.includes(d.management) &&
                        filters.propertyTypes.includes(d.propertyType) &&
                        filters.projectNames.includes(d.projectName)
                      ).map(d => d.ownership))]} 
                      selected={filters.ownerships} 
                      onChange={(val) => setFilters({...filters, ownerships: val})} 
                    />
                    <Slicer 
                      label="管理口径" 
                      options={[...new Set(sourceData.filter(d => 
                        filters.ownerships.includes(d.ownership) &&
                        filters.propertyTypes.includes(d.propertyType) &&
                        filters.projectNames.includes(d.projectName)
                      ).map(d => d.management))]} 
                      selected={filters.managements} 
                      onChange={(val) => setFilters({...filters, managements: val})} 
                    />
                    <Slicer 
                      label="业务业态" 
                      options={[...new Set(sourceData.filter(d => 
                        filters.ownerships.includes(d.ownership) &&
                        filters.managements.includes(d.management) &&
                        filters.projectNames.includes(d.projectName)
                      ).map(d => d.propertyType))]} 
                      selected={filters.propertyTypes} 
                      onChange={(val) => setFilters({...filters, propertyTypes: val})} 
                    />
                    <Slicer 
                      label="项目名称" 
                      options={[...new Set(sourceData.filter(d => 
                        filters.ownerships.includes(d.ownership) &&
                        filters.managements.includes(d.management) &&
                        filters.propertyTypes.includes(d.propertyType)
                      ).map(d => d.projectName))]} 
                      selected={filters.projectNames} 
                      onChange={(val) => setFilters({...filters, projectNames: val})} 
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
                        onClick={(e) => { e.stopPropagation(); setSelectedIndicators(categories); }}
                        className="text-[10px] font-bold text-blue-600 hover:underline"
                      >
                        全选
                      </button>
                      <button 
                        onClick={(e) => { e.stopPropagation(); setSelectedIndicators([]); }}
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

            <MetricSelector 
              selected={selectedMetric} 
              onChange={setSelectedMetric} 
            />

            <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100" ref={chartRef}>
              <div className="flex items-center justify-between mb-6">
                <div className="w-1 h-8 bg-blue-600 rounded-full mr-4"></div>
                <div className="flex-1">
                  <h3 className="text-lg font-black text-slate-800">{`${selectedMonth} 多维指标 ${getMetricLabel(selectedMetric)} 排行`}</h3>
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={exportChartToImage}
                    className="flex items-center gap-2 bg-blue-50 text-blue-600 px-4 py-2 rounded-xl text-sm font-bold hover:bg-blue-100 transition-all active:scale-95 border border-blue-100"
                  >
                    <Camera className="w-4 h-4" />
                    保存图片
                  </button>
                  <button 
                    onClick={exportToExcel}
                    className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-emerald-700 transition-all shadow-md active:scale-95"
                  >
                    <Download className="w-4 h-4" />
                    导出报表
                  </button>
                </div>
              </div>
              <PerformanceChart 
                data={chartData} 
                title="" // Title is now handled by the header above
              />
            </div>

            {filteredData.length === 0 && (
              <div className="bg-amber-50 border border-amber-200 p-8 rounded-2xl text-center">
                <AlertCircle className="w-8 h-8 text-amber-600 mx-auto mb-4" />
                <h3 className="text-lg font-bold text-amber-900">未找到匹配数据</h3>
                <p className="text-amber-700">请尝试调整切片器选项以查看结果。</p>
              </div>
            )}
          </>
        )}
      </main>

      <footer className="bg-white border-t border-slate-200 p-4 text-center mt-auto">
        <p className="text-xs text-slate-400 font-bold tracking-widest uppercase">
          Confidential Data Analysis System • No Cloud Storage
        </p>
      </footer>
    </div>
  );
};
