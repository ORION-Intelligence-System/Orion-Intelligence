// ─── ORION PERSONS MODULE ─────────────────────────────────────────────────
import { Persons, Interactions } from './db.js';
import { navigate } from './router.js';
import { showToast } from './security.js';
import { playSave, playDelete, playModalOpen, playWarning } from './audio.js';

export function riskClass(level) {
  const map = { kritisch: 'risk-critical', hoch: 'risk-high', mittel: 'risk-medium', niedrig: 'risk-low' };
  return map[level] || 'risk-low';
}
export function riskBadgeClass(level) {
  const map = { kritisch: 'badge-red', hoch: 'badge-gold', mittel: 'badge-cyan', niedrig: 'badge-green' };
  return map[level] || 'badge-muted';
}
export function avatarEl(p, size = 44) {
  if (p.photo) return `<img src="${p.photo}" style="width:${size}px;height:${size}px;border-radius:50%;object-fit:cover;">`;
  const initials = (p.name || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
  return `<span style="font-size:${Math.round(size*0.4)}px;">${initials}</span>`;
}

// Compute current age from a birthday string (YYYY-MM-DD)
export function calcAge(birthday) {
  if (!birthday) return null;
  const b = new Date(birthday);
  if (isNaN(b)) return null;
  const today = new Date();
  let age = today.getFullYear() - b.getFullYear();
  const m = today.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < b.getDate())) age--;
  return age;
}
export function displayAge(p) {
  if (p.birthday) {
    const age = calcAge(p.birthday);
    const d = new Date(p.birthday);
    return age !== null ? `${age} J. (geb. ${d.toLocaleDateString('de-DE')})` : '–';
  }
  return p.age ? `${p.age} J.` : '–';
}

// ─── Persons List View ─────────────────────────────────────────────────────
export async function renderPersonsList(container) {
  const persons = await Persons.list();
  const interactions = await Interactions.listAll();

  // Sort by importance desc
  persons.sort((a, b) => (b.importance || 0) - (a.importance || 0));

  let filterText = '';
  let filterRisk = '';

  const render = async () => {
    // Always reload from DB so newly added/deleted persons appear immediately
    const [freshPersons, freshInteractions] = await Promise.all([Persons.list(), Interactions.listAll()]);
    persons.splice(0, persons.length, ...freshPersons);
    interactions.splice(0, interactions.length, ...freshInteractions);
    persons.sort((a, b) => (b.importance || 0) - (a.importance || 0));

    const filtered = persons.filter(p => {
      const matchText = !filterText || p.name?.toLowerCase().includes(filterText.toLowerCase()) || p.job?.toLowerCase().includes(filterText.toLowerCase());
      const matchRisk = !filterRisk || p.riskLevel === filterRisk;
      return matchText && matchRisk;
    });

    container.innerHTML = `
      <div class="section-header mb-4">
        <span class="section-title">Personen-Datenbank</span>
        <div class="flex gap-2">
          <button class="btn btn-primary btn-sm" id="btn-add-person">＋ Neue Person</button>
          <select class="form-select" style="width:130px;padding:4px 8px;font-size:11px;" id="filter-risk">
            <option value="">Alle Risiken</option>
            <option value="kritisch">Kritisch</option>
            <option value="hoch">Hoch</option>
            <option value="mittel">Mittel</option>
            <option value="niedrig">Niedrig</option>
          </select>
          <input class="form-input" id="filter-search" placeholder="Suchen..." style="width:180px;padding:6px 10px;font-size:12px;" value="${filterText}">
        </div>
      </div>
      ${filtered.length === 0 ? `
        <div class="empty-state">
          <div class="empty-icon">👥</div>
          <div class="empty-text">Keine Personen gefunden.</div>
          <button class="btn btn-primary" id="btn-add-person-2">Erste Person hinzufügen</button>
        </div>
      ` : `
        <div class="person-grid">
          ${filtered.map(p => {
            const lastInteraction = interactions.filter(i => i.personId === p.id).sort((a, b) => new Date(b.date) - new Date(a.date))[0];
            const lastText = lastInteraction ? `${lastInteraction.type} · ${new Date(lastInteraction.date).toLocaleDateString('de-DE')}` : 'Keine Interaktion';
            const ageStr = p.birthday ? calcAge(p.birthday) + ' J.' : (p.age ? p.age + ' J.' : '');
            return `
              <div class="person-card ${riskClass(p.riskLevel)}" data-id="${p.id}">
                <div class="person-avatar">${avatarEl(p)}</div>
                <div class="person-info">
                  <div class="person-name">${p.name || 'Unbekannt'}</div>
                  <div class="person-meta">${p.job || '–'} ${ageStr ? '· ' + ageStr : ''} ${p.location ? '· ' + p.location : ''}</div>
                  <div style="margin-top:6px;display:flex;gap:4px;flex-wrap:wrap;">
                    <span class="badge ${riskBadgeClass(p.riskLevel)}">${p.riskLevel || 'unbekannt'}</span>
                    ${p.status ? `<span class="badge badge-muted">${p.status}</span>` : ''}
                  </div>
                  <div style="margin-top:4px;font-size:10px;color:var(--text-muted);font-family:var(--font-mono);">${lastText}</div>
                </div>
                <div class="person-stats">
                  <div style="font-size:20px;font-weight:900;font-family:var(--font-mono);" class="${riskClass(p.riskLevel)}">${p.importance || 0}</div>
                  <div style="font-size:9px;color:var(--text-muted);font-family:var(--font-mono);">WICHTIG</div>
                </div>
              </div>`;
          }).join('')}
        </div>
      `}
    `;

    container.querySelectorAll('.person-card').forEach(card => {
      card.addEventListener('click', () => navigate('person/' + card.dataset.id));
    });
    container.querySelector('#filter-search')?.addEventListener('input', e => { filterText = e.target.value; render(); });
    container.querySelector('#filter-risk')?.addEventListener('change', e => { filterRisk = e.target.value; render(); });
    container.querySelector('#btn-add-person')?.addEventListener('click', () => openPersonModal(null, render));
    container.querySelector('#btn-add-person-2')?.addEventListener('click', () => openPersonModal(null, render));
    if (filterRisk) container.querySelector('#filter-risk').value = filterRisk;
  };

  render();
}

