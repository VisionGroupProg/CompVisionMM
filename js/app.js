// ======================== DATA ========================
let categories = ['Cobre', 'Aluminio', 'Metal', 'Inox', 'Outros'];
let categoryLabels = { Cobre: 'Cobre', Aluminio: 'Alum\u00ednio', Metal: 'Metal', Inox: 'Inox', Outros: 'Outros' };

let nextProductId = 21;
let nextPessoaId = 9;
let nextPurchaseId = 61;
let ultimoCepBuscado = '';
let pessoaComboItems = [];
let pessoaComboHighlight = -1;
let prodComboItems = [];
let prodComboHighlight = -1;
const products = [];
let pessoas = [];
const purchases = [];
let caixaStore = {};
let appConfig = {};
let usingSupabase = false;
let showInactiveProducts = false;
let showInactivePessoas = false;
let isMasterUser = false;
let currentUserEmail = '';
let cancelamentos = {};

function isCompraCancelada(id) { return !!cancelamentos[id]; }
function getCompraCancelamento(id) { return cancelamentos[id] || null; }
function rebuildCancelamentos(list) {
  cancelamentos = {};
  (list || []).forEach(c => { cancelamentos[c.compraId] = c; });
}

// ======================== DATA LOADER ========================
async function carregarDadosIniciais() {
  const sb = getSupabase();
  usingSupabase = !!sb;

  const statusEl = () => document.getElementById('sidebarStatus');
  if (!statusEl()) {
    // Sidebar status element not found, create fallback
  }

  if (!usingSupabase) {
    if (statusEl()) { statusEl().textContent = 'SDK n\u00e3o carregado'; statusEl().className = 'sidebar-status offline'; }
    document.getElementById('appContent').innerHTML =
      '<div class="erro-supabase"><h2>Erro de Conex\u00e3o</h2><p>O SDK do Supabase n\u00e3o foi carregado. Verifique sua conex\u00e3o com a internet e recarregue a p\u00e1gina.</p><button onclick="location.reload()">Recarregar</button></div>';
    return;
  }

  if (statusEl()) statusEl().textContent = 'Testando conex\u00e3o...';

  const test = await dbTestConnection();
  if (!test.ok) {
    if (statusEl()) { statusEl().textContent = 'Offline'; statusEl().className = 'sidebar-status offline'; }
    document.getElementById('appContent').innerHTML =
      '<div class="erro-supabase"><h2>Erro de Conex\u00e3o ao Banco</h2><p>' +
      test.error +
      '</p><p style="margin-top:12px;font-size:13px;color:#888;">Certifique-se de que:<br>1. O schema SQL foi executado no SQL Editor do Supabase<br>2. As RLS policies foram alteradas para permitir anon key (supabase-rls-fix.sql)<br>3. O projeto est\u00e1 ativo</p>' +
      '<button onclick="location.reload()" style="margin-top:16px;">Tentar novamente</button></div>';
    usingSupabase = false;
    return;
  }

  if (statusEl()) { statusEl().textContent = 'Conectado'; statusEl().className = 'sidebar-status'; }

  // Tentar carregar dados existentes
  const data = await dbBootstrap();
  if (data && data.produtos.length > 0) {
    products.length = 0;
    products.push(...data.produtos);
    pessoas.length = 0;
    pessoas.push(...data.pessoas);
    purchases.length = 0;
    purchases.push(...data.compras);
    appConfig = data.config;
    rebuildCancelamentos(data.cancelamentos);
    loadCategories();
    dashboardPeriod = appConfig.dashboard_default_period || 'mes';
    nextProductId = parseInt(data.config.next_product_id) || 21;
    nextPessoaId = parseInt(data.config.next_pessoa_id) || 9;
    nextPurchaseId = parseInt(data.config.next_purchase_id) || 61;

    // Realtime subscription
    dbUnsubscribeAll();
    dbSubscribe(['produtos', 'pessoas', 'compras', 'caixa_sessoes', 'compras_cancelamentos'], async (change) => {
      if (change.table === 'produtos' || change.table === 'pessoas' || change.table === 'compras' || change.table === 'compras_cancelamentos') {
        const fresh = await dbBootstrap();
        if (fresh && fresh.produtos.length > 0) {
          products.length = 0; products.push(...fresh.produtos);
          pessoas.length = 0; pessoas.push(...fresh.pessoas);
          purchases.length = 0; purchases.push(...fresh.compras);
          appConfig = fresh.config;
          rebuildCancelamentos(fresh.cancelamentos);
          loadCategories();
          if (currentModule) {
            if (currentModule === 'dashboard') renderDashboard();
            else if (currentModule === 'produtos') renderProducts();
            else if (currentModule === 'compras') renderPurchases();
            else if (currentModule === 'pessoas') renderPessoas();
            else if (currentModule === 'caixa') await renderCaixa();
            else if (currentModule === 'relatorios') renderReports();
          }
        }
      }
    });
    return;
  }

  // Banco vazio -> avisar que precisa executar o schema SQL
  console.log('Banco vazio. Execute o schema SQL no Supabase.');
  if (statusEl()) { statusEl().textContent = 'Banco vazio'; statusEl().className = 'sidebar-status offline'; }
  document.getElementById('appContent').innerHTML =
    '<div class="erro-supabase"><h2>Banco vazio</h2><p>O banco de dados n\u00e3o possui dados. Execute o arquivo <strong>supabase-schema.sql</strong> no SQL Editor do Supabase para popular as tabelas.</p></div>';
}

// ======================== STATE ========================
let charts = {};
let drawerChart = null;
let pessoaDrawerChart = null;
let currentModule = 'dashboard';
let currentReport = 'periodo';
let editingProductId = null;
let editingPessoaId = null;
let reportChartTimeoutId = null;
let pdvRowCount = 0;

// ======================== NAVIGATION ========================
async function navigateTo(module) {
  if (module === 'configuracoes' && !isMasterUser) module = 'dashboard';
  currentModule = module;
  document.querySelectorAll('.module').forEach(el => el.classList.remove('active'));
  const mod = document.getElementById('module-' + module);
  if (mod) mod.classList.add('active');
  document.querySelectorAll('.sidebar-nav button').forEach(el => {
    el.classList.toggle('active', el.dataset.module === module);
  });
  const titles = { dashboard: 'Dashboard', produtos: 'Produtos', compras: 'Compras', caixa: 'Caixa', pessoas: 'Pessoas', relatorios: 'Relat\u00f3rios', configuracoes: 'Configura\u00e7\u00f5es' };
  document.getElementById('pageTitle').textContent = titles[module] || 'Dashboard';

  if (module === 'dashboard') renderDashboard();
  if (module === 'produtos') renderProducts();
  if (module === 'compras') renderPurchases();
  if (module === 'caixa') await renderCaixa();
  if (module === 'pessoas') renderPessoas();
  if (module === 'relatorios') renderReports();
  if (module === 'configuracoes') renderConfiguracoes();
  lucide.createIcons();
}

function checkMobileBlock() {
  const block = document.getElementById('mobileBlock');
  if (!block) return;
  block.style.display = window.innerWidth < 768 ? 'flex' : 'none';
}
checkMobileBlock();
window.addEventListener('resize', checkMobileBlock);

document.addEventListener('DOMContentLoaded', async () => {
  usingSupabase = true;

  window.addEventListener('beforeunload', function() {
    if (sessionStorage.getItem('cv_remember') !== '1') {
      const cid = localStorage.getItem('cv_company');
      if (cid) localStorage.removeItem('cv_auth_' + cid);
    }
  });

  const companyRestored = supabaseManager.restoreCompany();

  if (companyRestored) {
    const sb = getSupabase();
    try {
      const { data: { session }, error } = await sb.auth.getSession();
      if (!error && session) {
        await carregarDadosIniciais();
        hideCompanySelection();
        initApp();
        return;
      }
    } catch (e) {
      console.warn('Falha ao restaurar sessao:', e.message);
    }
  }

  showCompanySelection();
  lucide.createIcons();
});

function updateLoginBranding() {
  const co = supabaseManager.getCurrentCompany();
  if (!co) return;
  const logo = document.querySelector('.login-brand-logo img');
  const sub = document.querySelector('.login-brand-sub');
  if (logo) logo.src = co.logo;
  if (sub) sub.innerHTML = co.name + '<br>' + co.description;
}

function updateAppBranding() {
  const co = supabaseManager.getCurrentCompany();
  if (!co) return;
  const logo = document.querySelector('.sidebar-logo img');
  const name = document.querySelector('.sidebar-logo p');
  const footer = document.querySelector('.sidebar-footer span');
  if (logo) logo.src = co.logo;
  if (name) name.textContent = co.city;
  if (footer) footer.textContent = (currentUserEmail ? currentUserEmail + ' \u00b7 ' : '') + (isMasterUser ? 'Admin' : 'Usu\u00e1rio') + ' \u2014 ' + co.name;
}

async function verificarUsuarioMestre() {
  const sb = getSupabase();
  if (!sb) return false;
  try {
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return false;
    currentUserEmail = user.email || '';
    const { data, error } = await sb.from('profiles').select('admin').eq('id', user.id).maybeSingle();
    if (error || !data) {
      console.warn('Verificacao de admin falhou:', error && error.message, data);
      return false;
    }
    return data.admin === true;
  } catch (e) {
    console.warn('Falha ao verificar perfil admin:', e.message);
    return false;
  }
}

async function initApp() {
  isMasterUser = await verificarUsuarioMestre();
  const navConf = document.getElementById('navConfiguracoes');
  if (navConf) navConf.style.display = isMasterUser ? '' : 'none';
  document.body.classList.add('authenticated');
  updateAppBranding();
  document.querySelectorAll('.sidebar-nav button').forEach(btn => {
    btn.addEventListener('click', async () => await navigateTo(btn.dataset.module));
  });
  renderDashboard();
  lucide.createIcons();
  setTimeout(() => lucide.createIcons(), 100);
  // Preload caixa para evitar delay ao clicar no modulo
  carregarSessoes(hoje());
}

async function handleLogin(e) {
  e.preventDefault();
  const email = document.getElementById('loginEmail').value.trim();
  const pass = document.getElementById('loginPass').value.trim();
  const errEl = document.getElementById('loginError') || (() => {
    const el = document.createElement('p');
    el.id = 'loginError';
    el.className = 'login-error';
    document.querySelector('.login-form').appendChild(el);
    return el;
  })();

  if (!email || !pass) {
    errEl.textContent = 'Informe email e senha.';
    errEl.style.display = 'block';
    return;
  }

  const sb = getSupabase();
  if (!sb) {
    errEl.textContent = 'Erro de conex\u00e3o ao Supabase.';
    errEl.style.display = 'block';
    return;
  }

  const { data, error } = await sb.auth.signInWithPassword({ email, password: pass });
  if (error) {
    errEl.textContent = error.message;
    errEl.style.display = 'block';
    document.getElementById('loginPass').value = '';
    document.getElementById('loginPass').focus();
    return;
  }

  const remember = document.getElementById('loginRemember').checked;
  sessionStorage.setItem('cv_remember', remember ? '1' : '0');

  document.getElementById('loginScreen').classList.add('hidden');
  await carregarDadosIniciais();
  initApp();
  setTimeout(() => showNotification('Login efetuado com sucesso', 'success'), 500);
}

function handleLogout() {
  sessionStorage.removeItem('cv_remember');
  const cid = localStorage.getItem('cv_company');
  if (cid) localStorage.removeItem('cv_auth_' + cid);
  localStorage.removeItem('cv_company');
  const sb = getSupabase();
  if (sb) sb.auth.signOut();
  location.reload();
}

// ======================== UTILITIES ========================
function formatNumber(n) {
  return n.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}
function formatDate(d) { return d.split('-').reverse().join('/'); }
function toggleSidebar() { document.getElementById('sidebar').classList.toggle('open'); }

// ======================== CUSTOM DIALOG ========================
function showAlert(msg) {
  return new Promise(resolve => {
    document.getElementById('dialogTitle').textContent = 'Aviso';
    document.getElementById('dialogMessage').textContent = msg;
    document.getElementById('dialogPromptField').style.display = 'none';
    document.getElementById('dialogCancelBtn').style.display = 'none';
    document.getElementById('dialogConfirmBtn').textContent = 'OK';
    document.getElementById('dialogOverlay').style.display = 'flex';
    document.getElementById('dialogConfirmBtn').onclick = () => {
      document.getElementById('dialogOverlay').style.display = 'none';
      resolve();
    };
  });
}

function showConfirm(msg, confirmText, cancelText) {
  return new Promise(resolve => {
    document.getElementById('dialogTitle').textContent = 'Confirmar';
    document.getElementById('dialogMessage').textContent = msg;
    document.getElementById('dialogPromptField').style.display = 'none';
    document.getElementById('dialogCancelBtn').style.display = 'inline-flex';
    document.getElementById('dialogCancelBtn').textContent = cancelText || 'Cancelar';
    document.getElementById('dialogConfirmBtn').textContent = confirmText || 'Confirmar';
    document.getElementById('dialogOverlay').style.display = 'flex';
    const confirmBtn = document.getElementById('dialogConfirmBtn');
    const cancelBtn = document.getElementById('dialogCancelBtn');
    confirmBtn.onclick = () => {
      document.getElementById('dialogOverlay').style.display = 'none';
      resolve(true);
    };
    cancelBtn.onclick = () => {
      document.getElementById('dialogOverlay').style.display = 'none';
      resolve(false);
    };
  });
}

function showPrompt(label, defaultValue) {
  return new Promise(resolve => {
    document.getElementById('dialogTitle').textContent = label;
    document.getElementById('dialogMessage').textContent = '';
    document.getElementById('dialogPromptLabel').textContent = label;
    document.getElementById('dialogPromptField').style.display = 'block';
    document.getElementById('dialogPromptInput').value = defaultValue || '';
    document.getElementById('dialogCancelBtn').style.display = 'inline-flex';
    document.getElementById('dialogConfirmBtn').textContent = 'OK';
    document.getElementById('dialogOverlay').style.display = 'flex';
    document.getElementById('dialogPromptInput').focus();
    document.getElementById('dialogPromptInput').onkeydown = (e) => {
      if (e.key === 'Enter') document.getElementById('dialogConfirmBtn').click();
    };
    document.getElementById('dialogConfirmBtn').onclick = () => {
      document.getElementById('dialogOverlay').style.display = 'none';
      resolve(document.getElementById('dialogPromptInput').value);
    };
    document.getElementById('dialogCancelBtn').onclick = () => {
      document.getElementById('dialogOverlay').style.display = 'none';
      resolve(null);
    };
  });
}

// ======================== NOTIFICACOES ========================
function showNotification(msg, type) {
  type = type || 'success';
  const container = document.getElementById('notificationContainer');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = 'toast toast-' + type;
  const icons = { success: 'check-circle', error: 'alert-circle', warning: 'alert-triangle', info: 'info' };
  const iconName = icons[type] || 'info';
  toast.innerHTML =
    '<i data-lucide="' + iconName + '" style="width:18px;height:18px;flex-shrink:0"></i>' +
    '<span>' + msg + '</span>';
  container.appendChild(toast);
  if (typeof lucide !== 'undefined') lucide.createIcons();
  setTimeout(() => { toast.classList.add('show'); }, 10);
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => { if (toast.parentNode) toast.remove(); }, 300);
  }, 3000);
}

// ======================== DASHBOARD ========================
let dashboardPeriod = 'mes';

function setDashboardPeriod(period) {
  dashboardPeriod = period;
  document.querySelectorAll('.period-option').forEach(el => el.classList.toggle('active', el.dataset.period === period));
  renderDashboard();
  if (usingSupabase) dbSetConfig('dashboard_default_period', period);
}

function renderDashboard() {
  document.querySelectorAll('.period-option').forEach(el => el.classList.toggle('active', el.dataset.period === dashboardPeriod));
  const now = new Date();
  const hojeStr = hoje();

  let filtered, label;
  if (dashboardPeriod === 'dia') {
    filtered = purchases.filter(p => p.date === hojeStr && !isCompraCancelada(p.id));
    label = '(Dia)';
  } else {
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0,10);
    filtered = purchases.filter(p => p.date >= monthStart && p.date <= hojeStr && !isCompraCancelada(p.id));
    label = '(M\u00eas)';
  }

  const totalValue = filtered.reduce((s, p) => s + p.totalPrice, 0);
  const totalQty = filtered.length;
  const avgValue = totalQty > 0 ? totalValue / totalQty : 0;

  document.getElementById('metricTotal').textContent = formatNumber(totalValue);
  document.getElementById('metricQty').textContent = totalQty;
  document.getElementById('metricProducts').textContent = products.length;
  document.getElementById('metricAvg').innerHTML = '<span class="currency">R$</span> ' + formatNumber(avgValue);
  document.querySelectorAll('.metric-card .label')[0].textContent = 'Valor Total Compras ' + label;
  document.querySelectorAll('.metric-card .label')[1].textContent = 'Quantidade de Compras ' + label;

  const recent = purchases.filter(p => !isCompraCancelada(p.id)).slice(-10).reverse();
  document.getElementById('dashboardPurchases').innerHTML = recent.map(p => `
    <tr>
      <td class="text-muted">${formatDate(p.date)}</td>
      <td class="text-right">${p.items.length}</td>
      <td class="text-muted">${p.items.map(it => it.productName).join(', ')}</td>
      <td class="text-right font-semibold text-primary">R$ ${formatNumber(p.totalPrice)}</td>
    </tr>
  `).join('');

  updateCharts();
}

