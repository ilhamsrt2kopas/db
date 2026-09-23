/**
 * absensi.js
 * - Tampilkan semua siswa (filter jenjang/kelas opsional)
 * - Tiap baris: tombol H / S / I / A
 * - Submit sekali setelah semua terdata
 */
import { api } from '../api.js';
import { toast, debounce, throttle, showLoading, hideLoading } from '../utils.js';

let allSiswa = [];       // full list dari server
let currentList = [];    // filtered
let statusMap = new Map(); // nisn -> 'H'|'S'|'I'|'A'
let currentSesi = 1;
let html5Qr = null;
let userRef = null;

const STATUS_LABEL = { H: 'Hadir', S: 'Sakit', I: 'Izin', A: 'Alpha' };
const STATUS_CLASS = { H: 'btn-h', S: 'btn-s', I: 'btn-i', A: 'btn-a' };

export async function render(container, user) {
  userRef = user;
  statusMap.clear();
  allSiswa = [];
  currentList = [];

  container.innerHTML = `
    <div class="card">
      <div class="form-group">
        <label>Sesi Absensi</label>
        <select id="sel-sesi">
          <option value="1">Sesi 1 (Pagi)</option>
          <option value="2">Sesi 2 (Siang)</option>
          <option value="3">Sesi 3 (Sore)</option>
        </select>
      </div>
      <button class="btn btn-outline btn-sm" id="btn-scan-absen" style="color:var(--primary);border-color:var(--primary)">📷 Scan QR (isi otomatis Hadir)</button>
    </div>

    <div class="card">
      <div class="search-box">
        <span class="icon">🔍</span>
        <input type="search" id="search-siswa" placeholder="Filter nama / NISN..." />
      </div>

      <div class="filter-chips" id="chip-jenjang">
        <button type="button" class="chip active" data-jenjang="">Semua</button>
        <button type="button" class="chip" data-jenjang="SD">SD</button>
        <button type="button" class="chip" data-jenjang="SMP">SMP</button>
        <button type="button" class="chip" data-jenjang="SMA">SMA</button>
      </div>
      <div class="filter-chips" id="chip-kelas"></div>

      <div class="absen-legend">
        <span><b class="lg-h">H</b> Hadir</span>
        <span><b class="lg-s">S</b> Sakit</span>
        <span><b class="lg-i">I</b> Izin</span>
        <span><b class="lg-a">A</b> Alpha</span>
      </div>

      <div class="absen-progress">
        Terisi: <strong id="cnt-filled">0</strong> / <strong id="cnt-total">0</strong>
      </div>

      <div id="list-siswa-absen" class="absen-list"><div class="empty">Memuat daftar siswa...</div></div>

      <button class="btn btn-accent btn-block" id="btn-submit-absen" style="margin-top:16px" disabled>
        Submit Absensi
      </button>
    </div>

    <div id="absen-qr-modal" class="modal-overlay">
      <div class="modal">
        <div class="modal-header">
          <h3>Scan QR Siswa → Hadir</h3>
          <button class="modal-close" id="btn-close-absen-qr">✕</button>
        </div>
        <div id="absen-qr-reader"></div>
        <p style="text-align:center;margin-top:8px;font-size:0.85rem;color:var(--gray-500)">Scan untuk menandai Hadir</p>
      </div>
    </div>
  `;

  document.getElementById('sel-sesi').addEventListener('change', e => {
    currentSesi = Number(e.target.value);
  });
  document.getElementById('search-siswa').addEventListener('input', debounce(applyFilter, 200));
  document.getElementById('chip-jenjang').addEventListener('click', (e) => {
    const btn = e.target.closest('.chip');
    if (!btn) return;
    document.querySelectorAll('#chip-jenjang .chip').forEach(c => c.classList.remove('active'));
    btn.classList.add('active');
    applyFilter();
  });
  document.getElementById('btn-submit-absen').addEventListener('click', submitAll);
  document.getElementById('btn-scan-absen').addEventListener('click', openAbsenQR);
  document.getElementById('btn-close-absen-qr').addEventListener('click', closeAbsenQR);

  await loadAllSiswa();
}

