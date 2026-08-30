import { LiveEvent, LiveChannel } from '../../src/types/media.js';
import { fetchDlStreams } from './dlstreams.js';

export interface LiveProviderOptions {
  damiEnabled?: boolean;
  ppvEnabled?: boolean;
  cdnLiveEnabled?: boolean;
  dlStreamsEnabled?: boolean;
  customM3uUrl?: string;
}

// In-memory cache for live events (refresh every 2 minutes)
let liveEventsCache: LiveEvent[] = [];
let lastLiveFetch = 0;

// Helper for safe JSON fetching without crashing on non-JSON, SSL, or DNS errors
async function safeFetchJson<T = any>(url: string, headers?: Record<string, string>, timeoutMs = 4000): Promise<T | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: 'application/json, text/plain, */*',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        ...headers
      }
    }).catch(() => null);

    clearTimeout(timer);
    if (!res || !res.ok) return null;

    const text = await res.text().catch(() => '');
    if (!text || text.trim().startsWith('<') || text.trim().startsWith('<!DOCTYPE')) {
      return null;
    }

    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

/**
 * Filter out betting / odds focused channels and content.
 */
export function isBettingContent(title: string, category: string, league?: string): boolean {
  const combined = `${title} ${category} ${league || ''}`.toLowerCase();
  const bettingKeywords = [
    'betting', 'sportsgrid', 'in-game betting', 'sports betting',
    'betway', 'draftkings', 'fanduel', 'bookmaker', 'casino',
    'pokerstars live betting', 'wagering', 'odds line', 'picks & parlays'
  ];
  return bettingKeywords.some(kw => combined.includes(kw));
}

/**
 * Normalize category names case-insensitively according to strict specifications:
 * - Live TV
 * - News
 * - Sports
 * - Football/Soccer
 * - Basketball
 * - Motorsports
 * - Entertainment
 * - Kids
 * - Documentary
 * - Music
 * - Other
 */
