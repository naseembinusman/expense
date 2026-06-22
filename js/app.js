/* ── State ──────────────────────────────────────────────────────── */
let token = localStorage.getItem('sw_token');
let currentUser = localStorage.getItem('sw_user');
let accounts = [];
let currentTxType = 'expense';

/* ── Init ───────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  if (token) {
    showApp();
  } else {
    showAuth();
  }
  // Set today's date as default
  document.getElementById('txDate').value = todayISO();
});

/* ── Auth ───────────────────────────────────────────────────────── */
function switchAuthTab(tab) {
  document.getElementById('loginForm').classList.toggle('hidden', tab !== 'login');
  document.getElementById('registerForm').classList.toggle('hidden', tab !== 'register');
  document.querySelectorAll('.tab-btn').forEach((btn, i) => {
    btn.classList.toggle('active', (i === 0 && tab === 'login') || (i === 1 && tab === 'register'));
  });
  document.getElementById('loginError').textContent = '';
  document.getElementById('regError').textContent = '';
}

async function doLogin() {
  const username = document.getElementById('loginUser').value.trim();
  const password = document.getElementById('loginPass').value;
  const errEl = document.getElementById('loginError');
  errEl.textContent = '';
  if (!username || !password) { errEl.textContent = 'Please fill in all fields.'; return; }

  try {
    const res = await api('/api/login', 'POST', { username, password });
    token = res.token;
    currentUser = res.username;
    localStorage.setItem('sw_token', token);
    localStorage.setItem('sw_user', currentUser);
    showApp();
  } catch (e) {
    errEl.textContent = e.message;
  }
}

async function doRegister() {
  const username = document.getElementById('regUser').value.trim();
  const password = document.getElementById('regPass').value;
  const errEl = document.getElementById('regError');
  errEl.textContent = '';
  if (!username || !password) { errEl.textContent = 'Please fill in all fields.'; return; }

  try {
    const res = await api('/api/register', 'POST', { username, password });
    token = res.token;
    currentUser = res.username;
    localStorage.setItem('sw_token', token);
    localStorage.setItem('sw_user', currentUser);
    showApp();
  } catch (e) {
    errEl.textContent = e.message;
  }
}

function doLogout() {
  localStorage.removeItem('sw_token');
  localStorage.removeItem('sw_user');
  token = null;
  currentUser = null;
  accounts = [];
  showAuth();
}

/* ── Screen Switching ───────────────────────────────────────────── */
function showAuth() {
  document.getElementById('authScreen').classList.add('active');
  document.getElementById('appScreen').classList.remove('active');
}

function showApp() {
  document.getElementById('authScreen').classList.remove('active');
  document.getElementById('appScreen').classList.add('active');
  document.getElementById('topbarUser').textContent = currentUser || '';
  loadAll();
  showTab('dashboard');
}

function showTab(name) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('tab-' + name).classList.add('active');
  document.querySelector(`[data-tab="${name}"]`).classList.add('active');

  if (name === 'dashboard') loadDashboard();
  if (name === 'history') loadHistory();
  if (name === 'accounts') renderAccounts();
  if (name === 'add') populateAccountDropdowns();
}

/* ── Load All Data ──────────────────────────────────────────────── */
async function loadAll() {
  try {
    accounts = await api('/api/accounts');
  } catch (e) {
    if (e.status === 401) doLogout();
  }
}

/* ── Dashboard ──────────────────────────────────────────────────── */
async function loadDashboard() {
  await loadAll();
  renderSummary();
  loadRecentTx();
}

function renderSummary() {
  const assets = accounts.filter(a => a.type === 'asset');
  const totalCash = assets.reduce((s, a) => s + (a.balance || 0), 0);

  const container = document.getElementById('summaryCards');
  if (assets.length === 0) {
    container.innerHTML = `<div class="summary-card wide">
      <div class="sc-label">Total Balance</div>
      <div class="sc-value">AED 0.00</div>
      <div class="sc-sub">Add accounts in the Accounts tab</div>
    </div>`;
    return;
  }

  let html = `<div class="summary-card wide">
    <div class="sc-label">Total Balance</div>
    <div class="sc-value">${fmtAED(totalCash)}</div>
    <div class="sc-sub">across ${assets.length} account${assets.length > 1 ? 's' : ''}</div>
  </div>`;

  assets.forEach(a => {
    const cls = a.balance < 0 ? 'gold' : '';
    html += `<div class="summary-card">
      <div class="sc-label">${esc(a.name)}</div>
      <div class="sc-value ${cls}">${fmtAED(a.balance)}</div>
    </div>`;
  });

  container.innerHTML = html;
}

async function loadRecentTx() {
  try {
    const txs = await api('/api/transactions');
    renderTxList(document.getElementById('recentTx'), txs.slice(0, 10));
  } catch {}
}

