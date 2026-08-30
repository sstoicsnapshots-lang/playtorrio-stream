import React from 'react';
import {
  X,
  Play,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Sparkles,
  Zap,
  Globe,
  HardDrive,
  Layers,
  ArrowRight
} from 'lucide-react';
import { StreamSource, ProviderResolutionResult } from '../../types/media';

interface SourceResolverModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  season?: number;
  episode?: number;
  sources: StreamSource[];
  results: ProviderResolutionResult[];
  loading: boolean;
  error?: string;
  hiddenTorrentCount?: number;
  selectedSourceId?: string;
  onSelectSource: (source: StreamSource) => void;
}

export const SourceResolverModal: React.FC<SourceResolverModalProps> = ({
  isOpen,
  onClose,
  title,
  season,
  episode,
  sources,
  results,
  loading,
  error,
  hiddenTorrentCount = 0,
  selectedSourceId,
  onSelectSource
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#08090d]/85 backdrop-blur-xl animate-fadeIn font-sans">
      <div 
        id="source-resolver-dialog"
        className="w-full max-w-2xl bg-[#11131a] border border-white/[0.08] rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/[0.06] flex items-center justify-between bg-[#171a25]/60">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span>Discovered Sources</span>
                {season && episode && (
                  <span className="text-xs px-2 py-0.5 rounded-md bg-indigo-500/15 text-indigo-300 border border-indigo-500/25 font-mono">
                    S{season} E{episode}
                  </span>
                )}
              </h3>
              <p className="text-xs text-slate-400 truncate max-w-md">{title}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl text-slate-400 hover:text-white hover:bg-white/[0.06] flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Live Aggregation Provider Status Ticker */}
        <div className="px-6 py-3 bg-[#0d0e14] border-b border-white/[0.06]">
          <div className="flex items-center justify-between text-xs mb-2">
            <span className="text-slate-400 font-medium flex items-center gap-1.5">
              {loading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 text-indigo-400 animate-spin" />
                  <span>Querying multi-provider swarm concurrently...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Aggregation complete ({sources.length} sources resolved)</span>
                </>
              )}
            </span>
          </div>

          {/* Mini provider status pills */}
          <div className="flex flex-wrap gap-1.5">
            {results.map((res, idx) => (
              <span
                key={idx}
                className={`text-[10px] font-semibold px-2 py-0.5 rounded-lg flex items-center gap-1 border ${
                  res.success
                    ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/25'
                    : 'bg-[#171a25] text-slate-400 border-white/[0.06]'
                }`}
              >
                {res.provider}
                {res.success ? (
                  <span className="text-emerald-400 font-mono">+{res.sources.length}</span>
                ) : (
                  <span className="text-slate-500 font-mono">0</span>
                )}
              </span>
            ))}
          </div>
        </div>

        {/* Sources List */}
        <div className="flex-1 overflow-y-auto p-6 space-y-2.5 scrollbar-thin">
          {loading && sources.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center text-center">
              <Loader2 className="w-8 h-8 text-indigo-400 animate-spin mb-3" />
              <p className="text-sm font-semibold text-slate-200">Finding playable streaming sources...</p>
              <p className="text-xs text-slate-400 mt-1">Connecting to VidLink, VidFast, Videasy, VixSrc, Vidsrc & Stremio...</p>
            </div>
          ) : sources.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center text-center">
              <AlertCircle className="w-8 h-8 text-amber-400 mb-2" />
              <p className="text-sm font-semibold text-slate-200">No active sources available right now</p>
              <p className="text-xs text-slate-400 mt-1 max-w-sm">
                Try enabling additional providers in Settings or adding custom Stremio add-ons.
              </p>
            </div>
          ) : (
            sources.map((source, index) => {
              const isSelected = selectedSourceId === source.id;
              const isBest = index === 0;

              return (
                <div
                  key={source.id || index}
                  id={`source-item-${source.id}`}
                  onClick={() => onSelectSource(source)}
                  className={`group relative p-3.5 rounded-2xl border cursor-pointer flex items-center justify-between gap-4 transition-all duration-150 ${
                    isSelected
                      ? 'bg-indigo-500/15 border-indigo-500/60 shadow-md ring-1 ring-indigo-500/30'
                      : 'bg-[#171a25]/60 hover:bg-[#1a1d2b] border-white/[0.06] hover:border-white/[0.14]'
                  }`}
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    {/* Rank Indicator */}
                    <div className={`w-7 h-7 rounded-xl flex items-center justify-center text-xs font-bold shrink-0 ${
                      isBest 
                        ? 'bg-gradient-to-br from-indigo-500 to-indigo-700 text-white shadow-sm'
                        : 'bg-[#11131a] text-slate-400 border border-white/[0.06]'
                    }`}>
                      {index + 1}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm text-slate-100 group-hover:text-indigo-300 transition-colors">
                          {source.provider}
                        </span>

                        {/* Quality Badge */}
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md uppercase ${
                          source.quality === '4K'
                            ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                            : source.quality === '1080p'
                            ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                            : 'bg-white/[0.06] text-slate-300 border border-white/[0.06]'
                        }`}>
                          {source.quality}
                        </span>

                        {/* Direct vs Embed vs Magnet */}
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-white/[0.06] text-slate-400 uppercase font-mono">
                          {source.type}
                        </span>

                        {source.direct && (
                          <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded-md bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 flex items-center gap-1">
                            <Zap className="w-2.5 h-2.5" />
                            Direct
                          </span>
                        )}

                        {source.isDebrid && (
                          <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded-md bg-amber-500/15 text-amber-400 border border-amber-500/25">
                            Debrid
                          </span>
                        )}

                        {isBest && (
                          <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-md bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 flex items-center gap-1">
                            <Sparkles className="w-2.5 h-2.5 text-indigo-400" />
                            Recommended
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-slate-400 truncate mt-1">
                        {source.title || source.url}
                      </p>
                    </div>
                  </div>

                  {/* Play action */}
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      className="px-3.5 py-1.5 rounded-xl bg-white hover:bg-slate-100 text-black text-xs font-bold flex items-center gap-1.5 shadow-sm transition-transform active:scale-95 cursor-pointer"
                    >
                      <Play className="w-3 h-3 fill-black" />
                      <span>Play</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}

          {!loading && hiddenTorrentCount > 0 && (
            <div className="mt-2 p-3 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-start gap-3">
              <HardDrive className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Torrent results play through the Webtor.io player (their servers fetch and
                transcode the torrent — your device never joins the swarm). The
                {' '}{hiddenTorrentCount} lowest-seeded torrent{hiddenTorrentCount === 1 ? ' is' : 's are'}
                {' '}hidden. For faster, higher-quality torrent playback, add a Debrid key in
                Settings ▸ Debrid Provider.
              </p>
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="px-6 py-3 border-t border-white/[0.06] bg-[#0d0e14] flex items-center justify-between text-xs text-slate-400">
          <span>Sources are ranked by speed, direct stream capability, and resolution.</span>
          <button
            onClick={onClose}
            className="text-slate-300 hover:text-white font-medium cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
