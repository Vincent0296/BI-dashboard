import React, { useState, useMemo, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { ChevronLeft, ChevronRight, Download, Filter, Table as TableIcon } from 'lucide-react';
import { DataRecord, MetricKey } from '../types';
import { cn, formatNumber } from '../lib/utils';

interface MultiDimTableProps {
  data: DataRecord[];
  categories: string[];
  selectedMonth: string;
  isIntegerMode: boolean;
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
  { key: 'propertyType', label: '业务业态' },
  { key: 'projectName', label: '项目名称' },
] as const;

export const MultiDimTable: React.FC<MultiDimTableProps> = ({ 
  data, 
  categories, 
  selectedMonth,
  isIntegerMode 
}) => {
  const [selectedYDim, setSelectedYDim] = useState<typeof DIMENSIONS[number]['key']>('propertyType');
  const [selectedMetricGroups, setSelectedMetricGroups] = useState<MetricKey[]>(METRIC_GROUPS.map(g => g.key));
  const [currentPage, setCurrentPage] = useState(0);
  const itemsPerPage = 5; // Number of indicators per page

  const totalPages = Math.ceil(categories.length / itemsPerPage);

  useEffect(() => {
    if (currentPage >= totalPages && totalPages > 0) {
      setCurrentPage(totalPages - 1);
    }
  }, [categories.length, totalPages, currentPage]);

  const currentIndicators = categories.slice(currentPage * itemsPerPage, (currentPage + 1) * itemsPerPage);

  const dimValues = useMemo(() => {
    return Array.from(new Set(data.map(d => String(d[selectedYDim])))).sort();
  }, [data, selectedYDim]);

  const calculateValue = (dataSlice: DataRecord[], cat: string, metric: MetricKey) => {
    if (!selectedMonth || !selectedMonth.includes('-')) return 0;
    const [year, month] = selectedMonth.split('-').map(Number);
    const prevYear = year - 1;
    const pm = month === 1 ? { y: year - 1, m: 12 } : { y: year, m: month - 1 };

    const isYTD = (d: DataRecord, y: number, m: number) => {
      const [dy, dm] = d.month.split('-').map(Number);
      return dy === y && dm <= m;
    };
    const isMTD = (d: DataRecord, y: number, m: number) => d.month === `${y}-${m.toString().padStart(2, '0')}`;

    const sum = (items: DataRecord[]) => items.reduce((acc, curr) => acc + (curr.metrics[cat] || 0), 0);

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

  const tableData = useMemo(() => {
    return dimValues.map(dv => {
      const slice = data.filter(d => String(d[selectedYDim]) === dv);
      const metrics: Record<string, number> = {};
      
      selectedMetricGroups.forEach(group => {
        categories.forEach(cat => {
          metrics[`${group}_${cat}`] = calculateValue(slice, cat, group);
        });
      });
      
      return { dimValue: dv, metrics };
    });
  }, [data, dimValues, selectedYDim, selectedMetricGroups, categories, selectedMonth]);

  const totalRow = useMemo(() => {
    const metrics: Record<string, number> = {};
    selectedMetricGroups.forEach(group => {
      categories.forEach(cat => {
        metrics[`${group}_${cat}`] = calculateValue(data, cat, group);
      });
    });
    return metrics;
  }, [data, selectedMetricGroups, categories, selectedMonth]);

  const exportToExcel = () => {
    const header1 = ['维度', ...selectedMetricGroups.flatMap(g => Array(categories.length).fill(METRIC_GROUPS.find(mg => mg.key === g)?.label))];
    const header2 = ['', ...selectedMetricGroups.flatMap(() => categories)];
    
    const rows = tableData.map(row => [
      row.dimValue,
      ...selectedMetricGroups.flatMap(g => 
        categories.map(cat => {
          const val = row.metrics[`${g}_${cat}`];
          const isRate = g.includes('Percent');
          return isRate ? (val * 100).toFixed(2) + '%' : val;
        })
      )
    ]);

    const totalLine = [
      '合计',
      ...selectedMetricGroups.flatMap(g => 
        categories.map(cat => {
          const val = totalRow[`${g}_${cat}`];
          const isRate = g.includes('Percent');
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
              onClick={exportToExcel}
              className="flex items-center gap-2 bg-emerald-50 text-emerald-600 px-4 py-2 rounded-xl text-sm font-bold hover:bg-emerald-100 transition-all active:scale-95 border border-emerald-100"
            >
              <Download className="w-4 h-4" />
              Excel 导出
            </button>
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
                  onClick={() => setSelectedYDim(dim.key)}
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
            <div className="flex items-center gap-2 text-slate-500 font-bold text-xs uppercase tracking-widest">
              <Filter className="w-3.5 h-3.5" />
              X轴计算组多选
            </div>
            <div className="flex flex-wrap gap-2">
              {METRIC_GROUPS.map(group => (
                <label 
                  key={group.key}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer border",
                    selectedMetricGroups.includes(group.key)
                      ? "bg-blue-50 border-blue-200 text-blue-700"
                      : "bg-white border-slate-200 text-slate-400 hover:border-slate-300"
                  )}
                >
                  <input 
                    type="checkbox"
                    className="hidden"
                    checked={selectedMetricGroups.includes(group.key)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedMetricGroups([...selectedMetricGroups, group.key]);
                      } else {
                        setSelectedMetricGroups(selectedMetricGroups.filter(k => k !== group.key));
                      }
                    }}
                  />
                  <div className={cn(
                    "w-3 h-3 rounded-sm border",
                    selectedMetricGroups.includes(group.key) ? "bg-blue-500 border-blue-500" : "bg-white border-slate-300"
                  )} />
                  {group.label}
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
              <tr className="bg-slate-50/80">
                <th className="p-4 border-b border-r border-slate-200 text-slate-500 font-bold text-xs sticky left-0 bg-slate-50 z-20 w-48">
                  维度 \ 计算组
                </th>
                {selectedMetricGroups.map(group => (
                  <th 
                    key={group} 
                    colSpan={currentIndicators.length}
                    className="p-3 border-b border-r border-slate-200 text-indigo-700 font-black text-xs text-center uppercase tracking-widest bg-indigo-50/30"
                  >
                    {METRIC_GROUPS.find(mg => mg.key === group)?.label}
                  </th>
                ))}
              </tr>
              {/* Level 2 Header */}
              <tr className="bg-white">
                <th className="p-4 border-b border-r border-slate-200 text-slate-800 font-black text-sm sticky left-0 bg-white z-20">
                  {DIMENSIONS.find(d => d.key === selectedYDim)?.label}
                </th>
                {selectedMetricGroups.map(group => (
                  currentIndicators.map(cat => (
                    <th 
                      key={`${group}_${cat}`}
                      className="p-3 border-b border-r border-slate-100 text-slate-600 font-bold text-[10px] bg-white min-w-[120px]"
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
                    currentIndicators.map(cat => {
                      const val = row.metrics[`${group}_${cat}`];
                      const isRate = group.includes('Percent');
                      return (
                        <td 
                          key={`${group}_${cat}`}
                          className={cn(
                            "p-3 border-b border-r border-slate-50 text-sm font-medium",
                            isRate ? (val >= 0 ? "text-emerald-600" : "text-rose-600") : "text-slate-600"
                          )}
                        >
                          {formatNumber(val, isRate, isIntegerMode)}
                        </td>
                      );
                    })
                  ))}
                </tr>
              ))}
              {/* Total Row */}
              <tr className="bg-indigo-50/30 font-black">
                <td className="p-4 border-b border-r border-indigo-100 text-indigo-700 text-sm sticky left-0 bg-indigo-50 z-10">
                  合计
                </td>
                {selectedMetricGroups.map(group => (
                  currentIndicators.map(cat => {
                    const val = totalRow[`${group}_${cat}`];
                    const isRate = group.includes('Percent');
                    return (
                      <td 
                        key={`${group}_${cat}`}
                        className={cn(
                          "p-3 border-b border-r border-indigo-100 text-sm",
                          isRate ? (val >= 0 ? "text-emerald-700" : "text-rose-700") : "text-indigo-700"
                        )}
                      >
                        {formatNumber(val, isRate, isIntegerMode)}
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
