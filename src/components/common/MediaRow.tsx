import React, { useRef } from 'react';
import { ChevronLeft, ChevronRight, Flame } from 'lucide-react';
import { MediaItem, WatchProgress } from '../../types/media';
import { MediaCard } from './MediaCard';

interface MediaRowProps {
  title: string;
  items: MediaItem[];
  progressMap?: Record<number, WatchProgress>;
  onClickItem: (item: MediaItem) => void;
  onQuickPlay?: (item: MediaItem) => void;
  badge?: string;
}

export const MediaRow: React.FC<MediaRowProps> = ({
  title,
  items,
  progressMap = {},
  onClickItem,
  onQuickPlay,
  badge
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleScroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const scrollAmount = scrollRef.current.clientWidth * 0.75;
      scrollRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  if (!items || items.length === 0) return null;

  return (
    <section className="relative my-9 px-8">
      {/* Section Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h3 className="text-base font-extrabold tracking-tight text-white">{title}</h3>
          {badge && (
            <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-[#e50914]/15 text-[#ff4b55] border border-[#e50914]/30">
              {badge}
            </span>
          )}
        </div>

        {/* Scroll Controls */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => handleScroll('left')}
            className="w-7 h-7 rounded-lg bg-[#141720] hover:bg-[#1f2432] border border-[#252a3a] text-slate-400 hover:text-white flex items-center justify-center transition-all cursor-pointer"
            title="Scroll Left"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleScroll('right')}
            className="w-7 h-7 rounded-lg bg-[#141720] hover:bg-[#1f2432] border border-[#252a3a] text-slate-400 hover:text-white flex items-center justify-center transition-all cursor-pointer"
            title="Scroll Right"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Horizontal Carousel */}
      <div
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto pb-3 pt-2 scrollbar-none snap-x snap-proximity scroll-smooth"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {items.map((item) => (
          <div key={item.id} className="w-40 md:w-44 shrink-0 snap-start">
            <MediaCard
              item={item}
              progress={progressMap[item.id] || progressMap[item.tmdbId]}
              onClick={onClickItem}
              onQuickPlay={onQuickPlay}
            />
          </div>
        ))}
      </div>
    </section>
  );
};
