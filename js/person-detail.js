// ─── ORION PERSON DETAIL VIEW ─────────────────────────────────────────────
import { Persons, Interactions, Relationships, Files } from './db.js';
import { openPersonModal, riskBadgeClass, avatarEl, displayAge } from './persons.js';
import { navigate } from './router.js';
import { showToast } from './security.js';
import * as AI from './ai.js';
import { analyzePersonality, detectLocalContradictions } from './profiler.js';
import { runAlibiScanForPerson } from './alibi.js';
import { playSave, playDelete, playModalOpen, playClick, playWarning } from './audio.js';

const TRAITS = [
  { key: 'narzissmus',      label: 'Narzissmus' },
  { key: 'empathie',        label: 'Empathie' },
  { key: 'dominanz',        label: 'Dominanz' },
  { key: 'ego',             label: 'Ego-Level' },
  { key: 'stabilitaet',     label: 'Emotionale Stabilität' },
  { key: 'manipulation',    label: 'Manipulation' },
  { key: 'loyalitaet',      label: 'Loyalität' },
  { key: 'impulsivitaet',   label: 'Impulsivität' },
  { key: 'stressresistenz', label: 'Stressresistenz' },
  { key: 'ehrlichkeit',     label: 'Ehrlichkeit' },
  { key: 'introvert',       label: 'Introvert ↔ Extravert' },
];
const DENKWEISE = ['Rational','Emotional','Kurzfristig','Langfristig','Sicherheitsorientiert','Risikofreudig','Machtorientiert','Harmonieorientiert'];
const MOTIVATIONEN = ['Geld','Anerkennung','Kontrolle','Liebe','Sicherheit','Status','Aufmerksamkeit','Angst','Zugehörigkeit','Rache','Macht','Freiheit'];
const INTERACTION_TYPES = ['Gespräch','Ereignis','Konflikt','Aussage','Lüge','Versprechen','Drohung','Gefallen','Reaktion','Notiz'];
const REL_TYPES = ['Familie','Freund','Partner','Kollege','Feind','Einfluss','Neutral','Vorgesetzter','Untergebener','Konkurrent'];

