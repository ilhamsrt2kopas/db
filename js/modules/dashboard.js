/**
 * dashboard.js - Shell aplikasi + router menu
 * Dynamic import tiap modul saat menu diklik
 */

import { getUser, logout } from '../auth.js';
import { toast } from '../utils.js';

const MENU_ADMIN = [
  { id: 'dasbor', label: 'Dasbor', icon: '📊', section: null },
  { id: 'absensi', label: 'Absensi Siswa', icon: '✅', section: 'Operasional' },
  { id: 'pengumuman', label: 'Buat Pengumuman', icon: '📢', section: 'Operasional' },
  { id: 'perizinan', label: 'Form Perizinan', icon: '📝', section: 'Operasional' },
  { id: 'konseling', label: 'Form Konseling', icon: '💬', section: 'Operasional' },
  { id: 'peminjaman', label: 'Peminjaman Barang', icon: '📦', section: 'Barang' },
  { id: 'pengambilan', label: 'Pengambilan Barang', icon: '📤', section: 'Barang' },
  { id: 'distribusi', label: 'Distribusi', icon: '🎁', section: 'Barang' },
  { id: 'siswa', label: 'Data Siswa', icon: '👨‍🎓', section: 'Data' },
  { id: 'petugas', label: 'Data Petugas', icon: '👤', section: 'Data' },
  { id: 'barang', label: 'Data Barang', icon: '📋', section: 'Data' },
  { id: 'pesan', label: 'Pesan', icon: '✉️', section: 'Komunikasi' },
  { id: 'persetujuan', label: 'Persetujuan', icon: '✔️', section: 'Khusus', berwenangOnly: true },
  { id: 'rekap', label: 'Rekap Saya', icon: '📈', section: null },
  { id: 'profil', label: 'Profil', icon: '⚙️', section: null },
];

const MENU_ORTU = [
  { id: 'pengumuman-ortu', label: 'Pengumuman', icon: '📢' },
  { id: 'pesan-ortu', label: 'Pesan', icon: '✉️' },
];

let currentUser = null;
let currentModule = null;

export function initDashboard(user) {
  currentUser = user;
  renderSidebar();
  bindShellEvents();
  navigate(user.type === 'ortu' ? 'pengumuman-ortu' : 'dasbor');
}

function renderSidebar() {
  document.getElementById('sidebar-name').textContent = currentUser.nama || '-';
  document.getElementById('sidebar-role').textContent =
    currentUser.type === 'ortu'
      ? 'Orang Tua'
      : (currentUser.jabatan || currentUser.role || 'Admin') +
        (currentUser.berwenang ? ` · ${currentUser.berwenang}` : '');

  document.getElementById('topbar-avatar').textContent =
    (currentUser.nama || 'A').charAt(0).toUpperCase();

  const nav = document.getElementById('nav-list');
  const menus = currentUser.type === 'ortu' ? MENU_ORTU : MENU_ADMIN;

  let html = '';
  let lastSection = null;

  const canApprove = !!(currentUser.berwenang) ||
    /kepala\s*sekolah/i.test(String(currentUser.jabatan || '')) ||
    currentUser.berwenang === 'Semua';

  menus.forEach(m => {
    if (m.berwenangOnly && !canApprove) return;
    if (m.section && m.section !== lastSection) {
      html += `<li class="nav-section">${m.section}</li>`;
      lastSection = m.section;
    }
    html += `
      <li class="nav-item">
        <a href="#" data-module="${m.id}">
          <span class="icon">${m.icon}</span>
          <span>${m.label}</span>
        </a>
      </li>`;
  });

  nav.innerHTML = html;

  nav.querySelectorAll('a[data-module]').forEach(a => {
    a.addEventListener('click', (e) => {
      e.preventDefault();
      navigate(a.dataset.module);
      closeSidebar();
    });
  });
}

function bindShellEvents() {
  document.getElementById('btn-menu').addEventListener('click', openSidebar);
  document.getElementById('sidebar-overlay').addEventListener('click', closeSidebar);
  document.getElementById('btn-logout').addEventListener('click', () => {
    if (confirm('Yakin ingin logout?')) logout();
  });
}

function openSidebar() {
  document.getElementById('sidebar').classList.add('open');
  document.getElementById('sidebar-overlay').classList.add('open');
}

function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebar-overlay').classList.remove('open');
}

async function navigate(moduleId) {
  // Update active nav
  document.querySelectorAll('.nav-item a').forEach(a => {
    a.classList.toggle('active', a.dataset.module === moduleId);
  });

  const titles = {
    dasbor: 'Dasbor',
    absensi: 'Absensi Siswa',
    pengumuman: 'Buat Pengumuman',
    perizinan: 'Form Perizinan',
    konseling: 'Form Konseling',
    peminjaman: 'Peminjaman Barang',
    pengambilan: 'Pengambilan Barang',
    distribusi: 'Distribusi',
    siswa: 'Data Siswa',
    petugas: 'Data Petugas',
    barang: 'Data Barang',
    pesan: 'Pesan',
    persetujuan: 'Persetujuan',
    rekap: 'Rekap Saya',
    profil: 'Profil',
    'pengumuman-ortu': 'Pengumuman',
    'pesan-ortu': 'Pesan'
  };
  document.getElementById('topbar-title').textContent = titles[moduleId] || moduleId;

  const main = document.getElementById('main-content');
  main.innerHTML = '<div class="empty"><div class="icon">⏳</div>Memuat...</div>';

  try {
    let mod;
    switch (moduleId) {
      case 'dasbor':
        mod = await import('./dasbor.js');
        break;
      case 'absensi':
        mod = await import('./absensi.js');
        break;
      case 'pengumuman':
        mod = await import('./pengumuman.js');
        break;
      case 'perizinan':
        mod = await import('./perizinan.js');
        break;
      case 'konseling':
        mod = await import('./konseling.js');
        break;
      case 'peminjaman':
      case 'pengambilan':
      case 'distribusi':
      case 'barang':
        mod = await import('./barang.js');
        break;
      case 'siswa':
        mod = await import('./siswa.js');
        break;
      case 'petugas':
        mod = await import('./petugas.js');
        break;
      case 'pesan':
      case 'pesan-ortu':
        mod = await import('./pesan.js');
        break;
      case 'persetujuan':
        mod = await import('./persetujuan.js');
        break;
      case 'profil':
        mod = await import('./profil.js');
        break;
      case 'rekap':
        mod = await import('./rekap.js');
        break;
      case 'pengumuman-ortu':
        mod = await import('./pengumuman.js');
        break;
      default:
        main.innerHTML = '<div class="empty">Modul tidak ditemukan</div>';
        return;
    }
    currentModule = mod;
    await mod.render(main, currentUser, moduleId);
  } catch (err) {
    console.error(err);
    main.innerHTML = `<div class="empty"><div class="icon">⚠️</div>Gagal memuat modul: ${err.message}</div>`;
  }
}
