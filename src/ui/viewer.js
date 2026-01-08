import { parseStealthExif } from '../core/extract/stealth-exif.js';
import { normalizeMetadata } from '../core/parse/normalize.js';
import { buildSections } from '../core/format/view-model.js';
import { prettyJson } from '../core/format/pretty-json.js';
import { saveJson } from '../features/download/save-json.js';
import { buildKeyTree } from '../core/format/key-explorer.js';
import { readImageMeta } from '../core/image/read-image-meta.js';
import { detectModelFromMeta } from '../core/detect/model.js';
import { extractComfyPayloadFromPngText } from '../features/comfy/core/extract.js';

export function initViewer() {
  const fileInput = document.getElementById('fileInput');
  const preview = document.getElementById('preview');
  const fileMeta = document.getElementById('file-meta');
  const tabs = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');
  const sectionsEl = document.getElementById('section-view');
  const rawSelectedEl = document.getElementById('raw-selected');
  const keyExplorerEl = document.getElementById('key-explorer');
  const badgeStd = document.getElementById('badge-std');
  const badgeStealth = document.getElementById('badge-stealth');
  const badgeModel = document.getElementById('badge-model');
  const badgeVendor = document.getElementById('badge-vendor');
  const btnSave = document.getElementById('btn-save-json');
  const btnOpenNai = document.getElementById('btn-open-nai');
  const btnOpenComfy = document.getElementById('btn-open-comfy');
  const miniSampleEl = document.getElementById('mini-sample');
  const miniSizeEl = document.getElementById('mini-size');
  const srcStdBtn = document.getElementById('src-standard');
  const srcStealthBtn = document.getElementById('src-stealth');

  let currentData = {
    standardObj: null,
    stealthObj: null,
    normalized: null,
    merged: null,
  };
  let currentTab = 'normalized';
  let currentSource = 'standard';
  let lastMeta = null;
  let lastModel = null;

  function renderAll() {
    const sourceObj = currentSource === 'standard' ? currentData.standardObj : currentData.stealthObj;
    const merged = sourceObj
      ? pickMergedMeta(sourceObj, currentSource === 'stealth' ? JSON.stringify(sourceObj) : null)
      : null;
    const normalized = merged ? normalizeMetadata(merged) : { vendor: 'unknown', normalized: null };
    currentData.normalized = normalized;
    currentData.merged = merged;

    renderSections(sectionsEl, normalized.normalized);
    renderMiniMeta(normalized.normalized, miniSampleEl, miniSizeEl);
    renderKeyExplorer(keyExplorerEl, sourceObj);
    renderVendorBadge(badgeVendor, sourceObj);

    if (sourceObj) {
      const displayObj = normalizeRawForDisplay(sourceObj);
      rawSelectedEl.textContent = prettyJson(displayObj);
    } else {
      rawSelectedEl.textContent = `${currentSource === 'standard' ? '표준' : '스텔스'} EXIF 없음`;
    }
  }

  function markSourceButtons() {
    srcStdBtn.classList.toggle('active', currentSource === 'standard');
    srcStealthBtn.classList.toggle('active', currentSource === 'stealth');
  }

  tabs.forEach((btn) => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.tab;
      currentTab = target;
      tabs.forEach((b) => b.classList.remove('active'));
      tabContents.forEach((c) => c.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(`tab-${target}`).classList.add('active');
    });
  });

  srcStdBtn.addEventListener('click', () => {
    currentSource = 'standard';
    renderAll();
    markSourceButtons();
  });
  srcStealthBtn.addEventListener('click', () => {
    currentSource = 'stealth';
    renderAll();
    markSourceButtons();
  });

  btnSave.addEventListener('click', () => {
    const sourceObj = currentSource === 'standard' ? currentData.standardObj : currentData.stealthObj;
    if (currentTab === 'normalized' && currentData.normalized) {
      saveJson(`normalized_${currentSource}.json`, currentData.normalized);
    } else if (currentTab === 'raw' && sourceObj) {
      saveJson(`${currentSource}_exif.json`, sourceObj);
    } else if (currentTab === 'keys' && sourceObj) {
      saveJson(`keys_${currentSource}.json`, sourceObj);
    }
  });

  btnOpenNai?.addEventListener('click', () => {
    if (!lastModel || lastModel.kind !== 'nai') return;
    document.querySelector('[data-tab="normalized"]')?.click();
  });

  btnOpenComfy?.addEventListener('click', () => {
    if (!lastMeta || !lastModel || lastModel.kind !== 'comfy') return;
    const payload = extractComfyPayloadFromPngText(lastMeta.pngText);
    if (!payload.workflow && !payload.prompt) {
      alert('ComfyUI 메타데이터가 없습니다.');
      return;
    }
    sessionStorage.setItem('comfyPayload', JSON.stringify({ ...payload, source: 'png' }));
    window.location.href = './comfy_viewer.html';
  });

  fileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    preview.src = url;
    preview.style.display = 'block';
    fileMeta.textContent = `파일: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`;

    badgeStd.textContent = '표준 EXIF 확인 중...';
    badgeStealth.textContent = '스텔스 확인 중...';
    badgeModel.textContent = '모델 판정 중...';

    const meta = await readImageMeta(file);
    if (!meta) return;
    lastMeta = meta;

    currentData.standardObj = meta.standardExif;
    badgeStd.textContent = meta.standardExif ? '표준 EXIF OK' : '표준 EXIF 미검출';

    const stealthStr = await parseStealthExif(meta.imageData);
    const stealthObj = stealthStr ? tryParseJson(stealthStr) : null;
    currentData.stealthObj = stealthObj;
    badgeStealth.textContent = stealthObj ? '스텔스 OK' : '스텔스 미검출';

    const modelResult = detectModelFromMeta(meta);
    lastModel = modelResult;
    renderModelBadge(badgeModel, modelResult);
    updateViewerButtons(btnOpenNai, btnOpenComfy, modelResult);

    const hasNAIstealth = isNovelAI(stealthObj);
    const hasNAIstandard = isNovelAI(meta.standardExif);
    if (hasNAIstealth) currentSource = 'stealth';
    else if (hasNAIstandard) currentSource = 'standard';
    else if (meta.standardExif) currentSource = 'standard';
    else if (stealthObj) currentSource = 'stealth';
    markSourceButtons();
    renderAll();
  });
}

