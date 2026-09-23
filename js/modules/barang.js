/**
 * barang.js - Data Barang, Peminjaman, Pengambilan, Distribusi
 */
import { api } from '../api.js';
import { toast, escapeHtml, formatDate, qrDataUrl } from '../utils.js';

let userRef = null;
let mode = 'barang'; // barang | peminjaman | pengambilan | distribusi
let selectedBarang = new Map();
let selectedSiswa = new Map();

export async function render(container, user, moduleId) {
  userRef = user;
  mode = moduleId || 'barang';
  selectedBarang.clear();
  selectedSiswa.clear();

  if (mode === 'barang') return renderDataBarang(container);
  if (mode === 'peminjaman') return renderPeminjaman(container);
  if (mode === 'pengambilan') return renderPengambilan(container);
  if (mode === 'distribusi') return renderDistribusi(container);
}

async function renderDataBarang(container) {
  container.innerHTML = `
    <div class="search-box">
      <span class="icon">🔍</span>
      <input type="search" id="cari-barang" placeholder="Cari barang..." />
    </div>
    <div id="list-barang"><div class="empty">Memuat...</div></div>
  `;
  document.getElementById('cari-barang').addEventListener('input', () => {
    clearTimeout(window._brT);
    window._brT = setTimeout(() => loadBarang(document.getElementById('cari-barang').value), 300);
  });
  loadBarang();
}

async function loadBarang(q = '') {
  const res = await api('getBarang', { q }, { cacheKey: q ? null : 'barang_all', cacheTTL: 60000 });
  const grouped = res.data || {};
  const el = document.getElementById('list-barang');
  if (!Object.keys(grouped).length) {
    el.innerHTML = '<div class="empty">Tidak ada data</div>';
    return;
  }
  let html = '';
  for (const [kat, items] of Object.entries(grouped)) {
    html += `<div class="group-header">${kat}</div>`;
    items.forEach(b => {
      html += `
        <div class="list-item">
          <div class="info">
            <div class="name">${escapeHtml(b.Nama)}</div>
            <div class="meta">${b.Jenis} · Stok: ${b.Jumlah}</div>
          </div>
          <span class="badge badge-${b.HanyaPinjam === 'TRUE' || b.HanyaPinjam === true ? 'success' : 'info'}">
            ${b.HanyaPinjam === 'TRUE' || b.HanyaPinjam === true ? 'Hanya Pinjam' : 'Ambil/Distribusi'}
          </span>
        </div>`;
    });
  }
  el.innerHTML = html;
}

async function renderPeminjaman(container) {
  container.innerHTML = `
    <div class="card">
      <div class="card-header"><div class="card-title">Pilih Barang (Hanya Pinjam)</div></div>
      <div id="list-brg-pinjam"><div class="empty">Memuat...</div></div>
    </div>
    <div class="card">
      <div class="card-header"><div class="card-title">Barang Dipilih</div><span class="card-badge" id="cnt-brg">0</span></div>
      <div id="selected-brg"><div class="empty">Belum ada</div></div>
      <div class="form-group" style="margin-top:12px"><label>Tanggal Rencana Kembali</label><input type="date" id="tgl-kembali" /></div>
      <div class="form-group"><label>Tujuan Penggunaan</label><textarea id="tujuan" rows="2"></textarea></div>
      <button class="btn btn-accent btn-block" id="btn-ajukan-pinjam">Ajukan ke Sarpras</button>
    </div>
    <div class="card">
      <div class="card-header"><div class="card-title">Riwayat Peminjaman</div></div>
      <div id="riwayat-pinjam"><div class="empty">Memuat...</div></div>
    </div>
  `;

  const res = await api('getBarang', { hanyaPinjam: 'TRUE' });
  const flat = res.flat || [];
  const el = document.getElementById('list-brg-pinjam');
  const grouped = {};
  flat.forEach(b => {
    const k = b.Kategori || 'Lainnya';
    if (!grouped[k]) grouped[k] = [];
    grouped[k].push(b);
  });
  let html = '';
  for (const [kat, items] of Object.entries(grouped)) {
    html += `<div class="group-header">${kat}</div>`;
    items.forEach(b => {
      html += `
        <label class="check-item">
          <input type="checkbox" data-id="${b.ID}" data-nama="${b.Nama}" data-max="${b.Jumlah}" />
          <div class="info"><div class="name">${b.Nama}</div><div class="meta">Stok: ${b.Jumlah}</div></div>
          <input type="number" min="1" max="${b.Jumlah}" value="1" data-qty="${b.ID}" style="width:60px;padding:4px;border:1px solid #ddd;border-radius:6px" />
        </label>`;
    });
  }
  el.innerHTML = html || '<div class="empty">Tidak ada barang bertanda Hanya Pinjam</div>';

  el.querySelectorAll('input[type="checkbox"]').forEach(cb => {
    cb.addEventListener('change', updateSelectedBrg);
  });
  el.querySelectorAll('input[type="number"]').forEach(inp => {
    inp.addEventListener('change', updateSelectedBrg);
  });

  document.getElementById('btn-ajukan-pinjam').addEventListener('click', ajukanPinjam);
  loadRiwayatPinjam();
}

