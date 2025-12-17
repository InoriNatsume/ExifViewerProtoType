// JSON 키 구조를 평탄화해서 목록으로 반환
// 입력: object
// 출력: [{ path, type, sample }]
export function extractKeyPaths(obj, maxEntries = 1000) {
  const result = [];
  const visited = new WeakSet();
  function walk(value, path) {
    if (result.length >= maxEntries) return;
    if (value && typeof value === 'object') {
      if (visited.has(value)) return;
      visited.add(value);

      // 현재 노드 자체도 기록 (object/array)
      result.push({
        path: path || '(root)',
        type: Array.isArray(value) ? `array(${value.length})` : 'object',
        sample: summarizeObject(value),
      });

      if (Array.isArray(value)) {
        value.forEach((v, i) => walk(v, `${path}[${i}]`));
      } else {
        Object.entries(value).forEach(([k, v]) => {
          const next = path ? `${path}.${k}` : k;
          walk(v, next);
        });
      }
    } else if (typeof value === 'string') {
      const parsed = maybeParseJsonString(value);
      result.push({
        path: path || '(root)',
        type: 'string',
        sample: formatSample(value),
      });
      // 문자열이 JSON 구조라면 중첩 구조도 탐색
      if (parsed) {
        const nextPath = path ? `${path}(json)` : '(json)';
        walk(parsed, nextPath);
      }
    } else {
      result.push({
        path: path || '(root)',
        type: typeof value,
        sample: formatSample(value),
      });
    }
  }
  walk(obj, '');
  return result;
}

function formatSample(v) {
  if (v === null) return 'null';
  if (v === undefined) return 'undefined';
  if (typeof v === 'string') {
    return v.length > 120 ? v.slice(0, 117) + '...' : v;
  }
  try {
    const s = JSON.stringify(v);
    return s.length > 120 ? s.slice(0, 117) + '...' : s;
  } catch (_) {
    return String(v);
  }
}

function summarizeObject(v) {
  if (Array.isArray(v)) return `array(${v.length})`;
  return `object(keys:${Object.keys(v).length})`;
}

function maybeParseJsonString(str) {
  const trimmed = str.trim();
  if (!trimmed || (trimmed[0] !== '{' && trimmed[0] !== '[')) return null;
  try {
    const parsed = JSON.parse(trimmed);
    if (parsed && typeof parsed === 'object') return parsed;
  } catch (_) {
    return null;
  }
  return null;
}
