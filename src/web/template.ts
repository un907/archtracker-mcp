import type { DependencyGraph, LayerMetadata } from "../types/schema.js";
import type { ArchDiff } from "../types/schema.js";
import type { Locale } from "../i18n/index.js";
import type { CrossLayerConnection } from "../types/layers.js";

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
<style>
:root {
  --bg: #0d1117; --bg-card: #161b22; --bg-hover: #1c2129;
  --border: #30363d; --border-active: #58a6ff;
  --text: #c9d1d9; --text-dim: #8b949e; --text-muted: #484f58;
  --accent: #58a6ff; --green: #3fb950; --red: #f97583; --yellow: #f0e68c;
  --radius: 8px; --font-size: 13px;
}
[data-theme="light"] {
  --bg: #ffffff; --bg-card: #f6f8fa; --bg-hover: #eef1f5;
  --border: #d0d7de; --border-active: #0969da;
  --text: #1f2328; --text-dim: #656d76; --text-muted: #8b949e;
  --accent: #0969da; --green: #1a7f37; --red: #cf222e; --yellow: #9a6700;
}
* { margin: 0; padding: 0; box-sizing: border-box; }
body { background: var(--bg); color: var(--text); font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif; font-size: 13px; overflow: hidden; transition: background 0.3s, color 0.3s; }

/* ─── Tab bar ──────────────────────────────── */
#tab-bar { position: fixed; top: 0; left: 0; right: 0; height: 44px; background: var(--bg-card); border-bottom: 1px solid var(--border); display: flex; align-items: center; z-index: 30; padding: 0 16px; gap: 2px; transition: background 0.3s; }
#tab-bar .logo { font-weight: 700; font-size: 14px; color: var(--accent); margin-right: 16px; letter-spacing: -0.3px; outline: none; border-bottom: 1px dashed transparent; cursor: text; min-width: 40px; }
#tab-bar .logo:hover { border-bottom-color: var(--text-muted); }
#tab-bar .logo:focus { border-bottom-color: var(--accent); }
.tab { padding: 8px 16px; font-size: 13px; color: var(--text-dim); cursor: pointer; border-radius: 6px 6px 0 0; border: 1px solid transparent; border-bottom: none; transition: all 0.15s; user-select: none; position: relative; top: 1px; }
.tab:hover { color: var(--text); background: var(--bg-hover); }
.tab.active { color: var(--text); background: var(--bg); border-color: var(--border); }
.tab-right { margin-left: auto; display: flex; align-items: center; gap: 12px; }
.tab-stats { font-size: 12px; color: var(--text-muted); display: flex; gap: 14px; }
.tab-stats span b { color: var(--text-dim); }
.settings-btn { background: none; border: 1px solid var(--border); border-radius: 6px; padding: 4px 8px; cursor: pointer; color: var(--text-dim); font-size: 16px; transition: all 0.15s; }
.settings-btn:hover { border-color: var(--accent); color: var(--text); }

/* ─── Views ────────────────────────────────── */
.view { position: fixed; top: 44px; left: 0; right: 0; bottom: 0; display: none; }
.view.active { display: block; }
.view svg { width: 100%; height: 100%; }

/* ─── HUD ─────────────────────────────────── */
#hud { position: absolute; top: 12px; left: 12px; z-index: 10; display: flex; flex-direction: column; gap: 8px; }
.hud-panel { background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius); padding: 10px 14px; font-size: 12px; backdrop-filter: blur(8px); transition: background 0.3s; }
#search-box { display: flex; align-items: center; gap: 8px; }
#search-box input { background: transparent; border: none; outline: none; color: var(--text); font-size: 13px; width: 180px; }
#search-box input::placeholder { color: var(--text-muted); }
kbd { background: #21262d; border: 1px solid var(--border); border-radius: 3px; padding: 1px 5px; font-size: 10px; color: var(--text-muted); font-family: inherit; }
.legend-item { display: flex; align-items: center; gap: 6px; margin: 3px 0; color: var(--text-dim); }
.legend-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }

/* ─── Tooltip (interactive — mouse can enter) ─ */
#tooltip { position: fixed; display: none; background: var(--bg-card); border: 1px solid var(--accent); border-radius: var(--radius); padding: 14px 16px; font-size: 13px; z-index: 40; max-width: 420px; pointer-events: auto; box-shadow: 0 8px 24px rgba(0,0,0,0.5); transition: background 0.3s; }
#tooltip .tt-name { color: var(--accent); font-size: 14px; font-weight: 600; margin-bottom: 8px; word-break: break-all; }
#tooltip .tt-badge { display: inline-block; background: var(--bg-hover); border-radius: 10px; padding: 1px 8px; font-size: 11px; margin: 0 2px; }
#tooltip .tt-section { margin-top: 8px; font-size: 12px; color: var(--text-dim); max-height: 140px; overflow-y: auto; }
#tooltip .tt-section div { padding: 2px 0; }
#tooltip .tt-out { color: var(--accent); }
#tooltip .tt-in { color: var(--green); }