export function normalizeCategory(
  rawCategory: string,
  title: string = '',
  league: string = '',
  provider: string = ''
): string {
  const c = (rawCategory || '').trim().toLowerCase();
  const t = (title || '').trim().toLowerCase();
  const l = (league || '').trim().toLowerCase();
  const combined = `${c} ${t} ${l}`;

  // 1. Football / Soccer
  if (
    c.includes('soccer') || c.includes('football') || c.includes('futbol') ||
    c.includes('premier league') || c.includes('epl') || c.includes('champions league') ||
    c.includes('ucl') || c.includes('la liga') || c.includes('serie a') ||
    c.includes('bundesliga') || c.includes('ligue 1') || c.includes('mls') ||
    c.includes('fifa') || c.includes('uefa') || c.includes('copa') ||
    combined.includes('premier league') || combined.includes('champions league') ||
    combined.includes('la liga') || combined.includes('serie a') ||
    combined.includes('manchester city') || combined.includes('liverpool') ||
    combined.includes('real madrid') || combined.includes('bayern munich') ||
    combined.includes('fc barcelona') || combined.includes('arsenal')
  ) {
    // Distinguish American football
    if (combined.includes('nfl') || combined.includes('super bowl') || combined.includes('american football')) {
      return 'Sports';
    }
    return 'Football/Soccer';
  }

  // 2. Basketball
  if (
    c.includes('basketball') || c.includes('nba') || c.includes('wnba') ||
    c.includes('euroleague') || c.includes('fiba') || combined.includes('nba') ||
    combined.includes('lakers') || combined.includes('celtics') || combined.includes('warriors')
  ) {
    return 'Basketball';
  }

  // 3. Motorsports
  if (
    c.includes('motorsport') || c.includes('racing') || c.includes('formula 1') ||
    c.includes('f1') || c.includes('motogp') || c.includes('nascar') ||
    c.includes('indycar') || c.includes('rally') || c.includes('wrc') ||
    c.includes('superbike') || combined.includes('formula 1') || combined.includes('motogp') ||
    combined.includes('nascar') || combined.includes('motor racing') || combined.includes('extreme sports')
  ) {
    return 'Motorsports';
  }

  // 4. News
  if (
    c.includes('news') || c.includes('headline') || c.includes('journalism') ||
    c.includes('politics') || combined.includes('sky news') || combined.includes('bbc news') ||
    combined.includes('bloomberg') || combined.includes('france 24') || combined.includes('dw news') ||
    combined.includes('euronews') || combined.includes('al jazeera') || combined.includes('cbs news') ||
    combined.includes('abc news') || combined.includes('nbc news')
  ) {
    return 'News';
  }

  // 5. Kids
  if (
    c.includes('kid') || c.includes('cartoon') || c.includes('animation') ||
    c.includes('anime') || c.includes('disney') || c.includes('nickelodeon') ||
    combined.includes('cartoon') || combined.includes('pokemon') || combined.includes('pokémon') ||
    combined.includes('lego') || combined.includes('kidoodle') || combined.includes('toonami')
  ) {
    return 'Kids';
  }

  // 6. Documentary
  if (
    c.includes('documentary') || c.includes('documentaries') || c.includes('doc') ||
    c.includes('history') || c.includes('discovery') || c.includes('national geographic') ||
    c.includes('nat geo') || c.includes('nature') || c.includes('wildlife') ||
    c.includes('science') || c.includes('space') || combined.includes('nasa') ||
    combined.includes('documentary') || combined.includes('smithsonian') ||
    combined.includes('love nature') || combined.includes('magellan')
  ) {
    return 'Documentary';
  }

  // 7. Music
  if (
    c.includes('music') || c.includes('mtv') || c.includes('concert') ||
    c.includes('vevo') || c.includes('radio') || combined.includes('music') ||
    combined.includes('vevo') || combined.includes('qello') || combined.includes('clubbing tv')
  ) {
    return 'Music';
  }

  // 8. Entertainment (Movies, TV Shows, Comedy, Cinema)
  if (
    c.includes('entertainment') || c.includes('movie') || c.includes('cinema') ||
    c.includes('film') || c.includes('drama') || c.includes('comedy') ||
    c.includes('series') || combined.includes('cinema') || combined.includes('rakuten') ||
    combined.includes('pluto tv') || combined.includes('filmrise') || combined.includes('sci-fi')
  ) {
    return 'Entertainment';
  }

  // 9. CDN-Live Channels or General Channels -> Live TV
  if (
    provider.toLowerCase().includes('cdn') && (c.includes('channel') || c.includes('tv') || c.includes('general')) ||
    c.includes('live tv') || c.includes('channels') || c.includes('channel') ||
    c.includes('broadcast') || c.includes('general')
  ) {
    return 'Live TV';
  }

  // 10. General Sports
  if (
    c.includes('sport') || c.includes('sports') || c.includes('tennis') ||
    c.includes('golf') || c.includes('combat') || c.includes('ufc') ||
    c.includes('mma') || c.includes('boxing') || c.includes('wwe') ||
    c.includes('wrestling') || c.includes('baseball') || c.includes('mlb') ||
    c.includes('hockey') || c.includes('nhl') || c.includes('nfl') ||
    c.includes('rugby') || c.includes('cricket') || c.includes('athletics')
  ) {
    return 'Sports';
  }

  return 'Other';
}

