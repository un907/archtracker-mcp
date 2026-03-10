import type { DependencyGraph, LayerMetadata } from "../types/schema.js";
import type { ArchDiff } from "../types/schema.js";
import type { Locale } from "../i18n/index.js";
import type { CrossLayerConnection } from "../types/layers.js";
import { buildStyles } from "./styles.js";
import { buildViewerHtml } from "./viewer-html.js";
import { buildHierarchyJs } from "./js-hierarchy.js";
import { buildDiffJs } from "./js-diff.js";
import { ESC_FUNCTION_JS } from "../utils/html-escape.js";

export interface ViewerOptions {
  locale?: Locale;
  diff?: ArchDiff | null;
  layerMetadata?: LayerMetadata[];
  crossLayerEdges?: CrossLayerConnection[];
}

/**
 * Build the complete HTML page for the interactive graph viewer.
 * Two views: Force-directed Graph + Hierarchical Diagram (draw.io style).
 */
export function buildGraphPage(graph: DependencyGraph, options: ViewerOptions = {}): string {
  const locale = options.locale ?? "en";
  const diff = options.diff ?? null;
  const layers = options.layerMetadata ?? null;
  const crossEdges = options.crossLayerEdges ?? null;
  const files = Object.values(graph.files);
  const nodes = files.map((f) => ({
    id: f.path,
    deps: f.dependencies.length,
    dependents: f.dependents.length,
    dependencies: f.dependencies,
    dependentsList: f.dependents,
    isOrphan: f.dependencies.length === 0 && f.dependents.length === 0,
    dir: f.path.includes("/") ? f.path.substring(0, f.path.lastIndexOf("/")) : ".",
    layer: layers && f.path.includes("/") ? f.path.substring(0, f.path.indexOf("/")) : null,
  }));

  const links = graph.edges.map((e) => ({
    source: e.source,
    target: e.target,
    type: e.type,
  }));

  const circularFiles = new Set<string>();
  for (const c of graph.circularDependencies) {
    for (const f of c.cycle) circularFiles.add(f);
  }

  const dirs = [...new Set(nodes.map((n) => n.dir))].sort();
  const projectName = graph.rootDir.split("/").filter(Boolean).pop() || "Project";
  const diffData = diff ? JSON.stringify(diff) : "null";
  const layersData = layers ? JSON.stringify(layers) : "null";
  const crossEdgesData = crossEdges ? JSON.stringify(crossEdges) : "null";
  const graphData = JSON.stringify({ nodes, links, circularFiles: [...circularFiles], dirs, projectName });

  return /* html */ `<!DOCTYPE html>
<html lang="${locale}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${projectName} — Architecture Viewer</title>
${buildStyles()}
</head>
<body>
${buildViewerHtml()}
<script src="https://d3js.org/d3.v7.min.js"></script>
<script>
// ═══════════════════════════════════════════════
// i18n
// ═══════════════════════════════════════════════
const I18N = {
  en: {
    'tab.graph': 'Graph', 'tab.hierarchy': 'Hierarchy',
    'stats.files': 'Files', 'stats.edges': 'Edges', 'stats.circular': 'Circular',
    'settings.title': 'Settings', 'settings.theme': 'Theme', 'settings.fontSize': 'Font Size',
    'settings.nodeSize': 'Node Size', 'settings.linkOpacity': 'Link Opacity', 'settings.gravity': 'Gravity', 'settings.language': 'Language', 'settings.export': 'Export',
    'impact.title': 'Impact Simulation', 'impact.btn': 'Impact', 'impact.transitive': 'files affected',
    'search.placeholder': 'Search files...',
    'legend.circular': 'Circular dep', 'legend.orphan': 'Orphan', 'legend.highCoupling': 'High coupling',
    'legend.imports': 'imports', 'legend.importedBy': 'imported by',
    'detail.importedBy': 'Imported by', 'detail.imports': 'Imports',
    'detail.none': 'none', 'detail.dir': 'Dir', 'detail.dependencies': 'Dependencies', 'detail.dependents': 'Dependents',
    'tooltip.imports': 'imports', 'tooltip.importedBy': 'imported by',
    'help.graph': 'Scroll: zoom · Drag: pan · Click: select · / search',
    'help.hierarchy': 'Scroll to navigate · Click to highlight',
    'help.diff': 'Green=added · Red=removed · Yellow=modified · Blue=affected',
    'tab.diff': 'Diff',
    'diff.addedLabel': 'Added', 'diff.removedLabel': 'Removed', 'diff.modifiedLabel': 'Modified', 'diff.affectedLabel': 'Affected',
    'diff.showAll': 'Show all', 'diff.focusChanges': 'Focus changes', 'diff.noImpact': 'No downstream impact',
    'diff.affectedByChange': 'Affected by this change',
  },
  ja: {
    'tab.graph': 'グラフ', 'tab.hierarchy': '階層図',
    'stats.files': 'ファイル', 'stats.edges': 'エッジ', 'stats.circular': '循環参照',
    'settings.title': '設定', 'settings.theme': 'テーマ', 'settings.fontSize': 'フォントサイズ',
    'settings.nodeSize': 'ノードサイズ', 'settings.linkOpacity': 'リンク透明度', 'settings.gravity': '重力', 'settings.language': '言語', 'settings.export': 'エクスポート',
    'impact.title': '影響範囲シミュレーション', 'impact.btn': '影響', 'impact.transitive': 'ファイルに影響',
    'search.placeholder': 'ファイル検索...',
    'legend.circular': '循環参照', 'legend.orphan': '孤立', 'legend.highCoupling': '高結合',
    'legend.imports': 'import先', 'legend.importedBy': 'import元',
    'detail.importedBy': 'import元', 'detail.imports': 'import先',
    'detail.none': 'なし', 'detail.dir': 'ディレクトリ', 'detail.dependencies': '依存先', 'detail.dependents': '被依存',
    'tooltip.imports': 'import先', 'tooltip.importedBy': 'import元',
    'help.graph': 'スクロール: ズーム · ドラッグ: 移動 · クリック: 選択 · / 検索',
    'help.hierarchy': 'スクロールで移動 · クリックでハイライト',
    'help.diff': '緑=追加 · 赤=削除 · 黄=変更 · 青=影響',
    'tab.diff': '差分',
    'diff.addedLabel': '追加', 'diff.removedLabel': '削除', 'diff.modifiedLabel': '変更', 'diff.affectedLabel': '影響',
    'diff.showAll': '全表示', 'diff.focusChanges': '変更のみ表示', 'diff.noImpact': '下流への影響なし',
    'diff.affectedByChange': 'この変更の影響範囲',
  }
};
let currentLang = '${locale}';
function applyI18n() {
  const msgs = I18N[currentLang] || I18N.en;
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (msgs[key]) el.textContent = msgs[key];
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder');
    if (msgs[key]) el.placeholder = msgs[key];
  });
  document.querySelectorAll('.lang-btn').forEach(b => b.classList.toggle('active', b.dataset.lang === currentLang));
}
window.setLang = (lang) => { currentLang = lang; applyI18n(); saveSettings(); };
function i(key) { return (I18N[currentLang] || I18N.en)[key] || key; }
${ESC_FUNCTION_JS}

// ═══════════════════════════════════════════════
// SETTINGS (persisted to localStorage)
// ═══════════════════════════════════════════════
const STORAGE_KEY = 'archtracker-settings';
function saveSettings() {
  const s = { theme: document.body.getAttribute('data-theme') || 'dark', fontSize: document.getElementById('font-size-val').textContent, nodeSize: document.getElementById('node-size-val').textContent, linkOpacity: document.getElementById('link-opacity-val').textContent, gravity: document.getElementById('gravity-val').textContent, layerGravity: document.getElementById('layer-gravity-val').textContent, lang: currentLang, projectTitle: document.getElementById('project-title').textContent };
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch(e) {}
}
function loadSettings() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || null; } catch(e) { return null; }
}

let nodeScale = 1, baseLinkOpacity = 0.4;
window.toggleSettings = () => document.getElementById('settings-panel').classList.toggle('open');
window.setTheme = (theme) => {
  document.body.setAttribute('data-theme', theme === 'light' ? 'light' : '');
  document.querySelectorAll('.theme-btn[data-theme-val]').forEach(b => b.classList.toggle('active', b.dataset.themeVal === theme));
  saveSettings();
};
window.setFontSize = (v) => {
  document.getElementById('font-size-val').textContent = v;
  const scale = v / 13;
  if (typeof node !== 'undefined') {
    node.select('text').attr('font-size', d => (d.dependents>=3?12:10) * scale);
  }
  saveSettings();
};
window.setNodeScale = (v) => {
  nodeScale = v / 100;
  document.getElementById('node-size-val').textContent = v;
  if (typeof node !== 'undefined') {
    node.select('circle').attr('r', d => nodeRadius(d) * nodeScale);
    node.select('text').attr('dx', d => nodeRadius(d) * nodeScale + 4);
    simulation.force('collision', d3.forceCollide().radius(d => nodeRadius(d) * nodeScale + 4));
    simulation.alpha(0.3).restart();
  }
  saveSettings();
};
window.setLinkOpacity = (v) => {
  baseLinkOpacity = v / 100;
  document.getElementById('link-opacity-val').textContent = v;
  if (typeof link !== 'undefined') link.attr('opacity', baseLinkOpacity);
  saveSettings();
};
let gravityStrength = 150;
window.setGravity = (v) => {
  gravityStrength = +v;
  document.getElementById('gravity-val').textContent = v;
  if (typeof simulation !== 'undefined') {
    if (typeof updateLayerPhysics === 'function') {
      updateLayerPhysics();
    } else {
      simulation.force('charge', d3.forceManyBody().strength(-gravityStrength).distanceMax(500));
    }
    simulation.alpha(0.5).restart();
  }
  saveSettings();
};
let layerGravity = 12;
window.setLayerGravity = (v) => {
  layerGravity = +v;
  document.getElementById('layer-gravity-val').textContent = v;
  if (typeof simulation !== 'undefined' && typeof updateLayerPhysics === 'function') {
    updateLayerPhysics();
    simulation.alpha(0.5).restart();
  }
  saveSettings();
};

// ═══════════════════════════════════════════════
// EXPORT
// ═══════════════════════════════════════════════
window.exportSVG = () => {
  const activeView = document.querySelector('.view.active svg');
  if (!activeView) return;
  const clone = activeView.cloneNode(true);
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  const blob = new Blob([clone.outerHTML], {type: 'image/svg+xml'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = (document.getElementById('project-title').textContent || 'graph') + '.svg';
  a.click(); URL.revokeObjectURL(a.href);
};
window.exportPNG = () => {
  const activeView = document.querySelector('.view.active svg');
  if (!activeView) return;
  const clone = activeView.cloneNode(true);
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  const svgStr = new XMLSerializer().serializeToString(clone);
  const canvas = document.createElement('canvas');
  const bbox = activeView.getBoundingClientRect();
  canvas.width = bbox.width * 2; canvas.height = bbox.height * 2;
  const ctx = canvas.getContext('2d');
  ctx.scale(2, 2);
  const img = new Image();
  img.onload = () => { ctx.drawImage(img, 0, 0); const a = document.createElement('a'); a.href = canvas.toDataURL('image/png'); a.download = (document.getElementById('project-title').textContent || 'graph') + '.png'; a.click(); };
  img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgStr)));
};

// ═══════════════════════════════════════════════
// DATA
// ═══════════════════════════════════════════════
const DATA = ${graphData};
const LAYERS = ${layersData};
const CROSS_EDGES = ${crossEdgesData};
const W = window.innerWidth, H = window.innerHeight - 44;
const circularSet = new Set(DATA.circularFiles);

// Project title (editable)
const titleEl = document.getElementById('project-title');
titleEl.textContent = DATA.projectName;
titleEl.addEventListener('blur', () => { if (!titleEl.textContent.trim()) titleEl.textContent = DATA.projectName; document.title = titleEl.textContent + ' \u2014 Architecture Viewer'; saveSettings(); });
titleEl.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); titleEl.blur(); } });

// Restore saved settings — phase 1: non-graph settings (before graph init)
const _savedSettings = loadSettings();
if (_savedSettings) {
  if (_savedSettings.theme) setTheme(_savedSettings.theme);
  if (_savedSettings.lang) { currentLang = _savedSettings.lang; applyI18n(); }
  if (_savedSettings.projectTitle) { titleEl.textContent = _savedSettings.projectTitle; document.title = _savedSettings.projectTitle + ' \u2014 Architecture Viewer'; }
  // Set slider positions (visual only — graph not built yet)
  if (_savedSettings.fontSize) { document.getElementById('font-size-slider').value = _savedSettings.fontSize; document.getElementById('font-size-val').textContent = _savedSettings.fontSize; }
  if (_savedSettings.nodeSize) { document.getElementById('node-size-slider').value = _savedSettings.nodeSize; document.getElementById('node-size-val').textContent = _savedSettings.nodeSize; nodeScale = _savedSettings.nodeSize / 100; }
  if (_savedSettings.linkOpacity) { document.getElementById('link-opacity-slider').value = _savedSettings.linkOpacity; document.getElementById('link-opacity-val').textContent = _savedSettings.linkOpacity; baseLinkOpacity = _savedSettings.linkOpacity / 100; }
  if (_savedSettings.gravity) { document.getElementById('gravity-slider').value = _savedSettings.gravity; document.getElementById('gravity-val').textContent = _savedSettings.gravity; gravityStrength = +_savedSettings.gravity; }
  if (_savedSettings.layerGravity) { document.getElementById('layer-gravity-slider').value = _savedSettings.layerGravity; document.getElementById('layer-gravity-val').textContent = _savedSettings.layerGravity; layerGravity = +_savedSettings.layerGravity; }
}

document.getElementById('s-files').textContent = DATA.nodes.length;
document.getElementById('s-edges').textContent = DATA.links.length;
document.getElementById('s-circular').textContent = DATA.circularFiles.length;

const dirColor = d3.scaleOrdinal()
  .domain(DATA.dirs)
  .range(['#58a6ff','#3fb950','#d2a8ff','#f0883e','#79c0ff','#56d4dd','#db61a2','#f778ba','#ffa657','#7ee787']);

// Layer color map (from LAYERS metadata)
const layerColorMap = {};
let activeLayerFilter = null; // DEPRECATED — kept for backward compat, always null with multi-select tabs
const activeLayers = new Set(); // empty = no filter (show all); non-empty = show only selected
if (LAYERS) {
  LAYERS.forEach(l => { layerColorMap[l.name] = l.color; });
  document.getElementById('layer-gravity-setting').style.display = '';
}

function nodeColor(d) {
  if (circularSet.has(d.id)) return '#f97583';
  if (d.isOrphan) return '#484f58';
  // Layer coloring: all-visible or multi-select → layer colors; single-select → dir colors
  if (LAYERS && d.layer && layerColorMap[d.layer] && activeLayers.size !== 1) return layerColorMap[d.layer];
  return dirColor(d.dir);
}
function nodeRadius(d) { return Math.max(5, Math.min(22, 4 + d.dependents * 1.8)); }
function fileName(id) { return id.split('/').pop(); }

// ═══════════════════════════════════════════════
// TAB SWITCHING
// ═══════════════════════════════════════════════
let hierBuilt = false;
let diffBuilt = false;
let hierRelayout = null;
let hierSyncFromTab = null;
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById(tab.dataset.view).classList.add('active');
    if (tab.dataset.view === 'hier-view') {
      if (!hierBuilt) { buildHierarchy(); hierBuilt = true; }
      if (hierSyncFromTab) { hierSyncFromTab(); hierRelayout(); }
    }
    if (tab.dataset.view === 'diff-view') {
      if (!diffBuilt) { buildDiffView(); diffBuilt = true; }
    }
  });
});

// ═══════════════════════════════════════════════
// TOOLTIP — delayed hide + interactive
// ═══════════════════════════════════════════════
const tooltip = document.getElementById('tooltip');
let tooltipHideTimer = null;
let tooltipLocked = false;

function showTooltip(e, d) {
  clearTimeout(tooltipHideTimer);
  document.getElementById('tt-name').textContent = d.id;
  document.getElementById('tt-dep-count').textContent = d.deps;
  document.getElementById('tt-dpt-count').textContent = d.dependents;
  const out = (d.dependencies||[]).map(x => '<div class="tt-out">→ '+esc(x)+'</div>');
  const inc = (d.dependentsList||[]).map(x => '<div class="tt-in">← '+esc(x)+'</div>');
  document.getElementById('tt-details').innerHTML = [...out, ...inc].join('');
  tooltip.style.display = 'block';
  positionTooltip(e);
}
function positionTooltip(e) {
  const gap = 24;
  const tw = 420, th = tooltip.offsetHeight || 200;
  // Prefer placing to the right and above the cursor so it doesn't cover nodes below
  let x = e.clientX + gap;
  let y = e.clientY - th - 12;
  // If no room on the right, flip left
  if (x + tw > window.innerWidth) x = e.clientX - tw - gap;
  // If no room above, place below the cursor with gap
  if (y < 50) y = e.clientY + gap;
  // Final clamp
  if (y + th > window.innerHeight) y = window.innerHeight - th - 8;
  if (x < 8) x = 8;
  tooltip.style.left = x + 'px';
  tooltip.style.top = y + 'px';
}
function scheduleHideTooltip() {
  clearTimeout(tooltipHideTimer);
  tooltipHideTimer = setTimeout(() => {
    if (!tooltipLocked) {
      tooltip.style.display = 'none';
      if (!pinnedNode) resetGraphHighlight();
    }
  }, 250);
}

// Keep tooltip visible when mouse enters it
tooltip.addEventListener('mouseenter', () => {
  clearTimeout(tooltipHideTimer);
  tooltipLocked = true;
});
tooltip.addEventListener('mouseleave', () => {
  tooltipLocked = false;
  scheduleHideTooltip();
});

// ═══════════════════════════════════════════════
// GRAPH VIEW
// ═══════════════════════════════════════════════
const svg = d3.select('#graph-svg').attr('width', W).attr('height', H);
const g = svg.append('g');
const zoom = d3.zoom().scaleExtent([0.05, 10]).on('zoom', e => g.attr('transform', e.transform));
svg.call(zoom);
svg.call(zoom.transform, d3.zoomIdentity.translate(W/2, H/2).scale(0.7));

window.zoomIn = () => svg.transition().duration(300).call(zoom.scaleBy, 1.4);
window.zoomOut = () => svg.transition().duration(300).call(zoom.scaleBy, 0.7);
window.zoomFit = () => {
  const b = g.node().getBBox(); if (!b.width) return;
  const s = Math.min(W/(b.width+80), H/(b.height+80))*0.9;
  svg.transition().duration(500).call(zoom.transform, d3.zoomIdentity.translate(W/2-(b.x+b.width/2)*s, H/2-(b.y+b.height/2)*s).scale(s));
};

// Defs
const defs = svg.append('defs');
['#30363d','#58a6ff','#3fb950'].forEach((c,i) => {
  defs.append('marker').attr('id','arrow-'+i).attr('viewBox','0 -4 8 8')
    .attr('refX',8).attr('refY',0).attr('markerWidth',7).attr('markerHeight',7).attr('orient','auto')
    .append('path').attr('d','M0,-3.5L8,0L0,3.5Z').attr('fill',c);
});

// Links
const link = g.append('g').selectAll('line').data(DATA.links).join('line')
  .attr('stroke', d => d.type==='type-only'?'#1f3d5c':'#30363d')
  .attr('stroke-width',1)
  .attr('stroke-dasharray', d => d.type==='type-only'?'4,3':d.type==='dynamic'?'6,3':null)
  .attr('marker-end','url(#arrow-0)')
  .attr('opacity', baseLinkOpacity);

// Cross-layer links (from layers.json connections)
defs.append('marker').attr('id','arrow-cross').attr('viewBox','0 -4 8 8')
  .attr('refX',8).attr('refY',0).attr('markerWidth',7).attr('markerHeight',7).attr('orient','auto')
  .append('path').attr('d','M0,-3.5L8,0L0,3.5Z').attr('fill','#f0883e');

const crossLinkData = (CROSS_EDGES || []).map(e => ({
  source: e.fromLayer + '/' + e.fromFile,
  target: e.toLayer + '/' + e.toFile,
  sourceLayer: e.fromLayer,
  targetLayer: e.toLayer,
  type: e.type || 'api-call',
  label: e.label || e.type || '',
})).filter(e => DATA.nodes.some(n => n.id === e.source) && DATA.nodes.some(n => n.id === e.target));

const crossLinkG = g.append('g');
const crossLink = crossLinkG.selectAll('line').data(crossLinkData).join('line')
  .attr('stroke', '#f0883e')
  .attr('stroke-width', 2)
  .attr('stroke-dasharray', '8,4')
  .attr('marker-end', 'url(#arrow-cross)')
  .attr('opacity', 0.7);
const crossLabel = crossLinkG.selectAll('text').data(crossLinkData).join('text')
  .text(d => d.label)
  .attr('font-size', 9)
  .attr('fill', '#f0883e')
  .attr('text-anchor', 'middle')
  .attr('opacity', 0.8)
  .attr('pointer-events', 'none');

// Nodes
const node = g.append('g').selectAll('g').data(DATA.nodes).join('g')
  .attr('cursor','pointer')
  .call(d3.drag().on('start',dragStart).on('drag',dragging).on('end',dragEnd));

node.append('circle')
  .attr('r', d => nodeRadius(d) * nodeScale)
  .attr('fill', nodeColor)
  .attr('stroke', d => d.deps>=5?'var(--yellow)':nodeColor(d))
  .attr('stroke-width', d => d.deps>=5?2.5:1.5)
  .attr('stroke-opacity', d => d.deps>=5?0.8:0.3);

node.append('text')
  .text(d => fileName(d.id).replace(/\\.tsx?$/,''))
  .attr('dx', d => nodeRadius(d)*nodeScale+4)
  .attr('dy',3.5)
  .attr('font-size', d => d.dependents>=3?12:10)
  .attr('font-weight', d => d.dependents>=3?600:400)
  .attr('fill', d => d.dependents>=3?'var(--text)':'var(--text-dim)')
  .attr('opacity', d => d.dependents>=1||d.deps>=3?1:0.5)
  .attr('pointer-events','none');

// Simulation
const simulation = d3.forceSimulation(DATA.nodes)
  .force('link', d3.forceLink(DATA.links).id(d=>d.id).distance(70).strength(0.25))
  .force('charge', d3.forceManyBody().strength(-gravityStrength).distanceMax(500))
  .force('center', d3.forceCenter(0,0))
  .force('collision', d3.forceCollide().radius(d=>nodeRadius(d)*nodeScale+4))
  .force('x', d3.forceX(0).strength(0.03))
  .force('y', d3.forceY(0).strength(0.03))
  .on('tick', () => {
    link.each(function(d) {
      const dx=d.target.x-d.source.x, dy=d.target.y-d.source.y;
      const dist=Math.sqrt(dx*dx+dy*dy)||1;
      const rT=nodeRadius(d.target)*nodeScale, rS=nodeRadius(d.source)*nodeScale;
      d3.select(this)
        .attr('x1',d.source.x+(dx/dist)*rS).attr('y1',d.source.y+(dy/dist)*rS)
        .attr('x2',d.target.x-(dx/dist)*rT).attr('y2',d.target.y-(dy/dist)*rT);
    });
    node.attr('transform', d=>\`translate(\${d.x},\${d.y})\`);
  });

// ─── Layer convex hulls ─────────────────────
let hullGroup = null;
const activeDirs = new Set(DATA.dirs);
const dirCounts = {};
DATA.nodes.forEach(n => dirCounts[n.dir] = (dirCounts[n.dir] || 0) + 1);
var applyLayerFilter = null; // hoisted for dir-filter integration
var updateLayerPhysics = null; // hoisted — updates charge/layer forces without visibility changes

if (LAYERS && LAYERS.length > 0) {
  // ─── Water droplet physics: intra-layer cohesion + inter-layer separation ───
  const allLayerCount = LAYERS.length;
  const allBaseRadius = Math.max(60, Math.min(W, H) * 0.04 * Math.sqrt(allLayerCount));
  // Pre-compute full-circle positions for all layers (used when no filter)
  const allLayerCenters = {};
  LAYERS.forEach((l, idx) => {
    const angle = (2 * Math.PI * idx) / allLayerCount - Math.PI / 2;
    allLayerCenters[l.name] = { x: Math.cos(angle) * allBaseRadius, y: Math.sin(angle) * allBaseRadius };
  });

  // Dynamic center calculation: compact when multi-selecting, full spread when all
  function getLayerCenters() {
    if (activeLayers.size <= 1) return allLayerCenters; // 0 = all, 1 = single (centered)
    // Multi-select: arrange only selected layers compactly on a smaller circle
    const selected = LAYERS.filter(l => activeLayers.has(l.name));
    const count = selected.length;
    const compactRadius = Math.max(40, Math.min(W, H) * 0.03 * Math.sqrt(count));
    const centers = {};
    selected.forEach((l, idx) => {
      const angle = (2 * Math.PI * idx) / count - Math.PI / 2;
      centers[l.name] = { x: Math.cos(angle) * compactRadius, y: Math.sin(angle) * compactRadius };
    });
    return centers;
  }

  // Replace default centering forces with per-layer positioning
  const layerStrength = layerGravity / 100;
  simulation.force('x', null).force('y', null).force('center', null);
  simulation.force('layerX', d3.forceX(d => allLayerCenters[d.layer]?.x || 0).strength(d => d.layer ? layerStrength : 0.03));
  simulation.force('layerY', d3.forceY(d => allLayerCenters[d.layer]?.y || 0).strength(d => d.layer ? layerStrength : 0.03));

  // Custom clustering force — surface tension pulling nodes toward their layer centroid
  function clusterForce() {
    let nodes;
    function force(alpha) {
      const centroids = {};
      const counts = {};
      nodes.forEach(n => {
        if (!n.layer) return;
        if (!centroids[n.layer]) { centroids[n.layer] = {x: 0, y: 0}; counts[n.layer] = 0; }
        centroids[n.layer].x += n.x;
        centroids[n.layer].y += n.y;
        counts[n.layer]++;
      });
      Object.keys(centroids).forEach(k => {
        centroids[k].x /= counts[k];
        centroids[k].y /= counts[k];
      });
      // Pull each node toward its layer centroid (surface tension)
      const strength = 0.2;
      nodes.forEach(n => {
        if (!n.layer || !centroids[n.layer]) return;
        n.vx += (centroids[n.layer].x - n.x) * alpha * strength;
        n.vy += (centroids[n.layer].y - n.y) * alpha * strength;
      });
    }
    force.initialize = (n) => { nodes = n; };
    return force;
  }
  simulation.force('cluster', clusterForce());

  // Boost link strength for intra-layer edges (tighter connections within a layer)
  simulation.force('link').strength(l => {
    const sLayer = (l.source.layer ?? l.source);
    const tLayer = (l.target.layer ?? l.target);
    return sLayer === tLayer ? 0.4 : 0.1;
  });

  hullGroup = g.insert('g', ':first-child');

  function updateHulls() {
    if (!hullGroup) return;
    hullGroup.selectAll('*').remove();
    // Show hulls always (filter to selected layers when focused)

    LAYERS.forEach(layer => {
      if (activeLayers.size > 0 && !activeLayers.has(layer.name)) return;
      const layerNodes = DATA.nodes.filter(n => n.layer === layer.name);
      if (layerNodes.length === 0) return;

      const points = [];
      layerNodes.forEach(n => {
        if (n.x == null || n.y == null) return;
        const r = nodeRadius(n) * nodeScale + 30;
        // Add expanded points for a nicer hull shape
        for (let a = 0; a < Math.PI * 2; a += Math.PI / 4) {
          points.push([n.x + Math.cos(a) * r, n.y + Math.sin(a) * r]);
        }
      });

      if (points.length < 3) {
        // Fallback: circle for 1-2 nodes
        const cx = layerNodes.reduce((s, n) => s + (n.x || 0), 0) / layerNodes.length;
        const cy = layerNodes.reduce((s, n) => s + (n.y || 0), 0) / layerNodes.length;
        const maxR = Math.max(60, ...layerNodes.map(n => {
          const dx = (n.x || 0) - cx, dy = (n.y || 0) - cy;
          return Math.sqrt(dx*dx + dy*dy) + nodeRadius(n) * nodeScale + 30;
        }));
        hullGroup.append('circle')
          .attr('cx', cx).attr('cy', cy).attr('r', maxR)
          .attr('class', 'layer-hull')
          .attr('fill', layer.color).attr('stroke', layer.color);
        hullGroup.append('text')
          .attr('class', 'layer-hull-label')
          .attr('x', cx).attr('y', cy - maxR - 8)
          .attr('text-anchor', 'middle')
          .attr('fill', layer.color)
          .text(layer.name);
        return;
      }

      const hull = d3.polygonHull(points);
      if (!hull) return;

      // Smooth the hull with a cardinal closed curve
      hullGroup.append('path')
        .attr('class', 'layer-hull')
        .attr('d', d3.line().curve(d3.curveCatmullRomClosed.alpha(0.5))(hull))
        .attr('fill', layer.color).attr('stroke', layer.color);

      // Label at the top of the hull
      const topPt = hull.reduce((best, p) => p[1] < best[1] ? p : best, hull[0]);
      hullGroup.append('text')
        .attr('class', 'layer-hull-label')
        .attr('x', topPt[0]).attr('y', topPt[1] - 10)
        .attr('text-anchor', 'middle')
        .attr('fill', layer.color)
        .text(layer.name);
    });
  }

  // Update hulls + cross-layer links on each tick
  simulation.on('tick', () => {
    // Regular links
    link.each(function(d) {
      const dx=d.target.x-d.source.x, dy=d.target.y-d.source.y;
      const dist=Math.sqrt(dx*dx+dy*dy)||1;
      const rT=nodeRadius(d.target)*nodeScale, rS=nodeRadius(d.source)*nodeScale;
      d3.select(this)
        .attr('x1',d.source.x+(dx/dist)*rS).attr('y1',d.source.y+(dy/dist)*rS)
        .attr('x2',d.target.x-(dx/dist)*rT).attr('y2',d.target.y-(dy/dist)*rT);
    });
    node.attr('transform', d=>\`translate(\${d.x},\${d.y})\`);
    // Cross-layer links — resolve node positions by ID
    if (crossLinkData.length > 0) {
      const nodeById = {};
      DATA.nodes.forEach(n => { nodeById[n.id] = n; });
      crossLink.each(function(d) {
        const sN = nodeById[d.source], tN = nodeById[d.target];
        if (!sN || !tN) return;
        const dx = tN.x - sN.x, dy = tN.y - sN.y;
        const dist = Math.sqrt(dx*dx + dy*dy) || 1;
        const rS = nodeRadius(sN) * nodeScale, rT = nodeRadius(tN) * nodeScale;
        d3.select(this)
          .attr('x1', sN.x + (dx/dist)*rS).attr('y1', sN.y + (dy/dist)*rS)
          .attr('x2', tN.x - (dx/dist)*rT).attr('y2', tN.y - (dy/dist)*rT);
      });
      crossLabel.each(function(d) {
        const sN = nodeById[d.source], tN = nodeById[d.target];
        if (!sN || !tN) return;
        d3.select(this).attr('x', (sN.x + tN.x) / 2).attr('y', (sN.y + tN.y) / 2 - 6);
      });
    }
    updateHulls();
  });

  // ─── Layer legend ──────────────────────────
  const layerLegend = document.getElementById('layer-legend');
  LAYERS.forEach(layer => {
    const item = document.createElement('div');
    item.className = 'legend-item';
    item.innerHTML = '<div class="legend-dot" style="background:' + esc(layer.color) + '"></div> ' + esc(layer.name);
    layerLegend.appendChild(item);
  });
  // Cross-layer edge legend
  if (CROSS_EDGES && CROSS_EDGES.length > 0) {
    const crossItem = document.createElement('div');
    crossItem.className = 'legend-item';
    crossItem.innerHTML = '<span style="color:#f0883e;font-size:11px">- - →</span> Cross-layer link';
    layerLegend.appendChild(crossItem);
  }
  // Add separator
  const sep = document.createElement('hr');
  sep.style.cssText = 'border:none;border-top:1px solid var(--border);margin:6px 0;';
  layerLegend.appendChild(sep);

  // ─── Layer tabs (multi-select toggles in tab bar) ───────────────
  const layerTabsEl = document.getElementById('layer-tabs');
  const allTab = document.createElement('div');
  allTab.className = 'layer-tab active';
  allTab.textContent = 'All';
  allTab.onclick = () => {
    activeLayers.clear();
    syncLayerTabUI();
    applyLayerFilter();
    if (hierBuilt && hierSyncFromTab) { hierSyncFromTab(); hierRelayout(); }
  };
  layerTabsEl.appendChild(allTab);

  LAYERS.forEach(layer => {
    const tab = document.createElement('div');
    tab.className = 'layer-tab';
    tab.dataset.layer = layer.name;
    tab.innerHTML = '<div class="lt-dot" style="background:' + esc(layer.color) + '"></div>' + esc(layer.name);
    tab.onclick = (e) => {
      if (e.shiftKey) {
        // Shift+click: solo this layer
        activeLayers.clear();
        activeLayers.add(layer.name);
      } else {
        // Toggle
        if (activeLayers.has(layer.name)) activeLayers.delete(layer.name);
        else activeLayers.add(layer.name);
      }
      syncLayerTabUI();
      applyLayerFilter();
      if (hierBuilt && hierSyncFromTab) { hierSyncFromTab(); hierRelayout(); }
    };
    layerTabsEl.appendChild(tab);
  });

  function syncLayerTabUI() {
    allTab.classList.toggle('active', activeLayers.size === 0);
    layerTabsEl.querySelectorAll('.layer-tab[data-layer]').forEach(t => {
      t.classList.toggle('active', activeLayers.has(t.dataset.layer));
    });
    // Also sync the filter bar layer pills
    layerRowEl.querySelectorAll('.layer-pill[data-layer]').forEach(p => {
      p.classList.toggle('active', activeLayers.has(p.dataset.layer));
    });
  }

  applyLayerFilter = function() {
    const isSingleLayer = activeLayers.size === 1;
    const hasLayerFilter = activeLayers.size > 0;
    node.attr('display', d => {
      if (!activeDirs.has(d.dir)) return 'none';
      if (hasLayerFilter && !activeLayers.has(d.layer)) return 'none';
      return null;
    });
    link.attr('display', l => {
      const s = l.source.id ?? l.source, t = l.target.id ?? l.target;
      const sN = DATA.nodes.find(n => n.id === s), tN = DATA.nodes.find(n => n.id === t);
      if (!sN || !tN) return 'none';
      if (!activeDirs.has(sN.dir) || !activeDirs.has(tN.dir)) return 'none';
      if (hasLayerFilter && (!activeLayers.has(sN.layer) || !activeLayers.has(tN.layer))) return 'none';
      return null;
    });
    // Refresh node colors: single-layer = dir-based, multi-layer = layer-based
    node.select('circle')
      .attr('fill', nodeColor)
      .attr('stroke', d => d.deps >= 5 ? 'var(--yellow)' : nodeColor(d));
    // Cross-layer links: respect user toggle + layer filter
    if (typeof crossLink !== 'undefined') {
      if (!crossLinksUserEnabled || isSingleLayer) {
        crossLink.attr('display', 'none');
        crossLabel.attr('display', 'none');
      } else if (hasLayerFilter) {
        crossLink.attr('display', d => (activeLayers.has(d.sourceLayer) && activeLayers.has(d.targetLayer)) ? null : 'none');
        crossLabel.attr('display', d => (activeLayers.has(d.sourceLayer) && activeLayers.has(d.targetLayer)) ? null : 'none');
      } else {
        crossLink.attr('display', null);
        crossLabel.attr('display', null);
      }
    }
    // Update stats
    const visibleNodes = DATA.nodes.filter(d => {
      if (!activeDirs.has(d.dir)) return false;
      if (hasLayerFilter && !activeLayers.has(d.layer)) return false;
      return true;
    });
    const visibleIds = new Set(visibleNodes.map(n => n.id));
    const visibleEdges = DATA.links.filter(l => {
      const s = l.source.id ?? l.source, t = l.target.id ?? l.target;
      return visibleIds.has(s) && visibleIds.has(t);
    });
    document.getElementById('s-files').textContent = visibleNodes.length;
    document.getElementById('s-edges').textContent = visibleEdges.length;
    const visCirc = DATA.circularFiles.filter(f => visibleIds.has(f));
    document.getElementById('s-circular').textContent = visCirc.length;
    updateHulls();
    // Delegate physics update and zoom to fit
    updateLayerPhysics();
    simulation.alpha(0.6).restart();
    setTimeout(() => zoomFit(), 600);
  }

  // Separated physics update: handles charge/layer forces based on filter state.
  // Called by applyLayerFilter (with zoomFit), setGravity, setLayerGravity (without zoomFit).
  updateLayerPhysics = function() {
    const isSingleLayer = activeLayers.size === 1;
    const lStrength = layerGravity / 100;
    if (isSingleLayer) {
      simulation.force('charge', d3.forceManyBody().strength(-gravityStrength * 3).distanceMax(800));
      simulation.force('layerX', d3.forceX(0).strength(0.03));
      simulation.force('layerY', d3.forceY(0).strength(0.03));
    } else {
      const centers = getLayerCenters();
      simulation.force('charge', d3.forceManyBody().strength(-gravityStrength).distanceMax(500));
      simulation.force('layerX', d3.forceX(d => centers[d.layer]?.x || 0).strength(d => d.layer ? lStrength : 0.03));
      simulation.force('layerY', d3.forceY(d => centers[d.layer]?.y || 0).strength(d => d.layer ? lStrength : 0.03));
    }
  }

  // ─── Layer filter pills (new grouped bar) ────────────────────
  const layerRowEl = document.getElementById('filter-layer-row');
  const dirPanelEl = document.getElementById('filter-dir-panel');

  // Dir toggle button
  const dirToggle = document.createElement('div');
  dirToggle.id = 'filter-dir-toggle';
  dirToggle.textContent = '▸ Dirs';
  dirToggle.onclick = () => {
    dirToggle.classList.toggle('open');
    dirPanelEl.classList.toggle('open');
    dirToggle.textContent = dirPanelEl.classList.contains('open') ? '▾ Dirs' : '▸ Dirs';
  };
  layerRowEl.appendChild(dirToggle);

  // Cross-layer link toggle (in settings sidebar)
  let crossLinksUserEnabled = true;
  if (crossLinkData.length > 0) {
    document.getElementById('cross-layer-setting').style.display = '';
    window.toggleCrossLinks = () => {
      crossLinksUserEnabled = !crossLinksUserEnabled;
      const btn = document.getElementById('cross-link-toggle');
      btn.textContent = crossLinksUserEnabled ? 'ON' : 'OFF';
      btn.classList.toggle('active', crossLinksUserEnabled);
      applyLayerFilter();
    };
  }

  LAYERS.forEach(layer => {
    const layerNodes = DATA.nodes.filter(n => n.layer === layer.name);
    const pill = document.createElement('div');
    pill.className = 'layer-pill';
    pill.dataset.layer = layer.name;
    pill.innerHTML = '<div class="lp-dot" style="background:' + esc(layer.color) + '"></div>' + esc(layer.name) + ' <span class="lp-count">' + layerNodes.length + '</span>';
    pill.onclick = () => {
      if (activeLayers.has(layer.name)) activeLayers.delete(layer.name);
      else activeLayers.add(layer.name);
      syncLayerTabUI();
      applyLayerFilter();
    };
    pill.onmouseenter = () => {
      if (pinnedNode) return;
      node.select('circle').transition().duration(120).attr('opacity', d => d.layer === layer.name ? 1 : 0.1);
      node.select('text').transition().duration(120).attr('opacity', d => d.layer === layer.name ? 1 : 0.05);
    };
    pill.onmouseleave = () => {
      if (pinnedNode) return;
      node.select('circle').transition().duration(150).attr('opacity', 1);
      node.select('text').transition().duration(150).attr('opacity', d => d.dependents >= 1 || d.deps >= 3 ? 1 : 0.5);
    };
    layerRowEl.appendChild(pill);

    // Build dir group in panel for this layer
    const layerDirs = [...new Set(layerNodes.map(n => n.dir))].sort();
    if (layerDirs.length > 0) {
      const group = document.createElement('div');
      group.className = 'dir-group';
      const label = document.createElement('div');
      label.className = 'dir-group-label';
      label.innerHTML = '<div class="dg-dot" style="background:' + esc(layer.color) + '"></div>' + esc(layer.name);
      group.appendChild(label);
      const pillsWrap = document.createElement('div');
      pillsWrap.className = 'dir-group-pills';
      layerDirs.forEach(dir => {
        const dp = document.createElement('div');
        dp.className = 'filter-pill active';
        const shortDir = dir.includes('/') ? dir.substring(dir.indexOf('/') + 1) : dir;
        dp.innerHTML = '<div class="pill-dot" style="background:' + dirColor(dir) + '"></div>' + esc(shortDir || '.') + ' <span class="pill-count">' + (dirCounts[dir] || 0) + '</span>';
        dp.onclick = () => {
          if (activeDirs.has(dir)) { activeDirs.delete(dir); dp.classList.remove('active'); }
          else { activeDirs.add(dir); dp.classList.add('active'); }
          applyLayerFilter();
        };
        pillsWrap.appendChild(dp);
      });
      group.appendChild(pillsWrap);
      dirPanelEl.appendChild(group);
    }
  });

  // Override applyFilter to respect layers
  window._origApplyFilter = applyFilter;
}

setTimeout(()=>zoomFit(), 1500);

// Restore saved settings — phase 2: apply to graph elements now that they exist
if (_savedSettings) {
  if (_savedSettings.fontSize) setFontSize(_savedSettings.fontSize);
}

// ─── Highlight helper ─────────────────────────
let pinnedNode = null;

function highlightNode(d) {
  const conn = new Set([d.id]);
  DATA.links.forEach(l => { const s=l.source.id??l.source,t=l.target.id??l.target; if(s===d.id)conn.add(t); if(t===d.id)conn.add(s); });
  node.select('circle').transition().duration(150).attr('opacity',n=>conn.has(n.id)?1:0.1);
  node.select('text').transition().duration(150).attr('opacity',n=>conn.has(n.id)?1:0.05);
  link.transition().duration(150)
    .attr('opacity',l=>{const s=l.source.id??l.source,t=l.target.id??l.target;return s===d.id||t===d.id?0.9:0.03;})
    .attr('stroke',l=>{const s=l.source.id??l.source,t=l.target.id??l.target;if(s===d.id)return'#58a6ff';if(t===d.id)return'#3fb950';return l.type==='type-only'?'#1f3d5c':'#30363d';})
    .attr('stroke-width',l=>{const s=l.source.id??l.source,t=l.target.id??l.target;return s===d.id||t===d.id?2:1;})
    .attr('marker-end',l=>{const s=l.source.id??l.source,t=l.target.id??l.target;if(s===d.id)return'url(#arrow-1)';if(t===d.id)return'url(#arrow-2)';return'url(#arrow-0)';});
}

function resetGraphHighlight() {
  pinnedNode = null;
  node.select('circle').transition().duration(200).attr('opacity',1);
  node.select('text').transition().duration(200).attr('opacity',d=>d.dependents>=1||d.deps>=3?1:0.5);
  link.transition().duration(200)
    .attr('opacity',baseLinkOpacity)
    .attr('stroke',d=>d.type==='type-only'?'#1f3d5c':'#30363d')
    .attr('stroke-width',1).attr('marker-end','url(#arrow-0)');
}

// ─── Hover ───────────────────────────────────
node.on('mouseover', (e,d) => {
  showTooltip(e,d);
  if (!pinnedNode) highlightNode(d);
})
.on('mousemove', e=>positionTooltip(e))
.on('mouseout', () => { scheduleHideTooltip(); if (!pinnedNode) { /* highlight resets via scheduleHideTooltip */ } });

// ─── Click: pin highlight + detail panel ─────
node.on('click', (e,d) => {
  e.stopPropagation();
  pinnedNode = d;
  highlightNode(d);
  showDetail(d);
});
svg.on('click', () => {
  resetGraphHighlight();
  tooltip.style.display = 'none';
  tooltipLocked = false;
  closeDetail();
});

function showDetail(d) {
  const p=document.getElementById('detail');
  document.getElementById('d-name').textContent=d.id;
  document.getElementById('d-meta').innerHTML=i('detail.dir')+': '+esc(d.dir)+'<br>'+i('detail.dependencies')+': '+d.deps+' \\u00b7 '+i('detail.dependents')+': '+d.dependents;
  const deptL=document.getElementById('d-dependents'), depsL=document.getElementById('d-deps');
  deptL.innerHTML=(d.dependentsList||[]).map(x=>'<li data-focus="'+esc(x)+'">\\u2190 '+esc(x)+'</li>').join('')||'<li style="color:var(--text-muted)">'+i('detail.none')+'</li>';
  depsL.innerHTML=(d.dependencies||[]).map(x=>'<li data-focus="'+esc(x)+'">\\u2192 '+esc(x)+'</li>').join('')||'<li style="color:var(--text-muted)">'+i('detail.none')+'</li>';
  p.classList.add('open');
}
// Event delegation for detail panel list items (avoids inline onclick)
document.getElementById('d-dependents').addEventListener('click', function(e) { var li=e.target.closest('li[data-focus]'); if(li) focusNode(li.dataset.focus); });
document.getElementById('d-deps').addEventListener('click', function(e) { var li=e.target.closest('li[data-focus]'); if(li) focusNode(li.dataset.focus); });
window.closeDetail=()=>document.getElementById('detail').classList.remove('open');
window.focusNode=(id)=>{
  const n=DATA.nodes.find(x=>x.id===id); if(!n)return; showDetail(n);
  svg.transition().duration(500).call(zoom.transform,d3.zoomIdentity.translate(W/2-n.x*1.5,H/2-n.y*1.5).scale(1.5));
};

// Drag
function dragStart(e,d){if(!e.active)simulation.alphaTarget(0.3).restart();d.fx=d.x;d.fy=d.y;}
function dragging(e,d){d.fx=e.x;d.fy=e.y;}
function dragEnd(e,d){if(!e.active)simulation.alphaTarget(0);}

// ─── Search ──────────────────────────────────
const searchInput=document.getElementById('search');
document.addEventListener('keydown',e=>{
  if(e.key==='/'&&document.activeElement!==searchInput){e.preventDefault();searchInput.focus();}
  if(e.key==='Escape'){searchInput.value='';searchInput.blur();resetGraphHighlight();}
});
searchInput.addEventListener('input',e=>{
  const q=e.target.value.toLowerCase();
  if(!q){resetGraphHighlight();return;}
  node.select('circle').attr('opacity',d=>d.id.toLowerCase().includes(q)?1:0.06);
  node.select('text').attr('opacity',d=>d.id.toLowerCase().includes(q)?1:0.04);
  link.attr('opacity',0.03);
});

// ─── Filters (click=toggle, hover=highlight nodes) ──
if (!LAYERS) {
  // Non-layer mode: flat pills in filter-layer-row
  const filterRowEl=document.getElementById('filter-layer-row');
  DATA.dirs.forEach(dir=>{
    const pill=document.createElement('div');
    pill.className='filter-pill active';
    pill.innerHTML='<div class="pill-dot" style="background:'+dirColor(dir)+'"></div>'+esc(dir||'.')+' <span class="pill-count">'+dirCounts[dir]+'</span>';
    pill.onclick=()=>{
      if(activeDirs.has(dir)){activeDirs.delete(dir);pill.classList.remove('active');}
      else{activeDirs.add(dir);pill.classList.add('active');}
      applyFilter();
    };
    pill.onmouseenter=()=>{
      if(pinnedNode)return;
      node.select('circle').transition().duration(120).attr('opacity',d=>d.dir===dir?1:0.1);
      node.select('text').transition().duration(120).attr('opacity',d=>d.dir===dir?1:0.05);
    };
    pill.onmouseleave=()=>{
      if(pinnedNode)return;
      node.select('circle').transition().duration(150).attr('opacity',1);
      node.select('text').transition().duration(150).attr('opacity',d=>d.dependents>=1||d.deps>=3?1:0.5);
    };
    filterRowEl.appendChild(pill);
  });
}
function applyFilter(){
  if (LAYERS) {
    // Delegate to layer-aware filter
    if (typeof applyLayerFilter === 'function') { applyLayerFilter(); return; }
  }
  node.attr('display',d=>activeDirs.has(d.dir)?null:'none');
  link.attr('display',l=>{
    const s=l.source.id??l.source,t=l.target.id??l.target;
    const sD=DATA.nodes.find(n=>n.id===s)?.dir,tD=DATA.nodes.find(n=>n.id===t)?.dir;
    return activeDirs.has(sD)&&activeDirs.has(tD)?null:'none';
  });
}

// ─── Impact simulation mode ──────────────────
let impactMode=false;
const impactBadge=document.getElementById('impact-badge');
window.toggleImpactMode=()=>{
  impactMode=!impactMode;
  document.getElementById('impact-btn').classList.toggle('active',impactMode);
  if(!impactMode){impactBadge.style.display='none';resetGraphHighlight();}
};
function getTransitiveDependents(startId){
  const result=new Set();const queue=[startId];
  const revMap={};
  DATA.links.forEach(l=>{const s=l.source.id??l.source,t=l.target.id??l.target;if(!revMap[t])revMap[t]=[];revMap[t].push(s);});
  while(queue.length){const id=queue.shift();if(result.has(id))continue;result.add(id);(revMap[id]||[]).forEach(x=>queue.push(x));}
  return result;
}
// Override click in impact mode
const origClick=node.on('click');
node.on('click',(e,d)=>{
  if(!impactMode){e.stopPropagation();pinnedNode=d;highlightNode(d);showDetail(d);return;}
  e.stopPropagation();
  const affected=getTransitiveDependents(d.id);
  node.select('circle').transition().duration(200).attr('opacity',n=>affected.has(n.id)?1:0.06)
    .attr('stroke',n=>affected.has(n.id)&&n.id!==d.id?'var(--red)':n.deps>=5?'var(--yellow)':nodeColor(n))
    .attr('stroke-width',n=>affected.has(n.id)?3:1.5);
  node.select('text').transition().duration(200).attr('opacity',n=>affected.has(n.id)?1:0.04);
  link.transition().duration(200).attr('opacity',l=>{
    const s=l.source.id??l.source,t=l.target.id??l.target;
    return affected.has(s)&&affected.has(t)?0.8:0.03;
  }).attr('stroke',l=>{
    const s=l.source.id??l.source,t=l.target.id??l.target;
    return affected.has(s)&&affected.has(t)?'var(--red)':l.type==='type-only'?'#1f3d5c':'#30363d';
  });
  impactBadge.textContent=d.id.split('/').pop()+' → '+(affected.size-1)+' '+i('impact.transitive');
  impactBadge.style.display='block';
});

window.addEventListener('resize',()=>{
  const w=window.innerWidth,h=window.innerHeight-44;
  svg.attr('width',w).attr('height',h);
});

${buildHierarchyJs()}
${buildDiffJs(diffData)}
// ═══════════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════════
applyI18n();
</script>
</body>
</html>`;
}
