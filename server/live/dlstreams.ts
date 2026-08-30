import { LiveEvent, LiveChannel } from '../../src/types/media.js';
import { normalizeCategory, isBettingContent } from './aggregator.js';

// Curated high-demand 24/7 sports channels on DLStreams with direct stream embeds
export const DLSTREAMS_CHANNELS: { id: string; name: string; streamId: string | number; category: string; league?: string; poster?: string }[] = [
  {
    id: 'dl_tnt_sports_2',
    name: 'TNT Sports 2 HD',
    streamId: 51,
    category: 'Sports',
    league: 'TNT Sports UK',
    poster: 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?auto=format&fit=crop&w=600&q=80'
  },
  {
    id: 'dl_tnt_sports_1',
    name: 'TNT Sports 1 HD',
    streamId: 31,
    category: 'Sports',
    league: 'TNT Sports UK',
    poster: 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?auto=format&fit=crop&w=600&q=80'
  },
  {
    id: 'dl_tnt_sports_3',
    name: 'TNT Sports 3 HD',
    streamId: 52,
    category: 'Sports',
    league: 'TNT Sports UK',
    poster: 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?auto=format&fit=crop&w=600&q=80'
  },
  {
    id: 'dl_tnt_sports_4',
    name: 'TNT Sports 4 HD',
    streamId: 54,
    category: 'Sports',
    league: 'TNT Sports UK',
    poster: 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?auto=format&fit=crop&w=600&q=80'
  },
  {
    id: 'dl_sky_sports_pl',
    name: 'Sky Sports Premier League HD',
    streamId: 130,
    category: 'Football/Soccer',
    league: 'Premier League',
    poster: 'https://images.unsplash.com/photo-1522778119026-d647f0596c20?auto=format&fit=crop&w=600&q=80'
  },
  {
    id: 'dl_sky_sports_football',
    name: 'Sky Sports Football HD',
    streamId: 35,
    category: 'Football/Soccer',
    league: 'European Football',
    poster: 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?auto=format&fit=crop&w=600&q=80'
  },
  {
    id: 'dl_sky_sports_f1',
    name: 'Sky Sports F1 HD',
    streamId: 60,
    category: 'Motorsports',
    league: 'Formula 1',
    poster: 'https://i.imgur.com/UzHEmEe.jpeg'
  },
  {
    id: 'dl_sky_sports_golf',
    name: 'Sky Sports Golf HD',
    streamId: 70,
    category: 'Sports',
    league: 'PGA Tour',
    poster: 'https://images.unsplash.com/photo-1535131749006-b7f58c99034b?auto=format&fit=crop&w=600&q=80'
  },
  {
    id: 'dl_sky_sports_tennis',
    name: 'Sky Sports Tennis ATP/WTA',
    streamId: 46,
    category: 'Sports',
    league: 'ATP & WTA Tennis',
    poster: 'https://i.ibb.co/8gSmXFg8/tennischannel.png'
  },
  {
    id: 'dl_tennis_channel',
    name: 'Tennis Channel HD',
    streamId: 40,
    category: 'Sports',
    league: 'Tennis Live',
    poster: 'https://i.ibb.co/L23JGVn/tennis.png'
  },
  {
    id: 'dl_ufc_ppv',
    name: 'UFC PPV & Fight Night Live',
    streamId: 32,
    category: 'Sports',
    league: 'UFC Fighting',
    poster: 'https://i.ibb.co/Y7n1tW57/ufc1.png'
  },
  {
    id: 'dl_espn_usa',
    name: 'ESPN USA HD',
    streamId: 44,
    category: 'Sports',
    league: 'ESPN Network',
    poster: 'https://images.unsplash.com/photo-1461896836934-ffe607ba8211?auto=format&fit=crop&w=600&q=80'
  },
  {
    id: 'dl_espn2_usa',
    name: 'ESPN2 USA HD',
    streamId: 45,
    category: 'Sports',
    league: 'ESPN Network',
    poster: 'https://images.unsplash.com/photo-1461896836934-ffe607ba8211?auto=format&fit=crop&w=600&q=80'
  },
  {
    id: 'dl_fox_sports_1',
    name: 'FOX Sports 1 (FS1) HD',
    streamId: 50,
    category: 'Sports',
    league: 'FOX Sports',
    poster: 'https://images.unsplash.com/photo-1566577739112-5180d4bf9390?auto=format&fit=crop&w=600&q=80'
  },
  {
    id: 'dl_nbc_usa',
    name: 'NBC Sports / NBC USA',
    streamId: 53,
    category: 'Sports',
    league: 'NBC Network',
    poster: 'https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?auto=format&fit=crop&w=600&q=80'
  },
  {
    id: 'dl_nfl_network',
    name: 'NFL Network 24/7 HD',
    streamId: 405,
    category: 'Sports',
    league: 'NFL Football',
    poster: 'https://i.ibb.co/gr9xfZs/nflnetwork.jpg'
  },
  {
    id: 'dl_eurosport_1',
    name: 'Eurosport 1 HD',
    streamId: 41,
    category: 'Sports',
    league: 'Eurosport Network',
    poster: 'https://images.unsplash.com/photo-1517649763962-0c623266ddc0?auto=format&fit=crop&w=600&q=80'
  },
  {
    id: 'dl_bb_live_1',
    name: 'Big Brother Live Feeds Cam 1',
    streamId: 891,
    category: 'Entertainment',
    league: 'Big Brother 24/7',
    poster: 'https://i.ibb.co/7J8PSkvV/bigbb.png'
  },
  {
    id: 'dl_bb_live_2',
    name: 'Big Brother Live Feeds Cam 2',
    streamId: 892,
    category: 'Entertainment',
    league: 'Big Brother 24/7',
    poster: 'https://i.ibb.co/39yNhmfc/bbcam.png'
  }
];

