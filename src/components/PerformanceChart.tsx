import React from 'react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Cell,
  LabelList
} from 'recharts';
import { PerformanceItem } from '../types';
import { formatNumber, isMoneyMetric } from '../lib/utils';

interface PerformanceChartProps {
  data: PerformanceItem[];
  title: string;
  isIntegerMode: boolean;
  setIsIntegerMode: (val: boolean) => void;
  onBarClick: (category: string) => void;
}

export const PerformanceChart: React.FC<PerformanceChartProps> = ({ data, title, isIntegerMode, setIsIntegerMode, onBarClick }) => {
  const isRate = data.length > 0 && data[0].isPercent;
  const isWanYuan = data.length > 0 && data[0].isWanYuan;
  // Use color coding if it's a rate OR a comparison metric (YoY/MoM Diff)
  const isComparison = isRate || title.includes('增减额') || title.includes('对比');

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const value = payload[0].value;
      const isNegative = value < 0;
      const shouldColor = isComparison && value !== 0;
      return (
        <div className="bg-white p-3 border border-slate-100 shadow-xl rounded-lg">
          <p className="text-xs font-bold text-slate-500 mb-1">{label}</p>
          <p className={`text-lg font-black ${shouldColor ? (isNegative ? 'text-red-500' : 'text-emerald-500') : 'text-slate-800'}`}>
            {formatNumber(value, isRate, isIntegerMode, isWanYuan)}
          </p>
        </div>
      );
    }
    return null;
  };

  const renderCustomLabel = (props: any) => {
    const { x, y, width, height, value } = props;
    const isNegative = value < 0;
    const shouldColor = isComparison && value !== 0;
    const color = shouldColor ? (isNegative ? '#ef4444' : '#10b981') : '#64748b';
    const displayVal = formatNumber(value, isRate, isIntegerMode, isWanYuan);

    // For vertical bars: x is bar position, y is bar start, height is bar length
    const labelX = x + width / 2;
    const labelY = isNegative ? y + height + 12 : y - 8;

    return (
      <text 
        x={labelX} 
        y={labelY} 
        fill={color} 
        textAnchor="middle"
        className="text-[10px] font-black tracking-tighter"
        stroke="#ffffff"
        strokeWidth={3}
        paintOrder="stroke"
        strokeLinejoin="round"
      >
        {displayVal}
      </text>
    );
  };

  return (
    <div className="w-full h-full bg-slate-50 p-4 sm:p-6 rounded-2xl border border-slate-100">
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-xl sm:text-2xl font-black text-slate-800 tracking-tight flex items-center gap-3">
          <span className="w-2 h-8 bg-blue-600 rounded-full"></span>
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
          
          {isComparison && (
            <div className="flex gap-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500"></span> 增长/正向</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-500"></span> 下降/负向</span>
            </div>
          )}
        </div>
      </div>

      <div className="w-full pr-2 print:h-auto" style={{ height: 600 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            layout="horizontal"
            data={data}
            margin={{ top: 80, right: 30, left: 60, bottom: 100 }}
            barSize={40}
          >
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
            <XAxis 
              type="category"
              dataKey="category"
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#000000', fontSize: 11, fontWeight: 800 }}
              interval={0}
              angle={-45}
              textAnchor="end"
              height={80}
            />
            <YAxis 
              type="number"
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#000000', fontSize: 10, fontWeight: 700 }}
              tickFormatter={(val) => formatNumber(val, isRate, isIntegerMode)}
              hide={isComparison}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(59, 130, 246, 0.05)' }} />
            <Bar dataKey="value" radius={[4, 4, 0, 0]} onClick={(data) => onBarClick(data.category)} className="cursor-pointer">
              {data.map((entry, index) => {
                const isNegative = entry.value < 0;
                const shouldColor = isComparison && entry.value !== 0;
                let color = '#3b82f6';
                if (shouldColor) {
                  color = isNegative ? '#ef4444' : '#10b981';
                } else {
                  const colors = ['#1d4ed8', '#2563eb', '#3b82f6', '#60a5fa', '#93c5fd'];
                  color = colors[index % colors.length];
                }
                return <Cell key={`cell-${index}`} fill={color} fillOpacity={0.8} />;
              })}
              <LabelList dataKey="value" content={renderCustomLabel} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
