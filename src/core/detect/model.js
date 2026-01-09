export function detectModelFromMeta(meta, stealthExif = null) {
  if (!meta) return { kind: 'unknown', reason: 'no-meta' };
  const { standardExif, pngText } = meta;

  const comfy = detectComfyFromPngText(pngText);
  if (comfy.matched) return { kind: 'comfy', reason: comfy.reason };

  const naiStealth = detectNovelAiFromExif(stealthExif);
  if (naiStealth.matched) return { kind: 'nai', reason: `stealth:${naiStealth.reason}` };

  const naiStandard = detectNovelAiFromExif(standardExif);
  if (naiStandard.matched) return { kind: 'nai', reason: naiStandard.reason };

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

export function detectNovelAiFromExif(exif) {
  if (!exif || typeof exif !== 'object') {
    return { matched: false, reason: 'no-standard-exif' };
  }
  const software = exif.Software || exif.software || '';
  const source = exif.Source || exif.source || '';
  const isNAI = /novelai/i.test(software) || /novelai/i.test(source);
  if (isNAI) return { matched: true, reason: 'novelai-tag' };

  const hasPrompt = typeof exif.prompt === 'string' || !!exif.v4_prompt;
  const hasNAIKeys =
    hasPrompt &&
    (exif.steps !== undefined ||
      exif.sampler !== undefined ||
      exif.noise_schedule !== undefined ||
      exif.width !== undefined ||
      exif.height !== undefined);
  if (hasNAIKeys) return { matched: true, reason: 'novelai-keys' };

  return { matched: false, reason: 'no-novelai-tag' };
}

export function detectNovelAiFromStandardExif(standardExif) {
  return detectNovelAiFromExif(standardExif);
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