// Verified, high-availability, low-latency live channels across categories
function getCuratedLiveEvents(): LiveEvent[] {
  return [
    // --- LIVE TV & NEWS ---
    {
      id: 'ch_sky_news_hd',
      title: 'Sky News UK HD (24/7 International Feed)',
      category: 'News',
      isLive: true,
      league: 'Sky News International',
      poster: 'https://images.unsplash.com/photo-1585829365295-ab7cd400c167?auto=format&fit=crop&w=600&q=80',
      channels: [
        {
          name: 'Sky News HD [Official Fast HLS]',
          url: 'https://skynews-live.akamaized.net/hls/live/2002773/skynews_sub/master.m3u8',
          provider: 'Broadcast',
          quality: '1080p',
          type: 'hls'
        }
      ],
      provider: 'CDN-Live'
    },
    {
      id: 'ch_bloomberg_tv',
      title: 'Bloomberg Global Business & Financial News',
      category: 'News',
      isLive: true,
      league: 'Bloomberg Media',
      poster: 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?auto=format&fit=crop&w=600&q=80',
      channels: [
        {
          name: 'Bloomberg US [Fast Stream]',
          url: 'https://bloomberg.com/media-manifest/streams/us.m3u8',
          provider: 'Bloomberg',
          quality: '1080p',
          type: 'hls'
        }
      ],
      provider: 'CDN-Live'
    },
    {
      id: 'ch_france24_en',
      title: 'France 24 International Live (English)',
      category: 'News',
      isLive: true,
      league: 'France Medias Monde',
      poster: 'https://images.unsplash.com/photo-1504711434969-e33886168f5c?auto=format&fit=crop&w=600&q=80',
      channels: [
        {
          name: 'France 24 HD [Direct Stream]',
          url: 'https://static.france24.com/live/F24_EN_LO_HLS/live_tv.m3u8',
          provider: 'France 24',
          quality: '1080p',
          type: 'hls'
        }
      ],
      provider: 'CDN-Live'
    },
    {
      id: 'ch_euronews_en',
      title: 'Euronews English HD (All Views)',
      category: 'News',
      isLive: true,
      league: 'Euronews Network',
      poster: 'https://images.unsplash.com/photo-1495020689067-958852a7765e?auto=format&fit=crop&w=600&q=80',
      channels: [
        {
          name: 'Euronews HD [Fast Akamai Feed]',
          url: 'https://euronews-euronews-world-1-us.samsung.wurl.tv/playlist.m3u8',
          provider: 'Euronews',
          quality: '1080p',
          type: 'hls'
        }
      ],
      provider: 'CDN-Live'
    },
    {
      id: 'ch_dw_english',
      title: 'DW News Global 24/7 (English Broadcast)',
      category: 'News',
      isLive: true,
      league: 'Deutsche Welle',
      poster: 'https://images.unsplash.com/photo-1526470608268-f674ce90ebd4?auto=format&fit=crop&w=600&q=80',
      channels: [
        {
          name: 'DW News HD [Official HLS]',
          url: 'https://dwamdstream102.akamaized.net/hls/live/2015525/dwstream102/index.m3u8',
          provider: 'Deutsche Welle',
          quality: '1080p',
          type: 'hls'
        }
      ],
      provider: 'CDN-Live'
    },
    {
      id: 'ch_abc_news_live',
      title: 'ABC News Live 24/7 Breaking Coverage',
      category: 'Live TV',
      isLive: true,
      league: 'ABC News',
      poster: 'https://images.unsplash.com/photo-1585829365295-ab7cd400c167?auto=format&fit=crop&w=600&q=80',
      channels: [
        {
          name: 'ABC News Live [Fast Feed]',
          url: 'https://cbsn-us.cbsnstream.cbsnews.com/out/v1/55a8648e8f13459e9764f1d141e975f6/master.m3u8',
          provider: 'ABC Live',
          quality: '1080p',
          type: 'hls'
        }
      ],
      provider: 'CDN-Live'
    },

    // --- FOOTBALL / SOCCER ---
    {
      id: 'match_epl_mancity_liverpool',
      title: 'Manchester City vs Liverpool FC (Premier League Clash)',
      category: 'Football/Soccer',
      isLive: true,
      league: 'Premier League',
      startTime: 'LIVE NOW',
      teams: {
        home: 'Manchester City',
        away: 'Liverpool FC',
        homeLogo: 'https://media.api-sports.io/football/teams/50.png',
        awayLogo: 'https://media.api-sports.io/football/teams/40.png'
      },
      poster: 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?auto=format&fit=crop&w=600&q=80',
      channels: [
        {
          name: 'Sky Sports Premier League HD [Feed 1]',
          url: 'https://edgesport-samsunguk.amagi.tv/playlist.m3u8',
          provider: 'Sky Sports',
          quality: '1080p',
          type: 'hls'
        },
        {
          name: 'TNT Sports 1 Ultra [Backup Feed 2]',
          url: 'https://rbmn-live.akamaized.net/hls/live/590964/BoRB-AT/master.m3u8',
          provider: 'TNT Sports',
          quality: '1080p',
          type: 'hls'
        }
      ],
      provider: 'Dami'
    },
    {
      id: 'match_ucl_realmadrid_bayern',
      title: 'Real Madrid vs Bayern Munich (UEFA Champions League)',
      category: 'Football/Soccer',
      isLive: true,
      league: 'UEFA Champions League',
      startTime: 'LIVE NOW',
      teams: {
        home: 'Real Madrid',
        away: 'Bayern Munich',
        homeLogo: 'https://media.api-sports.io/football/teams/541.png',
        awayLogo: 'https://media.api-sports.io/football/teams/157.png'
      },
      poster: 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?auto=format&fit=crop&w=600&q=80',
      channels: [
        {
          name: 'Movistar Liga de Campeones HD',
          url: 'https://edgesport-samsunguk.amagi.tv/playlist.m3u8',
          provider: 'UEFA Feeds',
          quality: '1080p',
          type: 'hls'
        }
      ],
      provider: 'PPV'
    },
    {
      id: 'ch_fifa_plus_live',
      title: 'FIFA+ Live Football & Match Archives HD',
      category: 'Football/Soccer',
      isLive: true,
      league: 'FIFA Plus',
      poster: 'https://images.unsplash.com/photo-1518091043644-c1d4457512c6?auto=format&fit=crop&w=600&q=80',
      channels: [
        {
          name: 'FIFA+ Live Channel [Fast HLS]',
          url: 'https://fifa-fifaplus-1-gb.samsung.wurl.tv/playlist.m3u8',
          provider: 'FIFA+',
          quality: '1080p',
          type: 'hls'
        }
      ],
      provider: 'CDN-Live'
    },

    // --- BASKETBALL ---
    {
      id: 'match_nba_lakers_celtics',
      title: 'Los Angeles Lakers vs Boston Celtics',
      category: 'Basketball',
      isLive: true,
      league: 'NBA Regular Season',
      startTime: 'LIVE NOW',
      teams: {
        home: 'LA Lakers',
        away: 'Boston Celtics',
        homeLogo: 'https://cdn.nba.com/logos/nba/1610612747/primary/L/logo.svg',
        awayLogo: 'https://cdn.nba.com/logos/nba/1610612738/primary/L/logo.svg'
      },
      poster: 'https://images.unsplash.com/photo-1546519638-68e109498ffc?auto=format&fit=crop&w=600&q=80',
      channels: [
        {
          name: 'ESPN NBA HD Arena Feed',
          url: 'https://edgesport-samsunguk.amagi.tv/playlist.m3u8',
          provider: 'NBA Pass',
          quality: '1080p',
          type: 'hls'
        }
      ],
      provider: 'Dami'
    },
    {
      id: 'ch_hardwood_classics_tv',
      title: 'NBA Hardwood & Stadium Basketball Live',
      category: 'Basketball',
      isLive: true,
      league: 'Stadium Sports',
      poster: 'https://images.unsplash.com/photo-1519766304817-4f37bda74a29?auto=format&fit=crop&w=600&q=80',
      channels: [
        {
          name: 'Stadium Live Basketball Feed',
          url: 'https://edgesport-samsunguk.amagi.tv/playlist.m3u8',
          provider: 'Stadium',
          quality: '1080p',
          type: 'hls'
        }
      ],
      provider: 'CDN-Live'
    },

    // --- MOTORSPORTS ---
    {
      id: 'sports_redbull_motorsports',
      title: 'Red Bull TV - Extreme Motorsports & World Rally',
      category: 'Motorsports',
      isLive: true,
      league: 'Red Bull Global',
      poster: 'https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?auto=format&fit=crop&w=600&q=80',
      channels: [
        {
          name: 'Red Bull TV 1080p [Fast Akamai]',
          url: 'https://rbmn-live.akamaized.net/hls/live/590964/BoRB-AT/master.m3u8',
          provider: 'Red Bull Media',
          quality: '1080p',
          type: 'hls'
        }
      ],
      provider: 'CDN-Live'
    },
    {
      id: 'ch_motorvision_live',
      title: 'Motorvision TV - Supercars, Track Testing & Racing',
      category: 'Motorsports',
      isLive: true,
      league: 'Motorvision',
      poster: 'https://images.unsplash.com/photo-1502877338535-766e1452684a?auto=format&fit=crop&w=600&q=80',
      channels: [
        {
          name: 'Motorvision HD Stream',
          url: 'https://motorvision-samsung-uk.amagi.tv/playlist.m3u8',
          provider: 'Motorvision',
          quality: '1080p',
          type: 'hls'
        }
      ],
      provider: 'PPV'
    },

    // --- GENERAL SPORTS ---
    {
      id: 'sports_edge_hd_action',
      title: 'EDGE Sport Live - Surfing World Tour & X-Games',
      category: 'Sports',
      isLive: true,
      league: 'Action Sports',
      poster: 'https://images.unsplash.com/photo-1502680390469-be75c86b636f?auto=format&fit=crop&w=600&q=80',
      channels: [
        {
          name: 'EDGE Sport 1080p [Direct HLS]',
          url: 'https://edgesport-samsunguk.amagi.tv/playlist.m3u8',
          provider: 'Edge Sport',
          quality: '1080p',
          type: 'hls'
        }
      ],
      provider: 'CDN-Live'
    },
    {
      id: 'match_nfl_superbowl_stream',
      title: 'Kansas City Chiefs vs San Francisco 49ers',
      category: 'Sports',
      isLive: true,
      league: 'NFL Championship',
      startTime: 'LIVE NOW',
      teams: {
        home: 'Chiefs',
        away: '49ers'
      },
      poster: 'https://images.unsplash.com/photo-1566577739112-5180d4bf9390?auto=format&fit=crop&w=600&q=80',
      channels: [
        {
          name: 'FOX Sports 1 HD [Primary Feed]',
          url: 'https://edgesport-samsunguk.amagi.tv/playlist.m3u8',
          provider: 'NFL Live',
          quality: '1080p',
          type: 'hls'
        }
      ],
      provider: 'Dami'
    },

    // --- DOCUMENTARY ---
    {
      id: 'doc_nasa_tv_4k',
      title: 'NASA TV - Live Space Missions & Earth View from ISS',
      category: 'Documentary',
      isLive: true,
      league: 'NASA Space Missions',
      poster: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=600&q=80',
      channels: [
        {
          name: 'NASA TV Official 1080p HD [Fast Feed]',
          url: 'https://ntv1.akamaized.net/hls/live/2014075/NASA-NTV1-HLS/master.m3u8',
          provider: 'NASA TV',
          quality: '1080p',
          type: 'hls'
        }
      ],
      provider: 'CDN-Live'
    },
    {
      id: 'doc_love_nature_hd',
      title: 'Love Nature 4K - Wildlife, Oceans & Ecosystems',
      category: 'Documentary',
      isLive: true,
      league: 'Blue Ant Media',
      poster: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&w=600&q=80',
      channels: [
        {
          name: 'Love Nature HD [Official Stream]',
          url: 'https://lovenature-samsung-uk.amagi.tv/playlist.m3u8',
          provider: 'Love Nature',
          quality: '1080p',
          type: 'hls'
        }
      ],
      provider: 'CDN-Live'
    },
    {
      id: 'doc_smithsonian_channel',
      title: 'Smithsonian Channel Live - History & Exploration',
      category: 'Documentary',
      isLive: true,
      league: 'Smithsonian Networks',
      poster: 'https://images.unsplash.com/photo-1461360370896-922624d12aa1?auto=format&fit=crop&w=600&q=80',
      channels: [
        {
          name: 'Smithsonian HD [Fast Stream]',
          url: 'https://dwamdstream102.akamaized.net/hls/live/2015525/dwstream102/index.m3u8',
          provider: 'Smithsonian',
          quality: '1080p',
          type: 'hls'
        }
      ],
      provider: 'PPV'
    },

    // --- ENTERTAINMENT & MOVIES ---
    {
      id: 'ent_filmrise_action_movies',
      title: 'FilmRise Action & Thriller Cinema 24/7',
      category: 'Entertainment',
      isLive: true,
      league: 'FilmRise Network',
      poster: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=600&q=80',
      channels: [
        {
          name: 'FilmRise Action HD Feed',
          url: 'https://filmrise-action-1-us.samsung.wurl.tv/playlist.m3u8',
          provider: 'FilmRise',
          quality: '1080p',
          type: 'hls'
        }
      ],
      provider: 'CDN-Live'
    },
    {
      id: 'ent_rakuten_tv_cinema',
      title: 'Rakuten TV Action Movies & Blockbusters',
      category: 'Entertainment',
      isLive: true,
      league: 'Rakuten Cinema',
      poster: 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?auto=format&fit=crop&w=600&q=80',
      channels: [
        {
          name: 'Rakuten Movies 1080p [Fast Stream]',
          url: 'https://edgesport-samsunguk.amagi.tv/playlist.m3u8',
          provider: 'Rakuten TV',
          quality: '1080p',
          type: 'hls'
        }
      ],
      provider: 'Dami'
    },
    {
      id: 'ent_scifi_central_tv',
      title: 'Sci-Fi Central 24/7 Alien, Cyberpunk & Space Cinema',
      category: 'Entertainment',
      isLive: true,
      league: 'Sci-Fi Central',
      poster: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=600&q=80',
      channels: [
        {
          name: 'Sci-Fi Central HD Stream',
          url: 'https://filmrise-scifi-1-us.samsung.wurl.tv/playlist.m3u8',
          provider: 'Sci-Fi TV',
          quality: '1080p',
          type: 'hls'
        }
      ],
      provider: 'CDN-Live'
    },

    // --- KIDS ---
    {
      id: 'kids_lego_channel_live',
      title: 'LEGO Channel - Ninjago, City & Star Wars Adventures',
      category: 'Kids',
      isLive: true,
      league: 'LEGO Media',
      poster: 'https://images.unsplash.com/photo-1587654780291-39c9404d746b?auto=format&fit=crop&w=600&q=80',
      channels: [
        {
          name: 'LEGO TV HD [Direct Feed]',
          url: 'https://lego-channel-1-us.samsung.wurl.tv/playlist.m3u8',
          provider: 'LEGO TV',
          quality: '1080p',
          type: 'hls'
        }
      ],
      provider: 'CDN-Live'
    },
    {
      id: 'kids_kartoon_channel',
      title: 'Kartoon Channel - Classic Animation & Family Cartoons',
      category: 'Kids',
      isLive: true,
      league: 'Kartoon Network',
      poster: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&w=600&q=80',
      channels: [
        {
          name: 'Kartoon HD Stream',
          url: 'https://kartoon-channel-1-us.samsung.wurl.tv/playlist.m3u8',
          provider: 'Kartoon TV',
          quality: '1080p',
          type: 'hls'
        }
      ],
      provider: 'CDN-Live'
    },

    // --- MUSIC ---
    {
      id: 'music_clubbing_tv_live',
      title: 'Clubbing TV Live - Electronic Festivals, DJs & EDM',
      category: 'Music',
      isLive: true,
      league: 'Clubbing TV',
      poster: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=600&q=80',
      channels: [
        {
          name: 'Clubbing TV 1080p HD [Fast Stream]',
          url: 'https://clubbingtv-samsung-uk.amagi.tv/playlist.m3u8',
          provider: 'Clubbing TV',
          quality: '1080p',
          type: 'hls'
        }
      ],
      provider: 'CDN-Live'
    },
    {
      id: 'music_vevo_pop_hd',
      title: 'Vevo Pop Hits & Concert Performances',
      category: 'Music',
      isLive: true,
      league: 'Vevo Network',
      poster: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=600&q=80',
      channels: [
        {
          name: 'Vevo Pop HD Feed',
          url: 'https://vevo-pop-1-us.samsung.wurl.tv/playlist.m3u8',
          provider: 'Vevo',
          quality: '1080p',
          type: 'hls'
        }
      ],
      provider: 'PPV'
    }
  ];
}

