import React, { useState, useEffect } from 'react';
import { History as HistoryIcon, Trash2, Calendar, Clock, Play } from 'lucide-react';
import { WatchProgress, MediaItem } from '../../types/media';
import { storage } from '../../services/storage';

interface HistoryViewProps {
  onResumeProgress: (progress: WatchProgress) => void;
  onSelectItem: (item: MediaItem) => void;
}

export const HistoryView: React.FC<HistoryViewProps> = ({
  onResumeProgress,
  onSelectItem
}) => {
  const [history, setHistory] = useState<WatchProgress[]>([]);

  useEffect(() => {
    setHistory(storage.getHistory());
  }, []);

  const handleClearHistory = () => {
    if (confirm('Are you sure you want to clear your playback history?')) {
      storage.clearHistory();
      setHistory([]);
    }
  };

  const formatDate = (timestamp: number) => {
    const d = new Date(timestamp);
    return d.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div id="history-view" className="p-8 pb-16 animate-fadeIn font-sans">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2.5">
            <HistoryIcon className="w-6 h-6 text-slate-300" />
            <span>History</span>
          </h1>
          <p className="text-xs text-[#808799] font-medium mt-1">Your recently played movies and episodes</p>
        </div>

        {history.length > 0 && (
          <button
            onClick={handleClearHistory}
            className="px-3.5 py-1.5 rounded-xl bg-[#141722] hover:bg-rose-950/40 text-slate-300 hover:text-rose-400 border border-[#252a3a] hover:border-rose-500/40 text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
            <span>Clear History</span>
          </button>
        )}
      </div>

      {history.length > 0 ? (
        <div className="space-y-3 max-w-4xl">
          {history.map((h, idx) => (
            <div
              key={idx}
              onClick={() => {
                if (h.completed) {
                  onSelectItem({
                    id: h.mediaId,
                    tmdbId: h.mediaId,
                    title: h.title,
                    mediaType: h.mediaType,
                    overview: '',
                    voteAverage: 0,
                    posterPath: h.posterPath,
                    backdropPath: h.backdropPath
                  });
                } else {
                  onResumeProgress(h);
                }
              }}
              className="group p-4 rounded-2xl bg-[#12141c] hover:bg-[#181b26] border border-[#222736] hover:border-[#333a4f] flex items-center justify-between gap-4 cursor-pointer transition-all duration-150 shadow-md"
            >
              <div className="flex items-center gap-4 min-w-0">
                <div className="w-24 aspect-video rounded-xl overflow-hidden bg-[#181b26] shrink-0 border border-[#262b3a] relative shadow-inner">
                  {h.backdropPath ? (
                    <img
                      src={h.backdropPath}
                      alt={h.title}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-500">
                      <Play className="w-4 h-4 text-amber-500" />
                    </div>
                  )}
                </div>

                <div className="min-w-0">
                  <h3 className="text-sm font-black text-white truncate group-hover:text-amber-400 transition-colors">
                    {h.title}
                  </h3>
                  <div className="flex items-center gap-2 text-xs text-[#808799] mt-1 flex-wrap font-medium">
                    <span className="capitalize font-bold text-slate-300">{h.mediaType}</span>
                    {h.season && <span>• S{h.season} E{h.episode}</span>}
                    {h.selectedSourceProvider && (
                      <span className="text-amber-400 font-mono font-bold">[{h.selectedSourceProvider}]</span>
                    )}
                    <span>•</span>
                    <span className="flex items-center gap-1 text-[11px] text-[#6b7282]">
                      <Calendar className="w-3 h-3" />
                      {formatDate(h.lastUpdated)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Progress Indicator */}
              <div className="text-right shrink-0">
                <span className={`text-xs font-black font-mono px-2.5 py-1 rounded-lg border ${
                  h.completed 
                    ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' 
                    : 'bg-[#181b26] text-amber-400 border-[#282d3e]'
                }`}>
                  {h.completed ? 'Finished' : `${Math.round(h.progressPercent)}%`}
                </span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="py-24 text-center text-slate-400 bg-[#12141c] rounded-3xl border border-[#222736] max-w-lg mx-auto p-6 shadow-xl">
          <HistoryIcon className="w-12 h-12 text-[#2b3040] mx-auto mb-3" />
          <p className="text-sm font-bold text-slate-200">No Stream History Found</p>
          <p className="text-xs text-[#787f92] mt-1 font-medium">Any titles and live relays you stream will automatically be logged here.</p>
        </div>
      )}
    </div>
  );
};
