import { StreamSource } from '../../src/types/media.js';
import { createStreamId } from './base.js';

export type DebridServiceType = 'none' | 'realdebrid' | 'torbox' | 'alldebrid' | 'premiumize';

export interface DebridConfig {
  service: DebridServiceType;
  apiKey: string;
}

export class DebridProvider {
  service: DebridServiceType = 'none';
  apiKey = '';

  constructor(config?: DebridConfig) {
    if (config) {
      this.service = config.service;
      this.apiKey = config.apiKey;
    }
  }

  isConfigured(): boolean {
    return this.service !== 'none' && this.apiKey.trim().length > 5;
  }

  // Real-Debrid unrestrict flow
  async unrestrictRealDebrid(magnetOrLink: string): Promise<StreamSource | null> {
    try {
      if (magnetOrLink.startsWith('magnet:')) {
        // Step 1: Add magnet
        const addRes = await fetch('https://api.real-debrid.com/rest/1.0/torrents/addMagnet', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: `magnet=${encodeURIComponent(magnetOrLink)}`
        });
        if (!addRes.ok) return null;
        const addData = await addRes.json();
        const torrentId = addData.id;

        // Step 2: Get torrent info and select all files
        const infoRes = await fetch(`https://api.real-debrid.com/rest/1.0/torrents/info/${torrentId}`, {
          headers: { Authorization: `Bearer ${this.apiKey}` }
        });
        if (!infoRes.ok) return null;
        const infoData = await infoRes.json();

        // Select all files
        await fetch(`https://api.real-debrid.com/rest/1.0/torrents/selectFiles/${torrentId}`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: 'files=all'
        });

        // Check if links generated
        if (infoData.links && infoData.links.length > 0) {
          const unrestrictRes = await fetch('https://api.real-debrid.com/rest/1.0/unrestrict/link', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${this.apiKey}`,
              'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: `link=${encodeURIComponent(infoData.links[0])}`
          });
          if (unrestrictRes.ok) {
            const unrestrictData = await unrestrictRes.json();
            return {
              id: createStreamId('realdebrid', '1080p', 0),
              provider: 'Real-Debrid (Cached)',
              url: unrestrictData.download,
              quality: '1080p',
              type: unrestrictData.download.includes('.m3u8') ? 'hls' : 'mp4',
              title: `[RD] ${unrestrictData.filename || 'Direct High Speed'}`,
              direct: true,
              isDebrid: true,
              healthScore: 99
            };
          }
        }
      }
    } catch (e) {
      console.warn(`[RealDebrid] Unrestrict error:`, e);
    }
    return null;
  }

  // TorBox unrestrict flow
  async unrestrictTorBox(magnet: string): Promise<StreamSource | null> {
    try {
      const res = await fetch('https://api.torbox.app/v1/api/torrents/createtorrent', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ magnet })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.data?.torrent_id) {
          const dlRes = await fetch(`https://api.torbox.app/v1/api/torrents/requestdl?token=${this.apiKey}&torrent_id=${data.data.torrent_id}`);
          if (dlRes.ok) {
            const dlData = await dlRes.json();
            return {
              id: createStreamId('torbox', '1080p', 0),
              provider: 'TorBox (Debrid)',
              url: dlData.data,
              quality: '1080p',
              type: 'mp4',
              title: `[TorBox] Direct Cached Stream`,
              direct: true,
              isDebrid: true,
              healthScore: 98
            };
          }
        }
      }
    } catch (e) {
      console.warn(`[TorBox] Error:`, e);
    }
    return null;
  }

  // AllDebrid unrestrict flow
  async unrestrictAllDebrid(linkOrMagnet: string): Promise<StreamSource | null> {
    try {
      const res = await fetch(`https://api.alldebrid.com/v4/link/unlock?agent=playtorrio&apikey=${this.apiKey}&link=${encodeURIComponent(linkOrMagnet)}`);
      if (res.ok) {
        const json = await res.json();
        if (json.data?.link) {
          return {
            id: createStreamId('alldebrid', '1080p', 0),
            provider: 'AllDebrid',
            url: json.data.link,
            quality: '1080p',
            type: 'mp4',
            title: `[AllDebrid] ${json.data.filename || 'Direct Stream'}`,
            direct: true,
            isDebrid: true,
            healthScore: 98
          };
        }
      }
    } catch (e) {
      console.warn(`[AllDebrid] Error:`, e);
    }
    return null;
  }

  async unrestrict(magnetOrLink: string): Promise<StreamSource | null> {
    if (!this.isConfigured()) return null;
    switch (this.service) {
      case 'realdebrid':
        return this.unrestrictRealDebrid(magnetOrLink);
      case 'torbox':
        return this.unrestrictTorBox(magnetOrLink);
      case 'alldebrid':
        return this.unrestrictAllDebrid(magnetOrLink);
      default:
        return null;
    }
  }
}
