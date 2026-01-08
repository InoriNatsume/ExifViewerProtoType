// Build a tree for hierarchical key exploration.
export function buildKeyTree(obj, options = {}) {
  const {
    maxNodes = 2000,
    maxDepth = 10,
  } = options;
  const visited = new WeakSet();
  let nodeCount = 0;

  function makeNode(key, path, value, depth) {
    if (nodeCount >= maxNodes) return null;
    nodeCount += 1;
    const node = {
      key,
      path,
      type: describeType(value),
      sample: formatSample(value),
      value,
      children: [],
    };

    if (depth >= maxDepth) return node;

    if (value && typeof value === 'object') {
      if (visited.has(value)) return node;
      visited.add(value);

      if (Array.isArray(value)) {
        value.forEach((v, i) => {
          const child = makeNode(`[${i}]`, `${path}[${i}]`, v, depth + 1);
          if (child) node.children.push(child);
        });
      } else {
        Object.entries(value).forEach(([k, v]) => {
          const nextPath = path && path !== '(root)' ? `${path}.${k}` : k;
          const child = makeNode(k, nextPath, v, depth + 1);
          if (child) node.children.push(child);
        });
      }
      return node;
    }

    if (typeof value === 'string') {
      const parsed = maybeParseJsonString(value);
      if (parsed) {
        const jsonPath = path && path !== '(root)' ? `${path}(json)` : '(json)';
        const child = makeNode('(json)', jsonPath, parsed, depth + 1);
        if (child) node.children.push(child);
      }
    }

    return node;
  }

  return makeNode('(root)', '(root)', obj, 0);
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

function describeType(value) {
  if (value === null) return 'null';
  if (Array.isArray(value)) return `array(${value.length})`;
  if (typeof value === 'object') return 'object';
  return typeof value;
}