function renderVendorBadge(el, obj) {
  if (!obj) {
    el.textContent = '';
    el.style.display = 'none';
    return;
  }
  const software = obj.Software || obj.software || '';
  const source = obj.Source || obj.source || '';
  const isNAI = /novelai/i.test(software) || /novelai/i.test(source);
  if (!isNAI) {
    el.textContent = '';
    el.style.display = 'none';
    return;
  }
  el.style.display = 'inline-block';
  el.textContent = source ? `NovelAI (${source})` : 'NovelAI';
}

function renderModelBadge(el, result) {
  if (!el) return;
  if (!result) {
    el.textContent = '';
    return;
  }
  if (result.kind === 'nai') {
    el.textContent = '판정: NovelAI';
  } else if (result.kind === 'comfy') {
    el.textContent = '판정: ComfyUI';
  } else {
    el.textContent = '판정: 기타/없음';
  }
}

function updateViewerButtons(btnNai, btnComfy, model) {
  const canNai = model && model.kind === 'nai';
  const canComfy = model && model.kind === 'comfy';
  setButtonState(btnNai, canNai);
  setButtonState(btnComfy, canComfy);
}

function setButtonState(btn, enabled) {
  if (!btn) return;
  btn.disabled = !enabled;
  btn.classList.toggle('disabled', !enabled);
}

function isNovelAI(obj) {
  if (!obj) return false;
  const software = obj.Software || obj.software || '';
  const source = obj.Source || obj.source || '';
  return /novelai/i.test(software) || /novelai/i.test(source);
}

function normalizeRawForDisplay(obj, depth = 0, maxDepth = 4) {
  if (!obj || typeof obj !== 'object' || depth > maxDepth) return obj;
  if (Array.isArray(obj)) {
    return obj.map((v) => normalizeRawForDisplay(v, depth + 1, maxDepth));
  }
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === 'string') {
      const parsed = tryParseJson(v);
      out[k] = parsed && depth < maxDepth ? normalizeRawForDisplay(parsed, depth + 1, maxDepth) : v;
    } else {
      out[k] = normalizeRawForDisplay(v, depth + 1, maxDepth);
    }
  }
  return out;
}

function renderSections(root, meta) {
  root.innerHTML = '';
  if (!meta) {
    root.textContent = '정규화된 값이 없습니다.';
    return;
  }
  const sections = buildSections(meta);
  sections.forEach((section) => {
    const card = document.createElement('div');
    card.className = 'section-card';
    card.dataset.mode = section.mode || 'grid';
    const h = document.createElement('h4');
    h.textContent = section.title;
    card.appendChild(h);
    section.items.forEach((item) => {
      const row = document.createElement('div');
      row.className = 'section-row';
      const label = document.createElement('div');
      label.className = 'label';
      label.textContent = item.label;
      const value = document.createElement('pre');
      value.className = 'value';
      value.textContent = item.value;
      row.appendChild(label);
      row.appendChild(value);
      card.appendChild(row);
    });
    root.appendChild(card);
  });
}

