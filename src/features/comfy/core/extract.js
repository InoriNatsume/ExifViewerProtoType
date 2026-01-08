export function extractComfyPayloadFromPngText(pngText) {
  if (!pngText || typeof pngText !== 'object') {
    return { prompt: null, workflow: null, sourceKeys: [] };
  }
  const keys = Object.keys(pngText);
  let workflow = null;
  let workflowKey = null;
  let prompt = null;
  let promptKey = null;

  const workflowCandidate = keys.find((k) => k.toLowerCase().includes('workflow'));
  if (workflowCandidate) {
    const values = pngText[workflowCandidate] || [];
    workflow = values.map(tryJsonLoadsMaybeNested).find((v) => v && typeof v === 'object');
    workflowKey = workflow ? workflowCandidate : null;
  }

  const promptCandidate = keys.find((k) => k.toLowerCase() === 'prompt');
  if (promptCandidate) {
    const values = pngText[promptCandidate] || [];
    prompt = values.map(tryJsonLoadsMaybeNested).find((v) => v && typeof v === 'object');
    promptKey = prompt ? promptCandidate : null;
  }

  return {
    prompt,
    workflow,
    sourceKeys: [workflowKey, promptKey].filter(Boolean),
  };
}

function tryJsonLoadsMaybeNested(value) {
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