/* ─── Filter bar ──────────────────────────── */
#filter-bar { position: absolute; bottom: 12px; left: 12px; right: 120px; z-index: 10; display: flex; flex-direction: column; gap: 6px; pointer-events: none; }
#filter-bar > * { pointer-events: auto; }
#filter-layer-row { display: flex; flex-wrap: wrap; gap: 4px; align-items: center; }
#filter-dir-toggle { background: var(--bg-card); border: 1px solid var(--border); border-radius: 14px; padding: 3px 10px; font-size: 11px; cursor: pointer; user-select: none; color: var(--text-dim); transition: all 0.15s; flex-shrink: 0; }
#filter-dir-toggle:hover { border-color: var(--text-dim); color: var(--text); }
#filter-dir-toggle.open { border-color: var(--accent); color: var(--text); }
#filter-dir-panel { display: none; background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius); padding: 10px 12px; max-height: 220px; overflow-y: auto; backdrop-filter: blur(8px); }
#filter-dir-panel.open { display: block; }
.dir-group { margin-bottom: 8px; }
.dir-group:last-child { margin-bottom: 0; }
.dir-group-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; display: flex; align-items: center; gap: 5px; cursor: pointer; user-select: none; }
.dir-group-label .dg-dot { width: 6px; height: 6px; border-radius: 50%; }
.dir-group-pills { display: flex; flex-wrap: wrap; gap: 3px; }
.filter-pill { background: var(--bg-card); border: 1px solid var(--border); border-radius: 14px; padding: 2px 8px; font-size: 10px; cursor: pointer; user-select: none; transition: all 0.15s; display: flex; align-items: center; gap: 4px; }
.filter-pill:hover { border-color: var(--text-dim); }
.filter-pill.active { border-color: var(--accent); }
.filter-pill .pill-dot { width: 5px; height: 5px; border-radius: 50%; }
.filter-pill .pill-count { color: var(--text-muted); font-size: 9px; }

/* ─── Zoom controls ───────────────────────── */
#zoom-ctrl { position: absolute; bottom: 52px; right: 12px; z-index: 10; display: flex; flex-direction: column; gap: 2px; }
#zoom-ctrl button { width: 32px; height: 32px; background: var(--bg-card); border: 1px solid var(--border); color: var(--text-dim); border-radius: 6px; cursor: pointer; font-size: 16px; display: flex; align-items: center; justify-content: center; transition: all 0.1s; }
#zoom-ctrl button:hover { background: var(--bg-hover); color: var(--text); }

/* ─── Detail panel ────────────────────────── */
#detail { position: absolute; top: 12px; right: 12px; width: 280px; z-index: 10; background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius); padding: 16px; font-size: 13px; display: none; max-height: calc(100vh - 100px); overflow-y: auto; transition: background 0.3s; }
#detail.open { display: block; }
#detail .detail-name { color: var(--accent); font-weight: 600; font-size: 14px; word-break: break-all; margin-bottom: 8px; }
#detail .detail-meta { color: var(--text-dim); margin-bottom: 12px; }
#detail .detail-section { margin-top: 10px; }
#detail .detail-section h4 { font-size: 11px; text-transform: uppercase; color: var(--text-muted); letter-spacing: 0.5px; margin-bottom: 4px; }
#detail .detail-list { list-style: none; }
#detail .detail-list li { padding: 3px 0; font-size: 12px; color: var(--text-dim); cursor: pointer; }
#detail .detail-list li:hover { color: var(--accent); }
#detail .close-btn { position: absolute; top: 8px; right: 10px; background: none; border: none; color: var(--text-muted); cursor: pointer; font-size: 16px; }

/* ─── Settings panel ──────────────────────── */
#settings-panel { position: fixed; top: 44px; right: 0; width: 280px; height: calc(100vh - 44px); background: var(--bg-card); border-left: 1px solid var(--border); z-index: 25; padding: 20px; transform: translateX(100%); transition: transform 0.25s ease, background 0.3s; overflow-y: auto; }
#settings-panel.open { transform: translateX(0); }
#settings-panel h3 { font-size: 14px; color: var(--text); margin-bottom: 16px; }
.setting-group { margin-bottom: 18px; }
.setting-group label { display: block; font-size: 12px; color: var(--text-dim); margin-bottom: 6px; }
.setting-group select, .setting-group input[type=range] { width: 100%; background: var(--bg); border: 1px solid var(--border); border-radius: 6px; color: var(--text); padding: 6px 8px; font-size: 13px; }
.setting-group input[type=range] { padding: 4px 0; border: none; accent-color: var(--accent); }
.setting-value { font-size: 11px; color: var(--text-muted); text-align: right; }
.theme-toggle { display: flex; gap: 6px; }
.theme-btn { flex: 1; padding: 8px; background: var(--bg); border: 1px solid var(--border); border-radius: 6px; cursor: pointer; text-align: center; font-size: 12px; color: var(--text-dim); transition: all 0.15s; }
.theme-btn:hover { border-color: var(--text-dim); }
.theme-btn.active { border-color: var(--accent); color: var(--accent); }

/* ─── Hierarchy detail panel ──────────────── */
#hier-detail { position: absolute; top: 12px; right: 12px; width: 280px; z-index: 10; background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius); padding: 16px; font-size: 13px; display: none; max-height: calc(100vh - 100px); overflow-y: auto; transition: background 0.3s; }
#hier-detail.open { display: block; }
#hier-detail .detail-name { color: var(--accent); font-weight: 600; font-size: 14px; word-break: break-all; margin-bottom: 8px; }
#hier-detail .detail-meta { color: var(--text-dim); margin-bottom: 12px; }
#hier-detail .detail-section { margin-top: 10px; }
#hier-detail .detail-section h4 { font-size: 11px; text-transform: uppercase; color: var(--text-muted); letter-spacing: 0.5px; margin-bottom: 4px; }
#hier-detail .detail-list { list-style: none; }
#hier-detail .detail-list li { padding: 3px 0; font-size: 12px; color: var(--text-dim); cursor: pointer; }
#hier-detail .detail-list li:hover { color: var(--accent); }
#hier-detail .close-btn { position: absolute; top: 8px; right: 10px; background: none; border: none; color: var(--text-muted); cursor: pointer; font-size: 16px; }

/* ─── Hierarchy ───────────────────────────── */
.hier-node { cursor: pointer; }
.hier-node rect { rx: 6; ry: 6; stroke-width: 1.5; transition: stroke 0.15s; }
.hier-node:hover rect { stroke: var(--accent) !important; stroke-width: 2; }
.hier-node text { fill: var(--text); pointer-events: none; }
.hier-link { fill: none; stroke: var(--border); stroke-width: 1; }
.hier-layer-label { fill: var(--text-muted); font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }

/* ─── Impact mode ─────────────────────────── */
#impact-btn.active { background: var(--accent) !important; color: #fff !important; border-color: var(--accent) !important; }
#impact-badge { position: absolute; bottom: 52px; left: 12px; z-index: 10; display: none; background: var(--accent); color: #fff; font-size: 12px; font-weight: 600; padding: 6px 12px; border-radius: var(--radius); }

/* ─── Help bar ─────────────────────────────── */
#help-bar { position: absolute; bottom: 12px; right: 12px; z-index: 10; font-size: 11px; color: var(--text-muted); background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius); padding: 6px 10px; transition: background 0.3s; }

/* ─── Layer hulls ─────────────────────────── */
.layer-hull { fill-opacity: 0.06; stroke-width: 1.5; stroke-dasharray: 6,4; pointer-events: none; }
.layer-hull-label { font-size: 13px; font-weight: 700; letter-spacing: 0.5px; pointer-events: none; opacity: 0.7; }

/* ─── Layer tabs ──────────────────────────── */
#layer-tabs { display: flex; gap: 2px; margin-left: 12px; padding-left: 12px; border-left: 1px solid var(--border); }
.layer-tab { padding: 4px 10px; font-size: 11px; color: var(--text-dim); cursor: pointer; border-radius: 4px; border: 1px solid transparent; transition: all 0.15s; user-select: none; display: flex; align-items: center; gap: 5px; }
.layer-tab:hover { color: var(--text); background: var(--bg-hover); }
.layer-tab.active { border-color: var(--accent); color: var(--text); }
.layer-tab .lt-dot { width: 6px; height: 6px; border-radius: 50%; }

/* ─── Layer filter pills ─────────────────── */
.layer-pill { background: var(--bg-card); border: 1px solid var(--border); border-radius: 14px; padding: 2px 9px; font-size: 11px; font-weight: 600; cursor: pointer; user-select: none; transition: all 0.15s; display: flex; align-items: center; gap: 5px; }
.layer-pill:hover { border-color: var(--text-dim); }
.layer-pill.active { border-color: var(--accent); }
.layer-pill .lp-dot { width: 6px; height: 6px; border-radius: 50%; }
.layer-pill .lp-count { color: var(--text-muted); font-size: 9px; font-weight: 400; }
</style>
</head>
<body>

<!-- Tab bar -->
<div id="tab-bar">
  <span class="logo" id="project-title" contenteditable="true" spellcheck="false" title="Click to edit project name"></span>
  <div class="tab active" data-view="graph-view" data-i18n="tab.graph">Graph</div>
  <div class="tab" data-view="hier-view" data-i18n="tab.hierarchy">Hierarchy</div>
  <div class="tab" data-view="diff-view" id="diff-tab" style="display:none" data-i18n="tab.diff">Diff</div>
  <div id="layer-tabs"></div>
  <div class="tab-right">
    <div class="tab-stats">
      <span><span data-i18n="stats.files">Files</span> <b id="s-files">0</b></span>
      <span><span data-i18n="stats.edges">Edges</span> <b id="s-edges">0</b></span>
      <span><span data-i18n="stats.circular">Circular</span> <b id="s-circular">0</b></span>
    </div>
    <button class="settings-btn" onclick="toggleSettings()" title="Settings">⚙</button>
  </div>
</div>

<!-- Settings panel -->
<div id="settings-panel">
  <h3 data-i18n="settings.title">Settings</h3>
  <div class="setting-group">
    <label data-i18n="settings.theme">Theme</label>
    <div class="theme-toggle">
      <div class="theme-btn active" data-theme-val="dark" onclick="setTheme('dark')">🌙 Dark</div>
      <div class="theme-btn" data-theme-val="light" onclick="setTheme('light')">☀️ Light</div>
    </div>
  </div>
  <div class="setting-group">
    <label data-i18n="settings.fontSize">Font Size</label>
    <input type="range" id="font-size-slider" min="10" max="18" value="13" oninput="setFontSize(this.value)">
    <div class="setting-value"><span id="font-size-val">13</span>px</div>
  </div>
  <div class="setting-group">
    <label data-i18n="settings.nodeSize">Node Size</label>
    <input type="range" id="node-size-slider" min="50" max="200" value="100" oninput="setNodeScale(this.value)">
    <div class="setting-value"><span id="node-size-val">100</span>%</div>
  </div>
  <div class="setting-group">
    <label data-i18n="settings.linkOpacity">Link Opacity</label>
    <input type="range" id="link-opacity-slider" min="10" max="100" value="40" oninput="setLinkOpacity(this.value)">
    <div class="setting-value"><span id="link-opacity-val">40</span>%</div>
  </div>
  <div class="setting-group">
    <label data-i18n="settings.gravity">Gravity</label>
    <input type="range" id="gravity-slider" min="10" max="500" value="150" oninput="setGravity(this.value)">
    <div class="setting-value"><span id="gravity-val">150</span></div>
  </div>
  <div class="setting-group">
    <label data-i18n="settings.language">Language</label>
    <div class="theme-toggle">
      <div class="theme-btn lang-btn" data-lang="en" onclick="setLang('en')">English</div>
      <div class="theme-btn lang-btn" data-lang="ja" onclick="setLang('ja')">日本語</div>
    </div>
  </div>
  <div class="setting-group" style="margin-top:12px;padding-top:12px;border-top:1px solid var(--border)">
    <label data-i18n="settings.export">Export</label>
    <div class="theme-toggle">
      <div class="theme-btn" onclick="exportSVG()">SVG</div>
      <div class="theme-btn" onclick="exportPNG()">PNG</div>
    </div>
  </div>
</div>

