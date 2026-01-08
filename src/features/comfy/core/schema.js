export const DEFAULT_SCHEMA_URL = './comfy/official_comfyui_worflow.json';

export async function loadWorkflowSchema(url) {
  if (!url) return null;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return await res.json();
  } catch (_) {
    return null;
  }
}

export function matchesOfficialSchema(raw, schema) {
  if (!raw || typeof raw !== 'object') return false;
  if (!schema) return false;
  const req = schema.definitions?.ComfyWorkflow1_0?.required || [];
  if (!req.every((k) => k in raw)) return false;
  return Array.isArray(raw.nodes);
}
