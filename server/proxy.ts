import { Request, Response } from 'express';

export async function handleMediaProxy(req: Request, res: Response) {
  const targetUrl = req.query.url as string;
  if (!targetUrl) {
    res.status(400).send('Missing target url');
    return;
  }

  const customReferer = (req.query.referer as string) || (req.query.origin as string) || '';
  const rangeHeader = req.headers.range;

  try {
    const headers: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      Accept: '*/*'
    };

    if (customReferer) {
      headers.Referer = customReferer;
      headers.Origin = customReferer;
    }
    if (rangeHeader) {
      headers.Range = rangeHeader;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);

    const upstreamRes = await fetch(targetUrl, {
      method: req.method,
      headers,
      signal: controller.signal
    }).catch(() => null);

    clearTimeout(timer);

    if (!upstreamRes) {
      res.status(502).send('Upstream connection failed');
      return;
    }

    const contentType = upstreamRes.headers.get('content-type') || '';
    const contentLength = upstreamRes.headers.get('content-length');
    const contentRange = upstreamRes.headers.get('content-range');
    const acceptRanges = upstreamRes.headers.get('accept-ranges');

    res.status(upstreamRes.status);
    if (contentType) res.setHeader('Content-Type', contentType);
    if (contentLength && !contentType.includes('application/vnd.apple.mpegurl') && !contentType.includes('application/x-mpegurl')) {
      res.setHeader('Content-Length', contentLength);
    }
    if (contentRange) res.setHeader('Content-Range', contentRange);
    if (acceptRanges) res.setHeader('Accept-Ranges', acceptRanges);

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', '*');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Accept-Ranges');

    // If it's an M3U8 manifest, rewrite relative URLs so chunks pass through proxy correctly
    const isM3u8 = targetUrl.toLowerCase().includes('.m3u8') ||
                   contentType.includes('application/vnd.apple.mpegurl') ||
                   contentType.includes('application/x-mpegurl') ||
                   contentType.includes('text/plain');

    if (isM3u8) {
      const text = await upstreamRes.text();
      if (text.includes('#EXTM3U')) {
        const baseUrl = targetUrl.substring(0, targetUrl.lastIndexOf('/') + 1);
        const lines = text.split('\n');
        const rewritten = lines.map(line => {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith('#')) {
            // Check for URI in tags like #EXT-X-KEY or #EXT-X-MAP
            if (trimmed.includes('URI="')) {
              return trimmed.replace(/URI="([^"]+)"/g, (match, uri) => {
                const absoluteUri = uri.startsWith('http') ? uri : new URL(uri, baseUrl).toString();
                return `URI="/api/proxy/media?url=${encodeURIComponent(absoluteUri)}"`;
              });
            }
            return line;
          }
          // It's a segment or sub-playlist URL
          const absolute = trimmed.startsWith('http') ? trimmed : new URL(trimmed, baseUrl).toString();
          return `/api/proxy/media?url=${encodeURIComponent(absolute)}`;
        }).join('\n');

        res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
        res.send(rewritten);
        return;
      }
    }

    if (!upstreamRes.body) {
      res.end();
      return;
    }

    const reader = upstreamRes.body.getReader();
    req.on('close', () => {
      reader.cancel().catch(() => {});
    });

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(Buffer.from(value));
    }
    res.end();
  } catch (err: any) {
    if (!res.headersSent) {
      res.status(502).send(`Proxy streaming error: ${err?.message || 'Unknown'}`);
    }
  }
}