export async function renderPersonDetail(container, personId) {
  const [p, interactions, relationships, files, allPersons] = await Promise.all([
    Persons.get(personId),
    Interactions.listByPerson(personId),
    Relationships.listForPerson(personId),
    Files.listByPerson(personId),
    Persons.list(),
  ]);

  if (!p) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">❓</div><div class="empty-text">Person nicht gefunden</div></div>`;
    return;
  }

  interactions.sort((a, b) => new Date(b.date) - new Date(a.date));
  const otherPersons = allPersons.filter(x => x.id !== p.id);

  // ─── Render Shell ──────────────────────────────────────────────────────
  container.innerHTML = `
    <!-- Quick Read Card -->
    <div class="quick-read-card">
      <div class="qr-avatar-container">
        <div class="qr-avatar" id="qr-avatar-btn" style="${p.photo ? 'cursor:zoom-in;' : ''}">${avatarEl(p, 80)}</div>
      </div>
      
      <div class="qr-info">
        <div class="qr-name">${p.name}</div>
        <div class="qr-role">
          ${p.job || ''} ${p.job && (p.street || p.location) ? '·' : ''} 
          ${[p.street, p.houseNumber, p.location].filter(Boolean).join(' ')}
          ${(p.street || p.location) && displayAge(p) !== '–' ? '·' : ''} ${displayAge(p) !== '–' ? displayAge(p) : ''}
        </div>
        
        <div class="qr-tags">
          <span class="badge ${riskBadgeClass(p.riskLevel)}">⚠ ${p.riskLevel || 'unbekannt'}</span>
          ${p.status ? `<span class="badge badge-muted">${p.status}</span>` : ''}
          ${p.personalityType ? `<span class="badge badge-purple">${p.personalityType}</span>` : ''}
          ${(p.motivationen || []).slice(0, 3).map(m => `<span class="badge badge-muted">${m}</span>`).join('')}
        </div>
        
        <div class="qr-last-intel hide-on-mobile">
          Letzte Interaktion: ${interactions[0] ? `${interactions[0].type} · ${new Date(interactions[0].date).toLocaleDateString('de-DE')}` : '–'}
        </div>
      </div>

      <div class="qr-meta">
        <div class="qr-scores">
          <div class="qr-score-block">
            <div class="qr-score" style="color:var(--cyan);">${p.trustLevel ?? 5}</div>
            <div class="qr-score-label">VERTRAUEN</div>
          </div>
          <div class="qr-score-block">
            <div class="qr-score" style="color:var(--red);">${p.riskLevel==='kritisch'?'!':p.riskLevel==='hoch'?'H':p.riskLevel==='mittel'?'M':'L'}</div>
            <div class="qr-score-label">RISIKO</div>
          </div>
        </div>
        
        <div class="qr-actions">
          <button class="btn btn-ghost btn-sm" id="btn-edit-person"><i data-lucide="edit-3" style="width:14px;margin-right:4px;"></i> Bearbeiten</button>
          <button class="btn btn-gold btn-sm" id="btn-export-person"><i data-lucide="file-text" style="width:14px;margin-right:4px;"></i> PDF</button>
          <button class="btn btn-primary btn-sm" id="btn-export-zip"><i data-lucide="box" style="width:14px;margin-right:4px;"></i> ZIP</button>
        </div>
      </div>
    </div>

    <!-- Tabs -->
    <div class="tabs-bar">
      ${['Übersicht','Persönlichkeit','Beziehungen','Timeline','Dateien','Karte','Analyse','Strategie','Risiken'].map((t, i) =>
        `<button class="tab-btn ${i===0?'active':''}" data-tab="${t}">${t}</button>`
      ).join('')}
    </div>

    <!-- Tab Panes -->
    <div id="tab-pane-container"></div>
  `;

  // ─── Avatar Lightbox ───────────────────────────────────────────────────
  if (p.photo) {
    container.querySelector('#qr-avatar-btn').addEventListener('click', () => {
      const ov = document.createElement('div');
      ov.className = 'modal-overlay';
      ov.style.cssText = 'display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.85);';
      ov.innerHTML = `
        <div style="position:relative;max-width:90vw;max-height:90vh;">
          <img src="${p.photo}" style="max-width:90vw;max-height:85vh;border-radius:12px;border:1px solid var(--border-glow);box-shadow:0 0 60px rgba(0,229,255,0.15);display:block;">
          <div style="text-align:center;margin-top:10px;font-size:12px;color:var(--text-muted);font-family:var(--font-mono);">${p.name} · Klicken zum Schließen</div>
        </div>`;
      ov.addEventListener('click', () => ov.remove());
      document.body.appendChild(ov);
    });
  }

  // Wire tabs — each tab re-fetches fresh data so changes made in other tabs appear immediately
  const paneContainer = container.querySelector('#tab-pane-container');

  const refreshAndRender = async (tabName) => {
    // Always re-fetch latest data when switching tabs
    const [freshP, freshInteractions, freshRelationships, freshFiles, freshAllPersons] = await Promise.all([
      Persons.get(personId),
      Interactions.listByPerson(personId),
      Relationships.listForPerson(personId),
      Files.listByPerson(personId),
      Persons.list(),
    ]);
    freshInteractions.sort((a, b) => new Date(b.date) - new Date(a.date));
    const freshOtherPersons = freshAllPersons.filter(x => x.id !== personId);
    // Update p in-place so other closures also see changes
    Object.assign(p, freshP);

    switch (tabName) {
      case 'Übersicht':      renderOverview(paneContainer, freshP, freshInteractions); break;
      case 'Persönlichkeit': renderPersonality(paneContainer, freshP); break;
      case 'Beziehungen':    renderRelationships(paneContainer, freshP, freshRelationships, freshOtherPersons); break;
      case 'Timeline':       renderTimeline(paneContainer, freshP, freshInteractions); break;
      case 'Dateien':        renderFiles(paneContainer, freshP, freshFiles); break;
      case 'Karte':          renderPersonMap(paneContainer, freshP); break;
      case 'Analyse':        renderAnalysis(paneContainer, freshP, freshInteractions); break;
      case 'Strategie':      renderStrategy(paneContainer, freshP); break;
      case 'Risiken':        renderRisks(paneContainer, freshP, freshInteractions); break;
    }
  };

  // Load first tab
  refreshAndRender('Übersicht');

  container.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      playClick();
      refreshAndRender(btn.dataset.tab);
    });
  });

  container.querySelector('#btn-edit-person').onclick = () => openPersonModal(p, () => renderPersonDetail(container, personId));
  container.querySelector('#btn-export-person').onclick = async () => {
    const { exportPersonPDF } = await import('./export.js');
    exportPersonPDF(p, interactions, relationships);
  };
  container.querySelector('#btn-export-zip').onclick = async () => {
    const btn = container.querySelector('#btn-export-zip');
    btn.textContent = '⏳ Lädt...';
    try {
      const JSZip = window.JSZip;
      if (!JSZip) throw new Error('JSZip Bibliothek nicht geladen.');
      
      const zip = new JSZip();
      
      // 1. Profil als Text
      const AI = await import('./ai.js');
      const profileText = AI.buildPersonContext(p, interactions);
      zip.file(`Profil_${p.name.replace(/[^a-z0-9]/gi, '_')}.txt`, profileText);
      
      // 2. Profilbild
      if (p.photo && p.photo.includes('base64,')) {
        const parts = p.photo.split(';base64,');
        const ext = parts[0].split('/')[1] || 'jpg';
        zip.file(`Profilbild.${ext}`, parts[1], { base64: true });
      }
      
      // 3. PDF Akte
      const { exportPersonPDF } = await import('./export.js');
      const pdfObj = await exportPersonPDF(p, interactions, relationships, true);
      zip.file(pdfObj.filename, pdfObj.blob);
      
      // 4. Verlinkte Dateien
      if (files && files.length > 0) {
        const folder = zip.folder('Dateien');
        for (const f of files) {
          if (f.data && f.data.includes('base64,')) {
            const base64Data = f.data.split(';base64,')[1];
            const uniqueName = f.id.slice(0, 8) + '_' + f.name;
            folder.file(uniqueName, base64Data, { base64: true });
          }
        }
      }

      // 5. Importierbare Daten-Datei (person_data.json)
      // Enthält alle strukturierten Rohdaten für den vollständigen Re-Import
      const { Relationships: RelDB } = await import('./db.js');
      const allRels = await RelDB.listAll();
      const personRels = allRels.filter(r => r.fromId === p.id || r.toId === p.id);
      const personData = {
        _orionExport: true,
        _version: 1,
        _type: 'single_person',
        _exportedAt: new Date().toISOString(),
        persons: [p],
        interactions: interactions,
        relationships: personRels,
        files: files,
      };
      zip.file('person_data.json', JSON.stringify(personData, null, 2));
      
      // Herunterladen
      const content = await zip.generateAsync({ type: 'blob' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(content);
      a.download = `ORION_Akte_${p.name.replace(/[^a-z0-9]/gi, '_')}.zip`;
      a.click();
      showToast('📦  ZIP-Akte heruntergeladen (inkl. Importdaten)', 'cyan');
    } catch(err) {
      showToast('Exportfehler: ' + err.message, 'red');
    }
    btn.textContent = '📦 ZIP';
  };
}

// ─── Overview Tab ──────────────────────────────────────────────────────────
function renderOverview(el, p, interactions) {
  el.innerHTML = `
    <div class="grid-2">
      <div>
        <div class="section-header"><span class="section-title">Grunddaten</span></div>
        <div class="card mb-3">
          ${infoRow('📛 Name', p.name)}
          ${infoRow('🎭 Aliase', p.aliases || '–')}
          ${infoRow('🎂 Geburtstag / Alter', displayAge(p))}
          ${infoRow('💼 Beruf', p.job || '–')}
          ${infoRow('📍 Standort', p.location || '–')}
          ${infoRow('📞 Kontakt', p.contact || '–')}
          ${infoRow('🏷 Status', p.status || '–')}
          ${infoRow('⭐ Wichtigkeit', (p.importance || 0) + '/10')}
        </div>
        <div class="section-header"><span class="section-title">Bewertungen</span></div>
        <div class="card">
          ${meterRow('🤝 Vertrauen', p.trustLevel ?? 5, 'cyan')}
          ${meterRow('⚡ Einfluss', p.influenceLevel ?? 5, 'gold')}
          ${meterRow('☠ Risiko', p.riskLevel==='kritisch'?10:p.riskLevel==='hoch'?7:p.riskLevel==='mittel'?4:2, 'red')}
        </div>
      </div>
      <div>
        <div class="section-header"><span class="section-title">Letzte Interaktionen</span></div>
        <div>
          ${interactions.slice(0, 5).map(i => `
            <div class="card mb-2">
              <div style="font-size:9px;color:var(--text-muted);font-family:var(--font-mono);">${new Date(i.date).toLocaleDateString('de-DE')} · ${i.type}</div>
              <div style="font-size:12px;color:var(--text-primary);margin-top:4px;">${i.content.slice(0, 150)}${i.content.length > 150 ? '…' : ''}</div>
            </div>
          `).join('') || '<div class="empty-state" style="padding:20px;"><div class="empty-text">Keine Interaktionen</div></div>'}
        </div>
        ${p.notes ? `
          <div class="section-header" style="margin-top:16px;"><span class="section-title">Notizen</span></div>
          <div class="card">
            <div style="font-size:13px;line-height:1.6;color:var(--text-secondary);">${p.notes.replace(/\n/g,'<br>')}</div>
          </div>
        ` : ''}
      </div>
    </div>
  `;
}
function infoRow(label, value) {
  return `<div style="display:flex;margin-bottom:8px;gap:12px;align-items:baseline;">
    <span style="font-size:11px;color:var(--text-muted);font-family:var(--font-mono);width:110px;flex-shrink:0;">${label}</span>
    <span style="font-size:13px;color:var(--text-primary);">${value}</span>
  </div>`;
}
function meterRow(label, val, color) {
  const pct = Math.min(100, Math.max(0, (val / 10) * 100));
  return `<div class="meter-row">
    <span class="meter-label">${label}</span>
    <div class="meter-bar"><div class="meter-fill ${color}" style="width:${pct}%"></div></div>
    <span class="meter-val">${val}</span>
  </div>`;
}

// ─── Personality Tab ──────────────────────────────────────────────────────
function renderPersonality(el, p) {
  const traits = p.traits || {};
  const denkweise = p.denkweise || [];
  const motivationen = p.motivationen || [];

  el.innerHTML = `
    <div class="grid-2">
      <div>
        <div class="section-header"><span class="section-title">Persönlichkeitsmerkmale</span></div>
        <div class="card mb-4">
          ${TRAITS.map(t => `
            <div class="trait-slider-wrap">
              <span class="trait-label">${t.label}</span>
              <input type="range" min="0" max="10" value="${traits[t.key] ?? 5}" data-trait="${t.key}">
              <span class="trait-value" id="tv-${t.key}">${traits[t.key] ?? 5}</span>
            </div>
          `).join('')}
        </div>
      </div>
      <div>
        <div class="section-header"><span class="section-title">Denkweise</span></div>
        <div class="card mb-4">
          <div style="display:flex;flex-wrap:wrap;gap:8px;">
            ${DENKWEISE.map(d => `
              <span class="toggle-chip ${denkweise.includes(d) ? 'selected' : ''}" data-denkweise="${d}">${d}</span>
            `).join('')}
          </div>
        </div>
        <div class="section-header"><span class="section-title">Motivationen</span></div>
        <div class="card mb-4">
          <div class="motivation-grid">
            ${MOTIVATIONEN.map(m => `
              <span class="motivation-chip ${motivationen.includes(m) ? 'selected' : ''}" data-motivation="${m}">${m}</span>
            `).join('')}
          </div>
        </div>
        <button class="btn btn-primary" id="btn-save-personality" style="width:100%;">💾 Persönlichkeit speichern</button>
      </div>
    </div>
  `;

  // Range slider interaction
  el.querySelectorAll('input[type="range"]').forEach(input => {
    input.addEventListener('input', () => {
      el.querySelector(`#tv-${input.dataset.trait}`).textContent = input.value;
    });
  });

  // Chip toggles
  el.querySelectorAll('[data-denkweise]').forEach(chip => {
    chip.addEventListener('click', () => chip.classList.toggle('selected'));
  });
  el.querySelectorAll('[data-motivation]').forEach(chip => {
    chip.addEventListener('click', () => chip.classList.toggle('selected'));
  });

  el.querySelector('#btn-save-personality').onclick = async () => {
    const btn = el.querySelector('#btn-save-personality');
    btn.textContent = '⏳ Speichere...';
    btn.disabled = true;
    try {
      // Re-fetch fresh person data before merging to avoid stale overwrite
      const freshP = await Persons.get(p.id);
      const newTraits = {};
      el.querySelectorAll('input[type="range"]').forEach(inp => {
        newTraits[inp.dataset.trait] = parseInt(inp.value);
      });
      const newDenkweise = [...el.querySelectorAll('[data-denkweise].selected')].map(c => c.dataset.denkweise);
      const newMotivationen = [...el.querySelectorAll('[data-motivation].selected')].map(c => c.dataset.motivation);
      await Persons.save({ ...freshP, traits: newTraits, denkweise: newDenkweise, motivationen: newMotivationen });
      // Update local p reference for subsequent saves
      Object.assign(p, { traits: newTraits, denkweise: newDenkweise, motivationen: newMotivationen });
      playSave();
      showToast('Persönlichkeit gespeichert ✓', 'cyan');
    } catch(err) {
      showToast('Fehler beim Speichern: ' + err.message, 'red');
    } finally {
      btn.textContent = '💾 Persönlichkeit speichern';
      btn.disabled = false;
    }
  };
}

// ─── Relationships Tab ────────────────────────────────────────────────────
function renderRelationships(el, p, relationships, otherPersons) {
  el.innerHTML = `
    <div class="section-header">
      <span class="section-title">Beziehungen (${relationships.length})</span>
      <button class="btn btn-primary btn-sm" id="btn-add-rel">＋ Beziehung</button>
    </div>
    <div id="rel-list">
      ${relationships.length === 0 ? '<div class="empty-state" style="padding:30px;"><div class="empty-icon"><i data-lucide="link" style="width:40px;height:40px;opacity:0.5;"></i></div><div class="empty-text">Keine Beziehungen eingetragen</div></div>' :
        relationships.map(r => {
          const targetId = r.fromId === p.id ? r.toId : r.fromId;
          const target = otherPersons.find(x => x.id === targetId);
          const relClass = `rel-${(r.type || 'neutral').toLowerCase()}`;
          return `<div class="card mb-2 flex items-center gap-3" style="cursor:pointer;" onclick="navigate('person/${targetId}')">
            <div class="person-avatar" style="width:36px;height:36px;">${target ? avatarEl(target, 36) : '❓'}</div>
            <div style="flex:1;">
              <div style="font-size:13px;font-weight:600;">${target?.name || r.toName || 'Unbekannt'}</div>
              <div style="font-size:11px;color:var(--text-muted);font-family:var(--font-mono);">${target?.job || '–'}</div>
            </div>
            <span class="badge badge-muted ${relClass}">${r.type || 'Neutral'} ${r.fromId !== p.id ? '(Eingehend)' : ''}</span>
            <span style="font-size:11px;color:var(--text-muted);width:80px;">${r.strength ? 'Stärke: '+r.strength : ''}</span>
            <button class="btn btn-icon btn-sm" data-rel-id="${r.id}" title="Löschen"><i data-lucide="trash-2" style="width:12px;color:var(--red);"></i></button>
          </div>`;
        }).join('')
      }
    </div>
  `;
  if (window.lucide) window.lucide.createIcons();
  el.querySelectorAll('[data-rel-id]').forEach(btn => {
    btn.onclick = async (e) => {
      e.stopPropagation();
      playDelete();
      await Relationships.del(btn.dataset.relId);
      const updated = await Relationships.listForPerson(p.id);
      renderRelationships(el, p, updated, otherPersons);
      showToast('Beziehung entfernt', 'red');
    };
  });
  // Re-fetch all persons live so newly added persons appear in the dropdown
  el.querySelector('#btn-add-rel').onclick = async () => {
    playModalOpen();
    const freshAll = await Persons.list();
    const freshOthers = freshAll.filter(x => x.id !== p.id);
    openRelModal(p, freshOthers, async () => {
      const updatedRels = await Relationships.listForPerson(p.id);
      const freshAll2 = await Persons.list();
      renderRelationships(el, p, updatedRels, freshAll2.filter(x => x.id !== p.id));
    });
  };
}

function openRelModal(p, otherPersons, onSave) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';

  if (otherPersons.length === 0) {
    overlay.innerHTML = `
      <div class="modal" style="width:420px;">
        <div class="modal-header"><span class="modal-title">🔗 BEZIEHUNG HINZUFÜGEN</span><button class="modal-close" id="rcl">✕</button></div>
        <div class="modal-body" style="text-align:center;padding:40px 20px;">
          <div style="font-size:36px;margin-bottom:12px;">👥</div>
          <div style="font-size:14px;color:var(--text-primary);font-weight:600;margin-bottom:8px;">Keine weiteren Personen</div>
          <div style="font-size:12px;color:var(--text-muted);margin-bottom:20px;">Lege zuerst eine weitere Person in der Personen-Datenbank an, bevor du eine Beziehung hinzufügst.</div>
          <button class="btn btn-primary" id="rcl-go-persons">👥 Personen anlegen</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    const close = () => overlay.remove();
    overlay.querySelector('#rcl').onclick = close;
    overlay.addEventListener('click', e => { if(e.target===overlay) close(); });
    overlay.querySelector('#rcl-go-persons').onclick = () => { close(); import('./router.js').then(r => r.navigate('persons')); };
    return;
  }

  overlay.innerHTML = `
    <div class="modal" style="width:460px;">
      <div class="modal-header"><span class="modal-title">🔗 BEZIEHUNG HINZUFÜGEN</span><button class="modal-close" id="rcl">✕</button></div>
      <div class="modal-body">
        <div class="form-group"><label class="form-label">Person</label>
          <select class="form-select" id="rel-to" size="1">
            <option value="">Person wählen...</option>
            ${otherPersons.map(x => `<option value="${x.id}">${x.name}${x.job ? ' — ' + x.job : ''}</option>`).join('')}
          </select>
          <div style="font-size:10px;color:var(--text-muted);margin-top:4px;font-family:var(--font-mono);">${otherPersons.length} Personen verfügbar</div>
        </div>
        <div class="form-group"><label class="form-label">Typ</label>
          <select class="form-select" id="rel-type">
            ${REL_TYPES.map(t => `<option value="${t}">${t}</option>`).join('')}
          </select>
        </div>
        <div class="form-group"><label class="form-label">Stärke (1–10)</label>
          <input class="form-input" type="number" id="rel-strength" min="1" max="10" value="5">
        </div>
        <div class="form-group"><label class="form-label">Notiz</label>
          <input class="form-input" id="rel-note" placeholder="Optional...">
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost" id="rcl2">Abbrechen</button>
        <button class="btn btn-primary" id="rel-save">Speichern</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  const close = () => overlay.remove();
  overlay.querySelector('#rcl').onclick = close;
  overlay.querySelector('#rcl2').onclick = close;
  overlay.addEventListener('click', e => { if(e.target===overlay) close(); });
  overlay.querySelector('#rel-save').onclick = async () => {
    const toId = overlay.querySelector('#rel-to').value;
    if (!toId) { playWarning(); showToast('Person wählen', 'red'); return; }
    await Relationships.save({ fromId: p.id, toId, type: overlay.querySelector('#rel-type').value, strength: parseInt(overlay.querySelector('#rel-strength').value), note: overlay.querySelector('#rel-note').value });
    playSave();
    showToast('Beziehung gespeichert', 'cyan');
    close(); onSave?.();
  };
}

// ─── Timeline Tab ─────────────────────────────────────────────────────────
function renderTimeline(el, p, interactions) {
  const renderList = (list) => `
    <div class="section-header">
      <span class="section-title">Timeline (${list.length})</span>
      <button class="btn btn-primary btn-sm" id="btn-add-interaction">＋ Eintrag</button>
    </div>
    ${list.length === 0 ? '<div class="empty-state" style="padding:30px;"><div class="empty-icon">📅</div><div class="empty-text">Keine Einträge</div></div>' : `
    <div class="timeline">
      ${list.map(i => `
        <div class="timeline-item">
          <div class="timeline-dot ${i.type?.toLowerCase().replace(/ä/g,'a').replace(/ü/g,'u').replace(/ö/g,'o')}"></div>
          <div class="timeline-time">${new Date(i.date).toLocaleString('de-DE')}</div>
          <div class="timeline-type" style="color:${typeColor(i.type)}">${i.type}</div>
          <div class="timeline-content">${i.content}</div>
          ${i.tags ? `<div style="margin-top:6px;">${i.tags.split(',').map(t => `<span class="badge badge-muted">${t.trim()}</span>`).join(' ')}</div>` : ''}
          <button class="btn btn-icon btn-sm" style="margin-top:8px;font-size:10px;" data-del-int="${i.id}">🗑</button>
        </div>
      `).join('')}
    </div>`}
  `;
  el.innerHTML = renderList(interactions);
  const rebind = async () => {
    const updated = await Interactions.listByPerson(p.id);
    updated.sort((a, b) => new Date(b.date) - new Date(a.date));
    el.innerHTML = renderList(updated);
    bindDel(updated);
    el.querySelector('#btn-add-interaction').onclick = () => openInteractionModal(p, bindAfterSave);
  };
  const bindAfterSave = rebind;
  const bindDel = (list) => {
    el.querySelectorAll('[data-del-int]').forEach(btn => {
      btn.onclick = async () => {
        await Interactions.del(btn.dataset.delInt);
        showToast('Eintrag gelöscht', 'red');
        await rebind();
      };
    });
    el.querySelector('#btn-add-interaction').onclick = () => openInteractionModal(p, bindAfterSave);
  };
  bindDel(interactions);
}

function typeColor(type) {
  const map = { Konflikt:'var(--red)', Lüge:'var(--red)', Drohung:'var(--red)', Versprechen:'var(--gold)', Gespräch:'var(--cyan)', Gefallen:'var(--green)', Ereignis:'var(--purple)' };
  return map[type] || 'var(--text-muted)';
}

function openInteractionModal(p, onSave) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  const now = new Date().toISOString().slice(0,16);
  overlay.innerHTML = `
    <div class="modal" style="width:520px;">
      <div class="modal-header"><span class="modal-title">📝 INTERAKTION HINZUFÜGEN</span><button class="modal-close" id="icl">✕</button></div>
      <div class="modal-body">
        <div class="form-group"><label class="form-label">Typ</label>
          <select class="form-select" id="int-type">
            ${INTERACTION_TYPES.map(t => `<option>${t}</option>`).join('')}
          </select>
        </div>
        <div class="form-group"><label class="form-label">Datum & Zeit</label>
          <input class="form-input" type="datetime-local" id="int-date" value="${now}">
        </div>
        <div class="form-group"><label class="form-label">Inhalt / Beschreibung *</label>
          <textarea class="form-textarea" id="int-content" rows="4" placeholder="Was wurde gesagt, getan, beobachtet?"></textarea>
        </div>
        <div class="form-group"><label class="form-label">Tags (kommagetrennt)</label>
          <input class="form-input" id="int-tags" placeholder="Lüge, Aggression, Versprechen...">
        </div>
        <div class="form-group"><label class="form-label">Emotionale Reaktion</label>
          <input class="form-input" id="int-emotion" placeholder="Wütend, Nervös, Freundlich...">
        </div>
        <div class="form-group"><label class="form-label">Ort / Adresse (für Route)</label>
          <input class="form-input" id="int-location" placeholder="Straße, Stadt, Land">
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost" id="icl2">Abbrechen</button>
        <button class="btn btn-primary" id="int-save"><i data-lucide="save" style="width:14px;"></i> Speichern</button>
      </div>
    </div>
  `;
  if (window.lucide) window.lucide.createIcons();
  document.body.appendChild(overlay);
  const close = () => overlay.remove();
  overlay.querySelector('#icl').onclick = close;
  overlay.querySelector('#icl2').onclick = close;
  overlay.addEventListener('click', e => { if(e.target===overlay) close(); });
  overlay.querySelector('#int-save').onclick = async () => {
    const content = overlay.querySelector('#int-content').value.trim();
    if (!content) { playWarning(); showToast('Inhalt ist Pflichtfeld', 'red'); return; }
    
    const saveBtn = overlay.querySelector('#int-save');
    saveBtn.disabled = true;
    saveBtn.innerHTML = '⏳ Speichere...';

    const locVal = overlay.querySelector('#int-location').value.trim();
    let lat = undefined, lng = undefined;
    if (locVal) {
      try {
        const resp = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(locVal)}&limit=1`);
        const data = await resp.json();
        if (data && data.length > 0) {
          lat = parseFloat(data[0].lat);
          lng = parseFloat(data[0].lon);
        }
      } catch (err) {
        console.error("Geocoding failed for interaction:", err);
      }
    }

    await Interactions.save({
      personId: p.id,
      type: overlay.querySelector('#int-type').value,
      date: new Date(overlay.querySelector('#int-date').value).toISOString(),
      content,
      tags: overlay.querySelector('#int-tags').value,
      emotion: overlay.querySelector('#int-emotion').value,
      location: locVal,
      lat,
      lng
    });
    playSave();
    showToast('Interaktion gespeichert', 'cyan');
    close(); onSave?.();
  };
}

// ─── Files Tab ─────────────────────────────────────────────────────────────
function renderFiles(el, p, files) {
  el.innerHTML = `
    <div class="section-header"><span class="section-title">Dateien (${files.length})</span></div>
    <div class="drop-zone" id="drop-zone">
      <div style="font-size:28px;margin-bottom:8px;">📁</div>
      <div>Dateien hier ablegen oder <strong>klicken</strong> zum Auswählen</div>
      <div style="font-size:10px;margin-top:4px;font-family:var(--font-mono);">JPG · PNG · PDF · MP3 · MP4 · TXT</div>
      <input type="file" multiple id="file-input" style="display:none;" accept="image/*,.pdf,audio/*,video/*,.txt">
    </div>
    <div class="vault-grid" id="vault-grid">
      ${files.map(f => fileCard(f)).join('')}
    </div>
  `;

  // Wrap FileReader in a Promise so we properly await each file read
  const readFileAsDataURL = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

  const addFiles = async (fileList) => {
    for (const file of fileList) {
      try {
        showToast(`Lade ${file.name}...`, 'gold');
        const data = await readFileAsDataURL(file);
        await Files.save({
          personId: p.id,
          name: file.name,
          type: file.type,
          size: file.size,
          data,
          createdAt: new Date().toISOString()
        });
        const updated = await Files.listByPerson(p.id);
        const grid = el.querySelector('#vault-grid');
        if (grid) {
          grid.innerHTML = updated.map(f => fileCard(f)).join('');
          bindFileDel(el, p);
        }
        showToast(`${file.name} gespeichert ✓`, 'cyan');
      } catch(err) {
        showToast(`Fehler bei ${file.name}: ` + err.message, 'red');
      }
    }
  };

  const dz = el.querySelector('#drop-zone');
  dz.onclick = () => el.querySelector('#file-input').click();
  el.querySelector('#file-input').onchange = (e) => addFiles(e.target.files);
  dz.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('drag-over'); });
  dz.addEventListener('dragleave', () => dz.classList.remove('drag-over'));
  dz.addEventListener('drop', e => { e.preventDefault(); dz.classList.remove('drag-over'); addFiles(e.dataTransfer.files); });
  bindFileDel(el, p);
}

function fileCard(f) {
  const isImg = f.type?.startsWith('image/');
  const icon = isImg ? `<img src="${f.data}" style="width:48px; height:48px; object-fit:cover; border-radius:6px; margin:0 auto; box-shadow:0 2px 10px rgba(0,0,0,0.5);">` 
                     : (f.type?.includes('pdf') ? '<i data-lucide="file-text" style="width:28px;height:28px;color:var(--cyan);"></i>' : f.type?.startsWith('audio/') ? '<i data-lucide="music" style="width:28px;height:28px;color:var(--gold);"></i>' : f.type?.startsWith('video/') ? '<i data-lucide="video" style="width:28px;height:28px;color:var(--purple);"></i>' : '<i data-lucide="folder" style="width:28px;height:28px;color:var(--text-muted);"></i>');
  const size = f.size > 1e6 ? (f.size/1e6).toFixed(1)+'MB' : (f.size/1024).toFixed(0)+'KB';
  return `<div class="vault-file" data-file-id="${f.id}">
    <div class="vault-file-actions">
      <div class="vault-action-btn dl-btn" title="Herunterladen"><i data-lucide="download" style="width:12px;"></i></div>
      <div class="vault-action-btn rn-btn" title="Umbenennen"><i data-lucide="pen" style="width:12px;"></i></div>
    </div>
    <div class="vault-file-icon" ${isImg ? 'style="font-size:0;display:flex;align-items:center;justify-content:center;height:48px;"' : ''}>${icon}</div>
    <div class="vault-file-name" title="${f.name}">${f.name}</div>
    <div class="vault-file-size">${size}</div>
  </div>`;
}

function bindFileDel(el, p) {
  el.querySelectorAll('.vault-file').forEach(card => {
    card.addEventListener('contextmenu', async (e) => {
      e.preventDefault();
      if (confirm('Datei löschen?')) {
        playDelete();
        await Files.del(card.dataset.fileId);
        const updated = await Files.listByPerson(p.id);
        el.querySelector('#vault-grid').innerHTML = updated.map(f => fileCard(f)).join('');
        if (window.lucide) window.lucide.createIcons();
        bindFileDel(el, p);
        showToast('Datei gelöscht', 'red');
      }
    });
    // Explicit download button
    const dlBtn = card.querySelector('.dl-btn');
    if (dlBtn) {
      dlBtn.addEventListener('click', async (evt) => {
        evt.stopPropagation();
        const allFiles = await Files.listByPerson(p.id);
        const file = allFiles.find(f => f.id === card.dataset.fileId);
        if (!file) return;
        const a = document.createElement('a');
        a.href = file.data;
        a.download = file.name;
        a.click();
      });
    }

    // Rename button
    const rnBtn = card.querySelector('.rn-btn');
    if (rnBtn) {
      rnBtn.addEventListener('click', async (evt) => {
        evt.stopPropagation();
        const allFiles = await Files.listByPerson(p.id);
        const file = allFiles.find(f => f.id === card.dataset.fileId);
        if (!file) return;
        const newName = prompt('Neuer Dateiname:', file.name);
        if (newName && newName.trim() !== '' && newName !== file.name) {
          file.name = newName.trim();
          await Files.save(file);
          const updated = await Files.listByPerson(p.id);
          el.querySelector('#vault-grid').innerHTML = updated.map(f => fileCard(f)).join('');
          if (window.lucide) window.lucide.createIcons();
          bindFileDel(el, p);
          showToast('Datei umbenannt', 'cyan');
        }
      });
    }

    // Click to preview
    card.addEventListener('click', async () => {
      const fileId = card.dataset.fileId;
      const allFiles = await Files.listByPerson(p.id);
      const file = allFiles.find(f => f.id === fileId);
      if (!file) return;
      if (file.type?.startsWith('image/')) {
        const ov = document.createElement('div');
        ov.className = 'modal-overlay';
        ov.innerHTML = `<div style="max-width:90vw;max-height:90vh;"><img src="${file.data}" style="max-width:100%;max-height:90vh;border-radius:8px;border:1px solid var(--border-glow);"></div>`;
        ov.onclick = () => ov.remove();
        document.body.appendChild(ov);
      } else if (file.type?.includes('pdf') || file.type?.startsWith('text/')) {
        const a = document.createElement('a');
        a.href = file.data;
        a.download = file.name;
        a.click();
      }
    });
  });
}

// ─── Shared Prompt Render Helper ──────────────────────────────────────────
function renderPromptBox(promptText, areaEl) {
  areaEl.innerHTML = `
    <div class="ai-message assistant" style="padding:0; overflow:hidden;">
      <div style="background:var(--panel-dark); padding:10px 16px; border-bottom:1px solid var(--border); display:flex; justify-content:space-between; align-items:center;">
        <span style="font-size:11px; color:var(--text-muted); font-family:var(--font-mono);">🤖 KI-PROMPT GENERIERT</span>
        <button class="btn btn-primary btn-sm" onclick="navigator.clipboard.writeText(this.parentElement.nextElementSibling.value); this.textContent='✓ Kopiert'; setTimeout(()=>this.textContent='📋 Kopieren', 2000);">📋 Kopieren</button>
      </div>
      <textarea readonly class="form-textarea" style="width:100%; height:300px; border:none; resize:vertical; font-family:var(--font-mono); font-size:12px; line-height:1.5; padding:16px; background:transparent;">${promptText.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</textarea>
    </div>
    <div style="margin-top:12px; font-size:12px; color:var(--text-muted); line-height:1.6;">
      ℹ️ <strong>Wie es funktioniert:</strong> Kopiere diesen strukturierten Prompt und füge ihn bei <a href="https://chatgpt.com" target="_blank" style="color:var(--cyan);">ChatGPT</a>, <a href="https://gemini.google.com" target="_blank" style="color:var(--cyan);">Google Gemini</a> oder <a href="https://claude.ai" target="_blank" style="color:var(--cyan);">Claude</a> ein. Die App formatiert alle verfügbaren Daten optimal für das KI-Modell.
    </div>
  `;
}

// ─── Analysis Tab ──────────────────────────────────────────────────────────
function renderAnalysis(el, p, interactions) {
  el.innerHTML = `
    <div class="ai-quick-btns">
      <button class="ai-quick-btn" data-analysis="quick"><i data-lucide="zap" style="width:14px;margin-right:4px;"></i> Schnellanalyse</button>
      <button class="ai-quick-btn" data-analysis="deep"><i data-lucide="brain" style="width:14px;margin-right:4px;"></i> Tiefenanalyse</button>
      <button class="ai-quick-btn" data-analysis="contradiction"><i data-lucide="search" style="width:14px;margin-right:4px;"></i> Widersprüche</button>
      <button class="ai-quick-btn" data-analysis="risk"><i data-lucide="alert-triangle" style="width:14px;margin-right:4px;"></i> Risikoanalyse</button>
    </div>
    <div id="ai-result-area">
      <div class="empty-state" style="padding:30px;">
        <div class="empty-icon"><i data-lucide="bot" style="width:40px;height:40px;opacity:0.5;"></i></div>
        <div class="empty-text">Analyse-Typ wählen, dann werden Ergebnisse hier angezeigt.</div>
      </div>
    </div>
  `;
  if (window.lucide) window.lucide.createIcons();
  el.querySelectorAll('[data-analysis]').forEach(btn => {
    btn.onclick = () => {
      el.querySelectorAll('[data-analysis]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const type = btn.dataset.analysis;
      const area = el.querySelector('#ai-result-area');
      let promptText = '';
      if (type === 'quick') promptText = AI.quickAnalysis(p);
      else if (type === 'deep') promptText = AI.deepAnalysis(p, interactions);
      else if (type === 'contradiction') promptText = AI.detectContradictions(p, interactions);
      else if (type === 'risk') promptText = AI.conflictRisk(p, interactions);
      
      const localData = analyzePersonality(p);
      const localContradictions = detectLocalContradictions(p, interactions);

      const renderSubTabs = (activeTab) => {
        area.innerHTML = `
          <div class="tabs-bar sub-tabs" style="margin-top:10px; margin-bottom:12px; border-bottom:1px solid var(--border); display:flex; gap:10px;">
            <button class="tab-btn sub-tab-btn ${activeTab==='local'?'active':''}" data-sub="local" style="font-size:11px; padding:6px 12px;">Lokal-Bericht (Sofort)</button>
            <button class="tab-btn sub-tab-btn ${activeTab==='prompt'?'active':''}" data-sub="prompt" style="font-size:11px; padding:6px 12px;">KI-Prompt (Extern)</button>
          </div>
          <div id="sub-tab-content"></div>
        `;
        
        const subContent = area.querySelector('#sub-tab-content');
        if (activeTab === 'local') {
          if (type === 'contradiction') {
            if (localContradictions.length === 0) {
              subContent.innerHTML = `
                <div class="card p-3" style="text-align:center; color:var(--green); font-family:var(--font-mono); font-size:12px;">
                  ✅ Keine offensichtlichen Widersprüche, Lügen oder Drohungen in den Interaktionen dokumentiert.
                </div>
              `;
            } else {
              subContent.innerHTML = `
                <div style="display:flex; flex-direction:column; gap:12px;">
                  ${localContradictions.map(item => `
                    <div class="card p-3 border-glow" style="border-left: 3px solid var(--${item.severity === 'red' ? 'red' : 'gold'});">
                      <div style="font-size:12px; font-weight:bold; color:var(--${item.severity === 'red' ? 'red' : 'gold'}); font-family:var(--font-mono); margin-bottom:4px;">${item.title}</div>
                      <div style="font-size:11px; color:var(--text-secondary); margin-bottom:8px; line-height:1.5;">${item.desc}</div>
                      <ul style="padding-left:16px; font-size:11px; color:var(--text-muted); line-height:1.5;">
                        ${item.items.map(log => `<li>${log}</li>`).join('')}
                      </ul>
                    </div>
                  `).join('')}
                </div>
              `;
            }
          } else {
            subContent.innerHTML = `
              <div class="card p-3 border-glow">
                <div style="font-size:14px; font-weight:bold; color:var(--cyan); margin-bottom:6px; font-family:var(--font-mono); text-transform:uppercase; letter-spacing:0.5px;">
                  👤 ${localData.archetype}
                </div>
                <div style="font-size:12px; color:var(--text-primary); line-height:1.6; margin-bottom:12px;">
                  ${localData.description}
                </div>
                <div style="border-top:1px solid var(--border); padding-top:10px; margin-bottom:12px;">
                  <div style="font-size:10px; font-weight:bold; color:var(--red); font-family:var(--font-mono); margin-bottom:4px; letter-spacing:0.5px;">⚠️ RISIKO-EINSCHÄTZUNG</div>
                  <div style="font-size:11px; color:var(--text-secondary); line-height:1.5;">${localData.riskAssessment}</div>
                </div>
                <div class="grid-2" style="border-top:1px solid var(--border); padding-top:10px; gap:16px;">
                  <div>
                    <div style="font-size:10px; font-weight:bold; color:var(--green); font-family:var(--font-mono); margin-bottom:4px; letter-spacing:0.5px;">✓ TAKTISCHE DOS</div>
                    <ul style="padding-left:16px; font-size:11px; color:var(--text-secondary); line-height:1.6;">
                      ${localData.dos.map(d => `<li>${d}</li>`).join('')}
                    </ul>
                  </div>
                  <div>
                    <div style="font-size:10px; font-weight:bold; color:var(--red); font-family:var(--font-mono); margin-bottom:4px; letter-spacing:0.5px;">✗ TAKTISCHE DON'TS</div>
                    <ul style="padding-left:16px; font-size:11px; color:var(--text-secondary); line-height:1.6;">
                      ${localData.donts.map(d => `<li>${d}</li>`).join('')}
                    </ul>
                  </div>
                </div>
              </div>
            `;
          }
        } else {
          renderPromptBox(promptText, subContent);
        }
        area.querySelectorAll('.sub-tab-btn').forEach(subBtn => {
          subBtn.onclick = () => renderSubTabs(subBtn.dataset.sub);
        });
      };
      renderSubTabs('local');
    };
  });
}

// ─── Strategy Tab ─────────────────────────────────────────────────────────
function renderStrategy(el, p) {
  el.innerHTML = `
    <div class="ai-quick-btns">
      <button class="ai-quick-btn" id="btn-strategy"><i data-lucide="target" style="width:14px;margin-right:4px;"></i> Kommunikationsstrategie</button>
      <button class="ai-quick-btn" id="btn-negotiation"><i data-lucide="handshake" style="width:14px;margin-right:4px;"></i> Verhandlungshilfe</button>
    </div>
    <div id="neg-context-wrap" style="display:none;margin-bottom:12px;margin-top:12px;">
      <input class="form-input" id="neg-context" placeholder="Was ist dein Verhandlungsziel? (z.B. Gehaltserhöhung, Projekt-Approval)">
      <button class="btn btn-primary btn-sm" style="margin-top:8px;" id="btn-run-neg">⚡ Analysieren</button>
    </div>
    <div id="strategy-result">
      <div class="empty-state" style="padding:30px;"><div class="empty-icon"><i data-lucide="target" style="width:40px;height:40px;opacity:0.5;"></i></div><div class="empty-text">Strategie-Typ wählen</div></div>
    </div>
  `;
  if (window.lucide) window.lucide.createIcons();
  const area = el.querySelector('#strategy-result');
  const localData = analyzePersonality(p);
  const renderSubTabs = (activeTab, type, promptText) => {
    area.innerHTML = `
      <div class="tabs-bar sub-tabs" style="margin-top:10px; margin-bottom:12px; border-bottom:1px solid var(--border); display:flex; gap:10px;">
        <button class="tab-btn sub-tab-btn ${activeTab==='local'?'active':''}" data-sub="local" style="font-size:11px; padding:6px 12px;">Lokal-Strategie</button>
        <button class="tab-btn sub-tab-btn ${activeTab==='prompt'?'active':''}" data-sub="prompt" style="font-size:11px; padding:6px 12px;">KI-Prompt (Extern)</button>
      </div>
      <div id="sub-tab-content"></div>
    `;
    const subContent = area.querySelector('#sub-tab-content');
    if (activeTab === 'local') {
      if (type === 'negotiation') {
        subContent.innerHTML = `
          <div class="card p-3 border-glow">
            <div style="font-size:13px; font-weight:bold; color:var(--cyan); margin-bottom:8px; font-family:var(--font-mono);">🤝 VERHANDLUNGS-GUIDE</div>
            <div style="margin-bottom:12px;">
              <div style="font-size:10px; font-weight:bold; color:var(--text-muted); font-family:var(--font-mono); margin-bottom:4px;">OPTIMALES SETTING</div>
              <div style="font-size:12px; color:var(--text-primary);">${localData.negotiation.setting}</div>
            </div>
            <div style="border-top:1px solid var(--border); padding-top:10px;">
              <div style="font-size:10px; font-weight:bold; color:var(--green); font-family:var(--font-mono); margin-bottom:4px;">EMPFOHLENE ARGUMENTE</div>
              <ul style="padding-left:16px; font-size:11px; color:var(--text-secondary); line-height:1.6;">
                ${localData.negotiation.arguments.map(arg => `<li>${arg}</li>`).join('')}
              </ul>
            </div>
          </div>
        `;
      } else {
        subContent.innerHTML = `
          <div class="card p-3 border-glow">
            <div style="font-size:13px; font-weight:bold; color:var(--cyan); margin-bottom:8px; font-family:var(--font-mono);">🎯 KOMMUNIKATIONSSTRATEGIE</div>
            <div style="margin-bottom:12px;">
              <div style="font-size:10px; font-weight:bold; color:var(--text-muted); font-family:var(--font-mono); margin-bottom:4px;">KOMMUNIKATIONSSTIL</div>
              <div style="font-size:12px; color:var(--text-primary); line-height:1.5;">Richte dich nach dem Typus <strong>${localData.archetype}</strong>. Verwende die taktischen Do's & Don'ts aus dem Analyse-Tab für detaillierte Anweisungen.</div>
            </div>
            <div style="border-top:1px solid var(--border); padding-top:10px;">
              <div style="font-size:10px; font-weight:bold; color:var(--text-muted); font-family:var(--font-mono); margin-bottom:4px;">VERTRAUENSAUFBAU</div>
              <div style="font-size:11px; color:var(--text-secondary); line-height:1.5;">
                ${p.traits?.empathie > 6 ? 'Fokussiere auf persönlichen Rapport und offene Wertschätzung.' : 'Zeige dich zuverlässig, kompetent und halte Vereinbarungen strikt ein.'}
                Nutze vor allem Argumente, die auf ${localData.negotiation.setting.toLowerCase().includes('formell') ? 'Fakten und Struktur' : 'Sicherheit und gegenseitigen Nutzen'} abzielen.
              </div>
            </div>
          </div>
        `;
      }
    } else {
      renderPromptBox(promptText, subContent);
    }
    area.querySelectorAll('.sub-tab-btn').forEach(subBtn => {
      subBtn.onclick = () => renderSubTabs(subBtn.dataset.sub, type, promptText);
    });
  };
  const clearActive = () => el.querySelectorAll('.ai-quick-btn').forEach(b => b.classList.remove('active'));
  el.querySelector('#btn-strategy').onclick = (e) => {
    clearActive();
    e.currentTarget.classList.add('active');
    el.querySelector('#neg-context-wrap').style.display = 'none';
    const promptText = AI.strategyMode(p);
    renderSubTabs('local', 'strategy', promptText);
  };
  el.querySelector('#btn-negotiation').onclick = (e) => {
    clearActive();
    e.currentTarget.classList.add('active');
    el.querySelector('#neg-context-wrap').style.display = 'block';
  };
  el.querySelector('#btn-run-neg').onclick = () => {
    const ctx = el.querySelector('#neg-context').value;
    const promptText = AI.negotiationAdvice(p, ctx);
    renderSubTabs('local', 'negotiation', promptText);
  };
}

// ─── Risks Tab ────────────────────────────────────────────────────────────
function renderRisks(el, p, interactions) {
  const riskScore = p.riskLevel === 'kritisch' ? 95 : p.riskLevel === 'hoch' ? 70 : p.riskLevel === 'mittel' ? 40 : 15;
  const conflictInteractions = interactions.filter(i => ['Konflikt','Lüge','Drohung'].includes(i.type));

  el.innerHTML = `
    <div class="grid-2">
      <div>
        <div class="section-header"><span class="section-title">Risiko-Übersicht</span></div>
        <div class="card mb-4" style="text-align:center;padding:30px;">
          <div style="font-size:60px;font-weight:900;font-family:var(--font-mono);color:${riskScore>70?'var(--red)':riskScore>40?'var(--gold)':'var(--green)'};">${riskScore}%</div>
          <div style="font-size:12px;color:var(--text-muted);font-family:var(--font-mono);margin-top:4px;">GESAMT-RISIKOWERT</div>
          <div style="margin-top:16px;">
            <span class="badge ${riskScore>70?'badge-red':riskScore>40?'badge-gold':'badge-green'}">${p.riskLevel?.toUpperCase() || 'UNBEKANNT'}</span>
          </div>
        </div>
        <div class="card">
          ${meterRow('⚠ Gesamtrisiko', riskScore/10, 'red')}
          ${meterRow('🔒 Vertrauen', p.trustLevel ?? 5, 'cyan')}
          ${meterRow('💣 Konflikte', Math.min(10, conflictInteractions.length), 'red')}
          ${meterRow('😈 Manipulation', p.traits?.manipulation ?? 5, 'gold')}
          ${meterRow('👁 Loyalität', p.traits?.loyalitaet ?? 5, 'green')}
        </div>
      </div>
      <div>
        <div class="section-header"><span class="section-title">Konflikt-Ereignisse</span></div>
        ${conflictInteractions.length === 0 ? '<div class="empty-state" style="padding:20px;"><div class="empty-text">Keine Konflikte dokumentiert</div></div>' :
          conflictInteractions.map(i => `
            <div class="warning-item">
              <span class="warning-icon">⚠</span>
              <div>
                <div class="warning-text">${i.content.slice(0, 120)}${i.content.length > 120 ? '…' : ''}</div>
                <div class="warning-meta">${i.type} · ${new Date(i.date).toLocaleDateString('de-DE')}</div>
              </div>
            </div>
          `).join('')
        }
        <div style="margin-top:16px;">
          <button class="btn btn-danger" id="btn-risk-ai" style="width:100%;">🤖 KI-Risikoanalyse</button>
        </div>
      </div>
    </div>

    <!-- Alibi Scanner Section -->
    <div style="margin-top:20px;">
      <div class="section-header" style="margin-bottom:10px;">
        <span class="section-title" style="color:var(--red);">🔍 Alibi-Prüfung</span>
        <button class="btn btn-sm" id="btn-scan-alibi" style="background:rgba(255,59,59,0.15);color:var(--red);border:1px solid rgba(255,59,59,0.3);font-family:var(--font-mono);font-size:11px;">⚡ Jetzt scannen</button>
      </div>
      <div id="alibi-result-person" class="card" style="border-left:3px solid var(--red);padding:14px;">
        <div style="font-size:12px;color:var(--text-muted);font-family:var(--font-mono);text-align:center;">
          Analysiert Zeitachsen-Widersprüche zwischen allen Personen im System.
        </div>
      </div>
    </div>
  `;
  el.querySelector('#btn-risk-ai').onclick = () => {
    const container = document.createElement('div');
    container.style.marginTop = '16px';
    el.querySelector('#btn-risk-ai').replaceWith(container);
    const promptText = AI.conflictRisk(p, interactions);
    const localData = analyzePersonality(p);
    const renderSubTabs = (activeTab) => {
      container.innerHTML = `
        <div class="tabs-bar sub-tabs" style="margin-bottom:12px; border-bottom:1px solid var(--border); display:flex; gap:10px;">
          <button class="tab-btn sub-tab-btn ${activeTab==='local'?'active':''}" data-sub="local" style="font-size:11px; padding:6px 12px;">Lokal-Risiko</button>
          <button class="tab-btn sub-tab-btn ${activeTab==='prompt'?'active':''}" data-sub="prompt" style="font-size:11px; padding:6px 12px;">KI-Prompt (Extern)</button>
        </div>
        <div id="sub-tab-content"></div>
      `;
      const subContent = container.querySelector('#sub-tab-content');
      if (activeTab === 'local') {
        subContent.innerHTML = `
          <div class="card p-3 border-glow">
            <div style="font-size:12px; font-weight:bold; color:var(--red); font-family:var(--font-mono); margin-bottom:6px;">⚠️ RISIKO-ANALYSE</div>
            <div style="font-size:12px; color:var(--text-primary); line-height:1.5; margin-bottom:10px;">${localData.riskAssessment}</div>
            <div style="font-size:11px; color:var(--text-secondary); line-height:1.5;">
              <strong>Verhaltens-Tendenzen:</strong><br>
              • Manipulation: ${p.traits?.manipulation ?? 5}/10<br>
              • Ehrlichkeit: ${p.traits?.ehrlichkeit ?? 5}/10<br>
              • Impulsivität: ${p.traits?.impulsivitaet ?? 5}/10
            </div>
          </div>
        `;
      } else {
        renderPromptBox(promptText, subContent);
      }
      container.querySelectorAll('.sub-tab-btn').forEach(subBtn => {
        subBtn.onclick = () => renderSubTabs(subBtn.dataset.sub);
      });
    };
    renderSubTabs('local');
  };

  // ─── Alibi Scan Button ────────────────────────────────────────────────────
  el.querySelector('#btn-scan-alibi').onclick = async () => {
    const btn = el.querySelector('#btn-scan-alibi');
    const resultEl = el.querySelector('#alibi-result-person');
    btn.textContent = '⏳ Scanne…';
    btn.disabled = true;

    resultEl.innerHTML = `
      <div style="display:flex;align-items:center;gap:10px;color:var(--text-muted);font-size:12px;font-family:var(--font-mono);padding:8px;">
        <div style="width:14px;height:14px;border:2px solid var(--border);border-top-color:var(--red);border-radius:50%;animation:spin 0.6s linear infinite;"></div>
        Analysiere Zeitachsen…
      </div>
    `;

    try {
      const report = await runAlibiScanForPerson(p.id);
      const { conflicts, stats } = report;
      const severityLabel = (s) => s >= 3 ? '🔴 KRITISCH' : s === 2 ? '🟡 WARNUNG' : '🔵 HINWEIS';
      const severityColor = (s) => s >= 3 ? 'var(--red)' : s === 2 ? 'var(--gold)' : 'var(--cyan)';

      if (conflicts.length === 0) {
        resultEl.innerHTML = `
          <div style="text-align:center;padding:16px;color:var(--green);font-family:var(--font-mono);font-size:12px;">
            ✅ Keine Alibi-Widersprüche gefunden für ${p.name}.
          </div>
        `;
      } else {
        resultEl.innerHTML = `
          <div style="margin-bottom:10px;font-size:11px;color:var(--red);font-family:var(--font-mono);font-weight:700;">
            ⚠ ${conflicts.length} Widerspruch${conflicts.length > 1 ? 'e' : ''} gefunden
          </div>
          <div style="display:flex;flex-direction:column;gap:8px;">
            ${conflicts.map(c => `
              <div style="background:var(--bg-primary);border:1px solid var(--border);border-left:3px solid ${severityColor(c.severity)};border-radius:6px;padding:10px 12px;">
                <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
                  <span style="font-size:10px;font-weight:700;font-family:var(--font-mono);color:${severityColor(c.severity)};">${severityLabel(c.severity)}</span>
                  <span style="font-size:10px;background:${severityColor(c.severity)}22;color:${severityColor(c.severity)};padding:1px 6px;border-radius:3px;font-family:var(--font-mono);">${c.label}</span>
                  <span style="font-size:10px;color:var(--text-muted);font-family:var(--font-mono);margin-left:auto;">${new Date(c.timeA).toLocaleDateString('de-DE')}</span>
                </div>
                <div style="font-size:12px;font-weight:600;color:var(--text-primary);margin-bottom:3px;">${c.headline}</div>
                <div style="font-size:11px;color:var(--text-secondary);line-height:1.5;">${c.detail}</div>
              </div>
            `).join('')}
          </div>
        `;
      }
    } catch(err) {
      resultEl.innerHTML = `<div style="color:var(--red);font-size:12px;">Scan-Fehler: ${err.message}</div>`;
    } finally {
      btn.textContent = '⟳ Erneut scannen';
      btn.disabled = false;
    }
  };
}
// ─── Person Map Tab ────────────────────────────────────────────────────────
async function renderPersonMap(el, p) {
  const fullAddress = [p.street, p.houseNumber, p.location].filter(Boolean).join(' ');
  const { Interactions } = await import('./db.js');
  const interactions = await Interactions.listByPerson(p.id);

  // Group and sort geocoded points
  const points = [];
  
  // 1. Resolve coordinates for the person's home address (if not already cached)
  let homeLat = p.lat, homeLng = p.lng;
  if (fullAddress && (homeLat === undefined || homeLng === undefined)) {
    try {
      const resp = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(fullAddress)}&limit=1`);
      const data = await resp.json();
      if (data && data.length > 0) {
        homeLat = parseFloat(data[0].lat);
        homeLng = parseFloat(data[0].lon);
        await Persons.save({ ...p, lat: homeLat, lng: homeLng });
      }
    } catch(err) {
      console.error("Geocoding failed for home address:", err);
    }
  }

  if (homeLat !== undefined && homeLng !== undefined) {
    points.push({
      type: 'Basis',
      lat: homeLat,
      lng: homeLng,
      label: 'Wohnort',
      date: p.birthday ? 'Wohnsitz' : 'Basis',
      content: fullAddress
    });
  }

  // 2. Add geocoded interactions sorted by date ascending
  const validInteractions = interactions
    .filter(i => i.lat !== undefined && i.lng !== undefined)
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  validInteractions.forEach(i => {
    points.push({
      type: i.type,
      lat: i.lat,
      lng: i.lng,
      label: i.type,
      date: new Date(i.date).toLocaleDateString('de-DE') + ' ' + new Date(i.date).toLocaleTimeString('de-DE', {hour: '2-digit', minute:'2-digit'}),
      content: i.content
    });
  });

  if (points.length === 0) {
    el.innerHTML = `<div class="empty-state"><div class="empty-text">Kein Standort und keine geocodierten Interaktionen hinterlegt.</div></div>`;
    return;
  }

  el.innerHTML = `
    <div class="section-header flex justify-between items-center" style="flex-wrap: wrap; gap: 8px;">
      <span class="section-title">Standort-Chronik: ${p.name}</span>
      <div class="flex gap-2">
        ${points.length >= 2 ? `<button class="btn btn-primary btn-sm" id="btn-play-route"><i data-lucide="play" style="width:12px;margin-right:4px;"></i> Route abspielen</button>` : `<button class="btn btn-ghost btn-sm" disabled style="font-size:11px;">(Route benötigt mind. 2 Orte)</button>`}
        <button class="btn btn-ghost btn-sm" id="btn-fullscreen-p-map" title="Vollbild"><i data-lucide="maximize" style="width:14px;"></i></button>
      </div>
    </div>
    <div style="position:relative; height: calc(100vh - 380px); min-height: 420px; border-radius: 12px; overflow: hidden; border: 1px solid var(--border-glow); margin-top: 10px;">
      <div class="map-container" id="person-map" style="width:100%; height:100%;"></div>
      <!-- HUD Console Overlay -->
      <div id="map-hud" style="position:absolute; bottom:16px; left:16px; right:16px; z-index:1000; background:rgba(18,21,29,0.92); border:1px solid var(--cyan-dim); border-radius:8px; padding:12px 16px; font-family:var(--font-mono); font-size:11px; color:var(--text-primary); pointer-events:none; display:none; box-shadow:var(--shadow-glow-cyan); transition: opacity 0.3s ease;">
        <div style="display:flex; justify-content:space-between; margin-bottom:6px; border-bottom:1px dashed var(--cyan-dim); padding-bottom:6px;">
          <span style="color:var(--cyan); font-weight:bold;" id="hud-title">CHRONIK INJEKTION...</span>
          <span id="hud-date" style="color:var(--text-muted);">--.--.----</span>
        </div>
        <div id="hud-content" style="line-height:1.6; max-height: 60px; overflow-y: auto;">Lese Daten...</div>
      </div>
    </div>
  `;
  if (window.lucide) window.lucide.createIcons();

  setTimeout(() => {
    const mapEl = document.getElementById('person-map');
    if (!mapEl) return;

    // Fullscreen Logic
    const fsBtn = document.getElementById('btn-fullscreen-p-map');
    if (fsBtn) {
      fsBtn.onclick = () => {
        if (!document.fullscreenElement) {
          mapEl.parentElement.requestFullscreen().catch(err => console.error(err));
        } else {
          document.exitFullscreen();
        }
      };
    }

    // Initialize Map centered on first point
    const pMap = L.map('person-map', { attributionControl: false }).setView([points[0].lat, points[0].lng], 13);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap &copy; CARTO',
      updateWhenIdle: false,
      keepBuffer: 12
    }).addTo(pMap);

    document.addEventListener('fullscreenchange', () => {
      setTimeout(() => pMap.invalidateSize(), 200);
    });

    // Draw static markers
    const staticMarkers = [];
    const drawStaticLayer = () => {
      // Clear anything from player if running
      pMap.eachLayer(layer => {
        if (layer instanceof L.Polyline || (layer instanceof L.Marker && !layer._permanent)) {
          pMap.removeLayer(layer);
        }
      });

      // Add normal markers for all points
      points.forEach((pt, idx) => {
        const icon = L.divIcon({
          className: 'custom-map-icon',
          html: idx === 0 
            ? `<div class="map-marker-avatar ${riskClass(p.riskLevel)}" style="width:40px; height:40px; border:2px solid var(--cyan); box-shadow:0 0 10px var(--cyan);">${avatarEl(p, 40)}</div>`
            : `<div style="background:var(--bg-panel); border:2px solid var(--gold); border-radius:50%; width:24px; height:24px; display:flex; align-items:center; justify-content:center; box-shadow:0 0 8px var(--gold); font-size:10px; font-weight:bold; color:var(--gold); font-family:var(--font-mono);">${idx}</div>`,
          iconSize: idx === 0 ? [40, 40] : [24, 24],
          iconAnchor: idx === 0 ? [20, 20] : [12, 12]
        });
        const marker = L.marker([pt.lat, pt.lng], { icon }).addTo(pMap);
        marker._permanent = true;
        marker.bindPopup(`<strong style="font-family:var(--font-mono);color:var(--cyan);">${pt.label}</strong><br><span style="font-size:11px;">${pt.date}</span><br><p style="margin-top:4px;font-size:11px;">${pt.content}</p>`);
        staticMarkers.push(marker);
      });

      // Draw static route lines (faded)
      if (points.length >= 2) {
        const latlngs = points.map(pt => [pt.lat, pt.lng]);
        const line = L.polyline(latlngs, { color: 'var(--border-glow)', weight: 3, dashArray: '5, 8', opacity: 0.5 }).addTo(pMap);
        line._permanent = true;
      }
    };

    drawStaticLayer();

    // Playback Logic
    const playBtn = document.getElementById('btn-play-route');
    const hud = document.getElementById('map-hud');
    const hudTitle = document.getElementById('hud-title');
    const hudDate = document.getElementById('hud-date');
    const hudContent = document.getElementById('hud-content');
    
    let playInterval = null;
    let activeLines = [];
    let pulseMarker = null;

    const stopPlayback = () => {
      clearInterval(playInterval);
      playInterval = null;
      if (playBtn) {
        playBtn.innerHTML = '<i data-lucide="play" style="width:12px;margin-right:4px;"></i> Route abspielen';
        if (window.lucide) window.lucide.createIcons();
      }
      hud.style.display = 'none';
      if (pulseMarker) {
        pMap.removeLayer(pulseMarker);
        pulseMarker = null;
      }
      activeLines.forEach(l => pMap.removeLayer(l));
      activeLines = [];
      drawStaticLayer();
      pMap.setView([points[0].lat, points[0].lng], 13);
    };

    if (playBtn) {
      playBtn.onclick = () => {
        if (playInterval) {
          stopPlayback();
          return;
        }

        // Start Playback
        playBtn.innerHTML = '<i data-lucide="square" style="width:12px;margin-right:4px;"></i> Stop';
        if (window.lucide) window.lucide.createIcons();
        hud.style.display = 'block';

        // Clear permanent layout
        pMap.eachLayer(layer => {
          if (layer instanceof L.Polyline || layer instanceof L.Marker) {
            pMap.removeLayer(layer);
          }
        });

        let idx = 0;
        const playStep = () => {
          if (idx >= points.length) {
            setTimeout(stopPlayback, 3000);
            return;
          }

          const pt = points[idx];
          
          // Pan map to point
          pMap.panTo([pt.lat, pt.lng]);

          // Update HUD
          hudTitle.textContent = `[CHRONIK] ${pt.label.toUpperCase()}`;
          hudDate.textContent = pt.date;
          hudContent.textContent = pt.content;

          // Draw active pulse marker
          if (pulseMarker) pMap.removeLayer(pulseMarker);
          
          const pulseIcon = L.divIcon({
            className: 'custom-pulse-icon',
            html: `
              <div class="map-pulse-container">
                <div class="map-pulse-ring" style="border-color:${idx === 0 ? 'var(--cyan)' : 'var(--gold)'}; box-shadow: 0 0 10px ${idx === 0 ? 'var(--cyan)' : 'var(--gold)'};"></div>
                <div class="map-pulse-dot" style="background:${idx === 0 ? 'var(--cyan)' : 'var(--gold)'};"></div>
              </div>
            `,
            iconSize: [40, 40],
            iconAnchor: [0, 0] // center alignment helper
          });
          
          pulseMarker = L.marker([pt.lat, pt.lng], { icon: pulseIcon }).addTo(pMap);

          // Add a regular marker at this solved location
          const solIcon = L.divIcon({
            className: 'custom-map-icon',
            html: idx === 0 
              ? `<div class="map-marker-avatar ${riskClass(p.riskLevel)}" style="width:40px; height:40px; border:2px solid var(--cyan);">${avatarEl(p, 40)}</div>`
              : `<div style="background:var(--bg-panel); border:2px solid var(--gold); border-radius:50%; width:24px; height:24px; display:flex; align-items:center; justify-content:center; box-shadow:0 0 8px var(--gold); font-size:10px; font-weight:bold; color:var(--gold); font-family:var(--font-mono);">${idx}</div>`,
            iconSize: idx === 0 ? [40, 40] : [24, 24],
            iconAnchor: idx === 0 ? [20, 20] : [12, 12]
          });
          L.marker([pt.lat, pt.lng], { icon: solIcon }).addTo(pMap);

          // Draw path line from previous point
          if (idx > 0) {
            const prev = points[idx - 1];
            const line = L.polyline([[prev.lat, prev.lng], [pt.lat, pt.lng]], {
              color: 'var(--cyan)',
              weight: 4,
              opacity: 0.8,
              dashArray: '1, 10', // animate dash
              className: 'animate-path-line'
            }).addTo(pMap);
            
            // Subtle dash array animation
            let offset = 0;
            const lineAnim = setInterval(() => {
              if (!playInterval) {
                clearInterval(lineAnim);
                return;
              }
              offset = (offset + 1) % 20;
              line.setStyle({ dashArray: `4, 6`, dashOffset: `${-offset}` });
            }, 50);
            
            activeLines.push(line);
          }

          idx++;
        };

        playStep();
        playInterval = setInterval(playStep, 3500);
      };
    }
  }, 100);
}

function riskClass(level) {
  const map = { kritisch: 'risk-critical', hoch: 'risk-high', mittel: 'risk-medium', niedrig: 'risk-low' };
  return map[level] || 'risk-low';
}
