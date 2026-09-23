/**
 * konseling.js
 */
import { api } from '../api.js';
import { toast, escapeHtml, formatDate, qrDataUrl } from '../utils.js';

let selected = new Map();
let userRef = null;

export async function render(container, user) {
  userRef = user;
  selected.clear();

  container.innerHTML = `
    <div class="card">
      <div class="search-box">
        <span class="icon">🔍</span>
        <input type="search" id="cari-siswa" placeholder="Cari siswa..." />
      </div>
      <div id="hasil-cari" style="max-height:180px;overflow-y:auto"></div>
    </div>
    <div class="card">
      <div class="card-header"><div class="card-title">Siswa Dipilih</div><span class="card-badge" id="cnt">0</span></div>
      <div id="list-selected"><div class="empty">Belum ada</div></div>
    </div>
    <div class="card">
      <div class="form-group"><label>Rincian Masalah</label><textarea id="rincian" rows="3" required></textarea></div>
      <div class="form-group"><label>Dampak yang Dirasakan</label><textarea id="dampak" rows="2"></textarea></div>
      <div class="form-group"><label>Solusi</label><textarea id="solusi" rows="2"></textarea></div>
      <button class="btn btn-accent btn-block" id="btn-simpan">Simpan Laporan</button>
    </div>
    <div class="card">
      <div class="card-header"><div class="card-title">Riwayat Konseling</div></div>
      <div id="riwayat"><div class="empty">Memuat...</div></div>
    </div>
  `;

  document.getElementById('cari-siswa').addEventListener('input', () => {
    clearTimeout(window._ksT);
    window._ksT = setTimeout(doSearch, 300);
  });
  document.getElementById('btn-simpan').addEventListener('click', simpan);
  loadRiwayat();
}

async function doSearch() {
  const q = document.getElementById('cari-siswa').value.trim();
  if (!q) { document.getElementById('hasil-cari').innerHTML = ''; return; }
  const res = await api('searchSiswa', { q });
  document.getElementById('hasil-cari').innerHTML = (res.data || []).slice(0, 12).map(s => `
    <div class="list-item" style="cursor:pointer" data-nisn="${s.NISN}" data-nama="${s.Nama}">
      <div class="info"><div class="name">${s.Nama}</div><div class="meta">${s.NISN} · ${s.Kelas}</div></div>
      <button class="btn btn-sm btn-accent">+</button>
    </div>`).join('') || '<div class="empty">Tidak ditemukan</div>';

  document.querySelectorAll('#hasil-cari .list-item').forEach(el => {
    el.addEventListener('click', () => {
      selected.set(el.dataset.nisn, { nisn: el.dataset.nisn, nama: el.dataset.nama });
      renderSelected();
    });
  });
}

function renderSelected() {
  document.getElementById('cnt').textContent = selected.size;
  const el = document.getElementById('list-selected');
  if (!selected.size) { el.innerHTML = '<div class="empty">Belum ada</div>'; return; }
  el.innerHTML = [...selected.values()].map(s => `
    <div class="list-item">
      <div class="info"><div class="name">${s.nama}</div><div class="meta">${s.nisn}</div></div>
      <button class="btn btn-sm" data-rm="${s.nisn}" style="color:var(--danger)">✕</button>
    </div>`).join('');
  el.querySelectorAll('[data-rm]').forEach(b => b.addEventListener('click', () => {
    selected.delete(b.dataset.rm); renderSelected();
  }));
}

async function simpan() {
  if (!selected.size) { toast('Pilih siswa', 'error'); return; }
  const rincian = document.getElementById('rincian').value.trim();
  if (!rincian) { toast('Rincian masalah wajib', 'error'); return; }

  const res = await api('createKonseling', {
    siswa: [...selected.values()],
    rincianMasalah: rincian,
    dampak: document.getElementById('dampak').value.trim(),
    solusi: document.getElementById('solusi').value.trim(),
    petugasNIP: userRef.id
  });
  if (res.success) {
    toast(res.message, 'success');
    selected.clear(); renderSelected();
    document.getElementById('rincian').value = '';
    document.getElementById('dampak').value = '';
    document.getElementById('solusi').value = '';
    loadRiwayat();
  } else toast(res.message, 'error');
}

