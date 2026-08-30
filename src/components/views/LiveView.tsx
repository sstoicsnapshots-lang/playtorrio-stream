import React, { useState, useEffect, useMemo } from 'react';
import {
  Radio,
  Search,
  Trophy,
  Play,
  RefreshCw,
  Clock,
  SlidersHorizontal,
  Flame,
  Tv
} from 'lucide-react';
import { LiveEvent } from '../../types/media';
import { api } from '../../services/api';
import { cleanEventTitle } from '../../services/text';

interface LiveViewProps {
  onPlayLiveEvent: (event: LiveEvent) => void;
}

const MASTER_CATEGORIES = [
  'All',
  'Live TV',
  'News',
  'Sports',
  'Football/Soccer',
  'Basketball',
  'Motorsports',
  'Entertainment',
  'Kids',
  'Documentary',
  'Music',
  'Other'
] as const;

function isBettingContent(title: string, category: string, league?: string): boolean {
  const combined = `${title} ${category} ${league || ''}`.toLowerCase();
  const bettingKeywords = [
    'betting', 'sportsgrid', 'in-game betting', 'sports betting',
    'betway', 'draftkings', 'fanduel', 'bookmaker', 'casino',
    'pokerstars live betting', 'wagering', 'odds line', 'picks & parlays'
  ];
  return bettingKeywords.some(kw => combined.includes(kw));
}

function normalizeCategory(rawCategory: string, title = '', league = '', provider = ''): string {
  const c = (rawCategory || '').trim().toLowerCase();
  const t = (title || '').trim().toLowerCase();
  const l = (league || '').trim().toLowerCase();
  const combined = `${c} ${t} ${l}`;

  if (
    c.includes('soccer') || c.includes('football') || c.includes('futbol') ||
    c.includes('premier league') || c.includes('epl') || c.includes('champions league') ||
    c.includes('ucl') || c.includes('la liga') || c.includes('serie a') ||
    c.includes('bundesliga') || c.includes('ligue 1') || c.includes('mls') ||
    c.includes('fifa') || c.includes('uefa') || c.includes('copa') ||
    combined.includes('premier league') || combined.includes('champions league') ||
    combined.includes('la liga') || combined.includes('serie a') ||
    combined.includes('manchester city') || combined.includes('liverpool') ||
    combined.includes('real madrid') || combined.includes('bayern munich') ||
    combined.includes('fc barcelona') || combined.includes('arsenal')
  ) {
    if (combined.includes('nfl') || combined.includes('super bowl') || combined.includes('american football')) {
      return 'Sports';
    }
    return 'Football/Soccer';
  }

  if (
    c.includes('basketball') || c.includes('nba') || c.includes('wnba') ||
    c.includes('euroleague') || c.includes('fiba') || combined.includes('nba') ||
    combined.includes('lakers') || combined.includes('celtics') || combined.includes('warriors')
  ) {
    return 'Basketball';
  }

  if (
    c.includes('motorsport') || c.includes('racing') || c.includes('formula 1') ||
    c.includes('f1') || c.includes('motogp') || c.includes('nascar') ||
    c.includes('indycar') || c.includes('rally') || c.includes('wrc') ||
    c.includes('superbike') || combined.includes('formula 1') || combined.includes('motogp') ||
    combined.includes('nascar') || combined.includes('motor racing') || combined.includes('extreme sports')
  ) {
    return 'Motorsports';
  }

  if (
    c.includes('news') || c.includes('headline') || c.includes('journalism') ||
    c.includes('politics') || combined.includes('sky news') || combined.includes('bbc news') ||
    combined.includes('bloomberg') || combined.includes('france 24') || combined.includes('dw news') ||
    combined.includes('euronews') || combined.includes('al jazeera') || combined.includes('cbs news') ||
    combined.includes('abc news') || combined.includes('nbc news')
  ) {
    return 'News';
  }

  if (
    c.includes('kid') || c.includes('cartoon') || c.includes('animation') ||
    c.includes('anime') || c.includes('disney') || c.includes('nickelodeon') ||
    combined.includes('cartoon') || combined.includes('pokemon') || combined.includes('pokémon') ||
    combined.includes('lego') || combined.includes('kidoodle') || combined.includes('toonami')
  ) {
    return 'Kids';
  }

  if (
    c.includes('documentary') || c.includes('documentaries') || c.includes('doc') ||
    c.includes('history') || c.includes('discovery') || c.includes('national geographic') ||
    c.includes('nat geo') || c.includes('nature') || c.includes('wildlife') ||
    c.includes('science') || c.includes('space') || combined.includes('nasa') ||
    combined.includes('documentary') || combined.includes('smithsonian') ||
    combined.includes('love nature') || combined.includes('magellan')
  ) {
    return 'Documentary';
  }

  if (
    c.includes('music') || c.includes('mtv') || c.includes('concert') ||
    c.includes('vevo') || c.includes('radio') || combined.includes('music') ||
    combined.includes('vevo') || combined.includes('qello') || combined.includes('clubbing tv')
  ) {
    return 'Music';
  }

  if (
    c.includes('entertainment') || c.includes('movie') || c.includes('cinema') ||
    c.includes('film') || c.includes('drama') || c.includes('comedy') ||
    c.includes('series') || combined.includes('cinema') || combined.includes('rakuten') ||
    combined.includes('pluto tv') || combined.includes('filmrise') || combined.includes('sci-fi')
  ) {
    return 'Entertainment';
  }

  if (
    (provider.toLowerCase().includes('cdn') && (c.includes('channel') || c.includes('tv') || c.includes('general'))) ||
    c.includes('live tv') || c.includes('channels') || c.includes('channel') ||
    c.includes('broadcast') || c.includes('general')
  ) {
    return 'Live TV';
  }

  if (
    c.includes('sport') || c.includes('sports') || c.includes('tennis') ||
    c.includes('golf') || c.includes('combat') || c.includes('ufc') ||
    c.includes('mma') || c.includes('boxing') || c.includes('wwe') ||
    c.includes('wrestling') || c.includes('baseball') || c.includes('mlb') ||
    c.includes('hockey') || c.includes('nhl') || c.includes('nfl') ||
    c.includes('rugby') || c.includes('cricket') || c.includes('athletics')
  ) {
    return 'Sports';
  }

  return 'Other';
}

