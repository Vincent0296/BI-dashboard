import React from 'react';
import { cn } from '../lib/utils';
import { BarChart2 } from 'lucide-react';
import { TimeGroupMetadata } from '../types';

interface MetricSelectorProps {
  selected: string;
  onChange: (key: string) => void;
  options: TimeGroupMetadata[];
  allowedKeys?: string[];
}

export const MetricSelector: React.FC<MetricSelectorProps> = ({ selected, onChange, options, allowedKeys }) => {
  const visibleOptions = options.filter(o => !allowedKeys || allowedKeys.includes(o.name));

  return (
    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <BarChart2 className="w-5 h-5 text-blue-600" />
        <h3 className="font-bold text-slate-800">计算组选择器 (时间维度)</h3>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-2">
        {visibleOptions.map((o) => (
          <button
            key={o.name}
            onClick={() => onChange(o.name)}
            className={cn(
              "px-3 py-2 text-xs font-medium rounded-lg border transition-all h-full text-center flex items-center justify-center",
              selected === o.name
                ? "bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-100"
                : "bg-white text-slate-600 border-slate-200 hover:border-blue-400 hover:bg-blue-50"
            )}
          >
            {o.name}
          </button>
        ))}
      </div>
    </div>
  );
};
