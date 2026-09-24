/* ============================================================
   BACKEND CONFIGURATION & API SERVICE MODULE
============================================================ */
const API_BASE_URL = 'http://localhost:5000/api'; // Replace with your production API URL

class RxApiService {
  constructor() {
    this.token = localStorage.getItem('medcore_token') || null;
  }

  getHeaders() {
    const headers = { 'Content-Type': 'application/json' };
    if (this.token) headers['Authorization'] = `Bearer ${this.token}`;
    return headers;
  }

  async request(endpoint, options = {}) {
    options.headers = { ...this.getHeaders(), ...options.headers };
    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, options);
      if (response.status === 401) {
        this.logout();
        throw new Error('Session expired. Please sign in again.');
      }
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `API Error: ${response.statusText}`);
      }
      return await response.json();
    } catch (err) {
      console.error(`[API Error] ${endpoint}:`, err);
      throw err;
    }
  }

  async login(email, password) {
    const data = await this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
    if (data.token) {
      this.token = data.token;
      localStorage.setItem('medcore_token', data.token);
    }
    return data;
  }

  logout() {
    this.token = null;
    localStorage.removeItem('medcore_token');
  }
}

const RxApi = new RxApiService();

/* ============================================================
   TOAST NOTIFICATION SYSTEM
============================================================ */
function showToast(msg, type = 'primary', icon = 'bi-check-circle') {
  const wrap = document.createElement('div');
  wrap.className = 'toast align-items-center border-0 mb-2';
  wrap.setAttribute('role', 'alert');
  
  const colors = { 
    primary: 'var(--primary)', 
    success: 'var(--accent)', 
    danger: 'var(--danger)', 
    warn: 'var(--warn)' 
  };
  
  wrap.style.background = 'var(--surface)';
  wrap.style.border = '1px solid var(--border)';
  wrap.style.borderLeft = '4px solid ' + (colors[type] || colors.primary);
  wrap.style.borderRadius = 'var(--radius-sm)';
  wrap.style.minWidth = '280px';
  
  wrap.innerHTML = `<div class="d-flex">
    <div class="toast-body" style="font-size:.85rem; color:var(--ink);"><i class="bi ${icon} me-2" style="color:${colors[type] || colors.primary}"></i>${msg}</div>
    <button type="button" class="btn-close me-2 m-auto" data-bs-dismiss="toast"></button>
  </div>`;
  
  document.getElementById('toastContainer').appendChild(wrap);
  const t = new bootstrap.Toast(wrap, { delay: 3200 });
  t.show();
  wrap.addEventListener('hidden.bs.toast', () => wrap.remove());
}

/* ============================================================
   AUTHENTICATION LOGIC
============================================================ */
document.getElementById('login-form').addEventListener('submit', async function(e) {
  e.preventDefault();
  const btn = document.getElementById('loginSubmitBtn');
  btn.disabled = true;
  btn.innerHTML = `<span class="spinner-border spinner-border-sm me-2"></span> Authenticating...`;

  const email = document.getElementById('loginEmail').value;
  const password = document.getElementById('loginPassword').value;

  try {
    const authData = await RxApi.login(email, password);
    showToast('Signed in successfully.', 'success', 'bi-person-check');
    
    // Example action upon login success: redirect to main dashboard
    setTimeout(() => {
      // window.location.href = '/dashboard.html';
      console.log('User authenticated:', authData);
    }, 1000);

  } catch (err) {
    showToast(err.message || 'Login failed', 'danger', 'bi-shield-x');
  } finally {
    btn.disabled = false;
    btn.innerHTML = `Sign in to counter <i class="bi bi-arrow-right ms-1"></i>`;
  }
});