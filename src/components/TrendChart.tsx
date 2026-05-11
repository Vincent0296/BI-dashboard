import React from 'react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Legend
} from 'recharts';
import { formatNumber } from '../lib/utils';

interface TrendChartProps {
  data: any[];
  indicators: string[];
  title: string;
  isIntegerMode: boolean;
  setIsIntegerMode: (val: boolean) => void;
  onLineClick: (category: string) => void;
  isRate: boolean;
}

export const TrendChart: React.FC<TrendChartProps> = ({ 
  data, 
  indicators, 
  title, 
  isIntegerMode, 
  setIsIntegerMode, 
  onLineClick,
  isRate
}) => {
  const colors = [
    '#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', 
    '#ec4899', '#06b6d4', '#14b8a6', '#f43f5e', '#84cc16'
  ];

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-4 border border-slate-100 shadow-xl rounded-lg max-w-[600px]">
          <p className="text-xs font-bold text-slate-500 mb-3 border-b border-slate-100 pb-2">{label}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-2">
            {payload.map((entry: any, index: number) => (
              <div key={index} className="flex items-center gap-2 text-sm">
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: entry.color }}></div>
                <span className="font-medium text-slate-600 truncate" style={{ maxWidth: '140px' }} title={entry.name}>{entry.name}:</span>
                <span className="font-bold text-slate-800 ml-auto whitespace-nowrap">
                  {formatNumber(entry.value, isRate, isIntegerMode)}
                </span>
              </div>
            ))}
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="w-full h-full bg-slate-50 p-4 sm:p-6 rounded-2xl border border-slate-100">
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-xl sm:text-2xl font-black text-slate-800 tracking-tight flex items-center gap-3">
          <span className="w-2 h-8 bg-indigo-600 rounded-full"></span>
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

      <div className="w-full pr-2 print:h-auto" style={{ height: 600 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={data}
            margin={{ top: 20, right: 30, left: 60, bottom: 60 }}
          >
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
            <XAxis 
              dataKey="month"
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#000000', fontSize: 11, fontWeight: 800 }}
              interval={0}
              angle={-45}
              textAnchor="end"
              height={60}
            />
            <YAxis 
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#000000', fontSize: 10, fontWeight: 700 }}
              tickFormatter={(val) => formatNumber(val, isRate, isIntegerMode)}
            />
            <Tooltip 
              content={<CustomTooltip />} 
              wrapperStyle={{ pointerEvents: 'auto', zIndex: 100 }} 
            />
            <Legend wrapperStyle={{ paddingTop: '20px' }} />
            {indicators.map((indicator, index) => (
              <Line
                key={indicator}
                type="natural"
                dataKey={indicator}
                stroke={colors[index % colors.length]}
                strokeWidth={3}
                dot={{ r: 4, strokeWidth: 2 }}
                activeDot={{ r: 6, onClick: () => onLineClick(indicator), style: { cursor: 'pointer' } }}
                name={indicator}
                onClick={() => onLineClick(indicator)}
                style={{ cursor: 'pointer' }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
