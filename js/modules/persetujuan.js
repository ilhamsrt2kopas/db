/**
 * persetujuan.js - Hanya untuk pegawai berwenang
 */
import { api } from '../api.js';
import { toast, escapeHtml, formatDate } from '../utils.js';

export async function render(container, user) {
  const canApprove = !!(user.berwenang) ||
    user.berwenang === 'Semua' ||
    /kepala\s*sekolah/i.test(String(user.jabatan || ''));

  if (!canApprove) {
    container.innerHTML = '<div class="empty">Anda tidak memiliki wewenang persetujuan</div>';
    return;
  }

  const label = user.berwenang === 'Semua' || /kepala\s*sekolah/i.test(String(user.jabatan || ''))
    ? 'Semua Wewenang'
    : user.berwenang;

  container.innerHTML = `
    <div class="card">
      <div class="card-header">
        <div class="card-title">Menunggu Persetujuan (${label})</div>
      </div>
      <div id="list-pending"><div class="empty">Memuat...</div></div>
    </div>
  `;

  const res = await api('getPendingApproval', {
    berwenang: user.berwenang || 'Semua',
    jabatan: user.jabatan || ''
  });
  const list = res.data || [];
  const el = document.getElementById('list-pending');

  if (!list.length) {
    el.innerHTML = '<div class="empty">Tidak ada yang menunggu persetujuan 🎉</div>';
    return;
  }

  el.innerHTML = list.map(item => {
    // Bentuk berbeda tergantung jenis
    if (item.Judul) {
      // Pengumuman
      return `
        <div class="list-item">
          <div class="info">
            <div class="name">${escapeHtml(item.Judul)}</div>
            <div class="meta">${formatDate(item.TanggalBuat)}</div>
          </div>
          <div style="display:flex;gap:4px">
            <button class="btn btn-sm btn-success" data-approve="${item.ID}" data-type="pengumuman">Setujui</button>
            <button class="btn btn-sm btn-danger" data-reject="${item.ID}" data-type="pengumuman">Tolak</button>
          </div>
        </div>`;
    }
    if (item.NamaSiswa && item.Keperluan !== undefined) {
      // Perizinan
      return `
        <div class="list-item">
          <div class="info">
            <div class="name">${escapeHtml(item.NamaSiswa)}</div>
            <div class="meta">${escapeHtml(item.Keperluan || '')} · ${formatDate(item.TglMulai)}</div>
          </div>
          <div style="display:flex;gap:4px">
            <button class="btn btn-sm btn-success" data-approve="${item.ID}" data-type="perizinan">Izinkan</button>
            <button class="btn btn-sm btn-danger" data-reject="${item.ID}" data-type="perizinan">Tolak</button>
          </div>
        </div>`;
    }
    // Peminjaman
    return `
      <div class="list-item">
        <div class="info">
          <div class="name">${escapeHtml(item.PeminjamNama || item.DiajukanOleh)}</div>
          <div class="meta">Kembali: ${formatDate(item.TglKembaliRencana)}</div>
        </div>
        <div style="display:flex;gap:4px">
          <button class="btn btn-sm btn-success" data-approve="${item.ID}" data-type="peminjaman">Setujui</button>
          <button class="btn btn-sm btn-danger" data-reject="${item.ID}" data-type="peminjaman">Tolak</button>
        </div>
      </div>`;
  }).join('');

  el.querySelectorAll('[data-approve]').forEach(btn => {
    btn.addEventListener('click', () => proses(btn.dataset.approve, btn.dataset.type, true, user));
  });
  el.querySelectorAll('[data-reject]').forEach(btn => {
    btn.addEventListener('click', () => proses(btn.dataset.reject, btn.dataset.type, false, user));
  });
}

async function proses(id, type, setuju, user) {
  let action;
  if (type === 'pengumuman') action = 'approvePengumuman';
  else if (type === 'perizinan') action = 'approvePerizinan';
  else action = 'approvePeminjaman';

  const res = await api(action, {
    id,
    setuju,
    disetujuiOleh: user.id
  });
  toast(res.message, res.success ? 'success' : 'error');
  if (res.success) {
    // Reload
    const { render } = await import('./persetujuan.js');
    render(document.getElementById('main-content'), user);
  }
}
