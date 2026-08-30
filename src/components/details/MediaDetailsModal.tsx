import React, { useState, useEffect } from 'react';
import {
  X,
  Play,
  Layers,
  Heart,
  Star,
  Clock,
  Calendar,
  Film,
  Tv,
  Share2,
  Check,
  Video,
  Info,
  Sparkles
} from 'lucide-react';
import { MediaItem, Episode, StreamSource, Season } from '../../types/media';
import { api } from '../../services/api';
import { storage } from '../../services/storage';
import { SeasonEpisodeSelector } from './SeasonEpisodeSelector';
import { SourceResolverModal } from './SourceResolverModal';

interface MediaDetailsModalProps {
  mediaId: number;
  mediaType: 'movie' | 'tv';
  onClose: () => void;
  onPlayMedia: (
    item: MediaItem,
    source?: StreamSource,
    season?: number,
    episode?: number,
    availableSources?: StreamSource[]
  ) => void;
}

export const MediaDetailsModal: React.FC<MediaDetailsModalProps> = ({
  mediaId,
  mediaType,
  onClose,
  onPlayMedia
}) => {
  const [item, setItem] = useState<MediaItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [isFav, setIsFav] = useState(false);
  const [trailerOpen, setTrailerOpen] = useState(false);

  // Source Resolution State
  const [resolverOpen, setResolverOpen] = useState(false);
  const [resolvedSources, setResolvedSources] = useState<StreamSource[]>([]);
  const [providerResults, setProviderResults] = useState<any[]>([]);
  const [resolving, setResolving] = useState(false);
  const [resolverError, setResolverError] = useState<string>();
  const [hiddenTorrents, setHiddenTorrents] = useState(0);
  const [selectedSeason, setSelectedSeason] = useState<number>(1);
  const [selectedEpisode, setSelectedEpisode] = useState<number>(1);

  useEffect(() => {
    let isMounted = true;
    async function loadDetails() {
      setLoading(true);
      try {
        const details = await api.getDetails(mediaId, mediaType);
        if (isMounted) {
          setItem(details);
          setIsFav(storage.isFavorite(details.id));
        }
      } catch (err) {
        console.error('Failed to load details:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    loadDetails();
    return () => { isMounted = false; };
  }, [mediaId, mediaType]);

  const handleToggleFavorite = () => {
    if (!item) return;
    const newState = storage.toggleFavorite(item);
    setIsFav(newState);
  };

  const handleResolveAndPlay = async (autoLaunch = true, season = 1, episode = 1) => {
    if (!item) return;
    setResolving(true);
    setResolverError(undefined);
    setSelectedSeason(season);
    setSelectedEpisode(episode);

    if (!autoLaunch) {
      setResolverOpen(true);
    }

    try {
      const year = Number((item.releaseDate || item.firstAirDate || '').substring(0, 4)) || undefined;
      const settings = storage.getSettings();
      
      const res = await api.resolveSources({
        tmdbId: item.tmdbId || item.id,
        type: item.mediaType,
        season,
        episode,
        title: item.title,
        year,
        imdbId: item.imdbId,
        settings
      });

      setResolvedSources(res.sources || []);
      setProviderResults(res.results || []);
      setHiddenTorrents(res.debridConfigured ? 0 : res.hiddenTorrentCount || 0);

      if (autoLaunch) {
        if (res.bestSource) {
          onPlayMedia(item, res.bestSource, season, episode, res.sources);
        } else if (res.sources && res.sources.length > 0) {
          onPlayMedia(item, res.sources[0], season, episode, res.sources);
        } else {
          setResolverOpen(true);
        }
      }
    } catch (err: any) {
      setResolverError(err.message || 'Failed to resolve sources');
      if (autoLaunch) setResolverOpen(true);
    } finally {
      setResolving(false);
    }
  };

  const handleSelectEpisode = (seasonNum: number, ep: Episode) => {
    setSelectedSeason(seasonNum);
    setSelectedEpisode(ep.episodeNumber);
    handleResolveAndPlay(true, seasonNum, ep.episodeNumber);
  };

  const handleManualSourceSelect = (source: StreamSource) => {
    if (!item) return;
    setResolverOpen(false);
    onPlayMedia(item, source, selectedSeason, selectedEpisode, resolvedSources);
  };

  if (!item && loading) {
    return (
      <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#08090c]/95 backdrop-blur-xl">
        <div className="w-10 h-10 border-4 border-[#e50914]/20 border-t-[#e50914] rounded-full animate-spin" />
      </div>
    );
  }

  if (!item) return null;

  const year = (item.releaseDate || item.firstAirDate || '').substring(0, 4);
  const isMovie = item.mediaType === 'movie';

  return (
    <div className="fixed inset-0 z-40 overflow-y-auto bg-[#08090c]/95 backdrop-blur-2xl animate-fadeIn font-sans">
      {/* Container Frame */}
      <div className="min-h-screen relative flex flex-col justify-between max-w-6xl mx-auto my-0 md:my-8 bg-[#0f1117] md:rounded-3xl border border-[#222736] shadow-2xl overflow-hidden">
        
        {/* Backdrop Header */}
        <div className="relative w-full h-80 md:h-[440px] bg-[#141722]">
          {item.backdropPath ? (
            <img
              src={item.backdropPath}
              alt={item.title}
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-[#11131a]" />
          )}

          {/* Cinematic Deep Gradients */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#0f1117] via-[#0f1117]/65 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#0f1117]/85 via-transparent to-transparent" />

          {/* Close Button */}
          <button
            id="close-details-btn"
            onClick={onClose}
            className="absolute top-5 right-5 z-20 w-10 h-10 rounded-full bg-black/70 hover:bg-[#e50914] text-slate-300 hover:text-white border border-white/10 flex items-center justify-center backdrop-blur-md transition-all active:scale-95 cursor-pointer"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="relative -mt-32 md:-mt-48 px-6 md:px-12 pb-12 z-10">
          <div className="flex flex-col md:flex-row gap-8 items-start">
            {/* Poster Frame */}
            <div className="w-48 md:w-60 shrink-0 aspect-[2/3] rounded-2xl overflow-hidden bg-[#161924] border-2 border-[#2b3145] shadow-2xl shadow-black">
              {item.posterPath ? (
                <img
                  src={item.posterPath}
                  alt={item.title}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-slate-500">
                  {isMovie ? <Film className="w-12 h-12 text-amber-500" /> : <Tv className="w-12 h-12 text-amber-500" />}
                </div>
              )}
            </div>

            {/* Info and Actions */}
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-md bg-[#e50914] text-white">
                  {isMovie ? 'Feature Film' : 'TV Series'}
                </span>
                {item.status && (
                  <span className="text-[11px] font-bold text-slate-400 bg-[#161922] px-2.5 py-0.5 rounded-md border border-[#262b3a]">
                    {item.status}
                  </span>
                )}
              </div>

              <h1 className="text-2xl md:text-4xl font-black text-white tracking-tight leading-tight">
                {item.title}
              </h1>

              {item.tagline && (
                <p className="text-sm italic text-amber-400/90 mt-1 font-serif">
                  "{item.tagline}"
                </p>
              )}

              {/* Badges Row */}
              <div className="flex items-center gap-3 mt-4 text-xs font-semibold text-slate-300 flex-wrap">
                {item.voteAverage > 0 && (
                  <div className="flex items-center gap-1.5 bg-black/80 text-amber-400 border border-amber-500/30 px-2.5 py-1 rounded-xl">
                    <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                    <span>{item.voteAverage} TMDB</span>
                  </div>
                )}
                {year && (
                  <div className="flex items-center gap-1.5 bg-[#161922] px-2.5 py-1 rounded-xl border border-[#262b3a]">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    <span>{year}</span>
                  </div>
                )}
                {item.runtime && (
                  <div className="flex items-center gap-1.5 bg-[#161922] px-2.5 py-1 rounded-xl border border-[#262b3a]">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <span>{item.runtime} mins</span>
                  </div>
                )}
                {item.numberOfSeasons && (
                  <div className="flex items-center gap-1.5 bg-[#161922] px-2.5 py-1 rounded-xl border border-[#262b3a]">
                    <Tv className="w-3.5 h-3.5 text-slate-400" />
                    <span>{item.numberOfSeasons} Seasons</span>
                  </div>
                )}
              </div>

              {/* Genres */}
              {item.genres && item.genres.length > 0 && (
                <div className="flex items-center gap-1.5 mt-3.5 flex-wrap">
                  {item.genres.map((g) => (
                    <span
                      key={g.id}
                      className="text-xs px-2.5 py-0.5 rounded-full bg-[#161922] text-slate-300 border border-[#252a38] font-medium"
                    >
                      {g.name}
                    </span>
                  ))}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center gap-3 mt-6 flex-wrap">
                {/* Main Play Button */}
                <button
                  id="details-play-btn"
                  onClick={() => handleResolveAndPlay(true, 1, 1)}
                  disabled={resolving}
                  className="px-7 py-3 rounded-xl bg-[#e50914] hover:bg-[#ff1f2d] text-white font-bold text-sm flex items-center gap-2 shadow-lg shadow-red-950/60 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                >
                  <Play className="w-4 h-4 fill-white" />
                  <span>{resolving ? 'Finding Streams...' : isMovie ? 'Play Movie' : 'Play Episode 1'}</span>
                </button>

                {/* Sources List Button */}
                <button
                  id="details-sources-btn"
                  onClick={() => handleResolveAndPlay(false, 1, 1)}
                  className="px-4 py-3 rounded-xl bg-[#171a24] hover:bg-[#202434] text-slate-200 hover:text-white font-semibold text-sm border border-[#2a3042] flex items-center gap-2 transition-colors cursor-pointer"
                  title="View All Discovered Sources"
                >
                  <Layers className="w-4 h-4 text-slate-300" />
                  <span>Select Source</span>
                </button>

                {/* Favorite Toggle */}
                <button
                  id="details-favorite-btn"
                  onClick={handleToggleFavorite}
                  className={`p-3 rounded-xl border flex items-center justify-center transition-colors cursor-pointer ${
                    isFav
                      ? 'bg-rose-500/20 text-rose-400 border-rose-500/40'
                      : 'bg-[#171a24] hover:bg-[#202434] text-slate-400 hover:text-white border-[#2a3042]'
                  }`}
                  title={isFav ? 'Remove from Watchlist' : 'Add to Watchlist'}
                >
                  <Heart className={`w-4 h-4 ${isFav ? 'fill-rose-500 text-rose-500' : ''}`} />
                </button>

                {/* Trailer Button */}
                {item.trailerKey && (
                  <button
                    id="details-trailer-btn"
                    onClick={() => setTrailerOpen(true)}
                    className="px-4 py-3 rounded-xl bg-[#171a24] hover:bg-[#202434] text-slate-300 hover:text-white font-bold text-sm border border-[#2a3042] flex items-center gap-2 transition-colors cursor-pointer"
                  >
                    <Video className="w-4 h-4 text-amber-400" />
                    <span>Official Trailer</span>
                  </button>
                )}
              </div>

              {/* Overview */}
              <div className="mt-6">
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1.5">Synopsis</h3>
                <p className="text-sm text-[#9aa0b0] leading-relaxed max-w-3xl font-medium">
                  {item.overview || 'No synopsis available for this title.'}
                </p>
              </div>

              {/* Cast */}
              {item.cast && item.cast.length > 0 && (
                <div className="mt-6">
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Key Cast</h3>
                  <div className="flex items-center gap-4 overflow-x-auto pb-2 scrollbar-thin">
                    {item.cast.map((actor) => (
                      <div key={actor.id} className="w-20 shrink-0 text-center">
                        <div className="w-14 h-14 mx-auto rounded-full overflow-hidden bg-[#161922] border border-[#262b3a] mb-1.5 shadow-inner">
                          {actor.profilePath ? (
                            <img
                              src={actor.profilePath}
                              alt={actor.name}
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-xs font-bold text-slate-400">
                              {actor.name.charAt(0)}
                            </div>
                          )}
                        </div>
                        <span className="text-[11px] font-bold text-slate-200 block truncate">{actor.name}</span>
                        <span className="text-[10px] text-[#787f90] block truncate">{actor.character}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* TV Shows Season & Episodes Section */}
          {!isMovie && item.seasons && item.seasons.length > 0 && (
            <SeasonEpisodeSelector
              tvId={item.tmdbId || item.id}
              seasons={item.seasons}
              currentSeasonNumber={selectedSeason}
              currentEpisodeNumber={selectedEpisode}
              onSelectEpisode={handleSelectEpisode}
            />
          )}
        </div>
      </div>

      {/* Trailer Modal */}
      {trailerOpen && item.trailerKey && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#08090c]/95 backdrop-blur-md">
          <div className="relative w-full max-w-4xl aspect-video bg-black rounded-2xl overflow-hidden border border-[#2d3345] shadow-2xl">
            <button
              onClick={() => setTrailerOpen(false)}
              className="absolute top-4 right-4 z-10 w-9 h-9 rounded-full bg-black/80 text-white flex items-center justify-center hover:bg-[#e50914] cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
            <iframe
              src={`https://www.youtube.com/embed/${item.trailerKey}?autoplay=1`}
              title="Trailer"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="w-full h-full"
            />
          </div>
        </div>
      )}

      {/* Source Resolver Modal */}
      <SourceResolverModal
        isOpen={resolverOpen}
        onClose={() => setResolverOpen(false)}
        title={item.title}
        season={item.mediaType === 'tv' ? selectedSeason : undefined}
        episode={item.mediaType === 'tv' ? selectedEpisode : undefined}
        sources={resolvedSources}
        results={providerResults}
        loading={resolving}
        error={resolverError}
        hiddenTorrentCount={hiddenTorrents}
        onSelectSource={handleManualSourceSelect}
      />
    </div>
  );
};