function updateSelectedBrg() {
  selectedBarang.clear();
  document.querySelectorAll('#list-brg-pinjam input[type="checkbox"]:checked').forEach(cb => {
    const qty = document.querySelector(`input[data-qty="${cb.dataset.id}"]`);
    selectedBarang.set(cb.dataset.id, {
      id: cb.dataset.id,
      nama: cb.dataset.nama,
      jumlah: Number(qty?.value || 1)
    });
  });
  document.getElementById('cnt-brg').textContent = selectedBarang.size;
  const el = document.getElementById('selected-brg');
  el.innerHTML = selectedBarang.size
    ? [...selectedBarang.values()].map(b => `<div class="list-item"><div class="info"><div class="name">${b.nama}</div><div class="meta">Qty: ${b.jumlah}</div></div></div>`).join('')
    : '<div class="empty">Belum ada</div>';
}

async function ajukanPinjam() {
  if (!selectedBarang.size) { toast('Pilih barang', 'error'); return; }
  const tgl = document.getElementById('tgl-kembali').value;
  if (!tgl) { toast('Tanggal kembali wajib', 'error'); return; }
  const res = await api('createPeminjaman', {
    peminjamID: userRef.id,
    peminjamNama: userRef.nama,
    peminjamRole: userRef.role || 'admin',
    barangList: [...selectedBarang.values()],
    tglKembaliRencana: tgl,
    tujuan: document.getElementById('tujuan').value.trim(),
    diajukanOleh: userRef.id
  });
  if (res.success) {
    toast(res.message, 'success');
    selectedBarang.clear();
    updateSelectedBrg();
    loadRiwayatPinjam();
  } else toast(res.message, 'error');
}

async function loadRiwayatPinjam() {
  const res = await api('getPeminjamanHariIni');
  const list = res.data || [];
  const el = document.getElementById('riwayat-pinjam');
  if (!list.length) { el.innerHTML = '<div class="empty">Belum ada</div>'; return; }
  el.innerHTML = list.map(p => `
    <div class="list-item">
      <div class="info">
        <div class="name">${escapeHtml(p.PeminjamNama)}</div>
        <div class="meta">Kembali: ${formatDate(p.TglKembaliRencana)}</div>
      </div>
      <div style="display:flex;gap:4px;flex-wrap:wrap">
        <span class="badge badge-${p.Status === 'Selesai' ? 'success' : 'warning'}">${p.Status}</span>
        ${(p.Status === 'Dipinjam' || p.Status === 'Sebagian Kembali') ? `<button class="btn btn-sm btn-success" data-kembali="${p.ID}">Kembalikan</button>` : ''}
        ${p.Status === 'Selesai' || userRef.berwenang === 'Sarpras' ? `<button class="btn btn-sm btn-accent" data-print="${p.ID}">Cetak</button>` : ''}
      </div>
    </div>`).join('');

  el.querySelectorAll('[data-kembali]').forEach(b => b.addEventListener('click', () => kembalikanUI(b.dataset.kembali)));
  el.querySelectorAll('[data-print]').forEach(b => b.addEventListener('click', () => cetakPeminjaman(b.dataset.print)));
}

async function kembalikanUI(id) {
  const ket = prompt('Keterangan keterlambatan (wajib jika terlambat, kosongkan jika tepat waktu):') || '';
  // Sederhana: kembalikan semua
  const res = await api('kembalikanBarang', {
    id,
    kembaliList: [], // backend akan handle jika kosong = semua (perlu penyesuaian) — untuk demo kirim partial
    keteranganTerlambat: ket,
    petugasNIP: userRef.id
  });
  // Note: untuk produksi, tampilkan form pilih qty per barang
  toast(res.message || 'Proses pengembalian', res.success ? 'success' : 'error');
  if (res.success) loadRiwayatPinjam();
}

