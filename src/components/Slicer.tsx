import React, { useState } from 'react';
import { Check, ChevronDown, Search, X } from 'lucide-react';
import { cn } from '../lib/utils';

interface SlicerProps {
  label: string;
  options: string[];
  selected: string[];
  onChange: (selected: string[]) => void;
  showSearch?: boolean;
}

export const Slicer: React.FC<SlicerProps> = ({ 
  label, 
  options, 
  selected, 
  onChange, 
  showSearch = false 
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const filteredOptions = options.filter(opt => 
    opt.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const toggleOption = (option: string) => {
    if (selected.includes(option)) {
      onChange(selected.filter(i => i !== option));
    } else {
      onChange([...selected, option]);
    }
  };

  const handleSelectAll = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(options);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange([]);
  };

  return (
    <div className="relative inline-block w-full">
      <label className="block text-xs font-medium text-slate-500 mb-1 ml-1">{label}</label>
      <button
        id={`slicer-${label.replace(/\s+/g, '-')}`}
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex items-center justify-between w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg shadow-sm hover:border-blue-400 transition-all",
          isOpen && "ring-2 ring-blue-100 border-blue-500"
        )}
      >
        <span className="truncate text-slate-700">
          {selected.length === 0 ? '未选择' : 
           selected.length === options.length ? '全部已选' : 
           `已选 ${selected.length} A项`}
        </span>
        <ChevronDown className={cn("w-4 h-4 text-slate-400 transition-transform", isOpen && "rotate-180")} />
      </button>

      {isOpen && (
        <>
          <div 
            className="fixed inset-0 z-10" 
            onClick={() => setIsOpen(false)} 
          />
          <div className="absolute left-0 z-20 w-full mt-2 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-2 border-b border-slate-100 flex items-center justify-between gap-2">
              <div className="flex gap-1">
                <button 
                  onClick={handleSelectAll}
                  className="px-2 py-1 text-[10px] font-bold text-blue-600 bg-blue-50 rounded hover:bg-blue-100 uppercase"
                >
                  全选
                </button>
                <button 
                  onClick={handleClear}
                  className="px-2 py-1 text-[10px] font-bold text-slate-500 bg-slate-100 rounded hover:bg-slate-200 uppercase"
                >
                  清除
                </button>
              </div>
              {selected.length > 0 && (
                <span className="text-[10px] text-slate-400 bg-slate-50 px-2 py-0.5 rounded-full">
                  已选 {selected.length}
                </span>
              )}
            </div>

            {showSearch && (
              <div className="p-2 border-b border-slate-50 bg-slate-50/50">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="搜索项目..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white"
                  />
                </div>
              </div>
            )}

            <div className="max-h-60 overflow-y-auto p-1 custom-scrollbar">
              {filteredOptions.length === 0 ? (
                <div className="py-8 text-center text-slate-400 text-xs italic">无匹配项</div>
              ) : (
                filteredOptions.map((option) => (
                  <button
                    key={option}
                    onClick={() => toggleOption(option)}
                    className={cn(
                      "flex items-center justify-between w-full px-3 py-2 text-xs rounded-md text-left transition-colors",
                      selected.includes(option) ? "bg-blue-50 text-blue-700" : "hover:bg-slate-50 text-slate-600"
                    )}
                  >
                    <span className="truncate">{option}</span>
                    {selected.includes(option) && <Check className="w-3.5 h-3.5" />}
                  </button>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