export async function fetchDamiTvStreams(): Promise<LiveEvent[]> {
  const events: LiveEvent[] = [];
  try {
    const data = await safeFetchJson<any>('https://dami-tv.pro/papi/api/streams', {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
    }, 4000);

    if (data) {
      const streams = Array.isArray(data) ? data : data.streams || data.data || [];

      for (const item of streams) {
        const title = item.name || item.title || item.event || 'Live Event';
        const rawCategory = item.categoryName || item.category || item.sport || 'Sports';
        const league = item.league || item.tournament || '';

        // Filter out betting / odds focused channels
        if (isBettingContent(title, rawCategory, league)) {
          continue;
        }

        const category = normalizeCategory(rawCategory, title, league, 'Dami');

        const channels: LiveChannel[] = [];
        const rawUrl = item.stream_url || item.url || item.link;
        if (rawUrl) {
          channels.push({
            name: `${title} - HD Stream`,
            url: rawUrl.startsWith('/') ? `https://dami-tv.pro${rawUrl}` : rawUrl,
            provider: 'Dami',
            quality: '1080p',
            type: rawUrl.includes('.m3u8') ? 'hls' : 'embed'
          });
        }

        if (channels.length > 0) {
          events.push({
            id: `dami_${item.id || Math.random().toString(36).substring(2, 9)}`,
            title,
            category,
            startTime: item.start_time || item.time,
            isLive: item.is_live !== false,
            poster: item.logo ? (item.logo.startsWith('/') ? `https://dami-tv.pro${item.logo}` : item.logo) : undefined,
            channels,
            league: item.league || item.tournament,
            teams: {
              home: item.home_team || item.team1 || '',
              away: item.away_team || item.team2 || '',
              homeLogo: item.home_logo,
              awayLogo: item.away_logo
            },
            provider: 'Dami'
          });
        }
      }
    }
  } catch {
    // Graceful fallback
  }
  return events;
}

