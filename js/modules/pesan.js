/**
 * pesan.js - Admin kirim surat siswa → Ortu; Ortu hanya balas
 */
import { api } from '../api.js';
import { toast, escapeHtml, formatDate } from '../utils.js';

export async function render(container, user, moduleId) {
  if (user.type === 'ortu' || moduleId === 'pesan-ortu') {
    return renderOrtu(container, user);
  }
  return renderAdmin(container, user);
}

async function renderAdmin(container, user) {
  container.innerHTML = `
    <div class="card">
      <div class="search-box">
        <span class="icon">🔍</span>
        <input type="search" id="cari-siswa" placeholder="Cari siswa..." />
      </div>
      <div id="hasil-cari" style="max-height:160px;overflow-y:auto"></div>
      <div id="siswa-terpilih" style="margin-top:8px;font-weight:600"></div>
    </div>
    <div class="card">
      <div class="form-group"><label>Isi Pesan / Keterangan Surat</label><textarea id="isi-pesan" rows="3"></textarea></div>
      <div class="form-group"><label>URL Foto/Scan Surat (opsional)</label><input type="url" id="file-url" placeholder="https://..." /></div>
      <button class="btn btn-accent btn-block" id="btn-kirim">Kirim ke Orang Tua</button>
    </div>
  `;

  let selected = null;

  document.getElementById('cari-siswa').addEventListener('input', () => {
    clearTimeout(window._psT);
    window._psT = setTimeout(async () => {
      const q = document.getElementById('cari-siswa').value.trim();
      if (!q) return;
      const res = await api('searchSiswa', { q });
      document.getElementById('hasil-cari').innerHTML = (res.data || []).slice(0, 10).map(s => `
        <div class="list-item" style="cursor:pointer" data-nisn="${s.NISN}" data-nama="${s.Nama}" data-parent="${s.ParentID || s.NoHPWali}">
          <div class="info"><div class="name">${s.Nama}</div><div class="meta">${s.Kelas} · Wali: ${s.NoHPWali || s.ParentID || '-'}</div></div>
        </div>`).join('');
      document.querySelectorAll('#hasil-cari .list-item').forEach(el => {
        el.addEventListener('click', () => {
          selected = { nisn: el.dataset.nisn, nama: el.dataset.nama, parentID: el.dataset.parent };
          document.getElementById('siswa-terpilih').textContent = `Terpilih: ${selected.nama}`;
        });
      });
    }, 300);
  });

  document.getElementById('btn-kirim').addEventListener('click', async () => {
    if (!selected) { toast('Pilih siswa dulu', 'error'); return; }
    if (!selected.parentID) { toast('Siswa belum punya ParentID / NoHP Wali', 'error'); return; }
    const res = await api('kirimPesan', {
      nisn: selected.nisn,
      namaSiswa: selected.nama,
      parentID: selected.parentID,
      isiPesan: document.getElementById('isi-pesan').value.trim(),
      fileURL: document.getElementById('file-url').value.trim()
    });
    toast(res.message, res.success ? 'success' : 'error');
    if (res.success) {
      document.getElementById('isi-pesan').value = '';
      document.getElementById('file-url').value = '';
      selected = null;
      document.getElementById('siswa-terpilih').textContent = '';
    }
  });
}

async function renderOrtu(container, user) {
  container.innerHTML = `<div id="list-pesan"><div class="empty">Memuat pesan...</div></div>`;
  const res = await api('getPesanOrtu', { parentID: user.id });
  const list = res.data || [];
  const el = document.getElementById('list-pesan');
  if (!list.length) {
    el.innerHTML = '<div class="empty">Belum ada pesan dari anak</div>';
    return;
  }
  el.innerHTML = list.map(p => `
    <div class="card">
      <div class="card-header">
        <div class="card-title">${escapeHtml(p.NamaSiswa)}</div>
        <span class="badge badge-info">${formatDate(p.Timestamp)}</span>
      </div>
      <p style="white-space:pre-wrap;margin:8px 0">${escapeHtml(p.IsiPesan || '(Surat terlampir)')}</p>
      ${p.FileURL ? `<a href="${p.FileURL}" target="_blank" class="btn btn-sm btn-outline" style="color:var(--primary);border-color:var(--primary)">Lihat Surat</a>` : ''}
      ${p.Balasan ? `
        <div style="margin-top:12px;padding:10px;background:var(--gray-50);border-radius:8px">
          <div style="font-size:0.8rem;color:var(--gray-500)">Balasan Anda · ${formatDate(p.TglBalasan)}</div>
          <p style="margin-top:4px">${escapeHtml(p.Balasan)}</p>
        </div>` : `
        <div style="margin-top:12px">
          <textarea id="balas-${p.ID}" rows="2" placeholder="Tulis balasan..." style="width:100%;padding:8px;border:1.5px solid #d1d5db;border-radius:8px"></textarea>
          <button class="btn btn-accent btn-sm" style="margin-top:6px" data-balas="${p.ID}">Kirim Balasan</button>
        </div>`}
    </div>`).join('');

  el.querySelectorAll('[data-balas]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.balas;
      const balasan = document.getElementById('balas-' + id).value.trim();
      if (!balasan) { toast('Balasan kosong', 'error'); return; }
      const r = await api('balasPesan', { id, balasan });
      toast(r.message, r.success ? 'success' : 'error');
      if (r.success) renderOrtu(container, user);
    });
  });
}
