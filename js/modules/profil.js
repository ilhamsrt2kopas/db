/**
 * profil.js - Info user, ganti password, cetak kartu login
 */
import { api } from '../api.js';
import { toast, escapeHtml, qrDataUrl } from '../utils.js';
import { getUser } from '../auth.js';

export async function render(container, user) {
  container.innerHTML = `
    <div class="card" style="text-align:center">
      <div style="width:80px;height:80px;border-radius:50%;background:var(--primary-light);margin:0 auto 12px;display:flex;align-items:center;justify-content:center;font-size:2rem;font-weight:700;color:var(--primary)">
        ${(user.nama || 'A').charAt(0)}
      </div>
      <div style="font-size:1.2rem;font-weight:700">${escapeHtml(user.nama)}</div>
      <div style="color:var(--gray-500);margin-top:4px">${escapeHtml(user.jabatan || user.role || '')}</div>
      <div style="font-size:0.85rem;margin-top:4px">${user.id}</div>
      ${user.berwenang ? `<span class="badge badge-info" style="margin-top:8px">Berwenang: ${user.berwenang}</span>` : ''}
    </div>

    ${user.type === 'admin' ? `
    <div class="card">
      <div class="card-title" style="margin-bottom:12px">Ganti Password</div>
      <div class="form-group"><label>Password Lama</label><input type="password" id="old-pass" /></div>
      <div class="form-group"><label>Password Baru</label><input type="password" id="new-pass" /></div>
      <button class="btn btn-accent btn-block" id="btn-ganti-pass">Simpan Password</button>
    </div>
    <div class="card">
      <button class="btn btn-outline btn-block" id="btn-cetak-kartu" style="color:var(--primary);border-color:var(--primary)">Cetak Kartu Login</button>
    </div>` : ''}
  `;

  if (user.type === 'admin') {
    document.getElementById('btn-ganti-pass').addEventListener('click', async () => {
      const res = await api('changePassword', {
        nip: user.id,
        oldPassword: document.getElementById('old-pass').value,
        newPassword: document.getElementById('new-pass').value
      });
      toast(res.message, res.success ? 'success' : 'error');
      if (res.success) {
        document.getElementById('old-pass').value = '';
        document.getElementById('new-pass').value = '';
      }
    });

    document.getElementById('btn-cetak-kartu').addEventListener('click', () => {
      const w = window.open('', '_blank');
      w.document.write(`
        <!DOCTYPE html><html><head><title>Kartu Login</title>
        <style>
          body{font-family:sans-serif;display:flex;justify-content:center;padding:40px}
          .card{width:320px;border:2px solid #1a56db;border-radius:12px;padding:24px;text-align:center}
          .logo{font-size:14px;font-weight:700;color:#1a56db;margin-bottom:8px}
          .name{font-size:18px;font-weight:700;margin:12px 0 4px}
          .meta{font-size:13px;color:#555}
          img.qr{width:140px;height:140px;margin:16px auto}
        </style></head><body>
        <div class="card">
          <div class="logo">SEKOLAH RAKYAT KOTA PASURUAN</div>
          <div style="font-size:11px;color:#888">Cerdas Bersama, Tumbuh Setara</div>
          <div class="name">${escapeHtml(user.nama)}</div>
          <div class="meta">${escapeHtml(user.jabatan || '')}</div>
          <div class="meta">${user.id}</div>
          <img class="qr" src="${qrDataUrl(user.id)}" alt="QR Login" />
          <div style="font-size:11px;color:#888;margin-top:8px">Scan QR untuk login</div>
        </div>
        <script>window.onload=()=>window.print()</script></body></html>`);
      w.document.close();
    });
  }
}
