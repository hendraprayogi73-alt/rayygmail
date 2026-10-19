'use strict';

// Ganti dengan URL Web App Google Apps Script milikmu.
const API_URL = 'https://script.google.com/macros/s/AKfycbxomM9CziJiuA_2TI5S0kqaTqHuhrWjWPYt_Um6OpLtNDTY4co-Qtw4k5XhccI_1x8n/exec';

const $ = id => document.getElementById(id);
const TOKEN_KEY = 'rayygmail_session';

function getToken() {
  return localStorage.getItem(TOKEN_KEY) || '';
}

function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;',
    '"': '&quot;', "'": '&#39;'
  })[char]);
}

function money(value) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency', currency: 'IDR',
    maximumFractionDigits: 0
  }).format(Number(value) || 0);
}

function dateText(value) {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '-' : d.toLocaleString('id-ID');
}

function statusClass(status) {
  if (status === 'Disetujui' || status === 'Selesai') return 'status s-ok';
  if (status === 'Ditolak') return 'status s-bad';
  if (status === 'Menunggu') return 'status s-wait';
  return 'status';
}

function setMessage(id, message, isError = false) {
  const el = $(id);
  if (!el) return;
  el.textContent = message;
  el.classList.toggle('error', isError);
}

async function api(action, data = {}) {
  if (!API_URL.startsWith('https://script.google.com/')) {
    throw new Error('Isi API_URL dengan URL Web App Apps Script yang benar.');
  }

  let response;
  try {
    response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action, ...data }),
      redirect: 'follow'
    });
  } catch (_) {
    throw new Error('Tidak dapat menghubungi backend. Periksa URL, deployment, dan koneksi.');
  }

  let result;
  try {
    result = await response.json();
  } catch (_) {
    throw new Error('Respons backend tidak valid. Periksa deployment Apps Script.');
  }

  if (!response.ok || !result.ok) {
    throw new Error(result.message || 'Permintaan gagal.');
  }

  return result;
}

function go(path) {
  window.location.assign(path);
}

async function logout() {
  const token = getToken();
  clearToken();

  try {
    if (token) await api('logout', { token });
  } catch (_) {
    // Token lokal sudah dihapus; sesi server akan kedaluwarsa.
  }

  go('/');
}

async function requireUser(expectedRole) {
  const token = getToken();

  if (!token) {
    go('/');
    return null;
  }

  try {
    const result = await api('me', { token });
    const user = result.user;

    if (expectedRole === 'admin' && user.role !== 'admin') {
      go('/dashboard');
      return null;
    }

    if (expectedRole === 'user' && user.role === 'admin') {
      go('/admin');
      return null;
    }

    return user;
  } catch (_) {
    clearToken();
    go('/');
    return null;
  }
}

function bindLogout() {
  const btn = $('logoutBtn');
  if (btn) btn.addEventListener('click', logout);
}

function bindRefresh(fn) {
  const btn = $('refreshBtn');
  if (btn) btn.addEventListener('click', fn);
}

function initAuth() {
  let mode = 'login';
  const tabs = document.querySelectorAll('.auth-tab');
  const form = $('authForm');

  function setMode(next) {
    mode = next;
    tabs.forEach(tab => tab.classList.toggle('active', tab.dataset.mode === mode));
    $('nameWrap').classList.toggle('hidden', mode !== 'register');
    $('authName').required = mode === 'register';
    $('authPassword').autocomplete = mode === 'register' ? 'new-password' : 'current-password';
    $('authSubmit').textContent = mode === 'register' ? 'Buat akun →' : 'Masuk →';
    setMessage('authMessage', '');
  }

  tabs.forEach(tab => tab.addEventListener('click', () => setMode(tab.dataset.mode)));

  form.addEventListener('submit', async event => {
    event.preventDefault();
    const button = $('authSubmit');
    button.disabled = true;
    setMessage('authMessage', 'Memproses…');

    try {
      const payload = {
        email: $('authEmail').value.trim(),
        password: $('authPassword').value
      };

      let result;
      if (mode === 'register') {
        payload.name = $('authName').value.trim();
        result = await api('register', payload);
      } else {
        result = await api('login', payload);
      }

      setToken(result.token);
      go(result.user.role === 'admin' ? '/admin' : '/dashboard');
    } catch (error) {
      setMessage('authMessage', error.message, true);
    } finally {
      button.disabled = false;
    }
  });

  // Akun yang sudah memiliki sesi langsung menuju halaman sesuai peran.
  if (getToken()) {
    api('me', { token: getToken() })
      .then(r => go(r.user.role === 'admin' ? '/admin' : '/dashboard'))
      .catch(clearToken);
  }
}

