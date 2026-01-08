// RAW ?먮뒗 ?뺢퇋?붾맂 媛앹껜瑜?蹂닿린 醫뗪쾶 臾몄옄?댄솕
export function prettyJson(obj) {
  // 臾몄옄?댁씠硫?JSON ?뚯떛???쒕룄?섍퀬, ?ㅽ뙣?섎㈃ ?먮Ц 諛섑솚
  if (typeof obj === 'string') {
    const trimmed = obj.trim();
    if ((trimmed.startsWith('{') || trimmed.startsWith('['))) {
      try {
        const parsed = JSON.parse(trimmed);
        return JSON.stringify(parsed, null, 2);
      } catch (_) {
        // 洹몃?濡?諛섑솚
      }
    }
    return obj;
  }
  try {
    return JSON.stringify(obj, null, 2);
  } catch (_) {
    return String(obj ?? '');
  }
}
