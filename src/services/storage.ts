import { AppSettings, MediaItem, WatchProgress, StremioAddon } from '../types/media';

const SETTINGS_KEY = 'playtorrio_settings';
const PROGRESS_KEY = 'playtorrio_watch_progress';
const FAVORITES_KEY = 'playtorrio_favorites';
const HISTORY_KEY = 'playtorrio_history';
const EPISODES_WATCHED_KEY = 'playtorrio_episodes_watched';

// Bump when default provider toggles change and existing users should be migrated.
const SETTINGS_VERSION = 2;

export const DEFAULT_SETTINGS: AppSettings = {
  settingsVersion: SETTINGS_VERSION,
  preferredQuality: '1080p',
  autoPlayBestSource: true,
  autoNextEpisode: true,
  subtitleLanguage: 'en',
  audioLanguage: 'en',
  hardwareDecoding: true,
  debridService: 'none',
  debridApiKey: '',
  tmdbApiKey: '',
  stremioAddons: [
    {
      id: 'torrentio',
      name: 'Torrentio',
      manifestUrl:
        'https://torrentio.strem.fun/sort=qualitysize|qualityfilter=other,scr,cam/manifest.json',
      enabled: true,
      description:
        'Torrent aggregator (YTS, EZTV, 1337x, TPB…). Returns magnet links — needs a Debrid service (Settings ▸ Debrid Provider) to actually play, or replace this with your own Real-Debrid-configured Torrentio manifest URL.'
    }
  ],
  providersEnabled: {
    // Ad-free players on by default. The rest (ads / pop-ups) are opt-in.
    'vidlink': true,
    'vidfast': true,
    'videasy': false,
    'vixsrc': false,
    'vidsrc': false,
    'vidrock': false,
    'vidjoy': false,
    'webstreamr': true,
    'stremio': true,
    'torrents': false
  },
  liveProvidersEnabled: {
    'dami': true,
    'ppv': true,
    'cdnLive': true
  },
  mediaFlowProxyUrl: '',
  flareSolverrUrl: '',
  traktApiKey: '',
  simklApiKey: '',
  jellyfinServer: {
    url: '',
    token: '',
    username: ''
  },
  customM3uUrl: ''
};

export const storage = {
  // Settings
  getSettings(): AppSettings {
    try {
      const data = localStorage.getItem(SETTINGS_KEY);
      if (!data) return DEFAULT_SETTINGS;
      const saved = JSON.parse(data);
      const merged: AppSettings = { ...DEFAULT_SETTINGS, ...saved };
      // Migration: the ad-free provider defaults changed. One-time reset of the
      // provider toggles so existing users get the clean set (they can re-enable
      // the ad-supported ones in Settings).
      if (saved.settingsVersion !== SETTINGS_VERSION) {
        merged.providersEnabled = { ...DEFAULT_SETTINGS.providersEnabled };
        merged.settingsVersion = SETTINGS_VERSION;
        try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(merged)); } catch {}
      }
      return merged;
    } catch {
      return DEFAULT_SETTINGS;
    }
  },

  saveSettings(settings: AppSettings) {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch (e) {
      console.warn('Failed to save settings to localStorage:', e);
    }
  },

  // Watch Progress (for Continue Watching)
  getWatchProgressList(): WatchProgress[] {
    try {
      const data = localStorage.getItem(PROGRESS_KEY);
      if (!data) return [];
      const list: WatchProgress[] = JSON.parse(data);
      // Sort by last updated descending
      return list.sort((a, b) => b.lastUpdated - a.lastUpdated);
    } catch {
      return [];
    }
  },

  getProgress(mediaId: number, season?: number, episode?: number): WatchProgress | null {
    const list = this.getWatchProgressList();
    return list.find(p => 
      p.mediaId === mediaId && 
      (season === undefined || p.season === season) && 
      (episode === undefined || p.episode === episode)
    ) || null;
  },

  saveProgress(progress: WatchProgress) {
    try {
      const list = this.getWatchProgressList();
      const existingIdx = list.findIndex(p => 
        p.mediaId === progress.mediaId && 
        p.season === progress.season && 
        p.episode === progress.episode
      );

      if (existingIdx !== -1) {
        list[existingIdx] = { ...list[existingIdx], ...progress, lastUpdated: Date.now() };
      } else {
        list.unshift({ ...progress, lastUpdated: Date.now() });
      }

      // Keep max 50 items
      const trimmed = list.slice(0, 50);
      localStorage.setItem(PROGRESS_KEY, JSON.stringify(trimmed));
    } catch (e) {
      console.warn('Failed to save watch progress:', e);
    }
  },

  removeProgress(mediaId: number, season?: number, episode?: number) {
    try {
      const list = this.getWatchProgressList().filter(p => 
        !(p.mediaId === mediaId && (season === undefined || p.season === season) && (episode === undefined || p.episode === episode))
      );
      localStorage.setItem(PROGRESS_KEY, JSON.stringify(list));
    } catch (e) {
      console.warn('Failed to remove progress:', e);
    }
  },

  // Favorites
  getFavorites(): MediaItem[] {
    try {
      const data = localStorage.getItem(FAVORITES_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  isFavorite(mediaId: number): boolean {
    const list = this.getFavorites();
    return list.some(item => item.id === mediaId || item.tmdbId === mediaId);
  },

  toggleFavorite(item: MediaItem): boolean {
    const list = this.getFavorites();
    const exists = list.some(i => i.id === item.id || i.tmdbId === item.tmdbId);
    let updated: MediaItem[];
    if (exists) {
      updated = list.filter(i => i.id !== item.id && i.tmdbId !== item.tmdbId);
    } else {
      updated = [item, ...list];
    }
    try {
      localStorage.setItem(FAVORITES_KEY, JSON.stringify(updated));
    } catch (e) {
      console.warn('Failed to toggle favorite:', e);
    }
    return !exists;
  },

  // Watch History
  getHistory(): WatchProgress[] {
    try {
      const data = localStorage.getItem(HISTORY_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  addToHistory(progress: WatchProgress) {
    try {
      const list = this.getHistory().filter(h => 
        !(h.mediaId === progress.mediaId && h.season === progress.season && h.episode === progress.episode)
      );
      list.unshift({ ...progress, lastUpdated: Date.now() });
      localStorage.setItem(HISTORY_KEY, JSON.stringify(list.slice(0, 100)));
    } catch (e) {
      console.warn('Failed to save history:', e);
    }
  },

  clearHistory() {
    try {
      localStorage.removeItem(HISTORY_KEY);
    } catch (e) {
      console.warn('Failed to clear history:', e);
    }
  },

  // Watched episodes set
  getWatchedEpisodes(): Record<string, boolean> {
    try {
      const data = localStorage.getItem(EPISODES_WATCHED_KEY);
      return data ? JSON.parse(data) : {};
    } catch {
      return {};
    }
  },

  markEpisodeWatched(tvId: number, season: number, episode: number, watched = true) {
    try {
      const watchedMap = this.getWatchedEpisodes();
      const key = `${tvId}_s${season}_e${episode}`;
      if (watched) {
        watchedMap[key] = true;
      } else {
        delete watchedMap[key];
      }
      localStorage.setItem(EPISODES_WATCHED_KEY, JSON.stringify(watchedMap));
    } catch (e) {
      console.warn('Failed to mark episode watched:', e);
    }
  },

  isEpisodeWatched(tvId: number, season: number, episode: number): boolean {
    const watchedMap = this.getWatchedEpisodes();
    return !!watchedMap[`${tvId}_s${season}_e${episode}`];
  }
};