/* ── History ────────────────────────────────────────────────────── */
async function loadHistory() {
  // Populate filter
  const sel = document.getElementById('filterAccount');
  const currentVal = sel.value;
  sel.innerHTML = '<option value="">All accounts</option>';
  accounts.forEach(a => {
    sel.innerHTML += `<option value="${a._id}" ${a._id === currentVal ? 'selected' : ''}>${esc(a.name)}</option>`;
  });

  const accountId = sel.value;
  const url = accountId ? `/api/transactions?accountId=${accountId}` : '/api/transactions';
  try {
    const txs = await api(url);
    renderTxList(document.getElementById('historyList'), txs, true);
  } catch {}
}

function renderTxList(container, txs, showDelete = false) {
  if (!txs.length) {
    container.innerHTML = `<div class="empty-state"><div class="es-icon">📋</div>No transactions yet</div>`;
    return;
  }

  const accMap = {};
  accounts.forEach(a => accMap[a._id] = a.name);

  container.innerHTML = txs.map(tx => {
    const fromName = accMap[tx.fromAccountId] || '?';
    const toName = accMap[tx.toAccountId] || '?';
    const fromAcc = accounts.find(a => a._id === tx.fromAccountId);
    const toAcc = accounts.find(a => a._id === tx.toAccountId);
    const isTransfer = fromAcc && toAcc && fromAcc.type === 'asset' && toAcc.type === 'asset';
    const typeClass = isTransfer ? 'transfer' : 'expense';
    const icon = isTransfer ? '⇄' : '↑';
    const desc = tx.description || (isTransfer ? `${fromName} → ${toName}` : toName);
    const meta = `${fromName} → ${toName}`;
    const dateStr = fmtDate(tx.date);

    return `<div class="tx-item">
      <div class="tx-icon ${typeClass}">${icon}</div>
      <div class="tx-body">
        <div class="tx-desc">${esc(desc)}</div>
        <div class="tx-meta">${esc(meta)}</div>
      </div>
      <div class="tx-right">
        <div class="tx-amount ${typeClass}">- ${fmtAED(tx.amount)}</div>
        <div class="tx-date">${dateStr}</div>
      </div>
      ${showDelete ? `<button class="tx-delete" onclick="deleteTx('${tx._id}')" title="Delete">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/></svg>
      </button>` : ''}
    </div>`;
  }).join('');
}

/* ── Add Transaction ────────────────────────────────────────────── */
function setTxType(type) {
  currentTxType = type;
  document.getElementById('btnExpense').classList.toggle('active', type === 'expense');
  document.getElementById('btnTransfer').classList.toggle('active', type === 'transfer');
  populateAccountDropdowns();
}

function populateAccountDropdowns() {
  const assets = accounts.filter(a => a.type === 'asset');
  const expenses = accounts.filter(a => a.type === 'expense');

  const fromSel = document.getElementById('fromAccount');
  const toSel = document.getElementById('toAccount');

  fromSel.innerHTML = assets.length
    ? assets.map(a => `<option value="${a._id}">${esc(a.name)} (${fmtAED(a.balance)})</option>`).join('')
    : '<option value="">-- No accounts yet --</option>';

  if (currentTxType === 'expense') {
    document.getElementById('labelTo').innerHTML = 'To Category <span class="hint">(where spent)</span>';
    toSel.innerHTML = expenses.length
      ? expenses.map(a => `<option value="${a._id}">${esc(a.name)}</option>`).join('')
      : '<option value="">-- No categories yet --</option>';
  } else {
    document.getElementById('labelTo').innerHTML = 'To Account <span class="hint">(receiving account)</span>';
    toSel.innerHTML = assets.length > 1
      ? assets.map(a => `<option value="${a._id}">${esc(a.name)} (${fmtAED(a.balance)})</option>`).join('')
      : '<option value="">-- Need 2+ accounts for transfer --</option>';
    // Default: pick a different account than from
    if (assets.length >= 2) toSel.selectedIndex = 1;
  }
}

async function addTransaction() {
  const fromAccountId = document.getElementById('fromAccount').value;
  const toAccountId = document.getElementById('toAccount').value;
  const amount = document.getElementById('txAmount').value;
  const description = document.getElementById('txDesc').value.trim();
  const date = document.getElementById('txDate').value;
  const errEl = document.getElementById('addTxError');
  errEl.textContent = '';

  if (!fromAccountId || !toAccountId) { errEl.textContent = 'Please select accounts.'; return; }
  if (!amount || parseFloat(amount) <= 0) { errEl.textContent = 'Please enter a valid amount.'; return; }
  if (fromAccountId === toAccountId) { errEl.textContent = 'From and To must be different accounts.'; return; }

  try {
    await api('/api/transactions', 'POST', { fromAccountId, toAccountId, amount: parseFloat(amount), description, date });
    // Reset form
    document.getElementById('txAmount').value = '';
    document.getElementById('txDesc').value = '';
    document.getElementById('txDate').value = todayISO();
    // Reload accounts to get updated balances
    await loadAll();
    populateAccountDropdowns();
    // Show brief success flash
    errEl.style.color = 'var(--green)';
    errEl.textContent = '✓ Transaction saved!';
    setTimeout(() => { errEl.textContent = ''; errEl.style.color = ''; }, 2000);
  } catch (e) {
    errEl.textContent = e.message;
  }
}

