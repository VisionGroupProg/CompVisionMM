// ============================================================
// Comp Vision - Supabase Multi-Tenant Manager
// Centraliza conexoes com multiplos projetos Supabase
// ============================================================
const supabaseManager = (function() {

const COMPANIES = [
  {
    id: 'metal-minas',
    name: 'Metal Minas',
    city: 'S\u00e3o Bernardo do Campo',
    description: 'Materiais de Construcao',
    logo: 'mm.png',
    supabaseUrl: 'https://ekxgcwhsxcahijayotfs.supabase.co',
    supabaseAnonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVreGdjd2hzeGNhaGlqYXlvdGZzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ2MzAzMzgsImV4cCI6MjEwMDIwNjMzOH0.Ye67BXG3osz_qItx_XCPcd1vmIqanUss2k-0A1GUfwQ',
  },
  {
    id: 'filial',
    name: 'Diadema',
    city: 'Diadema',
    description: 'Metal Minas Diadema',
    logo: 'mm.png',
    supabaseUrl: 'https://tlbbhzchsakpsfldgxhf.supabase.co',
    supabaseAnonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRsYmJoemNoc2FrcHNmbGRneGhmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUyNjQwODQsImV4cCI6MjEwMDg0MDA4NH0.tCoAG72OHd0dvvEha28kmzK22n45qtxQ4txS17zAngA',
  },
];

let activeCompanyId = null;
let supabaseClient = null;
const rtChannels = [];

function getCompanies() {
  return COMPANIES;
}

function getCompany(id) {
  return COMPANIES.find(c => c.id === id) || null;
}

function getCurrentCompany() {
  if (!activeCompanyId) return null;
  return getCompany(activeCompanyId);
}

function getCurrentCompanyId() {
  return activeCompanyId;
}

function initSupabase(companyId) {
  const company = getCompany(companyId);
  if (!company) {
    console.warn('Empresa nao encontrada:', companyId);
    return false;
  }
  if (typeof supabase === 'undefined' || !supabase.createClient) {
    console.warn('Supabase JS SDK nao carregado.');
    return false;
  }
  try {
    activeCompanyId = companyId;
    supabaseClient = supabase.createClient(company.supabaseUrl, company.supabaseAnonKey, {
      realtime: { params: { eventsPerSecond: 10 } },
      auth: { persistSession: true, autoRefreshToken: true, storageKey: 'cv_auth_' + companyId },
    });
    return true;
  } catch (e) {
    console.error('Falha ao iniciar Supabase para', companyId, ':', e.message);
    activeCompanyId = null;
    supabaseClient = null;
    return false;
  }
}

function getSupabase() {
  return supabaseClient;
}

function isConnected() {
  return supabaseClient !== null && activeCompanyId !== null;
}

function switchCompany(companyId) {
  dbUnsubscribeAll();
  if (initSupabase(companyId)) {
    localStorage.setItem('cv_company', companyId);
    return true;
  }
  return false;
}

function dbUnsubscribeAll() {
  rtChannels.forEach(ch => { try { ch.unsubscribe(); } catch(e) {} });
  rtChannels.length = 0;
}

function dbSubscribe(tables, callback) {
  const sb = getSupabase();
  if (!sb) return null;
  const tablesArr = Array.isArray(tables) ? tables : [tables];
  const channel = sb.channel('db-changes');
  tablesArr.forEach(table => {
    channel.on('postgres_changes', { event: '*', schema: 'public', table }, payload => {
      if (callback) callback({ table, event: payload.eventType, new: payload.new, old: payload.old });
    });
  });
  channel.subscribe();
  rtChannels.push(channel);
  return channel;
}

function restoreCompany() {
  const saved = localStorage.getItem('cv_company');
  if (saved && getCompany(saved)) {
    return initSupabase(saved);
  }
  return false;
}

return {
  getCompanies,
  getCompany,
  getCurrentCompany,
  getCurrentCompanyId,
  initSupabase,
  getSupabase,
  isConnected,
  switchCompany,
  dbUnsubscribeAll,
  dbSubscribe,
  restoreCompany,
};

})();
