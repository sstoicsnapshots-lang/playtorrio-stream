import React from 'react';
import { Search, Radio, X } from 'lucide-react';
import { ViewType } from './Sidebar';

interface HeaderProps {
  query: string;
  onQueryChange: (query: string) => void;
  onSelectView: (view: ViewType) => void;
  liveCount?: number;
}

export const Header: React.FC<HeaderProps> = ({
  query,
  onQueryChange,
  onSelectView,
  liveCount = 0
}) => {
  const setQuery = (v: string) => {
    onQueryChange(v);
    if (v.trim()) onSelectView('search');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) onSelectView('search');
  };

  return (
    <header 
      id="main-header"
      className="h-16 px-8 border-b border-[#181a24] bg-[#090a0e]/95 backdrop-blur-xl flex items-center justify-between sticky top-0 z-20"
    >
      {/* Search Input Bar — the single global search entry point */}
      <form onSubmit={handleSubmit} className="flex-1 max-w-xl">
        <div className="relative">
          <Search className="w-4 h-4 text-[#8a91a0] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            id="global-search-input"
            type="text"
            placeholder="Search titles, directors, actors, anime, live channels..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full bg-[#11131a] text-xs text-slate-100 placeholder-[#5b6170] pl-10 pr-9 py-2.5 rounded-xl border border-[#222634] focus:outline-none focus:border-[#d97706]/70 focus:bg-[#151822] transition-all font-sans font-medium"
          />
          {query && (
            <button
              type="button"
              onClick={() => onQueryChange('')}
              className="w-5 h-5 rounded-md bg-white/10 text-slate-400 hover:text-white absolute right-3 top-1/2 -translate-y-1/2 flex items-center justify-center cursor-pointer"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </form>

      {/* Right Header Status & Shortcuts */}
      <div className="flex items-center gap-3">
        {/* Live Broadcast Badge */}
        <button
          id="header-live-badge"
          onClick={() => onSelectView('live')}
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#141722] border border-[#252a3a] text-slate-200 text-xs font-semibold hover:bg-[#1b2030] transition-all cursor-pointer"
        >
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <Radio className="w-3.5 h-3.5 text-emerald-400" />
          <span>Live TV</span>
          {liveCount > 0 && (
            <span className="px-1.5 py-0.2 rounded-md bg-[#e50914] text-white font-bold text-[10px]">
              {liveCount}
            </span>
          )}
        </button>
      </div>
    </header>
  );
};
