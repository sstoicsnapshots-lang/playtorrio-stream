import React from 'react';
import { Star, Play, Tv, Film } from 'lucide-react';
import { MediaItem, WatchProgress } from '../../types/media';

interface MediaCardProps {
  item: MediaItem;
  progress?: WatchProgress | null;
  onClick: (item: MediaItem) => void;
  onQuickPlay?: (item: MediaItem) => void;
  compact?: boolean;
}

export const MediaCard: React.FC<MediaCardProps> = ({
  item,
  progress,
  onClick,
  onQuickPlay,
  compact = false
}) => {
  const isMovie = item.mediaType === 'movie';
  const year = (item.releaseDate || item.firstAirDate || '').substring(0, 4);
  // Grid thumbnails render ~200px wide — w342 is plenty and ~40% lighter than w500.
  const rawPoster = item.posterPath || (item.backdropPath ? item.backdropPath.replace('/w1280', '/w500') : null);
  const posterUrl = rawPoster ? rawPoster.replace('/w500/', '/w342/') : null;

  return (
    <div
      id={`media-card-${item.id}`}
      onClick={() => onClick(item)}
      className="group relative cursor-pointer flex flex-col select-none transition-transform duration-200 group-hover:z-10 hover:-translate-y-1 focus:outline-none"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick(item);
        }
      }}
    >
      {/* Poster Frame with rich glass and shadow */}
      <div className="relative aspect-[2/3] w-full rounded-2xl overflow-hidden bg-[#11131a] border border-[#202432] group-hover:border-[#d97706]/60 transition-all shadow-lg group-hover:shadow-[#e50914]/10">
        {posterUrl ? (
          <img
            src={posterUrl}
            alt={item.title}
            loading="lazy"
            decoding="async"
            draggable={false}
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center p-4 text-center bg-[#11131a] text-slate-500">
            {isMovie ? <Film className="w-8 h-8 mb-2 opacity-60 text-amber-500" /> : <Tv className="w-8 h-8 mb-2 opacity-60 text-amber-500" />}
            <span className="text-xs font-medium text-slate-400 line-clamp-2">{item.title}</span>
          </div>
        )}

        {/* Cinematic Hover Action Overlay. pointer-events-none so a click anywhere
            on the poster always counts as a card click; only the play button opts
            back in. */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#08090c] via-[#08090c]/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col justify-end p-3.5 pointer-events-none">
          <div className="flex items-center justify-between">
            <button
              id={`quick-play-${item.id}`}
              onClick={(e) => {
                e.stopPropagation();
                if (onQuickPlay) onQuickPlay(item);
                else onClick(item);
              }}
              className="w-10 h-10 rounded-full bg-[#e50914] hover:bg-[#ff1f2d] text-white flex items-center justify-center shadow-lg shadow-red-950/60 transition-transform active:scale-90 cursor-pointer pointer-events-auto"
              title="Stream Instantly"
            >
              <Play className="w-4 h-4 fill-white translate-x-0.5" />
            </button>
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-200 bg-black/60 px-2.5 py-1 rounded-md border border-white/10 backdrop-blur-md">
              Overview
            </span>
          </div>
        </div>

        {/* Top Badges */}
        <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between pointer-events-none">
          {/* Format Badge */}
          <span className="px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider bg-black/75 text-slate-200 border border-white/10 backdrop-blur-md">
            {isMovie ? 'Film' : 'Series'}
          </span>

          {/* Rating Badge */}
          {item.voteAverage > 0 && (
            <div className="flex items-center gap-1 bg-black/80 backdrop-blur-md px-1.5 py-0.5 rounded-md text-[10px] font-black text-amber-400 border border-amber-500/30 shadow-sm">
              <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
              <span>{item.voteAverage}</span>
            </div>
          )}
        </div>

        {/* Continue Watching Progress Bar */}
        {progress && progress.progressPercent > 0 && (
          <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-black/80">
            <div
              className="h-full bg-gradient-to-r from-amber-500 to-[#e50914] rounded-r-full"
              style={{ width: `${Math.min(100, Math.max(5, progress.progressPercent))}%` }}
            />
          </div>
        )}
      </div>

      {/* Title & Metadata */}
      {!compact && (
        <div className="mt-2.5 px-0.5">
          <h4 className="text-xs font-bold text-slate-100 line-clamp-1 group-hover:text-amber-300 transition-colors">
            {item.title}
          </h4>
          <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-[#8e94a5] font-medium">
            {year && <span>{year}</span>}
            {year && item.runtime && <span>•</span>}
            {item.runtime ? <span>{item.runtime}m</span> : null}
            {progress?.season && (
              <span className="text-amber-400/90 font-semibold ml-auto font-mono text-[10px]">
                S{progress.season} E{progress.episode}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