async function cetakPeminjaman(id) {
  const res = await api('printPeminjaman', { id, role: userRef.berwenang });
  if (!res.success) { toast(res.message, 'error'); return; }
  const d = res.data;
  const w = window.open('', '_blank');
  w.document.write(`
    <!DOCTYPE html><html><head><title>Bukti Peminjaman ${d.NomorSurat}</title>
    <style>body{font-family:serif;max-width:800px;margin:40px auto;padding:20px}
    .kop{text-align:center;border-bottom:3px double #000;padding-bottom:12px;margin-bottom:20px}
    .kop h1{font-size:18px;margin:0}.ttd{display:flex;justify-content:space-around;margin-top:40px}
    .ttd-box{text-align:center;width:180px}img.qr{width:90px;height:90px}</style></head><body>
    <div class="kop"><h1>SEKOLAH RAKYAT KOTA PASURUAN</h1><p>Cerdas Bersama, Tumbuh Setara</p></div>
    <p style="text-align:center;font-weight:bold">BUKTI PEMINJAMAN BARANG</p>
    <p style="text-align:center">Nomor: ${d.NomorSurat || '-'}</p>
    <p>Peminjam: ${escapeHtml(d.PeminjamNama)} (${d.PeminjamID})</p>
    <p>Rencana Kembali: ${d.TglKembaliRencana}</p>
    <p>Tujuan: ${escapeHtml(d.Tujuan || '-')}</p>
    <p>Status: ${d.Status}</p>
    <ul>${(d.barangList || []).map(b => `<li>${b.nama} × ${b.jumlah}</li>`).join('')}</ul>
    <div class="ttd">
      <div class="ttd-box"><p>Peminjam</p><img class="qr" src="${qrDataUrl(d.qrPeminjam || d.PeminjamID)}" /><p>${escapeHtml(d.PeminjamNama)}</p></div>
      <div class="ttd-box"><p>Sarpras</p><img class="qr" src="${qrDataUrl(d.qrSarpras || '')}" /><p>Petugas Sarpras</p></div>
    </div>
    <script>window.onload=()=>window.print()</script></body></html>`);
  w.document.close();
}

async function renderPengambilan(container) {
  container.innerHTML = `
    <div class="card">
      <div class="card-header"><div class="card-title">Pilih Barang untuk Diambil</div></div>
      <div id="list-ambil"><div class="empty">Memuat...</div></div>
      <button class="btn btn-accent btn-block" id="btn-ambil" style="margin-top:12px">Ambil Barang</button>
    </div>
  `;
  // Hanya tampilkan barang yang BUKAN Hanya Pinjam (boleh diambil)
  const res = await api('getBarang', { hanyaPinjam: 'FALSE' });
  const flat = res.flat || [];
  const grouped = {};
  flat.forEach(b => { const k = b.Kategori || 'Lainnya'; if (!grouped[k]) grouped[k] = []; grouped[k].push(b); });
  let html = '';
  for (const [kat, items] of Object.entries(grouped)) {
    html += `<div class="group-header">${kat}</div>`;
    items.forEach(b => {
      html += `<label class="check-item">
        <input type="checkbox" data-id="${b.ID}" data-nama="${b.Nama}" />
        <div class="info"><div class="name">${b.Nama}</div><div class="meta">Stok: ${b.Jumlah}</div></div>
        <input type="number" min="1" max="${b.Jumlah}" value="1" data-qty="${b.ID}" style="width:60px;padding:4px;border:1px solid #ddd;border-radius:6px" />
      </label>`;
    });
  }
  document.getElementById('list-ambil').innerHTML = html || '<div class="empty">Tidak ada barang untuk diambil</div>';

  document.getElementById('btn-ambil').addEventListener('click', async () => {
    const list = [];
    document.querySelectorAll('#list-ambil input[type="checkbox"]:checked').forEach(cb => {
      const qty = document.querySelector(`input[data-qty="${cb.dataset.id}"]`);
      list.push({ id: cb.dataset.id, nama: cb.dataset.nama, jumlah: Number(qty?.value || 1) });
    });
    if (!list.length) { toast('Pilih barang', 'error'); return; }
    const res = await api('createPengambilan', {
      petugasNIP: userRef.id,
      petugasNama: userRef.nama,
      barangList: list
    });
    toast(res.message, res.success ? 'success' : 'error');
  });
}