function updateCharts() {
  Object.values(charts).forEach(c => { try { c.destroy(); } catch(e) {} });
  const now = new Date();
  const hojeStr = hoje();

  let labels, values, chartLabel;
  if (dashboardPeriod === 'dia') {
    // Last 30 days
    labels = [];
    values = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const ds = d.toISOString().slice(0,10);
      labels.push(d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit' }));
      values.push(purchases.filter(p => p.date === ds && !isCompraCancelada(p.id)).reduce((s, p) => s + p.totalPrice, 0));
    }
    document.getElementById('chartComprasLabel').textContent = 'Compras por Dia';
    chartLabel = 'Valor (R$)';
  } else {
    labels = [];
    values = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      labels.push(d.toLocaleString('pt-BR', { month: 'short', year: '2-digit' }));
      const mStart = new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0,7);
      const mEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().slice(0,10);
      values.push(purchases.filter(p => p.date >= mStart && p.date <= mEnd && !isCompraCancelada(p.id)).reduce((s, p) => s + p.totalPrice, 0));
    }
    document.getElementById('chartComprasLabel').textContent = 'Compras por M\u00eas';
    chartLabel = 'Valor (R$)';
  }

  charts.comprasMes = new Chart(document.getElementById('chartComprasMes'), {
    type: 'bar',
    data: { labels, datasets: [{ label: chartLabel, data: values, backgroundColor: 'rgba(31,55,107,0.7)', borderRadius: 4, barPercentage: 0.6 }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { callback: v => 'R$' + (v/1000).toFixed(0) + 'k' } }, x: { grid: { display: false } } } }
  });

  const comprasValidas = purchases.filter(p => !isCompraCancelada(p.id));
  const prodCounts = {};
  comprasValidas.forEach(p => p.items.forEach(it => { prodCounts[it.productName] = (prodCounts[it.productName] || 0) + it.quantity; }));
  const sorted = Object.entries(prodCounts).sort((a,b) => b[1] - a[1]).slice(0, 8);
  charts.produtosTop = new Chart(document.getElementById('chartProdutosTop'), {
    type: 'bar',
    data: { labels: sorted.map(s => s[0]), datasets: [{ label: 'Quantidade (kg)', data: sorted.map(s => s[1]), backgroundColor: 'rgba(245,197,27,0.7)', borderRadius: 4, barPercentage: 0.6 }] },
    options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { beginAtZero: true, grid: { display: false } }, y: { grid: { display: false } } } }
  });

  const catData = {};
  comprasValidas.forEach(p => p.items.forEach(it => { catData[it.category] = (catData[it.category] || 0) + it.totalPrice; }));
  const catLabels = Object.keys(catData);
  const catColors = { Cobre: '#B87333', Aluminio: '#A8A8A8', Metal: '#4A5568', Inox: '#718096', Outros: '#38A169' };
  const catValuesArray = Object.values(catData);
  charts.categoria = new Chart(document.getElementById('chartCategoria'), {
    type: 'doughnut',
    data: { labels: catLabels.map(l => categoryLabels[l] || l), datasets: [{ data: catValuesArray, backgroundColor: catLabels.map(l => catColors[l] || '#CBD5E1'), borderWidth: 0 }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, padding: 12, font: { size: 11 } } } }, cutout: '60%' }
  });

  charts.evolucao = new Chart(document.getElementById('chartEvolucao'), {
    type: 'line',
    data: { labels: labels.slice(-8), datasets: [{ label: 'Valor Gasto', data: values.slice(-8), borderColor: '#1F376B', backgroundColor: 'rgba(31,55,107,0.08)', fill: true, tension: 0.4, pointBackgroundColor: '#1F376B', pointRadius: 3, borderWidth: 2 }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { callback: v => 'R$' + (v/1000).toFixed(0) + 'k' } }, x: { grid: { display: false } } } }
  });
}

// ======================== PRODUTOS ========================
function renderProducts() {
  const accordion = document.getElementById('productAccordion');
  const search = (document.getElementById('prodSearch').value || '').toLowerCase();
  const catFilter = document.getElementById('prodCatFilter').value;

  let filtered = products.filter(p => showInactiveProducts || p.active !== false);
  if (search) filtered = filtered.filter(p => p.name.toLowerCase().includes(search) || p.description.toLowerCase().includes(search));
  if (catFilter) filtered = filtered.filter(p => p.category === catFilter);

  const grouped = {};
  categories.forEach(c => { grouped[c] = []; });
  filtered.forEach(p => { if (grouped[p.category]) grouped[p.category].push(p); });

  accordion.innerHTML = categories.map(cat => {
    const items = grouped[cat] || [];
    if (!items.length) return '';
    const avg = items.reduce((s,p) => s + p.price, 0) / items.length;
    return `<div class="accordion-item">
      <div class="accordion-header" onclick="this.parentElement.classList.toggle('open')">
        <div class="cat-info"><strong style="font-size:15px">${categoryLabels[cat] || cat}</strong><span class="cat-count">${items.length} produtos</span></div>
        <span class="badge badge-blue">R$ ${avg.toFixed(2).replace('.',',')}/kg m\u00e9dio</span>
        <i data-lucide="chevron-down" class="chevron" style="width:18px;height:18px"></i>
      </div>
      <div class="accordion-body">
        <div class="product-grid">${items.map(p => `
          <div class="product-card" onclick="openProductDrawer(${p.id})">
            <div><div class="prod-name">${p.name} ${p.active === false ? '<span class="badge badge-red">Inativo</span>' : ''}</div><div class="prod-cat">${p.material} &middot; ${p.weight}</div></div>
            <div class="prod-price">R$ ${p.price.toFixed(2)}</div>
          </div>`).join('')}
        </div>
      </div>
    </div>`;
  }).join('');

  lucide.createIcons();
  renderPriceTable();
}

function filterProducts() { renderProducts(); }

function renderPriceTable() {
  const grouped = {};
  products.filter(p => showInactiveProducts || p.active !== false).forEach(p => { if (!grouped[p.category]) grouped[p.category] = []; grouped[p.category].push(p); });
  document.getElementById('priceTableBody').innerHTML = `<table>
    <thead><tr><th>Categoria</th><th>Produto</th><th class="text-right">Pre\u00e7o Atual (R$/kg)</th></tr></thead>
    <tbody>${categories.map(cat => (grouped[cat] || []).map(p => `
      <tr><td><span class="badge badge-gray">${categoryLabels[cat] || cat}</span></td><td class="font-medium">${p.name}</td>
      <td class="text-right"><input type="number" class="price-input" value="${p.price.toFixed(2)}" step="0.01" data-product-id="${p.id}" onchange="updateProductPrice(${p.id}, this.value)"></td></tr>`).join('')).join('')}
    </tbody>
  </table>`;
}

function updateProductPrice(id, value) {
  const p = products.find(x => x.id === id);
  if (!p) return;
  const old = p.price;
  const newPrice = parseFloat(value);
  if (isNaN(newPrice) || newPrice <= 0) { p.price = old; renderPriceTable(); return; }
  p.price = newPrice;
  p.priceHistory.push({ date: new Date().toISOString().slice(0,7), price: newPrice });
  p.changes.push({ date: new Date().toISOString().slice(0,10), field: 'Pre\u00e7o', from: old.toFixed(2), to: newPrice.toFixed(2), user: 'Manual' });
  renderProducts();
}

function showPriceTable() { document.getElementById('priceTableSection').style.display = 'block'; document.getElementById('priceTableSection').scrollIntoView({ behavior: 'smooth' }); lucide.createIcons(); }
function hidePriceTable() { document.getElementById('priceTableSection').style.display = 'none'; }

// ======================== PRODUCT DRAWER ========================
function openProductDrawer(productId) {
  const p = products.find(x => Number(x.id) === Number(productId));
  if (!p) return;

  document.getElementById('drawerTitle').textContent = p.name;
  const body = document.getElementById('drawerBody');

  const prodItems = purchases.flatMap(pur => pur.items.filter(it => Number(it.productId) === Number(productId)).map(it => ({ ...it, date: pur.date, pessoaName: pur.pessoaName })));
  const totalQty = prodItems.reduce((s, it) => s + it.quantity, 0);
  const totalValue = prodItems.reduce((s, it) => s + it.totalPrice, 0);
  const uniquePessoas = [...new Set(prodItems.map(it => it.pessoaName))];

  body.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;gap:8px">
      ${p.active === false ? '<span class="badge badge-red">Inativo</span>' : '<span></span>'}
      <div style="display:flex;gap:8px">
        ${p.active === false
          ? `<button class="btn btn-sm btn-outline" onclick="reactivateProduct(${p.id})"><i data-lucide="rotate-ccw" style="width:14px;height:14px"></i> Reativar</button>`
          : `<button class="btn btn-sm btn-outline" onclick="openProductEditModal(${p.id})"><i data-lucide="edit" style="width:14px;height:14px"></i> Editar</button>
             <button class="btn btn-sm btn-outline" onclick="inactivateProduct(${p.id})"><i data-lucide="power" style="width:14px;height:14px"></i> Inativar</button>
             <button class="btn btn-sm btn-danger" onclick="deleteProduct(${p.id})"><i data-lucide="trash-2" style="width:14px;height:14px"></i> Excluir</button>`}
      </div>
    </div>
    <div class="drawer-section">
      <h4>Informa\u00e7\u00f5es Gerais</h4>
      <div class="info-grid">
        <div class="info-item"><div class="ilabel">Categoria</div><div class="ivalue"><span class="badge badge-blue">${categoryLabels[p.category] || p.category}</span></div></div>
        <div class="info-item"><div class="ilabel">Material</div><div class="ivalue">${p.material}</div></div>
        <div class="info-item"><div class="ilabel">Pre\u00e7o Atual</div><div class="ivalue price">R$ ${p.price.toFixed(2)} / ${p.weight}</div></div>
        <div class="info-item"><div class="ilabel">Total Comprado</div><div class="ivalue">${formatNumber(totalQty)} ${p.weight}</div></div>
        <div class="info-item" style="grid-column:1/-1"><div class="ilabel">Descri\u00e7\u00e3o</div><div class="ivalue">${p.description || '-'}</div></div>
        ${p.notes ? `<div class="info-item" style="grid-column:1/-1"><div class="ilabel">Observa\u00e7\u00f5es</div><div class="ivalue">${p.notes}</div></div>` : ''}
      </div>
    </div>
    <div class="drawer-section"><h4>Evolu\u00e7\u00e3o do Pre\u00e7o</h4><div class="chart-wrap tall"><canvas id="drawerPriceChart"></canvas></div></div>
    <div class="drawer-section">
      <h4>Hist\u00f3rico de Pre\u00e7os</h4>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;font-size:13px">${p.priceHistory.slice().reverse().map(h => `<div style="color:var(--text-secondary)">${h.date}</div><div style="font-weight:500;text-align:right">R$ ${h.price.toFixed(2)}</div>`).join('')}</div>
    </div>
    <div class="drawer-section">
      <h4>Hist\u00f3rico de Altera\u00e7\u00f5es</h4>
      <table style="font-size:12px"><thead><tr><th>Data</th><th>Campo</th><th>De</th><th>Para</th></tr></thead>
      <tbody>${p.changes.length ? p.changes.slice().reverse().map(c => `<tr><td class="text-muted">${c.date}</td><td>${c.field}</td><td class="text-muted">R$ ${c.from}</td><td class="font-medium">R$ ${c.to}</td></tr>`).join('') : '<tr><td colspan="4" class="empty-state"><p>Nenhuma altera\u00e7\u00e3o</p></td></tr>'}</tbody></table>
    </div>
    <div class="drawer-section">
      <h4>\u00daltimas Compras</h4>
      <table style="font-size:12px"><thead><tr><th>Data</th><th>Pessoa</th><th class="text-right">Qtd</th><th class="text-right">Total</th></tr></thead>
      <tbody>${prodItems.length ? prodItems.sort((a,b) => b.date.localeCompare(a.date)).slice(0,10).map(it => `<tr><td class="text-muted">${formatDate(it.date)}</td><td>${it.pessoaName}</td><td class="text-right">${it.quantity} ${p.weight}</td><td class="text-right font-medium">R$ ${formatNumber(it.totalPrice)}</td></tr>`).join('') : '<tr><td colspan="4" class="empty-state"><p>Nenhuma compra</p></td></tr>'}</tbody></table>
      ${uniquePessoas.length ? `<div style="margin-top:8px;font-size:12px;color:var(--text-secondary)">\u00daltimas pessoas: ${uniquePessoas.slice(0,4).join(', ')}</div>` : ''}
    </div>`;

  document.getElementById('drawerOverlay').classList.add('open');
  document.getElementById('productDrawer').classList.add('open');
  document.body.style.overflow = 'hidden';

  setTimeout(() => {
    lucide.createIcons();
    if (drawerChart) { drawerChart.destroy(); drawerChart = null; }
    const ctx = document.getElementById('drawerPriceChart');
    if (!ctx) return;
    drawerChart = new Chart(ctx, {
      type: 'line',
      data: { labels: p.priceHistory.map(h => h.date), datasets: [{ label: 'Pre\u00e7o (R$/kg)', data: p.priceHistory.map(h => h.price), borderColor: '#1F376B', backgroundColor: 'rgba(31,55,107,0.08)', fill: true, tension: 0.4, pointBackgroundColor: '#1F376B', pointRadius: 3, borderWidth: 2 }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: false, ticks: { callback: v => 'R$' + v.toFixed(2) } }, x: { grid: { display: false } } } }
    });
  }, 100);
}

function closeDrawer() {
  document.getElementById('drawerOverlay').classList.remove('open');
  document.getElementById('productDrawer').classList.remove('open');
  document.getElementById('pessoaDrawer').classList.remove('open');
  document.body.style.overflow = '';
  if (drawerChart) { drawerChart.destroy(); drawerChart = null; }
  if (pessoaDrawerChart) { pessoaDrawerChart.destroy(); pessoaDrawerChart = null; }
}

// ======================== PRODUCT EDIT/CREATE MODAL ========================
function openNewProductModal() {
  editingProductId = null;
  document.getElementById('productModalTitle').textContent = 'Novo Produto';
  ['prodFormId','prodFormName','prodFormMaterial','prodFormDesc','prodFormPrice','prodFormNotes'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('prodFormCategory').value = 'Cobre';
  document.getElementById('prodFormWeight').value = 'kg';
  document.getElementById('productModalOverlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function openProductEditModal(productId) {
  const p = products.find(x => x.id === productId);
  if (!p) return;
  editingProductId = productId;
  document.getElementById('productModalTitle').textContent = 'Editar Produto';
  document.getElementById('prodFormId').value = productId;
  document.getElementById('prodFormName').value = p.name;
  document.getElementById('prodFormCategory').value = p.category;
  document.getElementById('prodFormMaterial').value = p.material;
  document.getElementById('prodFormDesc').value = p.description;
  document.getElementById('prodFormWeight').value = p.weight;
  document.getElementById('prodFormPrice').value = p.price.toFixed(2);
  document.getElementById('prodFormNotes').value = p.notes;
  document.getElementById('productModalOverlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeProductModal() { document.getElementById('productModalOverlay').classList.remove('open'); document.body.style.overflow = ''; }

async function saveProduct() {
  const name = document.getElementById('prodFormName').value.trim();
  const category = document.getElementById('prodFormCategory').value;
  const material = document.getElementById('prodFormMaterial').value.trim();
  const desc = document.getElementById('prodFormDesc').value.trim();
  const weight = document.getElementById('prodFormWeight').value;
  const price = parseFloat(document.getElementById('prodFormPrice').value);
  const notes = document.getElementById('prodFormNotes').value.trim();

  if (!name || !material || !price || price <= 0) { await showAlert('Preencha todos os campos obrigat\u00f3rios.'); return; }

  let ok = false;

  if (editingProductId) {
    const p = products.find(x => x.id === editingProductId);
    if (!p) return;
    if (p.price !== price) {
      p.priceHistory.push({ date: new Date().toISOString().slice(0,7), price });
      p.changes.push({ date: new Date().toISOString().slice(0,10), field: 'Pre\u00e7o', from: p.price.toFixed(2), to: price.toFixed(2), user: 'Manual' });
      p.price = price;
    }
    Object.assign(p, { name, category, material, description: desc, weight, notes });
    if (usingSupabase) {
      const saved = await dbSaveProduto(p);
      if (saved) { Object.assign(p, saved); ok = true; }
      else { showNotification('Erro ao salvar produto no banco', 'error'); closeProductModal(); renderProducts(); return; }
    } else { ok = true; }
  } else {
    const newId = nextProductId++;
    const prod = { id: newId, name, category, description: desc, material, weight, price, notes, priceHistory: [{ date: new Date().toISOString().slice(0,7), price }], changes: [{ date: new Date().toISOString().slice(0,10), field: 'Cria\u00e7\u00e3o', from: '-', to: price.toFixed(2), user: 'Sistema' }] };
    if (usingSupabase) {
      const saved = await dbSaveProduto(prod);
      if (saved) { products.push(saved); await dbSetConfig('next_product_id', String(nextProductId)); ok = true; }
      else { showNotification('Erro ao salvar produto no banco', 'error'); closeProductModal(); renderProducts(); return; }
    } else {
      products.push(prod);
      ok = true;
    }
  }

  closeProductModal();
  renderProducts();
  if (ok) showNotification(editingProductId ? 'Produto atualizado com sucesso' : 'Produto cadastrado com sucesso', 'success');
}

// ======================== PESSOAS ========================
function renderPessoas() {
  const search = (document.getElementById('pessoaSearch').value || '').toLowerCase();
  let filtered = pessoas.filter(s => showInactivePessoas || s.active !== false);
  if (search) filtered = filtered.filter(s => s.name.toLowerCase().includes(search));

  document.getElementById('pessoasGrid').innerHTML = filtered.map(s => {
    const supPurchases = purchases.filter(p => p.pessoaId === s.id);
    const totalVal = supPurchases.reduce((acc, p) => acc + p.totalPrice, 0);
    const totalQty = supPurchases.reduce((acc, p) => acc + p.items.reduce((s2, it) => s2 + it.quantity, 0), 0);
    const count = supPurchases.length;
    const lastDate = count ? supPurchases.sort((a,b) => b.date.localeCompare(a.date))[0].date : '-';
    return `<div class="person-card" onclick="openPessoaDrawer(${s.id})">
      <div class="p-type pessoa">Pessoa</div>
      <div class="p-name">${s.name} ${s.active === false ? '<span class="badge badge-red">Inativo</span>' : ''}</div>
      <div class="p-stats"><span>${count} compras</span><span>${formatNumber(totalQty)} kg</span><span>R$ ${formatNumber(totalVal)}</span></div>
      <div style="margin-top:6px;font-size:11px;color:var(--text-light)">\u00daltima compra: ${lastDate !== '-' ? formatDate(lastDate) : 'Nenhuma'}</div>
    </div>`;
  }).join('') || '<div class="empty-state"><p>Nenhuma pessoa encontrada.</p></div>';
}

function filterPessoas() { renderPessoas(); }

function openPessoaDrawer(pessoaId) {
  const s = pessoas.find(x => x.id === pessoaId);
  if (!s) return;

  document.getElementById('pessoaDrawerTitle').textContent = s.name;
  const body = document.getElementById('pessoaDrawerBody');

  const supPurchases = purchases.filter(p => p.pessoaId === pessoaId).sort((a,b) => b.date.localeCompare(a.date));
  const totalVal = supPurchases.reduce((acc, p) => acc + p.totalPrice, 0);
  const totalQty = supPurchases.reduce((acc, p) => acc + p.items.reduce((s2, it) => s2 + it.quantity, 0), 0);
  const uniqueProducts = [...new Set(supPurchases.flatMap(p => p.items.map(it => it.productName)))];

  const byMonth = {};
  supPurchases.forEach(p => { const m = p.date.slice(0,7); byMonth[m] = (byMonth[m] || 0) + p.totalPrice; });
  const monthLabels = Object.keys(byMonth).sort();
  const monthValues = monthLabels.map(m => byMonth[m]);

  const addrParts = [];
  if (s.rua || s.numero) addrParts.push([s.rua, s.numero].filter(Boolean).join(', '));
  if (s.bairro) addrParts.push(s.bairro);
  if (s.cidade || s.uf) addrParts.push([s.cidade, s.uf].filter(Boolean).join(' - '));
  if (s.cep) addrParts.push(s.cep);
  const endereco = addrParts.length ? addrParts.join(' - ') : '-';

  body.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;gap:8px">
      ${s.active === false ? '<span class="badge badge-red">Inativo</span>' : '<span></span>'}
      <div style="display:flex;gap:8px">
        ${s.active === false
          ? `<button class="btn btn-sm btn-outline" onclick="reactivatePessoa(${s.id})"><i data-lucide="rotate-ccw" style="width:14px;height:14px"></i> Reativar</button>`
          : `<button class="btn btn-sm btn-outline" onclick="openPessoaEditModal(${s.id})"><i data-lucide="edit" style="width:14px;height:14px"></i> Editar</button>
             <button class="btn btn-sm btn-outline" onclick="inactivatePessoa(${s.id})"><i data-lucide="power" style="width:14px;height:14px"></i> Inativar</button>
             <button class="btn btn-sm btn-danger" onclick="deletePessoa(${s.id})"><i data-lucide="trash-2" style="width:14px;height:14px"></i> Excluir</button>`}
      </div>
    </div>
    <div class="drawer-section">
      <h4>Informa\u00e7\u00f5es</h4>
      <div class="info-grid">
        <div class="info-item" style="grid-column:1/-1"><div class="ilabel">Nome</div><div class="ivalue">${s.name}</div></div>
        <div class="info-item"><div class="ilabel">Contato</div><div class="ivalue">${s.contact || '-'}</div></div>
        <div class="info-item"><div class="ilabel">Telefone</div><div class="ivalue">${s.phone || '-'}</div></div>
        <div class="info-item" style="grid-column:1/-1"><div class="ilabel">Endere\u00e7o</div><div class="ivalue">${endereco}</div></div>
        <div class="info-item" style="grid-column:1/-1"><div class="ilabel">Observa\u00e7\u00f5es</div><div class="ivalue">${s.notes || '-'}</div></div>
      </div>
    </div>
    <div class="drawer-section">
      <h4>Resumo</h4>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:12px">
        <div style="background:var(--bg);padding:12px;border-radius:8px;text-align:center"><div style="font-size:20px;font-weight:700;color:var(--primary)">${supPurchases.length}</div><div style="font-size:11px;color:var(--text-secondary)">Compras</div></div>
        <div style="background:var(--bg);padding:12px;border-radius:8px;text-align:center"><div style="font-size:20px;font-weight:700;color:var(--primary)">${formatNumber(totalQty)} kg</div><div style="font-size:11px;color:var(--text-secondary)">Total</div></div>
        <div style="background:var(--bg);padding:12px;border-radius:8px;text-align:center"><div style="font-size:20px;font-weight:700;color:var(--primary)">R$ ${formatNumber(totalVal)}</div><div style="font-size:11px;color:var(--text-secondary)">Valor Total</div></div>
      </div>
    </div>
    ${monthLabels.length > 1 ? `<div class="drawer-section"><h4>Evolu\u00e7\u00e3o das Compras</h4><div class="chart-wrap"><canvas id="pessoaDrawerChart"></canvas></div></div>` : ''}
    <div class="drawer-section">
      <h4>Produtos</h4>
      <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px">${uniqueProducts.map(n => `<span class="badge badge-blue">${n}</span>`).join('') || '<span class="text-muted">Nenhum produto</span>'}</div>
    </div>
    <div class="drawer-section">
      <h4>\u00daltimas Compras</h4>
      <table style="font-size:12px"><thead><tr><th>Data</th><th>Produtos</th><th class="text-right">Itens</th><th class="text-right">Total</th></tr></thead>
      <tbody>${supPurchases.slice(0,15).map(p => `<tr><td class="text-muted">${formatDate(p.date)}</td><td>${p.items.map(it => it.productName).join(', ')}</td><td class="text-right">${p.items.length}</td><td class="text-right font-medium">R$ ${formatNumber(p.totalPrice)}</td></tr>`).join('')}</tbody></table>
    </div>`;

  document.getElementById('drawerOverlay').classList.add('open');
  document.getElementById('pessoaDrawer').classList.add('open');
  document.body.style.overflow = 'hidden';
  lucide.createIcons();

  if (monthLabels.length > 1) {
    setTimeout(() => {
      if (pessoaDrawerChart) { pessoaDrawerChart.destroy(); pessoaDrawerChart = null; }
      const ctx = document.getElementById('pessoaDrawerChart');
      if (!ctx) return;
      pessoaDrawerChart = new Chart(ctx, {
        type: 'line',
        data: { labels: monthLabels, datasets: [{ label: 'Valor (R$)', data: monthValues, borderColor: '#1F376B', backgroundColor: 'rgba(31,55,107,0.08)', fill: true, tension: 0.4, pointBackgroundColor: '#1F376B', pointRadius: 3, borderWidth: 2 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { callback: v => 'R$' + (v/1000).toFixed(0) + 'k' } }, x: { grid: { display: false } } } }
      });
    }, 100);
  }
}

