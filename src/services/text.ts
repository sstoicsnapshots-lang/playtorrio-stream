/**
 * Shared text tidy-up helpers for scraped live-event data.
 * Feed names and event titles from upstream sources carry a lot of
 * noise: "[DLStream Feed]" suffixes, mangled emoji, fake flag glyphs, etc.
 */

/** U+FFFD plus geometric-shape / enclosed-alphanumeric filler glyphs. */
const FILLER_GLYPHS = /[�■-◿⬛-⬟Ⓐ-⓿]/g;
/** A high surrogate not followed by a low surrogate (mangled emoji). */
const LONE_HIGH_SURROGATE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])/g;
/** A low surrogate not preceded by a high surrogate (mangled emoji). */
const LONE_LOW_SURROGATE = /(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g;
/** Up to three decorative country-flag emoji leading a title. */
const LEADING_FLAGS = /^(?:[\u{1F1E6}-\u{1F1FF}]️?){1,3}[\s.:|-]*/u;

/**
 * Strip mangled-emoji noise plus leftover leading/trailing punctuation.
 * "\uDDEA🇸 Spain - La Liga : Barcelona 🇪🇸" -> "Spain - La Liga : Barcelona 🇪🇸"
 */
export const cleanEventTitle = (raw: string): string => {
  if (!raw) return 'Live Event';
  return (
    raw
      .replace(LONE_HIGH_SURROGATE, '')
      .replace(LONE_LOW_SURROGATE, '')
      .replace(FILLER_GLYPHS, '')
      .replace(LEADING_FLAGS, '')
      .replace(/^[\s\-–—:|•·]+/, '')
      .replace(/[\s\-–—:|•·]+$/, '')
      .replace(/\s{2,}/g, ' ')
      .trim() || 'Live Event'
  );
};

/**
 * Turn "DAZN LaLiga [DLStream Feed]" / "Sky Sports HD [Backup Feed 2]"
 * into a clean label plus an optional quality tag.
 */
export const cleanFeedName = (raw: string, idx: number): { label: string; tag?: string } => {
  if (!raw) return { label: `Server ${idx + 1}` };

  let label = raw
    .replace(/\s*[[(][^)\]]*\bfeed\b[^)\]]*[)\]]/gi, '')
    .replace(/\s*[[(]\s*feed\s*\d*\s*[)\]]/gi, '')
    .replace(/\s*[[(][^)\]]*\b(direct|backup|mirror|source|cdn|akamai)\b[^)\]]*[)\]]/gi, '')
    .replace(LONE_HIGH_SURROGATE, '')
    .replace(LONE_LOW_SURROGATE, '')
    .replace(FILLER_GLYPHS, '')
    .replace(/\s+/g, ' ')
    .trim();

  const qualityMatch = label.match(/\b(4K|UHD|1080p|720p|480p|FHD|HD|SD)\b/i);
  label = label
    .replace(/\b(4K|UHD|1080p|720p|480p|FHD|HD|SD)\b/i, '')
    .replace(/\s*[-–|·]\s*$/, '')
    .replace(/^\s*[-–|·]\s*/, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!label) label = `Server ${idx + 1}`;

  let tag = qualityMatch ? qualityMatch[1].toUpperCase() : undefined;
  if (tag === 'FHD') tag = '1080p';
  if (tag === 'UHD') tag = '4K';

  return { label, tag };
};