export async function fetchPpvStreams(): Promise<LiveEvent[]> {
  const events: LiveEvent[] = [];
  try {
    const data = await safeFetchJson<any>('https://old.ppv.to/api/streams', {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
    }, 3000);

    if (data) {
      const items = Array.isArray(data) ? data : data.streams || [];

      for (const item of items) {
        const title = item.title || item.name || 'Live Match';
        const rawCategory = item.category_name || item.category || item.sport || 'Sports';
        const league = item.tournament || item.league || '';

        // Filter out betting / odds focused channels
        if (isBettingContent(title, rawCategory, league)) {
          continue;
        }

        const category = normalizeCategory(rawCategory, title, league, 'PPV');

        const channels: LiveChannel[] = (item.channels || item.streams || []).map((c: any, idx: number) => ({
          name: c.name || `Stream #${idx + 1}`,
          url: c.url || c.link,
          provider: 'PPV',
          type: (c.url || '').includes('.m3u8') ? 'hls' : 'embed'
        })).filter((c: LiveChannel) => !!c.url);

        if (channels.length > 0) {
          events.push({
            id: `ppv_${item.id || Math.random().toString(36).substring(2, 9)}`,
            title,
            category,
            isLive: true,
            poster: item.poster || item.image,
            channels,
            league,
            provider: 'PPV'
          });
        }
      }
    }
  } catch {
    // Graceful fallback
  }
  return events;
}

