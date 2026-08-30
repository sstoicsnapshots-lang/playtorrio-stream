import {
  MediaItem,
  Season,
  StreamSource,
  LiveEvent,
  SubtitleTrack,
  ProviderResolutionResult,
  AppSettings,
  StremioAddon
} from '../types/media';
import { FALLBACK_TRENDING_MOVIES, FALLBACK_TRENDING_SERIES } from './fallbackCatalog';

export interface ResolveSourcesResponse {
  sources: StreamSource[];
  results: ProviderResolutionResult[];
  bestSource?: StreamSource;
  hiddenTorrentCount?: number;
  debridConfigured?: boolean;
  error?: string;
}

export const api = {
  // TMDB Metadata
  async getTrending(type: 'movie' | 'tv' = 'movie', page = 1, apiKey?: string): Promise<MediaItem[]> {
    try {
      const params = new URLSearchParams({ type, page: String(page) });
      if (apiKey) params.set('apiKey', apiKey);
      const res = await fetch(`/api/tmdb/trending?${params.toString()}`);
      if (!res.ok) {
        return type === 'movie' ? FALLBACK_TRENDING_MOVIES : FALLBACK_TRENDING_SERIES;
      }
      const data = await res.json();
      if (!data.results || data.results.length === 0) {
        return type === 'movie' ? FALLBACK_TRENDING_MOVIES : FALLBACK_TRENDING_SERIES;
      }
      return data.results;
    } catch {
      return type === 'movie' ? FALLBACK_TRENDING_MOVIES : FALLBACK_TRENDING_SERIES;
    }
  },

  async getPopular(type: 'movie' | 'tv' = 'movie', page = 1, apiKey?: string): Promise<{ results: MediaItem[]; totalPages: number }> {
    try {
      const params = new URLSearchParams({ type, page: String(page) });
      if (apiKey) params.set('apiKey', apiKey);
      const res = await fetch(`/api/tmdb/popular?${params.toString()}`);
      if (!res.ok) {
        const fallback = type === 'movie' ? FALLBACK_TRENDING_MOVIES : FALLBACK_TRENDING_SERIES;
        return { results: fallback, totalPages: 1 };
      }
      const data = await res.json();
      if (!data.results || data.results.length === 0) {
        const fallback = type === 'movie' ? FALLBACK_TRENDING_MOVIES : FALLBACK_TRENDING_SERIES;
        return { results: fallback, totalPages: 1 };
      }
      return data;
    } catch {
      const fallback = type === 'movie' ? FALLBACK_TRENDING_MOVIES : FALLBACK_TRENDING_SERIES;
      return { results: fallback, totalPages: 1 };
    }
  },

  async getTopRated(type: 'movie' | 'tv' = 'movie', page = 1, apiKey?: string): Promise<{ results: MediaItem[]; totalPages: number }> {
    try {
      const params = new URLSearchParams({ type, page: String(page) });
      if (apiKey) params.set('apiKey', apiKey);
      const res = await fetch(`/api/tmdb/top_rated?${params.toString()}`);
      if (!res.ok) {
        const fallback = type === 'movie' ? [...FALLBACK_TRENDING_MOVIES].reverse() : [...FALLBACK_TRENDING_SERIES].reverse();
        return { results: fallback, totalPages: 1 };
      }
      const data = await res.json();
      if (!data.results || data.results.length === 0) {
        const fallback = type === 'movie' ? [...FALLBACK_TRENDING_MOVIES].reverse() : [...FALLBACK_TRENDING_SERIES].reverse();
        return { results: fallback, totalPages: 1 };
      }
      return data;
    } catch {
      const fallback = type === 'movie' ? [...FALLBACK_TRENDING_MOVIES].reverse() : [...FALLBACK_TRENDING_SERIES].reverse();
      return { results: fallback, totalPages: 1 };
    }
  },

  async getUpcoming(page = 1, apiKey?: string): Promise<MediaItem[]> {
    try {
      const params = new URLSearchParams({ type: 'movie', page: String(page) });
      if (apiKey) params.set('apiKey', apiKey);
      const res = await fetch(`/api/tmdb/upcoming?${params.toString()}`);
      if (!res.ok) return FALLBACK_TRENDING_MOVIES.slice(2);
      const data = await res.json();
      return (data.results && data.results.length > 0) ? data.results : FALLBACK_TRENDING_MOVIES.slice(2);
    } catch {
      return FALLBACK_TRENDING_MOVIES.slice(2);
    }
  },

  async getOnTheAir(page = 1, apiKey?: string): Promise<MediaItem[]> {
    try {
      const params = new URLSearchParams({ type: 'tv', page: String(page) });
      if (apiKey) params.set('apiKey', apiKey);
      const res = await fetch(`/api/tmdb/upcoming?${params.toString()}`);
      if (!res.ok) return FALLBACK_TRENDING_SERIES;
      const data = await res.json();
      return (data.results && data.results.length > 0) ? data.results : FALLBACK_TRENDING_SERIES;
    } catch {
      return FALLBACK_TRENDING_SERIES;
    }
  },


  async getGenres(type: 'movie' | 'tv' = 'movie', apiKey?: string): Promise<{ id: number; name: string }[]> {
    const params = new URLSearchParams({ type });
    if (apiKey) params.set('apiKey', apiKey);
    const res = await fetch(`/api/tmdb/genres?${params.toString()}`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.genres || [];
  },

  async discoverByGenre(type: 'movie' | 'tv', genreId: number, page = 1, apiKey?: string): Promise<MediaItem[]> {
    const params = new URLSearchParams({ type, genreId: String(genreId), page: String(page) });
    if (apiKey) params.set('apiKey', apiKey);
    const res = await fetch(`/api/tmdb/discover?${params.toString()}`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.results || [];
  },

  async search(query: string, type: 'all' | 'movie' | 'tv' = 'all', page = 1, apiKey?: string): Promise<MediaItem[]> {
    const params = new URLSearchParams({ query, type, page: String(page) });
    if (apiKey) params.set('apiKey', apiKey);
    const res = await fetch(`/api/tmdb/search?${params.toString()}`);
    if (!res.ok) return [];
    const data = await res.json();
    // Guard against a mislabelled mediaType (e.g. "all"/"multi" leaking through):
    // derive it per-item from which date field TMDB returned.
    return (data.results || []).map((item: MediaItem) =>
      item.mediaType === 'movie' || item.mediaType === 'tv'
        ? item
        : { ...item, mediaType: item.firstAirDate && !item.releaseDate ? 'tv' : 'movie' }
    );
  },

  async getDetails(id: number, type: 'movie' | 'tv' = 'movie', apiKey?: string): Promise<MediaItem> {
    const params = new URLSearchParams({ id: String(id), type });
    if (apiKey) params.set('apiKey', apiKey);
    const res = await fetch(`/api/tmdb/details?${params.toString()}`);
    if (!res.ok) throw new Error('Failed to fetch media details');
    const data = await res.json();
    return data.item;
  },

  async getSeason(tvId: number, seasonNumber: number, apiKey?: string): Promise<Season> {
    const params = new URLSearchParams({ tvId: String(tvId), seasonNumber: String(seasonNumber) });
    if (apiKey) params.set('apiKey', apiKey);
    const res = await fetch(`/api/tmdb/season?${params.toString()}`);
    if (!res.ok) throw new Error('Failed to fetch season');
    const data = await res.json();
    return data.season;
  },

  // Source Resolution
  async resolveSources(payload: {
    tmdbId: number;
    type: 'movie' | 'tv';
    season?: number;
    episode?: number;
    title: string;
    year?: number;
    imdbId?: string;
    settings?: AppSettings;
  }): Promise<ResolveSourcesResponse> {
    const res = await fetch('/api/resolve/sources', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tmdbId: payload.tmdbId,
        type: payload.type,
        season: payload.season,
        episode: payload.episode,
        title: payload.title,
        year: payload.year,
        imdbId: payload.imdbId,
        options: {
          providersEnabled: payload.settings?.providersEnabled,
          stremioAddons: payload.settings?.stremioAddons,
          debridConfig: payload.settings ? {
            service: payload.settings.debridService,
            apiKey: payload.settings.debridApiKey
          } : undefined,
          webstreamrConfig: payload.settings ? {
            mediaFlowProxyUrl: payload.settings.mediaFlowProxyUrl,
            flareSolverrUrl: payload.settings.flareSolverrUrl
          } : undefined
        }
      })
    });

    if (!res.ok) throw new Error('Failed to resolve streaming sources');
    return res.json();
  },

  // Live TV Streams
  async getLiveStreams(settings?: AppSettings): Promise<LiveEvent[]> {
    const params = new URLSearchParams();
    if (settings?.liveProvidersEnabled) {
      if (settings.liveProvidersEnabled['dami'] !== undefined) params.set('dami', String(settings.liveProvidersEnabled['dami']));
      if (settings.liveProvidersEnabled['ppv'] !== undefined) params.set('ppv', String(settings.liveProvidersEnabled['ppv']));
      if (settings.liveProvidersEnabled['cdnLive'] !== undefined) params.set('cdnLive', String(settings.liveProvidersEnabled['cdnLive']));
    }
    if (settings?.customM3uUrl) params.set('m3uUrl', settings.customM3uUrl);

    const res = await fetch(`/api/live/streams?${params.toString()}`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.events || [];
  },

  async getLiveEvents(settings?: AppSettings): Promise<{ events: LiveEvent[]; categories: string[] }> {
    const params = new URLSearchParams();
    if (settings?.liveProvidersEnabled) {
      if (settings.liveProvidersEnabled['dami'] !== undefined) params.set('dami', String(settings.liveProvidersEnabled['dami']));
      if (settings.liveProvidersEnabled['ppv'] !== undefined) params.set('ppv', String(settings.liveProvidersEnabled['ppv']));
      if (settings.liveProvidersEnabled['cdnLive'] !== undefined) params.set('cdnLive', String(settings.liveProvidersEnabled['cdnLive']));
    }
    if (settings?.customM3uUrl) params.set('m3uUrl', settings.customM3uUrl);

    const res = await fetch(`/api/live/streams?${params.toString()}`);
    if (!res.ok) return { events: [], categories: [] };
    const data = await res.json();
    return {
      events: data.events || [],
      categories: data.categories || []
    };
  },


  // Subtitles
  async getSubtitles(query: {
    imdbId?: string;
    tmdbId?: number;
    season?: number;
    episode?: number;
    title?: string;
    year?: number;
  }): Promise<SubtitleTrack[]> {
    const params = new URLSearchParams();
    if (query.imdbId) params.set('imdbId', query.imdbId);
    if (query.tmdbId) params.set('tmdbId', String(query.tmdbId));
    if (query.season) params.set('season', String(query.season));
    if (query.episode) params.set('episode', String(query.episode));
    if (query.title) params.set('title', query.title);
    if (query.year) params.set('year', String(query.year));

    const res = await fetch(`/api/subtitles?${params.toString()}`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.tracks || [];
  },

  // Stremio Addon Testing
  async testStremioManifest(manifestUrl: string): Promise<StremioAddon | null> {
    const res = await fetch('/api/stremio/manifest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ manifestUrl })
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.addon || null;
  },

  // Provider Health check
  async getProviderHealth(): Promise<any[]> {
    const res = await fetch('/api/provider/health');
    if (!res.ok) return [];
    const data = await res.json();
    return data.health || [];
  }
};