async function initDashboard() {
  const user = await requireUser('user');
  if (!user) return;

  bindLogout();

  const VIEWS = ['home', 'history', 'deposit', 'balance', 'profile'];
  let provider = 'DANA';
  let currentBalance = 0;
  let minWithdrawal = 1000;
  let withdrawalOpen = true;

  function showView(name) {
    if (VIEWS.indexOf(name) === -1) name = 'home';
    document.querySelectorAll('.view').forEach(v =>
      v.classList.toggle('active', v.dataset.view === name));
    document.querySelectorAll('[data-nav]').forEach(b =>
      b.classList.toggle('active', b.dataset.nav === name));
    window.scrollTo({ top: 0 });
    history.replaceState(null, '', '#' + name);
  }

  document.querySelectorAll('[data-nav]').forEach(b =>
    b.addEventListener('click', () => showView(b.dataset.nav)));
  document.querySelectorAll('[data-go]').forEach(b =>
    b.addEventListener('click', () => showView(b.dataset.go)));

  function setProvider(next) {
    provider = next;
    document.querySelectorAll('.provider-btn').forEach(b =>
      b.classList.toggle('active', b.dataset.provider === provider));
    $('walletNumber').placeholder = '081234567890';
    $('walletHint').textContent =
      'Simpan nomor ' + provider + ' agar tidak perlu mengetik ulang. Hanya angka, 10–15 digit.';
  }

  document.querySelectorAll('.provider-btn').forEach(b =>
    b.addEventListener('click', () => setProvider(b.dataset.provider)));

  function renderBalanceInfo() {
    const info = $('balanceInfo');
    if (currentBalance >= minWithdrawal) {
      info.textContent = 'Saldo kamu sudah memenuhi minimum penarikan ' + money(minWithdrawal) + '.';
    } else {
      info.textContent = 'Saldo kamu ' + money(currentBalance) + ', kurang ' +
        money(minWithdrawal - currentBalance) + ' lagi untuk mencapai minimum penarikan ' +
        money(minWithdrawal) + '.';
    }
  }

  async function load() {
    try {
      const data = await api('dashboard', { token: getToken() });
      const subs = data.submissions;

      currentBalance = Number(data.user.balance) || 0;
      minWithdrawal = Number(data.minWithdrawal) || 1000;
      withdrawalOpen = data.withdrawalOpen !== false;

      $('userName').textContent = data.user.name;
      $('profileName').textContent = data.user.name;
      $('profileEmail').textContent = data.user.email;
      $('profileTotal').textContent = data.stats.total;
      document.querySelectorAll('.js-balance').forEach(el => {
        el.textContent = money(currentBalance);
      });

      $('statApproved').textContent = data.stats.approved;
      $('statPending').textContent = subs.filter(s => s.status === 'Menunggu').length;
      $('statProcess').textContent = subs.filter(s => s.status === 'Diproses').length;
      $('statRejected').textContent = subs.filter(s => s.status === 'Ditolak').length;

      $('recentActivity').innerHTML = subs.slice(0, 5).map(s => `
        <div class="activity-item">
          <div><strong>${escapeHtml(s.type)}</strong>
            <p>${escapeHtml(s.reference)}</p>
            <small>${escapeHtml(dateText(s.createdAt))}</small>
          </div>
          <span class="${statusClass(s.status)}">${escapeHtml(s.status)}</span>
        </div>`).join('') || '<div class="empty-state">Belum ada aktivitas.</div>';

      $('submissionRows').innerHTML = subs.map(s => `
        <tr>
          <td>${escapeHtml(dateText(s.createdAt))}</td>
          <td>${escapeHtml(s.type)}</td>
          <td>${escapeHtml(s.reference)}</td>
          <td><span class="${statusClass(s.status)}">${escapeHtml(s.status)}</span></td>
          <td>${escapeHtml(s.adminNote || '-')}</td>
        </tr>`).join('') || '<tr><td colspan="5">Belum ada pengajuan.</td></tr>';

      $('transactionRows').innerHTML = data.transactions.map(t => `
        <tr>
          <td>${escapeHtml(dateText(t.createdAt))}</td>
          <td>${escapeHtml(t.type)}</td>
          <td>${escapeHtml(t.description)}</td>
          <td>${escapeHtml(money(t.amount))}</td>
          <td>${escapeHtml(t.status)}</td>
        </tr>`).join('') || '<tr><td colspan="5">Belum ada transaksi.</td></tr>';

      // Saldo & penarikan
      renderBalanceInfo();

      const statusBox = $('withdrawStatus');
      statusBox.classList.toggle('closed', !withdrawalOpen);
      statusBox.innerHTML = 'Status penarikan: <b>' +
        (withdrawalOpen ? '🟢 Dibuka' : '🔴 Ditutup') + '</b>';
      $('withdrawBtn').disabled = !withdrawalOpen;

      const badge = $('walletBadge');
      if (data.wallet) {
        badge.textContent = 'Tersimpan';
        badge.className = 'badge ok';
        setProvider(data.wallet.provider);
        if (document.activeElement !== $('walletNumber')) {
          $('walletNumber').value = data.wallet.number;
        }
      } else {
        badge.textContent = 'Belum diisi';
        badge.className = 'badge warn';
      }

      $('withdrawalRows').innerHTML = (data.withdrawals || []).map(w => `
        <tr>
          <td>${escapeHtml(dateText(w.createdAt))}</td>
          <td>${escapeHtml(w.provider)} ${escapeHtml(w.number)}</td>
          <td>${escapeHtml(money(w.amount))}</td>
          <td><span class="${statusClass(w.status)}">${escapeHtml(w.status)}</span></td>
          <td>${escapeHtml(w.adminNote || '-')}</td>
        </tr>`).join('') || '<tr><td colspan="5">Belum ada penarikan.</td></tr>';
    } catch (error) {
      setMessage('submissionMessage', error.message, true);
    }
  }

  $('submissionForm').addEventListener('submit', async event => {
    event.preventDefault();
    const button = event.submitter;
    if (button) button.disabled = true;

    try {
      const result = await api('createSubmission', {
        token: getToken(),
        type: $('submissionType').value,
        reference: $('submissionReference').value.trim(),
        note: $('submissionNote').value.trim()
      });

      setMessage('submissionMessage', result.message);
      $('submissionForm').reset();
      await load();
    } catch (error) {
      setMessage('submissionMessage', error.message, true);
    } finally {
      if (button) button.disabled = false;
    }
  });

  $('walletForm').addEventListener('submit', async event => {
    event.preventDefault();
    const button = event.submitter;
    if (button) button.disabled = true;

    try {
      const result = await api('saveWallet', {
        token: getToken(),
        provider: provider,
        number: $('walletNumber').value.trim()
      });

      setMessage('walletMessage', result.message);
      await load();
    } catch (error) {
      setMessage('walletMessage', error.message, true);
    } finally {
      if (button) button.disabled = false;
    }
  });

  $('withdrawForm').addEventListener('submit', async event => {
    event.preventDefault();
    const button = $('withdrawBtn');
    button.disabled = true;

    try {
      const result = await api('requestWithdrawal', {
        token: getToken(),
        amount: Number($('withdrawAmount').value)
      });

      setMessage('withdrawMessage', result.message);
      $('withdrawForm').reset();
      await load();
    } catch (error) {
      setMessage('withdrawMessage', error.message, true);
    } finally {
      button.disabled = !withdrawalOpen;
    }
  });

  bindRefresh(load);
  showView((window.location.hash || '').replace('#', '') || 'home');
  await load();
}