// ======================== PESSOA MODAL ========================
function openNewPessoaModal() {
  editingPessoaId = null;
  document.getElementById('pessoaModalTitle').textContent = 'Nova Pessoa';
  document.getElementById('pessoaFormId').value = '';
  document.getElementById('pessoaFormName').value = '';
  document.getElementById('pessoaFormContact').value = '';
  document.getElementById('pessoaFormPhone').value = '';
  document.getElementById('pessoaFormCep').value = '';
  document.getElementById('pessoaFormRua').value = '';
  document.getElementById('pessoaFormNumero').value = '';
  document.getElementById('pessoaFormBairro').value = '';
  document.getElementById('pessoaFormCidade').value = '';
  document.getElementById('pessoaFormUf').value = '';
  document.getElementById('pessoaFormNotes').value = '';
  document.getElementById('pessoaModalOverlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function openPessoaEditModal(pessoaId) {
  const s = pessoas.find(x => x.id === pessoaId);
  if (!s) return;
  editingPessoaId = pessoaId;
  document.getElementById('pessoaModalTitle').textContent = 'Editar Pessoa';
  document.getElementById('pessoaFormId').value = pessoaId;
  document.getElementById('pessoaFormName').value = s.name;
  document.getElementById('pessoaFormContact').value = s.contact || '';
  document.getElementById('pessoaFormPhone').value = s.phone || '';
  document.getElementById('pessoaFormCep').value = s.cep || '';
  document.getElementById('pessoaFormRua').value = s.rua || '';
  document.getElementById('pessoaFormNumero').value = s.numero || '';
  document.getElementById('pessoaFormBairro').value = s.bairro || '';
  document.getElementById('pessoaFormCidade').value = s.cidade || '';
  document.getElementById('pessoaFormUf').value = s.uf || '';
  document.getElementById('pessoaFormNotes').value = s.notes || '';
  document.getElementById('pessoaModalOverlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closePessoaModal() { document.getElementById('pessoaModalOverlay').classList.remove('open'); document.body.style.overflow = ''; }

async function buscarCep() {
  const raw = document.getElementById('pessoaFormCep').value.replace(/\D/g, '');
  if (raw.length !== 8) { showNotification('Informe um CEP com 8 d\u00edgitos.', 'error'); return; }
  if (raw === ultimoCepBuscado) return;
  ultimoCepBuscado = raw;
  try {
    const res = await fetch('https://viacep.com.br/ws/' + raw + '/json/');
    if (!res.ok) throw new Error('http ' + res.status);
    const d = await res.json();
    if (d.erro) { showNotification('CEP n\u00e3o encontrado.', 'error'); return; }
    document.getElementById('pessoaFormRua').value = d.logradouro || '';
    document.getElementById('pessoaFormBairro').value = d.bairro || '';
    document.getElementById('pessoaFormCidade').value = d.localidade || '';
    document.getElementById('pessoaFormUf').value = d.uf || '';
    if (d.logradouro) document.getElementById('pessoaFormNumero').focus();
    showNotification('Endere\u00e7o preenchido automaticamente.', 'success');
  } catch (err) {
    showNotification('Erro ao buscar o CEP: ' + err.message, 'error');
  }
}

async function savePessoa() {
  const name = document.getElementById('pessoaFormName').value.trim();
  const contact = document.getElementById('pessoaFormContact').value.trim();
  const phone = document.getElementById('pessoaFormPhone').value.trim();
  const cep = document.getElementById('pessoaFormCep').value.trim();
  const rua = document.getElementById('pessoaFormRua').value.trim();
  const numero = document.getElementById('pessoaFormNumero').value.trim();
  const bairro = document.getElementById('pessoaFormBairro').value.trim();
  const cidade = document.getElementById('pessoaFormCidade').value.trim();
  const uf = document.getElementById('pessoaFormUf').value.trim().toUpperCase();
  const notes = document.getElementById('pessoaFormNotes').value.trim();

  if (!name) { await showAlert('Informe o nome da pessoa.'); return; }

  let ok = false;

  if (editingPessoaId) {
    const p = pessoas.find(x => x.id === editingPessoaId);
    if (!p) return;
    p.name = name; p.contact = contact; p.phone = phone; p.notes = notes;
    p.cep = cep; p.rua = rua; p.numero = numero; p.bairro = bairro; p.cidade = cidade; p.uf = uf;
    if (usingSupabase) {
      const saved = await dbSavePessoa(p);
      if (saved) { Object.assign(p, saved); ok = true; }
      else { showNotification('Erro ao salvar pessoa no banco', 'error'); closePessoaModal(); renderPessoas(); return; }
    } else { ok = true; }
  } else {
    const p = { id: nextPessoaId++, name, contact, phone, notes, cep, rua, numero, bairro, cidade, uf };
    if (usingSupabase) {
      const saved = await dbSavePessoa(p);
      if (saved) { pessoas.push(saved); await dbSetConfig('next_pessoa_id', String(nextPessoaId)); ok = true; }
      else { showNotification('Erro ao salvar pessoa no banco', 'error'); closePessoaModal(); renderPessoas(); return; }
    } else {
      pessoas.push(p);
      ok = true;
    }
  }

  closePessoaModal();
  renderPessoas();
  if (ok) showNotification(editingPessoaId ? 'Pessoa atualizada com sucesso' : 'Pessoa cadastrada com sucesso', 'success');
}

// ======================== EXCLUIR / INATIVAR ========================
function produtoTemMovimentacao(productId) {
  return purchases.some(p => p.items.some(it => Number(it.productId) === Number(productId)));
}

function pessoaTemMovimentacao(pessoaId) {
  return purchases.some(p => p.pessoaId === pessoaId);
}

async function deleteProduct(productId) {
  const p = products.find(x => x.id === productId);
  if (!p) return;
  if (produtoTemMovimentacao(productId)) {
    const ok = await showConfirm('Este produto possui movimenta\u00e7\u00e3o (compras registradas) e n\u00e3o pode ser exclu\u00eddo.\nDeseja inativ\u00e1-lo?');
    if (!ok) return;
    p.active = false;
    if (usingSupabase) {
      const saved = await dbSetProdutoActive(productId, false);
      if (!saved) { showNotification('Erro ao inativar produto no banco', 'error'); return; }
    }
    closeDrawer();
    renderProducts();
    showNotification('Produto inativado com sucesso', 'success');
    return;
  }
  const ok = await showConfirm('Excluir o produto \u201c' + p.name + '\u201d permanentemente?');
  if (!ok) return;
  if (usingSupabase) {
    const saved = await dbDeleteProduto(productId);
    if (!saved) { showNotification('Erro ao excluir produto no banco', 'error'); return; }
  }
  const idx = products.findIndex(x => x.id === productId);
  if (idx >= 0) products.splice(idx, 1);
  closeDrawer();
  renderProducts();
  showNotification('Produto exclu\u00eddo com sucesso', 'success');
}

async function reactivateProduct(productId) {
  const p = products.find(x => x.id === productId);
  if (!p) return;
  if (usingSupabase) {
    const saved = await dbSetProdutoActive(productId, true);
    if (!saved) { showNotification('Erro ao reativar produto no banco', 'error'); return; }
  }
  p.active = true;
  closeDrawer();
  renderProducts();
  showNotification('Produto reativado com sucesso', 'success');
}

async function inactivateProduct(productId) {
  const p = products.find(x => x.id === productId);
  if (!p) return;
  const ok = await showConfirm('Inativar o produto \u201c' + p.name + '\u201d?\nEle deixar\u00e1 de aparecer nas vendas, mas o hist\u00f3rico ser\u00e1 mantido.');
  if (!ok) return;
  if (usingSupabase) {
    const saved = await dbSetProdutoActive(productId, false);
    if (!saved) { showNotification('Erro ao inativar produto no banco', 'error'); return; }
  }
  p.active = false;
  closeDrawer();
  renderProducts();
  showNotification('Produto inativado com sucesso', 'success');
}

async function deletePessoa(pessoaId) {
  const s = pessoas.find(x => x.id === pessoaId);
  if (!s) return;
  if (pessoaTemMovimentacao(pessoaId)) {
    const ok = await showConfirm('Esta pessoa possui movimenta\u00e7\u00e3o (compras registradas) e n\u00e3o pode ser exclu\u00edda.\nDeseja inativ\u00e1-la?');
    if (!ok) return;
    s.active = false;
    if (usingSupabase) {
      const saved = await dbSetPessoaActive(pessoaId, false);
      if (!saved) { showNotification('Erro ao inativar pessoa no banco', 'error'); return; }
    }
    closeDrawer();
    renderPessoas();
    showNotification('Pessoa inativada com sucesso', 'success');
    return;
  }
  const ok = await showConfirm('Excluir a pessoa \u201c' + s.name + '\u201d permanentemente?');
  if (!ok) return;
  if (usingSupabase) {
    const saved = await dbDeletePessoa(pessoaId);
    if (!saved) { showNotification('Erro ao excluir pessoa no banco', 'error'); return; }
  }
  const idx = pessoas.findIndex(x => x.id === pessoaId);
  if (idx >= 0) pessoas.splice(idx, 1);
  closeDrawer();
  renderPessoas();
  showNotification('Pessoa exclu\u00edda com sucesso', 'success');
}

async function reactivatePessoa(pessoaId) {
  const s = pessoas.find(x => x.id === pessoaId);
  if (!s) return;
  if (usingSupabase) {
    const saved = await dbSetPessoaActive(pessoaId, true);
    if (!saved) { showNotification('Erro ao reativar pessoa no banco', 'error'); return; }
  }
  s.active = true;
  closeDrawer();
  renderPessoas();
  showNotification('Pessoa reativada com sucesso', 'success');
}

async function inactivatePessoa(pessoaId) {
  const s = pessoas.find(x => x.id === pessoaId);
  if (!s) return;
  const ok = await showConfirm('Inativar a pessoa \u201c' + s.name + '\u201d?\nEla deixar\u00e1 de aparecer nas vendas, mas o hist\u00f3rico ser\u00e1 mantido.');
  if (!ok) return;
  if (usingSupabase) {
    const saved = await dbSetPessoaActive(pessoaId, false);
    if (!saved) { showNotification('Erro ao inativar pessoa no banco', 'error'); return; }
  }
  s.active = false;
  closeDrawer();
  renderPessoas();
  showNotification('Pessoa inativada com sucesso', 'success');
}

function toggleInactiveProducts() {
  showInactiveProducts = !showInactiveProducts;
  const btn = document.getElementById('btnShowInactiveProducts');
  if (btn) {
    btn.classList.toggle('active', showInactiveProducts);
    btn.innerHTML = showInactiveProducts
      ? '<i data-lucide="eye-off" style="width:14px;height:14px"></i> Mostrando inativos'
      : '<i data-lucide="eye" style="width:14px;height:14px"></i> Mostrar inativos';
    lucide.createIcons();
  }
  renderProducts();
}

function toggleInactivePessoas() {
  showInactivePessoas = !showInactivePessoas;
  const btn = document.getElementById('btnShowInactivePessoas');
  if (btn) {
    btn.classList.toggle('active', showInactivePessoas);
    btn.innerHTML = showInactivePessoas
      ? '<i data-lucide="eye-off" style="width:14px;height:14px"></i> Mostrando inativos'
      : '<i data-lucide="eye" style="width:14px;height:14px"></i> Mostrar inativos';
    lucide.createIcons();
  }
  renderPessoas();
}

// ======================== COMPRAS ========================
let purchasePage = 1;
let purchaseSort = 'recentes';
const PURCHASES_PER_PAGE = 15;

function renderPurchases() {
  const search = (document.getElementById('compraSearch').value || '').toLowerCase();
  const startDate = document.getElementById('compraPeriodStart').value;
  const endDate = document.getElementById('compraPeriodEnd').value;
  let filtered = [...purchases];

  filtered.sort((a, b) => {
    const cmp = a.date.localeCompare(b.date) || a.id - b.id;
    return purchaseSort === 'recentes' ? -cmp : cmp;
  });

  if (search) {
    filtered = filtered.filter(p =>
      (p.pessoaName && p.pessoaName.toLowerCase().includes(search)) ||
      p.items.some(it => it.productName.toLowerCase().includes(search)) ||
      (p.notes || '').toLowerCase().includes(search)
    );
  }
  if (startDate) filtered = filtered.filter(p => p.date >= startDate);
  if (endDate) filtered = filtered.filter(p => p.date <= endDate);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PURCHASES_PER_PAGE));
  if (purchasePage > totalPages) purchasePage = totalPages;
  const start = (purchasePage - 1) * PURCHASES_PER_PAGE;
  const page = filtered.slice(start, start + PURCHASES_PER_PAGE);

  document.getElementById('purchasesTableBody').innerHTML = page.map(p => {
    const prodList = p.items.map(it => it.productName).join(', ');
    const expandId = 'purchase-detail-' + p.id;
    const cancelInfo = getCompraCancelamento(p.id);
    const isCanc = !!cancelInfo;
    return `<tr class="tr-clickable${isCanc ? ' row-canceled' : ''}" onclick="togglePurchaseExpand('${expandId}')">
      <td class="text-muted">${formatDate(p.date)}</td>
      <td>${p.paymentMethod === 'pix' ? '<span class="badge badge-pix">Pix</span>' : '<span class="badge badge-dinheiro">Dinheiro</span>'}${isCanc ? '<span class="badge badge-red">Cancelado</span>' : ''}</td>
      <td class="text-muted">${p.pessoaName || '-'}</td>
      <td class="text-right">${p.items.length}</td>
      <td class="truncate">${prodList}</td>
      <td class="text-right font-semibold text-primary"><span class="${isCanc ? 'value-canceled' : ''}">R$ ${formatNumber(p.totalPrice)}</span></td>
      <td class="text-right">
        <div style="display:inline-flex;gap:4px">
          <button class="btn btn-sm btn-ghost" title="Visualizar documento" onclick="event.stopPropagation();verCompraDoc(${p.id})">
            <i data-lucide="eye" style="width:14px;height:14px"></i>
          </button>
          <button class="btn btn-sm btn-ghost" title="Imprimir comprovante" onclick="event.stopPropagation();imprimirCompraDoc(${p.id})">
            <i data-lucide="printer" style="width:14px;height:14px"></i>
          </button>
          <button class="btn btn-sm btn-ghost" style="color:var(--danger)" title="Cancelar documento" onclick="event.stopPropagation();cancelarCompra(${p.id})" ${isCanc ? 'disabled' : ''}>
            <i data-lucide="ban" style="width:14px;height:14px"></i>
          </button>
        </div>
      </td>
    </tr>
    <tr class="purchase-expand" id="${expandId}">
      <td colspan="7">
        <div class="purchase-expand-inner">
          <div class="pe-title">Itens da Compra</div>
          ${cancelInfo ? `<div class="cancel-info"><strong>Cancelado por:</strong> ${esc(cancelInfo.canceladoPor || '-')} em ${cancelInfo.canceladoEm ? new Date(cancelInfo.canceladoEm).toLocaleString('pt-BR') : '-'}<br><strong>Motivo:</strong> ${esc(cancelInfo.motivo)}</div>` : ''}
          <table>
            <thead><tr><th>Produto</th><th class="text-right">Qtd (kg)</th><th class="text-right">R$/kg</th><th class="text-right">Total</th></tr></thead>
            <tbody>${p.items.map(it => `
              <tr><td>${it.productName}</td><td class="text-right">${it.quantity}</td><td class="text-right">R$ ${it.unitPrice.toFixed(2)}</td><td class="text-right font-medium">R$ ${formatNumber(it.totalPrice)}</td></tr>
            `).join('')}</tbody>
          </table>
          ${p.notes ? `<div style="margin-top:8px;font-size:12px;color:var(--text-secondary)">Obs: ${p.notes}</div>` : ''}
        </div>
      </td>
    </tr>`;
  }).join('');

  renderPagination(totalPages);
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

function setPurchaseSort(val) {
  purchaseSort = (val === 'antigas') ? 'antigas' : 'recentes';
  purchasePage = 1;
  renderPurchases();
}

function renderPagination(totalPages) {
  const container = document.getElementById('purchasesPagination');
  if (!container) return;
  if (totalPages <= 1) { container.innerHTML = ''; return; }

  let html = '';
  html += `<button class="page-btn" onclick="goPurchasePage(${purchasePage - 1})" ${purchasePage <= 1 ? 'disabled' : ''}><i data-lucide="chevron-left" style="width:14px;height:14px"></i></button>`;

  const maxVisible = 5;
  let s = Math.max(1, purchasePage - Math.floor(maxVisible / 2));
  let e = Math.min(totalPages, s + maxVisible - 1);
  if (e - s + 1 < maxVisible) s = Math.max(1, e - maxVisible + 1);

  if (s > 1) { html += `<button class="page-btn" onclick="goPurchasePage(1)">1</button>`; if (s > 2) html += `<span class="page-info">...</span>`; }
  for (let i = s; i <= e; i++) html += `<button class="page-btn ${i === purchasePage ? 'active' : ''}" onclick="goPurchasePage(${i})">${i}</button>`;
  if (e < totalPages) { if (e < totalPages - 1) html += `<span class="page-info">...</span>`; html += `<button class="page-btn" onclick="goPurchasePage(${totalPages})">${totalPages}</button>`; }

  html += `<button class="page-btn" onclick="goPurchasePage(${purchasePage + 1})" ${purchasePage >= totalPages ? 'disabled' : ''}><i data-lucide="chevron-right" style="width:14px;height:14px"></i></button>`;

  container.innerHTML = html;
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

function goPurchasePage(n) {
  purchasePage = n;
  renderPurchases();
}

function applyPurchaseFilters() {
  purchasePage = 1;
  renderPurchases();
}

function togglePurchaseExpand(id) {
  const el = document.getElementById(id);
  if (el) el.classList.toggle('open');
}

function filterPurchases() { purchasePage = 1; renderPurchases(); }

// ======================== CANCELAMENTO DE DOCUMENTO ========================
let cancelCompraId = null;

function cancelarCompra(id) {
  const p = purchases.find(x => x.id === id);
  if (!p) return;
  if (isCompraCancelada(id)) { showNotification('Este documento j\u00e1 foi cancelado', 'error'); return; }
  const dataHoje = hoje();
  const sessaoAtiva = getSessaoAberta(dataHoje);
  if (!sessaoAtiva) {
    showAlert('Para cancelar, \u00e9 necess\u00e1rio ter um caixa aberto hoje. O valor devolvido ser\u00e1 registrado no caixa corrente, independentemente da data da compra.');
    return;
  }
  cancelCompraId = id;
  document.getElementById('cancelCompraId').textContent = 'Compra #' + p.id;
  document.getElementById('cancelCompraInfo').innerHTML = `
    <table class="cancel-compra-table">
      <tr><td class="k">Data da compra</td><td>${formatDate(p.date)}</td></tr>
      <tr><td class="k">Pessoa</td><td>${esc(p.pessoaName || '-')}</td></tr>
      <tr><td class="k">Pagamento original</td><td>${p.paymentMethod === 'pix' ? 'Pix' : 'Dinheiro'}</td></tr>
      <tr><td class="k">Valor</td><td>R$ ${formatNumber(p.totalPrice)}</td></tr>
      <tr><td class="k">Estorno no caixa</td><td>Hoje &middot; ${formatDate(dataHoje)} (${esc(sessaoAtiva.periodo)})</td></tr>
    </table>`;
  document.getElementById('cancelUserInfo').innerHTML = '<strong>Cancelado por:</strong> ' + esc(currentUserEmail || 'Usu\u00e1rio');
  document.getElementById('cancelMotivo').value = '';
  setCancelDevolucaoMetodo(p.paymentMethod === 'pix' ? 'pix' : 'dinheiro');
  document.getElementById('cancelDevolucaoValor').value = p.totalPrice.toFixed(2).replace('.', ',');
  document.getElementById('cancelModalOverlay').classList.add('open');
  document.body.style.overflow = 'hidden';
  setTimeout(() => document.getElementById('cancelMotivo').focus(), 100);
  lucide.createIcons();
}

function setCancelDevolucaoMetodo(method) {
  const overlay = document.getElementById('cancelModalOverlay');
  overlay.querySelectorAll('.payment-option').forEach(el => el.classList.toggle('active', el.dataset.method === method));
  const info = document.getElementById('cancelDevolucaoInfo');
  if (info) {
    info.innerHTML = method === 'pix'
      ? '<i data-lucide="info" style="width:12px;height:12px;vertical-align:middle"></i> O valor devolvido volta para o total de Pix do caixa de hoje.'
      : '<i data-lucide="info" style="width:12px;height:12px;vertical-align:middle"></i> O valor devolvido entra como dinheiro no caixa de hoje.';
  }
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

function closeCancelModal() {
  document.getElementById('cancelModalOverlay').classList.remove('open');
  document.body.style.overflow = '';
}

async function confirmCancelamento() {
  const id = cancelCompraId;
  const p = purchases.find(x => x.id === id);
  if (!p) return;
  if (isCompraCancelada(id)) { closeCancelModal(); return; }
  const motivo = document.getElementById('cancelMotivo').value.trim();
  if (!motivo) { showNotification('Informe a justificativa para cancelar o documento', 'error'); return; }
  const metodoDevolucao = document.querySelector('#cancelModalOverlay .payment-option.active')?.dataset?.method || 'dinheiro';
  const rawValor = document.getElementById('cancelDevolucaoValor').value.trim();
  const valor = parseFloat(String(rawValor).replace(',', '.').replace(/[^\d.,]/g, ''));
  if (isNaN(valor) || valor <= 0) { showNotification('Informe o valor devolvido ao cliente (maior que zero)', 'error'); return; }
  const valorEstornado = Math.round(valor * 100) / 100;
  if (valorEstornado > p.totalPrice) { showNotification('O valor devolvido n\u00e3o pode ser maior que o total da compra', 'error'); return; }
  const dataHoje = hoje();
  const sessaoAtiva = getSessaoAberta(dataHoje);
  if (!sessaoAtiva) { showNotification('N\u00e3o h\u00e1 caixa aberto para registrar o estorno', 'error'); return; }
  const rec = {
    compraId: id, motivo, canceladoPor: currentUserEmail || 'Usu\u00e1rio',
    metodoDevolucao, valorEstornado, caixaDate: dataHoje, caixaSessionId: sessaoAtiva.id,
  };
  if (usingSupabase) {
    const saved = await dbSaveCancelamento(rec);
    if (!saved) { showNotification('Erro ao salvar o cancelamento no banco', 'error'); return; }
    cancelamentos[id] = saved;
  } else {
    cancelamentos[id] = {
      compraId: id, motivo, canceladoPor: rec.canceladoPor, canceladoEm: new Date().toISOString(),
      metodoDevolucao, valorEstornado, caixaDate: dataHoje, caixaSessionId: sessaoAtiva.id,
    };
  }
  cancelCompraId = null;
  closeCancelModal();
  if (currentModule === 'compras') renderPurchases();
  if (currentModule === 'caixa') renderCaixa();
  if (currentModule === 'dashboard') renderDashboard();
  if (currentModule === 'relatorios') renderReports();
  showNotification('Documento #' + id + ' cancelado com sucesso. Estorno de R$ ' + formatNumber(valorEstornado) + ' registrado no caixa de hoje (' + (metodoDevolucao === 'pix' ? 'Pix' : 'Dinheiro') + ').', 'success');
}

// ======================== PDV ITEMS ========================
function addPdvRow() {
  const container = document.getElementById('pdvRows');
  const rowId = 'pdv-row-' + (++pdvRowCount);
  const row = document.createElement('div');
  row.className = 'pdv-item-row';
  row.id = rowId;
  row.innerHTML = `
    <div class="pdv-prod">
      <div class="prod-combo" data-row="${rowId}">
        <input type="text" class="prod-combo-input" placeholder="Buscar produto..." autocomplete="off" data-row="${rowId}" data-prod-id="" oninput="prodComboInput(this)" onfocus="prodComboOpen(this)" onkeydown="prodComboKeydown(event, this)">
        <div class="prod-combo-dropdown" data-row="${rowId}"></div>
      </div>
    </div>
    <div class="pdv-qty"><input type="number" step="0.1" min="0" placeholder="0,0" oninput="pdvCalcRow('${rowId}')" data-row="${rowId}"></div>
    <div class="pdv-price"><input type="number" step="0.01" min="0" placeholder="0,00" oninput="pdvCalcRow('${rowId}')" data-row="${rowId}"></div>
    <div class="pdv-surcharge" id="${rowId}-surcharge"></div>
    <div class="pdv-total" id="${rowId}-total">R$ 0,00</div>
    <div><button class="pdv-remove" onclick="pdvRemoveRow('${rowId}')" title="Remover"><i data-lucide="x" style="width:14px;height:14px"></i></button></div>
  `;
  container.appendChild(row);
  lucide.createIcons();
}

function pdvCalcRow(rowId) {
  const row = document.getElementById(rowId);
  if (!row) return;
  const qty = parseFloat(row.querySelector('.pdv-qty input').value) || 0;
  const price = parseFloat(row.querySelector('.pdv-price input').value) || 0;
  const eff = getEffectivePrice(price, qty);
  const total = qty * eff;
  document.getElementById(rowId + '-total').textContent = 'R$ ' + total.toFixed(2).replace('.', ',');
  const surchargeEl = document.getElementById(rowId + '-surcharge');
  if (isPricingRuleActive() && qty > 0 && qty < 100) {
    const extra = 0.5;
    surchargeEl.innerHTML = '<span class="surcharge-badge">+R$ 0,50/kg</span>';
    surchargeEl.title = 'Acr\u00e9scimo de R$ 0,50/kg aplicado (qty < 100kg)';
  } else {
    surchargeEl.innerHTML = '';
  }
  pdvCalcGrandTotal();
}

function pdvCalcGrandTotal() {
  let grandTotal = 0;
  document.querySelectorAll('.pdv-item-row').forEach(row => {
    const qty = parseFloat(row.querySelector('.pdv-qty input').value) || 0;
    const price = parseFloat(row.querySelector('.pdv-price input').value) || 0;
    grandTotal += qty * getEffectivePrice(price, qty);
  });
  document.getElementById('pdvGrandTotal').textContent = 'R$ ' + grandTotal.toFixed(2).replace('.', ',');
}

function pdvRemoveRow(rowId) {
  const row = document.getElementById(rowId);
  if (row) row.remove();
  pdvCalcGrandTotal();
}

// ======================== PRODUTO COMBO (busca) ========================
function prodComboMatches(input) {
  const q = (input.value || '').trim().toLowerCase();
  return products.filter(p => p.active !== false).filter(p => !q || p.name.toLowerCase().includes(q));
}

function prodComboRender(input) {
  const rowId = input.dataset.row;
  const dd = document.querySelector('#' + rowId + ' .prod-combo-dropdown');
  if (!dd) return;
  const matches = prodComboMatches(input);
  prodComboItems = matches;
  prodComboHighlight = -1;
  dd.innerHTML = prodComboItems.map(p => `
    <div class="prod-combo-item" onclick="prodComboSelect('${rowId}', ${p.id})">
      <div class="prod-combo-item-name">${p.name}</div>
      <div class="prod-combo-item-meta">
        <span class="prod-combo-cat">${p.category || 'Sem categoria'}</span>
        <span class="prod-combo-price">R$ ${formatNumber(p.price)}/kg</span>
      </div>
    </div>`).join('') +
    `<div class="prod-combo-footer">${matches.length ? matches.length + ' produto' + (matches.length === 1 ? '' : 's') + ' cadastrado' + (matches.length === 1 ? '' : 's') : 'Nenhum produto encontrado'}</div>`;
  dd.classList.add('open');
}

function prodComboOpen(input) { prodComboRender(input); }

function prodComboInput(input) {
  const rowId = input.dataset.row;
  const row = document.getElementById(rowId);
  const prodId = input.dataset.prodId;
  if (prodId) {
    const p = products.find(x => x.id === parseInt(prodId));
    if (!p || p.name !== (input.value || '').trim()) {
      input.dataset.prodId = '';
      const priceInput = row.querySelector('.pdv-price input');
      if (priceInput) priceInput.value = '';
      pdvCalcRow(rowId);
    }
  }
  prodComboRender(input);
}

function prodComboSelect(rowId, id) {
  const input = document.querySelector('#' + rowId + ' .prod-combo-input');
  const dd = document.querySelector('#' + rowId + ' .prod-combo-dropdown');
  const row = document.getElementById(rowId);
  const p = products.find(x => x.id === id);
  if (!input || !p) return;
  input.value = p.name;
  input.dataset.prodId = String(id);
  row.querySelector('.pdv-price input').value = p.price;
  dd.classList.remove('open');
  prodComboHighlight = -1;
  row.querySelector('.pdv-qty input').focus();
  pdvCalcRow(rowId);
}

function prodComboHighlightItems(rowId) {
  const items = document.querySelectorAll('#' + rowId + ' .prod-combo-item');
  items.forEach((el, i) => el.classList.toggle('active', i === prodComboHighlight));
  if (prodComboHighlight >= 0 && items[prodComboHighlight]) items[prodComboHighlight].scrollIntoView({ block: 'nearest' });
}

function prodComboKeydown(e, input) {
  const rowId = input.dataset.row;
  const dd = document.querySelector('#' + rowId + ' .prod-combo-dropdown');
  if (!dd.classList.contains('open')) {
    if (e.key === 'ArrowDown') { e.preventDefault(); prodComboRender(input); }
    return;
  }
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    prodComboHighlight = Math.min(prodComboHighlight + 1, prodComboItems.length - 1);
    prodComboHighlightItems(rowId);
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    prodComboHighlight = Math.max(prodComboHighlight - 1, -1);
    prodComboHighlightItems(rowId);
  } else if (e.key === 'Enter') {
    if (prodComboHighlight >= 0 && prodComboItems[prodComboHighlight]) {
      e.preventDefault();
      prodComboSelect(rowId, prodComboItems[prodComboHighlight].id);
    }
  } else if (e.key === 'Escape') {
    dd.classList.remove('open');
    prodComboHighlight = -1;
  }
}


// ======================== PURCHASE MODAL ========================
async function openNewPurchase() {
  const hojeStr = new Date().toISOString().split('T')[0];
  const sessaoAtiva = getSessaoAberta(hojeStr);
  if (!sessaoAtiva) {
    const ir = await showConfirm('N\u00e3o h\u00e1 caixa aberto hoje. Deseja ir para o m\u00f3dulo Caixa para abrir uma sess\u00e3o?', 'Sim', 'Cancelar');
    if (ir) navigateTo('caixa');
    return;
  }

  const dd = document.getElementById('pessoaComboDropdown');
  if (dd) dd.classList.remove('open');
  document.getElementById('purchasePessoa').value = '';
  document.getElementById('pessoaComboClear').style.display = 'none';
  document.getElementById('purchaseNotes').value = '';
  document.getElementById('pdvRows').innerHTML = '';
  document.getElementById('pdvGrandTotal').textContent = 'R$ 0,00';
  pdvRowCount = 0;
  addPdvRow();

  // Reset payment toggle to Dinheiro
  setPayment('dinheiro');

  document.getElementById('purchaseModalOverlay').classList.add('open');
  document.body.style.overflow = 'hidden';
  setTimeout(() => lucide.createIcons(), 50);
}

function closePurchaseModal() { document.getElementById('purchaseModalOverlay').classList.remove('open'); document.body.style.overflow = ''; }

// ======================== PESSOA COMBO (busca) ========================
function pessoaComboMatches() {
  const q = document.getElementById('purchasePessoa').value.trim().toLowerCase();
  return pessoas.filter(s => s.active !== false).filter(s => !q || s.name.toLowerCase().includes(q));
}

function renderPessoaCombo() {
  const dd = document.getElementById('pessoaComboDropdown');
  if (!dd) return;
  const matches = pessoaComboMatches();
  pessoaComboItems = matches.slice(0, 8);
  pessoaComboHighlight = -1;
  dd.innerHTML = pessoaComboItems.map(s => `
    <div class="pessoa-combo-item" onclick="selectPessoaCombo(${s.id})">
      <div class="pessoa-combo-item-name">${s.name}</div>
      ${[s.bairro, s.cidade, s.uf].filter(Boolean).length ? `<div class="pessoa-combo-item-sub">${[s.bairro, s.cidade, s.uf].filter(Boolean).join(' - ')}</div>` : ''}
    </div>`).join('') +
    `<div class="pessoa-combo-footer">${matches.length ? matches.length + ' pessoa' + (matches.length === 1 ? '' : 's') + ' cadastrada' + (matches.length === 1 ? '' : 's') : 'Nenhuma pessoa encontrada'}</div>`;
  dd.classList.add('open');
}

function openPessoaCombo() { renderPessoaCombo(); }

function filterPessoaCombo() {
  document.getElementById('pessoaComboClear').style.display = document.getElementById('purchasePessoa').value ? 'inline-flex' : 'none';
  renderPessoaCombo();
}

function clearPessoaCombo() {
  document.getElementById('purchasePessoa').value = '';
  document.getElementById('pessoaComboClear').style.display = 'none';
  renderPessoaCombo();
  document.getElementById('purchasePessoa').focus();
}

function selectPessoaCombo(id) {
  const p = pessoas.find(s => s.id === id);
  if (!p) return;
  document.getElementById('purchasePessoa').value = p.name;
  document.getElementById('pessoaComboClear').style.display = 'inline-flex';
  document.getElementById('pessoaComboDropdown').classList.remove('open');
  pessoaComboHighlight = -1;
  const firstRow = document.querySelector('#pdvRows .prod-combo-input');
  if (firstRow) firstRow.focus();
}

function highlightPessoaCombo() {
  const items = document.querySelectorAll('.pessoa-combo-item');
  items.forEach((el, i) => el.classList.toggle('active', i === pessoaComboHighlight));
  if (pessoaComboHighlight >= 0 && items[pessoaComboHighlight]) items[pessoaComboHighlight].scrollIntoView({ block: 'nearest' });
}

function pessoaComboKeydown(e) {
  const dd = document.getElementById('pessoaComboDropdown');
  if (!dd.classList.contains('open')) {
    if (e.key === 'ArrowDown') { e.preventDefault(); renderPessoaCombo(); }
    return;
  }
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    pessoaComboHighlight = Math.min(pessoaComboHighlight + 1, pessoaComboItems.length - 1);
    highlightPessoaCombo();
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    pessoaComboHighlight = Math.max(pessoaComboHighlight - 1, -1);
    highlightPessoaCombo();
  } else if (e.key === 'Enter') {
    if (pessoaComboHighlight >= 0 && pessoaComboItems[pessoaComboHighlight]) {
      e.preventDefault();
      selectPessoaCombo(pessoaComboItems[pessoaComboHighlight].id);
    }
  } else if (e.key === 'Escape') {
    dd.classList.remove('open');
    pessoaComboHighlight = -1;
  }
}

document.addEventListener('click', function (e) {
  const inPessoa = e.target.closest ? e.target.closest('.pessoa-combo') : null;
  if (!inPessoa) {
    const dd = document.getElementById('pessoaComboDropdown');
    if (dd) dd.classList.remove('open');
    pessoaComboHighlight = -1;
  }
  const inProd = e.target.closest ? e.target.closest('.prod-combo') : null;
  if (!inProd) {
    document.querySelectorAll('.prod-combo-dropdown').forEach(d => d.classList.remove('open'));
    prodComboHighlight = -1;
  }
});


function setPayment(method) {
  document.querySelectorAll('#purchaseModalOverlay .payment-option').forEach(el => el.classList.toggle('active', el.dataset.method === method));
  document.getElementById('paymentInfo').style.display = method === 'pix' ? 'block' : 'none';
}

async function savePurchase() {
  const pessoaName = document.getElementById('purchasePessoa').value.trim();
  const notes = document.getElementById('purchaseNotes').value.trim();

  const rows = document.querySelectorAll('.pdv-item-row');
  const items = [];
  rows.forEach(row => {
    const prodInput = row.querySelector('.pdv-prod .prod-combo-input');
    const qty = parseFloat(row.querySelector('.pdv-qty input').value);
    const price = parseFloat(row.querySelector('.pdv-price input').value);
    const prodId = prodInput ? parseInt(prodInput.dataset.prodId) : 0;
    if (!prodId || !qty || qty <= 0 || !price || price <= 0) return;
    const prod = products.find(p => p.id === prodId);
    if (!prod) return;
    const eff = getEffectivePrice(price, qty);
    items.push({
      productId: prod.id, productName: prod.name, category: prod.category,
      quantity: qty, unitPrice: eff, totalPrice: Math.round(qty * eff * 100) / 100,
    });
  });

  if (!items.length) { await showAlert('Adicione pelo menos um produto v\u00e1lido.'); return; }

  let pessoaId = null;
  if (pessoaName) {
    let p = pessoas.find(s => s.name === pessoaName);
    if (!p) {
      const cadastrar = await showConfirm('"' + pessoaName + '" n\u00e3o est\u00e1 cadastrado. Deseja cadastrar automaticamente para manter o hist\u00f3rico?', 'Sim', 'N\u00e3o');
      if (cadastrar) {
        p = { id: nextPessoaId++, name: pessoaName, contact: '', phone: '', notes: '', cep: '', rua: '', numero: '', bairro: '', cidade: '', uf: '' };
        if (usingSupabase) {
          const saved = await dbSavePessoa(p);
          if (saved) { pessoas.push(saved); await dbSetConfig('next_pessoa_id', String(nextPessoaId)); }
          else { showNotification('Erro ao salvar pessoa no banco', 'error'); return; }
        } else {
          pessoas.push(p);
        }
      } else {
        p = null;
      }
    }
    pessoaId = p ? p.id : null;
  }

  const totalPrice = items.reduce((s, it) => s + it.totalPrice, 0);
  const hojeStr = new Date().toISOString().slice(0,10);
  const paymentMethod = document.querySelector('#purchaseModalOverlay .payment-option.active')?.dataset?.method || 'dinheiro';
  const sessaoAtiva = getSessaoAberta(hojeStr);
  const purchase = {
    id: nextPurchaseId++, date: hojeStr,
    caixaDate: sessaoAtiva ? hojeStr : null,
    caixaSessionId: sessaoAtiva ? sessaoAtiva.id : null,
    pessoaId, pessoaName: pessoaName || '',
    paymentMethod, items, totalPrice: Math.round(totalPrice * 100) / 100, notes,
  };

  // Sync to Supabase
  if (usingSupabase) {
    const saved = await dbSaveCompra(purchase);
    if (!saved) {
      nextPurchaseId--; // rollback
      showNotification('Erro ao salvar compra no banco', 'error');
      return;
    }
    await dbSetConfig('next_purchase_id', String(nextPurchaseId));
  }

  purchases.unshift(purchase);

  // Update product histories
  items.forEach(it => {
    const prod = products.find(p => p.id === it.productId);
    if (prod) {
      prod.priceHistory.push({ date: new Date().toISOString().slice(0,7), price: it.unitPrice });
      prod.changes.push({ date: new Date().toISOString().slice(0,10), field: 'Pre\u00e7o (compra)', from: prod.price.toFixed(2), to: it.unitPrice.toFixed(2), user: 'Compra #' + purchase.id });
    }
  });

  closePurchaseModal();
  if (currentModule === 'compras') renderPurchases();
  if (currentModule === 'caixa') renderCaixa();
  if (currentModule === 'dashboard') renderDashboard();
  showNotification('Compra registrada com sucesso', 'success');
  const prefs = (typeof getPrintPrefs === 'function') ? getPrintPrefs() : { format: 'bobina', direct: false };
  if (prefs.direct) imprimirDocumento(purchase, prefs.format);
  else openPrintModal(purchase, { afterSave: true });
}

// ======================== CAIXA ========================
let sessoesLoaded = {};
let sessoesLoading = {};
let todasSessoesCarregadas = false;
let caixaHistoricoAberto = false;
let caixaCurrentData = null;
let caixaCurrentSessionId = null;

async function carregarSessoes(data) {
  if (sessoesLoaded[data]) return;
  if (sessoesLoading[data]) return sessoesLoading[data];
  sessoesLoading[data] = (async () => {
    if (!usingSupabase) return;
    caixaStore[data] = await dbFetchSessoes(data);
    sessoesLoaded[data] = true;
    delete sessoesLoading[data];
  })();
  return sessoesLoading[data];
}

async function carregarTodasSessoes() {
  if (!usingSupabase) return;
  if (todasSessoesCarregadas) return;
  const todas = await dbFetchAllSessoes();
  const grouped = {};
  for (const s of todas) {
    if (!grouped[s.date]) grouped[s.date] = [];
    grouped[s.date].push(s);
  }
  Object.keys(grouped).forEach(d => { caixaStore[d] = grouped[d]; sessoesLoaded[d] = true; });
  todasSessoesCarregadas = true;
}

async function salvarCaixaStore() {
  if (!usingSupabase) {
    localStorage.setItem('compvision_caixa_diario', JSON.stringify(caixaStore));
    return true;
  }
  let ok = true;
  for (const data of Object.keys(caixaStore)) {
    for (const s of caixaStore[data]) {
      const r = await dbSaveSessao(s, data);
      if (!r) ok = false;
    }
  }
  return ok;
}

function hoje() {
  return new Date().toISOString().slice(0,10);
}

function getSessoes(data) {
  return caixaStore[data] || [];
}

function getSessaoAberta(data) {
  return getSessoes(data).find(s => s.status === 'aberto') || null;
}

function getSessao(data, sessionId) {
  return getSessoes(data).find(s => s.id === sessionId) || null;
}

function compraPertenceSessao(p, data, sessionId) {
  if (p.caixaDate != null && p.caixaSessionId != null) {
    return p.caixaDate === data && p.caixaSessionId === sessionId;
  }
  // Compras legadas sem v\u00ednculo expl\u00edcito: atribui pela data quando h\u00e1 apenas uma sess\u00e3o no dia
  const sessoes = getSessoes(data);
  if (sessoes.length === 1) return p.date === data && sessoes[0].id === sessionId;
  return false;
}

function getComprasDaSessao(data, sessionId) {
  return purchases.filter(p => compraPertenceSessao(p, data, sessionId)).sort((a, b) => a.id - b.id);
}

function getPixComprasDaSessao(data, sessionId) {
  return getComprasDaSessao(data, sessionId).filter(p => p.paymentMethod === 'pix' && !isCompraCancelada(p.id));
}

function getEstornosDaSessao(data, sessionId) {
  if (sessionId == null) return [];
  return Object.values(cancelamentos).filter(c => c.caixaDate === data && c.caixaSessionId === sessionId);
}

function getTotalEstornosMetodo(data, sessionId, metodo) {
  return getEstornosDaSessao(data, sessionId)
    .filter(c => (c.metodoDevolucao || 'dinheiro') === metodo)
    .reduce((s, c) => s + (Number(c.valorEstornado) || 0), 0);
}

function getTotalSuprimentos(sessao) {
  if (!sessao || !sessao.suprimentos) return 0;
  return sessao.suprimentos.reduce((s, x) => s + x.amount, 0);
}

function getProximoIdSessao(data) {
  const sessoes = getSessoes(data);
  return sessoes.length > 0 ? Math.max(...sessoes.map(s => s.id)) + 1 : 0;
}

function detectarPeriodo() {
  const h = new Date().getHours();
  if (h < 12) return 'Integral';
  if (h < 18) return 'Tarde';
  return 'Noite';
}

async function abrirNovaSessao() {
  const data = hoje();
  const aberta = getSessaoAberta(data);
  if (aberta) {
    await showAlert('J\u00e1 existe uma sess\u00e3o aberta para hoje ("' + aberta.periodo + '"). Feche-a antes de abrir outra.');
    return;
  }
  const periodo = detectarPeriodo();
  document.getElementById('sessaoPeriodoText').textContent = periodo;
  const defAbertura = parseFloat(appConfig.caixa_default_abertura);
  document.getElementById('sessaoAbertura').value = (isNaN(defAbertura) ? 0 : defAbertura).toFixed(2).replace('.', ',');
  document.getElementById('novaSessaoModalOverlay').classList.add('open');
  document.body.style.overflow = 'hidden';
  setTimeout(() => document.getElementById('sessaoAbertura').focus(), 100);
  lucide.createIcons();
}

function closeNovaSessaoModal() {
  document.getElementById('novaSessaoModalOverlay').classList.remove('open');
  document.body.style.overflow = '';
}

async function confirmNovaSessao() {
  const periodo = detectarPeriodo();
  const raw = document.getElementById('sessaoAbertura').value.trim();
  const val = parseFloat(raw.replace(',', '.').replace(/[^\d,.]/g, ''));
  if (isNaN(val) || val < 0) { await showAlert('Valor inv\u00e1lido.'); return; }
  const data = hoje();
  const aberta = getSessaoAberta(data);
  if (aberta) { await showAlert('J\u00e1 existe uma sess\u00e3o aberta.'); closeNovaSessaoModal(); return; }

  const newId = getProximoIdSessao(data);
  const sessao = {
    id: newId, periodo: periodo,
    abertura: Math.round(val * 100) / 100,
    suprimentos: [], status: 'aberto',
    abertoEm: new Date().toLocaleString('pt-BR'),
    fechadoEm: null, obsAbertura: '', obsFechamento: '',
  };

  if (usingSupabase) {
    const saved = await dbSaveSessao(sessao, data);
    if (!saved) { showNotification('Erro ao abrir sess\u00e3o no banco', 'error'); return; }
  }

  if (!caixaStore[data]) caixaStore[data] = [];
  caixaStore[data].push(sessao);
  closeNovaSessaoModal();
  caixaCurrentSessionId = newId;
  renderCaixa();
  showNotification('Sess\u00e3o de caixa aberta com sucesso', 'success');
}

async function fecharCaixa() {
  const data = hoje();
  const sessao = getSessaoAberta(data);
  if (!sessao) { await showAlert('N\u00e3o h\u00e1 sess\u00e3o aberta para fechar.'); return; }
  const ok = await showConfirm('Fechar a sess\u00e3o "' + sessao.periodo + '" de hoje? As compras j\u00e1 registradas n\u00e3o ser\u00e3o alteradas.');
  if (!ok) return;

  sessao.status = 'fechado';
  sessao.fechadoEm = new Date().toLocaleString('pt-BR');
  const compras = getComprasDaSessao(data, sessao.id);
  const totalSupr = getTotalSuprimentos(sessao);
  const estornosDinheiro = getTotalEstornosMetodo(data, sessao.id, 'dinheiro');
  sessao.totalSaidas = Math.round(compras.filter(p => p.paymentMethod !== 'pix').reduce((s, p) => s + p.totalPrice, 0) * 100) / 100;
  sessao.qtdCompras = compras.length;
  sessao.saldoFinal = Math.round((sessao.abertura + totalSupr + estornosDinheiro - sessao.totalSaidas) * 100) / 100;

  if (usingSupabase) {
    const saved = await dbSaveSessao(sessao, data);
    if (!saved) { showNotification('Erro ao fechar sess\u00e3o no banco', 'error'); return; }
  }

  renderCaixa();
  showNotification('Sess\u00e3o de caixa fechada com sucesso', 'success');
}

async function editarAberturaCaixa() {
  const data = hoje();
  const sessao = getSessaoAberta(data);
  if (!sessao) { await showAlert('S\u00f3 \u00e9 poss\u00edvel ajustar o suprimento com uma sess\u00e3o aberta.'); return; }
  const valor = await showPrompt('Novo valor do suprimento inicial (R$):', sessao.abertura.toFixed(2).replace('.', ','));
  if (valor === null) return;
  const val = parseFloat(valor.replace(',', '.').replace(/[^\d,.]/g, ''));
  if (isNaN(val) || val <= 0) { await showAlert('Valor inv\u00e1lido.'); return; }
  sessao.abertura = Math.round(val * 100) / 100;
  if (usingSupabase) {
    const saved = await dbSaveSessao(sessao, data);
    if (!saved) { showNotification('Erro ao ajustar abertura no banco', 'error'); return; }
  }
  renderCaixa();
  showNotification('Abertura ajustada com sucesso', 'success');
}

function abrirModalSuprimento() {
  const data = hoje();
  const sessao = getSessaoAberta(data);
  if (!sessao) { showAlert('S\u00f3 \u00e9 poss\u00edvel adicionar suprimento com uma sess\u00e3o aberta.'); return; }
  document.getElementById('suprimentoAmount').value = '';
  document.getElementById('suprimentoDesc').value = '';
  document.getElementById('suprimentoModalOverlay').classList.add('open');
  document.body.style.overflow = 'hidden';
  setTimeout(() => document.getElementById('suprimentoAmount').focus(), 100);
  lucide.createIcons();
}

function closeSuprimentoModal() {
  document.getElementById('suprimentoModalOverlay').classList.remove('open');
  document.body.style.overflow = '';
}

async function confirmSuprimento() {
  const raw = document.getElementById('suprimentoAmount').value.trim();
  const val = parseFloat(raw.replace(',', '.').replace(/[^\d,.]/g, ''));
  if (isNaN(val) || val <= 0) { await showAlert('Valor inv\u00e1lido.'); return; }
  const desc = document.getElementById('suprimentoDesc').value.trim();
  const data = hoje();
  const sessao = getSessaoAberta(data);
  if (!sessao) { await showAlert('S\u00f3 \u00e9 poss\u00edvel adicionar suprimento com uma sess\u00e3o aberta.'); return; }
  if (!sessao.suprimentos) sessao.suprimentos = [];

  if (usingSupabase) {
    // Garantir que a sessao existe no Supabase (evitar FK violation)
    const sessaoSaved = await dbSaveSessao(sessao, data);
    if (!sessaoSaved) { showNotification('Erro ao salvar sess\u00e3o no banco', 'error'); return; }
    const sup = { amount: Math.round(val * 100) / 100, description: desc || '', timestamp: new Date().toLocaleTimeString('pt-BR') };
    const saved = await dbSaveSuprimento(sessao.id, data, sup.amount, sup.description);
    if (!saved) { showNotification('Erro ao adicionar suprimento no banco', 'error'); return; }
    sessao.suprimentos.push(sup);
  } else {
    sessao.suprimentos.push({ amount: Math.round(val * 100) / 100, description: desc || '', timestamp: new Date().toLocaleTimeString('pt-BR') });
  }
  closeSuprimentoModal();
  renderCaixa();
  showNotification('Suprimento adicionado com sucesso', 'success');
}

function verCaixaSessao(data, sessionId) {
  caixaHistoricoAberto = false;
  caixaCurrentSessionId = sessionId;
  const sessao = getSessao(data, sessionId);
  renderCaixaView(data, sessao);
  document.getElementById('caixaHistoricoView').style.display = 'none';
  document.getElementById('caixaCurrentView').style.display = 'block';
  lucide.createIcons();
}

async function toggleHistoricoCaixa() {
  caixaHistoricoAberto = !caixaHistoricoAberto;
  if (caixaHistoricoAberto) {
    document.getElementById('caixaCurrentView').style.display = 'none';
    document.getElementById('caixaHistoricoView').style.display = 'block';
    showCaixaHistoricoLoading();
    await renderHistoricoCaixa();
  } else {
    document.getElementById('caixaHistoricoView').style.display = 'none';
    document.getElementById('caixaCurrentView').style.display = 'block';
    renderCaixa();
  }
  lucide.createIcons();
}

function showCaixaHistoricoLoading() {
  const tbody = document.getElementById('caixaHistoricoBody');
  if (tbody) tbody.innerHTML = '<tr><td colspan="7" class="empty-state"><div class="history-loading"><div class="cv-spinner"></div><p>Carregando hist\u00f3rico de caixas...</p></div></td></tr>';
}

async function renderCaixa() {
  const data = hoje();
  await carregarSessoes(data);
  caixaHistoricoAberto = false;
  document.getElementById('caixaHistoricoView').style.display = 'none';
  document.getElementById('caixaCurrentView').style.display = 'block';

  const sessoes = getSessoes(data);
  const aberta = getSessaoAberta(data);

  // If no session selected or selected doesn't exist, pick first or default
  if (!caixaCurrentSessionId || !getSessao(data, caixaCurrentSessionId)) {
    caixaCurrentSessionId = aberta ? aberta.id : (sessoes.length > 0 ? sessoes[sessoes.length - 1].id : null);
  }

  if (caixaCurrentSessionId !== null) {
    const sessao = getSessao(data, caixaCurrentSessionId);
    renderCaixaView(data, sessao);
  } else {
    renderCaixaView(data, null);
  }
}

function renderSessoesTabs(data, activeSessionId) {
  const bar = document.getElementById('caixaSessoesBar');
  const tabs = document.getElementById('caixaSessoesTabs');
  const sessoes = getSessoes(data);

  if (sessoes.length === 0) {
    bar.style.display = 'none';
    return;
  }

  bar.style.display = 'flex';
  tabs.innerHTML = sessoes.map(s => {
    const isActive = s.id === activeSessionId;
    const dotClass = s.status === 'aberto' ? 'open' : 'closed';
    const statusLabel = s.status === 'aberto' ? '' : ' (Fechado)';
    return `<div class="sessoes-tab${isActive ? ' active' : ''}" onclick="verCaixaSessao('${data}', ${s.id})">
      <span class="dot ${dotClass}"></span>
      ${s.periodo}${statusLabel}
    </div>`;
  }).join('');
}

function renderCaixaView(data, sessao) {
  caixaCurrentData = data;
  const sessionId = sessao ? sessao.id : null;
  const compras = sessionId !== null ? getComprasDaSessao(data, sessionId) : [];
  const comprasAtivas = compras.filter(p => !isCompraCancelada(p.id));
  const comprasDinheiro = compras.filter(p => p.paymentMethod !== 'pix');
  const estornosDinheiro = getTotalEstornosMetodo(data, sessionId, 'dinheiro');
  const totalSaidas = comprasDinheiro.reduce((s, p) => s + p.totalPrice, 0);
  const totalEntradas = estornosDinheiro;
  const isFechado = sessao && (sessao.status === 'fechado' || !!sessao.fechadoEm || sessao.saldoFinal != null);
  const isAberto = sessao && !isFechado && sessao.status === 'aberto';
  const temSessoes = getSessoes(data).length > 0;
  const totalSupr = getTotalSuprimentos(sessao);
  const fundosDisponiveis = sessao ? sessao.abertura + totalSupr : 0;
  const saldo = fundosDisponiveis + estornosDinheiro - totalSaidas;
  const saidasExcedem = saldo < 0;

  // Session tabs
  renderSessoesTabs(data, sessionId);

  // Title
  const dataFormatada = formatDate(data);
  const periodoLabel = sessao ? ' \u2014 ' + sessao.periodo : '';
  document.getElementById('caixaDiaTitulo').textContent = 'Caixa ' + dataFormatada + periodoLabel;
  document.getElementById('caixaDataLabel').textContent = dataFormatada;

  // Status badge
  const badge = document.getElementById('caixaStatusBadge');
  if (isAberto) {
    badge.textContent = 'Aberto';
    badge.className = 'badge badge-green';
  } else if (isFechado) {
    badge.textContent = 'Fechado';
    badge.className = 'badge badge-blue';
  } else {
    badge.textContent = temSessoes ? 'Selecione' : 'Sem caixa';
    badge.className = 'badge badge-gray';
  }

  // Buttons
  const isHoje = data === hoje();
  const temAberta = getSessaoAberta(data) !== null;
  document.getElementById('btnNovaSessao').style.display = (!temAberta && isHoje) ? 'inline-flex' : 'none';
  document.getElementById('btnFecharCaixa').style.display = (isAberto && isHoje) ? 'inline-flex' : 'none';
  document.getElementById('btnEditAbertura').style.display = (isAberto && isHoje) ? 'inline-flex' : 'none';
  document.getElementById('btnSuprimento').style.display = (isAberto && isHoje) ? 'inline-flex' : 'none';
  document.getElementById('btnExportCaixa').style.display = (isFechado) ? 'inline-flex' : 'none';
  document.getElementById('btnExportCaixaBobina').style.display = (isFechado) ? 'inline-flex' : 'none';

  // Cards
  const abertura = sessao ? sessao.abertura : 0;

  document.getElementById('caixaAbertura').textContent = formatNumber(abertura);
  document.getElementById('caixaSaidas').textContent = formatNumber(totalSaidas);
  document.getElementById('caixaEntradas').textContent = formatNumber(totalEntradas);
  document.getElementById('caixaQtdCompras').textContent = compras.length + ' compra' + (compras.length !== 1 ? 's' : '');
  document.getElementById('caixaSaldo').textContent = formatNumber(saldo);

  // PIX totals for the selected session: apenas compras Pix ativas (canceladas saem do total)
  const pixCompras = sessionId !== null ? getPixComprasDaSessao(data, sessionId) : [];
  const pixTotal = pixCompras.reduce((s, p) => s + p.totalPrice, 0);
  document.getElementById('caixaPixTotal').textContent = formatNumber(pixTotal);
  document.getElementById('caixaPixCount').textContent = pixCompras.length + ' compra' + (pixCompras.length !== 1 ? 's' : '');
  document.getElementById('caixaPixCard').style.display = 'none'; // reset on re-render
  window.__pixCompras = pixCompras;

  const saldoLabel = document.getElementById('caixaSaldoLabel');
  if (!sessao) {
    saldoLabel.textContent = temSessoes ? 'Selecione uma sess\u00e3o' : 'Nenhum caixa hoje';
    saldoLabel.style.color = 'var(--text-light)';
  } else if (saidasExcedem) {
    saldoLabel.textContent = 'Negativo (sa\u00eddas excederam)';
    saldoLabel.style.color = 'var(--danger)';
  } else if (isFechado) {
    saldoLabel.textContent = 'Sess\u00e3o encerrada';
    saldoLabel.style.color = 'var(--success)';
  } else {
    saldoLabel.textContent = 'Dentro do previsto';
    saldoLabel.style.color = 'var(--success)';
  }

  // Fechamento card
  const fechCard = document.getElementById('cardFechamento');
  if (isFechado && sessao.fechadoEm) {
    fechCard.style.display = 'block';
    document.getElementById('caixaFechadoEm').textContent = sessao.fechadoEm;
  } else {
    fechCard.style.display = 'none';
  }

  // No abertura state
  document.getElementById('caixaSemAbertura').style.display = (!sessao && !temSessoes) ? 'block' : 'none';
  document.getElementById('caixaComprasCard').style.display = sessao ? 'block' : 'none';

  // Compras table with running balance
  const tbody = document.getElementById('caixaComprasBody');
  if (!sessao || compras.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="empty-state"><p>Nenhuma compra registrada nesta sess\u00e3o.</p></td></tr>';
  } else {
    let cumulative = 0;
    tbody.innerHTML = compras.map(p => {
      const isPix = p.paymentMethod === 'pix';
      const isCanc = isCompraCancelada(p.id);
      if (!isPix) cumulative += p.totalPrice;
      const runningBalance = fundosDisponiveis - cumulative;
      return `<tr>
        <td class="text-muted">${formatDate(p.date)}</td>
        <td class="font-medium">${p.items.map(it => it.productName).join(', ')}${isPix ? ' <span class="badge badge-pix">Pix</span>' : ''}${isCanc ? ' <span class="badge badge-red">Cancelado</span>' : ''}</td>
        <td class="text-muted">${p.pessoaName || '-'}</td>
        <td class="text-right" style="color:${isCanc ? 'var(--text-light)' : 'var(--danger)'};${isCanc ? 'text-decoration:line-through' : ''}">R$ ${formatNumber(p.totalPrice)}</td>
        <td class="text-right font-semibold" style="color:${runningBalance < 0 ? 'var(--danger)' : 'var(--success)'}">R$ ${formatNumber(runningBalance)}</td>
      </tr>`;
    }).join('');
  }

  // Product sales breakdown
  renderProdutosDoDia(comprasAtivas);

  // Suprimentos card
  renderSuprimentosDoDia(sessao);

  // Canceled documents (audit)
  renderCanceladosDoDia(compras, sessao);

  // Devolu\u00e7\u00f5es/estornos que atingiram este caixa
  renderEstornosDoDia(getEstornosDaSessao(data, sessionId), sessao);

  lucide.createIcons();
}

function renderCanceladosDoDia(compras, sessao) {
  const card = document.getElementById('caixaCanceladosCard');
  const tbody = document.getElementById('caixaCanceladosBody');
  const canceladas = compras.filter(p => isCompraCancelada(p.id));
  if (!sessao || canceladas.length === 0) { card.style.display = 'none'; return; }
  card.style.display = 'block';
  tbody.innerHTML = canceladas.map(p => {
    const ci = getCompraCancelamento(p.id);
    const quando = ci && ci.canceladoEm ? new Date(ci.canceladoEm).toLocaleString('pt-BR') : '-';
    return `<tr>
      <td class="font-medium">#${p.id}</td>
      <td>${p.items.map(it => it.productName).join(', ')}</td>
      <td class="text-muted">${p.pessoaName || '-'}</td>
      <td class="text-right" style="color:var(--danger);text-decoration:line-through">R$ ${formatNumber(p.totalPrice)}</td>
      <td class="font-medium" style="color:var(--danger)">${esc(ci ? ci.canceladoPor : '-')}</td>
      <td class="text-muted">${quando}</td>
      <td class="text-muted">${esc(ci ? ci.motivo : '-')}</td>
    </tr>`;
  }).join('');
}

function renderEstornosDoDia(estornos, sessao) {
  const card = document.getElementById('caixaEstornosCard');
  const tbody = document.getElementById('caixaEstornosBody');
  if (!sessao || estornos.length === 0) { if (card) card.style.display = 'none'; return; }
  card.style.display = 'block';
  tbody.innerHTML = estornos.map(c => {
    const original = purchases.find(p => p.id === c.compraId);
    const quando = c.canceladoEm ? new Date(c.canceladoEm).toLocaleString('pt-BR') : '-';
    const metodo = (c.metodoDevolucao || 'dinheiro') === 'pix'
      ? '<span class="badge badge-pix">Pix</span>'
      : '<span class="badge badge-dinheiro">Dinheiro</span>';
    return `<tr>
      <td class="font-medium">#${c.compraId}</td>
      <td class="text-muted">${original ? formatDate(original.date) : '-'}</td>
      <td>${original ? original.items.map(it => it.productName).join(', ') : '-'}</td>
      <td>${metodo}</td>
      <td class="text-right font-semibold" style="color:var(--success)">+R$ ${formatNumber(Number(c.valorEstornado) || 0)}</td>
      <td class="font-medium" style="color:var(--danger)">${esc(c.canceladoPor || '-')}</td>
      <td class="text-muted">${quando}</td>
      <td class="text-muted">${esc(c.motivo)}</td>
    </tr>`;
  }).join('');
}

function togglePixDetalhes() {
  const card = document.getElementById('caixaPixCard');
  const tbody = document.getElementById('caixaPixBody');
  if (card.style.display === 'block') {
    card.style.display = 'none';
    return;
  }
  const pixCompras = window.__pixCompras || [];
  if (!pixCompras.length) return;
  tbody.innerHTML = pixCompras.map(p => {
    const prodList = p.items.map(it => it.productName).join(', ');
    const isCanc = isCompraCancelada(p.id);
    return `<tr>
      <td class="text-muted">${formatDate(p.date)}</td>
      <td class="font-medium">${prodList}${isCanc ? ' <span class="badge badge-red">Cancelado</span>' : ''}</td>
      <td class="text-muted">${p.pessoaName || '-'}</td>
      <td class="text-right font-semibold" style="color:${isCanc ? 'var(--text-light);text-decoration:line-through' : 'var(--success)'}">R$ ${formatNumber(p.totalPrice)}</td>
    </tr>`;
  }).join('');
  card.style.display = 'block';
  lucide.createIcons();
}

function renderProdutosDoDia(compras) {
  const card = document.getElementById('caixaProdutosCard');
  const tbody = document.getElementById('caixaProdutosBody');
  if (compras.length === 0) { card.style.display = 'none'; return; }

  const agg = {};
  compras.forEach(p => p.items.forEach(it => {
    if (!agg[it.productId]) agg[it.productId] = { name: it.productName, qty: 0, total: 0 };
    agg[it.productId].qty += it.quantity;
    agg[it.productId].total += it.totalPrice;
  }));

  const rows = Object.values(agg);
  card.style.display = 'block';
  tbody.innerHTML = rows.map(r => {
    const avg = r.qty > 0 ? r.total / r.qty : 0;
    return `<tr>
      <td class="font-medium">${r.name}</td>
      <td class="text-right">${formatNumber(r.qty)} kg</td>
      <td class="text-right">R$ ${formatNumber(r.total)}</td>
      <td class="text-right text-muted">R$ ${formatNumber(avg)}/kg</td>
    </tr>`;
  }).join('');
}

function renderSuprimentosDoDia(sessao) {
  const card = document.getElementById('caixaSuprimentosCard');
  const tbody = document.getElementById('caixaSuprimentosBody');
  const sups = (sessao && sessao.suprimentos && sessao.suprimentos.length) ? sessao.suprimentos : [];
  if (sups.length === 0) { card.style.display = 'none'; return; }
  card.style.display = 'block';
  tbody.innerHTML = sups.map(s => `<tr>
    <td class="text-muted">${s.timestamp}</td>
    <td class="text-right font-semibold" style="color:var(--success)">R$ ${formatNumber(s.amount)}</td>
    <td class="text-muted">${s.description || '-'}</td>
  </tr>`).join('');
}

async function exportCaixaPDF() {
  if (!caixaCurrentData || caixaCurrentSessionId === null) return;
  let sessao = getSessao(caixaCurrentData, caixaCurrentSessionId);
  if (!sessao) { await carregarSessoes(caixaCurrentData); sessao = getSessao(caixaCurrentData, caixaCurrentSessionId); }
  if (!sessao) return;

  const dataFmt = formatDate(caixaCurrentData);
  const periodoLabel = sessao.periodo;

  const src = document.getElementById('caixaCurrentView');
  if (!src) return;

  const holder = document.createElement('div');
  holder.style.cssText = 'position:absolute;left:-12000px;top:0;width:740px;background:#fff;z-index:-1;';
  const clone = src.cloneNode(true);
  clone.style.cssText = 'width:100%;background:#fff;padding:8px;overflow:hidden;';
  clone.querySelectorAll('button, .btn').forEach(b => b.remove());
  holder.appendChild(clone);

  // Converte os valores de cards/totais para PT-BR como exibidos (j\u00e1 formatados)
  document.body.appendChild(holder);
  try {
    await gerarPDF(holder, `Fechamento de Caixa \u2014 ${dataFmt} ${periodoLabel}`, 'Fechamento_Caixa.pdf');
    showNotification('PDF do caixa gerado com sucesso', 'success');
  } finally {
    document.body.removeChild(holder);
  }
}

async function renderHistoricoCaixa() {
  await carregarTodasSessoes();
  const dates = Object.keys(caixaStore).sort().reverse();
  const tbody = document.getElementById('caixaHistoricoBody');

  if (dates.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="empty-state"><p>Nenhum caixa registrado.</p></td></tr>';
    return;
  }

  tbody.innerHTML = dates.flatMap(data => {
    const sessoes = getSessoes(data);
    if (sessoes.length === 0) return [];
    return sessoes.map(s => {
      const compras = getComprasDaSessao(data, s.id);
      const estornosDinheiro = getTotalEstornosMetodo(data, s.id, 'dinheiro');
      const totalSaidas = compras.filter(p => p.paymentMethod !== 'pix').reduce((acc, p) => acc + p.totalPrice, 0);
      const totalSupr = getTotalSuprimentos(s);
      const status = s.status === 'aberto' ? '<span class="badge badge-green">Aberto</span>' : '<span class="badge badge-blue">Fechado</span>';
      const isFech = s.status === 'fechado' || !!s.fechadoEm || s.saldoFinal != null;
      const saldoFinal = isFech ? s.saldoFinal : (s.abertura + totalSupr + estornosDinheiro - totalSaidas);
      return `<tr class="tr-clickable" onclick="verCaixaSessao('${data}', ${s.id})">
        <td class="font-medium">${formatDate(data)} ${status}<br><span style="font-size:11px;color:var(--text-light)">${s.periodo}</span></td>
        <td class="text-right">R$ ${formatNumber(s.abertura)}</td>
        <td class="text-right" style="color:var(--success)">R$ ${formatNumber(totalSupr)}</td>
        <td class="text-right" style="color:var(--danger)">R$ ${formatNumber(totalSaidas)}</td>
        <td class="text-right">${compras.length}</td>
        <td class="text-right font-semibold">R$ ${formatNumber(saldoFinal)}</td>
        <td class="text-right"><button class="btn btn-sm btn-ghost">Ver</button></td>
      </tr>`;
    });
  }).join('');
}

// ======================== RELATÓRIOS ========================
function renderReports() {
  const prodSelect = document.getElementById('relProduct');
  prodSelect.innerHTML = '<option value="">Todos</option>' + products.filter(p => p.active !== false).map(p => `<option value="${p.name}">${p.name}</option>`).join('');

  const pessSelect = document.getElementById('relPessoa');
  pessSelect.innerHTML = '<option value="">Todas</option>' + pessoas.filter(s => s.active !== false).map(s => `<option value="${s.name}">${s.name}</option>`).join('');

  const now = new Date();
  document.getElementById('relPeriodStart').value = new Date(now.getFullYear(), now.getMonth() - 2, 1).toISOString().slice(0,10);
  document.getElementById('relPeriodEnd').value = now.toISOString().slice(0,10);

  const reportTabs = document.getElementById('reportTabs');
  const newTabs = reportTabs.cloneNode(false);
  while (reportTabs.firstChild) newTabs.appendChild(reportTabs.firstChild);
  reportTabs.parentNode.replaceChild(newTabs, reportTabs);
  newTabs.id = 'reportTabs';
  newTabs.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    newTabs.querySelectorAll('button').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentReport = btn.dataset.report;
    applyReportFilters();
  });

  applyReportFilters();
}