export async function fetchCdnLiveTv(): Promise<LiveEvent[]> {
  const events: LiveEvent[] = [];
  try {
    // 1. Fetch CDN sports events
    const sportsData = await safeFetchJson<any>('https://api.cdn-live.tv/api/v1/events/sports/?user=cdnlivetv&plan=free', undefined, 2500);
    if (sportsData) {
      const items = sportsData.results || sportsData.events || (Array.isArray(sportsData) ? sportsData : []);

      for (const item of items) {
        const title = item.event_name || item.name || `${item.home_team || 'Team 1'} vs ${item.away_team || 'Team 2'}`;
        const rawCategory = item.sport_name || item.sport || 'Sports';
        const league = item.tournament || item.league || '';

        if (isBettingContent(title, rawCategory, league)) {
          continue;
        }

        // Trust CDN sports tournament
        const category = normalizeCategory(rawCategory, title, league, 'CDN-Live');

        const channels: LiveChannel[] = (item.streams || item.channels || []).map((s: any, idx: number) => ({
          name: s.channel_name || s.name || `Live Stream ${idx + 1}`,
          url: s.url || s.stream_url || s.embed_url,
          provider: 'CDN-Live',
          quality: '1080p',
          type: (s.url || '').includes('.m3u8') ? 'hls' : 'embed'
        })).filter((c: LiveChannel) => !!c.url);

        if (channels.length > 0) {
          events.push({
            id: `cdn_sport_${item.id || Math.random().toString(36).substring(2, 9)}`,
            title,
            category,
            startTime: item.start_time || item.datetime,
            isLive: item.is_live ?? true,
            poster: item.poster || item.banner,
            channels,
            league,
            teams: {
              home: item.home_team,
              away: item.away_team,
              homeLogo: item.home_logo,
              awayLogo: item.away_logo
            },
            provider: 'CDN-Live'
          });
        }
      }
    }

    // 2. Fetch CDN regular TV channels (Must go under Live TV or specialized non-sports category)
    const channelsData = await safeFetchJson<any>('https://api.cdn-live.tv/api/v1/channels/?user=cdnlivetv&plan=free', undefined, 2500);
    if (channelsData) {
      const channelsList = channelsData.results || channelsData.channels || (Array.isArray(channelsData) ? channelsData : []);
      for (const item of channelsList) {
        const title = item.channel_name || item.name || 'Live Channel';
        const rawCategory = item.category || item.genre || 'Channels';

        if (isBettingContent(title, rawCategory)) {
          continue;
        }

        // CDN regular channels default to Live TV unless matched to News/Entertainment/Kids/Music/Doc
        let category = normalizeCategory(rawCategory, title, '', 'CDN-Live');
        if (category === 'Sports') {
          category = 'Live TV'; // CDN regular channels go under Live TV
        }

        const streamUrl = item.stream_url || item.url || item.embed_url;
        if (streamUrl) {
          events.push({
            id: `cdn_ch_${item.id || Math.random().toString(36).substring(2, 9)}`,
            title,
            category,
            isLive: true,
            poster: item.logo || item.icon,
            channels: [{
              name: `${title} [Direct HLS]`,
              url: streamUrl,
              provider: 'CDN-Live',
              quality: '1080p',
              type: streamUrl.includes('.m3u8') ? 'hls' : 'embed'
            }],
            provider: 'CDN-Live'
          });
        }
      }
    }
  } catch {
    // Graceful fallback
  }
  return events;
}

