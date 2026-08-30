import React, { useState, useEffect } from 'react';
import { Play, Info, Flame, Sparkles, Star, Film, Radio } from 'lucide-react';
import { MediaItem, WatchProgress } from '../../types/media';
import { api } from '../../services/api';
import { storage } from '../../services/storage';
import { MediaRow } from '../common/MediaRow';
import { MediaCard } from '../common/MediaCard';

interface HomeViewProps {
  onSelectItem: (item: MediaItem) => void;
  onQuickPlay: (item: MediaItem) => void;
}

export const HomeView: React.FC<HomeViewProps> = ({ onSelectItem, onQuickPlay }) => {
  const [trendingMovies, setTrendingMovies] = useState<MediaItem[]>([]);
  const [popularMovies, setPopularMovies] = useState<MediaItem[]>([]);
  const [trendingSeries, setTrendingSeries] = useState<MediaItem[]>([]);
  const [popularSeries, setPopularSeries] = useState<MediaItem[]>([]);
  const [topRated, setTopRated] = useState<MediaItem[]>([]);
  const [continueWatching, setContinueWatching] = useState<WatchProgress[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    async function loadCatalog() {
      setLoading(true);
      try {
        const [trMovies, popMovies, trSeries, popSeries, top] = await Promise.all([
          api.getTrending('movie'),
          api.getPopular('movie', 1).then(r => r.results),
          api.getTrending('tv'),
          api.getPopular('tv', 1).then(r => r.results),
          api.getTopRated('movie', 1).then(r => r.results)
        ]);

        if (isMounted) {
          setTrendingMovies(trMovies);
          setPopularMovies(popMovies);
          setTrendingSeries(trSeries);
          setPopularSeries(popSeries);
          setTopRated(top);
          setContinueWatching(storage.getWatchProgressList().filter(p => !p.completed));
        }
      } catch (err) {
        console.error('Failed to load home catalog:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadCatalog();
    return () => { isMounted = false; };
  }, []);

  const heroItem = trendingMovies[0] || trendingSeries[0];
  const progressMap = storage.getWatchProgressList().reduce((acc, p) => {
    acc[p.mediaId] = p;
    return acc;
  }, {} as Record<number, WatchProgress>);

  if (loading && !heroItem) {
    return (
      <div className="flex-1 p-8 space-y-8 animate-pulse">
        <div className="h-96 bg-[#11131a] rounded-2xl border border-white/[0.06]" />
        <div className="h-48 bg-[#11131a]/60 rounded-2xl border border-white/[0.06]" />
      </div>
    );
  }

  const releaseYear = (heroItem?.releaseDate || heroItem?.firstAirDate || '').substring(0, 4);

  return (
    <div id="home-view-container" className="pb-16 animate-fadeIn font-sans">
      {/* Cinematic Hero Spotlight with rich IMAX backdrop */}
      {heroItem && (
        <div className="relative mx-8 mt-5 rounded-3xl overflow-hidden aspect-[21/9] min-h-[400px] max-h-[500px] bg-[#0c0d12] border border-[#222736] shadow-2xl">
          {/* Rich Backdrop with fallback */}
          <img
            src={heroItem.backdropPath || '/src/assets/images/cinematic_hero_banner_1787849580190.jpg'}
            alt={heroItem.title}
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover object-center"
          />

          {/* Deep Cinematic Gradients */}
          <div className="hero-gradient" />

          {/* Hero Content */}
          <div className="relative h-full p-8 md:p-12 flex flex-col justify-end max-w-2xl z-10">
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <span className="px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider bg-[#e50914] text-white">
                Featured
              </span>
              {releaseYear && (
                <span className="px-2.5 py-1 rounded-md text-[10px] font-mono font-semibold bg-black/60 text-slate-300 border border-white/10 backdrop-blur-md">
                  {releaseYear}
                </span>
              )}
              <span className="px-2.5 py-1 rounded-md text-[10px] font-semibold uppercase tracking-wider bg-black/60 text-slate-300 border border-white/10 backdrop-blur-md">
                {heroItem.mediaType === 'movie' ? 'Movie' : 'TV Series'}
              </span>
              {heroItem.voteAverage > 0 && (
                <span className="flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-bold bg-black/80 text-amber-400 border border-amber-500/30 backdrop-blur-md">
                  <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                  {heroItem.voteAverage.toFixed(1)} TMDB
                </span>
              )}
            </div>

            <h1 className="text-3xl md:text-5xl font-black text-white tracking-tight leading-tight drop-shadow-md mb-3 font-sans">
              {heroItem.title}
            </h1>

            <p className="text-[#a0a7b8] text-xs md:text-sm line-clamp-3 mb-6 leading-relaxed max-w-xl font-medium">
              {heroItem.overview}
            </p>

            <div className="flex items-center gap-3.5">
              <button
                id="hero-play-btn"
                onClick={() => onQuickPlay(heroItem)}
                className="bg-[#e50914] hover:bg-[#ff1f2d] text-white px-8 py-3 rounded-xl font-bold text-xs md:text-sm flex items-center gap-2.5 transition-all shadow-xl shadow-red-950/60 active:scale-95 cursor-pointer"
              >
                <Play className="w-4 h-4 fill-white" />
                <span>Play Now</span>
              </button>

              <button
                id="hero-details-btn"
                onClick={() => onSelectItem(heroItem)}
                className="bg-[#141722]/90 hover:bg-[#1f2434] text-white px-7 py-3 rounded-xl font-semibold text-xs md:text-sm border border-[#2b3145] backdrop-blur-md transition-all active:scale-95 cursor-pointer flex items-center gap-2"
              >
                <Info className="w-4 h-4 text-slate-300" />
                <span>Overview & Episodes</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Continue Watching Section */}
      {continueWatching.length > 0 && (
        <section className="mt-9 px-8">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-extrabold tracking-tight text-white flex items-center gap-2.5">
              <span>Resume Watching</span>
              <span className="px-2 py-0.5 rounded-full bg-[#1b1f2b] text-amber-400 border border-[#2a3044] text-[10px] font-mono font-bold">
                {continueWatching.length} Items
              </span>
            </h3>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {continueWatching.slice(0, 6).map((prog) => {
              const item: MediaItem = {
                id: prog.mediaId,
                tmdbId: prog.mediaId,
                title: prog.title,
                overview: '',
                posterPath: prog.posterPath,
                backdropPath: prog.backdropPath,
                mediaType: prog.mediaType,
                voteAverage: 0,
                voteCount: 0
              };
              return (
                <MediaCard
                  key={prog.mediaId}
                  item={item}
                  progress={prog}
                  onClick={onSelectItem}
                  onQuickPlay={onQuickPlay}
                />
              );
            })}
          </div>
        </section>
      )}

      {/* Trending Movies Row */}
      <MediaRow
        title="Trending Cinematic Releases"
        items={trendingMovies}
        progressMap={progressMap}
        onClickItem={onSelectItem}
        onQuickPlay={onQuickPlay}
        badge="Hot Today"
      />

      {/* Trending Series Row */}
      <MediaRow
        title="Trending Television & Binge Sagas"
        items={trendingSeries}
        progressMap={progressMap}
        onClickItem={onSelectItem}
        onQuickPlay={onQuickPlay}
      />

      {/* Popular Movies Row */}
      <MediaRow
        title="Top Global Box Office"
        items={popularMovies}
        progressMap={progressMap}
        onClickItem={onSelectItem}
        onQuickPlay={onQuickPlay}
      />

      {/* Top Rated Row */}
      <MediaRow
        title="Masterpieces & Award Winners"
        items={topRated}
        progressMap={progressMap}
        onClickItem={onSelectItem}
        onQuickPlay={onQuickPlay}
      />

      {/* Popular Series Row */}
      <MediaRow
        title="Critically Acclaimed TV Shows"
        items={popularSeries}
        progressMap={progressMap}
        onClickItem={onSelectItem}
        onQuickPlay={onQuickPlay}
      />
    </div>
  );
};
