/**
 * dasbor.js
 */
import { api } from '../api.js';
import { formatDate } from '../utils.js';

export async function render(container, user) {
  container.innerHTML = `
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
      <div class="card-header"><div class="card-title">Peminjaman Aktif</div></div>
      <div id="list-peminjaman"><div class="empty">Memuat...</div></div>
    </div>
    <div class="card">
      <div class="card-header"><div class="card-title">Perizinan Pending</div></div>
      <div id="list-perizinan"><div class="empty">Memuat...</div></div>
    </div>
  `;

  const res = await api('getDashboard', { userId: user.id });
  if (!res.success) {
    container.innerHTML = `<div class="empty">Gagal memuat dasbor</div>`;
    return;
  }

  const d = res.data;
  const tidakHadir = d.siswaTidakHadir?.data || [];
  const peminjaman = d.peminjamanHariIni?.data || [];
  const perizinan = d.perizinanPending?.data || [];
  const stok = d.stokBarang || [];

  document.getElementById('stats').innerHTML = `
    <div class="stat-card"><div class="num">${tidakHadir.length}</div><div class="label">Tidak Hadir</div></div>
    <div class="stat-card"><div class="num">${peminjaman.length}</div><div class="label">Peminjaman</div></div>
    <div class="stat-card"><div class="num">${perizinan.length}</div><div class="label">Perizinan</div></div>
    <div class="stat-card"><div class="num">${stok.length}</div><div class="label">Jenis Barang</div></div>
  `;

  document.getElementById('list-tidak-hadir').innerHTML = tidakHadir.length
    ? tidakHadir.map(s => `
      <div class="list-item">
        <div class="info">
          <div class="name">${s.NamaSiswa || s.NISN}</div>
          <div class="meta">Sesi ${s.Sesi} · ${s.Keterangan || '-'}</div>
        </div>
        <span class="badge badge-danger">Tidak Hadir</span>
      </div>`).join('')
    : '<div class="empty">Semua siswa hadir 🎉</div>';

  document.getElementById('list-peminjaman').innerHTML = peminjaman.length
    ? peminjaman.map(p => `
      <div class="list-item">
        <div class="info">
          <div class="name">${p.PeminjamNama}</div>
          <div class="meta">Kembali: ${formatDate(p.TglKembaliRencana)}</div>
        </div>
        <span class="badge badge-${p.Status === 'Dipinjam' ? 'warning' : 'info'}">${p.Status}</span>
      </div>`).join('')
    : '<div class="empty">Tidak ada peminjaman aktif</div>';

  document.getElementById('list-perizinan').innerHTML = perizinan.length
    ? perizinan.slice(0, 10).map(p => `
      <div class="list-item">
        <div class="info">
          <div class="name">${p.NamaSiswa}</div>
          <div class="meta">${p.Keperluan || '-'} · ${formatDate(p.TglMulai)}</div>
        </div>
        <span class="badge badge-warning">Pending</span>
      </div>`).join('')
    : '<div class="empty">Tidak ada perizinan pending</div>';
}