export async function fetchDlStreams(): Promise<LiveEvent[]> {
  const events: LiveEvent[] = [];

  // 1. Add static curated 24/7 high-speed channels from DLStreams
  for (const ch of DLSTREAMS_CHANNELS) {
    events.push({
      id: `dl_${ch.streamId}`,
      title: ch.name,
      category: normalizeCategory(ch.category, ch.name, ch.league, 'DLStreams'),
      isLive: true,
      league: ch.league,
      poster: ch.poster,
      channels: [
        {
          name: `${ch.name} (Direct DLStream)`,
          url: `https://dlstreams.st/stream/stream-${ch.streamId}.php`,
          provider: 'DLStreams',
          quality: '1080p',
          type: 'embed'
        }
      ],
      provider: 'DLStreams'
    });
  }

  // 2. Scrape live upcoming events and schedules from DLStreams homepage
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4500);

    const res = await fetch('https://dlstreams.st/', {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      }
    }).catch(() => null);

    clearTimeout(timer);

    if (res && res.ok) {
      const html = await res.text().catch(() => '');
      if (html) {
        // Parse upcoming cards: <a class="upcoming-card" href="/stream/stream-46.php" ...><img ... src="..." alt="...">...<div class="upcoming-card__title">Title</div>
        const cardRegex = /<a[^>]*class="[^"]*upcoming-card[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
        let cardMatch;
        while ((cardMatch = cardRegex.exec(html)) !== null) {
          const href = cardMatch[1];
          const innerHtml = cardMatch[2];

          // Extract title
          const titleMatch = innerHtml.match(/class="upcoming-card__title">([^<]+)<\/div>/i) ||
                             innerHtml.match(/alt="([^"]+)"/i);
          const rawTitle = titleMatch ? titleMatch[1].trim() : '';

          // Extract poster
          const imgMatch = innerHtml.match(/src="([^"]+)"/i);
          const poster = imgMatch ? imgMatch[1] : undefined;

          // Extract stream id
          const streamMatch = href.match(/stream-(\d+)\.php/i) || href.match(/id=(\d+)/i);
          const streamId = streamMatch ? streamMatch[1] : null;

          if (rawTitle && streamId && !isBettingContent(rawTitle, '')) {
            const cleanTitle = rawTitle.replace(/^Watch\s+/i, '').replace(/\|\s*.*Streams$/i, '').trim();
            const category = normalizeCategory('Sports', cleanTitle, '', 'DLStreams');

            const streamUrl = `https://dlstreams.st/stream/stream-${streamId}.php`;

            events.push({
              id: `dl_upcoming_${streamId}`,
              title: cleanTitle,
              category,
              isLive: true,
              poster,
              channels: [
                {
                  name: `${cleanTitle} [Direct Stream]`,
                  url: streamUrl,
                  provider: 'DLStreams',
                  quality: '1080p',
                  type: 'embed'
                }
              ],
              provider: 'DLStreams'
            });
          }
        }

        // Parse schedule events: <div class="schedule__event">...<span class="schedule__time">18:30</span><span class="schedule__eventTitle">...</span>...<div class="schedule__channels"><a ... href="/watch.php?id=891" ...>
        const eventRegex = /<div[^>]*class="[^"]*schedule__event[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/gi;
        let evMatch;
        while ((evMatch = eventRegex.exec(html)) !== null) {
          const evHtml = evMatch[1];

          const timeMatch = evHtml.match(/class="schedule__time"[^>]*>([^<]+)<\/span>/i);
          const titleMatch = evHtml.match(/class="schedule__eventTitle"[^>]*>([^<]+)<\/span>/i);

          const time = timeMatch ? timeMatch[1].trim() : undefined;
          const title = titleMatch ? titleMatch[1].replace(/^[📺⚽🏀🥊🏎️\s]+/, '').trim() : '';

          if (title && !isBettingContent(title, '')) {
            const channelLinks: LiveChannel[] = [];
            const linkRegex = /href="([^"]+)"[^>]*title="([^"]*)"[^>]*>([^<]*)</gi;
            let lMatch;
            while ((lMatch = linkRegex.exec(evHtml)) !== null) {
              const linkHref = lMatch[1];
              const linkTitle = (lMatch[2] || lMatch[3] || 'Stream').trim();
              const idMatch = linkHref.match(/id=(\d+)/i) || linkHref.match(/stream-(\d+)\.php/i);
              if (idMatch) {
                const sId = idMatch[1];
                channelLinks.push({
                  name: `${linkTitle} [DLStream Feed]`,
                  url: `https://dlstreams.st/stream/stream-${sId}.php`,
                  provider: 'DLStreams',
                  quality: '1080p',
                  type: 'embed'
                });
              }
            }

            if (channelLinks.length > 0) {
              const category = normalizeCategory('Sports', title, '', 'DLStreams');
              events.push({
                id: `dl_sched_${Math.random().toString(36).substring(2, 9)}`,
                title,
                category,
                startTime: time,
                isLive: true,
                channels: channelLinks,
                provider: 'DLStreams'
              });
            }
          }
        }
      }
    }
  } catch {
    // Graceful fallback
  }

  return events;
}
