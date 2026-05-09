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
import { formatNumber } from '../lib/utils';

interface PerformanceChartProps {
  data: PerformanceItem[];
  title: string;
}

export const PerformanceChart: React.FC<PerformanceChartProps> = ({ data, title }) => {
  const isRate = data.length > 0 && data[0].isPercent;
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
            {formatNumber(value, isRate)}
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
    const displayVal = formatNumber(value, isRate);

    // Recharts layout: for horizontal bars, x is the starting point of the bar.
    // If value is positive, bar goes from x to x+width.
    // If value is negative, bar goes from x+width to x.
    const labelX = isNegative ? x + width - 5 : x + width + 5;
    const anchor = isNegative ? 'end' : 'start';

    return (
      <text 
        x={labelX} 
        y={y + height / 2 + 4} 
        fill={color} 
        textAnchor={anchor} 
        className="text-[10px] font-bold font-mono"
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
        {isComparison && (
          <div className="flex gap-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500"></span> 增长/正向</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-500"></span> 下降/负向</span>
          </div>
        )}
      </div>

      <div className="w-full overflow-y-auto pr-2" style={{ height: Math.max(600, data.length * 40) }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            layout="vertical"
            data={data}
            margin={{ top: 20, right: 120, left: 180, bottom: 20 }}
            barSize={20}
          >
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
            <XAxis 
              type="number"
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#94a3b8', fontSize: 10 }}
              tickFormatter={(val) => formatNumber(val, isRate)}
              hide={isComparison}
            />
            <YAxis 
              type="category"
              dataKey="category"
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#64748b', fontSize: 11, fontWeight: 600 }}
              width={170}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(59, 130, 246, 0.05)' }} />
            <Bar dataKey="value" radius={[0, 4, 4, 0]}>
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
