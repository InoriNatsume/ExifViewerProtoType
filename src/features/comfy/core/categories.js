export function getNodeType(node) {
  if (!node) return 'UNKNOWN';
  if (typeof node.type === 'string') return node.type;
  return node.type?.prompt || node.type?.workflow || node.class_type || node.ui_type || 'UNKNOWN';
}

export function getNodeIO(node) {
  // workflow 형식: inputs/outputs가 배열
  // prompt dict 형식: inputs가 객체 (이 경우 I/O 타입 정보 없음)
  let inputs = node.ui?.inputs || [];
  let outputs = node.ui?.outputs || [];
  
  // prompt dict의 경우 node.inputs는 객체이므로 배열이 아니면 빈 배열로
  if (!Array.isArray(inputs)) inputs = [];
  if (!Array.isArray(outputs)) outputs = [];
  
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
  // widgets_values (workflow) 또는 inputs (prompt dict) 둘 다 확인
  const widgetStr = JSON.stringify(node.ui?.widgets_values || []).toLowerCase();
  const inputsStr = JSON.stringify(getInputValues(node)).toLowerCase();
  const combinedStr = widgetStr + inputsStr;
  const cats = new Set();

  if (combinedStr.match(/\.(safetensors|ckpt|pt|gguf|pth)\b/)) cats.add('model');
  if (type.includes('cliptextencode') || type.includes('text prompt') || type.includes('primitive')) {
    cats.add('prompt');
  }
  if ((type.includes('ksampler') || type.includes('facedetailer')) && !type.includes('upscale')) {
    cats.add('sampler');
  }

  if (cats.size === 0) cats.add('default');
  return [...cats];
}

// prompt dict의 inputs에서 실제 값(링크가 아닌 것)만 추출
export function getInputValues(node) {
  if (!node.inputs || typeof node.inputs !== 'object') return [];
  const values = [];
  Object.entries(node.inputs).forEach(([key, val]) => {
    // [id, slot] 형태의 링크는 제외
    if (Array.isArray(val) && val.length === 2 && 
        (typeof val[0] === 'string' || typeof val[0] === 'number')) {
      return; // 링크는 스킵
    }
    values.push({ key, value: val });
  });
  return values;
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
  const inputVals = getInputValues(node);
  
  // widgets_values가 있으면 우선 사용, 없으면 inputs에서 값 추출
  const allValues = widgets.length > 0 
    ? widgets 
    : inputVals.map(iv => iv.value);
  
  if (!allValues.length) return '';

  if (category === 'model') {
    const file = allValues.find((w) => typeof w === 'string' && (w.includes('.') || w.includes('/')));
    return file || (typeof allValues[0] === 'string' ? allValues[0] : '');
  }
  if (category === 'prompt') {
    const text = allValues.find((w) => typeof w === 'string' && w.length > 5);
    return text || '';
  }
  const val = allValues.find((w) => typeof w === 'number' || (typeof w === 'string' && w.length < 20));
  return val !== undefined ? String(val) : '';
}
