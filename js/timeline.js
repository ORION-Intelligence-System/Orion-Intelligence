// ─── ORION GLOBAL TIMELINE ──────────────────────────────────────────────────
import { Interactions, Persons } from './db.js';
import { navigate } from './router.js';
import { avatarEl } from './persons.js';

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