async function renderDistribusi(container) {
  container.innerHTML = `
    <div class="card">
      <div class="search-box"><span class="icon">🔍</span><input type="search" id="cari-siswa-dist" placeholder="Cari siswa..." /></div>
      <div id="hasil-siswa-dist" style="max-height:160px;overflow-y:auto"></div>
      <div id="selected-siswa-dist" style="margin-top:8px"></div>
    </div>
    <div class="card">
      <div class="card-header"><div class="card-title">Pilih Barang + Qty per Anak</div></div>
      <div id="list-dist-brg"><div class="empty">Memuat...</div></div>
      <button class="btn btn-accent btn-block" id="btn-bagi" style="margin-top:12px">Bagikan Barang</button>
    </div>
  `;

  document.getElementById('cari-siswa-dist').addEventListener('input', () => {
    clearTimeout(window._dsT);
    window._dsT = setTimeout(async () => {
      const q = document.getElementById('cari-siswa-dist').value.trim();
      if (!q) return;
      const res = await api('searchSiswa', { q });
      document.getElementById('hasil-siswa-dist').innerHTML = (res.data || []).slice(0, 10).map(s => `
        <div class="list-item" style="cursor:pointer" data-nisn="${s.NISN}" data-nama="${s.Nama}">
          <div class="info"><div class="name">${s.Nama}</div><div class="meta">${s.Kelas}</div></div>
          <button class="btn btn-sm btn-accent">+</button>
        </div>`).join('');
      document.querySelectorAll('#hasil-siswa-dist .list-item').forEach(el => {
        el.addEventListener('click', () => {
          selectedSiswa.set(el.dataset.nisn, { nisn: el.dataset.nisn, nama: el.dataset.nama });
          document.getElementById('selected-siswa-dist').innerHTML = [...selectedSiswa.values()].map(s =>
            `<span class="badge badge-info" style="margin:2px">${s.nama} <button data-rm="${s.nisn}" style="border:none;background:none;cursor:pointer">×</button></span>`
          ).join('');
          document.querySelectorAll('[data-rm]').forEach(b => b.addEventListener('click', e => {
            e.stopPropagation(); selectedSiswa.delete(b.dataset.rm);
            b.parentElement.remove();
          }));
        });
      });
    }, 300);
  });

  // Hanya tampilkan barang yang BUKAN Hanya Pinjam (boleh didistribusi)
  const res = await api('getBarang', { hanyaPinjam: 'FALSE' });
  const flat = res.flat || [];
  let html = '';
  const grouped = {};
  flat.forEach(b => { const k = b.Kategori || 'Lainnya'; if (!grouped[k]) grouped[k] = []; grouped[k].push(b); });
  for (const [kat, items] of Object.entries(grouped)) {
    html += `<div class="group-header">${kat}</div>`;
    items.forEach(b => {
      html += `<label class="check-item">
        <input type="checkbox" data-id="${b.ID}" data-nama="${b.Nama}" />
        <div class="info"><div class="name">${b.Nama}</div><div class="meta">Stok: ${b.Jumlah}</div></div>
        <input type="number" min="1" value="1" data-qty="${b.ID}" style="width:60px;padding:4px;border:1px solid #ddd;border-radius:6px" title="Qty per anak" />
      </label>`;
    });
  }
  document.getElementById('list-dist-brg').innerHTML = html;

  document.getElementById('btn-bagi').addEventListener('click', async () => {
    if (!selectedSiswa.size) { toast('Pilih siswa', 'error'); return; }
    const barangList = [];
    document.querySelectorAll('#list-dist-brg input[type="checkbox"]:checked').forEach(cb => {
      const qty = document.querySelector(`input[data-qty="${cb.dataset.id}"]`);
      barangList.push({ id: cb.dataset.id, nama: cb.dataset.nama, jumlahPerAnak: Number(qty?.value || 1) });
    });
    if (!barangList.length) { toast('Pilih barang', 'error'); return; }
    const res = await api('createDistribusi', {
      petugasNIP: userRef.id,
      siswaList: [...selectedSiswa.values()],
      barangList
    });
    toast(res.message, res.success ? 'success' : 'error');
  });
}
