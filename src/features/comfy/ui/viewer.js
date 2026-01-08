import { DEFAULT_SCHEMA_URL, loadWorkflowSchema } from '../core/schema.js';
import { normalizeGraph } from '../core/normalize.js';
import { getCategories, getNodeIO, getNodeType, getPrimaryCategory, getPreview } from '../core/categories.js';
import { collectResources, formatExtBadge } from '../core/resources.js';

export async function initComfyViewer(options = {}) {
  const {
    schemaUrl = DEFAULT_SCHEMA_URL,
  } = options;

  let graph = null;
  let workflowSchema = null;
  let edgesBySrc = new Map();
  let edgesByDst = new Map();
  let currentFilter = 'all';
  let selectedTypeFilter = null;
  let currentSearch = '';
  let currentIdSearch = '';
  let selectedNodeId = null;
  let resFilterExt = 'all';
  let resSearch = '';
  let resPage = 1;
  const RES_PAGE_SIZE = 200;
  let resItemsCache = [];

  const fileInput = document.getElementById('file-input');
  const metaInfo = document.getElementById('meta-info');
  const nodeList = document.getElementById('node-list');
  const detailPanel = document.getElementById('detail-panel');
  const searchInput = document.getElementById('search');
  const idSearchInput = document.getElementById('id-search');
  const resModal = document.getElementById('res-modal');
  const resSearchInput = document.getElementById('res-search');
  const resFilters = document.getElementById('res-filters');
  const resList = document.getElementById('res-list');
  const resMore = document.getElementById('res-more');
  const resOpen = document.getElementById('res-open');
  const resClose = document.getElementById('res-close');

  workflowSchema = await loadWorkflowSchema(schemaUrl);

  function tryLoadFromSession() {
    const raw = sessionStorage.getItem('comfyPayload');
    if (!raw) return false;
    sessionStorage.removeItem('comfyPayload');
    try {
      const payload = JSON.parse(raw);
      const data = payload.workflow || payload.prompt || payload.raw;
      if (!data) return false;
      graph = normalizeGraph(data, workflowSchema);
      buildEdges();
      metaInfo.innerText = `${Object.keys(graph.nodes).length} Nodes`;
      selectedNodeId = null;
      setEmptyDetail();
      renderList();
      return true;
    } catch (_) {
      return false;
    }
  }

  function buildEdges() {
    edgesBySrc = new Map();
    edgesByDst = new Map();
    (graph.edges || []).forEach((e) => {
      if (!edgesBySrc.has(String(e.src_id))) edgesBySrc.set(String(e.src_id), []);
      edgesBySrc.get(String(e.src_id)).push(e);
      if (!edgesByDst.has(String(e.dst_id))) edgesByDst.set(String(e.dst_id), []);
      edgesByDst.get(String(e.dst_id)).push(e);
    });
  }

  function setEmptyDetail() {
    detailPanel.innerHTML = '<div class="empty-msg">왼쪽에서 노드를 선택하세요.</div>';
  }

  function renderList() {
    if (!graph) return;
    nodeList.innerHTML = '';

    const nodes = Object.values(graph.nodes);
    if (currentFilter === 'type') {
      if (selectedTypeFilter) {
        const backBtn = document.createElement('div');
        backBtn.className = 'back-btn';
        backBtn.textContent = `Back to Type List (Filtered by: ${selectedTypeFilter})`;
        backBtn.addEventListener('click', () => {
          selectedTypeFilter = null;
          renderList();
        });
        nodeList.appendChild(backBtn);

        const filtered = filterNodes(nodes, 'all').filter((n) => getNodeType(n) === selectedTypeFilter);
        renderNodeItems(nodeList, filtered);
        return;
      }

      const typeMap = {};
      nodes.forEach((n) => {
        const t = getNodeType(n);
        typeMap[t] = (typeMap[t] || 0) + 1;
      });
      const sortedTypes = Object.entries(typeMap).sort((a, b) => b[1] - a[1]);
      sortedTypes.forEach(([typeName, count]) => {
        if (currentSearch && !typeName.toLowerCase().includes(currentSearch.toLowerCase())) return;
        const div = document.createElement('div');
        div.className = 'type-group-item';
        div.innerHTML = `<span class="type-name">${typeName}</span> <span class="type-count">${count}</span>`;
        div.addEventListener('click', () => {
          selectedTypeFilter = typeName;
          renderList();
        });
        nodeList.appendChild(div);
      });
      return;
    }

    const filtered = filterNodes(nodes, currentFilter);
    renderNodeItems(nodeList, filtered);
  }

  function filterNodes(nodes, filterMode) {
    return nodes.filter((n) => {
      const cats = getCategories(n);
      const type = getNodeType(n).toLowerCase();
      const widgetStr = JSON.stringify(n.ui?.widgets_values || '').toLowerCase();
      const query = currentSearch.toLowerCase();
      const idQuery = currentIdSearch.toLowerCase();

      if (filterMode !== 'all' && !cats.includes(filterMode)) return false;
      if (idQuery && !String(n.id).toLowerCase().includes(idQuery)) return false;
      if (query) {
        return String(n.id).includes(query) || type.includes(query) || widgetStr.includes(query);
      }
      return true;
    });
  }

  function renderNodeItems(container, nodes) {
    if (nodes.length === 0) {
      container.innerHTML += '<div class="empty-msg">결과 없음</div>';
      return;
    }
    nodes.forEach((n) => {
      const cat = getPrimaryCategory(n, currentFilter);
      const type = getNodeType(n);
      const preview = getPreview(n, cat);

      const div = document.createElement('div');
      div.className = `node-item cat-${cat} ${selectedNodeId == n.id ? 'selected' : ''}`;
      div.addEventListener('click', () => {
        selectedNodeId = n.id;
        renderList();
        renderDetail(n.id);
      });
      div.innerHTML = `
        <div class="node-head">
          <span class="node-type">${type}</span>
          <span class="node-id">#${n.id}</span>
        </div>
        <div class="node-preview">${preview}</div>
      `;
      container.appendChild(div);
    });
  }

  function renderIOTypes(inputs, outputs) {
    const formatType = (t) => (Array.isArray(t) ? t.join(' | ') : String(t));
    const inHtml = (inputs && inputs.length)
      ? inputs.map((i) => {
        return `<div class="widget-row">
          <span class="w-label">IN ${i.name}</span>
          <span class="w-value">${formatType(i.type)}</span>
        </div>`;
      }).join('')
      : '<div style="color:#aaa; font-style:italic">-</div>';
    const outHtml = (outputs && outputs.length)
      ? outputs.map((o) => {
        return `<div class="widget-row">
          <span class="w-label">OUT ${o.name}</span>
          <span class="w-value">${formatType(o.type)}</span>
        </div>`;
      }).join('')
      : '<div style="color:#aaa; font-style:italic">-</div>';

    return `
      <div style="display:flex; gap:10px;">
        <div style="flex:1">${inHtml}</div>
        <div style="flex:1">${outHtml}</div>
      </div>
    `;
  }

  function renderDetail(nid) {
    const n = graph.nodes[nid];
    if (!n) return;

    const type = getNodeType(n);
    const io = getNodeIO(n);
    const ioTypesHtml = renderIOTypes(io.inputs, io.outputs);

    let widgetsHtml = '';
    if (n.ui?.widgets_values?.length) {
      widgetsHtml = n.ui.widgets_values.map((w, i) => {
        if (typeof w === 'string' && w.length > 50) {
          return `<div>
            <div class="w-label" style="margin-top:8px">WIDGET ${i}</div>
            <textarea class="w-long-text" readonly>${w}</textarea>
          </div>`;
        }
        return `<div class="widget-row">
          <span class="w-label">WIDGET ${i}</span>
          <span class="w-value">${w}</span>
        </div>`;
      }).join('');
    } else {
      widgetsHtml = '<div style="color:#aaa; font-style:italic">설정값 없음</div>';
    }

    const inputs = (edgesByDst.get(String(nid)) || []).map((e) => {
      const src = graph.nodes[e.src_id];
      const srcType = src ? getNodeType(src) : 'Unknown';
      return `<button class="link-btn" data-jump="${e.src_id}">
        <- <strong>${srcType}</strong> <span class="link-tag">#${e.src_id}</span>
      </button>`;
    }).join('');

    const outputs = (edgesBySrc.get(String(nid)) || []).map((e) => {
      const dst = graph.nodes[e.dst_id];
      const dstType = dst ? getNodeType(dst) : 'Unknown';
      return `<button class="link-btn" data-jump="${e.dst_id}">
        -> <strong>${dstType}</strong> <span class="link-tag">#${e.dst_id}</span>
      </button>`;
    }).join('');

    detailPanel.innerHTML = `
      <div class="detail-card">
        <h2 class="detail-title">${type}</h2>
        <div class="detail-subtitle">ID: ${n.id} &bull; Category: ${getCategories(n).join(', ')}</div>

        <h3>I/O Types</h3>
        <div>${ioTypesHtml}</div>

        <h3>설정값 (Widgets)</h3>
        <div>${widgetsHtml}</div>

        <h3>Flow</h3>
        <div style="display:flex; gap:10px;">
          <div style="flex:1"><div style="font-size:10px; color:#aaa; margin-bottom:4px">INPUTS</div>${inputs || '-'}</div>
          <div style="flex:1"><div style="font-size:10px; color:#aaa; margin-bottom:4px">OUTPUTS</div>${outputs || '-'}</div>
        </div>
      </div>
    `;

    detailPanel.querySelectorAll('[data-jump]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.jump;
        selectedNodeId = id;
        renderList();
        renderDetail(id);
      });
    });
  }

  function buildResourceFilters(items) {
    const extCounts = {};
    items.forEach((it) => {
      extCounts[it.ext] = (extCounts[it.ext] || 0) + 1;
    });
    const entries = Object.entries(extCounts).sort((a, b) => b[1] - a[1]);
    const allCount = items.length;
    resFilters.innerHTML = '';

    const makeBtn = (label, extKey) => {
      const btn = document.createElement('button');
      btn.className = `res-filter-btn ${resFilterExt === extKey ? 'active' : ''}`;
      btn.textContent = `${label} (${extKey === 'all' ? allCount : extCounts[extKey] || 0})`;
      btn.addEventListener('click', () => {
        resFilterExt = extKey;
        resPage = 1;
        renderResourceList();
        buildResourceFilters(items);
      });
      resFilters.appendChild(btn);
    };

    makeBtn('ALL', 'all');
    entries.forEach(([ext]) => makeBtn(`.${ext}`, ext));
  }

  function renderResourceList() {
    resList.innerHTML = '';
    const query = resSearch.toLowerCase();
    const filtered = resItemsCache.filter((it) => {
      if (resFilterExt !== 'all' && it.ext !== resFilterExt) return false;
      if (query && !it.name.toLowerCase().includes(query)) return false;
      return true;
    });
    const limit = resPage * RES_PAGE_SIZE;
    const visible = filtered.slice(0, limit);

    if (visible.length === 0) {
      resList.innerHTML = '<div style="padding:10px; text-align:center; color:#999">표시할 항목이 없습니다.</div>';
    } else {
      visible.forEach((it) => {
        const div = document.createElement('div');
        div.className = 'res-list-item';
        div.innerHTML = `<span class="res-badge">${formatExtBadge(it.ext)}</span> ${it.name}`;
        resList.appendChild(div);
      });
    }
    resMore.style.display = filtered.length > visible.length ? 'block' : 'none';
  }

  function showResourceModal() {
    if (!graph) {
      alert('파일을 먼저 열어주세요.');
      return;
    }
    resModal.style.display = 'flex';
    resList.innerHTML = '';
    resItemsCache = collectResources(graph.nodes);
    resFilterExt = 'all';
    resSearch = '';
    resPage = 1;
    resSearchInput.value = '';
    if (resItemsCache.length === 0) {
      resList.innerHTML = '<div style="padding:10px; text-align:center; color:#999">발견된 리소스가 없습니다.</div>';
      resFilters.innerHTML = '';
      resMore.style.display = 'none';
      return;
    }
    buildResourceFilters(resItemsCache);
    renderResourceList();
  }

  function closeResourceModal(e) {
    if (e && !e.target.classList.contains('modal-overlay')) return;
    resModal.style.display = 'none';
  }

  fileInput.addEventListener('change', async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    const raw = JSON.parse(await f.text());
    graph = normalizeGraph(raw, workflowSchema);
    buildEdges();
    metaInfo.innerText = `${Object.keys(graph.nodes).length} Nodes`;
    selectedNodeId = null;
    setEmptyDetail();
    renderList();
  });

  document.querySelectorAll('.tab-btn').forEach((el) => {
    el.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach((c) => c.classList.remove('active'));
      el.classList.add('active');
      currentFilter = el.dataset.filter;
      selectedTypeFilter = null;
      renderList();
    });
  });

  searchInput.addEventListener('input', (e) => {
    currentSearch = e.target.value;
    renderList();
  });

  idSearchInput.addEventListener('input', (e) => {
    currentIdSearch = e.target.value;
    renderList();
  });

  resSearchInput.addEventListener('input', (e) => {
    resSearch = e.target.value;
    resPage = 1;
    renderResourceList();
  });

  resMore.addEventListener('click', () => {
    resPage += 1;
    renderResourceList();
  });

  resOpen.addEventListener('click', showResourceModal);
  resClose.addEventListener('click', () => closeResourceModal({ target: resModal }));
  resModal.addEventListener('click', closeResourceModal);

  setEmptyDetail();
  tryLoadFromSession();
}
