import { ProviderAdapter, ProviderMetadata, createStreamId } from './base.js';
import { StreamSource, StremioAddon, StreamQuality } from '../../src/types/media.js';

export function normalizeStremioUrl(url: string): string {
  let cleaned = url.trim();
  if (cleaned.startsWith('stremio://')) {
    cleaned = 'https://' + cleaned.slice(10);
  }
  return cleaned;
}

export async function fetchStremioManifest(manifestUrl: string): Promise<StremioAddon | null> {
  try {
    const url = normalizeStremioUrl(manifestUrl);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);

    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        'User-Agent': 'Stremio/4.4.159'
      }
    });
    clearTimeout(timer);

    if (!res.ok) return null;
    const text = await res.text().catch(() => '');
    if (!text || text.trim().startsWith('<')) return null;
    const json = JSON.parse(text);
    return {
      id: json.id || `stremio_${Math.random().toString(36).substring(2, 8)}`,
      name: json.name || 'Custom Stremio Addon',
      manifestUrl: url,
      enabled: true,
      description: json.description,
      version: json.version,
      resources: Array.isArray(json.resources) 
        ? json.resources.map((r: any) => typeof r === 'string' ? r : r.name)
        : [],
      types: json.types || ['movie', 'series']
    };
  } catch {
    return null;
  }
}

export class StremioProvider implements ProviderAdapter {
  name = 'Stremio Addon';
  id = 'stremio';
  enabled = true;
  timeoutMs = 9000;
  addons: StremioAddon[] = [];

  constructor(addons: StremioAddon[] = []) {
    this.addons = addons;
  }

  private parseQuality(title: string = ''): StreamQuality {
    const lower = title.toLowerCase();
    if (lower.includes('4k') || lower.includes('2160p') || lower.includes('uhd')) return '4K';
    if (lower.includes('1080p') || lower.includes('fhd')) return '1080p';
    if (lower.includes('720p') || lower.includes('hd')) return '720p';
    if (lower.includes('480p') || lower.includes('sd')) return '480p';
    return '1080p';
  }

  async resolveStreamsFromAddon(addon: StremioAddon, type: 'movie' | 'series', id: string): Promise<StreamSource[]> {
    const sources: StreamSource[] = [];
    try {
      const baseUrl = normalizeStremioUrl(addon.manifestUrl).replace(/\/manifest\.json$/, '');
      const endpoint = `${baseUrl}/stream/${type}/${encodeURIComponent(id)}.json`;

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 7000);

      const res = await fetch(endpoint, {
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
          'User-Agent': 'Stremio/4.4.159'
        }
      });
      clearTimeout(timer);

      if (!res.ok) return sources;
      const text = await res.text().catch(() => '');
      if (!text || text.trim().startsWith('<')) return sources;
      const data = JSON.parse(text);
      const streams = data.streams || [];

      for (let i = 0; i < streams.length; i++) {
        const stream = streams[i];
        const streamTitle = stream.name || stream.title || `${addon.name} Stream #${i + 1}`;
        const quality = this.parseQuality(`${stream.name || ''} ${stream.title || ''}`);

        // Torrentio encodes seeders in the description, e.g. "👤 45 💾 2.1 GB".
        const blob = `${stream.title || ''} ${stream.description || ''}`;
        const seedMatch = blob.match(/👤\s*(\d+)/) || blob.match(/[Ss]eeders?[:\s]+(\d+)/);
        const seeds = stream.seeders ?? (seedMatch ? Number(seedMatch[1]) : undefined);
        const sizeMatch = blob.match(/💾\s*([\d.]+\s*[KMGT]i?B)/i);

        let streamUrl = stream.url;
        let streamType: StreamSource['type'] = 'hls';
        let direct = true;

        if (stream.infoHash) {
          streamUrl = `magnet:?xt=urn:btih:${stream.infoHash}&dn=${encodeURIComponent(streamTitle)}`;
          streamType = 'magnet';
          direct = false;
        } else if (stream.ytId) {
          streamUrl = `https://www.youtube.com/watch?v=${stream.ytId}`;
          streamType = 'embed';
          direct = false;
        } else if (streamUrl) {
          if (streamUrl.endsWith('.m3u8') || streamUrl.includes('m3u8')) {
            streamType = 'hls';
          } else if (streamUrl.endsWith('.mp4') || streamUrl.includes('.mp4')) {
            streamType = 'mp4';
          } else if (streamUrl.endsWith('.mkv')) {
            streamType = 'mkv';
          }
        }

        if (streamUrl) {
          const label = streamType === 'magnet'
            ? `${(stream.title || streamTitle).split('\n')[0]}${seeds ? ` · 👤${seeds}` : ''}${sizeMatch ? ` · ${sizeMatch[1]}` : ''}`
            : streamTitle.replace(/\n/g, ' - ');
          sources.push({
            id: createStreamId(`stremio_${addon.name}`, quality, i),
            provider: `Stremio (${addon.name})`,
            url: streamUrl,
            quality,
            type: streamType,
            title: label,
            direct,
            seeds,
            healthScore: 90,
            headers: stream.behaviorHints?.proxyHeaders?.request
          });
        }
      }
    } catch {
      // Stremio query timeout or offline addon fallback
    }
    return sources;
  }

  async resolveMovie(tmdbId: number, metadata: ProviderMetadata): Promise<StreamSource[]> {
    const id = metadata.imdbId || `tmdb:${tmdbId}`;
    const enabledAddons = this.addons.filter(a => a.enabled);
    if (enabledAddons.length === 0) return [];

    const results = await Promise.allSettled(
      enabledAddons.map(addon => this.resolveStreamsFromAddon(addon, 'movie', id))
    );

    const sources: StreamSource[] = [];
    for (const r of results) {
      if (r.status === 'fulfilled') {
        sources.push(...r.value);
      }
    }
    return sources;
  }

  async resolveEpisode(tmdbId: number, season: number, episode: number, metadata: ProviderMetadata): Promise<StreamSource[]> {
    const id = metadata.imdbId ? `${metadata.imdbId}:${season}:${episode}` : `tmdb:${tmdbId}:${season}:${episode}`;
    const enabledAddons = this.addons.filter(a => a.enabled);
    if (enabledAddons.length === 0) return [];

    const results = await Promise.allSettled(
      enabledAddons.map(addon => this.resolveStreamsFromAddon(addon, 'series', id))
    );

    const sources: StreamSource[] = [];
    for (const r of results) {
      if (r.status === 'fulfilled') {
        sources.push(...r.value);
      }
    }
    return sources;
  }
}
