// ─── ORION GLOBAL SEARCH ─────────────────────────────────────────────────
import { Persons, Interactions, Files } from './db.js';
import { navigate } from './router.js';
import { playSearchOpen, playSearchClose, playClick } from './audio.js';

let searchOverlay = null;

export function initSearch() {
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      openSearch();
    }
    if (e.key === 'Escape' && searchOverlay) closeSearch();
  });

  // Also wire search button in header
  document.getElementById('btn-global-search')?.addEventListener('click', openSearch);
}

function openSearch() {
  if (searchOverlay) return;
  playSearchOpen();
  searchOverlay = document.createElement('div');
  searchOverlay.className = 'search-overlay';
  searchOverlay.id = 'search-overlay';
  searchOverlay.innerHTML = `
    <div class="search-box">
      <div class="search-input-row">
        <span class="search-icon"><i data-lucide="search" style="width:16px;"></i></span>
        <input class="search-input" id="global-search-input" placeholder="Person, Ereignis, Aussage, Datei suchen..." autofocus>
        <span class="search-kbd">ESC</span>
      </div>
      <div class="search-results" id="search-results">
        <div class="search-empty">Suchbegriff eingeben...</div>
      </div>
    </div>
  `;
  document.body.appendChild(searchOverlay);
  searchOverlay.addEventListener('click', e => { if (e.target === searchOverlay) closeSearch(); });

  const input = searchOverlay.querySelector('#global-search-input');
  input.addEventListener('input', debounce((e) => performSearch(e.target.value), 200));
  input.focus();
}

function closeSearch() {
  playSearchClose();
  searchOverlay?.remove();
  searchOverlay = null;
}

async function performSearch(query) {
  const q = query.trim().toLowerCase();
  const resultsEl = document.getElementById('search-results');
  if (!q || q.length < 2) {
    resultsEl.innerHTML = '<div class="search-empty">Mindestens 2 Zeichen eingeben...</div>';
    return;
  }
  const [persons, interactions, files] = await Promise.all([
    Persons.list(), Interactions.listAll(), Files.listAll(),
  ]);

  const results = [];

  // Match persons
  persons.forEach(p => {
    const score = [p.name, p.job, p.location, p.aliases, p.notes]
      .filter(Boolean).join(' ').toLowerCase();
    if (score.includes(q)) results.push({ type: 'Person', name: p.name, sub: p.job || '–', id: p.id, route: 'person/' + p.id, icon: 'user' });
  });

  // Match interactions
  interactions.forEach(i => {
    if (i.content?.toLowerCase().includes(q) || i.tags?.toLowerCase().includes(q)) {
      const person = persons.find(p => p.id === i.personId);
      results.push({ type: 'Interaktion', name: i.content.slice(0, 60) + (i.content.length > 60 ? '…' : ''), sub: `${i.type} · ${person?.name || '–'} · ${new Date(i.date).toLocaleDateString('de-DE')}`, id: i.id, route: 'person/' + i.personId, icon: 'file-text' });
    }
  });

  // Match files
  files.forEach(f => {
    if (f.name?.toLowerCase().includes(q)) {
      const person = persons.find(p => p.id === f.personId);
      results.push({ type: 'Datei', name: f.name, sub: person?.name || '–', id: f.id, route: 'person/' + f.personId, icon: 'folder' });
    }
  });

  if (results.length === 0) {
    resultsEl.innerHTML = `<div class="search-empty">Keine Ergebnisse für "<strong>${query}</strong>"</div>`;
    return;
  }

  resultsEl.innerHTML = results.slice(0, 20).map((r, i) => `
    <div class="search-result-item" data-route="${r.route}" data-idx="${i}">
      <span style="font-size:16px;display:flex;align-items:center;color:var(--text-muted);"><i data-lucide="${r.icon}" style="width:16px;"></i></span>
      <span class="search-result-type">${r.type}</span>
      <div>
        <div class="search-result-name">${r.name}</div>
        <div class="search-result-sub">${r.sub}</div>
      </div>
    </div>
  `).join('');
  if (window.lucide) window.lucide.createIcons();

  resultsEl.querySelectorAll('.search-result-item').forEach(item => {
    item.addEventListener('click', () => {
      playClick();
      navigate(item.dataset.route);
      searchOverlay?.remove();
      searchOverlay = null;
    });
  });
}

function debounce(fn, ms) {
  let timer;
  return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), ms); };
}
