import React, { useState } from 'react';
import { Check, ChevronDown, Search, X, Filter } from 'lucide-react';
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
    <div className="relative inline-block w-full group">
      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1 transition-colors group-hover:text-indigo-500">{label}</label>
      <button
        id={`slicer-${label.replace(/\s+/g, '-')}`}
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex items-center justify-between w-full px-4 py-2.5 text-sm bg-white/50 backdrop-blur-sm border border-slate-200 rounded-xl transition-all hover:bg-white hover:border-indigo-300 hover:shadow-md active:scale-[0.98]",
          isOpen && "ring-4 ring-indigo-50 border-indigo-500 bg-white shadow-lg shadow-indigo-100/50"
        )}
      >
        <span className={cn(
          "truncate font-bold",
          selected.length === 0 ? "text-slate-400 font-medium" : "text-slate-700"
        )}>
          {selected.length === 0 ? '未选择' : 
           selected.length === options.length ? '全部已选' : 
           `已选 ${selected.length} 个`}
        </span>
        <ChevronDown className={cn("w-4 h-4 text-slate-400 transition-transform duration-300", isOpen && "rotate-180 text-indigo-500")} />
      </button>

      {isOpen && (
        <>
          <div 
            className="fixed inset-0 z-10" 
            onClick={() => setIsOpen(false)} 
          />
          <div className="absolute left-0 z-20 w-full mt-2 bg-white/95 backdrop-blur-xl border border-slate-200 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 slide-in-from-top-2 duration-300">
            <div className="p-3 border-b border-slate-100 flex items-center justify-between gap-2 bg-slate-50/50">
              <div className="flex gap-1.5">
                <button 
                  onClick={handleSelectAll}
                  className="px-2.5 py-1 text-[10px] font-black text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors uppercase tracking-wider"
                >
                  全选
                </button>
                <button 
                  onClick={handleClear}
                  className="px-2.5 py-1 text-[10px] font-black text-slate-500 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors uppercase tracking-wider"
                >
                  清除
                </button>
              </div>
              {selected.length > 0 && (
                <span className="text-[10px] font-black text-indigo-500 bg-indigo-50/50 px-2.5 py-1 rounded-full border border-indigo-100/50 animate-pulse">
                  已选择 {selected.length} 项
                </span>
              )}
            </div>

            {showSearch && (
              <div className="p-3 border-b border-slate-50">
                <div className="relative group">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 transition-colors group-focus-within:text-indigo-500" />
                  <input
                    type="text"
                    placeholder="搜索维度成员..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 text-xs font-bold border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 bg-slate-50/30 transition-all"
                  />
                </div>
              </div>
            )}

            <div className="max-h-60 overflow-y-auto p-1.5 custom-scrollbar">
              {filteredOptions.length === 0 ? (
                <div className="py-12 flex flex-col items-center justify-center gap-2 text-slate-400">
                  <Filter className="w-8 h-8 opacity-20" />
                  <div className="text-[10px] font-bold uppercase tracking-widest italic">未找到匹配项</div>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-0.5">
                  {filteredOptions.map((option) => (
                    <button
                      key={option}
                      onClick={() => toggleOption(option)}
                      className={cn(
                        "flex items-center justify-between w-full px-4 py-2.5 text-xs rounded-xl text-left transition-all group/opt",
                        selected.includes(option) 
                          ? "bg-indigo-50 text-indigo-700 font-bold" 
                          : "hover:bg-slate-50 text-slate-600 font-medium"
                      )}
                    >
                      <span className="truncate">{option}</span>
                      {selected.includes(option) ? (
                        <div className="w-4 h-4 bg-indigo-500 rounded-full flex items-center justify-center animate-in zoom-in duration-200 shadow-sm">
                          <Check className="w-2.5 h-2.5 text-white stroke-[3]" />
                        </div>
                      ) : (
                        <div className="w-4 h-4 border-2 border-slate-200 rounded-full group-hover/opt:border-indigo-300 transition-colors" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

