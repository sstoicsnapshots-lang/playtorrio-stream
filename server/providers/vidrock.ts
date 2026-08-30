import { ProviderAdapter, ProviderMetadata, embedSource } from './base.js';
import { StreamSource } from '../../src/types/media.js';

// VidRock (vidrock.net) — fast, low-ad fallback. No confirmed postMessage progress
// API; kept as a reliability backstop when the tier-1 players are down.
export class VidRockProvider implements ProviderAdapter {
  name = 'VidRock';
  id = 'vidrock';
  enabled = false; // has ads / pop-ups — opt-in via Settings
  timeoutMs = 8000;

  async resolveMovie(tmdbId: number, metadata: ProviderMetadata): Promise<StreamSource[]> {
    return [
      embedSource({
        provider: this.name,
        url: `https://vidrock.net/movie/${tmdbId}`,
        referer: 'https://vidrock.net',
        title: `${metadata.title} — VidRock (backup)`,
        healthScore: 82,
        autoplayQuery: 'autoplay=true',
        supportsProgress: true
      })
    ];
  }

  async resolveEpisode(tmdbId: number, season: number, episode: number, metadata: ProviderMetadata): Promise<StreamSource[]> {
    return [
      embedSource({
        provider: this.name,
        url: `https://vidrock.net/tv/${tmdbId}/${season}/${episode}`,
        referer: 'https://vidrock.net',
        title: `S${season}E${episode} — VidRock (backup)`,
        healthScore: 82,
        autoplayQuery: 'autoplay=true',
        supportsProgress: true
      })
    ];
  }
}
