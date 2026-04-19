/**
 * src/utils/injectBottomNav.ts
 * Call once in App.tsx: useEffect(() => { injectBottomNav(); }, []);
 */
export function injectBottomNav() {
  if (document.getElementById('sc-bottom-nav')) return;

  const nav = document.createElement('nav');
  nav.id = 'sc-bottom-nav';

  nav.innerHTML = `
    <a href="/" data-path="/" aria-label="Feed">
      <svg viewBox="0 0 24 24"><path d="M3 12L12 3L21 12V21H15V15H9V21H3V12Z"/></svg>
      <span>Feed</span>
    </a>
    <a href="/trending" data-path="/trending" aria-label="Trending">
      <svg viewBox="0 0 24 24"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>
      <span>Trend</span>
    </a>
    <a href="/dm" data-path="/dm" aria-label="DMs">
      <svg viewBox="0 0 24 24"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
      <span>DMs</span>
    </a>
    <a href="/notifications" data-path="/notifications" aria-label="Alerts">
      <svg viewBox="0 0 24 24"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>
      <span>Alerts</span>
    </a>
    <a href="/profile/me" data-path="/profile" aria-label="Profile">
      <svg viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
      <span>Profile</span>
    </a>
  `;

  document.body.appendChild(nav);

  function getProfileHref(): string {
    const name = localStorage.getItem('solchat_name');
    return (name && name !== 'guest') ? `/profile/${name}` : '/profile/me';
  }

  function syncActive() {
    const path = window.location.pathname;
    const profileLink = nav.querySelector<HTMLAnchorElement>('a[data-path="/profile"]');
    if (profileLink) profileLink.href = getProfileHref();

    nav.querySelectorAll<HTMLAnchorElement>('a').forEach(a => {
      const ap = a.getAttribute('data-path') ?? '';
      a.classList.toggle('active', ap === '/' ? path === '/' : path.startsWith(ap));
    });
  }

  syncActive();

  const root = document.getElementById('root');
  if (root) new MutationObserver(syncActive).observe(root, { childList: true, subtree: false });
  window.addEventListener('popstate', syncActive);

  nav.querySelectorAll<HTMLAnchorElement>('a').forEach(a => {
    a.addEventListener('click', e => {
      e.preventDefault();
      let href = a.getAttribute('href') ?? '/';
      if (a.getAttribute('data-path') === '/profile') href = getProfileHref();
      window.history.pushState({}, '', href);
      window.dispatchEvent(new PopStateEvent('popstate'));
      syncActive();
    });
  });
}