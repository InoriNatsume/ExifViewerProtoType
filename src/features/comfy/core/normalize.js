import { matchesOfficialSchema } from './schema.js';

export function normalizeGraph(raw, schema) {
  if (!raw || typeof raw !== 'object') {
    return { nodes: {}, edges: [] };
  }

  if (isPromptDict(raw)) {
    const nodesById = {};
    const edges = [];
    const subgraphContainers = new Set();

    // 1단계: 노드 수집 + subgraph 컨테이너 ID 추출
    Object.entries(raw).forEach(([id, n]) => {
      const type = n.type || { workflow: n.class_type || n.ui_type };
      nodesById[String(id)] = { ...n, id: String(id), type };

      // "344:339" 패턴에서 컨테이너 ID "344" 추출
      if (id.includes(':')) {
        const containerId = id.split(':')[0];
        subgraphContainers.add(containerId);
      }
    });

    // 2단계: inputs에서 edges 추출
    Object.entries(raw).forEach(([id, n]) => {
      if (!n.inputs) return;
      Object.entries(n.inputs).forEach(([inputName, value]) => {
        // [srcId, srcSlot] 형태의 링크인지 확인
        if (Array.isArray(value) && value.length >= 2 && 
            (typeof value[0] === 'string' || typeof value[0] === 'number')) {
          const srcId = String(value[0]);
          const srcSlot = value[1];
          edges.push({
            src_id: srcId,
            src_slot: srcSlot,
            dst_id: String(id),
            dst_input: inputName,
            via: 'prompt',
          });
        }
      });
    });

    // 3단계: 가상 subgraph 컨테이너 노드 생성
    subgraphContainers.forEach((containerId) => {
      if (!nodesById[containerId]) {
        // 컨테이너에 속한 내부 노드들 수집
        const childIds = Object.keys(nodesById).filter((id) => id.startsWith(containerId + ':'));
        nodesById[containerId] = {
          id: containerId,
          type: { workflow: 'Subgraph' },
          _isVirtualContainer: true,
          _childNodeIds: childIds,
          inputs: {},
          class_type: 'Subgraph',
          _meta: { title: `Subgraph ${containerId}` },
        };
      }
    });

    return { nodes: nodesById, edges };
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