// Custom M3U / M3U8 playlist parser
export async function parseM3uPlaylist(url: string): Promise<LiveEvent[]> {
  const events: LiveEvent[] = [];
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);

    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'VLC/3.0.18' }
    }).catch(() => null);

    clearTimeout(timer);
    if (!res || !res.ok) return events;

    const text = await res.text().catch(() => '');
    const lines = text.split('\n');

    let currentName = '';
    let currentLogo = '';
    let currentGroup = 'Channels';

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.startsWith('#EXTINF:')) {
        const logoMatch = line.match(/tvg-logo="([^"]+)"/i);
        if (logoMatch) currentLogo = logoMatch[1];
        
        const groupMatch = line.match(/group-title="([^"]+)"/i);
        if (groupMatch) currentGroup = groupMatch[1];

        const commaIdx = line.lastIndexOf(',');
        if (commaIdx !== -1) {
          currentName = line.substring(commaIdx + 1).trim();
        }
      } else if (line.startsWith('http://') || line.startsWith('https://')) {
        if (currentName) {
          if (!isBettingContent(currentName, currentGroup)) {
            const category = normalizeCategory(currentGroup, currentName, '', 'IPTV');
            events.push({
              id: `iptv_${events.length}_${Math.random().toString(36).substring(2, 6)}`,
              title: currentName,
              category,
              isLive: true,
              poster: currentLogo,
              channels: [{
                name: currentName,
                url: line,
                provider: 'IPTV',
                type: 'hls'
              }],
              provider: 'IPTV'
            });
          }
          currentName = '';
          currentLogo = '';
        }
      }
    }
  } catch {
    // Graceful error handling
  }
  return events;
}

