import React from 'react';
import { 
  PieChart, 
  Pie, 
  Cell, 
  Tooltip, 
  Legend, 
  ResponsiveContainer 
} from 'recharts';
import { formatNumber } from '../lib/utils';
import { PerformanceItem } from '../types';

interface PieChartWidgetProps {
  data: PerformanceItem[];
  title: string;
  isIntegerMode: boolean;
  setIsIntegerMode: (val: boolean) => void;
  onPieClick: (category: string) => void;
  isRate: boolean;
}

export const PieChartWidget: React.FC<PieChartWidgetProps> = ({ 
  data, 
  title, 
  isIntegerMode, 
  setIsIntegerMode, 
  onPieClick,
  isRate
}) => {
  const colors = [
    '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', 
    '#06b6d4', '#ec4899', '#14b8a6', '#f43f5e', '#84cc16'
  ];

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const entry = payload[0];
      return (
        <div className="bg-white p-3 border border-slate-100 shadow-xl rounded-lg">
          <p className="font-bold text-slate-800 mb-1">{entry.name}</p>
          <p className="text-sm text-slate-600 flex items-center gap-2">
            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.payload.fill }}></span>
            <span>数值:</span>
            <span className="font-bold">{formatNumber(entry.payload.originalValue, isRate, isIntegerMode)}</span>
          </p>
        </div>
      );
    }
    return null;
  };

  const pieData = data.map(d => ({
    name: d.category,
    value: Math.max(0, d.value),
    originalValue: d.value
  }));

  return (
    <div className="w-full h-full bg-slate-50 p-4 sm:p-6 rounded-2xl border border-slate-100">
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-xl sm:text-2xl font-black text-slate-800 tracking-tight flex items-center gap-3">
          <span className="w-2 h-8 bg-purple-600 rounded-full"></span>
          {title}
        </h2>
        <div className="flex items-center gap-6">
          <button
            onClick={() => setIsIntegerMode(!isIntegerMode)}
            className="px-3 py-1.5 text-[11px] font-bold rounded-lg border transition-all hover:opacity-80 active:scale-95"
            style={{
              borderColor: isIntegerMode ? '#3b82f6' : '#e2e8f0',
              backgroundColor: isIntegerMode ? '#eff6ff' : '#ffffff',
              color: isIntegerMode ? '#1d4ed8' : '#64748b'
            }}
          >
            {isIntegerMode ? '恢复默认' : '切换整数显示'}
          </button>
        </div>
      </div>

      <div className="w-full h-[500px] print:h-auto">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
            <Pie
              data={pieData}
              cx="50%"
              cy="50%"
              innerRadius={80}
              outerRadius={160}
              paddingAngle={2}
              dataKey="value"
              nameKey="name"
              label={({ name, percent }) => `${name} ${(percent * 100).toFixed(1)}%`}
              labelLine={{ stroke: '#94a3b8', strokeWidth: 1 }}
              onClick={(e) => onPieClick(e.name)}
              style={{ cursor: 'pointer' }}
            >
              {pieData.map((entry, index) => (
                <Cell 
                  key={`cell-${index}`} 
                  fill={colors[index % colors.length]} 
                  className="hover:opacity-80 transition-opacity outline-none"
                />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ paddingTop: '20px' }} />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
