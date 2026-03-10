/**
 * Diff view JavaScript for the architecture viewer.
 * Extracted from template.ts for maintainability.
 *
 * Dependencies (defined in core JS before this runs):
 *   DATA, LAYERS, W, H, nodeRadius, nodeScale, fileName, i,
 *   showTooltip, positionTooltip, scheduleHideTooltip
 */
export function buildDiffJs(diffData: string): string {
  return `
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

  // Populate summary counts
  document.getElementById('diff-added-count').textContent = addedSet.size;
  document.getElementById('diff-removed-count').textContent = removedSet.size;
  document.getElementById('diff-modified-count').textContent = modifiedSet.size;
  document.getElementById('diff-affected-count').textContent = affectedSet.size;

  function isDiffNode(id) {
    return addedSet.has(id) || removedSet.has(id) || modifiedSet.has(id) || affectedSet.has(id);
  }

  function diffStatus(id) {
    if (addedSet.has(id)) return 'Added';
    if (removedSet.has(id)) return 'Removed';
    if (modifiedSet.has(id)) return 'Modified';
    if (affectedSet.has(id)) return 'Affected';
    return 'Unchanged';
  }

  function diffStatusColor(id) {
    if (addedSet.has(id)) return 'var(--green)';
    if (removedSet.has(id)) return 'var(--red)';
    if (modifiedSet.has(id)) return 'var(--yellow)';
    if (affectedSet.has(id)) return 'var(--accent)';
    return 'var(--text-muted)';
  }

  // Build reverse dependency map for impact chain
  var diffRevMap = {};
  DATA.links.forEach(function(l) {
    var s = l.source.id ?? l.source, t = l.target.id ?? l.target;
    if (!diffRevMap[t]) diffRevMap[t] = [];
    diffRevMap[t].push(s);
  });

  function getImpactChain(startId) {
    var result = new Set();
    var queue = [startId];
    while (queue.length) {
      var id = queue.shift();
      if (result.has(id)) continue;
      result.add(id);
      (diffRevMap[id] || []).forEach(function(x) { queue.push(x); });
    }
    return result;
  }

  let diffFocusMode = false;
  var dNode, dLink, dSim, simNodes, simLinks;

  window.toggleDiffFocus = function() {
    diffFocusMode = !diffFocusMode;
    var btn = document.getElementById('diff-focus-btn');
    btn.classList.toggle('active', diffFocusMode);
    btn.textContent = diffFocusMode ? i('diff.showAll') : i('diff.focusChanges');
    if (!diffBuilt) return;
    applyDiffFilter();
  };

  window.closeDiffDetail = function() {
    document.getElementById('diff-detail').style.display = 'none';
    if (diffBuilt) resetDiffHighlight();
  };

  function applyDiffFilter() {
    dNode.attr('display', function(d) {
      if (!diffFocusMode) return null;
      return isDiffNode(d.id) ? null : 'none';
    });
    dNode.select('circle')
      .attr('opacity', function(d) {
        if (diffFocusMode) return isDiffNode(d.id) ? 1 : 0;
        return isDiffNode(d.id) ? 1 : 0.12;
      });
    dNode.select('text')
      .attr('opacity', function(d) {
        if (diffFocusMode) return isDiffNode(d.id) ? 1 : 0;
        return isDiffNode(d.id) ? 1 : 0.08;
      });
    dLink.attr('display', function(l) {
      if (!diffFocusMode) return null;
      var s = l.source.id ?? l.source, t = l.target.id ?? l.target;
      return (isDiffNode(s) && isDiffNode(t)) ? null : 'none';
    });
    dLink.attr('opacity', function(l) {
      var s = l.source.id ?? l.source, t = l.target.id ?? l.target;
      if (isDiffNode(s) && isDiffNode(t)) return 0.6;
      if (isDiffNode(s) || isDiffNode(t)) return 0.15;
      return diffFocusMode ? 0 : 0.05;
    });
    dLink.attr('stroke', function(l) {
      var s = l.source.id ?? l.source, t = l.target.id ?? l.target;
      if (isDiffNode(s) && isDiffNode(t)) return diffStatusColor(s);
      return '#30363d';
    });
    dNode.select('circle')
      .attr('stroke-width', function(d) { return isDiffNode(d.id) ? 3 : 1; });
  }

  function resetDiffHighlight() {
    applyDiffFilter();
  }

  function highlightDiffImpact(d) {
    var chain = getImpactChain(d.id);
    dNode.select('circle').transition().duration(200)
      .attr('opacity', function(n) { return chain.has(n.id) ? 1 : 0.04; })
      .attr('stroke-width', function(n) { return chain.has(n.id) && n.id !== d.id ? 3 : isDiffNode(n.id) ? 3 : 1; })
      .attr('stroke', function(n) { return chain.has(n.id) && n.id !== d.id ? 'var(--red)' : diffStatusColor(n.id); });
    dNode.select('text').transition().duration(200)
      .attr('opacity', function(n) { return chain.has(n.id) ? 1 : 0.03; });
    dLink.transition().duration(200)
      .attr('opacity', function(l) {
        var s = l.source.id ?? l.source, t = l.target.id ?? l.target;
        return (chain.has(s) && chain.has(t)) ? 0.8 : 0.03;
      })
      .attr('stroke', function(l) {
        var s = l.source.id ?? l.source, t = l.target.id ?? l.target;
        return (chain.has(s) && chain.has(t)) ? 'var(--red)' : '#30363d';
      });
    return chain;
  }

  function showDiffDetail(d) {
    var panel = document.getElementById('diff-detail');
    document.getElementById('dd-name').textContent = d.id;
    var statusEl = document.getElementById('dd-status');
    statusEl.textContent = diffStatus(d.id);
    statusEl.style.color = diffStatusColor(d.id);
    document.getElementById('dd-meta').innerHTML = i('detail.dir') + ': ' + esc(d.dir) + '<br>' + i('detail.dependencies') + ': ' + d.deps + ' \\u00b7 ' + i('detail.dependents') + ': ' + d.dependents;

    // Show impact chain
    var chain = getImpactChain(d.id);
    chain.delete(d.id);
    var affectedList = document.getElementById('dd-affected');
    if (chain.size > 0) {
      affectedList.innerHTML = Array.from(chain).map(function(id) {
        return '<li style="color:' + diffStatusColor(id) + '">\\u2190 ' + esc(id) + ' <span style="font-size:10px;color:var(--text-muted)">(' + diffStatus(id) + ')</span></li>';
      }).join('');
    } else {
      affectedList.innerHTML = '<li style="color:var(--text-muted)">' + i('diff.noImpact') + '</li>';
    }

    // Show imports
    var depsList = document.getElementById('dd-deps');
    depsList.innerHTML = (d.dependencies || []).map(function(x) {
      return '<li style="color:' + diffStatusColor(x) + '">\\u2192 ' + esc(x) + '</li>';
    }).join('') || '<li style="color:var(--text-muted)">' + i('detail.none') + '</li>';

    panel.style.display = 'block';
  }

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
    // Colored arrow markers for diff edges
    [['var(--green)','darrow-g'],['var(--red)','darrow-r'],['var(--yellow)','darrow-y'],['var(--accent)','darrow-a']].forEach(function(pair) {
      dDefs.append('marker').attr('id',pair[1]).attr('viewBox','0 -4 8 8')
        .attr('refX',8).attr('refY',0).attr('markerWidth',7).attr('markerHeight',7).attr('orient','auto')
        .append('path').attr('d','M0,-3.5L8,0L0,3.5Z').attr('fill',pair[0]);
    });

    simNodes = DATA.nodes.map(d=>({...d, x:undefined, y:undefined, vx:undefined, vy:undefined}));
    simLinks = DATA.links.map(d=>({source:d.source.id??d.source,target:d.target.id??d.target,type:d.type}));

    dLink = dG.append('g').selectAll('line').data(simLinks).join('line')
      .attr('stroke','#30363d').attr('stroke-width',1).attr('marker-end','url(#darrow)').attr('opacity',0.05);

    dNode = dG.append('g').selectAll('g').data(simNodes).join('g').attr('cursor','pointer');
    dNode.append('circle')
      .attr('r', d=>nodeRadius(d)*nodeScale)
      .attr('fill', diffColor)
      .attr('stroke', diffColor).attr('stroke-width', d=>isDiffNode(d.id)?3:1)
      .attr('opacity', d=>isDiffNode(d.id)?1:0.12);
    dNode.append('text')
      .text(d=>fileName(d.id).replace(/\\.tsx?$/,''))
      .attr('dx', d=>nodeRadius(d)*nodeScale+4).attr('dy',3.5).attr('font-size',11)
      .attr('fill', d=>isDiffNode(d.id)?'var(--text)':'var(--text-muted)')
      .attr('opacity', d=>isDiffNode(d.id)?1:0.08)
      .attr('pointer-events','none');

    dSim = d3.forceSimulation(simNodes)
      .force('link', d3.forceLink(simLinks).id(d=>d.id).distance(70).strength(0.25))
      .force('charge', d3.forceManyBody().strength(-150).distanceMax(500))
      .force('center', d3.forceCenter(0,0))
      .force('collision', d3.forceCollide().radius(d=>nodeRadius(d)*nodeScale+4));

    // Layer-aware physics for diff view (same pattern as graph view)
    var dHullGroup = null;
    if (LAYERS && LAYERS.length > 0) {
      var dLayerCenters = {};
      var dLayerCount = LAYERS.length;
      var dBaseRadius = Math.max(60, Math.min(W, H) * 0.04 * Math.sqrt(dLayerCount));
      LAYERS.forEach(function(l, idx) {
        var angle = (2 * Math.PI * idx) / dLayerCount - Math.PI / 2;
        dLayerCenters[l.name] = { x: Math.cos(angle) * dBaseRadius, y: Math.sin(angle) * dBaseRadius };
      });
      dSim.force('center', null);
      dSim.force('layerX', d3.forceX(function(d) { return dLayerCenters[d.layer]?.x || 0; }).strength(function(d) { return d.layer ? 0.12 : 0.03; }));
      dSim.force('layerY', d3.forceY(function(d) { return dLayerCenters[d.layer]?.y || 0; }).strength(function(d) { return d.layer ? 0.12 : 0.03; }));
      dSim.force('link').strength(function(l) {
        var sL = l.source.layer ?? l.source, tL = l.target.layer ?? l.target;
        return sL === tL ? 0.4 : 0.1;
      });
      // Cluster force for diff view
      dSim.force('cluster', (function() {
        var ns;
        function f(alpha) {
          var centroids = {}, counts = {};
          ns.forEach(function(n) {
            if (!n.layer) return;
            if (!centroids[n.layer]) { centroids[n.layer] = {x:0,y:0}; counts[n.layer] = 0; }
            centroids[n.layer].x += n.x; centroids[n.layer].y += n.y; counts[n.layer]++;
          });
          Object.keys(centroids).forEach(function(k) { centroids[k].x /= counts[k]; centroids[k].y /= counts[k]; });
          ns.forEach(function(n) {
            if (!n.layer || !centroids[n.layer]) return;
            n.vx += (centroids[n.layer].x - n.x) * alpha * 0.2;
            n.vy += (centroids[n.layer].y - n.y) * alpha * 0.2;
          });
        }
        f.initialize = function(n) { ns = n; };
        return f;
      })());

      dHullGroup = dG.insert('g', ':first-child');
    }

    function updateDiffHulls() {
      if (!dHullGroup) return;
      dHullGroup.selectAll('*').remove();
      LAYERS.forEach(function(layer) {
        var layerNodes = simNodes.filter(function(n) { return n.layer === layer.name; });
        if (layerNodes.length === 0) return;
        if (diffFocusMode && !layerNodes.some(function(n) { return isDiffNode(n.id); })) return;
        var hasDiff = layerNodes.some(function(n) { return isDiffNode(n.id); });

        var points = [];
        layerNodes.forEach(function(n) {
          if (n.x == null || n.y == null) return;
          if (diffFocusMode && !isDiffNode(n.id)) return;
          var r = nodeRadius(n) * nodeScale + 30;
          for (var a = 0; a < Math.PI * 2; a += Math.PI / 4) {
            points.push([n.x + Math.cos(a) * r, n.y + Math.sin(a) * r]);
          }
        });

        var fillOp = hasDiff ? 0.15 : 0.06;
        var strokeOp = hasDiff ? 0.6 : 0.2;
        var sw = hasDiff ? 2.5 : 1;
        if (points.length < 6) {
          var cx = layerNodes.reduce(function(s, n) { return s + (n.x||0); }, 0) / layerNodes.length;
          var cy = layerNodes.reduce(function(s, n) { return s + (n.y||0); }, 0) / layerNodes.length;
          dHullGroup.append('circle').attr('cx', cx).attr('cy', cy).attr('r', 50)
            .attr('fill', layer.color).attr('fill-opacity', fillOp)
            .attr('stroke', layer.color).attr('stroke-opacity', strokeOp).attr('stroke-width', sw);
        } else {
          var hull = d3.polygonHull(points);
          if (hull) {
            dHullGroup.append('path')
              .attr('d', 'M' + hull.map(function(p) { return p.join(','); }).join('L') + 'Z')
              .attr('fill', layer.color).attr('fill-opacity', fillOp)
              .attr('stroke', layer.color).attr('stroke-opacity', strokeOp).attr('stroke-width', sw)
              .attr('stroke-dasharray', hasDiff ? null : '6,3');
          }
        }
        // Layer name label
        var visNodes = diffFocusMode ? layerNodes.filter(function(n) { return isDiffNode(n.id); }) : layerNodes;
        if (visNodes.length === 0) return;
        var lx = visNodes.reduce(function(s, n) { return s + (n.x||0); }, 0) / visNodes.length;
        var ly = Math.min.apply(null, visNodes.map(function(n) { return n.y||0; })) - 25;
        dHullGroup.append('text')
          .attr('x', lx).attr('y', ly).attr('text-anchor', 'middle')
          .attr('fill', layer.color).attr('fill-opacity', hasDiff ? 0.9 : 0.4)
          .attr('font-size', 12).attr('font-weight', 600).text(layer.name);
      });
    }

    var dTickCount = 0;
    dSim.on('tick', function() {
        dLink.each(function(d) {
          var dx=d.target.x-d.source.x, dy=d.target.y-d.source.y, dist=Math.sqrt(dx*dx+dy*dy)||1;
          var rT=nodeRadius(d.target)*nodeScale, rS=nodeRadius(d.source)*nodeScale;
          d3.select(this).attr('x1',d.source.x+(dx/dist)*rS).attr('y1',d.source.y+(dy/dist)*rS)
            .attr('x2',d.target.x-(dx/dist)*rT).attr('y2',d.target.y-(dy/dist)*rT);
        });
        dNode.attr('transform', function(d) { return 'translate('+d.x+','+d.y+')'; });
        if (++dTickCount % 5 === 0) updateDiffHulls();
      });

    // Click: show impact chain + detail panel
    dNode.on('click', function(e, d) {
      e.stopPropagation();
      highlightDiffImpact(d);
      showDiffDetail(d);
    });

    // Click on empty space to deselect
    dSvg.on('click', function() {
      closeDiffDetail();
    });

    dNode.on('mouseover',function(e,d) { showTooltip(e,d); }).on('mousemove',function(e) { positionTooltip(e); }).on('mouseout',function() { scheduleHideTooltip(); });

    // Apply initial filter (in case focus was toggled before build)
    applyDiffFilter();

    dSim.on('end', function() {
      var b=dG.node().getBBox(); if(!b.width) return;
      var s=Math.min(W/(b.width+80),H/(b.height+80))*0.9;
      dSvg.call(dZoom.transform,d3.zoomIdentity.translate(W/2-(b.x+b.width/2)*s,H/2-(b.y+b.height/2)*s).scale(s));
    });
  }

}
`;
}
