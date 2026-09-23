/**
 * api.js - Wrapper panggilan ke Google Apps Script
 *
 * Strategi (urut prioritas):
 * 1. GET dengan parameter (paling andal, tidak kena preflight CORS)
 * 2. POST text/plain (hindari preflight)
 * 3. JSONP via <script> tag (fallback terakhir)
 */

import { API_URL } from './config.js';
import { getCache, setCache } from './utils.js';

export async function api(action, data = {}, { cacheKey = null, cacheTTL = 0 } = {}) {
  if (!API_URL || API_URL.includes('GANTI_DENGAN')) {
    return {
      success: false,
      message: 'API_URL belum diatur. Buka js/config.js dan isi Web App URL dari Google Apps Script.'
    };
  }

  if (cacheKey) {
    const cached = getCache(cacheKey);
    if (cached) return cached;
  }

  const payload = { action, ...data };

  // --- Method 1: GET (paling kompatibel dengan Apps Script) ---
  try {
    const params = new URLSearchParams();
    params.set('action', action);
    // Kirim seluruh data sebagai satu JSON string agar objek/array tidak rusak
    params.set('payload', JSON.stringify(data));
    // Juga kirim field sederhana agar e.parameter langsung terbaca
    for (const [k, v] of Object.entries(data)) {
      if (v === null || v === undefined) continue;
      if (typeof v === 'object') {
        params.set(k, JSON.stringify(v));
      } else {
        params.set(k, String(v));
      }
    }

    const url = `${API_URL}?${params.toString()}`;
    const res = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      credentials: 'omit'
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const text = await res.text();
    const json = parseResponse(text);

    if (cacheKey && json.success) {
      setCache(cacheKey, json, cacheTTL || 5 * 60 * 1000);
    }
    return json;
  } catch (err1) {
    console.warn('API GET gagal, coba POST...', err1.message);
  }

  // --- Method 2: POST text/plain (hindari CORS preflight) ---
  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
      redirect: 'follow',
      credentials: 'omit'
    });

    const text = await res.text();
    const json = parseResponse(text);

    if (cacheKey && json.success) {
      setCache(cacheKey, json, cacheTTL || 5 * 60 * 1000);
    }
    return json;
  } catch (err2) {
    console.warn('API POST gagal, coba JSONP...', err2.message);
  }

  // --- Method 3: JSONP (script tag, bypass CORS total) ---
  try {
    const json = await jsonpRequest(action, data);
    if (cacheKey && json.success) {
      setCache(cacheKey, json, cacheTTL || 5 * 60 * 1000);
    }
    return json;
  } catch (err3) {
    console.error('API Error (semua metode gagal):', err3);
    return {
      success: false,
      message: 'Gagal terhubung ke server. Pastikan: (1) Web App sudah di-deploy sebagai "Anyone", (2) API_URL di config.js benar, (3) koneksi internet aktif.'
    };
  }
}

function parseResponse(text) {
  if (!text || !text.trim()) {
    throw new Error('Response kosong');
  }
  // Kadang Apps Script membungkus dengan callback atau HTML
  const trimmed = text.trim();
  // Coba parse langsung
  try {
    return JSON.parse(trimmed);
  } catch (_) {}
  // Coba ekstrak JSON dari teks
  const match = trimmed.match(/\{[\s\S]*\}/);
  if (match) {
    return JSON.parse(match[0]);
  }
  throw new Error('Response bukan JSON valid: ' + trimmed.substring(0, 100));
}

function jsonpRequest(action, data) {
  return new Promise((resolve, reject) => {
    const cbName = '_gas_cb_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error('JSONP timeout'));
    }, 20000);

    function cleanup() {
      clearTimeout(timeout);
      delete window[cbName];
      if (script.parentNode) script.parentNode.removeChild(script);
    }

    window[cbName] = (result) => {
      cleanup();
      resolve(result);
    };

    const params = new URLSearchParams();
    params.set('action', action);
    params.set('callback', cbName);
    params.set('payload', JSON.stringify(data));
    for (const [k, v] of Object.entries(data)) {
      if (v === null || v === undefined) continue;
      params.set(k, typeof v === 'object' ? JSON.stringify(v) : String(v));
    }

    const script = document.createElement('script');
    script.src = `${API_URL}?${params.toString()}`;
    script.onerror = () => {
      cleanup();
      reject(new Error('JSONP script load failed'));
    };
    document.head.appendChild(script);
  });
}