function tryParseJson(str) {
  try {
    return JSON.parse(str);
  } catch (_) {
    try {
      const unescaped = str.replace(/\\"/g, '"');
      return JSON.parse(unescaped);
    } catch (e) {
      return null;
    }
  }
}

function extractJsonFromStandard(std) {
  if (!std || typeof std !== 'object') return null;
  for (const val of Object.values(std)) {
    if (typeof val === 'string' && val.includes('{') && val.includes('}')) {
      const parsed = tryParseJson(val);
      if (parsed) return parsed;
    }
  }
  return null;
}

function pickMergedMeta(std, stealthString) {
  const candidates = [];
  if (std) {
    const innerJson = extractJsonFromStandard(std);
    if (innerJson) candidates.push(innerJson);
    candidates.push(std);
  }
  if (stealthString) {
    const parsedStealth = tryParseJson(stealthString);
    if (parsedStealth) candidates.push(parsedStealth);
  }
  return candidates.find(Boolean) || null;
}

function renderKeyExplorer(root, obj) {
  root.innerHTML = '';
  if (!obj) {
    root.textContent = '탐색 가능한 데이터가 없습니다.';
    return;
  }

  const tree = buildKeyTree(obj, { maxNodes: 2500, maxDepth: 12 });
  if (!tree) {
    root.textContent = '탐색 가능한 데이터가 없습니다.';
    return;
  }

  const layout = document.createElement('div');
  layout.className = 'key-explorer-layout';
  const treePane = document.createElement('div');
  treePane.className = 'key-tree';
  const detailPane = document.createElement('div');
  detailPane.className = 'key-detail';
  const tabsBar = document.createElement('div');
  tabsBar.className = 'key-tabs';
  const contents = document.createElement('div');
  contents.className = 'key-tab-contents';
  const emptyState = document.createElement('div');
  emptyState.className = 'key-empty';
  emptyState.textContent = '왼쪽에서 항목을 선택하면 상세 탭이 열립니다.';

  detailPane.appendChild(tabsBar);
  detailPane.appendChild(contents);
  detailPane.appendChild(emptyState);
  layout.appendChild(treePane);
  layout.appendChild(detailPane);
  root.appendChild(layout);

  const openTabs = new Map();
  let activeId = null;

  function setActive(id) {
    activeId = id;
    openTabs.forEach((tab, key) => {
      tab.btn.classList.toggle('active', key === id);
      tab.content.classList.toggle('active', key === id);
    });
    emptyState.style.display = openTabs.size > 0 ? 'none' : 'block';
  }

  function closeTab(id) {
    const tab = openTabs.get(id);
    if (!tab) return;
    tab.tab.remove();
    tab.content.remove();
    openTabs.delete(id);
    if (activeId === id) {
      const next = openTabs.keys().next().value;
      if (next) setActive(next);
      else emptyState.style.display = 'block';
    }
  }

  function openTab(node) {
    const id = node.path || '(root)';
    if (!openTabs.has(id)) {
      const tab = document.createElement('div');
      tab.className = 'key-tab';
      const btn = document.createElement('button');
      btn.className = 'key-tab-btn';
      btn.textContent = id;
      const close = document.createElement('button');
      close.className = 'key-tab-close';
      close.textContent = 'x';
      tab.appendChild(btn);
      tab.appendChild(close);
      tabsBar.appendChild(tab);

      const content = document.createElement('div');
      content.className = 'key-tab-content';
      content.dataset.tabId = id;
      content.appendChild(buildDetail(node));
      contents.appendChild(content);

      btn.addEventListener('click', () => setActive(id));
      close.addEventListener('click', (e) => {
        e.stopPropagation();
        closeTab(id);
      });

      openTabs.set(id, { tab, btn, close, content });
    }
    setActive(id);
  }

  function buildDetail(node) {
    const wrap = document.createElement('div');
    wrap.className = 'key-detail-body';
    const metaTable = document.createElement('table');
    metaTable.className = 'key-detail-table';
    metaTable.appendChild(makeDetailRow('Path', node.path));
    metaTable.appendChild(makeDetailRow('Type', node.type));
    metaTable.appendChild(makeDetailRow('Sample', node.sample));

    const value = formatValue(node.value);
    if (value !== '') {
      metaTable.appendChild(makeDetailRow('Value', value, true));
    }

    wrap.appendChild(metaTable);

    if (node.children && node.children.length > 0) {
      const childrenTable = document.createElement('table');
      childrenTable.className = 'key-children-table';
      const head = document.createElement('tr');
      ['Key', 'Type', 'Sample'].forEach((h) => {
        const th = document.createElement('th');
        th.textContent = h;
        head.appendChild(th);
      });
      const thead = document.createElement('thead');
      thead.appendChild(head);
      childrenTable.appendChild(thead);

      const tbody = document.createElement('tbody');
      node.children.forEach((child) => {
        const tr = document.createElement('tr');
        tr.className = 'key-child-row';
        const tdKey = document.createElement('td');
        tdKey.textContent = child.key;
        const tdType = document.createElement('td');
        tdType.textContent = child.type;
        const tdSample = document.createElement('td');
        tdSample.textContent = child.sample;
        tr.appendChild(tdKey);
        tr.appendChild(tdType);
        tr.appendChild(tdSample);
        tr.addEventListener('click', () => openTab(child));
        tbody.appendChild(tr);
      });
      childrenTable.appendChild(tbody);
      wrap.appendChild(childrenTable);
    }

    return wrap;
  }

  function makeDetailRow(label, value, isPre = false) {
    const tr = document.createElement('tr');
    const th = document.createElement('th');
    th.textContent = label;
    const td = document.createElement('td');
    if (isPre) {
      const pre = document.createElement('pre');
      pre.textContent = value;
      td.appendChild(pre);
    } else {
      td.textContent = value;
    }
    tr.appendChild(th);
    tr.appendChild(td);
    return tr;
  }

  function formatValue(value) {
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';
    if (typeof value === 'string') return value;
    if (typeof value === 'object') {
      try {
        return JSON.stringify(value, null, 2);
      } catch (_) {
        return String(value);
      }
    }
    return String(value);
  }

  function renderNode(node, parent) {
    if (!node) return;
    const hasChildren = node.children && node.children.length > 0;
    if (hasChildren) {
      const details = document.createElement('details');
      details.className = 'key-node';
      if (node.path === '(root)') details.open = true;
      const summary = document.createElement('summary');
      summary.textContent = `${node.key} (${node.type})`;
      summary.addEventListener('click', () => openTab(node));
      details.appendChild(summary);
      const childWrap = document.createElement('div');
      childWrap.className = 'key-children';
      node.children.forEach((child) => renderNode(child, childWrap));
      details.appendChild(childWrap);
      parent.appendChild(details);
      return;
    }
    const item = document.createElement('div');
    item.className = 'key-leaf';
    item.textContent = `${node.key} (${node.type})`;
    item.addEventListener('click', () => openTab(node));
    parent.appendChild(item);
  }

  renderNode(tree, treePane);
}

function renderMiniMeta(meta, sampleEl, sizeEl) {
  const empty = '데이터 없음';
  if (!meta) {
    sampleEl.innerHTML = empty;
    sizeEl.innerHTML = empty;
    return;
  }
  sampleEl.innerHTML = '';
  sizeEl.innerHTML = '';

  const sampleItems = [
    ['Sampler', meta.sampler ?? ''],
    ['Noise Schedule', meta.noise_schedule ?? ''],
    ['Steps', meta.steps ?? ''],
    ['CFG/Scale', meta.cfg_scale ?? ''],
    ['CFG Rescale', meta.cfg_rescale ?? ''],
    ['Request Type', meta.request_type ?? ''],
  ];
  const sizeItems = [
    ['Width', meta.width ?? ''],
    ['Height', meta.height ?? ''],
    ['Seed', meta.seed ?? ''],
    ['n_samples', meta.n_samples ?? ''],
  ];
  sampleItems.forEach(([k, v]) => sampleEl.appendChild(makeMiniRow(k, v)));
  sizeItems.forEach(([k, v]) => sizeEl.appendChild(makeMiniRow(k, v)));
}

function makeMiniRow(label, value) {
  const row = document.createElement('div');
  row.className = 'mini-row';
  const k = document.createElement('div');
  k.className = 'mini-label';
  k.textContent = label;
  const v = document.createElement('div');
  v.className = 'mini-value';
  v.textContent = value ?? '';
  row.appendChild(k);
  row.appendChild(v);
  return row;
}
