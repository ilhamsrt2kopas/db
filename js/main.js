/**
 * main.js - Entry point
 * Pisahkan landing/login dari dashboard via dynamic import
 */

import { isLoggedIn, getUser, loginAdmin, loginQR, logout } from './auth.js';
import { toast, throttle } from './utils.js';

// ========== State ==========
let html5QrCode = null;
let currentCameraId = null;
let cameras = [];

// ========== Init ==========
document.addEventListener('DOMContentLoaded', () => {
  if (isLoggedIn()) {
    showApp();
  } else {
    showLanding();
  }
  bindLandingEvents();
});

function showLanding() {
  document.getElementById('landing').classList.remove('hidden');
  document.getElementById('login-page').classList.add('hidden');
  document.getElementById('app').classList.add('hidden');
}

function showLogin() {
  document.getElementById('landing').classList.add('hidden');
  document.getElementById('login-page').classList.remove('hidden');
  document.getElementById('app').classList.add('hidden');
}

async function showApp() {
  document.getElementById('landing').classList.add('hidden');
  document.getElementById('login-page').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');

  // Dynamic import dashboard (hanya load saat dibutuhkan)
  const { initDashboard } = await import('./modules/dashboard.js');
  initDashboard(getUser());
}

function bindLandingEvents() {
  document.getElementById('btn-to-login').addEventListener('click', showLogin);

  document.getElementById('form-login-admin').addEventListener('submit', async (e) => {
    e.preventDefault();
    const nip = document.getElementById('input-nip').value.trim();
    const password = document.getElementById('input-password').value;
    if (!nip || !password) {
      toast('NIP dan Password wajib diisi', 'error');
      return;
    }
    const btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.textContent = 'Memproses...';
    const res = await loginAdmin(nip, password);
    btn.disabled = false;
    btn.textContent = 'Login dengan NIP';
    if (res.success) {
      toast('Login berhasil', 'success');
      showApp();
    } else {
      toast(res.message || 'Login gagal', 'error');
    }
  });

  document.getElementById('btn-scan-qr').addEventListener('click', openQRScanner);
  document.getElementById('btn-close-qr').addEventListener('click', closeQRScanner);
  document.getElementById('btn-switch-camera').addEventListener('click', switchCamera);
}

// ========== QR Scanner (lazy load) ==========
async function openQRScanner() {
  const modal = document.getElementById('qr-modal');
  modal.classList.add('open');

  // Lazy load library hanya saat diklik
  if (!window.Html5Qrcode) {
    await loadScript('https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js');
  }

  try {
    cameras = await Html5Qrcode.getCameras();
    if (!cameras.length) {
      toast('Kamera tidak ditemukan', 'error');
      closeQRScanner();
      return;
    }
    // Prefer back camera
    const back = cameras.find(c => /back|rear|environment/i.test(c.label));
    currentCameraId = back ? back.id : cameras[0].id;
    startScanner(currentCameraId);
  } catch (err) {
    toast('Gagal mengakses kamera: ' + err.message, 'error');
    closeQRScanner();
  }
}

function startScanner(cameraId) {
  if (html5QrCode) {
    html5QrCode.stop().catch(() => {});
  }
  html5QrCode = new Html5Qrcode('qr-reader');

  const onSuccess = throttle(async (decodedText) => {
    // Stop immediately
    await stopScanner();
    closeQRScanner();

    const res = await loginQR(decodedText.trim());
    if (res.success) {
      toast('Login berhasil', 'success');
      showApp();
    } else if (res.siswaData) {
      toast(res.message, 'error');
    } else {
      toast(res.message || 'QR tidak dikenali', 'error');
    }
  }, 800);

  html5QrCode.start(
    cameraId,
    { fps: 8, qrbox: { width: 220, height: 220 } },
    onSuccess,
    () => {} // ignore failure
  ).catch(err => {
    toast('Gagal memulai scanner: ' + err.message, 'error');
    closeQRScanner();
  });
}

async function stopScanner() {
  if (html5QrCode) {
    try {
      await html5QrCode.stop();
      html5QrCode.clear();
    } catch (_) {}
    html5QrCode = null;
  }
}

async function closeQRScanner() {
  await stopScanner();
  document.getElementById('qr-modal').classList.remove('open');
}

async function switchCamera() {
  if (cameras.length < 2) {
    toast('Hanya 1 kamera tersedia', 'info');
    return;
  }
  const idx = cameras.findIndex(c => c.id === currentCameraId);
  currentCameraId = cameras[(idx + 1) % cameras.length].id;
  await stopScanner();
  startScanner(currentCameraId);
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }
    const s = document.createElement('script');
    s.src = src;
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

// Export untuk module lain
export { openQRScanner, closeQRScanner, stopScanner };

// Register Service Worker untuk PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(err => {
      console.log('SW registration failed:', err);
    });
  });
}
