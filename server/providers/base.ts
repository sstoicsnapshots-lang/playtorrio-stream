import { StreamSource, SubtitleTrack } from '../../src/types/media.js';

export interface ProviderMetadata {
  title: string;
  year?: number;
  imdbId?: string;
  tmdbId: number;
  type: 'movie' | 'tv';
  season?: number;
  episode?: number;
  episodeTitle?: string;
}

export interface ProviderAdapter {
  name: string;
  id: string;
  enabled: boolean;
  timeoutMs: number;
  resolveMovie(tmdbId: number, metadata: ProviderMetadata): Promise<StreamSource[]>;
  resolveEpisode(tmdbId: number, season: number, episode: number, metadata: ProviderMetadata): Promise<StreamSource[]>;
}

export function createStreamId(provider: string, quality: string, index: number): string {
  return `${provider.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${quality.toLowerCase()}_${index}_${Date.now().toString(36)}`;
}

export interface EmbedSpec {
  provider: string;
  url: string;
  referer: string;
  title: string;
  healthScore: number;
  index?: number;
  quality?: StreamSource['quality'];
  resumeParam?: string;
  autoplayQuery?: string;
  extraQuery?: string;
  supportsProgress?: boolean;
}

/** Build a normalized embed StreamSource with player-integration hints. */
export function embedSource(spec: EmbedSpec): StreamSource {
  return {
    id: createStreamId(spec.provider, spec.quality || '1080p', spec.index ?? 0),
    provider: spec.provider,
    url: spec.url,
    quality: spec.quality || '1080p',
    type: 'embed',
    headers: { Referer: spec.referer },
    title: spec.title,
    direct: false,
    healthScore: spec.healthScore,
    resumeParam: spec.resumeParam,
    autoplayQuery: spec.autoplayQuery,
    extraQuery: spec.extraQuery,
    supportsProgress: spec.supportsProgress
  };
}
