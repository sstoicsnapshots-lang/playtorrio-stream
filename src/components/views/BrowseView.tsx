import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Filter, Loader2, LucideIcon } from 'lucide-react';
import { MediaItem } from '../../types/media';
import { api } from '../../services/api';
import { MediaCard } from '../common/MediaCard';

type Tab = { id: string; label: string };

interface BrowseViewProps {
  containerId: string;
  icon: LucideIcon;
  heading: string;
  subheading: string;
  mediaType: 'movie' | 'tv';
  tabs: Tab[];
  emptyLabel: string;
  onSelectItem: (item: MediaItem) => void;
  onQuickPlay: (item: MediaItem) => void;
}

const PAGE_LIMIT = 20; // TMDB hard-caps most list endpoints around page 500

async function fetchPage(
  mediaType: 'movie' | 'tv',
  tab: string,
  genreId: number | null,
  page: number
): Promise<MediaItem[]> {
  if (genreId) return api.discoverByGenre(mediaType, genreId, page);
  switch (tab) {
    case 'trending':
      return api.getTrending(mediaType, page);
    case 'top_rated':
      return (await api.getTopRated(mediaType, page)).results;
    case 'on_air':
    case 'upcoming':
      return mediaType === 'tv' ? api.getOnTheAir(page) : api.getUpcoming(page);
    case 'popular':
    default:
      return (await api.getPopular(mediaType, page)).results;
  }
}

export const BrowseView: React.FC<BrowseViewProps> = ({
  containerId,
  icon: Icon,
  heading,
  subheading,
  mediaType,
  tabs,
  emptyLabel,
  onSelectItem,
  onQuickPlay
}) => {
  const [activeTab, setActiveTab] = useState(tabs[0].id);
  const [genres, setGenres] = useState<{ id: number; name: string }[]>([]);
  const [selectedGenreId, setSelectedGenreId] = useState<number | null>(null);
  const [items, setItems] = useState<MediaItem[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [exhausted, setExhausted] = useState(false);

  const seenIds = useRef<Set<number>>(new Set());
  const sentinelRef = useRef<HTMLDivElement>(null);
  const reqId = useRef(0);

  useEffect(() => {
    api.getGenres(mediaType).then(setGenres).catch(() => {});
  }, [mediaType]);

  // Reset + load page 1 whenever the filter changes.
  useEffect(() => {
    const myReq = ++reqId.current;
    seenIds.current = new Set();
    setItems([]);
    setPage(1);
    setExhausted(false);
    setLoading(true);
    fetchPage(mediaType, activeTab, selectedGenreId, 1)
      .then((res) => {
        if (myReq !== reqId.current) return;
        const fresh = res.filter((i) => !seenIds.current.has(i.id));
        fresh.forEach((i) => seenIds.current.add(i.id));
        setItems(fresh);
        setExhausted(res.length === 0);
      })
      .catch(() => { if (myReq === reqId.current) setExhausted(true); })
      .finally(() => { if (myReq === reqId.current) setLoading(false); });
  }, [mediaType, activeTab, selectedGenreId]);

  const loadMore = useCallback(() => {
    if (loading || loadingMore || exhausted || page >= PAGE_LIMIT) return;
    const myReq = reqId.current;
    const next = page + 1;
    setLoadingMore(true);
    fetchPage(mediaType, activeTab, selectedGenreId, next)
      .then((res) => {
        if (myReq !== reqId.current) return;
        const fresh = res.filter((i) => !seenIds.current.has(i.id));
        fresh.forEach((i) => seenIds.current.add(i.id));
        setItems((prev) => [...prev, ...fresh]);
        setPage(next);
        if (res.length === 0) setExhausted(true);
      })
      .catch(() => {})
      .finally(() => { if (myReq === reqId.current) setLoadingMore(false); });
  }, [loading, loadingMore, exhausted, page, mediaType, activeTab, selectedGenreId]);

  // Auto-load the next page as the sentinel nears the viewport. IntersectionObserver
  // is the primary trigger; a scroll listener on the scroll container is the fallback
  // (IO is throttled in backgrounded tabs and some embedded contexts).
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
      const rect = el.getBoundingClientRect();
      if (rect.top < window.innerHeight + 800) loadMore();
    };
    target.addEventListener('scroll', onScroll, { passive: true });

    return () => {
      io.disconnect();
      target.removeEventListener('scroll', onScroll);
    };
  }, [loadMore]);

  return (
    <div id={containerId} className="p-8 pb-20 animate-fadeIn font-sans">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2.5">
            <Icon className="w-5 h-5 text-amber-500" />
            <span>{heading}</span>
          </h1>
          <p className="text-xs text-[#82899c] font-medium mt-1">{subheading}</p>
        </div>

        <div className="flex items-center gap-1 bg-[#12141c] p-1 rounded-2xl border border-[#222736] self-start shadow-inner">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => { setActiveTab(tab.id); setSelectedGenreId(null); }}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === tab.id && !selectedGenreId
                  ? 'bg-[#e50914] text-white shadow-md shadow-red-950/50'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {genres.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-3 mb-6 scrollbar-none">
          <span className="text-[10px] font-black uppercase tracking-widest text-[#737a8c] flex items-center gap-1 shrink-0 mr-1">
            <Filter className="w-3 h-3 text-amber-400" />
            Genres:
          </span>
          {genres.map((g) => (
            <button
              key={g.id}
              onClick={() => setSelectedGenreId(selectedGenreId === g.id ? null : g.id)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                selectedGenreId === g.id
                  ? 'bg-amber-500 text-black shadow-md font-black'
                  : 'bg-[#141722] hover:bg-[#1f2434] text-slate-300 hover:text-white border border-[#252a3a]'
              }`}
            >
              {g.name}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {Array.from({ length: 18 }).map((_, i) => (
            <div key={i} className="aspect-[2/3] bg-[#141722] rounded-2xl animate-pulse border border-[#222736]" />
          ))}
        </div>
      ) : items.length > 0 ? (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {items.map((item) => (
              <MediaCard key={item.id} item={item} onClick={onSelectItem} onQuickPlay={onQuickPlay} />
            ))}
          </div>
          <div ref={sentinelRef} className="flex items-center justify-center mt-8 mb-2">
            {loadingMore ? (
              <Loader2 className="w-5 h-5 text-slate-500 animate-spin" />
            ) : exhausted ? (
              <span className="text-[11px] text-slate-600 font-medium">That's everything.</span>
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
        <div className="py-20 text-center text-slate-400 bg-[#12141c] rounded-2xl border border-[#222736]">
          {emptyLabel}
        </div>
      )}
    </div>
  );
};
