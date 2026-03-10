/**
 * HTML body structure for the architecture viewer.
 * Extracted from template.ts for maintainability.
 */
export function buildViewerHtml(): string {
  return `
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
    <button class="settings-btn" onclick="toggleSettings()" title="Settings">\u2699</button>
  </div>
</div>

<!-- Settings panel -->
<div id="settings-panel">
  <h3 data-i18n="settings.title">Settings</h3>
  <div class="setting-group">
    <label data-i18n="settings.theme">Theme</label>
    <div class="theme-toggle">
      <div class="theme-btn active" data-theme-val="dark" onclick="setTheme('dark')">\uD83C\uDF19 Dark</div>
      <div class="theme-btn" data-theme-val="light" onclick="setTheme('light')">\u2600\uFE0F Light</div>
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
  <div id="layer-gravity-setting" class="setting-group" style="display:none">
    <label>Layer Cohesion</label>
    <input type="range" id="layer-gravity-slider" min="1" max="40" value="12" oninput="setLayerGravity(this.value)">
    <div class="setting-value"><span id="layer-gravity-val">12</span></div>
  </div>
  <div class="setting-group">
    <label data-i18n="settings.language">Language</label>
    <div class="theme-toggle">
      <div class="theme-btn lang-btn" data-lang="en" onclick="setLang('en')">English</div>
      <div class="theme-btn lang-btn" data-lang="ja" onclick="setLang('ja')">\u65E5\u672C\u8A9E</div>
    </div>
  </div>
  <div id="cross-layer-setting" class="setting-group" style="display:none">
    <label>Cross-layer Links</label>
    <div class="theme-toggle">
      <div class="theme-btn active" id="cross-link-toggle" onclick="toggleCrossLinks()">ON</div>
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
      <div class="legend-item" style="margin-top:4px;font-size:11px;gap:3px"><span style="color:var(--accent)">\u2014\u2192</span> <span data-i18n="legend.imports">imports</span> <span style="margin-left:6px;color:var(--green)">\u2190\u2014</span> <span data-i18n="legend.importedBy">imported by</span></div>
    </div>
  </div>
  <div id="detail">
    <button class="close-btn" onclick="closeDetail()">\u2715</button>
    <div class="detail-name" id="d-name"></div>
    <div class="detail-meta" id="d-meta"></div>
    <div class="detail-section"><h4 data-i18n="detail.importedBy">Imported by</h4><ul class="detail-list" id="d-dependents"></ul></div>
    <div class="detail-section"><h4 data-i18n="detail.imports">Imports</h4><ul class="detail-list" id="d-deps"></ul></div>
  </div>
  <div id="filter-bar">
    <div id="filter-dir-panel"></div>
    <div id="filter-layer-row"></div>
  </div>
  <div id="zoom-ctrl">
    <button onclick="zoomIn()" title="Zoom in">+</button>
    <button onclick="zoomOut()" title="Zoom out">\u2212</button>
    <button onclick="zoomFit()" title="Fit">\u229E</button>
    <button id="impact-btn" onclick="toggleImpactMode()" title="Impact simulation" style="font-size:12px;margin-top:4px" data-i18n="impact.btn">Impact</button>
  </div>
  <div id="impact-badge"></div>
  <div id="help-bar" data-i18n="help.graph">Scroll: zoom \u00B7 Drag: pan \u00B7 Click: select \u00B7 / search</div>
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
    <button class="close-btn" onclick="closeHierDetail()">\u2715</button>
    <div class="detail-name" id="hd-name"></div>
    <div class="detail-meta" id="hd-meta"></div>
    <div class="detail-section"><h4 data-i18n="detail.importedBy">Imported by</h4><ul class="detail-list" id="hd-dependents"></ul></div>
    <div class="detail-section"><h4 data-i18n="detail.imports">Imports</h4><ul class="detail-list" id="hd-deps"></ul></div>
  </div>
  <div id="hier-filter-bar" style="position:absolute;bottom:12px;left:12px;right:120px;z-index:10;display:none;">
    <div id="hier-filter-row" style="display:flex;flex-wrap:wrap;gap:4px;"></div>
  </div>
  <div id="help-bar" style="position:absolute" data-i18n="help.hierarchy">Scroll to navigate \u00B7 Click to highlight</div>
</div>

<!-- Diff View -->
<div id="diff-view" class="view">
  <svg id="diff-svg"></svg>
  <div id="diff-hud" style="position:absolute;top:12px;left:12px;z-index:10;display:flex;flex-direction:column;gap:8px;">
    <div class="hud-panel">
      <div class="legend-item"><div class="legend-dot" style="background:var(--green)"></div> <span data-i18n="diff.addedLabel">Added</span> <b id="diff-added-count" style="margin-left:auto">0</b></div>
      <div class="legend-item"><div class="legend-dot" style="background:var(--red)"></div> <span data-i18n="diff.removedLabel">Removed</span> <b id="diff-removed-count" style="margin-left:auto">0</b></div>
      <div class="legend-item"><div class="legend-dot" style="background:var(--yellow)"></div> <span data-i18n="diff.modifiedLabel">Modified</span> <b id="diff-modified-count" style="margin-left:auto">0</b></div>
      <div class="legend-item"><div class="legend-dot" style="background:var(--accent)"></div> <span data-i18n="diff.affectedLabel">Affected</span> <b id="diff-affected-count" style="margin-left:auto">0</b></div>
      <div style="margin-top:6px;border-top:1px solid var(--border);padding-top:6px;">
        <button id="diff-focus-btn" onclick="toggleDiffFocus()" style="background:var(--bg);border:1px solid var(--border);border-radius:6px;padding:4px 10px;cursor:pointer;color:var(--text-dim);font-size:11px;width:100%;transition:all 0.15s;" data-i18n="diff.focusChanges">Focus changes</button>
      </div>
    </div>
  </div>
  <div id="diff-detail" style="position:absolute;top:12px;right:12px;width:280px;z-index:10;background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius);padding:16px;font-size:13px;display:none;max-height:calc(100vh - 100px);overflow-y:auto;transition:background 0.3s;">
    <button class="close-btn" onclick="closeDiffDetail()" style="position:absolute;top:8px;right:10px;background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:16px;">\u2715</button>
    <div class="detail-name" id="dd-name"></div>
    <div id="dd-status" style="margin:6px 0;font-size:12px;font-weight:600;"></div>
    <div class="detail-meta" id="dd-meta"></div>
    <div class="detail-section"><h4 data-i18n="diff.affectedByChange">Affected by this change</h4><ul class="detail-list" id="dd-affected"></ul></div>
    <div class="detail-section"><h4 data-i18n="detail.imports">Imports</h4><ul class="detail-list" id="dd-deps"></ul></div>
  </div>
  <div id="help-bar" style="position:absolute" data-i18n="help.diff">Green=added \u00B7 Red=removed \u00B7 Yellow=modified \u00B7 Blue=affected \u00B7 Click: impact chain</div>
</div>

<!-- Tooltip (shared, interactive) -->
<div id="tooltip">
  <div class="tt-name" id="tt-name"></div>
  <div>
    <span class="tt-badge tt-out" id="tt-dep-count"></span> <span data-i18n="tooltip.imports">imports</span>
    <span class="tt-badge tt-in" id="tt-dpt-count" style="margin-left:6px"></span> <span data-i18n="tooltip.importedBy">imported by</span>
  </div>
  <div class="tt-section" id="tt-details"></div>
</div>`;
}