<!-- Graph View -->
<div id="graph-view" class="view active">
  <svg id="graph-svg"></svg>
  <div id="hud">
    <div class="hud-panel" id="search-box">
      <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor" style="color:var(--text-muted)"><path d="M11.5 7a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0Zm-.82 4.74a6 6 0 1 1 1.06-1.06l3.04 3.04a.75.75 0 1 1-1.06 1.06l-3.04-3.04Z"/></svg>
      <input id="search" type="text" data-i18n-placeholder="search.placeholder" placeholder="Search files..." autocomplete="off">
      <kbd>/</kbd>
    </div>
    <div class="hud-panel" id="legend-panel">
      <div id="layer-legend"></div>
      <div class="legend-item"><div class="legend-dot" style="background:var(--red)"></div> <span data-i18n="legend.circular">Circular dep</span></div>
      <div class="legend-item"><div class="legend-dot" style="background:var(--text-muted)"></div> <span data-i18n="legend.orphan">Orphan</span></div>
      <div class="legend-item"><div class="legend-dot" style="border:2px solid var(--yellow);width:6px;height:6px"></div> <span data-i18n="legend.highCoupling">High coupling</span></div>
      <div class="legend-item" style="margin-top:4px;font-size:11px;gap:3px"><span style="color:var(--accent)">—→</span> <span data-i18n="legend.imports">imports</span> <span style="margin-left:6px;color:var(--green)">←—</span> <span data-i18n="legend.importedBy">imported by</span></div>
    </div>
  </div>
  <div id="detail">
    <button class="close-btn" onclick="closeDetail()">✕</button>
    <div class="detail-name" id="d-name"></div>
    <div class="detail-meta" id="d-meta"></div>
    <div class="detail-section"><h4 data-i18n="detail.importedBy">Imported by</h4><ul class="detail-list" id="d-dependents"></ul></div>
    <div class="detail-section"><h4 data-i18n="detail.imports">Imports</h4><ul class="detail-list" id="d-deps"></ul></div>
  </div>
  <div id="layer-filters" style="position:absolute;bottom:40px;left:12px;right:120px;z-index:10;display:flex;flex-wrap:wrap;gap:5px;"></div>
  <div id="filters"></div>
  <div id="zoom-ctrl">
    <button onclick="zoomIn()" title="Zoom in">+</button>
    <button onclick="zoomOut()" title="Zoom out">−</button>
    <button onclick="zoomFit()" title="Fit">⊡</button>
    <button id="impact-btn" onclick="toggleImpactMode()" title="Impact simulation" style="font-size:12px;margin-top:4px" data-i18n="impact.btn">Impact</button>
  </div>
  <div id="impact-badge"></div>
  <div id="help-bar" data-i18n="help.graph">Scroll: zoom · Drag: pan · Click: select · / search</div>
</div>

<!-- Hierarchy View -->
<div id="hier-view" class="view">
  <svg id="hier-svg"></svg>
  <div id="hier-hud" style="position:absolute;top:12px;left:12px;z-index:10;display:flex;flex-direction:column;gap:8px;">
    <div class="hud-panel" id="hier-legend">
      <div class="legend-item"><div class="legend-dot" style="background:var(--red)"></div> <span data-i18n="legend.circular">Circular dep</span></div>
      <div class="legend-item"><div class="legend-dot" style="background:var(--text-muted)"></div> <span data-i18n="legend.orphan">Orphan</span></div>
      <div class="legend-item"><div class="legend-dot" style="border:2px solid var(--yellow);width:6px;height:6px"></div> <span data-i18n="legend.highCoupling">High coupling</span></div>
    </div>
  </div>
  <div id="hier-detail">
    <button class="close-btn" onclick="closeHierDetail()">✕</button>
    <div class="detail-name" id="hd-name"></div>
    <div class="detail-meta" id="hd-meta"></div>
    <div class="detail-section"><h4 data-i18n="detail.importedBy">Imported by</h4><ul class="detail-list" id="hd-dependents"></ul></div>
    <div class="detail-section"><h4 data-i18n="detail.imports">Imports</h4><ul class="detail-list" id="hd-deps"></ul></div>
  </div>
  <div id="hier-filters" style="position:absolute;bottom:42px;left:12px;right:120px;z-index:10;display:flex;flex-wrap:wrap;gap:5px;"></div>
  <div id="help-bar" style="position:absolute" data-i18n="help.hierarchy">Scroll to navigate · Click to highlight</div>
</div>

<!-- Diff View -->
<div id="diff-view" class="view">
  <svg id="diff-svg"></svg>
  <div id="diff-legend" style="position:absolute;top:12px;left:12px;z-index:10;">
    <div class="hud-panel">
      <div class="legend-item"><div class="legend-dot" style="background:var(--green)"></div> <span data-i18n="diff.addedLabel">Added</span></div>
      <div class="legend-item"><div class="legend-dot" style="background:var(--red)"></div> <span data-i18n="diff.removedLabel">Removed</span></div>
      <div class="legend-item"><div class="legend-dot" style="background:var(--yellow)"></div> <span data-i18n="diff.modifiedLabel">Modified</span></div>
      <div class="legend-item"><div class="legend-dot" style="background:var(--accent)"></div> <span data-i18n="diff.affectedLabel">Affected</span></div>
    </div>
  </div>
  <div id="help-bar" style="position:absolute" data-i18n="help.diff">Green=added · Red=removed · Yellow=modified · Blue=affected</div>
</div>

<!-- Tooltip (shared, interactive) -->
<div id="tooltip">
  <div class="tt-name" id="tt-name"></div>
  <div>
    <span class="tt-badge tt-out" id="tt-dep-count"></span> <span data-i18n="tooltip.imports">imports</span>
    <span class="tt-badge tt-in" id="tt-dpt-count" style="margin-left:6px"></span> <span data-i18n="tooltip.importedBy">imported by</span>
  </div>
  <div class="tt-section" id="tt-details"></div>
</div>

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

// ═══════════════════════════════════════════════
// SETTINGS (persisted to localStorage)
// ═══════════════════════════════════════════════
const STORAGE_KEY = 'archtracker-settings';
function saveSettings() {
  const s = { theme: document.body.getAttribute('data-theme') || 'dark', fontSize: document.getElementById('font-size-val').textContent, nodeSize: document.getElementById('node-size-val').textContent, linkOpacity: document.getElementById('link-opacity-val').textContent, gravity: document.getElementById('gravity-val').textContent, lang: currentLang, projectTitle: document.getElementById('project-title').textContent };
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
    simulation.force('charge', d3.forceManyBody().strength(-gravityStrength).distanceMax(500));
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
}

