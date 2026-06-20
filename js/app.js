// ─── ORION APP.JS — Main Controller ──────────────────────────────────────
import { openDB, Persons, Interactions, getSetting, setSetting } from './db.js';
import { route, initRouter, navigate } from './router.js';
import { initSecurity, initPanicMode, showToast } from './security.js';
import { renderPersonsList } from './persons.js';
import { renderPersonDetail } from './person-detail.js';
import { renderNetwork } from './network.js';
import { renderMap } from './map.js';
import { renderGlobalTimeline } from './timeline.js';
import { initSearch } from './search.js';
import { playNav, playClick, playBoot, playSave, playDelete, playWarning } from './audio.js';

const workspace = () => document.getElementById('workspace-body');

// ─── Dashboard ─────────────────────────────────────────────────────────────
async function renderDashboard() {
  setHeader('Dashboard', 'layout-dashboard');
  const [persons, interactions] = await Promise.all([Persons.list(), Interactions.listAll()]);
  const riskPersons = persons.filter(p => p.riskLevel === 'kritisch' || p.riskLevel === 'hoch');
  const recentInteractions = interactions.sort((a,b) => new Date(b.date)-new Date(a.date)).slice(0,5);

  workspace().innerHTML = `
    <div class="dash-grid">
      <div class="dash-stat stat-cyan">
        <div class="dash-stat-label">Personen</div>
        <div class="dash-stat-value">${persons.length}</div>
        <div class="dash-stat-sub">im Archiv</div>
      </div>
      <div class="dash-stat stat-red">
        <div class="dash-stat-label">Risikopersonen</div>
        <div class="dash-stat-value">${riskPersons.length}</div>
        <div class="dash-stat-sub">hoch/kritisch</div>
      </div>
      <div class="dash-stat stat-gold">
        <div class="dash-stat-label">Interaktionen</div>
        <div class="dash-stat-value">${interactions.length}</div>
        <div class="dash-stat-sub">dokumentiert</div>
      </div>
    </div>

    <div class="dash-columns">
      <div>
        <div class="section-header mb-3"><span class="section-title"><i data-lucide="alert-triangle" style="width:14px;color:var(--red);"></i> Risikopersonen</span><button class="btn btn-ghost btn-sm" onclick="navigate('persons')">Alle →</button></div>
        ${riskPersons.length === 0
          ? '<div class="card"><div style="text-align:center;color:var(--text-muted);padding:20px;">Keine Risikopersonen</div></div>'
          : riskPersons.slice(0,5).map(p => `
            <div class="card mb-2 flex items-center gap-3" style="cursor:pointer;" onclick="navigate('person/${p.id}')">
              <div style="width:10px;height:10px;border-radius:50%;background:${p.riskLevel==='kritisch'?'var(--red)':'var(--gold)'};box-shadow:0 0 8px ${p.riskLevel==='kritisch'?'var(--red)':'var(--gold)'};flex-shrink:0;"></div>
              <div style="flex:1;"><div style="font-size:13px;font-weight:600;">${p.name}</div><div style="font-size:10px;color:var(--text-muted);font-family:var(--font-mono);">${p.job||'–'}</div></div>
              <span class="badge ${p.riskLevel==='kritisch'?'badge-red':'badge-gold'}">${p.riskLevel}</span>
            </div>
          `).join('')
        }
      </div>
      <div>
        <div class="section-header mb-3"><span class="section-title"><i data-lucide="activity" style="width:14px;color:var(--cyan);"></i> Letzte Aktivität</span></div>
        ${recentInteractions.length === 0
          ? '<div class="card"><div style="text-align:center;color:var(--text-muted);padding:20px;">Keine Aktivitäten</div></div>'
          : recentInteractions.map(i => {
            const p = persons.find(x => x.id === i.personId);
            return `<div class="card mb-2" style="cursor:pointer;" onclick="navigate('person/${i.personId}')">
              <div style="font-size:9px;color:var(--text-muted);font-family:var(--font-mono);">${new Date(i.date).toLocaleString('de-DE')} · ${i.type} · ${p?.name||'–'}</div>
              <div style="font-size:12px;color:var(--text-primary);margin-top:4px;">${i.content.slice(0,100)}${i.content.length>100?'…':''}</div>
            </div>`;
          }).join('')
        }
      </div>
    </div>

    <div style="margin-top:20px;">
      <div class="section-header mb-3"><span class="section-title"><i data-lucide="zap" style="width:14px;color:var(--gold);"></i> Schnellzugriff</span></div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;">
        <button class="btn btn-primary" id="qs-add-person"><i data-lucide="user-plus" style="width:14px;"></i> Person hinzufügen</button>
        <button class="btn btn-primary" id="qs-export-all" style="background:#6a00ff;color:white;border:none;"><i data-lucide="folder-output" style="width:14px;"></i> Globaler Export (ZIP)</button>
        <button class="btn btn-ghost" onclick="navigate('network')"><i data-lucide="network" style="width:14px;"></i> Netzwerk anzeigen</button>
        <button class="btn btn-ghost" id="qs-search"><i data-lucide="search" style="width:14px;"></i> Suchen (Ctrl+K)</button>
        <button class="btn btn-gold" onclick="navigate('settings')"><i data-lucide="settings" style="width:14px;"></i> Einstellungen</button>
      </div>
    </div>
  `;
  if (window.lucide) window.lucide.createIcons();

  document.getElementById('qs-add-person')?.addEventListener('click', () => {
    import('./persons.js').then(m => m.openPersonModal(null, () => renderDashboard()));
  });
  document.getElementById('qs-search')?.addEventListener('click', () => {
    import('./search.js').then(m => m.initSearch());
    document.dispatchEvent(new KeyboardEvent('keydown', { ctrlKey: true, key: 'k' }));
  });

  document.getElementById('qs-export-all')?.addEventListener('click', async () => {
    const btn = document.getElementById('qs-export-all');
    btn.textContent = '⏳ Exportiere...';
    try {
      const JSZip = window.JSZip;
      if (!JSZip) throw new Error("JSZip Bibliothek nicht geladen.");
      const zip = new JSZip();
      const { Persons, Interactions, Relationships, Files } = await import('./db.js');
      const { exportPersonPDF } = await import('./export.js');
      const AI = await import('./ai.js');
      
      const persons = await Persons.list();
      const allInteractions = await Interactions.listAll();
      const allRels = await Relationships.listAll();
      const allFiles = await Files.listAll();
      const { showToast } = await import('./security.js');
      
      showToast('Generiere ZIP für ' + persons.length + ' Personen...', 'cyan');

      for (const p of persons) {
        const pInteractions = allInteractions.filter(i => i.personId === p.id);
        const pRels = allRels.filter(r => r.fromId === p.id);
        const pFiles = allFiles.filter(f => f.personId === p.id);
        const safeName = (p.name || 'Unbekannt').replace(/[^a-z0-9]/gi, '_');
        const pFolder = zip.folder(`Akte_${safeName}`);
        
        const profileText = AI.buildPersonContext(p, pInteractions);
        pFolder.file(`Profil_${safeName}.txt`, profileText);
        
        if (p.photo && p.photo.includes('base64,')) {
          const parts = p.photo.split(';base64,');
          const ext = parts[0].split('/')[1] || 'jpg';
          pFolder.file(`Profilbild.${ext}`, parts[1], { base64: true });
        }
        
        const pdfObj = await exportPersonPDF(p, pInteractions, pRels, true);
        pFolder.file(pdfObj.filename, pdfObj.blob);
        
        if (pFiles.length > 0) {
          const attachmentsFolder = pFolder.folder('Dateien');
          for (const f of pFiles) {
            if (f.data && f.data.includes('base64,')) {
              const uniqueName = f.id.slice(0, 8) + '_' + f.name;
              attachmentsFolder.file(uniqueName, f.data.split(';base64,')[1], { base64: true });
            }
          }
        }
      }
      
      const backupData = {
        persons,
        interactions: allInteractions,
        relationships: allRels,
        files: allFiles,
        exportedAt: new Date().toISOString(),
      };
      zip.file('orion_backup.json', JSON.stringify(backupData, null, 2));
      
      const content = await zip.generateAsync({ type: 'blob' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(content);
      a.download = `ORION_Global_Export_${new Date().toISOString().slice(0,10)}.zip`;
      a.click();
      playSave();
      showToast('🌍 Globaler ZIP-Export abgeschlossen!', 'cyan');
    } catch(err) {
      import('./security.js').then(s => s.showToast('Exportfehler: ' + err.message, 'red'));
    }
    btn.textContent = '🌍 Globaler Export (ZIP)';
  });
}

// ─── Settings View ─────────────────────────────────────────────────────────
async function renderSettings() {
  setHeader('Einstellungen', 'settings');
  const { getSetting: gs, setSetting: ss } = await import('./db.js');
  const apiKey = await gs('openai_key') || '';
  const pin = await gs('pin') || '';

  workspace().innerHTML = `
    <div style="max-width:600px;">

      <div class="settings-section">
        <div class="settings-section-title"><i data-lucide="lock" style="width:14px;display:inline-block;vertical-align:middle;"></i> Sicherheit</div>
        <div class="form-group">
          <label class="form-label">PIN ${pin ? '(gesetzt ✓)' : '(nicht gesetzt)'}</label>
          <input class="form-input" type="password" id="pin-input" placeholder="Neuer 6-stelliger PIN" maxlength="6">
        </div>
        <div style="display:flex;gap:8px;">
          <button class="btn btn-primary" id="btn-save-pin"><i data-lucide="save" style="width:14px;margin-right:4px;"></i> PIN setzen</button>
          ${pin ? '<button class="btn btn-danger" id="btn-remove-pin"><i data-lucide="trash-2" style="width:14px;margin-right:4px;"></i> PIN entfernen</button>' : ''}
        </div>
        <div style="margin-top:12px;padding:10px;background:var(--bg-input);border-radius:6px;font-size:11px;color:var(--text-muted);font-family:var(--font-mono);">
          <strong style="color:var(--cyan);">Panic Mode:</strong> Ctrl+Shift+X → Fake-Notiz-App<br>
          <strong style="color:var(--cyan);">Entsperren:</strong> Ctrl+Shift+Z
        </div>
      </div>

      <div class="settings-section">
        <div class="settings-section-title"><i data-lucide="database" style="width:14px;display:inline-block;vertical-align:middle;"></i> Daten</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          <button class="btn btn-ghost" id="btn-export-data"><i data-lucide="upload" style="width:14px;margin-right:4px;"></i> Daten exportieren (JSON)</button>
          <button class="btn btn-ghost" id="btn-import-data"><i data-lucide="download" style="width:14px;margin-right:4px;"></i> Daten importieren</button>
          <input type="file" id="import-file" accept=".json,.zip" style="display:none;">
          <button class="btn btn-danger" id="btn-clear-data"><i data-lucide="trash-2" style="width:14px;margin-right:4px;"></i> Alle Daten löschen</button>
        </div>
      </div>

      <div class="settings-section">
        <div class="settings-section-title"><i data-lucide="info" style="width:14px;display:inline-block;vertical-align:middle;"></i> Info</div>
        <div style="font-size:12px;color:var(--text-muted);line-height:1.8;font-family:var(--font-mono);">
          ORION Intelligence v1.0<br>
          Lokale Web-App · IndexedDB Speicher<br>
          Alle Daten bleiben auf deinem Gerät.
        </div>
      </div>
    </div>
  `;
  if (window.lucide) window.lucide.createIcons();

  document.getElementById('btn-save-pin').onclick = async () => {
    const { changePin } = await import('./security.js');
    const pin = document.getElementById('pin-input').value;
    if (pin.length !== 6) { showToast('PIN muss genau 6-stellig sein', 'red'); return; }
    await changePin(pin);
    renderSettings();
  };
  document.getElementById('btn-remove-pin')?.addEventListener('click', async () => {
    const { removePin } = await import('./security.js');
    await removePin();
    renderSettings();
  });
  document.getElementById('btn-export-data').onclick = async () => {
    const { Persons, Interactions, Relationships, Files } = await import('./db.js');
    const data = {
      persons: await Persons.list(),
      interactions: await Interactions.listAll(),
      relationships: await Relationships.listAll(),
      files: await Files.listAll(),
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `orion_backup_${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    showToast('Backup exportiert', 'cyan');
  };
  document.getElementById('btn-import-data').onclick = () => document.getElementById('import-file').click();
  document.getElementById('import-file').onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      let data;
      if (file.name.endsWith('.zip')) {
        const JSZip = window.JSZip;
        if (!JSZip) throw new Error("JSZip Bibliothek nicht geladen.");
        const zip = await JSZip.loadAsync(file);
        const backupFile = zip.file("orion_backup.json");
        if (!backupFile) throw new Error("Keine 'orion_backup.json' im ZIP gefunden.");
        const text = await backupFile.async("string");
        data = JSON.parse(text);
      } else {
        const text = await file.text();
        data = JSON.parse(text);
      }
      const { put } = await import('./db.js');
      for (const p of data.persons || []) await put('persons', p);
      for (const i of data.interactions || []) await put('interactions', i);
      for (const r of data.relationships || []) await put('relationships', r);
      for (const f of data.files || []) await put('files', f);
      playSave();
      showToast(`Import: ${data.persons?.length||0} Personen`, 'cyan');
    } catch(err) { showToast('Import fehlgeschlagen: ' + err.message, 'red'); }
  };
  document.getElementById('btn-clear-data').onclick = async () => {
    if (!confirm('ALLE DATEN löschen? Das kann nicht rückgängig gemacht werden!')) return;
    const { Persons, Interactions, Relationships, Files } = await import('./db.js');
    const persons = await Persons.list();
    const interactions = await Interactions.listAll();
    const relationships = await Relationships.listAll();
    const files = await Files.listAll();
    await Promise.all([...persons.map(p => Persons.del(p.id)), ...interactions.map(i => Interactions.del(i.id)), ...relationships.map(r => Relationships.del(r.id)), ...files.map(f => Files.del(f.id))]);
    playDelete();
    showToast('Alle Daten gelöscht', 'red');
    renderDashboard();
    navigate('dashboard');
  };
}

// ─── Risks Page ────────────────────────────────────────────────────────────
async function renderRisksPage() {
  setHeader('Risiken', 'alert-triangle');
  const [persons, interactions] = await Promise.all([Persons.list(), Interactions.listAll()]);
  const sorted = persons.map(p => {
    const risk = p.riskLevel === 'kritisch' ? 4 : p.riskLevel === 'hoch' ? 3 : p.riskLevel === 'mittel' ? 2 : 1;
    const conflicts = interactions.filter(i => i.personId === p.id && ['Konflikt','Lüge','Drohung'].includes(i.type)).length;
    return { ...p, riskScore: risk * 25 + conflicts * 5, conflicts };
  }).sort((a,b) => b.riskScore - a.riskScore);

  workspace().innerHTML = `
    <div class="section-header mb-4"><span class="section-title">Risiko-Register</span></div>
    <div style="display:flex;flex-direction:column;gap:8px;">
      ${sorted.map(p => `
        <div class="card flex items-center gap-3 ${p.riskLevel==='kritisch'?'card-glow-red':''}" style="cursor:pointer;" onclick="navigate('person/${p.id}')">
          <div style="width:3px;height:40px;border-radius:2px;background:${p.riskLevel==='kritisch'?'var(--red)':p.riskLevel==='hoch'?'var(--gold)':p.riskLevel==='mittel'?'var(--cyan)':'var(--green)'};flex-shrink:0;"></div>
          <div style="flex:1;">
            <div style="font-size:14px;font-weight:600;">${p.name}</div>
            <div style="font-size:11px;color:var(--text-muted);">${p.job||'–'} · ${p.conflicts} Konflikte</div>
          </div>
          <div style="font-size:24px;font-weight:900;font-family:var(--font-mono);color:${p.riskLevel==='kritisch'?'var(--red)':p.riskLevel==='hoch'?'var(--gold)':p.riskLevel==='mittel'?'var(--cyan)':'var(--green)'};">${Math.min(100, p.riskScore)}%</div>
          <span class="badge ${p.riskLevel==='kritisch'?'badge-red':p.riskLevel==='hoch'?'badge-gold':p.riskLevel==='mittel'?'badge-cyan':'badge-green'}">${p.riskLevel||'niedrig'}</span>
        </div>
      `).join('')}
      ${sorted.length === 0 ? '<div class="empty-state"><div class="empty-icon">✅</div><div class="empty-text">Keine Personen vorhanden</div></div>' : ''}
    </div>
  `;
}


// ─── AI Page ───────────────────────────────────────────────────────────────
async function renderAIPage() {
  setHeader('KI-Analyse', '🤖');
  const persons = await Persons.list();
  workspace().innerHTML = `
    <div class="section-header mb-4"><span class="section-title">KI Intelligence Center</span></div>
    <div class="card mb-4" style="padding:20px;">
      <div style="font-size:13px;color:var(--text-muted);margin-bottom:16px;">Person für Analyse auswählen:</div>
      <select class="form-select" id="ai-person-select" style="max-width:300px;">
        <option value="">Person wählen...</option>
        ${persons.map(p => `<option value="${p.id}">${p.name}</option>`).join('')}
      </select>
      <div class="ai-quick-btns" id="ai-action-btns" style="display:none; margin-top:16px;">
        <button class="ai-quick-btn" data-ai="quick"><i data-lucide="zap" style="color:var(--cyan);"></i> Schnellanalyse</button>
        <button class="ai-quick-btn" data-ai="deep"><i data-lucide="brain" style="color:var(--gold);"></i> Tiefenanalyse</button>
        <button class="ai-quick-btn" data-ai="strategy"><i data-lucide="target"></i> Strategie</button>
        <button class="ai-quick-btn" data-ai="risk"><i data-lucide="alert-triangle" style="color:var(--red);"></i> Risikoanalyse</button>
      </div>
    </div>
    <div id="ai-page-result"></div>
  `;

  const select = document.getElementById('ai-person-select');
  const btns = document.getElementById('ai-action-btns');
  const result = document.getElementById('ai-page-result');

  select.onchange = () => { btns.style.display = select.value ? 'flex' : 'none'; };

  btns.querySelectorAll('[data-ai]').forEach(btn => {
    btn.onclick = async () => {
      btns.querySelectorAll('[data-ai]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const personId = select.value;
      if (!personId) return;
      const { Persons, Interactions } = await import('./db.js');
      const [p, interactions] = await Promise.all([Persons.get(personId), Interactions.listByPerson(personId)]);
      
      const AI = await import('./ai.js');
      let promptText = '';
      if (btn.dataset.ai === 'quick') promptText = AI.quickAnalysis(p);
      else if (btn.dataset.ai === 'deep') promptText = AI.deepAnalysis(p, interactions);
      else if (btn.dataset.ai === 'strategy') promptText = AI.strategyMode(p);
      else if (btn.dataset.ai === 'risk') promptText = AI.conflictRisk(p, interactions);
      
      result.innerHTML = `
        <div class="ai-message assistant" style="padding:0; overflow:hidden;">
          <div style="background:var(--panel-dark); padding:10px 16px; border-bottom:1px solid var(--border); display:flex; justify-content:space-between; align-items:center;">
            <span style="font-size:11px; color:var(--text-muted); font-family:var(--font-mono);">🤖 KI-PROMPT GENERIERT: ${btn.textContent}</span>
            <button class="btn btn-primary btn-sm" onclick="navigator.clipboard.writeText(this.parentElement.nextElementSibling.value); this.textContent='✓ Kopiert'; setTimeout(()=>this.textContent='📋 Kopieren', 2000);">📋 Kopieren</button>
          </div>
          <textarea readonly class="form-textarea" style="width:100%; height:300px; border:none; resize:vertical; font-family:var(--font-mono); font-size:12px; line-height:1.5; padding:16px; background:transparent;">${promptText.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</textarea>
        </div>
        <div style="margin-top:12px; font-size:12px; color:var(--text-muted); line-height:1.6;">
          ℹ️ <strong>Wie es funktioniert:</strong> Kopiere diesen Kontext-Prompt und füge ihn in <a href="https://chatgpt.com" target="_blank" style="color:var(--cyan);">ChatGPT</a>, <a href="https://gemini.google.com" target="_blank" style="color:var(--cyan);">Gemini</a> oder Claude ein, um die Analyse zu erhalten.
        </div>
      `;
    };
  });
}

// ─── Right Panel ───────────────────────────────────────────────────────────
async function updateRightPanel() {
  const [persons, interactions] = await Promise.all([Persons.list(), Interactions.listAll()]);
  const riskPersons = persons.filter(p => ['kritisch','hoch'].includes(p.riskLevel));
  const recentConflicts = interactions.filter(i => ['Konflikt','Lüge','Drohung'].includes(i.type)).sort((a,b) => new Date(b.date)-new Date(a.date)).slice(0,5);

  const warningsEl = document.getElementById('rp-warnings');
  if (warningsEl) {
    warningsEl.innerHTML = riskPersons.length === 0 && recentConflicts.length === 0
      ? '<div style="padding:12px;text-align:center;color:var(--text-muted);font-size:12px;">Keine Warnungen</div>'
      : `
        ${riskPersons.map(p => `
          <div class="warning-item" style="cursor:pointer;" onclick="navigate('person/${p.id}')">
            <span class="warning-icon"><i data-lucide="${p.riskLevel==='kritisch'?'alert-circle':'alert-triangle'}" style="width:14px;color:${p.riskLevel==='kritisch'?'var(--red)':'var(--gold)'};"></i></span>
            <div><div class="warning-text">${p.name}</div><div class="warning-meta">${p.riskLevel?.toUpperCase()}</div></div>
          </div>
        `).join('')}
        ${recentConflicts.map(i => {
          const p = persons.find(x => x.id === i.personId);
          return `<div class="warning-item" style="cursor:pointer;" onclick="navigate('person/${i.personId}')">
            <span class="warning-icon"><i data-lucide="alert-triangle" style="width:14px;color:var(--red);"></i></span>
            <div><div class="warning-text">${i.type}: ${i.content.slice(0,50)}…</div><div class="warning-meta">${p?.name||'–'} · ${new Date(i.date).toLocaleDateString('de-DE')}</div></div>
          </div>`;
        }).join('')}
      `;
    if (window.lucide) window.lucide.createIcons();
  }
}

// ─── Helper ────────────────────────────────────────────────────────────────
function setHeader(title, icon) {
  const el = document.getElementById('workspace-title-text');
  if (el) el.innerHTML = `${icon} ${title}`;
  document.querySelectorAll('.nav-item').forEach(n =>
    n.classList.toggle('active', n.dataset.route === window.location.hash.replace('#',''))
  );
  playNav();
}

// ─── Init ──────────────────────────────────────────────────────────────────
async function init() {
  await openDB();
  await import('./security.js').then(s => { s.initSecurity(); s.initPanicMode(); });
  initSearch();

  // Set up routes
  route('dashboard', () => renderDashboard());
  route('persons', () => {
    setHeader('Personen', '👥');
    renderPersonsList(workspace());
  });
  route('person/:id', ({ id }) => {
    setHeader('Person', '👤');
    renderPersonDetail(workspace(), id);
  });
  route('network', () => {
    setHeader('Netzwerk', '🕸');
    renderNetwork(workspace());
  });
  route('map', () => {
    setHeader('Karte', '<i data-lucide="map" style="width:16px;margin-right:6px;vertical-align:text-bottom;"></i>');
    renderMap(workspace()).then(() => {
      if (window.lucide) window.lucide.createIcons();
    });
  });
  route('timeline', () => {
    setHeader('Zeitachse', '<i data-lucide="history" style="width:16px;margin-right:6px;vertical-align:text-bottom;"></i>');
    renderGlobalTimeline(workspace()).then(() => {
      if (window.lucide) window.lucide.createIcons();
    });
  });
  route('risks', () => renderRisksPage());
  route('ai', () => renderAIPage());
  route('settings', () => renderSettings());

  initRouter();
  updateRightPanel();
  setInterval(updateRightPanel, 30000);

  // Play boot sound on first user interaction (browser autoplay policy)
  const onFirstInteraction = () => {
    playBoot();
    document.removeEventListener('click', onFirstInteraction);
    document.removeEventListener('keydown', onFirstInteraction);
  };
  document.addEventListener('click', onFirstInteraction);
  document.addEventListener('keydown', onFirstInteraction);

  // Wire nav items to click sound
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('mousedown', () => playClick());
  });

  // Wire all .btn elements to click sound (excluding nav which already plays)
  document.addEventListener('mousedown', (e) => {
    const btn = e.target.closest('.btn, .lock-key, .ai-quick-btn, .rp-tab');
    if (btn && !btn.closest('.nav-item')) playClick();
  });
}

// Make navigate global for inline onclick handlers
window.navigate = navigate;

init().catch(console.error);
