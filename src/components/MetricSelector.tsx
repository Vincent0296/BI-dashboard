import React from 'react';
import { MetricKey } from '../types';
import { cn } from '../lib/utils';
import { BarChart2 } from 'lucide-react';

interface MetricSelectorProps {
  selected: MetricKey;
  onChange: (key: MetricKey) => void;
  allowedKeys?: MetricKey[];
}

const METRICS: { key: MetricKey; label: string }[] = [
  { key: 'YTD', label: '本年累计 (YTD)' },
  { key: 'LY', label: '去年同期 (LY)' },
  { key: 'YoYDiff', label: '同比增减额' },
  { key: 'YoYPercent', label: '同比增减率' },
  { key: 'MTD', label: '当月发生额' },
  { key: 'PreMonth', label: '上月发生额' },
  { key: 'MoMDiff', label: '环比增减额' },
  { key: 'MoMPercent', label: '环比增减率' },
];

export const MetricSelector: React.FC<MetricSelectorProps> = ({ selected, onChange, allowedKeys }) => {
  return (
    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <BarChart2 className="w-5 h-5 text-blue-600" />
        <h3 className="font-bold text-slate-800">指标选择器</h3>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-2">
        {METRICS.filter(m => !allowedKeys || allowedKeys.includes(m.key)).map((m) => (
          <button
            key={m.key}
            onClick={() => onChange(m.key)}
            className={cn(
              "px-3 py-2 text-xs font-medium rounded-lg border transition-all h-full text-center flex items-center justify-center",
              selected === m.key
                ? "bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-100"
                : "bg-white text-slate-600 border-slate-200 hover:border-blue-400 hover:bg-blue-50"
            )}
          >
            {m.label}
          </button>
        ))}
      </div>
    </div>
  );
};
