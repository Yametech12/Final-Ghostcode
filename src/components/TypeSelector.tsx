import { useState, useRef, useEffect } from 'react';
import { Search, ChevronDown, Check } from 'lucide-react';
import { cn } from '../lib/utils';
import { personalityTypes } from '../data/personalityTypes';

interface TypeSelectorProps {
  value: string;
  onChange: (value: string) => void;
  label: string;
}

export default function TypeSelector({ value, onChange, label }: TypeSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedType = personalityTypes.find(t => t.id === value);

  const filteredTypes = personalityTypes.filter(t => 
    t.name.toLowerCase().includes(search.toLowerCase()) ||
    t.id.toLowerCase().includes(search.toLowerCase()) ||
    t.combination.toLowerCase().includes(search.toLowerCase())
  );

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="space-y-2" ref={containerRef}>
      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] ml-1">
        {label}
      </label>
      <div className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={cn(
            "w-full flex items-center justify-between px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-left transition-all",
            isOpen ? "border-accent-primary ring-2 ring-accent-primary/20" : "hover:border-white/20"
          )}
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-accent-primary/10 flex items-center justify-center text-accent-primary font-mono font-bold text-xs">
              {selectedType?.id}
            </div>
            <div>
              <div className="text-sm font-bold text-white">{selectedType?.name}</div>
              <div className="text-[10px] text-slate-500 font-medium">{selectedType?.combination}</div>
            </div>
          </div>
          <ChevronDown className={cn("w-4 h-4 text-slate-500 transition-transform", isOpen && "rotate-180")} />
        </button>

        {isOpen && (
          <div className="absolute z-50 w-full mt-2 bg-slate-900 border border-white/10 rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-2 border-bottom border-white/5">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  autoFocus
                  type="text"
                  placeholder="Search types..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg py-2 pl-10 pr-4 text-sm text-white focus:outline-none focus:border-accent-primary/50"
                />
              </div>
            </div>
            <div className="max-h-64 overflow-y-auto custom-scrollbar" data-lenis-prevent>
              {filteredTypes.map((type) => (
                <button
                  key={type.id}
                  onClick={() => {
                    onChange(type.id);
                    setIsOpen(false);
                    setSearch('');
                  }}
                  className={cn(
                    "w-full flex items-center justify-between px-4 py-3 hover:bg-white/5 transition-colors",
                    value === type.id && "bg-accent-primary/10"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-slate-400 font-mono font-bold text-xs">
                      {type.id}
                    </div>
                    <div className="text-left">
                      <div className="text-sm font-bold text-white">{type.name}</div>
                      <div className="text-[10px] text-slate-500 font-medium">{type.combination}</div>
                    </div>
                  </div>
                  {value === type.id && <Check className="w-4 h-4 text-accent-primary" />}
                </button>
              ))}
              {filteredTypes.length === 0 && (
                <div className="p-8 text-center text-slate-500 text-sm">
                  No types found
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
