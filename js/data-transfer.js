// ─── ORION DATA TRANSFER — Import / Export Logic ────────────────────────────
// Handles import of single-person ZIPs, global ZIPs, and raw JSON backups.
// Shows a confirmation modal before importing to prevent accidental overwrites.

import { put, Persons, Interactions, Relationships, Files } from './db.js';
import { showToast } from './security.js';

/**
 * Main import entry: takes a File object, parses it, shows a confirmation
 * modal, then imports all data.
 * @param {File} file - .json or .zip file
 * @param {function} onComplete - callback after successful import
 */
export async function importDataFile(file, onComplete) {
  try {
    const data = await parseImportFile(file);
    if (!data) throw new Error('Keine gültigen ORION-Daten gefunden.');
    await showImportModal(data, onComplete);
  } catch (err) {
    showToast('Import fehlgeschlagen: ' + err.message, 'red');
  }
}

/**
 * Parse a .json or .zip file and extract structured ORION data.
 */
async function parseImportFile(file) {
  if (file.name.endsWith('.zip')) {
    const JSZip = window.JSZip;
    if (!JSZip) throw new Error('JSZip Bibliothek nicht geladen.');
    const zip = await JSZip.loadAsync(file);

    // Priority 1: person_data.json (single-person export)
    const personFile = zip.file('person_data.json');
    if (personFile) {
      const text = await personFile.async('string');
      const data = JSON.parse(text);
      data._type = data._type || 'single_person';
      data._source = file.name;
      return data;
    }

    // Priority 2: orion_backup.json (global export)
    const backupFile = zip.file('orion_backup.json');
    if (backupFile) {
      const text = await backupFile.async('string');
      const data = JSON.parse(text);
      data._type = data._type || 'global';
      data._source = file.name;
      return data;
    }

    // Priority 3: Scan sub-folders for person_data.json (multi-person in subfolders)
    const allFiles = Object.keys(zip.files);
    const personDataFiles = allFiles.filter(f => f.endsWith('person_data.json'));
    if (personDataFiles.length > 0) {
      // Merge all person_data.json files into one dataset
      const merged = { _type: 'multi_person', _source: file.name, persons: [], interactions: [], relationships: [], files: [] };
      for (const path of personDataFiles) {
        const text = await zip.file(path).async('string');
        const d = JSON.parse(text);
        merged.persons.push(...(d.persons || []));
        merged.interactions.push(...(d.interactions || []));
        merged.relationships.push(...(d.relationships || []));
        merged.files.push(...(d.files || []));
      }
      return merged;
    }

    throw new Error("Keine 'person_data.json' oder 'orion_backup.json' im ZIP gefunden.");
  } else {
    // Plain JSON
    const text = await file.text();
    const data = JSON.parse(text);
    data._type = data._type || 'global';
    data._source = file.name;
    return data;
  }
}

/**
 * Show a modal summarizing what will be imported and ask for confirmation.
 */
