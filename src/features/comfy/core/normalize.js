import { matchesOfficialSchema } from './schema.js';

export function normalizeGraph(raw, schema) {
  if (!raw || typeof raw !== 'object') {
    return { nodes: {}, edges: [] };
  }

  if (isPromptDict(raw)) {
    const nodesById = {};
    Object.entries(raw).forEach(([id, n]) => {
      const type = n.type || { workflow: n.class_type || n.ui_type };
      nodesById[String(id)] = { ...n, id: String(id), type };
    });
    return { nodes: nodesById, edges: [] };
  }

  const isOfficial = matchesOfficialSchema(raw, schema) || Array.isArray(raw.nodes);
  if (isOfficial) {
    const nodesById = {};
    (raw.nodes || []).forEach((n) => {
      const id = String(n.id);
      nodesById[id] = {
        id,
        type: { workflow: n.type },
        ui: {
          pos: n.pos,
          size: n.size,
          widgets_values: n.widgets_values,
          inputs: n.inputs,
          outputs: n.outputs,
          properties: n.properties,
        },
      };
    });
    const edges = (raw.links || []).map((l) => ({
      src_id: String(l.origin_id),
      src_slot: l.origin_slot,
      dst_id: String(l.target_id),
      dst_slot: l.target_slot,
      via: 'workflow',
    }));
    return { nodes: nodesById, edges };
  }

  const nodesById = {};
  Object.values(raw.nodes || {}).forEach((n) => {
    const id = String(n.id);
    const type = n.type || { workflow: n.class_type || n.ui_type };
    nodesById[id] = { ...n, id, type };
  });
  return { nodes: nodesById, edges: raw.edges || [] };
}

function isPromptDict(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return false;
  if ('nodes' in raw) return false;
  const values = Object.values(raw);
  if (values.length === 0) return false;
  return values.some((v) => v && typeof v === 'object' && 'class_type' in v && 'inputs' in v);
}