async function loadAllSiswa() {
  const res = await api('getSiswaAbsensi', {});
  allSiswa = res.data || [];
  applyFilter();
}

function getActiveJenjang() {
  const el = document.querySelector('#chip-jenjang .chip.active');
  return el ? (el.dataset.jenjang || '') : '';
}

function getActiveKelas() {
  const el = document.querySelector('#chip-kelas .chip.active');
  return el ? (el.dataset.kelas || '') : '';
}

function applyFilter() {
  const q = (document.getElementById('search-siswa').value || '').toLowerCase().trim();
  const jenjang = getActiveJenjang();
  const kelas = getActiveKelas();

  currentList = allSiswa.filter(s => {
    if (jenjang && s.Jenjang !== jenjang) return false;
    if (kelas && s.Kelas !== kelas) return false;
    if (q) {
      const hay = `${s.Nama} ${s.NISN} ${s.Kelas}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  // Rebuild kelas chips dari data yang sudah filter jenjang (tanpa filter kelas/q)
  const baseForKelas = allSiswa.filter(s => !jenjang || s.Jenjang === jenjang);
  const kelasSet = [...new Set(baseForKelas.map(s => s.Kelas).filter(Boolean))].sort();
  const chipKelas = document.getElementById('chip-kelas');
  const prevKelas = getActiveKelas();
  chipKelas.innerHTML = `<button type="button" class="chip ${!prevKelas || !kelasSet.includes(prevKelas) ? 'active' : ''}" data-kelas="">Semua Kelas</button>` +
    kelasSet.map(k => `<button type="button" class="chip ${prevKelas === k ? 'active' : ''}" data-kelas="${k}">${k}</button>`).join('');

  chipKelas.onclick = (e) => {
    const btn = e.target.closest('.chip');
    if (!btn) return;
    chipKelas.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
    btn.classList.add('active');
    applyFilter();
  };

  // Jika kelas aktif tidak valid lagi, ulangi tanpa kelas
  if (prevKelas && !kelasSet.includes(prevKelas)) {
    // already reset active to Semua Kelas above; refilter
    currentList = allSiswa.filter(s => {
      if (jenjang && s.Jenjang !== jenjang) return false;
      if (q) {
        const hay = `${s.Nama} ${s.NISN} ${s.Kelas}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }

  renderList();
}

function renderList() {
  const el = document.getElementById('list-siswa-absen');
  document.getElementById('cnt-total').textContent = currentList.length;
  updateFilledCount();

  if (!currentList.length) {
    el.innerHTML = '<div class="empty">Tidak ada siswa</div>';
    return;
  }

  // Group by jenjang → kelas
  const grouped = {};
  currentList.forEach(s => {
    const j = s.Jenjang || 'Lainnya';
    const k = s.Kelas || '-';
    if (!grouped[j]) grouped[j] = {};
    if (!grouped[j][k]) grouped[j][k] = [];
    grouped[j][k].push(s);
  });

  let html = '';
  for (const [j, kelasMap] of Object.entries(grouped)) {
    html += `<div class="group-header">${j}</div>`;
    for (const [k, items] of Object.entries(kelasMap)) {
      html += `<div class="kelas-label">Kelas ${k}</div>`;
      items.forEach(s => {
        const nisn = String(s.NISN);
        const st = statusMap.get(nisn) || '';
        html += `
          <div class="absen-row" data-nisn="${nisn}">
            <div class="absen-info">
              <div class="name">${s.Nama}</div>
              <div class="meta">${nisn}</div>
            </div>
            <div class="absen-btns">
              <button type="button" class="abtn ${STATUS_CLASS.H} ${st === 'H' ? 'on' : ''}" data-st="H" data-nisn="${nisn}" data-nama="${s.Nama}">H</button>
              <button type="button" class="abtn ${STATUS_CLASS.S} ${st === 'S' ? 'on' : ''}" data-st="S" data-nisn="${nisn}" data-nama="${s.Nama}">S</button>
              <button type="button" class="abtn ${STATUS_CLASS.I} ${st === 'I' ? 'on' : ''}" data-st="I" data-nisn="${nisn}" data-nama="${s.Nama}">I</button>
              <button type="button" class="abtn ${STATUS_CLASS.A} ${st === 'A' ? 'on' : ''}" data-st="A" data-nisn="${nisn}" data-nama="${s.Nama}">A</button>
            </div>
          </div>`;
      });
    }
  }
  el.innerHTML = html;

  el.querySelectorAll('.abtn').forEach(btn => {
    btn.addEventListener('click', () => {
      const nisn = btn.dataset.nisn;
      const st = btn.dataset.st;
      const nama = btn.dataset.nama;
      statusMap.set(nisn, st);
      // update UI in this row only
      const row = btn.closest('.absen-row');
      row.querySelectorAll('.abtn').forEach(b => b.classList.remove('on'));
      btn.classList.add('on');
      // store nama for submit
      statusMap.set(nisn + '_nama', nama);
      updateFilledCount();
    });
  });
}

function updateFilledCount() {
  const filled = currentList.filter(s => statusMap.has(String(s.NISN))).length;
  document.getElementById('cnt-filled').textContent = filled;
  const btn = document.getElementById('btn-submit-absen');
  btn.disabled = filled === 0;
  btn.textContent = filled === 0
    ? 'Submit Absensi'
    : `Submit Absensi (${filled} siswa)`;
}

async function submitAll() {
  const entries = [];
  for (const s of currentList) {
    const nisn = String(s.NISN);
    const st = statusMap.get(nisn);
    if (!st) continue;
    entries.push({
      nisn,
      nama: s.Nama,
      status: STATUS_LABEL[st] || st,
      keterangan: st === 'H' ? '' : STATUS_LABEL[st],
      kode: st
    });
  }

  if (!entries.length) {
    toast('Belum ada siswa yang ditandai', 'error');
    return;
  }

  showLoading(`Menyimpan ${entries.length} absensi...`);
  let ok = 0, fail = 0;
  for (const e of entries) {
    const res = await api('submitAbsensi', {
      nisn: e.nisn,
      nama: e.nama,
      sesi: currentSesi,
      status: e.status,
      keterangan: e.keterangan,
      kode: e.kode,
      petugasNIP: userRef.id
    }, { silent: true });
    if (res.success) ok++;
    else {
      fail++;
      if (fail <= 3) toast(`${e.nama}: ${res.message}`, 'error');
    }
  }
  hideLoading();

  if (ok) toast(`${ok} absensi tersimpan` + (fail ? `, ${fail} gagal` : ''), ok && !fail ? 'success' : 'error');

  // Reset status yang berhasil (sederhana: clear semua yang di-submit)
  entries.forEach(e => {
    statusMap.delete(e.nisn);
    statusMap.delete(e.nisn + '_nama');
  });
  renderList();
}

async function openAbsenQR() {
  const modal = document.getElementById('absen-qr-modal');
  modal.classList.add('open');
  if (!window.Html5Qrcode) {
    await new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js';
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }
  try {
    const cameras = await Html5Qrcode.getCameras();
    if (!cameras.length) { toast('Kamera tidak ditemukan', 'error'); closeAbsenQR(); return; }
    const back = cameras.find(c => /back|rear|environment/i.test(c.label));
    html5Qr = new Html5Qrcode('absen-qr-reader');
    const onScan = throttle(async (code) => {
      const res = await api('loginQR', { code: code.trim() }, { silent: true });
      if (res.success && res.data.type === 'siswa') {
        const nisn = String(res.data.id);
        statusMap.set(nisn, 'H');
        statusMap.set(nisn + '_nama', res.data.nama);
        toast(`Hadir: ${res.data.nama}`, 'success');
        renderList();
      }
    }, 800);
    await html5Qr.start(back ? back.id : cameras[0].id, { fps: 8, qrbox: { width: 220, height: 220 } }, onScan, () => {});
  } catch (err) {
    toast('Gagal kamera: ' + err.message, 'error');
    closeAbsenQR();
  }
}

async function closeAbsenQR() {
  if (html5Qr) {
    try { await html5Qr.stop(); html5Qr.clear(); } catch (_) {}
    html5Qr = null;
  }
  document.getElementById('absen-qr-modal').classList.remove('open');
}
