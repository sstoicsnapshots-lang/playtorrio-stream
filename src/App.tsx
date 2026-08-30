import React, { useState, useEffect } from 'react';
import { Sidebar, ViewType } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';
import { HomeView } from './components/views/HomeView';
import { MoviesView } from './components/views/MoviesView';
import { SeriesView } from './components/views/SeriesView';
import { LiveView } from './components/views/LiveView';
import { SearchView } from './components/views/SearchView';
import { ContinueWatchingView } from './components/views/ContinueWatchingView';
import { FavoritesView } from './components/views/FavoritesView';
import { HistoryView } from './components/views/HistoryView';
import { SettingsView } from './components/views/SettingsView';
import { MediaDetailsModal } from './components/details/MediaDetailsModal';
import { MediaPlayer } from './components/player/MediaPlayer';
import { LivePlayer } from './components/player/LivePlayer';
import { MediaItem, StreamSource, LiveEvent, WatchProgress } from './types/media';
import { storage } from './services/storage';
import { api } from './services/api';

export default function App() {
  const [currentView, setCurrentView] = useState<ViewType>('home');
  const [searchQuery, setSearchQuery] = useState('');
  const [continueCount, setContinueCount] = useState(0);
  const [favoritesCount, setFavoritesCount] = useState(0);
  const [liveEventCount, setLiveEventCount] = useState(0);

  // Active Modals & Players
  const [selectedMedia, setSelectedMedia] = useState<{ id: number; type: 'movie' | 'tv' } | null>(null);
  
  // Media Player State
  const [playerState, setPlayerState] = useState<{
    item: MediaItem;
    source: StreamSource;
    availableSources: StreamSource[];
    season?: number;
    episode?: number;
    hasNext?: boolean;
  } | null>(null);

  // Live Player State
  const [livePlayerEvent, setLivePlayerEvent] = useState<LiveEvent | null>(null);

  // Refresh badges
  const refreshBadges = () => {
    setContinueCount(storage.getWatchProgressList().filter(p => !p.completed).length);
    setFavoritesCount(storage.getFavorites().length);
  };

  // Badges come from localStorage — cheap, fine to recompute on navigation.
  useEffect(() => { refreshBadges(); }, [currentView, playerState]);

  // Live event count is a network call — fetch once, then refresh on the same
  // 2-minute cadence the server caches it, not on every navigation.
  useEffect(() => {
    let alive = true;
    const load = () => api.getLiveEvents()
      .then(res => { if (alive && res.events) setLiveEventCount(res.events.length); })
      .catch(() => {});
    load();
    const t = setInterval(load, 120000);
    return () => { alive = false; clearInterval(t); };
  }, []);

  // Click on a media item -> opens Details modal
  const handleSelectItem = (item: MediaItem) => {
    setSelectedMedia({
      id: item.tmdbId || item.id,
      type: item.mediaType
    });
  };

  // Quick Play -> resolves and launches directly
  const handleQuickPlay = async (item: MediaItem) => {
    try {
      const year = Number((item.releaseDate || item.firstAirDate || '').substring(0, 4)) || undefined;
      const settings = storage.getSettings();
      const res = await api.resolveSources({
        tmdbId: item.tmdbId || item.id,
        type: item.mediaType,
        season: 1,
        episode: 1,
        title: item.title,
        year,
        imdbId: item.imdbId,
        settings
      });

      if (res.bestSource || (res.sources && res.sources.length > 0)) {
        const source = res.bestSource || res.sources[0];
        setPlayerState({
          item,
          source,
          availableSources: res.sources,
          season: item.mediaType === 'tv' ? 1 : undefined,
          episode: item.mediaType === 'tv' ? 1 : undefined,
          hasNext: item.mediaType === 'tv'
        });
      } else {
        // Fallback: open details so user can see sources or trailers
        handleSelectItem(item);
      }
    } catch (err) {
      console.error('Quick play error:', err);
      handleSelectItem(item);
    }
  };

  // Resume a Continue Watching / History entry: resolve the exact saved
  // season+episode and jump straight into the player (which seeks to the
  // saved timestamp on its own).
  const handleResumeProgress = async (progress: WatchProgress) => {
    try {
      const settings = storage.getSettings();
      const isTv = progress.mediaType === 'tv';
      const full = await api.getDetails(progress.mediaId, isTv ? 'tv' : 'movie').catch(() => null);
      const item: MediaItem = full || {
        id: progress.mediaId,
        tmdbId: progress.mediaId,
        title: progress.title,
        mediaType: progress.mediaType,
        overview: '',
        voteAverage: 0,
        posterPath: progress.posterPath,
        backdropPath: progress.backdropPath
      };
      const year = Number((item.releaseDate || item.firstAirDate || '').substring(0, 4)) || undefined;
      const res = await api.resolveSources({
        tmdbId: progress.mediaId,
        type: isTv ? 'tv' : 'movie',
        season: isTv ? progress.season : undefined,
        episode: isTv ? progress.episode : undefined,
        title: progress.title,
        year,
        imdbId: item.imdbId,
        settings
      });

      if (res.bestSource || (res.sources && res.sources.length > 0)) {
        setPlayerState({
          item,
          source: res.bestSource || res.sources[0],
          availableSources: res.sources && res.sources.length > 0 ? res.sources : [res.bestSource!],
          season: isTv ? progress.season : undefined,
          episode: isTv ? progress.episode : undefined,
          hasNext: isTv
        });
      } else {
        handleSelectItem(item);
      }
    } catch (err) {
      console.error('Resume error:', err);
    }
  };

  // Launch Player from Details modal
  const handlePlayFromDetails = (
    item: MediaItem,
    source?: StreamSource,
    season = 1,
    episode = 1,
    availableSources?: StreamSource[]
  ) => {
    if (source) {
      setPlayerState({
        item,
        source,
        availableSources: availableSources && availableSources.length > 0 ? availableSources : [source],
        season: item.mediaType === 'tv' ? season : undefined,
        episode: item.mediaType === 'tv' ? episode : undefined,
        hasNext: item.mediaType === 'tv'
      });
      setSelectedMedia(null);
    }
  };

  // Switch to an arbitrary season/episode from inside the player
  const handleChangeEpisode = async (seasonNum: number, episodeNum: number) => {
    if (!playerState) return;
    try {
      const year = Number((playerState.item.releaseDate || playerState.item.firstAirDate || '').substring(0, 4)) || undefined;
      const settings = storage.getSettings();
      const res = await api.resolveSources({
        tmdbId: playerState.item.tmdbId || playerState.item.id,
        type: 'tv',
        season: seasonNum,
        episode: episodeNum,
        title: playerState.item.title,
        year,
        imdbId: playerState.item.imdbId,
        settings
      });

      if (res.bestSource || (res.sources && res.sources.length > 0)) {
        setPlayerState({
          item: playerState.item,
          source: res.bestSource || res.sources[0],
          availableSources: res.sources,
          season: seasonNum,
          episode: episodeNum,
          hasNext: true
        });
      }
    } catch (e) {
      console.error('Change episode error:', e);
    }
  };

  // Handle Next Episode
  const handleNextEpisode = async () => {
    if (!playerState || !playerState.season || !playerState.episode) return;
    await handleChangeEpisode(playerState.season, playerState.episode + 1);
  };

  return (
    <div id="playtorrio-app-root" className="flex h-screen w-screen bg-[#08090d] text-slate-100 overflow-hidden font-sans select-none">
      {/* Persistent Left Desktop Sidebar */}
      <Sidebar
        currentView={currentView}
        onSelectView={(v) => {
          setCurrentView(v);
          refreshBadges();
        }}
        continueCount={continueCount}
        favoritesCount={favoritesCount}
      />

      {/* Main App Canvas */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden bg-[#08090d]">
        {/* Top Header */}
        <Header
          query={searchQuery}
          onQueryChange={setSearchQuery}
          onSelectView={setCurrentView}
          liveCount={liveEventCount}
        />

        {/* Scrollable View Content */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-thin">
          {currentView === 'home' && (
            <HomeView
              onSelectItem={handleSelectItem}
              onQuickPlay={handleQuickPlay}
            />
          )}

          {currentView === 'movies' && (
            <MoviesView
              onSelectItem={handleSelectItem}
              onQuickPlay={handleQuickPlay}
            />
          )}

          {currentView === 'series' && (
            <SeriesView
              onSelectItem={handleSelectItem}
              onQuickPlay={handleQuickPlay}
            />
          )}

          {currentView === 'live' && (
            <LiveView
              onPlayLiveEvent={(ev) => setLivePlayerEvent(ev)}
            />
          )}

          {currentView === 'search' && (
            <SearchView
              query={searchQuery}
              onSelectItem={handleSelectItem}
              onQuickPlay={handleQuickPlay}
            />
          )}

          {currentView === 'continue' && (
            <ContinueWatchingView
              onResumeProgress={handleResumeProgress}
              onSelectItem={handleSelectItem}
            />
          )}

          {currentView === 'favorites' && (
            <FavoritesView
              onSelectItem={handleSelectItem}
              onQuickPlay={handleQuickPlay}
            />
          )}

          {currentView === 'history' && (
            <HistoryView
              onResumeProgress={handleResumeProgress}
              onSelectItem={handleSelectItem}
            />
          )}

          {currentView === 'settings' && (
            <SettingsView />
          )}
        </main>
      </div>

      {/* Media Details Modal */}
      {selectedMedia && (
        <MediaDetailsModal
          mediaId={selectedMedia.id}
          mediaType={selectedMedia.type}
          onClose={() => {
            setSelectedMedia(null);
            refreshBadges();
          }}
          onPlayMedia={handlePlayFromDetails}
        />
      )}

      {/* Fullscreen Video Player */}
      {playerState && (
        <MediaPlayer
          item={playerState.item}
          initialSource={playerState.source}
          availableSources={playerState.availableSources}
          season={playerState.season}
          episode={playerState.episode}
          hasNextEpisode={playerState.hasNext}
          onNextEpisode={handleNextEpisode}
          onChangeEpisode={handleChangeEpisode}
          onClose={() => {
            setPlayerState(null);
            refreshBadges();
          }}
        />
      )}

      {/* Fullscreen Live Sports / TV Player */}
      {livePlayerEvent && (
        <LivePlayer
          event={livePlayerEvent}
          onClose={() => setLivePlayerEvent(null)}
        />
      )}
    </div>
  );
}
