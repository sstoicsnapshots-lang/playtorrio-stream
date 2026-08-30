import React, { useState, useEffect } from 'react';
import { Play, Check, Clock, Calendar, Film } from 'lucide-react';
import { Season, Episode } from '../../types/media';
import { api } from '../../services/api';
import { storage } from '../../services/storage';

interface SeasonEpisodeSelectorProps {
  tvId: number;
  seasons: Season[];
  currentSeasonNumber?: number;
  currentEpisodeNumber?: number;
  onSelectEpisode: (seasonNumber: number, episode: Episode) => void;
}

export const SeasonEpisodeSelector: React.FC<SeasonEpisodeSelectorProps> = ({
  tvId,
  seasons,
  currentSeasonNumber = 1,
  currentEpisodeNumber = 1,
  onSelectEpisode
}) => {
  const validSeasons = seasons.filter(s => s.seasonNumber > 0);
  const [selectedSeasonNum, setSelectedSeasonNum] = useState<number>(
    validSeasons.length > 0 ? validSeasons[0].seasonNumber : 1
  );
  const [seasonData, setSeasonData] = useState<Season | null>(null);
  const [loading, setLoading] = useState(false);
  const [watchedMap, setWatchedMap] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setWatchedMap(storage.getWatchedEpisodes());
  }, []);

  useEffect(() => {
    let isMounted = true;
    async function fetchEpisodes() {
      setLoading(true);
      try {
        const data = await api.getSeason(tvId, selectedSeasonNum);
        if (isMounted) {
          setSeasonData(data);
        }
      } catch (err) {
        console.error('Failed to load season episodes:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    fetchEpisodes();
    return () => { isMounted = false; };
  }, [tvId, selectedSeasonNum]);

  const handleToggleWatched = (e: React.MouseEvent, epNum: number) => {
    e.stopPropagation();
    const current = !!watchedMap[`${tvId}_s${selectedSeasonNum}_e${epNum}`];
    storage.markEpisodeWatched(tvId, selectedSeasonNum, epNum, !current);
    setWatchedMap(storage.getWatchedEpisodes());
  };

  return (
    <div className="mt-8 border-t border-zinc-800/80 pt-6">
      {/* Season Selector Tabs */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <div>
          <h3 className="text-base font-bold text-white tracking-tight">Episodes</h3>
          <p className="text-xs text-zinc-400">Select a season and episode to play</p>
        </div>

        {validSeasons.length > 1 && (
          <div className="flex items-center gap-2 overflow-x-auto max-w-full pb-1">
            {validSeasons.map((s) => (
              <button
                key={s.id || s.seasonNumber}
                onClick={() => setSelectedSeasonNum(s.seasonNumber)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                  selectedSeasonNum === s.seasonNumber
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                    : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 border border-zinc-800'
                }`}
              >
                {s.name || `Season ${s.seasonNumber}`}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Episodes List / Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 animate-pulse">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-24 bg-zinc-900/60 rounded-xl border border-zinc-800" />
          ))}
        </div>
      ) : seasonData && seasonData.episodes && seasonData.episodes.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 max-h-[480px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-zinc-800">
          {seasonData.episodes.map((ep) => {
            const isWatched = !!watchedMap[`${tvId}_s${selectedSeasonNum}_e${ep.episodeNumber}`];
            const isCurrent = selectedSeasonNum === currentSeasonNumber && ep.episodeNumber === currentEpisodeNumber;
            const progress = storage.getProgress(tvId, selectedSeasonNum, ep.episodeNumber);

            return (
              <div
                key={ep.id}
                id={`episode-card-${selectedSeasonNum}-${ep.episodeNumber}`}
                onClick={() => onSelectEpisode(selectedSeasonNum, ep)}
                className={`group relative flex gap-3 p-2.5 rounded-xl border cursor-pointer transition-all duration-150 ${
                  isCurrent
                    ? 'bg-indigo-950/30 border-indigo-500/50 shadow-sm'
                    : 'bg-zinc-900/60 hover:bg-zinc-900 border-zinc-800 hover:border-zinc-700'
                }`}
              >
                {/* Thumbnail */}
                <div className="relative w-32 aspect-video shrink-0 rounded-lg overflow-hidden bg-zinc-950 border border-zinc-800/80">
                  {ep.stillPath ? (
                    <img
                      src={ep.stillPath}
                      alt={ep.name}
                      loading="lazy"
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-zinc-400 bg-zinc-900">
                      <Film className="w-5 h-5 opacity-40" />
                    </div>
                  )}

                  {/* Play Overlay */}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <div className="w-7 h-7 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow">
                      <Play className="w-3.5 h-3.5 fill-white translate-x-0.5" />
                    </div>
                  </div>

                  {/* Episode Number badge */}
                  <span className="absolute top-1.5 left-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded bg-zinc-950/90 text-zinc-300 backdrop-blur-sm border border-zinc-800">
                    E{ep.episodeNumber}
                  </span>

                  {/* Progress bar */}
                  {progress && progress.progressPercent > 0 && (
                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-zinc-800">
                      <div
                        className="h-full bg-indigo-500"
                        style={{ width: `${progress.progressPercent}%` }}
                      />
                    </div>
                  )}
                </div>

                {/* Episode Details */}
                <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="text-sm font-semibold text-zinc-100 truncate group-hover:text-indigo-300">
                        {ep.episodeNumber}. {ep.name}
                      </h4>
                      {/* Watched toggle button */}
                      <button
                        type="button"
                        onClick={(e) => handleToggleWatched(e, ep.episodeNumber)}
                        className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 transition-colors ${
                          isWatched
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                            : 'bg-zinc-800/80 text-zinc-400 hover:text-zinc-200 border border-zinc-700'
                        }`}
                        title={isWatched ? 'Mark as unwatched' : 'Mark as watched'}
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <p className="text-xs text-zinc-400 line-clamp-2 mt-1 leading-relaxed">
                      {ep.overview || 'No episode overview available.'}
                    </p>
                  </div>

                  <div className="flex items-center gap-3 mt-2 text-[11px] text-zinc-400 font-medium">
                    {ep.runtime ? (
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {ep.runtime}m
                      </span>
                    ) : null}
                    {ep.airDate && (
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {ep.airDate}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="p-8 text-center text-zinc-400 text-sm bg-zinc-900/40 rounded-xl border border-zinc-800">
          No episodes found for this season.
        </div>
      )}
    </div>
  );
};
