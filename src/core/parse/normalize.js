import { parseNovelAI } from './schema/novelai-schema.js';

// 입력: raw 객체
// 출력: { vendor, normalized, raw }
export function normalizeMetadata(raw) {
  const nai = parseNovelAI(raw);
  if (nai) {
    return { vendor: 'novelai', normalized: nai, raw };
  }
  return { vendor: 'unknown', normalized: null, raw };
}
