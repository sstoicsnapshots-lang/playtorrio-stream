import React from 'react';
import {
  Home,
  Film,
  Tv,
  Radio,
  Search,
  PlayCircle,
  Bookmark,
  History,
  Settings,
  Sparkles,
  ShieldCheck
} from 'lucide-react';

export type ViewType = 
  | 'home' 
  | 'movies' 
  | 'series' 
  | 'live' 
  | 'search' 
  | 'continue' 
  | 'favorites' 
  | 'history' 
  | 'settings';

interface SidebarProps {
  currentView: ViewType;
  onSelectView: (view: ViewType) => void;
  continueCount: number;
  favoritesCount: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  onSelectView,
  continueCount,
  favoritesCount
}) => {
  const mainNav = [
    { id: 'home' as ViewType, label: 'Home', icon: Home },
    { id: 'movies' as ViewType, label: 'Movies', icon: Film },
    { id: 'series' as ViewType, label: 'TV Shows', icon: Tv },
    { id: 'live' as ViewType, label: 'Live TV', icon: Radio, liveBadge: true },
    { id: 'search' as ViewType, label: 'Search', icon: Search }
  ];

  const libraryNav = [
    { 
      id: 'continue' as ViewType, 
      label: 'Continue Watching', 
      icon: PlayCircle, 
      badge: continueCount > 0 ? continueCount : undefined 
    },
    { 
      id: 'favorites' as ViewType, 
      label: 'Watchlist', 
      icon: Bookmark, 
      badge: favoritesCount > 0 ? favoritesCount : undefined 
    },
    { id: 'history' as ViewType, label: 'History', icon: History }
  ];

  return (
    <aside 
      id="sidebar-container"
      className="w-64 bg-[#0a0b0f] border-r border-[#1a1d26] flex flex-col h-screen select-none shrink-0 z-30 font-sans"
    >
      {/* Brand Header */}
      <div className="px-5 py-5 flex items-center justify-between border-b border-[#181a24]">
        <div className="flex items-center gap-3">
          <div className="relative w-9 h-9 rounded-xl overflow-hidden shadow-lg border border-[#2d3142]/60 shrink-0 bg-black">
            <img
              src="/src/assets/images/playtorrio_logo_1787849567596.jpg"
              alt="Playtorrio"
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
            />
          </div>
          <div>
            <div className="font-extrabold text-[15px] tracking-wider text-white flex items-center gap-1.5 leading-none">
              <span>PLAYTORRIO</span>
            </div>
            <div className="text-[10px] font-semibold tracking-wider text-slate-400 uppercase mt-1">
              Streaming Hub
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Sections */}
      <div className="flex-1 overflow-y-auto px-3 py-5 space-y-6 scrollbar-thin">
        {/* Main Nav */}
        <div>
          <div className="px-3 mb-2 text-[10px] font-extrabold uppercase tracking-widest text-[#717786]">
            Browse
          </div>
          <nav className="space-y-1">
            {mainNav.map((item) => {
              const Icon = item.icon;
              const active = currentView === item.id;
              return (
                <button
                  key={item.id}
                  id={`nav-${item.id}`}
                  onClick={() => onSelectView(item.id)}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all duration-150 cursor-pointer ${
                    active
                      ? 'bg-[#e50914] text-white shadow-lg shadow-red-950/40 font-bold'
                      : 'text-slate-400 hover:text-slate-100 hover:bg-[#141720]'
                  }`}
                >
                  <Icon className={`w-4 h-4 shrink-0 transition-colors ${active ? 'text-white' : 'text-slate-400'}`} />
                  <span className="flex-1 text-left truncate tracking-tight">{item.label}</span>
                  {item.liveBadge && (
                    <span className={`flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider ${
                      active ? 'bg-black/40 text-white' : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                    }`}>
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      Live
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Library Nav */}
        <div>
          <div className="px-3 mb-2 text-[10px] font-extrabold uppercase tracking-widest text-[#717786]">
            Library
          </div>
          <nav className="space-y-1">
            {libraryNav.map((item) => {
              const Icon = item.icon;
              const active = currentView === item.id;
              return (
                <button
                  key={item.id}
                  id={`nav-${item.id}`}
                  onClick={() => onSelectView(item.id)}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all duration-150 cursor-pointer ${
                    active
                      ? 'bg-[#e50914] text-white shadow-lg shadow-red-950/40 font-bold'
                      : 'text-slate-400 hover:text-slate-100 hover:bg-[#141720]'
                  }`}
                >
                  <Icon className={`w-4 h-4 shrink-0 transition-colors ${active ? 'text-white' : 'text-slate-400'}`} />
                  <span className="flex-1 text-left truncate tracking-tight">{item.label}</span>
                  {item.badge !== undefined && (
                    <span className={`px-1.5 py-0.2 text-[10px] font-mono font-bold rounded-md ${
                      active ? 'bg-black/40 text-white' : 'bg-[#1e2230] text-amber-300 border border-[#2d3246]'
                    }`}>
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Footer Settings */}
      <div className="p-3 border-t border-[#181a24] bg-[#0c0d12]">
        <button
          id="nav-settings"
          onClick={() => onSelectView('settings')}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
            currentView === 'settings'
              ? 'bg-[#1b1f2b] text-white border border-[#2c3245]'
              : 'text-slate-400 hover:text-slate-100 hover:bg-[#141720]'
          }`}
        >
          <Settings className="w-4 h-4 text-slate-400 shrink-0" />
          <div className="flex-1 text-left min-w-0">
            <div className="text-slate-200 text-xs font-semibold">Settings & Sources</div>
          </div>
        </button>
      </div>
    </aside>
  );
};
