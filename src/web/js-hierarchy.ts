/**
 * Hierarchy view JavaScript for the architecture viewer.
 * Extracted from template.ts for maintainability.
 *
 * Dependencies (defined in core JS before this runs):
 *   DATA, LAYERS, W, H, circularSet, nodeColor, nodeRadius, fileName,
 *   dirColor, dirCounts, activeLayers,
 *   showTooltip, positionTooltip, scheduleHideTooltip, tooltip, tooltipLocked,
 *   hierRelayout, hierSyncFromTab (function pointers set by this module)
 */
export function buildHierarchyJs(): string {
  return `
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
      .attr('data-depth-idx',layer)
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
      .text(fileName(n.id).length>24?fileName(n.id).slice(0,22)+'\\u2026':fileName(n.id));
    gn.append('text').attr('x',boxW-8).attr('y',boxH/2+4)
      .attr('text-anchor','end').attr('font-size',10).attr('fill','var(--text-muted)')
      .text(n.dependents>0?'\\u2191'+n.dependents:'');
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
    document.getElementById('hd-meta').innerHTML=i('detail.dir')+': '+esc(n.dir)+'<br>'+i('detail.dependencies')+': '+n.deps+' \\u00b7 '+i('detail.dependents')+': '+n.dependents;
    document.getElementById('hd-dependents').innerHTML=(n.dependentsList||[]).map(x=>'<li>\\u2190 '+esc(x)+'</li>').join('')||'<li style="color:var(--text-muted)">'+i('detail.none')+'</li>';
    document.getElementById('hd-deps').innerHTML=(n.dependencies||[]).map(x=>'<li>\\u2192 '+esc(x)+'</li>').join('')||'<li style="color:var(--text-muted)">'+i('detail.none')+'</li>';
    p.classList.add('open');
  }
  window.closeHierDetail=()=>{document.getElementById('hier-detail').classList.remove('open');hierResetHighlight();tooltip.style.display='none';tooltipLocked=false;};

  // Click on empty space to deselect
  hSvg.on('click',()=>{closeHierDetail();});

  // Hierarchy filters — layer pills or dir pills
  const hFilterRow=document.getElementById('hier-filter-row');
  const hFilterBar=document.getElementById('hier-filter-bar');
  if (hFilterBar) hFilterBar.style.display='';
  const hActiveLayers=new Set(); // empty = show all (same as graph view)

  function hierRelayoutInner() {
    function isVisible(nId) {
      var nd = nodeMap[nId];
      if (!nd) return false;
      if (LAYERS && nd.layer && hActiveLayers.size > 0 && !hActiveLayers.has(nd.layer)) return false;
      return true;
    }

    // Build visible layer groups and compact Y positions
    var visibleDepths = [];
    var visLayerGroups = {};
    for (var depth = 0; depth <= maxLayer; depth++) {
      var visItems = layerGroups[depth].filter(function(id) { return isVisible(id); });
      if (visItems.length > 0) {
        visLayerGroups[depth] = visItems;
        visibleDepths.push(depth);
      }
    }

    // Recalculate positions for visible nodes (compacted)
    var newPositions = {};
    var newMaxRowWidth = 0;
    visibleDepths.forEach(function(depth) {
      newMaxRowWidth = Math.max(newMaxRowWidth, visLayerGroups[depth].length * (boxW + gapX) - gapX);
    });
    visibleDepths.forEach(function(depth, yIdx) {
      var items = visLayerGroups[depth];
      var rowWidth = items.length * (boxW + gapX) - gapX;
      var startX = padX + (newMaxRowWidth - rowWidth) / 2;
      items.forEach(function(id, idx) {
        newPositions[id] = { x: startX + idx * (boxW + gapX), y: padY + yIdx * (boxH + gapY) };
      });
    });

    // Update SVG size
    var newTotalW = (newMaxRowWidth || 0) + padX * 2;
    var newTotalH = padY * 2 + Math.max(1, visibleDepths.length) * (boxH + gapY);
    hSvg.attr('width', Math.max(newTotalW, W)).attr('height', Math.max(newTotalH, H));

    // Update nodes: hide/show + transition positions
    nodeG.selectAll('.hier-node').each(function() {
      var nId = this.__data_id;
      var el = d3.select(this);
      if (!isVisible(nId) || !newPositions[nId]) {
        el.attr('display', 'none');
      } else {
        el.attr('display', null)
          .transition().duration(300)
          .attr('transform', 'translate(' + newPositions[nId].x + ',' + newPositions[nId].y + ')');
      }
    });

    // Update links: show only if both endpoints visible, recalculate bezier
    linkG.selectAll('path').each(function() {
      var sId = this.getAttribute('data-source');
      var tId = this.getAttribute('data-target');
      var el = d3.select(this);
      if (!isVisible(sId) || !isVisible(tId) || !newPositions[sId] || !newPositions[tId]) {
        el.attr('display', 'none');
      } else {
        var s = newPositions[sId], t = newPositions[tId];
        var x1 = s.x + boxW / 2, y1 = s.y + boxH;
        var x2 = t.x + boxW / 2, y2 = t.y;
        var midY = (y1 + y2) / 2;
        el.attr('display', null)
          .transition().duration(300)
          .attr('d', 'M' + x1 + ',' + y1 + ' C' + x1 + ',' + midY + ' ' + x2 + ',' + midY + ' ' + x2 + ',' + y2);
      }
    });

    // Update depth labels: hide empty depths, reposition visible ones
    hG.selectAll('.hier-layer-label').each(function() {
      var depthIdx = +this.getAttribute('data-depth-idx');
      var el = d3.select(this);
      var yIdx = visibleDepths.indexOf(depthIdx);
      if (yIdx === -1) {
        el.attr('display', 'none');
      } else {
        el.attr('display', null)
          .transition().duration(300)
          .attr('y', padY + yIdx * (boxH + gapY) + boxH / 2 + 4);
      }
    });

    // Close detail panel if pinned node became hidden
    if (hierPinned && !isVisible(hierPinned)) {
      closeHierDetail();
    }
  }

  function hierSyncFromTabInner() {
    if (!LAYERS) return;
    hActiveLayers.clear();
    activeLayers.forEach(function(name) { hActiveLayers.add(name); });
    // Sync pill UI
    hFilterRow.querySelectorAll('.layer-pill').forEach(function(p) {
      var ln = p.dataset.layer;
      if (ln === 'all') {
        p.classList.toggle('active', hActiveLayers.size === 0);
      } else {
        p.classList.toggle('active', hActiveLayers.has(ln));
      }
    });
  }

  if (LAYERS) {
    // "All" button
    const allPill=document.createElement('div');
    allPill.className='layer-pill active';
    allPill.style.fontWeight='400';
    allPill.textContent='All';
    allPill.dataset.layer='all';
    allPill.onclick=()=>{
      hActiveLayers.clear();
      hFilterRow.querySelectorAll('.layer-pill').forEach(p=>p.classList.remove('active'));
      allPill.classList.add('active');
      hierRelayoutInner();
    };
    hFilterRow.appendChild(allPill);

    LAYERS.forEach(layer => {
      const pill=document.createElement('div');
      pill.className='layer-pill';
      pill.dataset.layer=layer.name;
      const count=DATA.nodes.filter(n=>n.layer===layer.name).length;
      pill.innerHTML='<div class="lp-dot" style="background:'+esc(layer.color)+'"></div>'+esc(layer.name)+' <span class="lp-count">'+count+'</span>';
      pill.onclick=(e)=>{
        if (e.shiftKey) {
          hActiveLayers.clear();
          hActiveLayers.add(layer.name);
        } else {
          if (hActiveLayers.has(layer.name)) hActiveLayers.delete(layer.name);
          else hActiveLayers.add(layer.name);
        }
        // Sync pill UI
        hFilterRow.querySelectorAll('.layer-pill').forEach(function(p) {
          var ln = p.dataset.layer;
          if (ln === 'all') p.classList.toggle('active', hActiveLayers.size === 0);
          else p.classList.toggle('active', hActiveLayers.has(ln));
        });
        hierRelayoutInner();
      };
      hFilterRow.appendChild(pill);
    });
  } else {
    const hActiveDirs=new Set(DATA.dirs);
    DATA.dirs.forEach(dir=>{
      const pill=document.createElement('div');
      pill.className='filter-pill active';
      pill.innerHTML='<div class="pill-dot" style="background:'+dirColor(dir)+'"></div>'+esc(dir||'.')+' <span class="pill-count">'+(dirCounts[dir]||0)+'</span>';
      pill.onclick=()=>{
        if(hActiveDirs.has(dir)){hActiveDirs.delete(dir);pill.classList.remove('active');}
        else{hActiveDirs.add(dir);pill.classList.add('active');}
        nodeG.selectAll('.hier-node').attr('opacity',function(){const nId=this.__data_id;return hActiveDirs.has(nodeMap[nId]?.dir)?1:0.1;});
      };
      hFilterRow.appendChild(pill);
    });
  }

  // Assign function pointers for cross-view sync
  hierRelayout = hierRelayoutInner;
  hierSyncFromTab = hierSyncFromTabInner;

  hSvg.call(hZoom.transform,d3.zoomIdentity.translate(
    Math.max(0,(W-totalW)/2),20
  ).scale(Math.min(1,W/(totalW+40),H/(totalH+40))));

  // If layers were already filtered in graph view, sync hierarchy on first build
  if (activeLayers.size > 0) {
    hierSyncFromTabInner();
    hierRelayoutInner();
  }
}
`;
}