document.getElementById('s-files').textContent = DATA.nodes.length;
document.getElementById('s-edges').textContent = DATA.links.length;
document.getElementById('s-circular').textContent = DATA.circularFiles.length;

const dirColor = d3.scaleOrdinal()
  .domain(DATA.dirs)
  .range(['#58a6ff','#3fb950','#d2a8ff','#f0883e','#79c0ff','#56d4dd','#db61a2','#f778ba','#ffa657','#7ee787']);

// Layer color map (from LAYERS metadata)
const layerColorMap = {};
let activeLayerFilter = null; // null = "All Layers" — declared early for nodeColor access
if (LAYERS) {
  LAYERS.forEach(l => { layerColorMap[l.name] = l.color; });
}

function nodeColor(d) {
  if (circularSet.has(d.id)) return '#f97583';
  if (d.isOrphan) return '#484f58';
  // In single-layer view, use directory-based coloring (traditional style)
  if (LAYERS && d.layer && layerColorMap[d.layer] && !activeLayerFilter) return layerColorMap[d.layer];
  return dirColor(d.dir);
}
function nodeRadius(d) { return Math.max(5, Math.min(22, 4 + d.dependents * 1.8)); }
function fileName(id) { return id.split('/').pop(); }

// ═══════════════════════════════════════════════
// TAB SWITCHING
// ═══════════════════════════════════════════════
let hierBuilt = false;
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById(tab.dataset.view).classList.add('active');
    if (tab.dataset.view === 'hier-view' && !hierBuilt) { buildHierarchy(); hierBuilt = true; }
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
  const out = (d.dependencies||[]).map(x => '<div class="tt-out">→ '+x+'</div>');
  const inc = (d.dependentsList||[]).map(x => '<div class="tt-in">← '+x+'</div>');
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
const activeLayers = new Set(LAYERS ? LAYERS.map(l => l.name) : []);
var applyLayerFilter = null; // hoisted for dir-filter integration

