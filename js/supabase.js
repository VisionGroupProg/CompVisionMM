// ============================================================
// Comp Vision - Supabase Client, Realtime & Database Layer
// Agora delegado ao supabaseManager.js para multi-empresas
// ============================================================

function initSupabase(companyId) {
  if (companyId) {
    return supabaseManager.initSupabase(companyId);
  }
  return supabaseManager.restoreCompany();
}

function getSupabase() {
  return supabaseManager.getSupabase();
}

// ======================== HELPERS ========================
function mapProduto(p) {
  return { id: p.id, name: p.name, category: p.category, description: p.description, material: p.material, weight: p.weight, price: p.price, notes: p.notes || '', priceHistory: p.price_history || [], changes: p.changes || [], active: p.active !== false };
}
function unmapProduto(p) {
  return { id: p.id, name: p.name, category: p.category, description: p.description, material: p.material, weight: p.weight, price: p.price, notes: p.notes, price_history: p.priceHistory || [], changes: p.changes || [], active: p.active !== false };
}
function mapCompra(c) {
  return { id: c.id, date: c.date, caixaDate: c.caixa_date, caixaSessionId: c.caixa_session_id, pessoaId: c.pessoa_id, pessoaName: c.pessoa_name, totalPrice: c.total_price, paymentMethod: c.payment_method || 'dinheiro', notes: c.notes || '', items: typeof c.items === 'string' ? JSON.parse(c.items) : (c.items || []) };
}
function unmapCompra(c) {
  return { id: c.id, date: c.date, caixa_date: c.caixaDate, caixa_session_id: c.caixaSessionId, pessoa_id: c.pessoaId, pessoa_name: c.pessoaName || '', total_price: c.totalPrice, payment_method: c.paymentMethod || 'dinheiro', notes: c.notes, items: c.items };
}
function mapSessao(s) {
  return { id: s.id, date: s.date, periodo: s.periodo, status: s.status, abertura: s.saldo_inicial || 0, suprimentos: [], abertoEm: s.aberto_em ? new Date(s.aberto_em).toLocaleString('pt-BR') : '', fechadoEm: s.fechado_em ? new Date(s.fechado_em).toLocaleString('pt-BR') : '', aberto_em: s.aberto_em, fechado_em: s.fechado_em, saldoFinal: s.saldo_final, obsAbertura: s.observacao || '', obsFechamento: '' };
}
function unmapSessao(s, data) {
  return { id: s.id, date: data, periodo: s.periodo, status: s.status, aberto_em: s.abertoEm ? new Date(s.abertoEm.split('/').reverse().join('-')) : new Date().toISOString(), fechado_em: s.fechadoEm ? new Date(s.fechadoEm.split('/').reverse().join('-')).toISOString() : null, saldo_inicial: s.abertura || 0, saldo_final: s.saldoFinal || null, observacao: s.obsAbertura || '' };
}

// ======================== CRUD PRODUTOS ========================
async function dbFetchProdutos() {
  const sb = getSupabase();
  if (!sb) return [];
  const { data, error } = await sb.from('produtos').select('*').order('id');
  if (error) { console.error('dbFetchProdutos:', error.message); return []; }
  return (data || []).map(mapProduto);
}

async function dbSaveProduto(produto) {
  const sb = getSupabase();
  if (!sb) return null;
  const record = unmapProduto(produto);
  const { data, error } = await sb.from('produtos').upsert(record).select().single();
  if (error) { console.error('dbSaveProduto:', error.message); return null; }
  return mapProduto(data);
}

async function dbSetProdutoActive(id, active) {
  const sb = getSupabase();
  if (!sb) return false;
  const { error } = await sb.from('produtos').update({ active: !!active }).eq('id', id);
  if (error) { console.error('dbSetProdutoActive:', error.message); return false; }
  return true;
}

async function dbDeleteProduto(id) {
  const sb = getSupabase();
  if (!sb) return false;
  const { error } = await sb.from('produtos').delete().eq('id', id);
  if (error) { console.error('dbDeleteProduto:', error.message); return false; }
  return true;
}

// ======================== CRUD PESSOAS ========================
async function dbFetchPessoas() {
  const sb = getSupabase();
  if (!sb) return [];
  const { data, error } = await sb.from('pessoas').select('*').order('id');
  if (error) { console.error('dbFetchPessoas:', error.message); return []; }
  return data || [];
}

async function dbSavePessoa(pessoa) {
  const sb = getSupabase();
  if (!sb) return null;
  const { data, error } = await sb.from('pessoas').upsert(pessoa).select().single();
  if (error) { console.error('dbSavePessoa:', error.message); return null; }
  return data;
}

async function dbSetPessoaActive(id, active) {
  const sb = getSupabase();
  if (!sb) return false;
  const { error } = await sb.from('pessoas').update({ active: !!active }).eq('id', id);
  if (error) { console.error('dbSetPessoaActive:', error.message); return false; }
  return true;
}

async function dbDeletePessoa(id) {
  const sb = getSupabase();
  if (!sb) return false;
  const { error } = await sb.from('pessoas').delete().eq('id', id);
  if (error) { console.error('dbDeletePessoa:', error.message); return false; }
  return true;
}

// ======================== CRUD COMPRAS ========================
async function dbFetchCompras() {
  const sb = getSupabase();
  if (!sb) return [];
  const { data, error } = await sb.from('compras').select('*').order('id', { ascending: true });
  if (error) { console.error('dbFetchCompras:', error.message); return []; }
  return (data || []).map(mapCompra);
}

async function dbSaveCompra(compra) {
  const sb = getSupabase();
  if (!sb) return null;
  const record = unmapCompra(compra);
  const { data, error } = await sb.from('compras').upsert(record).select().single();
  if (error) { console.error('dbSaveCompra:', error.message); return null; }
  return mapCompra(data);
}

