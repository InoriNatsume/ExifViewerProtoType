// UI 엔트리: DOM 바인딩과 core 호출만 담당
import { parseStandardExif } from '../core/extract/standard-exif.js';
import { parseStealthExif } from '../core/extract/stealth-exif.js';
import { normalizeMetadata } from '../core/parse/normalize.js';
import { buildSections } from '../core/format/view-model.js';
import { prettyJson } from '../core/format/pretty-json.js';
import { saveJson } from '../features/download/save-json.js';
import { extractKeyPaths } from '../core/format/key-explorer.js';

// 간단한 초기화 함수 (image_tool.html에서 호출)
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
  const badgeVendor = document.getElementById('badge-vendor');
  const btnSave = document.getElementById('btn-save-json');
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
  let currentSource = 'standard'; // 'standard' | 'stealth'

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

  fileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    preview.src = url;
    preview.style.display = 'block';
    fileMeta.textContent = `파일: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`;

    // 캔버스 준비
    const img = new Image();
    img.onload = async () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, img.width, img.height);

      badgeStd.textContent = '로딩 중...';
      badgeStealth.textContent = '로딩 중...';

      // 표준 EXIF
      const std = await parseStandardExif(file);
      currentData.standardObj = std;
      badgeStd.textContent = std ? '표준 EXIF OK' : '표준 없음';

      // 스텔스 EXIF
      const stealthStr = await parseStealthExif(imageData);
      const stealthObj = stealthStr ? tryParseJson(stealthStr) : null;
      currentData.stealthObj = stealthObj;
      badgeStealth.textContent = stealthObj ? '스텔스 OK' : '스텔스 없음';

      // 기본 소스 선택 (NovelAI가 보이면 스텔스 우선)
      const hasNAIstealth = isNovelAI(stealthObj);
      const hasNAIstandard = isNovelAI(std);
      if (hasNAIstealth) currentSource = 'stealth';
      else if (currentData.standardObj) currentSource = 'standard';
      else if (currentData.stealthObj) currentSource = 'stealth';
      else if (hasNAIstandard) currentSource = 'standard';
      markSourceButtons();
      renderAll();
    };
    img.src = url;
  });
}

function renderSections(root, meta) {
  root.innerHTML = '';
  if (!meta) {
    root.textContent = '정규화된 데이터 없음';
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
    // 이스케이프된 문자열을 한 번 더 풀어보기
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
  // 값 중 JSON string 추정치를 탐색 (Comment, Description 등)
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
    root.textContent = '탐색 가능한 데이터 없음';
    return;
  }
  const paths = extractKeyPaths(obj);
  const table = document.createElement('table');
  table.className = 'key-table';
  const thead = document.createElement('thead');
  const hr = document.createElement('tr');
  ['Path', 'Type', 'Sample'].forEach((h) => {
    const th = document.createElement('th');
    th.textContent = h;
    hr.appendChild(th);
  });
  thead.appendChild(hr);
  table.appendChild(thead);
  const tbody = document.createElement('tbody');
  paths.forEach((p) => {
    const tr = document.createElement('tr');
    const tdPath = document.createElement('td');
    tdPath.textContent = p.path;
    const tdType = document.createElement('td');
    tdType.textContent = p.type;
    const tdSample = document.createElement('td');
    tdSample.textContent = p.sample;
    tr.appendChild(tdPath);
    tr.appendChild(tdType);
    tr.appendChild(tdSample);
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  root.appendChild(table);
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