function applyReportFilters() {
  if (reportChartTimeoutId) { clearTimeout(reportChartTimeoutId); reportChartTimeoutId = null; }

  const start = document.getElementById('relPeriodStart').value;
  const end = document.getElementById('relPeriodEnd').value;
  const prodFilter = document.getElementById('relProduct').value;
  const catFilter = document.getElementById('relCategory').value;
  const pessFilter = document.getElementById('relPessoa').value;

  let filtered = [...purchases];
  if (start) filtered = filtered.filter(p => p.date >= start);
  if (end) filtered = filtered.filter(p => p.date <= end);
  filtered = filtered.filter(p => !isCompraCancelada(p.id));
  if (pessFilter) filtered = filtered.filter(p => p.pessoaName === pessFilter);
  if (prodFilter || catFilter) {
    filtered = filtered.filter(p => p.items.some(it => {
      if (prodFilter && it.productName !== prodFilter) return false;
      if (catFilter && it.category !== catFilter) return false;
      return true;
    }));
  }

  const container = document.getElementById('reportBody');
  const title = document.getElementById('reportTitle');

  // Comparativo \u00e9 apenas visual (n\u00e3o export\u00e1vel)
  const semExport = currentReport === 'comparativo';
  const btnPDF = document.getElementById('btnExportPDF');
  const btnExcel = document.getElementById('btnExportExcel');
  if (btnPDF) btnPDF.style.display = semExport ? 'none' : '';
  if (btnExcel) btnExcel.style.display = semExport ? 'none' : '';

  switch (currentReport) {
    case 'periodo':
      title.textContent = `Compras por Per\u00edodo (${filtered.length} registros)`;
      container.innerHTML = filtered.length ? `
        <div class="table-wrap">
          <table><thead><tr><th>Data</th><th>Pessoa</th><th class="text-right">Itens</th><th>Produtos</th><th class="text-right">Valor Total</th></tr></thead>
          <tbody>${filtered.sort((a,b) => b.date.localeCompare(a.date)).map(p => `
            <tr><td class="text-muted">${formatDate(p.date)}</td><td>${p.pessoaName || '-'}</td><td class="text-right">${p.items.length}</td><td>${p.items.map(it => it.productName).join(', ')}</td><td class="text-right font-semibold">R$ ${formatNumber(p.totalPrice)}</td></tr>
          `).join('')}</tbody></table>
        </div>
        <div style="margin-top:16px;padding:16px;background:#F9FAFB;border-radius:8px;font-size:14px"><strong>Total do per\u00edodo:</strong> R$ ${formatNumber(filtered.reduce((s,p) => s + p.totalPrice, 0))}</div>
      ` : '<div class="empty-state"><p>Nenhum resultado.</p></div>';
      break;

    case 'pessoa':
      title.textContent = `Compras por Pessoa (${filtered.length} registros)`;
      const byPess = {};
      filtered.forEach(p => {
        const key = p.pessoaName || '(Sem identifica\u00e7\u00e3o)';
        if (!byPess[key]) byPess[key] = { qty: 0, total: 0, count: 0 };
        byPess[key].qty += p.items.reduce((s, it) => s + it.quantity, 0);
        byPess[key].total += p.totalPrice;
        byPess[key].count++;
      });
      container.innerHTML = Object.keys(byPess).length ? `
        <div class="table-wrap">
          <table><thead><tr><th>Pessoa</th><th class="text-right">Compras</th><th class="text-right">Qtd Total (kg)</th><th class="text-right">Valor Total</th></tr></thead>
          <tbody>${Object.entries(byPess).sort((a,b) => b[1].total - a[1].total).map(([name, data]) => `
            <tr><td class="font-medium">${name}</td><td class="text-right">${data.count}</td><td class="text-right">${formatNumber(data.qty)}</td><td class="text-right font-semibold">R$ ${formatNumber(data.total)}</td></tr>
          `).join('')}</tbody></table>
        </div>
      ` : '<div class="empty-state"><p>Nenhum resultado.</p></div>';
      break;

    case 'produto':
      title.textContent = `Compras por Produto`;
      const byProd = {};
      filtered.forEach(p => p.items.forEach(it => {
        if (!byProd[it.productName]) byProd[it.productName] = { qty: 0, total: 0, count: 0, cat: it.category };
        byProd[it.productName].qty += it.quantity;
        byProd[it.productName].total += it.totalPrice;
        byProd[it.productName].count++;
      }));
      container.innerHTML = Object.keys(byProd).length ? `
        <div class="table-wrap">
          <table><thead><tr><th>Produto</th><th>Categoria</th><th class="text-right">Compras</th><th class="text-right">Qtd Total (kg)</th><th class="text-right">Valor Total</th></tr></thead>
          <tbody>${Object.entries(byProd).sort((a,b) => b[1].total - a[1].total).map(([name, data]) => `
            <tr><td class="font-medium">${name}</td><td><span class="badge badge-gray">${categoryLabels[data.cat] || data.cat}</span></td><td class="text-right">${data.count}</td><td class="text-right">${formatNumber(data.qty)}</td><td class="text-right font-semibold">R$ ${formatNumber(data.total)}</td></tr>
          `).join('')}</tbody></table>
        </div>
      ` : '<div class="empty-state"><p>Nenhum resultado.</p></div>';
      break;

    case 'maisComprados':
      title.textContent = `Produtos Mais Comprados (${filtered.length} registros)`;
      const topProd = {};
      filtered.forEach(p => p.items.forEach(it => {
        if (!topProd[it.productName]) topProd[it.productName] = { qty: 0, total: 0, cat: it.category };
        topProd[it.productName].qty += it.quantity;
        topProd[it.productName].total += it.totalPrice;
      }));
      const sortedProd = Object.entries(topProd).sort((a,b) => b[1].qty - a[1].qty);
      container.innerHTML = sortedProd.length ? `
        <div class="chart-wrap tall"><canvas id="reportBarChart"></canvas></div>
        <div class="table-wrap mt-4">
          <table><thead><tr><th>#</th><th>Produto</th><th>Categoria</th><th class="text-right">Qtd Total (kg)</th><th class="text-right">Valor Total</th></tr></thead>
          <tbody>${sortedProd.map(([name, data], i) => `
            <tr><td class="text-muted">${i+1}</td><td class="font-medium">${name}</td><td><span class="badge badge-gray">${categoryLabels[data.cat] || data.cat}</span></td><td class="text-right font-semibold">${formatNumber(data.qty)}</td><td class="text-right">R$ ${formatNumber(data.total)}</td></tr>
          `).join('')}</tbody></table>
        </div>
      ` : '<div class="empty-state"><p>Nenhum resultado.</p></div>';
      if (reportChartTimeoutId) clearTimeout(reportChartTimeoutId);
      reportChartTimeoutId = setTimeout(() => { reportChartTimeoutId = null; reportChartTimeout(); }, 100);
      break;

    case 'comparativo':
      title.textContent = 'Comparativo de Pre\u00e7os';
      container.innerHTML = '<div class="chart-wrap tall"><canvas id="reportComparativoChart"></canvas></div>';
      setTimeout(() => {
        const ctx = document.getElementById('reportComparativoChart');
        if (!ctx) return;
        const catMap = { Cobre: '#B87333', Aluminio: '#A8A8A8', Metal: '#4A5568', Inox: '#718096', Outros: '#38A169' };
        new Chart(ctx, {
          type: 'bar',
          data: { labels: products.map(p => p.name), datasets: [{ label: 'Pre\u00e7o (R$/kg)', data: products.map(p => p.price), backgroundColor: products.map(p => catMap[p.category] || '#CBD5E1'), borderRadius: 4 }] },
          options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { callback: v => 'R$' + v.toFixed(2) } }, x: { grid: { display: false } } } }
        });
      }, 100);
      break;
  }
}

