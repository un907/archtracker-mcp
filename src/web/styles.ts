/**
 * CSS styles for the architecture viewer.
 * Extracted from template.ts for maintainability.
 */
export function buildStyles(): string {
  return `<style>
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

/* ─── Diff focus button ──────────────────────── */
#diff-focus-btn.active { background: var(--accent) !important; color: #fff !important; border-color: var(--accent) !important; }

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
</style>`;
}
