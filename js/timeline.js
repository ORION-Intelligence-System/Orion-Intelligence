// ─── ORION GLOBAL TIMELINE ──────────────────────────────────────────────────
import { Interactions, Persons } from './db.js';
import { navigate } from './router.js';
import { avatarEl } from './persons.js';
import { runAlibiScan } from './alibi.js';

export async function renderGlobalTimeline(container) {
  const [allInteractions, allPersons] = await Promise.all([
    Interactions.listAll(),
    Persons.list()
  ]);

  // Sort: Newest first
  allInteractions.sort((a, b) => new Date(b.date) - new Date(a.date));

  container.innerHTML = `
    <div class="section-header mb-4">
      <div class="section-title">Globale Zeitachse <span class="hide-on-mobile">/ Ereignis-Synchronisation</span></div>
      <div style="font-size:11px;color:var(--text-muted);font-family:var(--font-mono);">${allInteractions.length} Ereignisse erfasst</div>
    </div>

    <!-- Alibi Scanner Panel -->
    <div id="alibi-panel" class="card mb-4" style="border-left:3px solid var(--red); padding:0; overflow:hidden;">
      <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px;background:rgba(255,59,59,0.06);border-bottom:1px solid var(--border);cursor:pointer;" id="alibi-toggle">
        <div style="display:flex;align-items:center;gap:10px;">
          <span style="font-size:18px;">🔍</span>
          <div>
            <div style="font-size:13px;font-weight:700;font-family:var(--font-mono);color:var(--red);letter-spacing:0.5px;">ALIBI-PRÜFER</div>
            <div style="font-size:11px;color:var(--text-muted);">Zeitachsen-Kreuzungsanalyse · Widerspruchs-Scanner</div>
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:10px;">
          <button class="btn btn-danger btn-sm" id="btn-run-alibi" style="font-family:var(--font-mono);font-size:11px;">⚡ Scan starten</button>
          <span id="alibi-chevron" style="color:var(--text-muted);font-size:14px;transition:transform 0.2s;">▼</span>
        </div>
      </div>
      <div id="alibi-body" style="padding:0; max-height:0; overflow:hidden; transition:max-height 0.35s ease;">
        <div id="alibi-result" style="padding:16px;">
          <div style="text-align:center;padding:20px;color:var(--text-muted);font-size:12px;font-family:var(--font-mono);">
            Klicke auf "Scan starten" um alle Zeitachsen auf Widersprüche zu prüfen.
          </div>
        </div>
      </div>
    </div>

    <div class="global-timeline-container">
      ${allInteractions.length === 0 ? `
        <div class="empty-state">
          <div class="empty-icon">⏳</div>
          <div class="empty-text">Noch keine Ereignisse erfasst. Füge Interaktionen bei Personen hinzu, um sie hier zu synchronisieren.</div>
        </div>
      ` : `
        <div class="timeline-stream">
          ${renderTimelineItems(allInteractions, allPersons)}
        </div>
      `}
    </div>
  `;

  // ─── Alibi Panel Toggle ────────────────────────────────────────────────────
  const body = container.querySelector('#alibi-body');
  const chevron = container.querySelector('#alibi-chevron');
  let panelOpen = false;

  container.querySelector('#alibi-toggle').addEventListener('click', (e) => {
    if (e.target.closest('#btn-run-alibi')) return;
    panelOpen = !panelOpen;
    body.style.maxHeight = panelOpen ? '2000px' : '0';
    chevron.style.transform = panelOpen ? 'rotate(180deg)' : '';
  });

  // ─── Run Alibi Scan ────────────────────────────────────────────────────────
  container.querySelector('#btn-run-alibi').addEventListener('click', async (e) => {
    e.stopPropagation();
    const btn = container.querySelector('#btn-run-alibi');
    const resultEl = container.querySelector('#alibi-result');
    btn.textContent = '⏳ Analysiere…';
    btn.disabled = true;

    // Auto-open panel
    panelOpen = true;
    body.style.maxHeight = '2000px';
    chevron.style.transform = 'rotate(180deg)';

    resultEl.innerHTML = `
      <div style="display:flex;align-items:center;gap:10px;color:var(--text-muted);font-size:12px;font-family:var(--font-mono);padding:16px;">
        <div class="spinner" style="width:16px;height:16px;border:2px solid var(--border);border-top-color:var(--cyan);border-radius:50%;animation:spin 0.6s linear infinite;"></div>
        Scanne ${allInteractions.length} Interaktionen über ${allPersons.length} Personen…
      </div>
    `;

    try {
      const report = await runAlibiScan();
      renderAlibiReport(resultEl, report, allPersons);
    } catch(err) {
      resultEl.innerHTML = `<div style="color:var(--red);padding:16px;font-size:12px;">Fehler beim Scan: ${err.message}</div>`;
    } finally {
      btn.textContent = '⟳ Erneut scannen';
      btn.disabled = false;
    }
  });
}

// ─── Alibi Report Renderer ────────────────────────────────────────────────────