function reportChartTimeout() {
  const t = setTimeout(() => {
    reportChartTimeoutId = null;
    const canvas = document.getElementById('reportBarChart');
    if (!canvas) return;
    const rows = document.querySelectorAll('#reportBody table tbody tr');
    const labels = [], data = [];
    rows.forEach((row) => {
      const cells = row.querySelectorAll('td');
      if (cells.length >= 4) { labels.push(cells[1].textContent); data.push(parseFloat(cells[3].textContent.replace(/\./g,'').replace(',','.')) || 0); }
    });
    new Chart(canvas, {
      type: 'bar',
      data: { labels: labels.slice(0,10), datasets: [{ label: 'Quantidade (kg)', data: data.slice(0,10), backgroundColor: 'rgba(245,197,27,0.7)', borderRadius: 4 }] },
      options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { grid: { display: false } }, x: { beginAtZero: true, grid: { display: false } } } }
    });
  }, 150);
  reportChartTimeoutId = t;
}

// ======================== EXPORTS ========================
function baixarArquivo(blob, nome) {
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = nome;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

// Gera PDF direto na mesma aba (sem abrir nova guia), capturando um elemento.
async function gerarPDF(elemento, titulo, nomeArquivo) {
  if (!window.jspdf || !window.html2canvas) {
    await showAlert('Biblioteca de PDF n\u00e3o carregada. Verifique sua conex\u00e3o e recarregue a p\u00e1gina.');
    return false;
  }
  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const margin = 36;
  const dateStr = new Date().toLocaleString('pt-BR');
  const pdfName = appConfig.pdf_company_name || 'Metal Minas';
  const pdfCnpj = appConfig.pdf_cnpj || '';

  const canvas = await html2canvas(elemento, { scale: 2, backgroundColor: '#ffffff', useCORS: true, windowWidth: elemento.scrollWidth });
  const imgW = pageW - margin * 2;
  const imgH = canvas.height * imgW / canvas.width;
  const ratio = canvas.height / imgH; // px por pt

  // Cabeçalho (apenas na primeira página)
  let y = margin + 6;
  pdf.setFont('helvetica', 'bold'); pdf.setFontSize(16); pdf.setTextColor('#1F376B');
  pdf.text('Comp Vision', margin, y);
  pdf.setFont('helvetica', 'normal'); pdf.setFontSize(9); pdf.setTextColor('#6B7280');
  pdf.text(`${pdfName}${pdfCnpj ? '  \u2022  CNPJ ' + pdfCnpj : ''}`, margin, y + 12);
  pdf.setFont('helvetica', 'bold'); pdf.setFontSize(11); pdf.setTextColor('#374151');
  pdf.text(titulo, pageW - margin, y, { align: 'right' });
  pdf.setFont('helvetica', 'normal'); pdf.setFontSize(8); pdf.setTextColor('#9CA3AF');
  pdf.text('Emitido em: ' + dateStr, pageW - margin, y + 12, { align: 'right' });
  pdf.setDrawColor('#1F376B'); pdf.setLineWidth(2);
  pdf.line(margin, y + 20, pageW - margin, y + 20);
  y += 20 + 12;

  const cortarImg = (sy, sh) => {
    const c = document.createElement('canvas');
    c.width = canvas.width;
    c.height = sh;
    c.getContext('2d').drawImage(canvas, 0, sy, canvas.width, sh, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.92);
  };

  const avail = pageH - y - margin;
  if (imgH <= avail) {
    pdf.addImage(cortarImg(0, canvas.height), 'JPEG', margin, y, imgW, imgH);
  } else {
    let sy = 0;
    while (sy < imgH) {
      const sh = Math.min(avail, imgH - sy);
      pdf.addImage(cortarImg(Math.round(sy * ratio), Math.round(sh * ratio)), 'JPEG', margin, y, imgW, sh);
      sy += sh;
      if (sy < imgH) { pdf.addPage(); y = margin; }
    }
  }

  pdf.save(nomeArquivo);
  return true;
}

async function exportPDF() {
  if (currentReport === 'comparativo') return;
  const title = document.getElementById('reportTitle').textContent;
  const bodyEl = document.getElementById('reportBody');

  // Esconde temporariamente elementos n\u00e3o impressos
  const btn = document.querySelector('.btn-excel, #btnExportExcel');
  if (btn) btn.style.display = 'none';

  await gerarPDF(bodyEl, title, 'Relatorio_' + (currentReport || 'compras') + '.pdf');
  if (btn) btn.style.display = '';
  showNotification('PDF gerado com sucesso', 'success');
}

// Exporta para Excel (.xls real) exatamente o relat\u00f3rio exibido na tela.
function exportExcel() {
  if (currentReport === 'comparativo') return;
  if (typeof XLSX === 'undefined') {
    showAlert('Biblioteca de Excel n\u00e3o carregada. Verifique sua conex\u00e3o e recarregue a p\u00e1gina.');
    return;
  }
  const title = document.getElementById('reportTitle').textContent;
  const bodyEl = document.getElementById('reportBody');
  const clone = bodyEl.cloneNode(true);
  clone.querySelectorAll('canvas').forEach(c => c.remove());
  clone.querySelectorAll('.chart-wrap').forEach(w => w.remove());

  const dateStr = new Date().toLocaleString('pt-BR');
  const pdfName = appConfig.pdf_company_name || 'Metal Minas';
  const pdfCnpj = appConfig.pdf_cnpj || '';

  const aoa = [];
  aoa.push(['Comp Vision']);
  aoa.push([pdfName + (pdfCnpj ? ' \u2022 CNPJ ' + pdfCnpj : '')]);
  aoa.push([title]);
  aoa.push(['Emitido em: ' + dateStr]);
  aoa.push([]);

  clone.querySelectorAll('table').forEach(tbl => {
    tbl.querySelectorAll('tr').forEach(tr => {
      const row = [];
      tr.querySelectorAll('th, td').forEach(cell => row.push(cell.textContent.trim()));
      if (row.length) aoa.push(row);
    });
  });
  clone.querySelectorAll('table').forEach(tbl => tbl.remove());
  const rest = clone.textContent.trim();
  if (rest) aoa.push([rest]);

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = [{ wch: 60 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Relat\u00f3rio');
  const data = XLSX.write(wb, { bookType: 'biff8', type: 'array' });
  baixarArquivo(new Blob([data], { type: 'application/vnd.ms-excel' }), 'Relatorio_' + (currentReport || 'compras') + '.xls');
  showNotification('Excel gerado com sucesso', 'success');
}

// ======================== AI ASSISTANT (GROQ) ========================
function getAIKey() { return appConfig.groq_api_key || ''; }
function getAIModel() { return appConfig.groq_model || 'llama-3.3-70b-versatile'; }

function toggleChat() {
  const panel = document.getElementById('chatPanel');
  panel.classList.toggle('open');
  lucide.createIcons();
  if (panel.classList.contains('open')) {
    setTimeout(() => document.getElementById('chatInput').focus(), 200);
  }
}

function buildAIContext() {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0,10);
  const monthEnd = now.toISOString().slice(0,10);
  const monthPurchases = purchases.filter(p => p.date >= monthStart && p.date <= monthEnd);
  const totalMonth = monthPurchases.reduce((s, p) => s + p.totalPrice, 0);
  const qtyMonth = monthPurchases.length;

  const catSummary = {};
  purchases.forEach(p => p.items.forEach(it => {
    catSummary[it.category] = (catSummary[it.category] || 0) + it.totalPrice;
  }));

  const topProducts = {};
  purchases.forEach(p => p.items.forEach(it => {
    topProducts[it.productName] = (topProducts[it.productName] || 0) + it.quantity;
  }));
  const top5 = Object.entries(topProducts).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([n, q]) => `${n} (${formatNumber(q)} kg)`).join('; ');

  const hojeStr = hoje();
  const sessaoHoje = getSessaoAberta(hojeStr);
  const sessoesHoje = getSessoes(hojeStr);
  const estornosDinheiroHoje = getTotalEstornosMetodo(hojeStr, sessaoHoje ? sessaoHoje.id : null, 'dinheiro');
  const estornosPixHoje = getTotalEstornosMetodo(hojeStr, sessaoHoje ? sessaoHoje.id : null, 'pix');
  const pixComprasHoje = sessaoHoje ? getPixComprasDaSessao(hojeStr, sessaoHoje.id) : [];
  const totalPix = pixComprasHoje.reduce((s, p) => s + p.totalPrice, 0);
  const pixCount = pixComprasHoje.length;

  let caixaInfo;
  if (sessaoHoje) {
    const comprasSessao = getComprasDaSessao(hojeStr, sessaoHoje.id);
    const totalSaidas = comprasSessao.filter(p => p.paymentMethod !== 'pix').reduce((s, p) => s + p.totalPrice, 0);
    const totalSupr = getTotalSuprimentos(sessaoHoje);
    const saldo = sessaoHoje.abertura + totalSupr + estornosDinheiroHoje - totalSaidas;
    caixaInfo = `Sessão "${sessaoHoje.periodo}" aberta, R$ ${formatNumber(sessaoHoje.abertura)} inicial, R$ ${formatNumber(totalSupr)} em suprimentos, R$ ${formatNumber(totalSaidas)} em saídas (compras), R$ ${formatNumber(estornosDinheiroHoje)} devolvidos em dinheiro (entradas), saldo R$ ${formatNumber(saldo)}.`;
  } else if (sessoesHoje.length > 0) {
    const ultima = sessoesHoje[sessoesHoje.length - 1];
    caixaInfo = `Última sessão de hoje foi "${ultima.periodo}" (fechada). ${sessoesHoje.length} sessão(ões) hoje.`;
  } else {
    caixaInfo = 'Nenhuma sessão de caixa hoje.';
  }
  if (pixCount > 0 || estornosPixHoje > 0) caixaInfo += ` Pix da sessão: ${pixCount} compra(s), R$ ${formatNumber(totalPix)}.`;

  return `Você é o Vision AI, assistente da Metal Minas, uma recicladora de metais.

REGRAS:
- Seja natural e direto, como um colega de trabalho.
- Saudações simples responda de forma casual (ex: "Oi! Tudo bem? Precisa de ajuda?").
- Não dê tutoriais enormes a menos que a pessoa peça explicitamente.
- Use os dados reais abaixo para responder com números concretos.
- Máximo 2 parágrafos.
- Haja como um sócio consultor

DADOS ATUAIS:
- ${products.length} produtos em ${categories.length} categorias
- ${purchases.length} compras registradas, ${pessoas.length} fornecedores
- Mês: ${qtyMonth} compras, R$ ${formatNumber(totalMonth)}
- Top 5 produtos: ${top5}
- Categorias: ${Object.entries(catSummary).map(([c, v]) => `${c}: R$ ${formatNumber(v)}`).join(', ')}
- Caixa: ${caixaInfo}`;
}

let chatHistory = [];

function addChatMessage(text, role) {
  const container = document.getElementById('chatMessages');
  const time = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const div = document.createElement('div');
  div.className = 'chat-msg ' + role;
  div.innerHTML = `<div class="chat-msg-content">${text}</div><div class="chat-msg-time">${time}</div>`;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

async function sendChat() {
  const input = document.getElementById('chatInput');
  const msg = input.value.trim();
  if (!msg) return;

  if (!getAIKey()) {
    addChatMessage('Configure uma chave da API Groq primeiro (clique no \u00edcone de chave).', 'error');
    input.value = '';
    return;
  }

  addChatMessage(msg, 'user');
  input.value = '';
  document.getElementById('chatSendBtn').disabled = true;

  // Loading indicator
  const container = document.getElementById('chatMessages');
  const loadingDiv = document.createElement('div');
  loadingDiv.className = 'chat-msg ai loading';
  loadingDiv.innerHTML = '<div class="chat-msg-content">Pensando</div>';
  container.appendChild(loadingDiv);
  container.scrollTop = container.scrollHeight;

  try {
    const context = buildAIContext();
    const messages = [
      { role: 'system', content: context },
      ...chatHistory,
      { role: 'user', content: msg },
    ];
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + getAIKey(),
      },
      body: JSON.stringify({
        model: getAIModel(),
        messages,
        temperature: 0.7,
        max_tokens: 256,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      let errMsg = 'Erro ' + response.status;
      try { const errJson = JSON.parse(errText); errMsg = errJson.error?.message || errMsg; } catch(e) {}
      throw new Error(errMsg);
    }

    const data = await response.json();
    const reply = data.choices[0].message.content.trim();
    loadingDiv.remove();
    addChatMessage(reply.replace(/\n/g, '<br>'), 'ai');
    chatHistory.push({ role: 'user', content: msg });
    chatHistory.push({ role: 'assistant', content: reply });
  } catch (e) {
    loadingDiv.remove();
    addChatMessage('Erro: ' + e.message, 'error');
  } finally {
    document.getElementById('chatSendBtn').disabled = false;
    document.getElementById('chatInput').focus();
  }
}

// ======================== CONFIGURACOES ========================
function isPricingRuleActive() {
  return appConfig.pricing_rule_enabled === '1';
}

function getEffectivePrice(unitPrice, qty) {
  if (!isPricingRuleActive() || !(qty > 0)) return +unitPrice;
  const threshold = parseFloat(appConfig.pricing_rule_threshold);
  if (!(threshold > 0) || !(qty < threshold)) return +unitPrice;
  const surcharge = parseFloat(appConfig.pricing_rule_surcharge);
  return +unitPrice + (isNaN(surcharge) ? 0.5 : surcharge);
}

function loadCategories() {
  const raw = appConfig.product_categories;
  if (raw) {
    try {
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
      if (Array.isArray(parsed) && parsed.length) {
        categories = parsed;
        categoryLabels = {};
        parsed.forEach(c => { categoryLabels[c] = c; });
      }
    } catch(e) { /* keep defaults */ }
  }
  populateCategorySelects();
}

function populateCategorySelects() {
  const selects = [
    { el: document.getElementById('prodCatFilter'), skipFirst: true },
    { el: document.getElementById('prodFormCategory'), skipFirst: false },
    { el: document.getElementById('relCategory'), skipFirst: true }
  ];
  selects.forEach(({ el, skipFirst }) => {
    if (!el) return;
    const currentVal = el.value;
    let firstOpt = null;
    if (skipFirst) {
      firstOpt = el.options[0];
    }
    el.innerHTML = '';
    if (firstOpt) el.appendChild(firstOpt);
    categories.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c;
      opt.textContent = categoryLabels[c] || c;
      el.appendChild(opt);
    });
    if (categories.includes(currentVal)) el.value = currentVal;
  });
}

