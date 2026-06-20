// ─── ORION NETWORK GRAPH (D3.js) ─────────────────────────────────────────
import { Persons, Relationships } from './db.js';
import { navigate } from './router.js';
import { avatarEl } from './persons.js';

const REL_COLORS = {
  Familie:      '#ff9f43',
  Freund:       '#00e5ff',
  Partner:      '#fd79a8',
  Kollege:      '#a855f7',
  Feind:        '#ff2d55',
  Einfluss:     '#ffd700',
  Neutral:      '#525c70',
  Vorgesetzter: '#ffd700',
  Untergebener: '#8892a4',
  Konkurrent:   '#ff2d55',
};
const RISK_COLORS = {
  kritisch: '#ff2d55',
  hoch:     '#ffd700',
  mittel:   '#00e5ff',
  niedrig:  '#39ff14',
};

export async function renderNetwork(container) {
  const [persons, relationships] = await Promise.all([Persons.list(), Relationships.listAll()]);

  container.innerHTML = `
    <div class="section-header mb-4 flex justify-between items-center" id="network-header">
      <span class="section-title">Soziales Netzwerk</span>
      <div class="flex gap-2 items-center flex-wrap network-controls">
        <span style="font-size:11px;color:var(--text-muted);font-family:var(--font-mono);" class="hide-on-mobile">${persons.length} P. · ${relationships.length} Vt.</span>
        <input class="form-input input-sm" id="search-graph-nodes" placeholder="Name suchen..." style="width:130px; font-size:11px; padding: 5px 8px;">
        <select class="form-select select-sm" id="filter-rel-type" style="width:120px; font-size:11px; padding: 5px 8px;">
          <option value="">Alle Typen</option>
          ${Object.keys(REL_COLORS).map(type => `<option value="${type}">${type}</option>`).join('')}
        </select>
        <button class="btn btn-ghost btn-sm" id="btn-center-graph" title="Zentrieren" style="padding: 5px 8px;">⊙</button>
      </div>
    </div>
    <div id="legend" style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:12px;">
      ${Object.entries(REL_COLORS).map(([k,v]) => `<span style="font-size:10px;color:${v};font-family:var(--font-mono);">● ${k}</span>`).join('')}
    </div>
    <div class="network-container" style="height:calc(100vh - 220px);">
      <svg id="network-svg"></svg>
    </div>
    <div id="node-tooltip" style="position:fixed;display:none;background:var(--bg-panel);border:1px solid var(--border-glow);border-radius:8px;padding:10px 14px;font-size:12px;pointer-events:none;z-index:1000;max-width:200px;"></div>
  `;

  if (persons.length === 0) {
    container.querySelector('.network-container').innerHTML = `<div class="empty-state" style="padding:60px;"><div class="empty-icon">🕸</div><div class="empty-text">Keine Personen vorhanden</div></div>`;
    return;
  }

  // Wait for D3 to be available
  if (!window.d3) {
    const s = document.createElement('script');
    s.src = 'https://d3js.org/d3.v7.min.js';
    document.head.appendChild(s);
    await new Promise(resolve => s.onload = resolve);
  }

  const svg = document.getElementById('network-svg');
  const rect = svg.parentElement.getBoundingClientRect();
  const W = rect.width, H = rect.height;

  const svgEl = d3.select('#network-svg').attr('width', W).attr('height', H);
  const g = svgEl.append('g');

  // Zoom
  const zoom = d3.zoom().scaleExtent([0.3, 4]).on('zoom', e => g.attr('transform', e.transform));
  svgEl.call(zoom);

  // Prepare data
  const nodes = persons.map(p => ({
    id: p.id, name: p.name, job: p.job, riskLevel: p.riskLevel,
    importance: p.importance || 1, photo: p.photo || null,
  }));
  const links = relationships.map(r => ({
    source: r.fromId, target: r.toId, type: r.type, strength: r.strength || 5,
  })).filter(l => nodes.find(n => n.id === l.source) && nodes.find(n => n.id === l.target));

  // Simulation
  const sim = d3.forceSimulation(nodes)
    .force('link', d3.forceLink(links).id(d => d.id).distance(130))
    .force('charge', d3.forceManyBody().strength(-400))
    .force('center', d3.forceCenter(W / 2, H / 2))
    .force('collision', d3.forceCollide().radius(d => nodeRadius(d) + 20));

  // Links
  const link = g.append('g').selectAll('line').data(links).join('line')
    .attr('stroke', d => REL_COLORS[d.type] || '#525c70')
    .attr('stroke-width', d => Math.sqrt(d.strength || 5) * 0.8)
    .attr('stroke-opacity', 0.6);

  // Link labels
  const linkLabel = g.append('g').selectAll('text').data(links).join('text')
    .text(d => d.type)
    .attr('fill', d => REL_COLORS[d.type] || '#525c70')
    .attr('font-size', 9)
    .attr('font-family', 'JetBrains Mono, monospace')
    .attr('text-anchor', 'middle')
    .attr('opacity', 0.7);

  // Nodes
  const drag = d3.drag()
    .on('start', (e, d) => { if (!e.active) sim.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; })
    .on('drag', (e, d) => { d.fx = e.x; d.fy = e.y; })
    .on('end', (e, d) => { if (!e.active) sim.alphaTarget(0); d.fx = null; d.fy = null; });

  const node = g.append('g').selectAll('g').data(nodes).join('g')
    .call(drag)
    .style('cursor', 'pointer')
    .on('click', (e, d) => navigate('person/' + d.id))
    .on('mouseover', (e, d) => {
      const tt = document.getElementById('node-tooltip');
      tt.innerHTML = `<strong>${d.name}</strong><br><span style="color:var(--text-muted);font-family:var(--font-mono);font-size:10px;">${d.job || '–'}</span><br><span style="color:${RISK_COLORS[d.riskLevel]||'var(--text-muted)'};font-size:10px;">▲ ${d.riskLevel || 'unbekannt'}</span>`;
      tt.style.display = 'block';
      tt.style.left = (e.pageX + 12) + 'px';
      tt.style.top = (e.pageY - 10) + 'px';
    })
    .on('mousemove', (e) => {
      document.getElementById('node-tooltip').style.left = (e.pageX + 12) + 'px';
      document.getElementById('node-tooltip').style.top = (e.pageY - 10) + 'px';
    })
    .on('mouseout', () => { document.getElementById('node-tooltip').style.display = 'none'; });

  node.append('circle')
    .attr('r', d => nodeRadius(d))
    .attr('fill', d => RISK_COLORS[d.riskLevel] + '22' || '#00e5ff22')
    .attr('stroke', d => RISK_COLORS[d.riskLevel] || '#00e5ff')
    .attr('stroke-width', 2);

  // Glow filter + per-node clipPaths for profile photos
  const defs = svgEl.append('defs');
  const filter = defs.append('filter').attr('id', 'glow');
  filter.append('feGaussianBlur').attr('stdDeviation', '3').attr('result', 'coloredBlur');
  const feMerge = filter.append('feMerge');
  feMerge.append('feMergeNode').attr('in', 'coloredBlur');
  feMerge.append('feMergeNode').attr('in', 'SourceGraphic');

  // ClipPath per node (needed so images are clipped to the circle)
  defs.selectAll('clipPath').data(nodes).join('clipPath')
    .attr('id', d => `clip-${d.id}`)
    .append('circle')
    .attr('r', d => nodeRadius(d) - 1);  // 1px inset so stroke stays visible

  node.append('circle')
    .attr('r', d => nodeRadius(d))
    .attr('fill', 'none')
    .attr('stroke', d => RISK_COLORS[d.riskLevel] || '#00e5ff')
    .attr('stroke-width', 0.5)
    .attr('filter', 'url(#glow)');

  // Profile photo (when available)
  node.filter(d => !!d.photo)
    .append('image')
    .attr('href', d => d.photo)
    .attr('x', d => -nodeRadius(d) + 1)
    .attr('y', d => -nodeRadius(d) + 1)
    .attr('width', d => (nodeRadius(d) - 1) * 2)
    .attr('height', d => (nodeRadius(d) - 1) * 2)
    .attr('clip-path', d => `url(#clip-${d.id})`)
    .attr('preserveAspectRatio', 'xMidYMid slice');

  // Initials fallback (only when no photo)
  node.filter(d => !d.photo)
    .append('text')
    .text(d => (d.name || '').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase())
    .attr('text-anchor', 'middle')
    .attr('dy', '0.35em')
    .attr('fill', d => RISK_COLORS[d.riskLevel] || '#00e5ff')
    .attr('font-size', d => Math.max(9, nodeRadius(d) * 0.5))
    .attr('font-weight', '700')
    .attr('font-family', 'JetBrains Mono, monospace');

  // Name label below every node
  node.append('text')
    .text(d => (d.name || '').split(' ')[0])
    .attr('text-anchor', 'middle')
    .attr('dy', d => nodeRadius(d) + 14)
    .attr('fill', '#8892a4')
    .attr('font-size', 10)
    .attr('font-family', 'JetBrains Mono, monospace');

  sim.on('tick', () => {
    link.attr('x1', d => d.source.x).attr('y1', d => d.source.y)
        .attr('x2', d => d.target.x).attr('y2', d => d.target.y);
    linkLabel.attr('x', d => (d.source.x + d.target.x) / 2).attr('y', d => (d.source.y + d.target.y) / 2);
    node.attr('transform', d => `translate(${d.x},${d.y})`);
  });

  container.querySelector('#btn-center-graph').onclick = () => {
    svgEl.transition().duration(750).call(zoom.transform, d3.zoomIdentity.translate(W/2, H/2).scale(1).translate(-W/2, -H/2));
  };

  const filterInput = container.querySelector('#search-graph-nodes');
  const typeSelect = container.querySelector('#filter-rel-type');

  const updateHighlights = () => {
    const q = filterInput.value.toLowerCase().trim();
    const type = typeSelect.value;

    if (!q && !type) {
      node.style('opacity', 1);
      link.style('opacity', 0.6);
      linkLabel.style('opacity', 0.7);
      return;
    }

    const matchedNodeIds = new Set();

    // 1. Find nodes matching search text
    nodes.forEach(n => {
      if (q && n.name.toLowerCase().includes(q)) {
        matchedNodeIds.add(n.id);
      }
    });

    // 2. If search is empty but type is selected, match all nodes connected by that relation type
    if (!q && type) {
      links.forEach(l => {
        if (l.type === type) {
          const srcId = l.source.id || l.source;
          const tgtId = l.target.id || l.target;
          matchedNodeIds.add(srcId);
          matchedNodeIds.add(tgtId);
        }
      });
    }

    // 3. Highlight neighbors of searched nodes
    if (q) {
      const neighbors = new Set();
      links.forEach(l => {
        const srcId = l.source.id || l.source;
        const tgtId = l.target.id || l.target;
        if (matchedNodeIds.has(srcId)) neighbors.add(tgtId);
        if (matchedNodeIds.has(tgtId)) neighbors.add(srcId);
      });
      neighbors.forEach(id => matchedNodeIds.add(id));
    }

    // Apply opacities
    node.style('opacity', d => matchedNodeIds.has(d.id) ? 1 : 0.15);

    link.style('opacity', l => {
      const srcId = l.source.id || l.source;
      const tgtId = l.target.id || l.target;
      const matchType = !type || l.type === type;
      const matchNodes = !q || (matchedNodeIds.has(srcId) && matchedNodeIds.has(tgtId));
      return (matchType && matchNodes) ? 0.6 : 0.05;
    });

    linkLabel.style('opacity', l => {
      const srcId = l.source.id || l.source;
      const tgtId = l.target.id || l.target;
      const matchType = !type || l.type === type;
      const matchNodes = !q || (matchedNodeIds.has(srcId) && matchedNodeIds.has(tgtId));
      return (matchType && matchNodes) ? 0.7 : 0.05;
    });
  };

  filterInput.oninput = updateHighlights;
  typeSelect.onchange = updateHighlights;
}

function nodeRadius(d) {
  return Math.max(14, Math.min(30, (d.importance || 3) * 3.5));
}
