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
    // Siswa tidak diizinkan login penuh (hanya untuk absensi context)
    if (res.data.type === 'siswa') {
      return { success: false, message: 'Siswa tidak dapat login. Gunakan akun Orang Tua atau Admin.', siswaData: res.data };
    }
    setUser(res.data);
  }
  return res;
}

export function logout() {
  clearUser();
  location.reload();
}
