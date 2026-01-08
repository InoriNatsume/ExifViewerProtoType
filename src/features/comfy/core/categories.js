export function getNodeType(node) {
  if (!node) return 'UNKNOWN';
  if (typeof node.type === 'string') return node.type;
  return node.type?.prompt || node.type?.workflow || node.class_type || node.ui_type || 'UNKNOWN';
}

export function getNodeIO(node) {
  const inputs = node.ui?.inputs || node.inputs || [];
  const outputs = node.ui?.outputs || node.outputs || [];
  return { inputs, outputs };
}

export function getIOTypes(node) {
  const { inputs, outputs } = getNodeIO(node);
  const types = [];
  const pushType = (t) => {
    if (Array.isArray(t)) {
      t.forEach((v) => types.push(String(v)));
      return;
    }
    if (t !== undefined && t !== null) types.push(String(t));
  };
  inputs.forEach((i) => pushType(i.type));
  outputs.forEach((o) => pushType(o.type));
  return types;
}

export function getCategories(node) {
  const type = getNodeType(node).toLowerCase();
  const widgetStr = JSON.stringify(node.ui?.widgets_values || []).toLowerCase();
  const cats = new Set();

  if (widgetStr.match(/\.(safetensors|ckpt|pt|gguf|pth)\b/)) cats.add('model');
  if (type.includes('cliptextencode') || type.includes('text prompt') || type.includes('primitive')) {
    cats.add('prompt');
  }
  if ((type.includes('ksampler') || type.includes('facedetailer')) && !type.includes('upscale')) {
    cats.add('sampler');
  }

  if (cats.size === 0) cats.add('default');
  return [...cats];
}

export function getPrimaryCategory(node, filterMode) {
  const cats = getCategories(node);
  if (filterMode && cats.includes(filterMode)) return filterMode;
  if (cats.includes('model')) return 'model';
  if (cats.includes('prompt')) return 'prompt';
  if (cats.includes('sampler')) return 'sampler';
  return 'default';
}

export function getPreview(node, category) {
  const widgets = node.ui?.widgets_values || [];
  if (!widgets.length) return '';

  if (category === 'model') {
    const file = widgets.find((w) => typeof w === 'string' && (w.includes('.') || w.includes('/')));
    return file || widgets[0];
  }
  if (category === 'prompt') {
    const text = widgets.find((w) => typeof w === 'string' && w.length > 5);
    return text || '';
  }
  const val = widgets.find((w) => typeof w === 'number' || (typeof w === 'string' && w.length < 20));
  return val !== undefined ? val : '';
}
