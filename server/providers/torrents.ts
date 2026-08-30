import { ProviderAdapter, ProviderMetadata, createStreamId } from './base.js';
import { StreamSource, StreamQuality } from '../../src/types/media.js';
import { DebridProvider } from './debrid.js';

const YTS_ENDPOINTS = [
  'https://yts.mx/api/v2/list_movies.json',
  'https://yts.rs/api/v2/list_movies.json',
  'https://yts.am/api/v2/list_movies.json',
  'https://movies-api.accel.li/api/v2/list_movies.json'
];

export class TorrentScraperProvider implements ProviderAdapter {
  name = 'Torrent Engine';
  id = 'torrents';
  // Off by default: Torrentio already aggregates YTS/EZTV and more. This
  // standalone scraper mostly just added latency. Opt in via Settings.
  enabled = false;
  timeoutMs = 3500;
  debridProvider?: DebridProvider;

  constructor(debridProvider?: DebridProvider) {
    this.debridProvider = debridProvider;
  }

  private parseQuality(title: string): StreamQuality {
    const t = title.toLowerCase();
    if (t.includes('2160p') || t.includes('4k') || t.includes('uhd')) return '4K';
    if (t.includes('1080p') || t.includes('fhd')) return '1080p';
    if (t.includes('720p') || t.includes('hd')) return '720p';
    if (t.includes('480p')) return '480p';
    return '1080p';
  }

  // Scrape YTS for Movies with resilient endpoint failover
  async scrapeYts(imdbId?: string, query?: string): Promise<StreamSource[]> {
    const sources: StreamSource[] = [];
    const searchTerm = imdbId || query;
    if (!searchTerm) return sources;

    for (const baseEndpoint of YTS_ENDPOINTS) {
      try {
        const url = `${baseEndpoint}?query_term=${encodeURIComponent(searchTerm)}&limit=5`;
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 1800);

        const res = await fetch(url, {
          signal: controller.signal,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        }).catch(() => null);

        clearTimeout(timer);

        if (!res || !res.ok) continue;
        const data = await res.json().catch(() => null);
        if (!data || !data.data) continue;

        const movie = data.data.movies?.[0];
        if (movie && Array.isArray(movie.torrents)) {
          for (let i = 0; i < movie.torrents.length; i++) {
            const t = movie.torrents[i];
            const quality = (t.quality === '2160p' ? '4K' : t.quality === '1080p' ? '1080p' : '720p') as StreamQuality;
            const magnet = `magnet:?xt=urn:btih:${t.hash}&dn=${encodeURIComponent(movie.title_long || movie.title)}&tr=udp://open.demonii.com:1337/announce&tr=udp://tracker.openbittorrent.com:80&tr=udp://tracker.coppersurfer.tk:6969`;

            // If debrid is available, resolve to direct stream
            let debridSource: StreamSource | null = null;
            if (this.debridProvider?.isConfigured()) {
              debridSource = await this.debridProvider.unrestrict(magnet).catch(() => null);
            }

            if (debridSource) {
              sources.push(debridSource);
            } else {
              sources.push({
                id: createStreamId('yts', quality, i),
                provider: 'YTS (Torrent)',
                url: magnet,
                quality,
                type: 'magnet',
                size: t.size,
                seeds: t.seeds,
                peers: t.peers,
                title: `${movie.title} [${t.quality}] [${t.type}] - ${t.size} (Seeds: ${t.seeds})`,
                direct: false,
                healthScore: Math.min(95, 60 + (t.seeds || 0))
              });
            }
          }
        }

        if (sources.length > 0) break;
      } catch {
        // Continue to next mirror silently
      }
    }

    return sources;
  }

  // EZTV public API — TV episodes by IMDb id (numeric, no "tt").
  async scrapeEztv(imdbId?: string): Promise<StreamSource[]> {
    const sources: StreamSource[] = [];
    if (!imdbId) return sources;
    const num = imdbId.replace(/^tt/, '');
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 2500);
      const res = await fetch(`https://eztvx.to/api/get-torrents?imdb_id=${num}&limit=25`, {
        signal: controller.signal,
        headers: { 'User-Agent': 'Mozilla/5.0' }
      }).catch(() => null);
      clearTimeout(timer);
      if (!res || !res.ok) return sources;
      const data = await res.json().catch(() => null);
      const list = data?.torrents || [];
      for (let i = 0; i < Math.min(list.length, 12); i++) {
        const t = list[i];
        const quality = this.parseQuality(t.title || '');
        sources.push({
          id: createStreamId('eztv', quality, i),
          provider: 'EZTV (Torrent)',
          url: t.magnet_url || `magnet:?xt=urn:btih:${t.hash}&dn=${encodeURIComponent(t.title)}`,
          quality,
          type: 'magnet',
          size: t.size_bytes,
          seeds: t.seeds,
          peers: t.peers,
          title: `${t.title} (Seeds: ${t.seeds})`,
          direct: false,
          healthScore: Math.min(90, 50 + (t.seeds || 0))
        });
      }
    } catch {
      // Silent fallback
    }
    return sources;
  }

  async resolveMovie(tmdbId: number, metadata: ProviderMetadata): Promise<StreamSource[]> {
    const sources: StreamSource[] = [];
    const query = `${metadata.title} ${metadata.year || ''}`.trim();

    try {
      const ytsResults = await this.scrapeYts(metadata.imdbId, query);
      sources.push(...ytsResults);
    } catch {
      // Fallback gracefully
    }

    return sources;
  }

  async resolveEpisode(_tmdbId: number, season: number, episode: number, metadata: ProviderMetadata): Promise<StreamSource[]> {
    const sources: StreamSource[] = [];
    try {
      const eztv = await this.scrapeEztv(metadata.imdbId);
      // Keep only this season/episode (or full-season packs).
      const sStr = season < 10 ? `s0${season}` : `s${season}`;
      const eStr = episode < 10 ? `e0${episode}` : `e${episode}`;
      const tag = `${sStr}${eStr}`;
      sources.push(
        ...eztv.filter(s => {
          const t = (s.title || '').toLowerCase().replace(/[^a-z0-9]/g, '');
          return t.includes(tag) || t.includes(`${sStr}`) && !/e\d/.test(t);
        })
      );
    } catch {
      // Fallback gracefully
    }
    return sources;
  }
}
