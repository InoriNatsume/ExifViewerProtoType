import { parseNovelAI } from './schema/novelai-schema.js';

// ?낅젰: raw 媛앹껜
// 異쒕젰: { vendor, normalized, raw }
export function normalizeMetadata(raw) {
  const nai = parseNovelAI(raw);
  if (nai) {
    return { vendor: 'novelai', normalized: nai, raw };
  }
  return { vendor: 'unknown', normalized: null, raw };
}
