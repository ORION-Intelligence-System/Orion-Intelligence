// ─── ORION ROUTER — Hash-based SPA Router ────────────────────────────────
const routes = new Map();
let currentRoute = null;

export function route(path, handler) {
  routes.set(path, handler);
}

export function navigate(path) {
  window.location.hash = '#' + path;
}

export function currentPath() {
  return window.location.hash.replace('#', '') || 'dashboard';
}

export function initRouter() {
  const handleRoute = () => {
    const hash = currentPath();
    // Match /person/:id
    if (hash.startsWith('person/')) {
      const handler = routes.get('person/:id');
      const id = hash.replace('person/', '');
      if (handler) handler({ id });
      return;
    }
    const handler = routes.get(hash) || routes.get('dashboard');
    if (handler) handler({});
    currentRoute = hash;
    // Update nav active state
    document.querySelectorAll('.nav-item').forEach(el => {
      el.classList.toggle('active', el.dataset.route === hash);
    });
  };
  window.addEventListener('hashchange', handleRoute);
  handleRoute();
}