function updatePricingRulePreview() {
  const threshEl = document.getElementById('pricingRuleThreshold');
  const surcEl = document.getElementById('pricingRuleSurcharge');
  if (!threshEl || !surcEl) return;
  const threshold = parseFloat(threshEl.value);
  const surcharge = parseFloat(surcEl.value);
  const tText = document.getElementById('ruleThresholdText');
  const sText = document.getElementById('ruleSurchargeText');
  if (tText) tText.textContent = isNaN(threshold) || threshold < 0 ? '0' : String(threshold);
  if (sText) sText.textContent = (isNaN(surcharge) ? 0 : surcharge).toFixed(2).replace('.', ',');
}

function renderConfiguracoes() {
  const toggle = document.getElementById('togglePricingRule');
  if (toggle) {
    toggle.checked = isPricingRuleActive();
    document.getElementById('pricingRuleStatus').textContent = toggle.checked ? 'Ativada' : 'Desativada';
    document.getElementById('pricingRuleStatus').className = 'badge ' + (toggle.checked ? 'badge-green' : 'badge-gray');
  }

  const period = appConfig.dashboard_default_period || 'mes';
  document.querySelectorAll('#settingsPeriodToggle .period-option').forEach(el => {
    el.classList.toggle('active', el.dataset.period === period);
  });

  const pdfName = document.getElementById('pdfCompanyName');
  const pdfCnpj = document.getElementById('pdfCnpj');
  if (pdfName) pdfName.value = appConfig.pdf_company_name || '';
  if (pdfCnpj) pdfCnpj.value = appConfig.pdf_cnpj || '';

  const thresh = document.getElementById('pricingRuleThreshold');
  if (thresh) thresh.value = appConfig.pricing_rule_threshold || '100';
  const surc = document.getElementById('pricingRuleSurcharge');
  if (surc) surc.value = appConfig.pricing_rule_surcharge || '0.5';
  const defAb = document.getElementById('caixaDefaultAbertura');
  if (defAb) defAb.value = appConfig.caixa_default_abertura || '0';
  updatePricingRulePreview();

  const printPrefs = (typeof getPrintPrefs === 'function') ? getPrintPrefs() : { format: 'bobina', direct: false };
  const pf = document.getElementById('printDefaultFormat');
  if (pf) pf.value = printPrefs.format;
  const pd = document.getElementById('printDirectToggle');
  if (pd) pd.checked = printPrefs.direct;
  const pdStatus = document.getElementById('printDirectStatus');
  if (pdStatus) {
    pdStatus.textContent = printPrefs.direct ? 'Ativada' : 'Desativada';
    pdStatus.className = 'badge ' + (printPrefs.direct ? 'badge-green' : 'badge-gray');
  }

  renderCategoriesList();
}