function renderAlibiReport(el, report, allPersons) {
  const { conflicts, stats } = report;
  const severityLabel = (s) => s >= 3 ? '🔴 KRITISCH' : s === 2 ? '🟡 WARNUNG' : '🔵 HINWEIS';
  const severityColor = (s) => s >= 3 ? 'var(--red)' : s === 2 ? 'var(--gold)' : 'var(--cyan)';

  el.innerHTML = `
    <!-- Stats Bar -->
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:16px;">
      ${[
        ['Gesamt', stats.totalConflicts, stats.totalConflicts > 0 ? 'var(--red)' : 'var(--green)'],
        ['Kritisch', stats.criticalCount, 'var(--red)'],
        ['Warnung', stats.warningCount, 'var(--gold)'],
        ['Betroffene', stats.affectedPersons, 'var(--cyan)'],
      ].map(([label, val, col]) => `
        <div style="background:var(--panel-dark);border:1px solid var(--border);border-radius:8px;padding:10px;text-align:center;">
          <div style="font-size:22px;font-weight:900;font-family:var(--font-mono);color:${col};">${val}</div>
          <div style="font-size:10px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;">${label}</div>
        </div>
      `).join('')}
    </div>

    <div style="font-size:10px;color:var(--text-muted);font-family:var(--font-mono);margin-bottom:12px;padding:4px 8px;background:var(--panel-dark);border-radius:4px;display:inline-block;">
      📊 ${stats.scannedInteractions} Interaktionen · ${stats.scannedPersons} Personen gescannt
    </div>

    ${conflicts.length === 0 ? `
      <div style="text-align:center;padding:24px;color:var(--green);font-family:var(--font-mono);font-size:12px;">
        ✅ Keine Alibi-Widersprüche gefunden. Alle Zeitachsen sind konsistent.
      </div>
    ` : `
      <div style="display:flex;flex-direction:column;gap:10px;">
        ${conflicts.map(c => `
          <div class="alibi-conflict-card" data-conflict-id="${c.id}" style="
            background:var(--panel-dark);
            border:1px solid var(--border);
            border-left:3px solid ${severityColor(c.severity)};
            border-radius:8px;
            padding:12px 16px;
            cursor:pointer;
          ">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
              <div style="display:flex;align-items:center;gap:8px;">
                <span style="font-size:11px;font-weight:700;font-family:var(--font-mono);color:${severityColor(c.severity)};">${severityLabel(c.severity)}</span>
                <span style="font-size:11px;background:${severityColor(c.severity)}22;color:${severityColor(c.severity)};padding:2px 8px;border-radius:4px;font-family:var(--font-mono);">${c.label}</span>
              </div>
              <span style="font-size:10px;color:var(--text-muted);font-family:var(--font-mono);">${new Date(c.timeA).toLocaleDateString('de-DE')}</span>
            </div>
            <div style="font-size:12px;font-weight:600;color:var(--text-primary);margin-bottom:4px;">${c.headline}</div>
            <div style="font-size:11px;color:var(--text-secondary);line-height:1.5;">${c.detail}</div>
            ${c.personAId !== c.personBId ? `
              <div style="display:flex;gap:8px;margin-top:8px;">
                <a onclick="window.navigate('person/${c.personAId}')" style="font-size:11px;color:var(--cyan);cursor:pointer;text-decoration:underline;">→ ${c.personAName}</a>
                <a onclick="window.navigate('person/${c.personBId}')" style="font-size:11px;color:var(--cyan);cursor:pointer;text-decoration:underline;">→ ${c.personBName}</a>
              </div>
            ` : `
              <div style="margin-top:8px;">
                <a onclick="window.navigate('person/${c.personAId}')" style="font-size:11px;color:var(--cyan);cursor:pointer;text-decoration:underline;">→ Profil öffnen: ${c.personAName}</a>
              </div>
            `}
          </div>
        `).join('')}
      </div>
    `}
  `;
}

function renderTimelineItems(interactions, persons) {
  let lastDate = null;

  return interactions.map(i => {
    const person = persons.find(p => p.id === i.personId);
    const dateObj = new Date(i.date);
    const dateStr = dateObj.toLocaleDateString('de-DE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const timeStr = dateObj.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
    
    let dateHeader = '';
    if (dateStr !== lastDate) {
      dateHeader = `<div class="timeline-date-divider">${dateStr}</div>`;
      lastDate = dateStr;
    }

    return `
      ${dateHeader}
      <div class="timeline-card" onclick="window.navigate('person/${i.personId}')">
        <div class="timeline-card-time">${timeStr}</div>
        <div class="timeline-card-main">
          <div class="timeline-card-person">
            <div class="timeline-avatar">${avatarEl(person || {}, 24)}</div>
            <div class="timeline-person-name">${person?.name || 'Unbekannt'}</div>
            <div class="timeline-type-tag" style="background:${typeColor(i.type)}22; color:${typeColor(i.type)};">
              ${i.type}
            </div>
          </div>
          <div class="timeline-content">${i.content}</div>
          ${i.tags ? `<div class="timeline-tags">${i.tags.split(',').map(t => `<span class="badge badge-muted">${t.trim()}</span>`).join('')}</div>` : ''}
          ${i.emotion ? `<div class="timeline-emotion">Gefühlslage: ${i.emotion}</div>` : ''}
        </div>
      </div>
    `;
  }).join('');
}

function typeColor(type) {
  const map = { 
    Konflikt: 'var(--red)', 
    Lüge: 'var(--red)', 
    Drohung: 'var(--red)', 
    Versprechen: 'var(--gold)', 
    Gespräch: 'var(--cyan)', 
    Gefallen: 'var(--green)', 
    Ereignis: 'var(--purple)' 
  };
  return map[type] || 'var(--text-muted)';
}
