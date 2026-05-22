// ============================================
// Navbar Component - Shared across all pages
// ============================================
import { onAuthChange, logoutUser } from './auth.js';

/**
 * Render the navbar into the page
 * Call this on every page that needs the navbar
 */
export function renderNavbar(activePage = '') {
  const navContainer = document.getElementById('navbar');
  if (!navContainer) return;

  navContainer.innerHTML = `
    <nav class="navbar">
      <a href="/" class="navbar-brand">EZ Programming</a>

      <button class="nav-toggle" id="navToggle" aria-label="Toggle navigation">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      <div class="navbar-links" id="navLinks">
        <a href="/" class="${activePage === 'home' ? 'active' : ''}">Home</a>
        <a href="/dashboard.html" class="${activePage === 'dashboard' ? 'active' : ''}" id="navDashboard">Lessons</a>
        <a href="/login.html" class="${activePage === 'login' ? 'active' : ''}" id="navLogin">Login</a>
        <a href="/signup.html" id="navSignup">
          <button class="btn btn-primary btn-sm">Sign Up</button>
        </a>
        <a href="#" id="navLogout" class="hidden">
          <button class="btn btn-outline btn-sm">Logout</button>
        </a>
      </div>
    </nav>
  `;

  // Mobile menu toggle
  const toggle = document.getElementById('navToggle');
  const links = document.getElementById('navLinks');
  if (toggle && links) {
    toggle.addEventListener('click', () => {
      links.classList.toggle('open');
    });
  }

  // Listen for auth state to toggle login/logout links
  onAuthChange((user) => {
    const navLogin = document.getElementById('navLogin');
    const navSignup = document.getElementById('navSignup');
    const navLogout = document.getElementById('navLogout');
    const navDashboard = document.getElementById('navDashboard');

    if (user) {
      // User is logged in
      if (navLogin) navLogin.classList.add('hidden');
      if (navSignup) navSignup.classList.add('hidden');
      if (navLogout) navLogout.classList.remove('hidden');
      if (navDashboard) navDashboard.classList.remove('hidden');
    } else {
      // User is logged out
      if (navLogin) navLogin.classList.remove('hidden');
      if (navSignup) navSignup.classList.remove('hidden');
      if (navLogout) navLogout.classList.add('hidden');
    }
  });

  // Logout button handler
  const logoutBtn = document.getElementById('navLogout');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      try {
        await logoutUser();
        window.location.href = '/';
      } catch (error) {
        console.error('Logout error:', error);
      }
    });
  }
}

/**
 * Render the footer into the page
 */
export function renderFooter() {
  const footerContainer = document.getElementById('footer');
  if (!footerContainer) return;

  footerContainer.innerHTML = `
    <footer class="footer">
      <div class="footer-content">
        <span class="footer-text">2026 EZ Programming</span>
        <div class="footer-links">
          <a href="#">Privacy</a>
          <a href="#">Terms</a>
          <a href="#">Contact</a>
        </div>
      </div>
    </footer>
  `;
}

/**
 * Show a toast notification
 */
export function showToast(message, type = 'info') {
  // Remove any existing toasts
  const existingToast = document.querySelector('.toast');
  if (existingToast) existingToast.remove();

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);

  // Trigger show animation
  requestAnimationFrame(() => {
    toast.classList.add('show');
  });

  // Auto-hide after 3 seconds
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}
