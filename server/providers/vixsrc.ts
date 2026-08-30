import { ProviderAdapter, ProviderMetadata, embedSource } from './base.js';
import { StreamSource } from '../../src/types/media.js';

// VixSrc (vixsrc.to) — JW-player based, often carries genuine 1080p and multi-audio.
// Emits PLAYER_EVENT postMessages ({ type:'PLAYER_EVENT', event:{ event, data } }).
// No resume param; progress comes from postMessage only.
export class VixSrcProvider implements ProviderAdapter {
  name = 'VixSrc';
  id = 'vixsrc';
  enabled = false; // has ads / pop-ups — opt-in via Settings
  timeoutMs = 8000;

  async resolveMovie(tmdbId: number, metadata: ProviderMetadata): Promise<StreamSource[]> {
    return [
      embedSource({
        provider: this.name,
        url: `https://vixsrc.to/movie/${tmdbId}?lang=en`,
        referer: 'https://vixsrc.to',
        title: `${metadata.title} — VixSrc (native quality)`,
        healthScore: 92,
        autoplayQuery: 'autoplay=true',
        supportsProgress: true
      })
    ];
  }

  async resolveEpisode(tmdbId: number, season: number, episode: number, metadata: ProviderMetadata): Promise<StreamSource[]> {
    return [
      embedSource({
        provider: this.name,
        url: `https://vixsrc.to/tv/${tmdbId}/${season}/${episode}?lang=en`,
        referer: 'https://vixsrc.to',
        title: `S${season}E${episode} — VixSrc (native quality)`,
        healthScore: 92,
        autoplayQuery: 'autoplay=true',
        supportsProgress: true
      })
    ];
  }
}
