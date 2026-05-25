// ============================================
// Navbar Component — Shared across all pages
// ============================================
import { onAuthChange, logoutUser, getUserProfile } from './auth.js';
import { getCurrentUser } from './auth.js';

// ============================================
// renderNavbar()
// ============================================
export function renderNavbar(activePage = '') {
  const navContainer = document.getElementById('navbar');
  if (!navContainer) return;

  navContainer.innerHTML = `
    <nav class="navbar">
      <a href="index.html" class="navbar-brand">EZ Programming</a>

      <div class="navbar-links" id="navLinks">
        <a href="index.html" class="nav-link ${activePage === 'home' ? 'active' : ''}">Home</a>
        <a href="dashboard.html" class="nav-link ${activePage === 'dashboard' ? 'active' : ''}" id="navDashboard">Lessons</a>
        <a href="login.html" class="nav-link ${activePage === 'login' ? 'active' : ''}" id="navLogin">Login</a>
        <a href="signup.html" class="nav-link ${activePage === 'signup' ? 'active' : ''}" id="navSignup">Sign Up</a>
        <a href="admin.html" class="nav-link hidden" id="navAdmin">Admin</a>
        <a href="#" class="nav-link nav-logout hidden" id="navLogout">Logout</a>

        <div class="nav-divider"></div>

        <button class="theme-toggle" id="themeToggle" aria-label="Toggle dark mode" title="Toggle dark mode">
          <svg class="icon-sun" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
            <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
          </svg>
          <svg class="icon-moon" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
          </svg>
        </button>
      </div>

      <button class="nav-toggle" id="navToggle" aria-label="Toggle navigation">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>
    </nav>
  `;

  // ── Theme toggle logic ──
  const themeToggle = document.getElementById('themeToggle');
  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme');
      const next = current === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      localStorage.setItem('ez-theme', next);
    });
  }

  // Mobile menu toggle
  const toggle = document.getElementById('navToggle');
  const links = document.getElementById('navLinks');
  if (toggle && links) {
    toggle.addEventListener('click', () => links.classList.toggle('open'));
  }

  // Auth state → show/hide nav links
  onAuthChange(async (user) => {
    const navLogin     = document.getElementById('navLogin');
    const navSignup    = document.getElementById('navSignup');
    const navLogout    = document.getElementById('navLogout');
    const navDashboard = document.getElementById('navDashboard');
    const navAdmin     = document.getElementById('navAdmin');

    if (user) {
      navLogin?.classList.add('hidden');
      navSignup?.classList.add('hidden');
      navLogout?.classList.remove('hidden');
      navDashboard?.classList.remove('hidden');

      try {
        const profile = await getUserProfile(user.uid);
        const isAdmin = profile?.role === 'admin';
        if (navAdmin) navAdmin.classList.toggle('hidden', !isAdmin);
      } catch {
        navAdmin?.classList.add('hidden');
      }
    } else {
      navLogin?.classList.remove('hidden');
      navSignup?.classList.remove('hidden');
      navLogout?.classList.add('hidden');
      navAdmin?.classList.add('hidden');
    }
  });

  // Logout handler
  document.getElementById('navLogout')?.addEventListener('click', async (e) => {
    e.preventDefault();
    try {
      await logoutUser();
      window.location.href = 'index.html';
    } catch (err) {
      console.error('Logout error:', err);
    }
  });
}

// ============================================
// renderFooter()
// ============================================
export function renderFooter() {
  const el = document.getElementById('footer');
  if (!el) return;
  el.innerHTML = `
    <footer class="footer">
      <span>2026 EZ Programming</span>
      <div class="footer-links">
        <a href="#">Privacy</a>
        <a href="#">Terms</a>
        <a href="#">Contact</a>
      </div>
    </footer>
  `;
}

// ============================================
// showToast()
// ============================================
export function showToast(message, type = 'info') {
  document.querySelector('.toast')?.remove();
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('show'));
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}
