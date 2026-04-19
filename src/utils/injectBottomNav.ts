// src/utils/injectBottomNav.ts

export function injectBottomNav() {
  if (document.getElementById('sc-bottom-nav')) return;

  const nav = document.createElement('div');
  nav.id = 'sc-bottom-nav';

  nav.innerHTML = `
    <a href="/" data-navlink>
      <svg viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
      <span>Feed</span>
    </a>
    <a href="/trending" data-navlink>
      <svg viewBox="0 0 24 24"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>
      <span>Trend</span>
    </a>
    <a href="/discover" data-navlink>
      <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
      <span>Discover</span>
    </a>
    <a href="/dm" data-navlink>
      <svg viewBox="0 0 24 24"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
      <span>DMs</span>
    </a>
    <a href="/profile" data-navlink data-profile>
      <svg viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
      <span>Profile</span>
    </a>
  `;

  document.body.appendChild(nav);

  function resolveProfileLink() {
    const anchor = nav.querySelector('a[data-profile]') as HTMLAnchorElement | null;
    if (!anchor) return;
    const name = localStorage.getItem('solchat_name');
    if (name && name !== 'guest') {
      anchor.setAttribute('href', `/profile/${name}`);
    }
  }

  resolveProfileLink();

  const t = setInterval(() => {
    const name = localStorage.getItem('solchat_name');
    if (name && name !== 'guest') {
      const anchor = nav.querySelector('a[data-profile]') as HTMLAnchorElement | null;
      if (anchor) anchor.setAttribute('href', `/profile/${name}`);
      clearInterval(t);
    }
  }, 800);
  setTimeout(() => clearInterval(t), 20000);

  function updateActive() {
    const path = window.location.pathname;
    nav.querySelectorAll('a[data-navlink]').forEach((a) => {
      const href = a.getAttribute('href') ?? '';
      const isActive = href === '/' ? path === '/' : path.startsWith(href);
      a.classList.toggle('active', isActive);
    });
  }

  updateActive();

  nav.querySelectorAll('a[data-navlink]').forEach((a) => {
    a.addEventListener('click', (e) => {
      e.preventDefault();
      const href = (a as HTMLAnchorElement).getAttribute('href') ?? '/';
      window.history.pushState({}, '', href);
      window.dispatchEvent(new PopStateEvent('popstate'));
      updateActive();
    });
  });

  window.addEventListener('popstate', updateActive);
}