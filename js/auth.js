/**
 * auth.js - Login, Logout, Session lokal (localStorage)
 * Tidak ada session server-side.
 */

import { api } from './api.js';
import { toast, clearCache } from './utils.js';

const STORAGE_KEY = 'sr_user';

export function getUser() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setUser(user) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
}

export function clearUser() {
  localStorage.removeItem(STORAGE_KEY);
  sessionStorage.clear();
  clearCache();
}

export function isLoggedIn() {
  return !!getUser();
}

export async function loginAdmin(nip, password) {
  const res = await api('login', { nip, password });
  if (res.success) {
    setUser(res.data);
  }
  return res;
}

export async function loginQR(code) {
  const res = await api('loginQR', { code });
  if (res.success) {
    if (res.data.type === 'siswa') {
      return { success: false, message: 'Siswa tidak dapat login. Gunakan akun Orang Tua atau Admin.', siswaData: res.data };
    }
    setUser(res.data);
  }
  return res;
}

/**
 * Logout bersih: hapus storage + cache SW, lalu navigasi ke root
 * (hindari state "terputus" yang butuh refresh manual)
 */
export async function logout() {
  clearUser();

  // Hapus cache Service Worker agar request berikutnya segar
  try {
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map(k => caches.delete(k)));
    }
  } catch (_) {}

  // Navigasi penuh ke halaman utama (bukan reload state lama)
  const base = location.pathname.replace(/\/[^/]*$/, '/') || '/';
  location.replace(base + 'index.html?t=' + Date.now());
}