async function initAdmin() {
  const user = await requireUser('admin');
  if (!user) return;

  bindLogout();

  async function load() {
    try {
      const data = await api('adminOverview', { token: getToken() });
      $('adminUserCount').textContent = data.stats.users;
      $('adminSubmissionCount').textContent = data.stats.submissions;
      $('adminPendingCount').textContent = data.stats.pending;

      $('adminUserRows').innerHTML = data.users.map(u => `
        <tr>
          <td>${escapeHtml(u.name)}</td>
          <td>${escapeHtml(u.email)}</td>
          <td>${escapeHtml(u.role)}</td>
          <td>${escapeHtml(money(u.balance))}</td>
        </tr>`).join('') || '<tr><td colspan="4">Belum ada pengguna.</td></tr>';

      const select = $('balanceUser');
      const previous = select.value;
      select.innerHTML = '<option value="">Pilih pengguna</option>' +
        data.users.filter(u => u.role !== 'admin').map(u =>
          `<option value="${escapeHtml(u.id)}">${escapeHtml(u.name)} — ${escapeHtml(u.email)}</option>`
        ).join('');
      if (data.users.some(u => u.id === previous && u.role !== 'admin')) {
        select.value = previous;
      }

      $('adminSubmissionRows').innerHTML = data.submissions.map(s => `
        <tr>
          <td>${escapeHtml(dateText(s.createdAt))}</td>
          <td>${escapeHtml(s.userName)}<br><small>${escapeHtml(s.userEmail)}</small></td>
          <td>${escapeHtml(s.type)}</td>
          <td>${escapeHtml(s.reference)}</td>
          <td>${escapeHtml(s.note || '-')}</td>
          <td>
            <select class="status-select" data-status-id="${escapeHtml(s.id)}">
              ${['Menunggu','Diproses','Disetujui','Ditolak'].map(status =>
                `<option ${status === s.status ? 'selected' : ''}>${status}</option>`
              ).join('')}
            </select>
          </td>
          <td><input class="admin-note" data-note-id="${escapeHtml(s.id)}"
            maxlength="500" value="${escapeHtml(s.adminNote || '')}" placeholder="Catatan admin"></td>
          <td><button class="btn btn-primary save-status" data-save-id="${escapeHtml(s.id)}">Simpan</button></td>
        </tr>`).join('') || '<tr><td colspan="8">Belum ada pengajuan.</td></tr>';

      $('adminTransactionRows').innerHTML = data.transactions.map(t => `
        <tr>
          <td>${escapeHtml(dateText(t.createdAt))}</td>
          <td>${escapeHtml(t.userName)}</td>
          <td>${escapeHtml(t.type)}</td>
          <td>${escapeHtml(t.description)}</td>
          <td>${escapeHtml(money(t.amount))}</td>
          <td>${escapeHtml(t.status)}</td>
        </tr>`).join('') || '<tr><td colspan="6">Belum ada transaksi.</td></tr>';

      document.querySelectorAll('.save-status:not(.save-withdrawal)').forEach(button => {
        button.addEventListener('click', async () => {
          button.disabled = true;
          try {
            const id = button.dataset.saveId;
            const status = document.querySelector(`[data-status-id="${CSS.escape(id)}"]`).value;
            const adminNote = document.querySelector(`[data-note-id="${CSS.escape(id)}"]`).value;

            const result = await api('adminUpdateSubmission', {
              token: getToken(), id, status, adminNote
            });

            setMessage('adminMessage', result.message);
            await load();
          } catch (error) {
            setMessage('adminMessage', error.message, true);
          } finally {
            button.disabled = false;
          }
        });
      });

      // Penarikan saldo
      const wBody = $('adminWithdrawalRows');
      if (wBody) {
        const list = data.withdrawals || [];

        wBody.innerHTML = list.map(w => {
          const final = w.status === 'Selesai' || w.status === 'Ditolak';
          return `
          <tr>
            <td>${escapeHtml(dateText(w.createdAt))}</td>
            <td>${escapeHtml(w.userName)}<br><small>${escapeHtml(w.userEmail)}</small></td>
            <td>${escapeHtml(w.provider)} ${escapeHtml(w.number)}</td>
            <td>${escapeHtml(money(w.amount))}</td>
            <td>
              <select class="status-select" data-wstatus-id="${escapeHtml(w.id)}" ${final ? 'disabled' : ''}>
                ${['Menunggu','Diproses','Selesai','Ditolak'].map(status =>
                  `<option ${status === w.status ? 'selected' : ''}>${status}</option>`
                ).join('')}
              </select>
            </td>
            <td><input class="admin-note" data-wnote-id="${escapeHtml(w.id)}" maxlength="500"
              value="${escapeHtml(w.adminNote || '')}" placeholder="Catatan admin" ${final ? 'disabled' : ''}></td>
            <td><button class="btn btn-primary save-status save-withdrawal" data-wsave-id="${escapeHtml(w.id)}"
              ${final ? 'disabled' : ''}>Simpan</button></td>
          </tr>`;
        }).join('') || '<tr><td colspan="7">Belum ada penarikan.</td></tr>';

        wBody.querySelectorAll('.save-withdrawal').forEach(button => {
          button.addEventListener('click', async () => {
            button.disabled = true;
            try {
              const id = button.dataset.wsaveId;
              const status = document.querySelector(`[data-wstatus-id="${CSS.escape(id)}"]`).value;
              const adminNote = document.querySelector(`[data-wnote-id="${CSS.escape(id)}"]`).value;

              if (status === 'Menunggu') {
                throw new Error('Pilih Diproses, Selesai, atau Ditolak.');
              }

              const result = await api('adminUpdateWithdrawal', {
                token: getToken(), id, status, adminNote
              });

              setMessage('adminMessage', result.message);
              await load();
            } catch (error) {
              setMessage('adminMessage', error.message, true);
              button.disabled = false;
            }
          });
        });
      }
    } catch (error) {
      setMessage('adminMessage', error.message, true);
    }
  }

  $('balanceForm').addEventListener('submit', async event => {
    event.preventDefault();
    const button = event.submitter;
    if (button) button.disabled = true;

    try {
      let amount = Number($('balanceAmount').value);
      if ($('balanceType').value === 'debit') amount = -amount;

      const result = await api('adminAdjustBalance', {
        token: getToken(),
        userId: $('balanceUser').value,
        amount,
        description: $('balanceDescription').value.trim()
      });

      setMessage('balanceMessage', result.message);
      $('balanceForm').reset();
      await load();
    } catch (error) {
      setMessage('balanceMessage', error.message, true);
    } finally {
      if (button) button.disabled = false;
    }
  });

  bindRefresh(load);
  await load();
}

document.addEventListener('DOMContentLoaded', () => {
  const year = $('year');
  if (year) year.textContent = new Date().getFullYear();

  const path = window.location.pathname.replace(/\/+$/, '') || '/';

  if (path === '/' || path === '/index.html') initAuth();
  else if (path === '/dashboard' || path === '/dashboard.html') initDashboard();
  else if (path === '/admin' || path === '/admin.html') initAdmin();
});
