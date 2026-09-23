/**
 * utils.js - Helper umum
 */

let _loadingCount = 0;

export function showLoading(msg = 'Memuat...') {
  _loadingCount++;
  let el = document.getElementById('global-loading');
  if (!el) {
    el = document.createElement('div');
    el.id = 'global-loading';
    el.innerHTML = `
      <div class="loading-backdrop">
        <div class="loading-box">
          <div class="loading-spinner"></div>
          <div class="loading-text">${msg}</div>
        </div>
      </div>`;
    document.body.appendChild(el);
  } else {
    el.querySelector('.loading-text').textContent = msg;
    el.classList.remove('hidden');
  }
}

export function hideLoading() {
  _loadingCount = Math.max(0, _loadingCount - 1);
  if (_loadingCount === 0) {
    const el = document.getElementById('global-loading');
    if (el) el.classList.add('hidden');
  }
}

export function toast(msg, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = msg;
  container.appendChild(el);
  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(8px)';
    setTimeout(() => el.remove(), 250);
  }, 3000);
}

export function debounce(fn, delay = 300) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

export function throttle(fn, limit = 500) {
  let last = 0;
  return (...args) => {
    const now = Date.now();
    if (now - last >= limit) {
      last = now;
      fn(...args);
    }
  };
}

/** Simple in-memory cache untuk data yang jarang berubah */
const cache = new Map();
export function getCache(key) {
  const item = cache.get(key);
  if (!item) return null;
  if (Date.now() > item.exp) {
    cache.delete(key);
    return null;
  }
  return item.data;
}
export function setCache(key, data, ttlMs = 5 * 60 * 1000) {
  cache.set(key, { data, exp: Date.now() + ttlMs });
}
export function clearCache() {
  cache.clear();
}

export function formatDate(str) {
  if (!str) return '-';
  try {
    const d = new Date(str);
    return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return str;
  }
}

export function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

/** Generate QR data URL via online API (untuk cetak) */
export function qrDataUrl(text, size = 120) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(text)}`;
}