export const LiveView: React.FC<LiveViewProps> = ({ onPlayLiveEvent }) => {
  const [events, setEvents] = useState<LiveEvent[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedProvider, setSelectedProvider] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  const loadLiveEvents = async () => {
    setLoading(true);
    try {
      const data = await api.getLiveEvents();
      const rawEvents: LiveEvent[] = data.events || [];

      const normalizedEvents = rawEvents
        .filter((ev) => !isBettingContent(ev.title, ev.category, ev.league))
        .map((ev) => ({
          ...ev,
          title: cleanEventTitle(ev.title),
          category: normalizeCategory(ev.category, ev.title, ev.league, ev.provider)
        }));

      setEvents(normalizedEvents);
    } catch (e) {
      console.error('Failed to load live events:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLiveEvents();
  }, []);

  const availableProviders = useMemo(() => {
    const set = new Set<string>();
    events.forEach((ev) => {
      if (ev.provider) set.add(ev.provider);
    });
    return ['All', ...Array.from(set)];
  }, [events]);

  const providerFilteredEvents = useMemo(() => {
    if (selectedProvider === 'All') return events;
    return events.filter(
      (ev) => (ev.provider || '').toLowerCase() === selectedProvider.toLowerCase()
    );
  }, [events, selectedProvider]);

  const activeCategoriesWithCounts = useMemo(() => {
    const counts: Record<string, number> = { All: providerFilteredEvents.length };

    providerFilteredEvents.forEach((ev) => {
      const cat = ev.category || 'Other';
      counts[cat] = (counts[cat] || 0) + 1;
    });

    return MASTER_CATEGORIES.filter((cat) => {
      if (cat === 'All') return true;
      return (counts[cat] || 0) > 0;
    }).map((cat) => ({
      name: cat,
      count: counts[cat] || 0
    }));
  }, [providerFilteredEvents]);

  useEffect(() => {
    if (selectedCategory !== 'All') {
      const exists = activeCategoriesWithCounts.some((c) => c.name === selectedCategory);
      if (!exists) {
        setSelectedCategory('All');
      }
    }
  }, [activeCategoriesWithCounts, selectedCategory]);

  const filteredEvents = useMemo(() => {
    return providerFilteredEvents.filter((ev) => {
      if (selectedCategory !== 'All' && ev.category !== selectedCategory) {
        return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const homeName =
          typeof ev.teams?.home === 'string'
            ? ev.teams.home
            : (ev.teams?.home as any)?.name || '';
        const awayName =
          typeof ev.teams?.away === 'string'
            ? ev.teams.away
            : (ev.teams?.away as any)?.name || '';
        const matchTitle = (ev.title || '').toLowerCase();
        const matchLeague = (ev.league || '').toLowerCase();
        const matchCat = (ev.category || '').toLowerCase();

        return (
          matchTitle.includes(q) ||
          matchLeague.includes(q) ||
          matchCat.includes(q) ||
          homeName.toLowerCase().includes(q) ||
          awayName.toLowerCase().includes(q)
        );
      }

      return true;
    });
  }, [providerFilteredEvents, selectedCategory, searchQuery]);

  return (
    <div id="live-view-container" className="p-8 pb-20 animate-fadeIn font-sans">
      {/* View Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
            <Radio className="w-5 h-5 text-emerald-400" />
            <span>Live Broadcast & Sports Arena</span>
          </h1>
          <p className="text-xs text-[#8e94a5] mt-1">
            Real-time IPTV relays, premier tournaments & live HD events
          </p>
        </div>

        {/* Controls Bar */}
        <div className="flex flex-wrap items-center gap-2.5 self-start">
          {/* Provider Filter */}
          <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#11131a] border border-[#222736]">
            <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400" />
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Relay:
              </span>
              <select
                id="live-provider-filter"
                value={selectedProvider}
                onChange={(e) => setSelectedProvider(e.target.value)}
                className="bg-transparent text-xs font-bold text-white focus:outline-none cursor-pointer pr-1 font-sans"
              >
                {availableProviders.map((p) => (
                  <option key={p} value={p} className="bg-[#11131a] text-white">
                    {p === 'All' ? 'All Relay Feeds' : p}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Search Input */}
          <div className="relative w-56 sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              id="live-search-input"
              type="text"
              placeholder={`Search ${selectedCategory}...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#11131a] text-xs text-slate-200 placeholder-[#5b6170] pl-9 pr-3 py-2 rounded-xl border border-[#222736] focus:outline-none focus:border-[#d97706] font-sans font-medium"
            />
          </div>

          {/* Refresh Button */}
          <button
            onClick={loadLiveEvents}
            className="p-2 rounded-xl bg-[#11131a] hover:bg-[#181b24] text-slate-300 hover:text-white border border-[#222736] transition-colors cursor-pointer"
            title="Refresh Live Streams"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-amber-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Top Filter Category Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-3 mb-6 scrollbar-none">
        {activeCategoriesWithCounts.map((cat) => {
          const isSelected = selectedCategory === cat.name;
          return (
            <button
              key={cat.name}
              id={`live-tab-${cat.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`}
              onClick={() => setSelectedCategory(cat.name)}
              className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-2 cursor-pointer ${
                isSelected
                  ? 'bg-[#e50914] text-white shadow-lg shadow-red-950/50'
                  : 'bg-[#11131a] hover:bg-[#181b24] text-slate-300 border border-[#222736]'
              }`}
            >
              <span>{cat.name}</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-md font-mono font-bold ${
                  isSelected ? 'bg-black/30 text-white' : 'bg-[#1a1d28] text-slate-400'
                }`}
              >
                {cat.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Events Grid */}
      {loading && events.length === 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-44 bg-[#11131a] rounded-2xl animate-pulse border border-[#222736]" />
          ))}
        </div>
      ) : filteredEvents.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredEvents.map((ev) => {
            const hasTeams = ev.teams && ev.teams.home && ev.teams.away;

            return (
              <div
                key={ev.id}
                id={`live-event-${ev.id}`}
                onClick={() => onPlayLiveEvent(ev)}
                className="group relative p-5 rounded-2xl bg-[#11131a] hover:bg-[#161922] border border-[#222736] hover:border-[#d97706]/60 cursor-pointer shadow-lg transition-all duration-200 flex flex-col justify-between"
              >
                {/* Card Top: Status & Provider */}
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2">
                    {ev.isLive ? (
                      <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-rose-500/15 text-rose-400 border border-rose-500/30 text-[10px] font-black uppercase tracking-wider">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse" />
                        Live Now
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#181b26] text-slate-300 text-[10px] font-semibold border border-[#262b3a]">
                        <Clock className="w-3 h-3 text-slate-400" />
                        {ev.startTime || 'Upcoming'}
                      </span>
                    )}

                    <span className="text-[10px] font-black uppercase tracking-wider text-amber-400 px-2 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/20">
                      {ev.category}
                    </span>
                  </div>

                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-[#08090c] text-slate-400 border border-[#202432]">
                    {ev.provider || 'Feed'}
                  </span>
                </div>

                {/* Main Card Content */}
                {hasTeams ? (
                  (() => {
                    const homeName =
                      typeof ev.teams?.home === 'string'
                        ? ev.teams.home
                        : (ev.teams?.home as any)?.name || '';
                    const awayName =
                      typeof ev.teams?.away === 'string'
                        ? ev.teams.away
                        : (ev.teams?.away as any)?.name || '';
                    const homeLogo =
                      ev.teams?.homeLogo ||
                      (typeof ev.teams?.home === 'object'
                        ? (ev.teams.home as any)?.logo
                        : undefined);
                    const awayLogo =
                      ev.teams?.awayLogo ||
                      (typeof ev.teams?.away === 'object'
                        ? (ev.teams.away as any)?.logo
                        : undefined);

                    return (
                      <div className="my-2 py-2 flex items-center justify-between gap-4">
                        {/* Home Team */}
                        <div className="flex-1 flex flex-col items-center text-center">
                          <div className="w-12 h-12 rounded-full bg-[#161922] border border-[#292e3e] p-1.5 flex items-center justify-center mb-1.5 shadow-inner">
                            {homeLogo ? (
                              <img
                                src={homeLogo}
                                alt={homeName}
                                className="w-full h-full object-contain"
                              />
                            ) : (
                              <Trophy className="w-5 h-5 text-amber-400" />
                            )}
                          </div>
                          <span className="text-xs font-bold text-slate-100 line-clamp-1">
                            {homeName}
                          </span>
                        </div>

                        {/* VS divider */}
                        <div className="flex flex-col items-center">
                          <span className="text-[10px] font-black text-amber-300 px-2 py-0.5 rounded-md bg-[#1d212c] border border-[#2a3040]">
                            VS
                          </span>
                        </div>

                        {/* Away Team */}
                        <div className="flex-1 flex flex-col items-center text-center">
                          <div className="w-12 h-12 rounded-full bg-[#161922] border border-[#292e3e] p-1.5 flex items-center justify-center mb-1.5 shadow-inner">
                            {awayLogo ? (
                              <img
                                src={awayLogo}
                                alt={awayName}
                                className="w-full h-full object-contain"
                              />
                            ) : (
                              <Trophy className="w-5 h-5 text-amber-400" />
                            )}
                          </div>
                          <span className="text-xs font-bold text-slate-100 line-clamp-1">
                            {awayName}
                          </span>
                        </div>
                      </div>
                    );
                  })()
                ) : (
                  <div className="my-3">
                    <h3 className="text-sm font-bold text-slate-100 group-hover:text-amber-300 line-clamp-2 transition-colors">
                      {ev.title}
                    </h3>
                    {ev.league && (
                      <p className="text-xs text-slate-400 mt-1 line-clamp-1">{ev.league}</p>
                    )}
                  </div>
                )}

                {/* Footer Action */}
                <div className="mt-3 pt-3 border-t border-[#1d212c] flex items-center justify-between text-xs">
                  <span className="text-[#7d8495] font-mono text-[11px]">
                    {ev.channels.length} {ev.channels.length === 1 ? 'feed link' : 'feed links'}
                  </span>
                  <div className="flex items-center gap-1.5 text-amber-400 font-bold group-hover:translate-x-0.5 transition-transform">
                    <Play className="w-3.5 h-3.5 fill-amber-400" />
                    <span>Launch Feed</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="py-20 text-center text-slate-400 bg-[#11131a] rounded-2xl border border-[#222736]">
          No live events found in{' '}
          <strong className="text-white">{selectedCategory}</strong>
          {selectedProvider !== 'All' && ` (${selectedProvider})`}.
        </div>
      )}
    </div>
  );
};
