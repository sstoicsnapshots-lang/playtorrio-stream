import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Search as SearchIcon, Loader2 } from 'lucide-react';
import { MediaItem } from '../../types/media';
import { api } from '../../services/api';
import { MediaCard } from '../common/MediaCard';

interface SearchViewProps {
  query: string;
  onSelectItem: (item: MediaItem) => void;
  onQuickPlay: (item: MediaItem) => void;
}

export const SearchView: React.FC<SearchViewProps> = ({ query, onSelectItem, onQuickPlay }) => {
  const [filterType, setFilterType] = useState<'all' | 'movie' | 'tv'>('all');
  const [results, setResults] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [exhausted, setExhausted] = useState(false);
  const seenIds = useRef<Set<string>>(new Set());
  const reqId = useRef(0);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const q = query.trim();

  useEffect(() => {
    if (!q) {
      setResults([]);
      setExhausted(false);
      setLoading(false);
      return;
    }
    const timer = setTimeout(() => {
      const myReq = ++reqId.current;
      seenIds.current = new Set();
      setLoading(true);
      setPage(1);
      setExhausted(false);
      api.search(q, 'all', 1)
        .then((data) => {
          if (myReq !== reqId.current) return;
          data.forEach((i) => seenIds.current.add(`${i.mediaType}-${i.id}`));
          setResults(data);
          setExhausted(data.length === 0);
        })
        .catch((err) => console.error('Search error:', err))
        .finally(() => { if (myReq === reqId.current) setLoading(false); });
    }, 250);
    return () => clearTimeout(timer);
  }, [q]);

  const loadMore = useCallback(() => {
    if (!q || loading || loadingMore || exhausted || page >= 20) return;
    const myReq = reqId.current;
    const next = page + 1;
    setLoadingMore(true);
    api.search(q, 'all', next)
      .then((data) => {
        if (myReq !== reqId.current) return;
        const fresh = data.filter((i) => !seenIds.current.has(`${i.mediaType}-${i.id}`));
        fresh.forEach((i) => seenIds.current.add(`${i.mediaType}-${i.id}`));
        setResults((prev) => [...prev, ...fresh]);
        setPage(next);
        if (data.length === 0) setExhausted(true);
      })
      .catch(() => {})
      .finally(() => { if (myReq === reqId.current) setLoadingMore(false); });
  }, [q, loading, loadingMore, exhausted, page]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting) loadMore(); },
      { rootMargin: '800px' }
    );
    io.observe(el);
    let scroller: HTMLElement | null = el.parentElement;
    while (scroller && scroller !== document.body) {
      const oy = getComputedStyle(scroller).overflowY;
      if (oy === 'auto' || oy === 'scroll') break;
      scroller = scroller.parentElement;
    }
    const target: HTMLElement | Window = scroller && scroller !== document.body ? scroller : window;
    const onScroll = () => {
      if (el.getBoundingClientRect().top < window.innerHeight + 800) loadMore();
    };
    target.addEventListener('scroll', onScroll, { passive: true });
    return () => { io.disconnect(); target.removeEventListener('scroll', onScroll); };
  }, [loadMore]);

  const filtered = results.filter((item) => filterType === 'all' || item.mediaType === filterType);

  return (
    <div id="search-view-container" className="p-8 pb-16 animate-fadeIn font-sans">
      <div className="mb-6">
        <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2.5">
          <SearchIcon className="w-6 h-6 text-slate-300" />
          <span>{q ? `Results for “${query}”` : 'Search'}</span>
        </h1>
        <p className="text-xs text-[#808799] font-medium mt-1">
          Use the search bar at the top to find movies, TV shows, actors and directors.
        </p>

        {q && (
          <div className="flex items-center gap-2 mt-4">
            {([
              { id: 'all', label: 'All' },
              { id: 'movie', label: 'Movies' },
              { id: 'tv', label: 'TV Shows' }
            ] as const).map((f) => (
              <button
                key={f.id}
                onClick={() => setFilterType(f.id)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  filterType === f.id
                    ? 'bg-[#e50914] text-white shadow-md shadow-red-950/60'
                    : 'bg-[#141722] hover:bg-[#1f2434] text-slate-400 hover:text-slate-200 border border-[#252a3a]'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {!q ? (
        <div className="py-24 text-center text-slate-500">
          <SearchIcon className="w-10 h-10 text-[#2b3040] mx-auto mb-3" />
          <p className="text-xs font-semibold text-[#787f92]">Start typing in the search bar to look across every provider.</p>
        </div>
      ) : loading && results.length === 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="aspect-[2/3] bg-[#141722] rounded-2xl animate-pulse border border-[#222736]" />
          ))}
        </div>
      ) : filtered.length > 0 ? (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {filtered.map((item) => (
              <MediaCard
                key={`${item.mediaType}-${item.id}`}
                item={item}
                onClick={onSelectItem}
                onQuickPlay={onQuickPlay}
              />
            ))}
          </div>
          <div ref={sentinelRef} className="flex items-center justify-center mt-8 mb-2">
            {loadingMore ? (
              <Loader2 className="w-5 h-5 text-slate-500 animate-spin" />
            ) : exhausted ? (
              <span className="text-[11px] text-slate-600 font-medium">End of results.</span>
            ) : (
              <button
                onClick={loadMore}
                className="px-5 py-2.5 rounded-xl bg-[#141722] hover:bg-[#1f2434] text-slate-300 hover:text-white border border-[#252a3a] text-xs font-bold transition-colors cursor-pointer"
              >
                Load more
              </button>
            )}
          </div>
        </>
      ) : (
        <div className="py-20 text-center text-slate-400 bg-[#12141c] rounded-3xl border border-[#222736] max-w-xl mx-auto p-6 shadow-xl">
          No matches found for “{query}”. Check the spelling or try another title.
        </div>
      )}
    </div>
  );
};