async function loadRiwayat() {
  const res = await api('getKonseling', { userId: userRef.id });
  const list = res.data || [];
  const el = document.getElementById('riwayat');
  if (!list.length) { el.innerHTML = '<div class="empty">Belum ada</div>'; return; }
  el.innerHTML = list.map(k => `
    <div class="list-item">
      <div class="info">
        <div class="name">${escapeHtml(k.NamaSiswa)}</div>
        <div class="meta">${escapeHtml((k.RincianMasalah || '').substring(0, 50))}...</div>
      </div>
      <div style="display:flex;gap:4px;align-items:center;flex-wrap:wrap">
        <span class="badge badge-${k.Status === 'Selesai' ? 'success' : 'warning'}">${k.Status}</span>
        ${k.Status !== 'Selesai' ? `<button class="btn btn-sm btn-success" data-selesai="${k.ID}">Selesai</button>` : ''}
        ${k.Status === 'Selesai' ? `<button class="btn btn-sm btn-accent" data-print="${k.ID}">Cetak</button>` : ''}
      </div>
    </div>`).join('');

  el.querySelectorAll('[data-selesai]').forEach(b => b.addEventListener('click', async () => {
    const r = await api('updateKonselingStatus', { id: b.dataset.selesai, status: 'Selesai' });
    if (r.success) { toast('Ditandai selesai', 'success'); loadRiwayat(); }
    else toast(r.message, 'error');
  }));

  el.querySelectorAll('[data-print]').forEach(b => b.addEventListener('click', () => cetak(b.dataset.print)));
}

async function cetak(id) {
  const res = await api('printKonseling', { id });
  if (!res.success) { toast(res.message, 'error'); return; }
  const d = res.data;
  const w = window.open('', '_blank');
  w.document.write(`
    <!DOCTYPE html><html><head><title>Laporan Konseling ${d.NomorSurat}</title>
    <style>
      body{font-family:serif;max-width:800px;margin:40px auto;padding:20px}
      .kop{text-align:center;border-bottom:3px double #000;padding-bottom:12px;margin-bottom:24px}
      .kop h1{font-size:18px;margin:0}.kop p{margin:2px 0;font-size:13px}
      table{width:100%;margin:12px 0} td{padding:6px;vertical-align:top}
      .ttd{margin-top:40px;display:flex;justify-content:space-around}
      .ttd-box{text-align:center;width:180px} img.qr{width:90px;height:90px}
    </style></head><body>
    <div class="kop">
      <h1>SEKOLAH RAKYAT KOTA PASURUAN</h1>
      <p>Cerdas Bersama, Tumbuh Setara</p>
    </div>
    <p style="text-align:center;font-weight:bold">LAPORAN KONSELING SISWA</p>
    <p style="text-align:center">Nomor: ${d.NomorSurat || '-'}</p>
    <table>
      <tr><td width="150">Nama Siswa</td><td>: ${escapeHtml(d.NamaSiswa)} (${d.NISN})</td></tr>
      <tr><td>Rincian Masalah</td><td>: ${escapeHtml(d.RincianMasalah)}</td></tr>
      <tr><td>Dampak</td><td>: ${escapeHtml(d.Dampak || '-')}</td></tr>
      <tr><td>Solusi</td><td>: ${escapeHtml(d.Solusi || '-')}</td></tr>
    </table>
    <div class="ttd">
      <div class="ttd-box">
        <p>Siswa</p>
        <img class="qr" src="${qrDataUrl(d.qrSiswa || d.NISN)}" />
        <p><strong>${escapeHtml(d.NamaSiswa)}</strong></p>
      </div>
      <div class="ttd-box">
        <p>${d.petugasJabatan || 'Petugas BK'}</p>
        <img class="qr" src="${qrDataUrl(d.qrPetugas || d.PetugasNIP)}" />
        <p><strong>${escapeHtml(d.petugasNama || '')}</strong></p>
      </div>
    </div>
    <script>window.onload=()=>window.print()</script>
    </body></html>`);
  w.document.close();
}