function renderCategoriesList() {
  const list = document.getElementById('settingsCategoriesList');
  if (!list) return;
  list.innerHTML = categories.map(c => {
    const used = products.some(p => p.category === c);
    return `<div class="settings-category-item">
      <span>${c}</span>
      <div class="cat-actions">
        <button class="cat-remove" onclick="removeCategory('${c}')" ${used ? 'title="Categoria em uso"' : ''} style="${used ? 'opacity:0.4;cursor:not-allowed' : ''}">
          <i data-lucide="trash-2" style="width:14px;height:14px"></i>
        </button>
      </div>
    </div>`;
  }).join('');
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

async function savePricingRule(enabled) {
  const val = enabled ? '1' : '0';
  appConfig.pricing_rule_enabled = val;
  const status = document.getElementById('pricingRuleStatus');
  if (status) {
    status.textContent = enabled ? 'Ativada' : 'Desativada';
    status.className = 'badge ' + (enabled ? 'badge-green' : 'badge-gray');
  }
  if (usingSupabase) await dbSetConfig('pricing_rule_enabled', val);
}

async function savePricingRuleThreshold(val) {
  if (isNaN(parseFloat(val)) || parseFloat(val) < 0) return;
  appConfig.pricing_rule_threshold = val;
  if (usingSupabase) await dbSetConfig('pricing_rule_threshold', val);
}

async function savePricingRuleSurcharge(val) {
  if (isNaN(parseFloat(val)) || parseFloat(val) < 0) return;
  appConfig.pricing_rule_surcharge = val;
  if (usingSupabase) await dbSetConfig('pricing_rule_surcharge', val);
}

async function saveCaixaDefaultAbertura(val) {
  if (isNaN(parseFloat(val)) || parseFloat(val) < 0) return;
  appConfig.caixa_default_abertura = val;
  if (usingSupabase) await dbSetConfig('caixa_default_abertura', val);
}

async function saveDefaultDashboardPeriod(period) {
  appConfig.dashboard_default_period = period;
  document.querySelectorAll('#settingsPeriodToggle .period-option').forEach(el => {
    el.classList.toggle('active', el.dataset.period === period);
  });
  if (usingSupabase) await dbSetConfig('dashboard_default_period', period);
}

async function savePdfCompanyName(name) {
  appConfig.pdf_company_name = name;
  if (usingSupabase) await dbSetConfig('pdf_company_name', name);
}

async function savePdfCnpj(cnpj) {
  appConfig.pdf_cnpj = cnpj;
  if (usingSupabase) await dbSetConfig('pdf_cnpj', cnpj);
}

async function cadastrarUsuario() {
  const sb = getSupabase();
  if (!sb) { await showAlert('Supabase n\u00e3o conectado.'); return; }

  const name = document.getElementById('newUserName').value.trim();
  const email = document.getElementById('newUserEmail').value.trim();
  const pass = document.getElementById('newUserPass').value;

  if (!name) { await showAlert('Informe o nome do usu\u00e1rio.'); return; }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { await showAlert('Informe um email v\u00e1lido.'); return; }
  if (!pass || pass.length < 6) { await showAlert('A senha deve ter pelo menos 6 caracteres.'); return; }

  const { data: { session: adminSession } } = await sb.auth.getSession();

  const { data, error } = await sb.auth.signUp({
    email,
    password: pass,
    options: { data: { name: name, username: email.split('@')[0] } },
  });

  if (adminSession) {
    await sb.auth.setSession({ access_token: adminSession.access_token, refresh_token: adminSession.refresh_token });
  }

  if (error) {
    const msg = error.message && error.message.toLowerCase().includes('already')
      ? 'J\u00e1 existe um usu\u00e1rio com este email.'
      : error.message;
    await showAlert('Erro ao cadastrar: ' + msg);
    return;
  }

  if (data.session) {
    clearUserForm();
    showNotification('Usu\u00e1rio cadastrado com sucesso', 'success');
  } else if (data.user && data.user.identities && data.user.identities.length > 0) {
    clearUserForm();
    await showAlert('Usu\u00e1rio criado! Ele precisa confirmar o email pelo link enviado para ' + email + ' antes do primeiro acesso.');
  } else {
    await showAlert('J\u00e1 existe um usu\u00e1rio com este email.');
  }
}

function clearUserForm() {
  document.getElementById('newUserName').value = '';
  document.getElementById('newUserEmail').value = '';
  document.getElementById('newUserPass').value = '';
}

async function addCategory() {
  const input = document.getElementById('newCategoryName');
  const name = input.value.trim();
  if (!name) return;
  if (categories.includes(name)) { showNotification('Categoria j\u00e1 existe', 'warning'); return; }
  categories.push(name);
  categoryLabels[name] = name;
  input.value = '';
  renderCategoriesList();
  populateCategorySelects();
  await saveCategories();
  showNotification('Categoria adicionada', 'success');
}

async function removeCategory(name) {
  if (products.some(p => p.category === name)) {
    showNotification('N\u00e3o \u00e9 poss\u00edvel remover categoria em uso por produtos', 'warning');
    return;
  }
  categories = categories.filter(c => c !== name);
  delete categoryLabels[name];
  renderCategoriesList();
  populateCategorySelects();
  await saveCategories();
  showNotification('Categoria removida', 'success');
}

async function saveCategories() {
  const json = JSON.stringify(categories);
  appConfig.product_categories = json;
  if (usingSupabase) await dbSetConfig('product_categories', json);
}

