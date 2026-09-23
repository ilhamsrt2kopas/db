/**
 * petugas.js
 */
import { api } from '../api.js';
import { escapeHtml, debounce } from '../utils.js';

export async function render(container) {
  container.innerHTML = `
    <div class="search-box">
      <span class="icon">🔍</span>
      <input type="search" id="cari-petugas" placeholder="Cari NIP / Nama / Jabatan..." />
    </div>
    <div id="list-petugas"><div class="empty">Memuat...</div></div>
  `;

  const doLoad = debounce(load, 300);
  document.getElementById('cari-petugas').addEventListener('input', doLoad);
  load();
}

async function load() {
  const q = document.getElementById('cari-petugas').value.trim();
  const res = await api('getPetugas', { q }, { cacheKey: q ? null : 'petugas_all', cacheTTL: 120000 });
  const list = res.data || [];
  const el = document.getElementById('list-petugas');
  if (!list.length) {
    el.innerHTML = '<div class="empty">Tidak ada data</div>';
    return;
  }
  el.innerHTML = list.map(p => `
    <div class="list-item">
      <div class="info">
        <div class="name">${escapeHtml(p.Nama)}</div>
        <div class="meta">${p.NIP} · ${escapeHtml(p.Jabatan || '')}${p.Berwenang ? ' · ' + p.Berwenang : ''}</div>
        <div class="meta" style="font-size:0.75rem">HP: ${p.NoHP || '-'}</div>
      </div>
    </div>`).join('');
}
