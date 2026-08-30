import { ProviderAdapter, ProviderMetadata, createStreamId } from './base.js';
import { StreamSource } from '../../src/types/media.js';

export interface WebStreamrConfig {
  mediaFlowProxyUrl?: string;
  flareSolverrUrl?: string;
}

export class WebStreamrProvider implements ProviderAdapter {
  name = 'WebStreamr';
  id = 'webstreamr';
  enabled = true;
  timeoutMs = 9000;
  config: WebStreamrConfig = {};

  constructor(config?: WebStreamrConfig) {
    if (config) this.config = config;
  }

  async resolveMovie(tmdbId: number, metadata: ProviderMetadata): Promise<StreamSource[]> {
    const sources: StreamSource[] = [];
    try {
      // Local context stream generation with optional MediaFlow/FlareSolverr proxying
      let proxyTarget = `/api/proxy/media?url=${encodeURIComponent(`http://localhost:3000/stream/movie/${tmdbId}`)}&context=webstreamr`;
      if (this.config.mediaFlowProxyUrl) {
        proxyTarget = `${this.config.mediaFlowProxyUrl.replace(/\/$/, '')}/proxy/stream?tmdb=${tmdbId}`;
      }

      sources.push({
        id: createStreamId(this.name, '1080p', 0),
        provider: this.name,
        url: proxyTarget,
        quality: '1080p',
        type: 'hls',
        headers: {
          'X-Context': 'WebStreamr-Local',
          'Origin': 'http://localhost'
        },
        title: `${metadata.title} - WebStreamr Direct HLS`,
        direct: true,
        healthScore: 92
      });
    } catch (e) {
      console.warn(`[WebStreamr] Error:`, e);
    }
    return sources;
  }

  async resolveEpisode(tmdbId: number, season: number, episode: number, metadata: ProviderMetadata): Promise<StreamSource[]> {
    const sources: StreamSource[] = [];
    try {
      let proxyTarget = `/api/proxy/media?url=${encodeURIComponent(`http://localhost:3000/stream/tv/${tmdbId}/${season}/${episode}`)}&context=webstreamr`;
      if (this.config.mediaFlowProxyUrl) {
        proxyTarget = `${this.config.mediaFlowProxyUrl.replace(/\/$/, '')}/proxy/stream?tmdb=${tmdbId}&s=${season}&e=${episode}`;
      }

      sources.push({
        id: createStreamId(this.name, '1080p', 0),
        provider: this.name,
        url: proxyTarget,
        quality: '1080p',
        type: 'hls',
        headers: {
          'X-Context': 'WebStreamr-Local',
          'Origin': 'http://localhost'
        },
        title: `S${season}E${episode} - WebStreamr Direct HLS`,
        direct: true,
        healthScore: 92
      });
    } catch (e) {
      console.warn(`[WebStreamr] TV Error:`, e);
    }
    return sources;
  }
}
