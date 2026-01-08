export function detectModelFromMeta(meta) {
  if (!meta) return { kind: 'unknown', reason: 'no-meta' };
  const { standardExif, pngText } = meta;

  const comfy = detectComfyFromPngText(pngText);
  if (comfy.matched) return { kind: 'comfy', reason: comfy.reason };

  const nai = detectNovelAiFromStandardExif(standardExif);
  if (nai.matched) return { kind: 'nai', reason: nai.reason };

  return { kind: 'unknown', reason: 'no-signature' };
}

export function detectComfyFromPngText(pngText) {
  if (!pngText || typeof pngText !== 'object') return { matched: false, reason: 'no-png-text' };
  const keys = Object.keys(pngText);
  if (keys.length === 0) return { matched: false, reason: 'no-png-text' };

  const workflowKey = keys.find((k) => k.toLowerCase().includes('workflow'));
  if (workflowKey) {
    const values = pngText[workflowKey] || [];
    const parsed = values.map(tryJsonLoadsMaybeNested).find(isComfyWorkflow);
    if (parsed) return { matched: true, reason: `workflow:${workflowKey}` };
  }

  const promptKey = keys.find((k) => k.toLowerCase() === 'prompt');
  if (promptKey) {
    const values = pngText[promptKey] || [];
    const parsed = values.map(tryJsonLoadsMaybeNested).find(isComfyPrompt);
    if (parsed) return { matched: true, reason: 'prompt' };
  }

  return { matched: false, reason: 'no-comfy-signature' };
}

export function detectNovelAiFromStandardExif(standardExif) {
  if (!standardExif || typeof standardExif !== 'object') {
    return { matched: false, reason: 'no-standard-exif' };
  }
  const software = standardExif.Software || standardExif.software || '';
  const source = standardExif.Source || standardExif.source || '';
  const isNAI = /novelai/i.test(software) || /novelai/i.test(source);
  return { matched: isNAI, reason: isNAI ? 'novelai-tag' : 'no-novelai-tag' };
}

export function tryJsonLoadsMaybeNested(value) {
  if (typeof value !== 'string') return value;
  const s = value.trim();
  if (!(s.startsWith('{') || s.startsWith('['))) return value;
  try {
    const obj = JSON.parse(s);
    if (typeof obj === 'string') {
      const s2 = obj.trim();
      if (s2.startsWith('{') || s2.startsWith('[')) {
        try {
          return JSON.parse(s2);
        } catch (_) {
          return obj;
        }
      }
    }
    return obj;
  } catch (_) {
    return value;
  }
}

function isComfyWorkflow(obj) {
  if (!obj || typeof obj !== 'object') return false;
  if (!Array.isArray(obj.nodes)) return false;
  if (!Array.isArray(obj.links) && !Array.isArray(obj.edges)) return false;
  return true;
}

function isComfyPrompt(obj) {
  if (!obj || typeof obj !== 'object') return false;
  const values = Object.values(obj);
  if (values.length === 0) return false;
  return values.some((v) => v && typeof v === 'object' && 'class_type' in v && 'inputs' in v);
}
