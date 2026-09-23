/**
 * rekap.js - Rekap aktivitas user
 */
import { api } from '../api.js';
import { escapeHtml, formatDate } from '../utils.js';

export async function render(container, user) {
  container.innerHTML = `<div class="empty">Memuat rekap...</div>`;

  const res = await api('getRekapSaya', { userId: user.id, role: user.role });
  if (!res.success) {
    container.innerHTML = '<div class="empty">Gagal memuat rekap</div>';
    return;
  }

  const d = res.data || {};
  container.innerHTML = `
    <div class="card">
      <div class="card-header"><div class="card-title">Peminjaman Barang</div></div>
      ${renderList(d.peminjaman, p => `
        <div class="list-item">
          <div class="info">
            <div class="name">${p.ID}</div>
            <div class="meta">${formatDate(p.Timestamp)} · ${p.Status}</div>
          </div>
        </div>`)}
    </div>
    <div class="card">
      <div class="card-header"><div class="card-title">Perizinan</div></div>
      ${renderList(d.perizinan, p => `
        <div class="list-item">
          <div class="info">
            <div class="name">${escapeHtml(p.NamaSiswa || p.ID)}</div>
            <div class="meta">${formatDate(p.Timestamp)} · ${p.Status}</div>
          </div>
        </div>`)}
    </div>
    <div class="card">
      <div class="card-header"><div class="card-title">Konseling</div></div>
      ${renderList(d.konseling, p => `
        <div class="list-item">
          <div class="info">
            <div class="name">${escapeHtml(p.NamaSiswa || p.ID)}</div>
            <div class="meta">${formatDate(p.Timestamp)} · ${p.Status}</div>
          </div>
        </div>`)}
    </div>
    <div class="card">
      <div class="card-header"><div class="card-title">Pengambilan Barang</div></div>
      ${renderList(d.pengambilan, p => `
        <div class="list-item">
          <div class="info">
            <div class="name">${p.ID}</div>
            <div class="meta">${formatDate(p.Timestamp)}</div>
          </div>
        </div>`)}
    </div>
  `;
}

function renderList(arr, fn) {
  if (!arr || !arr.length) return '<div class="empty">Belum ada data</div>';
  return arr.map(fn).join('');
}