// ======================== CRUD CANCELAMENTOS DE COMPRAS ========================
function mapCancelamento(c) {
  return {
    compraId: c.compra_id,
    motivo: c.motivo || '',
    canceladoPor: c.cancelado_por || '',
    canceladoEm: c.cancelado_em,
    metodoDevolucao: c.metodo_devolucao || 'dinheiro',
    valorEstornado: Number(c.valor_estornado) || 0,
    caixaDate: c.caixa_date || null,
    caixaSessionId: c.caixa_session_id != null ? c.caixa_session_id : null,
  };
}

async function dbFetchCancelamentos() {
  const sb = getSupabase();
  if (!sb) return [];
  const { data, error } = await sb.from('compras_cancelamentos').select('*').order('cancelado_em', { ascending: false });
  if (error) { console.error('dbFetchCancelamentos:', error.message); return []; }
  return (data || []).map(mapCancelamento);
}

async function dbSaveCancelamento(rec) {
  const sb = getSupabase();
  if (!sb) return null;
  const { data, error } = await sb.from('compras_cancelamentos')
    .insert({
      compra_id: rec.compraId,
      motivo: rec.motivo,
      cancelado_por: rec.canceladoPor,
      metodo_devolucao: rec.metodoDevolucao || 'dinheiro',
      valor_estornado: rec.valorEstornado != null ? rec.valorEstornado : 0,
      caixa_date: rec.caixaDate || null,
      caixa_session_id: rec.caixaSessionId != null ? rec.caixaSessionId : null,
    })
    .select().single();
  if (error) { console.error('dbSaveCancelamento:', error.message); return null; }
  return mapCancelamento(data);
}

// ======================== CRUD CAIXA SESSÕES ========================
async function dbFetchSessoes(date) {
  const sb = getSupabase();
  if (!sb) return [];
  const { data, error } = await sb.from('caixa_sessoes').select('*').eq('date', date).order('id');
  if (error) { console.error('dbFetchSessoes:', error.message); return []; }
  const sessoes = (data || []).map(mapSessao);
  for (const s of sessoes) {
    const sups = await dbFetchSuprimentos(s.id, date);
    s.suprimentos = sups;
  }
  return sessoes;
}

async function dbFetchAllSessoes() {
  const sb = getSupabase();
  if (!sb) return [];
  const { data, error } = await sb.from('caixa_sessoes').select('*').order('date', { ascending: false });
  if (error) { console.error('dbFetchAllSessoes:', error.message); return []; }
  const sessoes = (data || []).map(mapSessao);
  for (const s of sessoes) {
    const sups = await dbFetchSuprimentos(s.id, s.date);
    s.suprimentos = sups;
  }
  return sessoes;
}

async function dbSaveSessao(sessao, date) {
  const sb = getSupabase();
  if (!sb) return null;
  const record = unmapSessao(sessao, date);
  const { data, error } = await sb.from('caixa_sessoes').upsert(record).select().single();
  if (error) { console.error('dbSaveSessao:', error.message); return null; }
  return data;
}

// ======================== CRUD SUPRIMENTOS ========================
async function dbFetchSuprimentos(sessionId, date) {
  const sb = getSupabase();
  if (!sb) return [];
  const { data, error } = await sb.from('caixa_suprimentos')
    .select('*').eq('session_id', sessionId).eq('date', date).order('id');
  if (error) { console.error('dbFetchSuprimentos:', error.message); return []; }
  return (data || []).map(x => ({ amount: x.amount, description: x.description || '', timestamp: x.created_at ? new Date(x.created_at).toLocaleTimeString('pt-BR') : '' }));
}

async function dbSaveSuprimento(sessionId, date, amount, description) {
  const sb = getSupabase();
  if (!sb) return null;
  const { data, error } = await sb.from('caixa_suprimentos').insert({ session_id: sessionId, date, amount, description }).select().single();
  if (error) { console.error('dbSaveSuprimento:', error.message); return null; }
  return data;
}

// ======================== CONFIG ========================
async function dbLoadAllConfig() {
  const sb = getSupabase();
  if (!sb) return {};
  const { data, error } = await sb.from('config').select('*');
  if (error) { console.error('dbLoadAllConfig:', error.message); return {}; }
  const cfg = {};
  (data || []).forEach(c => cfg[c.key] = c.value);
  return cfg;
}

async function dbSetConfig(key, value) {
  const sb = getSupabase();
  if (!sb) return;
  const { error } = await sb.from('config').upsert({ key, value });
  if (error) console.error('dbSetConfig:', error.message);
}

// ======================== CONNECTION TEST ========================
async function dbTestConnection() {
  const sb = getSupabase();
  if (!sb) return { ok: false, error: 'Cliente Supabase nao inicializado' };
  try {
    const { data, error } = await sb.from('config').select('key').limit(1);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

// ======================== BOOTSTRAP ========================
async function dbBootstrap() {
  const sb = getSupabase();
  if (!sb) return null;
  try {
    const [produtos, pessoas, compras, cancelamentos, config] = await Promise.all([
      dbFetchProdutos(), dbFetchPessoas(), dbFetchCompras(), dbFetchCancelamentos(), dbLoadAllConfig(),
    ]);
    return { produtos, pessoas, compras, cancelamentos, config };
  } catch (e) {
    console.error('Erro ao carregar dados do Supabase:', e);
    return null;
  }
}

// ======================== REALTIME ========================
function dbSubscribe(tables, callback) {
  return supabaseManager.dbSubscribe(tables, callback);
}

function dbUnsubscribeAll() {
  supabaseManager.dbUnsubscribeAll();
}
