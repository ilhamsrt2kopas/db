/**
 * api.js - Komunikasi dengan Google Apps Script
 *
 * UTAMA: JSONP (script tag) → tidak kena CORS sama sekali
 * CADANGAN: GET fetch, lalu POST text/plain
 */

import { API_URL } from './config.js';
import { getCache, setCache, showLoading, hideLoading } from './utils.js';

export async function api(action, data = {}, { cacheKey = null, cacheTTL = 0, silent = false } = {}) {
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

  if (!silent) showLoading('Memuat data...');

  try {
    // === METODE UTAMA: JSONP (bebas CORS) ===
    const json = await jsonpRequest(action, data);

    if (cacheKey && json && json.success) {
      setCache(cacheKey, json, cacheTTL || 5 * 60 * 1000);
    }
    if (!silent) hideLoading();
    return json;
  } catch (errJsonp) {
    console.warn('JSONP gagal, coba GET...', errJsonp.message);
  }

  try {
    // === CADANGAN 1: GET ===
    const params = buildParams(action, data);
    const res = await fetch(`${API_URL}?${params.toString()}`, {
      method: 'GET',
      redirect: 'follow',
      credentials: 'omit',
      mode: 'cors'
    });
    const text = await res.text();
    const json = parseResponse(text);

    if (cacheKey && json.success) {
      setCache(cacheKey, json, cacheTTL || 5 * 60 * 1000);
    }
    if (!silent) hideLoading();
    return json;
  } catch (errGet) {
    console.warn('GET gagal, coba POST...', errGet.message);
  }

  try {
    // === CADANGAN 2: POST text/plain ===
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action, ...data }),
      redirect: 'follow',
      credentials: 'omit',
      mode: 'cors'
    });
    const text = await res.text();
    const json = parseResponse(text);

    if (cacheKey && json.success) {
      setCache(cacheKey, json, cacheTTL || 5 * 60 * 1000);
    }
    if (!silent) hideLoading();
    return json;
  } catch (errPost) {
    console.error('Semua metode API gagal:', errPost);
    if (!silent) hideLoading();
    return {
      success: false,
      message: 'Gagal terhubung ke server (CORS/jaringan). Pastikan Web App di-deploy sebagai "Anyone" dan API_URL benar.'
    };
  }
}

function buildParams(action, data) {
  const params = new URLSearchParams();
  params.set('action', action);
  params.set('payload', JSON.stringify(data || {}));
  for (const [k, v] of Object.entries(data || {})) {
    if (v === null || v === undefined) continue;
    params.set(k, typeof v === 'object' ? JSON.stringify(v) : String(v));
  }
  return params;
}

function parseResponse(text) {
  if (!text || !String(text).trim()) throw new Error('Response kosong');
  const trimmed = String(text).trim();
  try { return JSON.parse(trimmed); } catch (_) {}
  const match = trimmed.match(/\{[\s\S]*\}/);
  if (match) return JSON.parse(match[0]);
  throw new Error('Response bukan JSON: ' + trimmed.substring(0, 80));
}

/**
 * JSONP via <script> — metode paling andal untuk Google Apps Script
 * Backend harus membungkus response: callbackName({...})
 */
function jsonpRequest(action, data) {
  return new Promise((resolve, reject) => {
    const cbName = '_sr_cb_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9);
    const timeoutMs = 25000;

    let script = null;

    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error('Timeout menunggu respons server (25s)'));
    }, timeoutMs);

    function cleanup() {
      clearTimeout(timeout);
      try { delete window[cbName]; } catch (_) { window[cbName] = undefined; }
      if (script && script.parentNode) script.parentNode.removeChild(script);
    }

    window[cbName] = function (result) {
      cleanup();
      resolve(result);
    };

    const params = buildParams(action, data);
    params.set('callback', cbName);

    script = document.createElement('script');
    script.async = true;
    script.src = API_URL + '?' + params.toString();

    script.onerror = function () {
      cleanup();
      reject(new Error('Gagal memuat script JSONP. Cek API_URL dan deployment "Anyone".'));
    };

    document.head.appendChild(script);
  });
}
