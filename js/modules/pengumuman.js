/**
 * pengumuman.js - Buat (admin) & Lihat (ortu)
 */
import { api } from '../api.js';
import { toast, formatDate, escapeHtml } from '../utils.js';

export async function render(container, user, moduleId) {
  if (moduleId === 'pengumuman-ortu' || user.type === 'ortu') {
    return renderListOrtu(container);
  }
  return renderFormAdmin(container, user);
}

async function renderFormAdmin(container, user) {
  container.innerHTML = `
    <div class="card">
      <form id="form-pengumuman">
        <div class="form-group">
          <label>Judul Pengumuman</label>
          <input type="text" id="pg-judul" required placeholder="Judul..." />
        </div>
        <div class="form-group">
          <label>Isi Pengumuman</label>
          <textarea id="pg-isi" rows="5" required placeholder="Isi lengkap..."></textarea>
        </div>
        <div class="form-group">
          <label>Scan Pengumuman (opsional)</label>
          <input type="url" id="pg-scan" placeholder="URL file scan (Google Drive / dll)" />
        </div>
        <button type="submit" class="btn btn-accent btn-block">Ajukan ke Humas</button>
      </form>
    </div>
    <div class="card">
      <div class="card-header"><div class="card-title">Pengumuman Saya</div></div>
      <div id="list-pg"><div class="empty">Memuat...</div></div>
    </div>
  `;

  document.getElementById('form-pengumuman').addEventListener('submit', async (e) => {
    e.preventDefault();
    const res = await api('createPengumuman', {
      judul: document.getElementById('pg-judul').value.trim(),
      isi: document.getElementById('pg-isi').value.trim(),
      fileScanURL: document.getElementById('pg-scan').value.trim(),
      dibuatOleh: user.id
    });
    if (res.success) {
      toast(res.message, 'success');
      e.target.reset();
      loadList();
    } else toast(res.message, 'error');
  });

  loadList();
}

async function loadList() {
  const res = await api('getPengumuman', {});
  const el = document.getElementById('list-pg');
  const list = res.data || [];
  if (!list.length) {
    el.innerHTML = '<div class="empty">Belum ada pengumuman</div>';
    return;
  }
  el.innerHTML = list.map(p => `
    <div class="list-item">
      <div class="info">
        <div class="name">${escapeHtml(p.Judul)}</div>
        <div class="meta">${formatDate(p.TanggalBuat)}</div>
      </div>
      <span class="badge badge-${p.Status === 'Disetujui' ? 'success' : p.Status === 'Ditolak' ? 'danger' : 'warning'}">${p.Status}</span>
    </div>`).join('');
}

async function renderListOrtu(container) {
  container.innerHTML = `<div id="list-pg-ortu"><div class="empty">Memuat...</div></div>`;
  const res = await api('getPengumuman', { publishedOnly: true });
  const list = res.data || [];
  const el = document.getElementById('list-pg-ortu');
  if (!list.length) {
    el.innerHTML = '<div class="empty">Belum ada pengumuman</div>';
    return;
  }
  el.innerHTML = list.map(p => `
    <div class="card">
      <div class="card-title">${escapeHtml(p.Judul)}</div>
      <p style="margin:8px 0;white-space:pre-wrap;font-size:0.95rem">${escapeHtml(p.Isi)}</p>
      <div class="meta" style="font-size:0.8rem;color:var(--gray-500)">${formatDate(p.TanggalPublish || p.TanggalBuat)}</div>
      ${p.FileScanURL ? `<a href="${p.FileScanURL}" target="_blank" class="btn btn-sm btn-outline" style="margin-top:8px;color:var(--primary);border-color:var(--primary)">Lihat Scan</a>` : ''}
    </div>`).join('');
}
