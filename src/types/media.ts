export type MediaType = 'movie' | 'tv';

export interface CastMember {
  id: number;
  name: string;
  character: string;
  profilePath?: string | null;
}

export interface MediaItem {
  id: number;
  tmdbId: number;
  imdbId?: string;
  title: string;
  originalTitle?: string;
  overview: string;
  posterPath?: string | null;
  backdropPath?: string | null;
  releaseDate?: string;
  firstAirDate?: string;
  voteAverage: number;
  voteCount?: number;
  mediaType: MediaType;
  genres?: { id: number; name: string }[];
  runtime?: number;
  status?: string;
  tagline?: string;
  cast?: CastMember[];
  trailerKey?: string;
  seasons?: Season[];
  numberOfSeasons?: number;
  numberOfEpisodes?: number;
}

export interface Season {
  id: number;
  seasonNumber: number;
  name: string;
  overview?: string;
  episodeCount?: number;
  airDate?: string;
  posterPath?: string | null;
  episodes?: Episode[];
}

export interface Episode {
  id: number;
  episodeNumber: number;
  seasonNumber: number;
  name: string;
  overview: string;
  stillPath?: string | null;
  airDate?: string;
  runtime?: number;
  voteAverage?: number;
}

export type StreamQuality = '4K' | '1080p' | '720p' | '480p' | '360p' | 'Auto' | 'Unknown';
export type StreamType = 'hls' | 'mp4' | 'mkv' | 'embed' | 'magnet' | 'torrent' | 'live';

export interface SubtitleTrack {
  language: string;
  label: string;
  url: string;
  provider: string;
  hearingImpaired?: boolean;
  default?: boolean;
}

export interface StreamSource {
  id: string;
  provider: string; // 'VidLink' | 'VidFast' | 'Videasy' | 'VixSrc' | 'Vidsrc (CC)' | 'VidRock' | 'VidJoy' | 'WebStreamr' | 'Stremio' | 'Torrent' | 'Real-Debrid' | 'IPTV' | string;
  url: string;
  quality: StreamQuality;
  type: StreamType;
  headers?: Record<string, string>;
  size?: string | number;
  title?: string;
  direct: boolean;
  format?: string;
  subtitles?: SubtitleTrack[];
  seeds?: number;
  peers?: number;
  healthScore?: number; // 0 - 100
  isDebrid?: boolean;
  pingMs?: number;
  rank?: number;
  // Embed-player integration hints (set by embed providers)
  resumeParam?: string;     // query key to resume at N seconds, e.g. 'startAt' | 'progress'
  autoplayQuery?: string;   // query string forcing autoplay, e.g. 'autoplay=true'
  extraQuery?: string;      // always-on extra params, e.g. 'autoNext=true&theme=E50914'
  supportsProgress?: boolean; // emits watch-progress via postMessage
}

export interface LiveChannel {
  name: string;
  url: string;
  provider: string;
  headers?: Record<string, string>;
  quality?: string;
  type?: 'hls' | 'embed' | 'mp4';
}

export interface LiveEvent {
  id: string;
  title: string;
  category: 'Live Now' | 'Sports' | 'Football' | 'Basketball' | 'NFL' | 'NHL' | 'Channels' | 'Upcoming' | string;
  startTime?: string;
  isLive: boolean;
  poster?: string;
  banner?: string;
  channels: LiveChannel[];
  league?: string;
  teams?: {
    home: string;
    away: string;
    homeLogo?: string;
    awayLogo?: string;
  };
  description?: string;
  provider: 'Dami TV' | 'PPV' | 'CDN-Live' | 'IPTV' | string;
}

export interface WatchProgress {
  mediaId: number;
  mediaType: MediaType;
  title: string;
  posterPath?: string | null;
  backdropPath?: string | null;
  currentTime: number;
  duration: number;
  progressPercent: number;
  season?: number;
  episode?: number;
  episodeTitle?: string;
  lastUpdated: number;
  completed: boolean;
  selectedSourceProvider?: string;
  selectedSubtitleLang?: string;
}

export interface ProviderHealth {
  providerId: string;
  name: string;
  status: 'working' | 'slow' | 'failed' | 'disabled';
  responseTimeMs?: number;
  lastChecked: number;
  enabled: boolean;
  successCount: number;
  failureCount: number;
}

export interface StremioAddon {
  id: string;
  name: string;
  manifestUrl: string;
  enabled: boolean;
  description?: string;
  version?: string;
  resources?: string[];
  types?: string[];
}

export interface AppSettings {
  settingsVersion?: number;
  preferredQuality: StreamQuality;
  autoPlayBestSource: boolean;
  autoNextEpisode: boolean;
  subtitleLanguage: string;
  audioLanguage: string;
  hardwareDecoding: boolean;
  debridService: 'none' | 'realdebrid' | 'torbox' | 'alldebrid' | 'premiumize';
  debridApiKey: string;
  tmdbApiKey: string;
  stremioAddons: StremioAddon[];
  providersEnabled: Record<string, boolean>;
  liveProvidersEnabled: Record<string, boolean>;
  mediaFlowProxyUrl: string;
  flareSolverrUrl: string;
  traktApiKey: string;
  simklApiKey: string;
  jellyfinServer: {
    url: string;
    token: string;
    username: string;
  };
  customM3uUrl: string;
}

export interface ProviderResolutionResult {
  provider: string;
  success: boolean;
  sources: StreamSource[];
  error?: string;
  durationMs: number;
}
