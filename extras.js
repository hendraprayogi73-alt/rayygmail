'use strict';
/* Fitur tambahan dashboard: Rules, S&K, Support, Komunitas, Leaderboard.
   Dimuat SEBELUM app.js. Tidak mengubah kode lama. */

// ====== ISI BAGIAN INI ======
var EXTRA = {
  supportUrl: 'https://wa.me/628XXXXXXXXXX',
  communityUrl: 'https://chat.whatsapp.com/XXXXXXXX',
  rules: [
    'Kerjakan hanya Gmail dari job yang Anda ambil.',
    'Jangan pernah mengirim kata sandi, OTP, atau kode pemulihan.',
    'Setor hasil job sebelum batas waktu yang ditentukan admin.',
    'Gmail yang tidak disetor tidak dibayar.',
    'Penarikan saldo diproses setelah diperiksa admin.'
  ],
  terms: 'Tulis syarat dan ketentuan layanan Anda di sini. Contoh: harga per Gmail, jadwal penarikan, dan sanksi pelanggaran.'
};
// ============================

(function () {
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // 1. Menu ikon kedua (setelah menu cepat yang lama)
  var menu = document.querySelector('.quick-menu');
  if (menu) {
    var m = document.createElement('div');
    m.className = 'card quick-menu qm-sm';
    m.innerHTML =
      '<button type="button" data-open="rules"><span class="qi">☰</span>Rules</button>' +
      '<button type="button" data-open="terms"><span class="qi">⚖</span>S&amp;K</button>' +
      '<button type="button" data-link="' + esc(EXTRA.supportUrl) + '"><span class="qi">🎧</span>Support</button>' +
      '<button type="button" data-link="' + esc(EXTRA.communityUrl) + '"><span class="qi">💬</span>Komunitas</button>' +
      '<button type="button" data-open="leaderboard"><span class="qi">🏆</span>Leaderboard</button>';
    menu.parentNode.insertBefore(m, menu.nextSibling);
  }

  // 2. Halaman baru (sebelum </main>)
  var main = document.querySelector('.rx-main');
  if (main) {
    var back = '<button class="btn" type="button" data-open="home">← Kembali</button>';
    main.insertAdjacentHTML('beforeend',
      '<section class="view" data-view="rules"><div class="card"><h2 class="card-title">Rules</h2>' +
        '<ol class="muted" style="padding-left:18px;line-height:1.7">' +
        EXTRA.rules.map(function (r) { return '<li>' + esc(r) + '</li>'; }).join('') +
        '</ol>' + back + '</div></section>' +
      '<section class="view" data-view="terms"><div class="card"><h2 class="card-title">Syarat &amp; Ketentuan</h2>' +
        '<p class="muted" style="line-height:1.7">' + esc(EXTRA.terms) + '</p>' + back + '</div></section>' +
      '<section class="view" data-view="leaderboard"><div class="card"><h2 class="card-title">🏆 Leaderboard</h2>' +
        '<p class="muted">Peringkat berdasarkan total Gmail yang disetujui.</p>' +
        '<div id="lbList"></div>' + back + '</div></section>');
  }

  // 3. Navigasi halaman, link luar, dan leaderboard
  document.addEventListener('click', async function (e) {
    var l = e.target.closest('[data-link]');
    if (l) { window.open(l.getAttribute('data-link'), '_blank', 'noopener'); return; }

    var o = e.target.closest('[data-open]');
    if (!o) return;
    var name = o.getAttribute('data-open');
    var target = document.querySelector('.view[data-view="' + name + '"]');
    if (!target) return;

    document.querySelectorAll('.view').forEach(function (v) { v.classList.remove('active'); });
    target.classList.add('active');
    document.querySelectorAll('[data-nav]').forEach(function (b) {
      b.classList.toggle('active', b.getAttribute('data-nav') === name);
    });
    window.scrollTo(0, 0);

    if (name === 'leaderboard') {
      var box = document.getElementById('lbList');
      box.innerHTML = '<p class="muted">Memuat…</p>';
      try {
        var d = await api('leaderboard', { token: getToken() });
        var medals = ['🥇', '🥈', '🥉'];
        box.innerHTML = (d.items || []).map(function (it, i) {
          return '<div class="activity-item"><div><strong>' + (medals[i] || (i + 1) + '.') + ' ' +
            esc(it.name) + '</strong></div><span class="status s-ok">' + esc(it.total) + ' Gmail</span></div>';
        }).join('') || '<div class="empty-state">Belum ada data.</div>';
      } catch (err) {
        box.innerHTML = '<p class="message error">Leaderboard belum tersedia: ' + esc(err.message) + '</p>';
      }
    }
  });
})();