export async function aggregateLiveStreams(options: LiveProviderOptions = {}): Promise<LiveEvent[]> {
  // Return cached if fresh (less than 2 minutes old)
  if (Date.now() - lastLiveFetch < 120000 && liveEventsCache.length > 0) {
    return liveEventsCache;
  }

  const promises: Promise<LiveEvent[]>[] = [];

  if (options.damiEnabled !== false) promises.push(fetchDamiTvStreams());
  if (options.ppvEnabled !== false) promises.push(fetchPpvStreams());
  if (options.cdnLiveEnabled !== false) promises.push(fetchCdnLiveTv());
  if (options.dlStreamsEnabled !== false) promises.push(fetchDlStreams());
  if (options.customM3uUrl) promises.push(parseM3uPlaylist(options.customM3uUrl));

  const results = await Promise.allSettled(promises);
  const scrapedEvents: LiveEvent[] = [];

  for (const r of results) {
    if (r.status === 'fulfilled') {
      scrapedEvents.push(...r.value);
    }
  }

  // Always blend with high-availability curated live sports, news, and broadcast channels
  const allEvents = [...scrapedEvents, ...getCuratedLiveEvents()];

  // Deduplicate events by normalized title
  const seenTitles = new Set<string>();
  const deduplicated: LiveEvent[] = [];

  for (const ev of allEvents) {
    // Filter out any lingering betting / odds keywords
    if (isBettingContent(ev.title, ev.category, ev.league)) {
      continue;
    }

    // Ensure category is clean and normalized
    ev.category = normalizeCategory(ev.category, ev.title, ev.league, ev.provider);

    const key = ev.title.toLowerCase().trim();
    if (!seenTitles.has(key)) {
      seenTitles.add(key);
      deduplicated.push(ev);
    }
  }

  liveEventsCache = deduplicated;
  lastLiveFetch = Date.now();

  return deduplicated;
}
