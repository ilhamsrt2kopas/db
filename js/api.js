/**
 * api.js - Wrapper panggilan ke Google Apps Script
 * Menggunakan JSONP-like via callback untuk hindari CORS issue,
 * atau fetch dengan mode no-cors fallback.
 */

import { API_URL } from './config.js';
import { getCache, setCache } from './utils.js';

export async function api(action, data = {}, { cacheKey = null, cacheTTL = 0 } = {}) {
  if (cacheKey) {
    const cached = getCache(cacheKey);
    if (cached) return cached;
  }

  const payload = { action, ...data };

  try {
    // Method 1: POST dengan fetch (bekerja jika CORS diizinkan / redirect)
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // Apps Script trick
      body: JSON.stringify(payload),
      redirect: 'follow'
    });

    const text = await res.text();
    let json;
    try {
      json = JSON.parse(text);
    } catch {
      // Kadang Apps Script return HTML redirect, coba extract
      throw new Error('Response bukan JSON valid');
    }

    if (cacheKey && json.success) {
      setCache(cacheKey, json, cacheTTL || 5 * 60 * 1000);
    }
    return json;
  } catch (err) {
    // Fallback: GET dengan query string (untuk action sederhana)
    try {
      const params = new URLSearchParams({ action, ...flatten(data) });
      const res2 = await fetch(`${API_URL}?${params.toString()}`);
      const json2 = await res2.json();
      if (cacheKey && json2.success) setCache(cacheKey, json2, cacheTTL);
      return json2;
    } catch (err2) {
      console.error('API Error:', err, err2);
      return { success: false, message: 'Gagal terhubung ke server. Periksa koneksi.' };
    }
  }
}

function flatten(obj, prefix = '') {
  const result = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
      Object.assign(result, flatten(v, prefix + k + '_'));
    } else if (Array.isArray(v)) {
      result[prefix + k] = JSON.stringify(v);
    } else {
      result[prefix + k] = v;
    }
  }
  return result;
}