async function showImportModal(data, onComplete) {
  const persons = data.persons || [];
  const interactions = data.interactions || [];
  const relationships = data.relationships || [];
  const files = data.files || [];

  // Check for existing data to detect conflicts
  const existingPersons = await Persons.list();
  const existingIds = new Set(existingPersons.map(p => p.id));
  const newPersons = persons.filter(p => !existingIds.has(p.id));
  const updatePersons = persons.filter(p => existingIds.has(p.id));

  const typeLabel = data._type === 'single_person' ? 'Einzel-Person' :
    data._type === 'multi_person' ? 'Mehrere Personen' : 'Globales Backup';

  const filesWithData = files.filter(f => f.data);
  const totalFileSize = filesWithData.reduce((sum, f) => sum + (f.data?.length || 0), 0);
  const fileSizeStr = totalFileSize > 1048576 ? `${(totalFileSize / 1048576).toFixed(1)} MB` :
    totalFileSize > 1024 ? `${(totalFileSize / 1024).toFixed(0)} KB` : `${totalFileSize} B`;

  // Build modal
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.style.cssText = 'display:flex;align-items:center;justify-content:center;z-index:9999;';

  overlay.innerHTML = `
    <div class="modal" style="max-width:480px;width:90vw;max-height:80vh;overflow-y:auto;">
      <div class="modal-header">
        <span class="modal-title">📦 Import bestätigen</span>
        <button class="modal-close" id="import-cancel-x">✕</button>
      </div>
      <div class="modal-body" style="padding:16px;">
        
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;padding:10px;background:var(--panel-dark);border-radius:8px;border:1px solid var(--border);">
          <span style="font-size:20px;">📄</span>
          <div>
            <div style="font-size:12px;font-weight:700;color:var(--text-primary);font-family:var(--font-mono);">${data._source || 'Unbekannt'}</div>
            <div style="font-size:11px;color:var(--text-muted);">${typeLabel}${data._exportedAt ? ' · Exportiert: ' + new Date(data._exportedAt).toLocaleString('de-DE') : ''}</div>
          </div>
        </div>

        <div style="font-size:12px;font-weight:700;color:var(--text-primary);margin-bottom:8px;font-family:var(--font-mono);">INHALTE</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:16px;">
          ${[
            ['👤 Personen', persons.length, 'var(--cyan)'],
            ['💬 Interaktionen', interactions.length, 'var(--gold)'],
            ['🔗 Beziehungen', relationships.length, 'var(--purple)'],
            ['📎 Dateien', files.length, 'var(--green)'],
          ].map(([label, count, color]) => `
            <div style="background:var(--bg-input);border-radius:6px;padding:8px 10px;display:flex;justify-content:space-between;align-items:center;">
              <span style="font-size:11px;color:var(--text-secondary);">${label}</span>
              <span style="font-size:13px;font-weight:700;color:${color};font-family:var(--font-mono);">${count}</span>
            </div>
          `).join('')}
        </div>

        ${files.length > 0 ? `
          <div style="font-size:10px;color:var(--text-muted);margin-bottom:12px;font-family:var(--font-mono);">
            📎 Datei-Daten: ${fileSizeStr}
          </div>
        ` : ''}

        ${newPersons.length > 0 ? `
          <div style="margin-bottom:10px;">
            <div style="font-size:11px;font-weight:700;color:var(--green);margin-bottom:4px;font-family:var(--font-mono);">➕ NEU (${newPersons.length})</div>
            <div style="font-size:11px;color:var(--text-secondary);line-height:1.6;">
              ${newPersons.map(p => p.name).join(', ')}
            </div>
          </div>
        ` : ''}

        ${updatePersons.length > 0 ? `
          <div style="margin-bottom:10px;">
            <div style="font-size:11px;font-weight:700;color:var(--gold);margin-bottom:4px;font-family:var(--font-mono);">⟳ AKTUALISIERUNG (${updatePersons.length})</div>
            <div style="font-size:11px;color:var(--text-secondary);line-height:1.6;">
              ${updatePersons.map(p => p.name).join(', ')}
            </div>
            <div style="font-size:10px;color:var(--text-muted);margin-top:4px;">
              Vorhandene Daten werden mit den importierten Daten zusammengeführt (neuere Daten gewinnen).
            </div>
          </div>
        ` : ''}

        ${persons.length > 0 ? `
          <div style="margin-bottom:16px;">
            <div style="font-size:11px;font-weight:700;color:var(--text-muted);margin-bottom:6px;font-family:var(--font-mono);">PERSONEN-DETAILS</div>
            <div style="max-height:120px;overflow-y:auto;display:flex;flex-direction:column;gap:4px;">
              ${persons.map(p => `
                <div style="display:flex;align-items:center;gap:8px;padding:4px 8px;background:var(--bg-input);border-radius:4px;">
                  ${p.photo ? `<img src="${p.photo}" style="width:20px;height:20px;border-radius:50%;object-fit:cover;">` : `<div style="width:20px;height:20px;border-radius:50%;background:var(--panel-dark);display:flex;align-items:center;justify-content:center;font-size:10px;">👤</div>`}
                  <span style="font-size:11px;color:var(--text-primary);flex:1;">${p.name}</span>
                  <span style="font-size:10px;color:var(--text-muted);">${p.job || ''}</span>
                  <span style="font-size:10px;color:${existingIds.has(p.id) ? 'var(--gold)' : 'var(--green)'};font-family:var(--font-mono);">${existingIds.has(p.id) ? '⟳' : '➕'}</span>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}

        <div style="display:flex;gap:8px;justify-content:flex-end;padding-top:12px;border-top:1px solid var(--border);">
          <button class="btn btn-ghost" id="import-cancel">Abbrechen</button>
          <button class="btn btn-primary" id="import-confirm" style="min-width:140px;">
            <i data-lucide="download" style="width:14px;margin-right:4px;"></i> Jetzt importieren
          </button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  if (window.lucide) window.lucide.createIcons();

  // Close handlers
  const closeModal = () => overlay.remove();
  overlay.querySelector('#import-cancel').onclick = closeModal;
  overlay.querySelector('#import-cancel-x').onclick = closeModal;
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });

  // Import handler
  overlay.querySelector('#import-confirm').onclick = async () => {
    const btn = overlay.querySelector('#import-confirm');
    btn.textContent = '⏳ Importiere…';
    btn.disabled = true;

    try {
      let importedPersons = 0, importedInteractions = 0, importedRels = 0, importedFiles = 0;

      for (const p of persons) {
        // Smart merge: if person exists, merge fields (keep newest updatedAt)
        if (existingIds.has(p.id)) {
          const existing = await Persons.get(p.id);
          const existingTime = existing.updatedAt ? new Date(existing.updatedAt).getTime() : 0;
          const importTime = p.updatedAt ? new Date(p.updatedAt).getTime() : 0;
          // Merge: imported data wins if newer, but preserve any local-only fields
          if (importTime >= existingTime) {
            await put('persons', { ...existing, ...p });
          } else {
            // Still update fields that are missing locally
            const merged = { ...p, ...existing };
            await put('persons', merged);
          }
        } else {
          await put('persons', p);
        }
        importedPersons++;
      }
      for (const i of interactions) {
        await put('interactions', i);
        importedInteractions++;
      }
      for (const r of relationships) {
        await put('relationships', r);
        importedRels++;
      }
      for (const f of files) {
        await put('files', f);
        importedFiles++;
      }

      closeModal();
      showToast(`✅ Import abgeschlossen: ${importedPersons} Personen, ${importedInteractions} Interaktionen, ${importedRels} Beziehungen, ${importedFiles} Dateien`, 'cyan');
      if (onComplete) onComplete();
    } catch (err) {
      showToast('Import-Fehler: ' + err.message, 'red');
      btn.textContent = '❌ Fehlgeschlagen';
      btn.disabled = false;
    }
  };
}
