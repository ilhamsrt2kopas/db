/**
 * perizinan.js - Multi siswa, shared detail, cetak A4
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
      <div id="hasil-cari" style="max-height:200px;overflow-y:auto"></div>
      <button class="btn btn-outline btn-sm" id="btn-scan-siswa" style="margin-top:8px;color:var(--primary);border-color:var(--primary)">📷 Scan QR Siswa</button>
    </div>

    <div class="card">
      <div class="card-header">
        <div class="card-title">Siswa Dipilih</div>
        <span class="card-badge" id="cnt">0</span>
      </div>
      <div id="list-selected"><div class="empty">Belum ada</div></div>
      <label class="check-item" style="margin-top:8px">
        <input type="checkbox" id="shared-detail" checked />
        <span>Gunakan detail perizinan yang sama untuk semua</span>
      </label>
    </div>

    <div class="card" id="form-detail">
      <div class="form-group"><label>Tanggal Mulai</label><input type="date" id="tgl-mulai" /></div>
      <div class="form-group"><label>Jam Mulai</label><input type="time" id="jam-mulai" /></div>
      <div class="form-group"><label>Tanggal Kembali</label><input type="date" id="tgl-kembali" /></div>
      <div class="form-group"><label>Jam Kembali</label><input type="time" id="jam-kembali" /></div>
      <div class="form-group"><label>Keperluan</label><textarea id="keperluan" rows="2"></textarea></div>
      <button class="btn btn-accent btn-block" id="btn-ajukan">Ajukan ke Kepala UKSR</button>
    </div>

    <div class="card">
      <div class="card-header"><div class="card-title">Riwayat Perizinan</div></div>
      <div id="riwayat"><div class="empty">Memuat...</div></div>
    </div>
  `;

  document.getElementById('cari-siswa').addEventListener('input', debounceSearch);
  document.getElementById('btn-ajukan').addEventListener('click', ajukan);
  document.getElementById('btn-scan-siswa').addEventListener('click', scanSiswa);
  loadRiwayat();
}

const debounceSearch = (() => {
  let t;
  return () => {
    clearTimeout(t);
    t = setTimeout(doSearch, 300);
  };
})();

async function doSearch() {
  const q = document.getElementById('cari-siswa').value.trim();
  if (!q) { document.getElementById('hasil-cari').innerHTML = ''; return; }
  const res = await api('searchSiswa', { q });
  const list = res.data || [];
  document.getElementById('hasil-cari').innerHTML = list.slice(0, 15).map(s => `
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

async function ajukan() {
  if (!selected.size) { toast('Pilih siswa dulu', 'error'); return; }
  const shared = document.getElementById('shared-detail').checked;
  const detail = {
    tglMulai: document.getElementById('tgl-mulai').value,
    jamMulai: document.getElementById('jam-mulai').value,
    tglKembali: document.getElementById('tgl-kembali').value,
    jamKembali: document.getElementById('jam-kembali').value,
    keperluan: document.getElementById('keperluan').value.trim()
  };
  if (!detail.tglMulai || !detail.keperluan) { toast('Tanggal & keperluan wajib', 'error'); return; }

  const siswa = [...selected.values()];
  const res = await api('createPerizinan', {
    siswa,
    sharedDetail: shared ? detail : null,
    diajukanOleh: userRef.id
  });
  if (res.success) {
    toast(res.message, 'success');
    selected.clear();
    renderSelected();
    loadRiwayat();
  } else toast(res.message, 'error');
}

async function loadRiwayat() {
  const res = await api('getPerizinan', { userId: userRef.id });
  const list = res.data || [];
  const el = document.getElementById('riwayat');
  if (!list.length) { el.innerHTML = '<div class="empty">Belum ada</div>'; return; }
  el.innerHTML = list.map(p => `
    <div class="list-item">
      <div class="info">
        <div class="name">${escapeHtml(p.NamaSiswa)}</div>
        <div class="meta">${formatDate(p.TglMulai)} · ${escapeHtml(p.Keperluan || '')}</div>
      </div>
      <div style="display:flex;gap:4px;align-items:center">
        <span class="badge badge-${p.Status === 'Disetujui' ? 'success' : p.Status === 'Ditolak' ? 'danger' : 'warning'}">${p.Status}</span>
        ${p.Status === 'Disetujui' ? `<button class="btn btn-sm btn-accent" data-print="${p.ID}">Cetak</button>` : ''}
      </div>
    </div>`).join('');

  el.querySelectorAll('[data-print]').forEach(btn => {
    btn.addEventListener('click', () => cetak(btn.dataset.print));
  });
}

async function cetak(id) {
  const res = await api('printPerizinan', { id });
  if (!res.success) { toast(res.message, 'error'); return; }
  const d = res.data;
  const w = window.open('', '_blank');
  w.document.write(`
    <!DOCTYPE html><html><head><title>Surat Izin ${d.NomorSurat}</title>
    <style>
      body{font-family:serif;max-width:800px;margin:40px auto;padding:20px}
      .kop{text-align:center;border-bottom:3px double #000;padding-bottom:12px;margin-bottom:24px}
      .kop h1{font-size:18px;margin:0}.kop p{margin:2px 0;font-size:13px}
      table{width:100%;border-collapse:collapse;margin:16px 0}
      td{padding:6px 8px;vertical-align:top}
      .ttd{margin-top:48px;display:flex;justify-content:flex-end}
      .ttd-box{text-align:center;width:200px}
      img.qr{width:100px;height:100px}
      @media print{body{margin:0}}
    </style></head><body>
    <div class="kop">
      <h1>SEKOLAH RAKYAT KOTA PASURUAN</h1>
      <p>Cerdas Bersama, Tumbuh Setara</p>
      <p>Kota Pasuruan, Jawa Timur</p>
    </div>
    <p style="text-align:center;font-weight:bold;font-size:16px">SURAT IZIN SISWA</p>
    <p style="text-align:center">Nomor: ${d.NomorSurat || '-'}</p>
    <table>
      <tr><td width="140">Nama Siswa</td><td>: ${escapeHtml(d.NamaSiswa)}</td></tr>
      <tr><td>NISN</td><td>: ${d.NISN}</td></tr>
      <tr><td>Mulai</td><td>: ${d.TglMulai} ${d.JamMulai || ''}</td></tr>
      <tr><td>Kembali</td><td>: ${d.TglKembali} ${d.JamKembali || ''}</td></tr>
      <tr><td>Keperluan</td><td>: ${escapeHtml(d.Keperluan)}</td></tr>
    </table>
    <p>Demikian surat izin ini dibuat untuk dipergunakan sebagaimana mestinya.</p>
    <div class="ttd">
      <div class="ttd-box">
        <p>${d.petugasJabatan || 'Kepala UKSR'}</p>
        <img class="qr" src="${qrDataUrl(d.qrSignature || d.DisetujuiOleh)}" alt="QR TTD" />
        <p><strong>${escapeHtml(d.petugasNama || '')}</strong></p>
      </div>
    </div>
    <script>window.onload=()=>window.print()</script>
    </body></html>`);
  w.document.close();
}

async function scanSiswa() {
  toast('Fitur scan QR siswa: gunakan tombol Scan di halaman login atau integrasikan ulang', 'info');
}
