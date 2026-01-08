export function getResourceExt(name) {
  const idx = name.lastIndexOf('.');
  if (idx === -1) return '';
  return name.slice(idx + 1).toLowerCase();
}

export function formatExtBadge(ext) {
  if (!ext) return 'UNKNOWN';
  return ext.toUpperCase();
}

export function collectResources(nodes) {
  const resources = new Map();
  Object.values(nodes || {}).forEach((n) => {
    const widgets = n.ui?.widgets_values || [];
    widgets.forEach((w) => {
      if (typeof w === 'string') {
        if (w.match(/\.(safetensors|ckpt|pt|pth|gguf|bin|onnx)$/i)) {
          const key = w;
          if (!resources.has(key)) {
            resources.set(key, { name: w, ext: getResourceExt(w) });
          }
        }
      }
    });
  });
  return [...resources.values()].sort((a, b) => a.name.localeCompare(b.name));
}
