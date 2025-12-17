// RAW 또는 정규화된 객체를 보기 좋게 문자열화
export function prettyJson(obj) {
  // 문자열이면 JSON 파싱을 시도하고, 실패하면 원문 반환
  if (typeof obj === 'string') {
    const trimmed = obj.trim();
    if ((trimmed.startsWith('{') || trimmed.startsWith('['))) {
      try {
        const parsed = JSON.parse(trimmed);
        return JSON.stringify(parsed, null, 2);
      } catch (_) {
        // 그대로 반환
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