// ─── Person Form Modal ─────────────────────────────────────────────────────
export function openPersonModal(person = null, onSave) {
  playModalOpen();
  const isEdit = !!person;
  const p = person || {};

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal" style="width:700px;">
      <div class="modal-header">
        <span class="modal-title">${isEdit ? '✏️ PERSON BEARBEITEN' : '＋ NEUE PERSON'}</span>
        <button class="modal-close" id="modal-close-btn">✕</button>
      </div>
      <div class="modal-body">
        <div class="grid-2">
          <div>
            <div class="form-group">
              <label class="form-label">Name *</label>
              <input class="form-input" id="p-name" value="${p.name || ''}" placeholder="Vollständiger Name">
            </div>
            <div class="form-group">
              <label class="form-label">Aliase</label>
              <input class="form-input" id="p-aliases" value="${p.aliases || ''}" placeholder="Alias 1, Alias 2">
            </div>
            <div class="form-group">
              <label class="form-label">Geburtstag</label>
              <input class="form-input" type="date" id="p-birthday" value="${p.birthday || ''}">
              <div style="font-size:10px;color:var(--text-muted);margin-top:3px;font-family:var(--font-mono);" id="p-age-preview">${p.birthday ? '→ Alter: ' + calcAge(p.birthday) + ' Jahre' : 'Datum eingeben → Alter wird berechnet'}</div>
            </div>
            <div class="form-group">
              <label class="form-label">Beruf</label>
              <input class="form-input" id="p-job" value="${p.job || ''}" placeholder="Beruf / Funktion">
            </div>
            <div class="form-group">
              <label class="form-label">Standort</label>
              <input class="form-input" id="p-location" value="${p.location || ''}" placeholder="Stadt, Land">
            </div>
            <div class="form-group">
              <label class="form-label">Status</label>
              <select class="form-select" id="p-status">
                <option value="">Kein Status</option>
                ${['Aktiv','Inaktiv','Überwachen','Vertrauen','Gefährlich','Verbündeter','Konkurrenz','Unbekannt'].map(s => `<option value="${s}" ${p.status===s?'selected':''}>${s}</option>`).join('')}
              </select>
            </div>
          </div>
          <div>
            <div class="form-group">
              <label class="form-label">Persönlichkeitstyp</label>
              <input class="form-input" id="p-type" value="${p.personalityType || ''}" placeholder="z.B. INTJ, Narzisst, Empath">
            </div>
            <div class="form-group">
              <label class="form-label">Wichtigkeit (0–10)</label>
              <input class="form-input" type="number" id="p-importance" min="0" max="10" value="${p.importance ?? 5}">
            </div>
            <div class="form-group">
              <label class="form-label">Risiko-Level</label>
              <select class="form-select" id="p-risk">
                ${['niedrig','mittel','hoch','kritisch'].map(r => `<option value="${r}" ${p.riskLevel===r?'selected':''}>${r}</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Vertrauen (0–10)</label>
              <input class="form-input" type="number" id="p-trust" min="0" max="10" value="${p.trustLevel ?? 5}">
            </div>
            <div class="form-group">
              <label class="form-label">Einfluss (0–10)</label>
              <input class="form-input" type="number" id="p-influence" min="0" max="10" value="${p.influenceLevel ?? 5}">
            </div>
            <div class="form-group">
              <label class="form-label">Profilbild</label>
              <div style="display:flex; gap:12px; align-items:center;">
                <div id="p-photo-preview" style="flex-shrink:0;">${avatarEl(p, 40)}</div>
                <button class="btn btn-ghost btn-sm" id="btn-upload-photo" style="flex:1;"><i data-lucide="image-plus" style="width:14px;margin-right:4px;"></i> Bild wählen</button>
                <button class="btn btn-ghost btn-sm" id="btn-remove-photo" style="display:${p.photo ? 'block' : 'none'}; padding:4px 8px;" title="Bild entfernen"><i data-lucide="trash-2" style="width:14px;color:var(--red);"></i></button>
              </div>
              <input type="file" id="p-photo-file" accept="image/*" style="display:none;">
              <input type="hidden" id="p-photo" value="${p.photo || ''}">
            </div>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Kontakt</label>
          <input class="form-input" id="p-contact" value="${p.contact || ''}" placeholder="E-Mail, Telefon, Social...">
        </div>
        <div class="form-group">
          <label class="form-label">Notizen / Zusammenfassung</label>
          <textarea class="form-textarea" id="p-notes" rows="4" placeholder="Freie Notizen zur Person...">${p.notes || ''}</textarea>
        </div>
      </div>
      <div class="modal-footer">
        ${isEdit ? `<button class="btn btn-danger" id="btn-delete-person"><i data-lucide="trash-2" style="width:14px;"></i> Löschen</button>` : ''}
        <button class="btn btn-ghost" id="modal-cancel">Abbrechen</button>
        <button class="btn btn-primary" id="modal-save"><i data-lucide="save" style="width:14px;"></i> Speichern</button>
      </div>
    </div>
  `;
  if (window.lucide) window.lucide.createIcons();

  document.body.appendChild(overlay);
  const close = () => overlay.remove();
  overlay.querySelector('#modal-close-btn').onclick = close;
  overlay.querySelector('#modal-cancel').onclick = close;
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });

  // Live age preview when birthday changes
  overlay.querySelector('#p-birthday')?.addEventListener('input', (e) => {
    const preview = overlay.querySelector('#p-age-preview');
    if (!preview) return;
    const age = calcAge(e.target.value);
    preview.textContent = age !== null ? `→ Alter: ${age} Jahre` : 'Ungültiges Datum';
  });

  const photoInput = overlay.querySelector('#p-photo-file');
  const photoHidden = overlay.querySelector('#p-photo');
  const photoPreview = overlay.querySelector('#p-photo-preview');
  const btnRemovePhoto = overlay.querySelector('#btn-remove-photo');
  
  overlay.querySelector('#btn-upload-photo').onclick = () => photoInput.click();
  btnRemovePhoto.onclick = () => {
    photoHidden.value = '';
    btnRemovePhoto.style.display = 'none';
    photoPreview.innerHTML = avatarEl({ ...p, name: overlay.querySelector('#p-name').value, photo: '' }, 40);
  };
  photoInput.onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ex) => {
      photoHidden.value = ex.target.result;
      photoPreview.innerHTML = avatarEl({ photo: ex.target.result }, 40);
      btnRemovePhoto.style.display = 'block';
    };
    reader.readAsDataURL(file);
  };

  if (isEdit) {
    overlay.querySelector('#btn-delete-person').onclick = async () => {
      if (confirm(`"${p.name}" wirklich löschen?`)) {
        playDelete();
        await Persons.del(p.id);
        showToast('Person gelöscht', 'red');
        close();
        onSave?.();
        navigate('persons');
      }
    };
  }

  overlay.querySelector('#modal-save').onclick = async () => {
    const name = overlay.querySelector('#p-name').value.trim();
    if (!name) { playWarning(); showToast('Name ist Pflichtfeld', 'red'); return; }

    // Duplicate name check (case-insensitive, ignores the person being edited)
    const allPersons = await Persons.list();
    const duplicate = allPersons.find(existing =>
      existing.name?.toLowerCase() === name.toLowerCase() && existing.id !== p.id
    );
    if (duplicate) {
      playWarning();
      showToast(`„${name}" existiert bereits im System!`, 'red');
      return;
    }
    const birthday = overlay.querySelector('#p-birthday').value || null;
    const obj = {
      ...(p || {}),
      name,
      aliases: overlay.querySelector('#p-aliases').value,
      birthday,
      age: birthday ? calcAge(birthday) : null,  // keep computed for AI context
      job: overlay.querySelector('#p-job').value,
      location: overlay.querySelector('#p-location').value,
      status: overlay.querySelector('#p-status').value,
      personalityType: overlay.querySelector('#p-type').value,
      importance: parseInt(overlay.querySelector('#p-importance').value) || 5,
      riskLevel: overlay.querySelector('#p-risk').value,
      trustLevel: parseInt(overlay.querySelector('#p-trust').value) || 5,
      influenceLevel: parseInt(overlay.querySelector('#p-influence').value) || 5,
      photo: overlay.querySelector('#p-photo').value,
      contact: overlay.querySelector('#p-contact').value,
      notes: overlay.querySelector('#p-notes').value,
      createdAt: p.createdAt || new Date().toISOString(),
    };
    await Persons.save(obj);
    playSave();
    showToast(isEdit ? 'Person aktualisiert' : 'Person erstellt', 'cyan');
    close();
    onSave?.();
  };
}