async function deleteTx(id) {
  if (!confirm('Delete this transaction? This will reverse the account balances.')) return;
  try {
    await api(`/api/transactions/${id}`, 'DELETE');
    await loadAll();
    loadHistory();
  } catch (e) {
    alert(e.message);
  }
}

/* ── Accounts Tab ───────────────────────────────────────────────── */
function renderAccounts() {
  const assets = accounts.filter(a => a.type === 'asset');
  const expenses = accounts.filter(a => a.type === 'expense');

  const assetEl = document.getElementById('assetAccountList');
  assetEl.innerHTML = assets.length
    ? assets.map(a => accountItem(a)).join('')
    : '<div class="empty-state" style="padding:20px"><div class="es-icon">💳</div>No accounts yet</div>';

  const expenseEl = document.getElementById('expenseAccountList');
  expenseEl.innerHTML = expenses.length
    ? expenses.map(a => accountItem(a)).join('')
    : '<div class="empty-state" style="padding:20px"><div class="es-icon">📂</div>No categories yet</div>';
}

function accountItem(a) {
  const balCls = a.balance > 0 ? 'positive' : a.balance < 0 ? 'negative' : '';
  const showBalance = a.type === 'asset';
  return `<div class="account-item">
    <div>
      <div class="acc-name">${esc(a.name)}</div>
      <div class="acc-type">${a.type === 'asset' ? 'Account / Wallet' : 'Expense Category'}</div>
    </div>
    ${showBalance ? `<div class="acc-balance ${balCls}">${fmtAED(a.balance)}</div>` : ''}
    <button class="acc-delete" onclick="deleteAccount('${a._id}')" title="Delete">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/></svg>
    </button>
  </div>`;
}

function openAddAccountModal(type) {
  document.getElementById('modalType').value = type;
  document.getElementById('modalTitle').textContent = type === 'asset' ? 'Add Account' : 'Add Category';
  document.getElementById('modalLabel').textContent = type === 'asset' ? 'Account Name / Alias' : 'Category Name';
  document.getElementById('modalName').value = '';
  document.getElementById('modalError').textContent = '';
  document.getElementById('modalOverlay').classList.remove('hidden');
  setTimeout(() => document.getElementById('modalName').focus(), 100);
}

function closeModal() {
  document.getElementById('modalOverlay').classList.add('hidden');
}

async function saveAccount() {
  const name = document.getElementById('modalName').value.trim();
  const type = document.getElementById('modalType').value;
  const errEl = document.getElementById('modalError');
  if (!name) { errEl.textContent = 'Please enter a name.'; return; }

  try {
    await api('/api/accounts', 'POST', { name, type });
    await loadAll();
    renderAccounts();
    populateAccountDropdowns();
    closeModal();
  } catch (e) {
    errEl.textContent = e.message;
  }
}

async function deleteAccount(id) {
  if (!confirm('Delete this account? Existing transactions will remain but balances may be affected.')) return;
  try {
    await api(`/api/accounts/${id}`, 'DELETE');
    await loadAll();
    renderAccounts();
    populateAccountDropdowns();
  } catch (e) {
    alert(e.message);
  }
}

/* ── API Helper ─────────────────────────────────────────────────── */
async function api(path, method = 'GET', body = null) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' }
  };
  if (token) opts.headers['Authorization'] = `Bearer ${token}`;
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(path, opts);
  const data = await res.json();
  if (!res.ok) {
    const err = new Error(data.error || 'Request failed');
    err.status = res.status;
    throw err;
  }
  return data;
}

/* ── Utilities ──────────────────────────────────────────────────── */
function fmtAED(n) {
  const val = (n || 0);
  return 'AED ' + Math.abs(val).toLocaleString('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(d) {
  if (!d) return '';
  const dt = new Date(d);
  return dt.toLocaleDateString('en-AE', { day: 'numeric', month: 'short', year: 'numeric' });
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function esc(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// Enter key on auth forms
document.addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    const activeLoginForm = document.getElementById('loginForm');
    const activeRegForm = document.getElementById('registerForm');
    if (!activeLoginForm.classList.contains('hidden')) doLogin();
    else if (!activeRegForm.classList.contains('hidden')) doRegister();
  }
});
