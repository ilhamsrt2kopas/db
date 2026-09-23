/**
 * absensi.js - Multi-sesi, QR continuous + filter manual
 */
import { api } from '../api.js';
import { toast, debounce, throttle } from '../utils.js';

let selectedSiswa = new Map(); // nisn -> {nisn, nama, jenjang, kelas}
let currentSesi = 1;
let html5Qr = null;
let userRef = null;

export async function render(container, user) {
  userRef = user;
  selectedSiswa.clear();

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
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn btn-accent" id="btn-scan-absen">📷 Scan QR Continuous</button>
        <button class="btn btn-outline" id="btn-filter-manual" style="color:var(--primary);border-color:var(--primary)">Pilih Manual</button>
      </div>
    </div>

    <div class="card hidden" id="panel-manual">
      <div class="search-box">
        <span class="icon">🔍</span>
        <input type="search" id="search-siswa" placeholder="Cari nama / NISN / kelas..." />
      </div>
      <div class="form-group" style="display:flex;gap:8px">
        <select id="filter-jenjang" style="flex:1">
          <option value="">Semua Jenjang</option>
          <option value="SD">SD</option>
          <option value="SMP">SMP</option>
          <option value="SMA">SMA</option>
        </select>
        <select id="filter-kelas" style="flex:1">
          <option value="">Semua Kelas</option>
        </select>
      </div>
      <div id="list-siswa-absen" style="max-height:280px;overflow-y:auto"></div>
      <button class="btn btn-accent btn-block" id="btn-absen-selected" style="margin-top:12px">Absen yang Dipilih</button>
    </div>

    <div class="card">
      <div class="card-header">
        <div class="card-title">Antrian Absensi</div>
        <span class="card-badge" id="count-selected">0 dipilih</span>
      </div>
      <div id="queue-absen"><div class="empty">Belum ada siswa dipilih</div></div>
      <div id="form-keterangan" class="hidden" style="margin-top:12px">
        <div class="form-group">
          <label>Keterangan (wajib jika tidak hadir / sesi lanjutan)</label>
          <textarea id="input-keterangan" rows="2" placeholder="Contoh: Sakit, Izin, dll"></textarea>
        </div>
        <div style="display:flex;gap:8px">
          <button class="btn btn-success btn-block" id="btn-hadir">Hadir</button>
          <button class="btn btn-danger btn-block" id="btn-tidak-hadir">Tidak Hadir</button>
        </div>
      </div>
    </div>

    <!-- QR Modal khusus absensi -->
    <div id="absen-qr-modal" class="modal-overlay">
      <div class="modal">
        <div class="modal-header">
          <h3>Scan QR Siswa (Continuous)</h3>
          <button class="modal-close" id="btn-close-absen-qr">✕</button>
        </div>
        <div id="absen-qr-reader"></div>
        <p style="text-align:center;margin-top:8px;font-size:0.85rem;color:var(--gray-500)">Scan berulang tanpa tutup kamera</p>
        <button class="btn btn-accent btn-block" id="btn-switch-absen-cam" style="margin-top:12px">🔄 Ganti Kamera</button>
      </div>
    </div>
  `;

  bindEvents();
}

function bindEvents() {
  document.getElementById('sel-sesi').addEventListener('change', e => {
    currentSesi = Number(e.target.value);
  });

  document.getElementById('btn-filter-manual').addEventListener('click', () => {
    document.getElementById('panel-manual').classList.toggle('hidden');
    loadSiswaList();
  });

  document.getElementById('search-siswa').addEventListener('input', debounce(loadSiswaList, 300));
  document.getElementById('filter-jenjang').addEventListener('change', loadSiswaList);
  document.getElementById('filter-kelas').addEventListener('change', loadSiswaList);

  document.getElementById('btn-absen-selected').addEventListener('click', () => {
    if (selectedSiswa.size === 0) {
      toast('Pilih minimal 1 siswa', 'error');
      return;
    }
    document.getElementById('form-keterangan').classList.remove('hidden');
    renderQueue();
  });

  document.getElementById('btn-hadir').addEventListener('click', () => submitBatch('Hadir'));
  document.getElementById('btn-tidak-hadir').addEventListener('click', () => submitBatch('Tidak Hadir'));

  document.getElementById('btn-scan-absen').addEventListener('click', openAbsenQR);
  document.getElementById('btn-close-absen-qr').addEventListener('click', closeAbsenQR);
}

async function loadSiswaList() {
  const q = document.getElementById('search-siswa').value;
  const jenjang = document.getElementById('filter-jenjang').value;
  const kelas = document.getElementById('filter-kelas').value;

  const res = await api('getSiswaAbsensi', { q, jenjang, kelas });
  const list = res.data || [];

  // Update kelas options
  const kelasSet = new Set(list.map(s => s.Kelas).filter(Boolean));
  const selKelas = document.getElementById('filter-kelas');
  const currentKelas = selKelas.value;
  selKelas.innerHTML = '<option value="">Semua Kelas</option>' +
    [...kelasSet].sort().map(k => `<option value="${k}" ${k === currentKelas ? 'selected' : ''}>${k}</option>`).join('');

  const el = document.getElementById('list-siswa-absen');
  if (!list.length) {
    el.innerHTML = '<div class="empty">Tidak ada data</div>';
    return;
  }

  // Group by jenjang
  const grouped = {};
  list.forEach(s => {
    const j = s.Jenjang || 'Lainnya';
    if (!grouped[j]) grouped[j] = [];
    grouped[j].push(s);
  });

  let html = '';
  for (const [jenjang, items] of Object.entries(grouped)) {
    html += `<div class="group-header">${jenjang}</div>`;
    items.forEach(s => {
      const checked = selectedSiswa.has(s.NISN) ? 'checked' : '';
      html += `
        <label class="check-item">
          <input type="checkbox" data-nisn="${s.NISN}" data-nama="${s.Nama}" data-jenjang="${s.Jenjang}" data-kelas="${s.Kelas}" ${checked} />
          <div class="info">
            <div class="name">${s.Nama}</div>
            <div class="meta">${s.NISN} · ${s.Kelas}</div>
          </div>
        </label>`;
    });
  }
  el.innerHTML = html;

  el.querySelectorAll('input[type="checkbox"]').forEach(cb => {
    cb.addEventListener('change', () => {
      const nisn = cb.dataset.nisn;
      if (cb.checked) {
        selectedSiswa.set(nisn, {
          nisn,
          nama: cb.dataset.nama,
          jenjang: cb.dataset.jenjang,
          kelas: cb.dataset.kelas
        });
      } else {
        selectedSiswa.delete(nisn);
      }
      renderQueue();
    });
  });
}

function renderQueue() {
  const el = document.getElementById('queue-absen');
  document.getElementById('count-selected').textContent = `${selectedSiswa.size} dipilih`;

  if (selectedSiswa.size === 0) {
    el.innerHTML = '<div class="empty">Belum ada siswa dipilih</div>';
    document.getElementById('form-keterangan').classList.add('hidden');
    return;
  }

  el.innerHTML = [...selectedSiswa.values()].map(s => `
    <div class="list-item">
      <div class="info">
        <div class="name">${s.nama}</div>
        <div class="meta">${s.nisn} · ${s.kelas}</div>
      </div>
      <button class="btn btn-sm" data-remove="${s.nisn}" style="color:var(--danger)">✕</button>
    </div>`).join('');

  el.querySelectorAll('[data-remove]').forEach(btn => {
    btn.addEventListener('click', () => {
      selectedSiswa.delete(btn.dataset.remove);
      renderQueue();
      // Uncheck if visible
      const cb = document.querySelector(`input[data-nisn="${btn.dataset.remove}"]`);
      if (cb) cb.checked = false;
    });
  });
}

async function submitBatch(status) {
  const keterangan = document.getElementById('input-keterangan').value.trim();
  if (status === 'Tidak Hadir' && !keterangan) {
    toast('Keterangan wajib diisi untuk status Tidak Hadir', 'error');
    return;
  }

  let ok = 0, fail = 0;
  for (const s of selectedSiswa.values()) {
    const res = await api('submitAbsensi', {
      nisn: s.nisn,
      nama: s.nama,
      sesi: currentSesi,
      status,
      keterangan,
      petugasNIP: userRef.id
    });
    if (res.success) ok++;
    else {
      fail++;
      toast(`${s.nama}: ${res.message}`, 'error');
    }
  }

  if (ok) toast(`${ok} absensi berhasil dicatat`, 'success');
  selectedSiswa.clear();
  renderQueue();
  document.getElementById('input-keterangan').value = '';
}

// --- Continuous QR ---
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
    if (!cameras.length) {
      toast('Kamera tidak ditemukan', 'error');
      closeAbsenQR();
      return;
    }
    const back = cameras.find(c => /back|rear|environment/i.test(c.label));
    const camId = back ? back.id : cameras[0].id;

    html5Qr = new Html5Qrcode('absen-qr-reader');
    const onScan = throttle(async (code) => {
      // Cari siswa dari QR (NISN)
      const res = await api('loginQR', { code: code.trim() });
      if (res.success && res.data.type === 'siswa') {
        const s = res.data;
        if (!selectedSiswa.has(s.id)) {
          selectedSiswa.set(s.id, { nisn: s.id, nama: s.nama, jenjang: s.jenjang, kelas: s.kelas });
          toast(`+ ${s.nama}`, 'success');
          renderQueue();
        }
      } else {
        toast('QR bukan siswa', 'error');
      }
    }, 1000);

    await html5Qr.start(camId, { fps: 8, qrbox: { width: 220, height: 220 } }, onScan, () => {});
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
  if (selectedSiswa.size > 0) {
    document.getElementById('form-keterangan').classList.remove('hidden');
  }
}
