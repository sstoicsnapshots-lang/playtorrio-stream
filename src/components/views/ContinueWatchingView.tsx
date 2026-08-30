import React, { useState, useEffect } from 'react';
import { PlayCircle, Trash2, Play, Info } from 'lucide-react';
import { WatchProgress, MediaItem } from '../../types/media';
import { storage } from '../../services/storage';

interface ContinueWatchingViewProps {
  onResumeProgress: (progress: WatchProgress) => void;
  onSelectItem: (item: MediaItem) => void;
}

export const ContinueWatchingView: React.FC<ContinueWatchingViewProps> = ({
  onResumeProgress,
  onSelectItem
}) => {
  const [list, setList] = useState<WatchProgress[]>([]);

  useEffect(() => {
    setList(storage.getWatchProgressList().filter(p => !p.completed));
  }, []);

  const handleRemove = (e: React.MouseEvent, progress: WatchProgress) => {
    e.stopPropagation();
    storage.removeProgress(progress.mediaId, progress.season, progress.episode);
    setList(storage.getWatchProgressList().filter(p => !p.completed));
  };

  const handleShowDetails = (e: React.MouseEvent, progress: WatchProgress) => {
    e.stopPropagation();
    onSelectItem({
      id: progress.mediaId,
      tmdbId: progress.mediaId,
      title: progress.title,
      mediaType: progress.mediaType,
      overview: '',
      voteAverage: 0,
      posterPath: progress.posterPath,
      backdropPath: progress.backdropPath
    });
  };

  return (
    <div id="continue-watching-view" className="p-8 pb-16 animate-fadeIn font-sans">
      <div className="mb-6">
        <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2.5">
          <PlayCircle className="w-6 h-6 text-[#e50914]" />
          <span>Continue Watching</span>
        </h1>
        <p className="text-xs text-[#808799] font-medium mt-1">Pick up right where you left off</p>
      </div>

      {list.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
          {list.map((item) => (
            <div
              key={`${item.mediaId}-${item.season || 0}-${item.episode || 0}`}
              onClick={() => onResumeProgress(item)}
              className="group relative rounded-2xl overflow-hidden bg-[#12141c] border border-[#222736] hover:border-[#e50914]/60 cursor-pointer shadow-xl transition-all duration-200"
            >
              {/* Thumbnail */}
              <div className="relative aspect-video w-full bg-[#181b26] overflow-hidden">
                {item.backdropPath ? (
                  <img
                    src={item.backdropPath}
                    alt={item.title}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-500">
                    <Play className="w-8 h-8 opacity-40 text-amber-500" />
                  </div>
                )}

                {/* Play button overlay */}
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                  <div className="w-12 h-12 rounded-full bg-[#e50914] text-white flex items-center justify-center shadow-2xl shadow-red-950/80">
                    <Play className="w-5 h-5 fill-white translate-x-0.5" />
                  </div>
                </div>

                {/* Progress bar */}
                <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-black/60">
                  <div
                    className="h-full bg-gradient-to-r from-amber-500 to-[#e50914] shadow-[0_0_8px_rgba(229,9,20,0.8)]"
                    style={{ width: `${item.progressPercent}%` }}
                  />
                </div>
              </div>

              {/* Info */}
              <div className="p-4">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-black text-white truncate group-hover:text-amber-400 transition-colors">
                    {item.title}
                  </h3>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={(e) => handleShowDetails(e, item)}
                      className="w-7 h-7 rounded-lg text-slate-400 hover:text-amber-400 hover:bg-[#1f2332] flex items-center justify-center transition-colors cursor-pointer"
                      title="Show details"
                    >
                      <Info className="w-4 h-4" />
                    </button>
                    <button
                      onClick={(e) => handleRemove(e, item)}
                      className="w-7 h-7 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-[#1f2332] flex items-center justify-center transition-colors cursor-pointer"
                      title="Remove from Resume list"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs text-[#808799] mt-2 font-mono font-medium">
                  <span>
                    {item.season ? `Season ${item.season} • Ep ${item.episode}` : 'Feature Film'}
                  </span>
                  <span className="text-amber-400 font-bold">{Math.round(item.progressPercent)}%</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="py-24 text-center text-slate-400 bg-[#12141c] rounded-3xl border border-[#222736] max-w-lg mx-auto p-6 shadow-xl">
          <PlayCircle className="w-12 h-12 text-[#2b3040] mx-auto mb-3" />
          <p className="text-sm font-bold text-slate-200">No Active Stream Progress</p>
          <p className="text-xs text-[#787f92] mt-1 font-medium">Start watching any movie or episode and your timestamps will appear here automatically.</p>
        </div>
      )}
    </div>
  );
};
