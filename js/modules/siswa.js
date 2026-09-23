/**
 * siswa.js - Data Siswa + search live + cetak daftar
 */
import { api } from '../api.js';
import { toast, escapeHtml, debounce } from '../utils.js';

export async function render(container, user) {
  container.innerHTML = `
    <div class="search-box">
      <span class="icon">🔍</span>
      <input type="search" id="cari-siswa" placeholder="Cari dari semua kolom..." />
    </div>
    <div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap">
      <select id="filter-jenjang" style="flex:1;padding:8px;border-radius:8px;border:1.5px solid #d1d5db">
        <option value="">Semua Jenjang</option>
        <option value="SD">SD</option>
        <option value="SMP">SMP</option>
        <option value="SMA">SMA</option>
      </select>
      <button class="btn btn-accent btn-sm" id="btn-cetak-daftar">Cetak Daftar</button>
    </div>
    <div id="list-siswa"><div class="empty">Memuat...</div></div>
  `;

  const doLoad = debounce(load, 300);
  document.getElementById('cari-siswa').addEventListener('input', doLoad);
  document.getElementById('filter-jenjang').addEventListener('change', load);
  document.getElementById('btn-cetak-daftar').addEventListener('click', cetakDaftar);
  load();
}

async function load() {
  const q = document.getElementById('cari-siswa').value.trim();
  const jenjang = document.getElementById('filter-jenjang').value;
  const res = q
    ? await api('searchSiswa', { q })
    : await api('getSiswa', { jenjang }, { cacheKey: 'siswa_' + (jenjang || 'all'), cacheTTL: 120000 });

  const el = document.getElementById('list-siswa');

  if (res.data && !Array.isArray(res.data)) {
    // Grouped by jenjang
    const grouped = res.data;
    if (!Object.keys(grouped).length) {
      el.innerHTML = '<div class="empty">Tidak ada data</div>';
      return;
    }
    let html = '';
    for (const [j, items] of Object.entries(grouped)) {
      html += `<div class="group-header">${j} (${items.length})</div>`;
      items.forEach(s => { html += itemHTML(s); });
    }
    el.innerHTML = html;
  } else {
    const list = res.data || [];
    if (!list.length) {
      el.innerHTML = '<div class="empty">Tidak ditemukan</div>';
      return;
    }
    el.innerHTML = list.map(itemHTML).join('');
  }
}

function itemHTML(s) {
  return `
    <div class="list-item">
      <div class="info">
        <div class="name">${escapeHtml(s.Nama)}</div>
        <div class="meta">${s.NISN} · ${s.Jenjang} ${s.Kelas} · ${escapeHtml(s.TTL || '')}</div>
        <div class="meta" style="font-size:0.75rem">${escapeHtml(s.Alamat || '')} · HP Wali: ${s.NoHPWali || '-'}</div>
      </div>
    </div>`;
}

async function cetakDaftar() {
  const jenjang = document.getElementById('filter-jenjang').value;
  const res = await api('getSiswa', { jenjang });
  const grouped = res.data || {};
  let rows = '';
  let no = 1;
  for (const [j, items] of Object.entries(grouped)) {
    items.forEach(s => {
      rows += `<tr>
        <td>${no++}</td><td>${s.NISN}</td><td>${escapeHtml(s.Nama)}</td>
        <td>${s.Jenjang}</td><td>${s.Kelas}</td><td>${escapeHtml(s.TTL || '')}</td>
        <td>${escapeHtml(s.Alamat || '')}</td><td>${s.NoHPWali || ''}</td>
      </tr>`;
    });
  }
  const w = window.open('', '_blank');
  w.document.write(`
    <!DOCTYPE html><html><head><title>Daftar Siswa</title>
    <style>body{font-family:sans-serif;padding:20px}table{width:100%;border-collapse:collapse;font-size:12px}
    th,td{border:1px solid #ccc;padding:4px 6px;text-align:left}th{background:#eee}
    h2{text-align:center}</style></head><body>
    <h2>Daftar Siswa - Sekolah Rakyat Kota Pasuruan</h2>
    <p style="text-align:center">Cerdas Bersama, Tumbuh Setara${jenjang ? ' · Jenjang: ' + jenjang : ''}</p>
    <table><thead><tr>
      <th>No</th><th>NISN</th><th>Nama</th><th>Jenjang</th><th>Kelas</th><th>TTL</th><th>Alamat</th><th>HP Wali</th>
    </tr></thead><tbody>${rows}</tbody></table>
    <script>window.onload=()=>window.print()</script></body></html>`);
  w.document.close();
}