if (LAYERS && LAYERS.length > 0) {
  // ─── Water droplet physics: intra-layer cohesion + inter-layer separation ───
  const layerCenters = {};
  const layerCount = LAYERS.length;
  // Compact layout: layers are close together like water droplets
  const baseRadius = Math.max(60, Math.min(W, H) * 0.04 * Math.sqrt(layerCount));
  LAYERS.forEach((l, idx) => {
    const angle = (2 * Math.PI * idx) / layerCount - Math.PI / 2;
    layerCenters[l.name] = { x: Math.cos(angle) * baseRadius, y: Math.sin(angle) * baseRadius };
  });

  // Replace default centering forces with per-layer positioning
  simulation.force('x', null).force('y', null).force('center', null);
  simulation.force('layerX', d3.forceX(d => layerCenters[d.layer]?.x || 0).strength(d => d.layer ? 0.12 : 0.03));
  simulation.force('layerY', d3.forceY(d => layerCenters[d.layer]?.y || 0).strength(d => d.layer ? 0.12 : 0.03));

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
    if (activeLayerFilter) return; // hide hulls when single layer selected

    LAYERS.forEach(layer => {
      if (!activeLayers.has(layer.name)) return;
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
    item.innerHTML = '<div class="legend-dot" style="background:' + layer.color + '"></div> ' + layer.name;
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

  // ─── Layer tabs (in tab bar) ───────────────
  const layerTabsEl = document.getElementById('layer-tabs');
  const allTab = document.createElement('div');
  allTab.className = 'layer-tab active';
  allTab.textContent = 'All Layers';
  allTab.onclick = () => selectLayerTab(null);
  layerTabsEl.appendChild(allTab);

  LAYERS.forEach(layer => {
    const tab = document.createElement('div');
    tab.className = 'layer-tab';
    tab.innerHTML = '<div class="lt-dot" style="background:' + layer.color + '"></div>' + layer.name;
    tab.onclick = () => selectLayerTab(layer.name);
    layerTabsEl.appendChild(tab);
  });

  function selectLayerTab(layerName) {
    activeLayerFilter = layerName;
    // Update tab active state
    layerTabsEl.querySelectorAll('.layer-tab').forEach((t, idx) => {
      t.classList.toggle('active', layerName === null ? idx === 0 : t.textContent.includes(layerName));
    });
    applyLayerFilter();
  }

  applyLayerFilter = function() {
    const isSingleLayer = !!activeLayerFilter;
    node.attr('display', d => {
      if (!activeDirs.has(d.dir)) return 'none';
      if (!activeLayers.has(d.layer)) return 'none';
      if (isSingleLayer && d.layer !== activeLayerFilter) return 'none';
      return null;
    });
    link.attr('display', l => {
      const s = l.source.id ?? l.source, t = l.target.id ?? l.target;
      const sN = DATA.nodes.find(n => n.id === s), tN = DATA.nodes.find(n => n.id === t);
      if (!sN || !tN) return 'none';
      if (!activeDirs.has(sN.dir) || !activeDirs.has(tN.dir)) return 'none';
      if (!activeLayers.has(sN.layer) || !activeLayers.has(tN.layer)) return 'none';
      if (isSingleLayer && (sN.layer !== activeLayerFilter || tN.layer !== activeLayerFilter)) return 'none';
      return null;
    });
    // Refresh node colors: single-layer = dir-based, all layers = layer-based
    node.select('circle')
      .attr('fill', nodeColor)
      .attr('stroke', d => d.deps >= 5 ? 'var(--yellow)' : nodeColor(d));
    // Cross-layer links visibility
    if (typeof crossLink !== 'undefined') {
      crossLink.attr('display', isSingleLayer ? 'none' : null);
      crossLabel.attr('display', isSingleLayer ? 'none' : null);
    }
    // Update stats
    const visibleNodes = DATA.nodes.filter(d => {
      if (!activeDirs.has(d.dir)) return false;
      if (!activeLayers.has(d.layer)) return false;
      if (isSingleLayer && d.layer !== activeLayerFilter) return false;
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
    // Zoom to fit visible nodes after a short delay
    setTimeout(() => zoomFit(), 200);
  }

  // ─── Layer filter pills ────────────────────
  const layerFiltersEl = document.getElementById('layer-filters');
  LAYERS.forEach(layer => {
    const layerNodes = DATA.nodes.filter(n => n.layer === layer.name);
    const pill = document.createElement('div');
    pill.className = 'layer-pill active';
    pill.innerHTML = '<div class="lp-dot" style="background:' + layer.color + '"></div>' + layer.name + ' <span class="lp-count">' + layerNodes.length + '</span>';
    pill.onclick = () => {
      if (activeLayers.has(layer.name)) { activeLayers.delete(layer.name); pill.classList.remove('active'); }
      else { activeLayers.add(layer.name); pill.classList.add('active'); }
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
    layerFiltersEl.appendChild(pill);
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
  document.getElementById('d-meta').innerHTML=i('detail.dir')+': '+d.dir+'<br>'+i('detail.dependencies')+': '+d.deps+' · '+i('detail.dependents')+': '+d.dependents;
  const deptL=document.getElementById('d-dependents'), depsL=document.getElementById('d-deps');
  deptL.innerHTML=(d.dependentsList||[]).map(x=>'<li onclick="focusNode(\\''+x+'\\')">← '+x+'</li>').join('')||'<li style="color:var(--text-muted)">'+i('detail.none')+'</li>';
  depsL.innerHTML=(d.dependencies||[]).map(x=>'<li onclick="focusNode(\\''+x+'\\')">→ '+x+'</li>').join('')||'<li style="color:var(--text-muted)">'+i('detail.none')+'</li>';
  p.classList.add('open');
}
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
const filtersEl=document.getElementById('filters');
const activeDirs=new Set(DATA.dirs);
const dirCounts={};
DATA.nodes.forEach(n=>dirCounts[n.dir]=(dirCounts[n.dir]||0)+1);
DATA.dirs.forEach(dir=>{
  const pill=document.createElement('div');
  pill.className='filter-pill active';
  pill.innerHTML='<div class="pill-dot" style="background:'+dirColor(dir)+'"></div>'+(dir||'.')+' <span class="pill-count">'+dirCounts[dir]+'</span>';
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
  filtersEl.appendChild(pill);
});
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

// ═══════════════════════════════════════════════
// HIERARCHY VIEW
// ═══════════════════════════════════════════════
function buildHierarchy(){
  const hSvg=d3.select('#hier-svg');
  const hG=hSvg.append('g');
  const hZoom=d3.zoom().scaleExtent([0.1,4]).on('zoom',e=>hG.attr('transform',e.transform));
  hSvg.call(hZoom);

  const nodeMap={}; DATA.nodes.forEach(n=>nodeMap[n.id]=n);
  const importsMap={}; DATA.links.forEach(l=>{const s=l.source.id??l.source,t=l.target.id??l.target;if(!importsMap[s])importsMap[s]=[];importsMap[s].push(t);});

  const entryPoints=DATA.nodes.filter(n=>n.dependents===0).map(n=>n.id);
  const layers={};const visited=new Set();
  const queue=entryPoints.map(id=>({id,layer:0}));
  DATA.nodes.forEach(n=>{if(n.isOrphan)layers[n.id]=0;});

  while(queue.length>0){
    const{id,layer}=queue.shift();
    if(visited.has(id)&&(layers[id]??-1)>=layer)continue;
    layers[id]=Math.max(layers[id]??0,layer);visited.add(id);
    (importsMap[id]||[]).forEach(t=>queue.push({id:t,layer:layer+1}));
  }
  DATA.nodes.forEach(n=>{if(!(n.id in layers))layers[n.id]=0;});

  const maxLayer=Math.max(0,...Object.values(layers));
  const layerGroups={};
  for(let i=0;i<=maxLayer;i++)layerGroups[i]=[];
  Object.entries(layers).forEach(([id,l])=>layerGroups[l].push(id));
  Object.values(layerGroups).forEach(arr=>arr.sort((a,b)=>(nodeMap[a]?.dir||'').localeCompare(nodeMap[b]?.dir||'')||a.localeCompare(b)));

  const boxW=200,boxH=30,gapX=24,gapY=70,padY=60,padX=40;
  const positions={};let maxRowWidth=0;
  for(let layer=0;layer<=maxLayer;layer++){const items=layerGroups[layer];maxRowWidth=Math.max(maxRowWidth,items.length*(boxW+gapX)-gapX);}
  for(let layer=0;layer<=maxLayer;layer++){
    const items=layerGroups[layer],rowWidth=items.length*(boxW+gapX)-gapX,startX=padX+(maxRowWidth-rowWidth)/2;
    items.forEach((id,i)=>{positions[id]={x:startX+i*(boxW+gapX),y:padY+layer*(boxH+gapY)};});
  }

  const totalW=maxRowWidth+padX*2,totalH=padY*2+(maxLayer+1)*(boxH+gapY);
  hSvg.attr('width',Math.max(totalW,W)).attr('height',Math.max(totalH,H));

  const linkG=hG.append('g');
  DATA.links.forEach(l=>{
    const sId=l.source.id??l.source,tId=l.target.id??l.target;
    const s=positions[sId],t=positions[tId]; if(!s||!t)return;
    const x1=s.x+boxW/2,y1=s.y+boxH,x2=t.x+boxW/2,y2=t.y,midY=(y1+y2)/2;
    linkG.append('path').attr('class','hier-link')
      .attr('d',\`M\${x1},\${y1} C\${x1},\${midY} \${x2},\${midY} \${x2},\${y2}\`)
      .attr('stroke',l.type==='type-only'?'#1f3d5c':'var(--border)')
      .attr('stroke-dasharray',l.type==='type-only'?'4,3':null)
      .attr('data-source',sId).attr('data-target',tId);
  });

  hSvg.append('defs').append('marker').attr('id','harrow').attr('viewBox','0 -3 6 6')
    .attr('refX',6).attr('refY',0).attr('markerWidth',6).attr('markerHeight',6).attr('orient','auto')
    .append('path').attr('d','M0,-3L6,0L0,3Z').attr('fill','var(--border)');
  linkG.selectAll('path').attr('marker-end','url(#harrow)');

  for(let layer=0;layer<=maxLayer;layer++){
    if(!layerGroups[layer].length)continue;
    hG.append('text').attr('class','hier-layer-label').attr('font-size',11)
      .attr('x',12).attr('y',padY+layer*(boxH+gapY)+boxH/2+4).text('L'+layer);
  }

  const nodeG=hG.append('g');
  DATA.nodes.forEach(n=>{
    const pos=positions[n.id]; if(!pos)return;
    const gn=nodeG.append('g').attr('class','hier-node').attr('transform',\`translate(\${pos.x},\${pos.y})\`);
    gn.append('rect').attr('width',boxW).attr('height',boxH)
      .attr('fill','var(--bg-card)').attr('stroke',nodeColor(n))
      .attr('stroke-width',circularSet.has(n.id)?2:1.5);
    gn.append('text').attr('x',8).attr('y',boxH/2+4).attr('font-size',11)
      .text(fileName(n.id).length>24?fileName(n.id).slice(0,22)+'…':fileName(n.id));
    gn.append('text').attr('x',boxW-8).attr('y',boxH/2+4)
      .attr('text-anchor','end').attr('font-size',10).attr('fill','var(--text-muted)')
      .text(n.dependents>0?'↑'+n.dependents:'');
    gn.append('text').attr('x',8).attr('y',-4).attr('font-size',9)
      .attr('fill',dirColor(n.dir)).attr('opacity',0.7).text(n.dir);

    gn.node().__data_id=n.id;
    gn.on('mouseover',e=>{
      showTooltip(e,n);
      if (!hierPinned) hierHighlight(n.id);
    })
    .on('mousemove',e=>positionTooltip(e))
    .on('mouseout',()=>{
      scheduleHideTooltip();
      if (!hierPinned) hierResetHighlight();
    })
    .on('click',(e)=>{
      e.stopPropagation();
      hierPinned=n.id;
      hierHighlight(n.id);
      showHierDetail(n);
    });
  });

  // Hierarchy highlight helpers
  let hierPinned=null;
  function hierHighlight(nId){
    linkG.selectAll('path')
      .attr('stroke',function(){const s=this.getAttribute('data-source'),t=this.getAttribute('data-target');if(s===nId)return'#58a6ff';if(t===nId)return'#3fb950';return this.getAttribute('stroke-dasharray')?'#1f3d5c':'var(--border)';})
      .attr('stroke-width',function(){const s=this.getAttribute('data-source'),t=this.getAttribute('data-target');return(s===nId||t===nId)?2.5:1;})
      .attr('opacity',function(){const s=this.getAttribute('data-source'),t=this.getAttribute('data-target');return(s===nId||t===nId)?1:0.15;});
    nodeG.selectAll('.hier-node').attr('opacity',function(){
      const id=this.__data_id; if(id===nId)return 1;
      const connected=DATA.links.some(l=>{const s=l.source.id??l.source,t=l.target.id??l.target;return(s===nId&&t===id)||(t===nId&&s===id);});
      return connected?1:0.3;
    });
  }
  function hierResetHighlight(){
    hierPinned=null;
    linkG.selectAll('path')
      .attr('stroke',function(){return this.getAttribute('stroke-dasharray')?'#1f3d5c':'var(--border)';})
      .attr('stroke-width',1).attr('opacity',1);
    nodeG.selectAll('.hier-node').attr('opacity',1);
  }
  function showHierDetail(n){
    const p=document.getElementById('hier-detail');
    document.getElementById('hd-name').textContent=n.id;
    document.getElementById('hd-meta').innerHTML=i('detail.dir')+': '+n.dir+'<br>'+i('detail.dependencies')+': '+n.deps+' \u00b7 '+i('detail.dependents')+': '+n.dependents;
    document.getElementById('hd-dependents').innerHTML=(n.dependentsList||[]).map(x=>'<li>\u2190 '+x+'</li>').join('')||'<li style="color:var(--text-muted)">'+i('detail.none')+'</li>';
    document.getElementById('hd-deps').innerHTML=(n.dependencies||[]).map(x=>'<li>\u2192 '+x+'</li>').join('')||'<li style="color:var(--text-muted)">'+i('detail.none')+'</li>';
    p.classList.add('open');
  }
  window.closeHierDetail=()=>{document.getElementById('hier-detail').classList.remove('open');hierResetHighlight();tooltip.style.display='none';tooltipLocked=false;};

  // Click on empty space to deselect
  hSvg.on('click',()=>{closeHierDetail();});

  // Hierarchy dir filters
  const hFiltersEl=document.getElementById('hier-filters');
  const hActiveDirs=new Set(DATA.dirs);
  DATA.dirs.forEach(dir=>{
    const pill=document.createElement('div');
    pill.className='filter-pill active';
    pill.innerHTML='<div class="pill-dot" style="background:'+dirColor(dir)+'"></div>'+(dir||'.')+' <span class="pill-count">'+(dirCounts[dir]||0)+'</span>';
    pill.onclick=()=>{
      if(hActiveDirs.has(dir)){hActiveDirs.delete(dir);pill.classList.remove('active');}
      else{hActiveDirs.add(dir);pill.classList.add('active');}
      nodeG.selectAll('.hier-node').attr('opacity',function(){const nId=this.__data_id;return hActiveDirs.has(nodeMap[nId]?.dir)?1:0.1;});
    };
    pill.onmouseenter=()=>{
      nodeG.selectAll('.hier-node').attr('opacity',function(){return this.__data_id&&nodeMap[this.__data_id]?.dir===dir?1:0.1;});
    };
    pill.onmouseleave=()=>{
      nodeG.selectAll('.hier-node').attr('opacity',1);
    };
    hFiltersEl.appendChild(pill);
  });

  hSvg.call(hZoom.transform,d3.zoomIdentity.translate(
    Math.max(0,(W-totalW)/2),20
  ).scale(Math.min(1,W/(totalW+40),H/(totalH+40))));
}

// ═══════════════════════════════════════════════
// DIFF VIEW
// ═══════════════════════════════════════════════
const DIFF = ${diffData};
if (DIFF) {
  document.getElementById('diff-tab').style.display = '';
  const addedSet = new Set(DIFF.added||[]);
  const removedSet = new Set(DIFF.removed||[]);
  const modifiedSet = new Set(DIFF.modified||[]);
  const affectedSet = new Set((DIFF.affectedDependents||[]).map(a=>a.file));

  let diffBuilt = false;
  function buildDiffView() {
    const dSvg = d3.select('#diff-svg').attr('width', W).attr('height', H);
    const dG = dSvg.append('g');
    const dZoom = d3.zoom().scaleExtent([0.05,10]).on('zoom', e=>dG.attr('transform',e.transform));
    dSvg.call(dZoom);

    function diffColor(d) {
      if (addedSet.has(d.id)) return 'var(--green)';
      if (removedSet.has(d.id)) return 'var(--red)';
      if (modifiedSet.has(d.id)) return 'var(--yellow)';
      if (affectedSet.has(d.id)) return 'var(--accent)';
      return '#30363d';
    }

    const dDefs = dSvg.append('defs');
    dDefs.append('marker').attr('id','darrow').attr('viewBox','0 -4 8 8')
      .attr('refX',8).attr('refY',0).attr('markerWidth',7).attr('markerHeight',7).attr('orient','auto')
      .append('path').attr('d','M0,-3.5L8,0L0,3.5Z').attr('fill','#30363d');

    const dLink = dG.append('g').selectAll('line').data(DATA.links).join('line')
      .attr('stroke','#30363d').attr('stroke-width',1).attr('marker-end','url(#darrow)').attr('opacity',0.3);

    const simNodes = DATA.nodes.map(d=>({...d}));
    const simLinks = DATA.links.map(d=>({source:d.source.id??d.source,target:d.target.id??d.target,type:d.type}));

    const dNode = dG.append('g').selectAll('g').data(simNodes).join('g').attr('cursor','pointer');
    dNode.append('circle')
      .attr('r', d=>nodeRadius(d)*nodeScale)
      .attr('fill', diffColor)
      .attr('stroke', diffColor).attr('stroke-width', d=>(addedSet.has(d.id)||removedSet.has(d.id)||modifiedSet.has(d.id)||affectedSet.has(d.id))?3:1)
      .attr('opacity', d=>(addedSet.has(d.id)||removedSet.has(d.id)||modifiedSet.has(d.id)||affectedSet.has(d.id))?1:0.2);
    dNode.append('text')
      .text(d=>fileName(d.id).replace(/\\.tsx?$/,''))
      .attr('dx', d=>nodeRadius(d)*nodeScale+4).attr('dy',3.5).attr('font-size',11)
      .attr('fill', d=>(addedSet.has(d.id)||removedSet.has(d.id)||modifiedSet.has(d.id)||affectedSet.has(d.id))?'var(--text)':'var(--text-muted)')
      .attr('opacity', d=>(addedSet.has(d.id)||removedSet.has(d.id)||modifiedSet.has(d.id)||affectedSet.has(d.id))?1:0.2)
      .attr('pointer-events','none');

    const dSim = d3.forceSimulation(simNodes)
      .force('link', d3.forceLink(simLinks).id(d=>d.id).distance(70).strength(0.25))
      .force('charge', d3.forceManyBody().strength(-150).distanceMax(500))
      .force('center', d3.forceCenter(0,0))
      .force('collision', d3.forceCollide().radius(d=>nodeRadius(d)*nodeScale+4))
      .on('tick', ()=>{
        dLink.each(function(d){
          const dx=d.target.x-d.source.x,dy=d.target.y-d.source.y,dist=Math.sqrt(dx*dx+dy*dy)||1;
          const rT=nodeRadius(d.target)*nodeScale,rS=nodeRadius(d.source)*nodeScale;
          d3.select(this).attr('x1',d.source.x+(dx/dist)*rS).attr('y1',d.source.y+(dy/dist)*rS)
            .attr('x2',d.target.x-(dx/dist)*rT).attr('y2',d.target.y-(dy/dist)*rT);
        });
        dNode.attr('transform', d=>\`translate(\${d.x},\${d.y})\`);
      });

    dNode.on('mouseover',(e,d)=>showTooltip(e,d)).on('mousemove',e=>positionTooltip(e)).on('mouseout',()=>scheduleHideTooltip());

    setTimeout(()=>{
      const b=dG.node().getBBox();if(!b.width)return;
      const s=Math.min(W/(b.width+80),H/(b.height+80))*0.9;
      dSvg.call(dZoom.transform,d3.zoomIdentity.translate(W/2-(b.x+b.width/2)*s,H/2-(b.y+b.height/2)*s).scale(s));
    },1500);
  }

  // Hook into tab switching
  const origTabHandler = document.querySelectorAll('.tab');
  origTabHandler.forEach(tab=>{
    tab.addEventListener('click',()=>{
      if(tab.dataset.view==='diff-view'&&!diffBuilt){buildDiffView();diffBuilt=true;}
    });
  });
}

// ═══════════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════════
applyI18n();
</script>
</body>
</html>`;
}
