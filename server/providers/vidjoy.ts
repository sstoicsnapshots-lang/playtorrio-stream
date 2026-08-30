import { ProviderAdapter, ProviderMetadata, embedSource } from './base.js';
import { StreamSource } from '../../src/types/media.js';

// VidJoy (vidjoy.pro) — multi-server aggregator fallback. Reasonable uptime,
// some ads. No confirmed postMessage progress API.
export class VidJoyProvider implements ProviderAdapter {
  name = 'VidJoy';
  id = 'vidjoy';
  enabled = false; // has ads / pop-ups — opt-in via Settings
  timeoutMs = 8000;

  async resolveMovie(tmdbId: number, metadata: ProviderMetadata): Promise<StreamSource[]> {
    return [
      embedSource({
        provider: this.name,
        url: `https://vidjoy.pro/embed/movie/${tmdbId}?adFree=1`,
        referer: 'https://vidjoy.pro',
        title: `${metadata.title} — VidJoy (backup)`,
        healthScore: 80,
        autoplayQuery: 'autoplay=true'
      })
    ];
  }

  async resolveEpisode(tmdbId: number, season: number, episode: number, metadata: ProviderMetadata): Promise<StreamSource[]> {
    return [
      embedSource({
        provider: this.name,
        url: `https://vidjoy.pro/embed/tv/${tmdbId}/${season}/${episode}?adFree=1`,
        referer: 'https://vidjoy.pro',
        title: `S${season}E${episode} — VidJoy (backup)`,
        healthScore: 80,
        autoplayQuery: 'autoplay=true'
      })
    ];
  }
}
