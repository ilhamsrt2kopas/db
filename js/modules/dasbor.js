/**
 * dasbor.js
 * Atas: antrian persetujuan sesuai wewenang
 * Bawah: rekap absensi, peminjaman, perizinan hari ini
 */
import { api } from '../api.js';
import { formatDate, escapeHtml, toast } from '../utils.js';

function hasWewenang(user, jenis) {
  const bw = String(user.berwenang || '');
  if (bw === 'Semua') return true;
  if (/kepala\s*sekolah/i.test(String(user.jabatan || ''))) return true;
  return bw === jenis;
}

export async function render(container, user) {
  const showHumas = hasWewenang(user, 'Humas');
  const showUKSR = hasWewenang(user, 'UKSR');
  const showSarpras = hasWewenang(user, 'Sarpras');
  const showAnyApproval = showHumas || showUKSR || showSarpras;

  container.innerHTML = `
    ${showAnyApproval ? `
    <div id="section-approval">
      ${showHumas ? `
      <div class="card">
        <div class="card-header">
          <div class="card-title">📢 Persetujuan Penerbitan Pengumuman</div>
          <span class="card-badge" id="cnt-humas">0</span>
        </div>
        <div id="list-approval-humas"><div class="empty">Memuat...</div></div>
      </div>` : ''}
      ${showUKSR ? `
      <div class="card">
        <div class="card-header">
          <div class="card-title">📝 Persetujuan Izin Siswa</div>
          <span class="card-badge" id="cnt-uksr">0</span>
        </div>
        <div id="list-approval-uksr"><div class="empty">Memuat...</div></div>
      </div>` : ''}
      ${showSarpras ? `
      <div class="card">
        <div class="card-header">
          <div class="card-title">📦 Persetujuan Peminjaman Barang</div>
          <span class="card-badge" id="cnt-sarpras">0</span>
        </div>
        <div id="list-approval-sarpras"><div class="empty">Memuat...</div></div>
      </div>` : ''}
    </div>
    <hr style="border:none;border-top:2px solid var(--gray-200);margin:8px 0 16px" />
    ` : ''}

    <div class="stats-grid" id="stats">
      <div class="stat-card"><div class="num">-</div><div class="label">Tidak Hadir</div></div>
      <div class="stat-card"><div class="num">-</div><div class="label">Peminjaman</div></div>
      <div class="stat-card"><div class="num">-</div><div class="label">Perizinan</div></div>
      <div class="stat-card"><div class="num">-</div><div class="label">Stok Item</div></div>
    </div>
    <div class="card">
      <div class="card-header"><div class="card-title">Siswa Tidak Hadir Hari Ini</div></div>
      <div id="list-tidak-hadir"><div class="empty">Memuat...</div></div>
    </div>
    <div class="card">
      <div class="card-header"><div class="card-title">Peminjaman Aktif / Hari Ini</div></div>
      <div id="list-peminjaman"><div class="empty">Memuat...</div></div>
    </div>
    <div class="card">
      <div class="card-header"><div class="card-title">Perizinan Hari Ini</div></div>
      <div id="list-perizinan"><div class="empty">Memuat...</div></div>
    </div>
  `;

  const res = await api('getDashboard', {
    userId: user.id,
    berwenang: user.berwenang || '',
    jabatan: user.jabatan || ''
  });

  if (!res.success) {
    container.innerHTML = `<div class="empty">Gagal memuat dasbor: ${res.message || ''}</div>`;
    return;
  }

  const d = res.data || {};
  const tidakHadir = d.siswaTidakHadir?.data || [];
  const peminjaman = d.peminjamanHariIni?.data || [];
  const perizinan = d.perizinanPending?.data || [];
  const stok = d.stokBarang || [];
  const aHumas = d.approvalHumas || [];
  const aUKSR = d.approvalUKSR || [];
  const aSarpras = d.approvalSarpras || [];

  document.getElementById('stats').innerHTML = `
    <div class="stat-card"><div class="num">${tidakHadir.length}</div><div class="label">Tidak Hadir</div></div>
    <div class="stat-card"><div class="num">${peminjaman.length}</div><div class="label">Peminjaman</div></div>
    <div class="stat-card"><div class="num">${perizinan.length}</div><div class="label">Perizinan</div></div>
    <div class="stat-card"><div class="num">${stok.length}</div><div class="label">Jenis Barang</div></div>
  `;

  // --- Approval sections ---
  if (showHumas) {
    const el = document.getElementById('list-approval-humas');
    const cnt = document.getElementById('cnt-humas');
    if (cnt) cnt.textContent = aHumas.length;
    el.innerHTML = aHumas.length
      ? aHumas.map(p => `
        <div class="list-item">
          <div class="info">
            <div class="name">${escapeHtml(p.Judul || '-')}</div>
            <div class="meta">${formatDate(p.TanggalBuat)}</div>
          </div>
          <div style="display:flex;gap:4px">
            <button class="btn btn-sm btn-success" data-approve-pg="${p.ID}">Setujui</button>
            <button class="btn btn-sm btn-danger" data-reject-pg="${p.ID}">Tolak</button>
          </div>
        </div>`).join('')
      : '<div class="empty">Tidak ada pengumuman menunggu</div>';

    el.querySelectorAll('[data-approve-pg]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const r = await api('approvePengumuman', { id: btn.dataset.approvePg, setuju: true, disetujuiOleh: user.id });
        toast(r.message, r.success ? 'success' : 'error');
        if (r.success) render(container, user);
      });
    });
    el.querySelectorAll('[data-reject-pg]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const r = await api('approvePengumuman', { id: btn.dataset.rejectPg, setuju: false, disetujuiOleh: user.id });
        toast(r.message, r.success ? 'success' : 'error');
        if (r.success) render(container, user);
      });
    });
  }

  if (showUKSR) {
    const el = document.getElementById('list-approval-uksr');
    const cnt = document.getElementById('cnt-uksr');
    if (cnt) cnt.textContent = aUKSR.length;
    el.innerHTML = aUKSR.length
      ? aUKSR.slice(0, 15).map(p => `
        <div class="list-item">
          <div class="info">
            <div class="name">${escapeHtml(p.NamaSiswa || '-')}</div>
            <div class="meta">${escapeHtml(p.Keperluan || '-')} · ${formatDate(p.TglMulai)}</div>
          </div>
          <div style="display:flex;gap:4px">
            <button class="btn btn-sm btn-success" data-approve-iz="${p.ID}">Izinkan</button>
            <button class="btn btn-sm btn-danger" data-reject-iz="${p.ID}">Tolak</button>
          </div>
        </div>`).join('')
      : '<div class="empty">Tidak ada izin menunggu</div>';

    el.querySelectorAll('[data-approve-iz]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const r = await api('approvePerizinan', { id: btn.dataset.approveIz, setuju: true, disetujuiOleh: user.id });
        toast(r.message, r.success ? 'success' : 'error');
        if (r.success) render(container, user);
      });
    });
    el.querySelectorAll('[data-reject-iz]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const r = await api('approvePerizinan', { id: btn.dataset.rejectIz, setuju: false, disetujuiOleh: user.id });
        toast(r.message, r.success ? 'success' : 'error');
        if (r.success) render(container, user);
      });
    });
  }

  if (showSarpras) {
    const el = document.getElementById('list-approval-sarpras');
    const cnt = document.getElementById('cnt-sarpras');
    if (cnt) cnt.textContent = aSarpras.length;
    el.innerHTML = aSarpras.length
      ? aSarpras.map(p => `
        <div class="list-item">
          <div class="info">
            <div class="name">${escapeHtml(p.PeminjamNama || p.DiajukanOleh || '-')}</div>
            <div class="meta">Kembali: ${formatDate(p.TglKembaliRencana)}</div>
          </div>
          <div style="display:flex;gap:4px">
            <button class="btn btn-sm btn-success" data-approve-pj="${p.ID}">Setujui</button>
            <button class="btn btn-sm btn-danger" data-reject-pj="${p.ID}">Tolak</button>
          </div>
        </div>`).join('')
      : '<div class="empty">Tidak ada peminjaman menunggu</div>';

    el.querySelectorAll('[data-approve-pj]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const r = await api('approvePeminjaman', { id: btn.dataset.approvePj, setuju: true, disetujuiOleh: user.id });
        toast(r.message, r.success ? 'success' : 'error');
        if (r.success) render(container, user);
      });
    });
    el.querySelectorAll('[data-reject-pj]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const r = await api('approvePeminjaman', { id: btn.dataset.rejectPj, setuju: false, disetujuiOleh: user.id });
        toast(r.message, r.success ? 'success' : 'error');
        if (r.success) render(container, user);
      });
    });
  }

  // --- Rekap bawah ---
  document.getElementById('list-tidak-hadir').innerHTML = tidakHadir.length
    ? tidakHadir.map(s => `
      <div class="list-item">
        <div class="info">
          <div class="name">${escapeHtml(s.NamaSiswa || s.NISN)}</div>
          <div class="meta">Sesi ${s.Sesi} · ${escapeHtml(s.Keterangan || '-')}</div>
        </div>
        <span class="badge badge-danger">Tidak Hadir</span>
      </div>`).join('')
    : '<div class="empty">Semua siswa hadir 🎉</div>';

  document.getElementById('list-peminjaman').innerHTML = peminjaman.length
    ? peminjaman.map(p => `
      <div class="list-item">
        <div class="info">
          <div class="name">${escapeHtml(p.PeminjamNama)}</div>
          <div class="meta">Kembali: ${formatDate(p.TglKembaliRencana)}</div>
        </div>
        <span class="badge badge-${p.Status === 'Dipinjam' ? 'warning' : 'info'}">${p.Status}</span>
      </div>`).join('')
    : '<div class="empty">Tidak ada peminjaman aktif</div>';

  document.getElementById('list-perizinan').innerHTML = perizinan.length
    ? perizinan.slice(0, 10).map(p => `
      <div class="list-item">
        <div class="info">
          <div class="name">${escapeHtml(p.NamaSiswa)}</div>
          <div class="meta">${escapeHtml(p.Keperluan || '-')} · ${formatDate(p.TglMulai)}</div>
        </div>
        <span class="badge badge-warning">${p.Status || 'Pending'}</span>
      </div>`).join('')
    : '<div class="empty">Tidak ada perizinan pending</div>';
}
