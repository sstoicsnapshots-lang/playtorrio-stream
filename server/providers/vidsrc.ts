import { ProviderAdapter, ProviderMetadata, embedSource } from './base.js';
import { StreamSource } from '../../src/types/media.js';

// Vidsrc.cc v3 — very large catalog, multi-server failover, ?autoPlay / ?autoNext.
// Emits PLAYER_EVENT postMessages during playback. Slower to first-frame than
// VidLink/VidFast, so kept below them.
export class VidsrcProvider implements ProviderAdapter {
  name = 'Vidsrc';
  id = 'vidsrc';
  enabled = false; // has ads / pop-ups — opt-in via Settings
  timeoutMs = 9000;

  async resolveMovie(tmdbId: number, metadata: ProviderMetadata): Promise<StreamSource[]> {
    return [
      embedSource({
        provider: 'Vidsrc (CC)',
        url: `https://vidsrc.cc/v3/embed/movie/${tmdbId}`,
        referer: 'https://vidsrc.cc',
        title: `${metadata.title} — Vidsrc CC v3`,
        healthScore: 90,
        autoplayQuery: 'autoPlay=true',
        supportsProgress: true
      })
    ];
  }

  async resolveEpisode(tmdbId: number, season: number, episode: number, metadata: ProviderMetadata): Promise<StreamSource[]> {
    return [
      embedSource({
        provider: 'Vidsrc (CC)',
        url: `https://vidsrc.cc/v3/embed/tv/${tmdbId}/${season}/${episode}`,
        referer: 'https://vidsrc.cc',
        title: `S${season}E${episode} — Vidsrc CC v3`,
        healthScore: 90,
        autoplayQuery: 'autoPlay=true',
        extraQuery: 'autoNext=true',
        supportsProgress: true
      })
    ];
  }
}
