// ======================== COMPROVANTE / IMPRESSÃO ========================
let printPurchaseId = null;
let printFormat = 'bobina';
let printAfterSave = false;
let printViewOnly = false;

function getCompraById(id) { return purchases.find(p => p.id === id); }

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

const CPV_PRINT_CSS = `
.cpv-doc, .cpv-doc *{box-sizing:border-box}
.cpv-doc{color:#111;font-family:'Courier New',Courier,monospace}
@media screen{.cpv-doc.bobina{width:270px}}
.cpv-doc.bobina{max-width:100%;margin:0 auto;padding:4px 6px;font-size:11px;line-height:1.4;overflow-wrap:break-word;word-break:break-word}
.cpv-doc.bobina, .cpv-doc.bobina *{font-weight:700 !important;color:#000 !important}
.cpv-doc .cpv-cancel-banner{border:2px solid #B91C1C;color:#B91C1C;text-align:center;font-weight:700;font-size:12px;padding:4px;margin-bottom:4px}
.cpv-doc .cpv-cancel-info{text-align:center;font-size:10px;line-height:1.5;overflow-wrap:break-word;word-break:break-word}
.cpv-doc.bobina .cpv-cancel-banner, .cpv-doc.bobina .cpv-cancel-banner *{color:#000 !important;border-color:#000 !important}
.cpv-doc.bobina .cpv-head{text-align:center}
.cpv-doc.bobina .cpv-brand{font-size:15px;font-weight:700;letter-spacing:1px}
.cpv-doc.bobina .cpv-brand-sub{font-size:10px;color:#333}
.cpv-doc.bobina .cpv-title{margin-top:6px;font-size:12px;font-weight:700;text-align:center}
.cpv-doc.bobina .cpv-meta{margin-top:4px;font-size:10px;text-align:center;color:#222}
.cpv-doc .cpv-rule{border-top:1px dashed #999;margin:6px 0}
.cpv-doc.bobina .cpv-item{margin-bottom:4px;font-size:10px}
.cpv-doc.bobina .cpv-item .cpv-item-name{font-weight:700}
.cpv-doc.bobina .cpv-item .cpv-item-line{display:flex;justify-content:space-between;align-items:baseline;gap:6px}
.cpv-doc.bobina .cpv-item .cpv-item-line span:first-child{flex:1 1 auto;min-width:0;overflow-wrap:break-word}
.cpv-doc.bobina .cpv-item .cpv-item-line span:last-child{flex-shrink:0;white-space:nowrap}
.cpv-doc.bobina .cpv-total{display:flex;justify-content:space-between;font-size:13px;font-weight:700;margin-top:4px}
.cpv-doc.bobina .cpv-total span:first-child{flex:1 1 auto;min-width:0}
.cpv-doc.bobina .cpv-total span:last-child{flex-shrink:0;white-space:nowrap}
.cpv-doc.bobina .cpv-lines{margin-top:6px;font-size:10px}
.cpv-doc.bobina .cpv-lines div{display:flex;justify-content:space-between;gap:8px;margin:2px 0;min-width:0}
.cpv-doc.bobina .cpv-lines div > span:first-child{flex:0 0 auto;overflow-wrap:break-word}
.cpv-doc.bobina .cpv-lines div > span:last-child{flex:1 1 auto;min-width:0;text-align:right;overflow-wrap:break-word}
.cpv-doc.bobina .cpv-lines .cpv-lb{font-weight:700}
.cpv-doc.bobina .cpv-lines .cpv-num{white-space:nowrap;flex-shrink:0}
.cpv-doc.bobina .cpv-lines .cpv-sub{font-size:9px;color:#444;line-height:1.3;margin:-1px 0 4px;text-align:left}
.cpv-doc.bobina .cpv-total-caixa{display:flex;justify-content:space-between;font-size:13px;font-weight:700;margin-top:6px}
.cpv-doc.bobina .cpv-total-caixa span:first-child{flex:1 1 auto;min-width:0}
.cpv-doc.bobina .cpv-total-caixa span:last-child{flex-shrink:0;white-space:nowrap}
.cpv-doc.bobina .cpv-obs{margin-top:6px;font-size:10px;white-space:pre-wrap;overflow-wrap:break-word}
.cpv-doc.bobina .cpv-foot{margin-top:10px;text-align:center;font-size:10px}
.cpv-doc.bobina .cpv-foot strong{font-size:11px}
.cpv-doc.bobina .cpv-note{margin-top:8px;text-align:center;font-size:10px;font-weight:700;letter-spacing:1px}
.cpv-doc.bobina .cpv-logo{margin-top:12px;text-align:center}
.cpv-doc.bobina .cpv-logo img{max-width:150px;height:auto;display:inline-block}
.cpv-doc.a4{font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.5;color:#111}
.cpv-doc.a4 .cpv-a4-head{width:100%;border-collapse:collapse}
.cpv-doc.a4 .cpv-brand{font-size:20px;font-weight:800;color:#1F376B}
.cpv-doc.a4 .cpv-brand-sub{font-size:11px;color:#555}
.cpv-doc.a4 .cpv-emit{font-size:11px;color:#555;text-align:right}
.cpv-doc.a4 .cpv-a4-title{margin:12px 0 8px;font-size:16px;font-weight:800;color:#1F376B;text-align:center;letter-spacing:1px}
.cpv-doc.a4 .cpv-a4-meta{width:100%;border-collapse:collapse;margin-bottom:12px}
.cpv-doc.a4 .cpv-a4-meta td{border:1px solid #D1D5DB;padding:5px 8px;font-size:12px}
.cpv-doc.a4 .cpv-a4-meta td.k{background:#F3F4F6;font-weight:700;width:110px}
.cpv-doc.a4 .doc-table{width:100%;border-collapse:collapse}
.cpv-doc.a4 .doc-table th,.cpv-doc.a4 .doc-table td{border:1px solid #D1D5DB;padding:5px 8px;font-size:12px}
.cpv-doc.a4 .doc-table th{background:#F3F4F6;font-weight:700;text-align:left}
.cpv-doc.a4 .doc-table td.ta-r,.cpv-doc.a4 .doc-table th.ta-r{text-align:right}
.cpv-doc.a4 .cpv-a4-total{display:flex;justify-content:space-between;align-items:center;margin-top:10px;padding:10px 12px;background:#F8FAFC;border:1px solid #D1D5DB;border-radius:4px}
.cpv-doc.a4 .cpv-a4-total span{font-size:14px;font-weight:700}
.cpv-doc.a4 .cpv-a4-total .cpv-total-val{font-size:18px;color:#1F376B}
.cpv-doc.a4 .cpv-a4-obs{margin-top:12px;font-size:12px;white-space:pre-wrap}
.cpv-doc.a4 .cpv-sign{margin-top:60px;font-size:12px;text-align:center}
.cpv-doc.a4 .cpv-sign .cpv-sign-line{display:inline-block;border-top:1px solid #111;padding-top:4px;min-width:260px}
.cpv-doc.a4 .cpv-a4-note{margin-top:14px;font-size:11px;text-align:center;color:#555;font-style:italic}
.cpv-doc.a4 .cpv-foot{margin-top:24px;font-size:10px;color:#6B7280;text-align:center}
`;

function cpvPageCss(formato) {
  if (formato === 'a4') return '@media print{@page{size:A4;margin:14mm}.cpv-doc.a4{width:100%}}';
  return '@page{size:72mm 297mm;margin:0}@media print{html,body{margin:0;padding:0}.cpv-doc.bobina{width:72mm;margin:0 auto}}';
}

function gerarDocumentoCompra(p, formato, comEstilo) {
  const bobina = formato !== 'a4';
  const nome = appConfig.pdf_company_name || 'Metal Minas';
  const cnpj = appConfig.pdf_cnpj || '';
  const pagamento = p.paymentMethod === 'pix' ? 'Pix' : 'Dinheiro';
  const emitido = new Date().toLocaleString('pt-BR');
  const dataFmt = formatDate(p.date);
  const produtos = p.items || [];
  const total = p.totalPrice || produtos.reduce((s, it) => s + it.totalPrice, 0);
  const ci = (typeof getCompraCancelamento === 'function') ? getCompraCancelamento(p.id) : null;
  const cancelHtml = ci ? `<div class="cpv-cancel-banner">DOCUMENTO CANCELADO</div>
    <div class="cpv-cancel-info">Motivo: ${esc(ci.motivo)}<br>Cancelado por: ${esc(ci.canceladoPor || '-')} em ${ci.canceladoEm ? new Date(ci.canceladoEm).toLocaleString('pt-BR') : '-'}</div>` : '';

  let body;
  if (bobina) {
    const itens = produtos.map(it => `
      <div class="cpv-item">
        <div class="cpv-item-name">${esc(it.productName)}</div>
        <div class="cpv-item-line"><span>${formatNumber(it.quantity)} kg &times; R$ ${formatNumber(it.unitPrice)}</span><span>${formatNumber(it.totalPrice)}</span></div>
      </div>`).join('');
    body = `
      <div class="cpv-doc bobina">
        <div class="cpv-head">
          <div class="cpv-brand">${esc(nome)}</div>
          ${cnpj ? `<div class="cpv-brand-sub">CNPJ ${esc(cnpj)}</div>` : ''}
          <div class="cpv-title">COMPROVANTE DE COMPRA</div>
          <div class="cpv-meta">Compra #${p.id} &middot; ${dataFmt}</div>
        </div>
        <div class="cpv-rule"></div>
        ${cancelHtml}
        ${itens}
        <div class="cpv-rule"></div>
        <div class="cpv-total"><span>TOTAL</span><span>R$ ${formatNumber(total)}</span></div>
        <div class="cpv-lines">
          <div><span class="cpv-lb">Pagamento</span><span>${pagamento}</span></div>
          ${p.pessoaName ? `<div><span class="cpv-lb">Pessoa</span><span>${esc(p.pessoaName)}</span></div>` : ''}
          <div><span class="cpv-lb">Emiss&atilde;o</span><span>${emitido}</span></div>
        </div>
        ${p.notes ? `<div class="cpv-obs">Obs: ${esc(p.notes)}</div>` : ''}
        <div class="cpv-rule"></div>
        <div class="cpv-note">N&Atilde;O &Eacute; DOCUMENTO FISCAL</div>
        <div class="cpv-foot"><strong>Obrigado pela prefer&ecirc;ncia!</strong><br>Comp Vision &mdash; Sistema de Compras</div>
        <div class="cpv-logo"><img src="mm_bw.png" alt="${esc(nome)}"></div>
      </div>`;
  } else {
    const itens = `
      <table class="doc-table">
        <thead><tr><th>Produto</th><th class="ta-r">Qtd (kg)</th><th class="ta-r">R$/kg</th><th class="ta-r">Total</th></tr></thead>
        <tbody>${produtos.map(it => `
          <tr><td>${esc(it.productName)}</td><td class="ta-r">${formatNumber(it.quantity)}</td><td class="ta-r">${formatNumber(it.unitPrice)}</td><td class="ta-r">${formatNumber(it.totalPrice)}</td></tr>`).join('')}
        </tbody>
      </table>`;
    body = `
      <div class="cpv-doc a4">
        <table class="cpv-a4-head">
          <tr>
            <td><div class="cpv-brand">${esc(nome)}</div><div class="cpv-brand-sub">${cnpj ? 'CNPJ ' + esc(cnpj) : ''}</div></td>
            <td class="cpv-emit">Emitido em: ${emitido}</td>
          </tr>
        </table>
        <div class="cpv-rule"></div>
        <div class="cpv-a4-title">COMPROVANTE DE COMPRA</div>
        ${cancelHtml}
        <table class="cpv-a4-meta">
          <tr><td class="k">Compra n&ordm;</td><td>#${p.id}</td><td class="k">Data</td><td>${dataFmt}</td></tr>
          <tr><td class="k">Pessoa</td><td colspan="3">${esc(p.pessoaName || '-')}</td></tr>
          <tr><td class="k">Pagamento</td><td colspan="3">${pagamento}</td></tr>
        </table>
        ${itens}
        <div class="cpv-a4-total"><span>Valor Total</span><span class="cpv-total-val">R$ ${formatNumber(total)}</span></div>
        ${p.notes ? `<div class="cpv-a4-obs"><strong>Observa&ccedil;&otilde;es:</strong><br>${esc(p.notes)}</div>` : ''}
        <div class="cpv-a4-note">N&atilde;o &eacute; documento fiscal.</div>
        <div class="cpv-sign"><span class="cpv-sign-line">Assinatura do fornecedor</span></div>
        <div class="cpv-foot">Documento gerado pelo Comp Vision &mdash; ${esc(nome)}</div>
      </div>`;
  }

  return comEstilo ? '<style>' + CPV_PRINT_CSS + '</style>' + body : body;
}

function montarHTMLImpressao(p, formato) {
  const nome = appConfig.pdf_company_name || 'Metal Minas';
  return '<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><title>Comprovante de Compra #' + p.id + ' - ' + esc(nome) + '</title><style>' + cpvPageCss(formato) + 'body{margin:0;background:#fff}' + CPV_PRINT_CSS + '</style></head><body>' + gerarDocumentoCompra(p, formato, false) + '</body></html>';
}

function getPrintPrefs() {
  try {
    return {
      format: localStorage.getItem('cv_print_format') === 'a4' ? 'a4' : 'bobina',
      direct: localStorage.getItem('cv_print_direct') === '1',
    };
  } catch (e) { return { format: 'bobina', direct: false }; }
}

function setPrintDefaultFormat(fmt) {
  const f = fmt === 'a4' ? 'a4' : 'bobina';
  printFormat = f;
  try { localStorage.setItem('cv_print_format', f); } catch (e) {}
}

function setPrintDirect(enabled) {
  try { localStorage.setItem('cv_print_direct', enabled ? '1' : '0'); } catch (e) {}
  const status = document.getElementById('printDirectStatus');
  if (status) {
    status.textContent = enabled ? 'Ativada' : 'Desativada';
    status.className = 'badge ' + (enabled ? 'badge-green' : 'badge-gray');
  }
}

function renderPrintPreview() {
  const preview = document.getElementById('printPreview');
  if (!preview) return;
  const p = getCompraById(printPurchaseId);
  preview.className = 'print-preview format-' + printFormat;
  preview.innerHTML = p ? gerarDocumentoCompra(p, printFormat, true) : '';
}

function openPrintModal(purchase, opts) {
  printPurchaseId = purchase.id;
  printAfterSave = !!(opts && opts.afterSave);
  printViewOnly = !!(opts && opts.viewOnly);
  printFormat = getPrintPrefs().format;
  document.getElementById('printModalTitle').textContent = 'Comprovante de Compra #' + purchase.id;
  document.getElementById('printModalMessage').textContent = printViewOnly
    ? 'Visualiza\u00e7\u00e3o do comprovante desta compra.'
    : (printAfterSave
        ? 'Compra registrada com sucesso. Deseja imprimir o comprovante?'
        : 'Visualize o comprovante e, se quiser, imprima em bobina ou A4.');
  document.getElementById('printModalCancelText').textContent = (printAfterSave && !printViewOnly) ? 'Somente Salvar' : 'Fechar';
  const printBtn = document.getElementById('printModalPrintBtn');
  if (printBtn) printBtn.style.display = printViewOnly ? 'none' : 'inline-flex';
  setPrintFormat(printFormat);
  document.getElementById('printModalOverlay').classList.add('open');
  document.body.style.overflow = 'hidden';
  setTimeout(() => { if (typeof lucide !== 'undefined') lucide.createIcons(); }, 50);
}

function closePrintModal() {
  document.getElementById('printModalOverlay').classList.remove('open');
  document.body.style.overflow = '';
  printPurchaseId = null;
  printViewOnly = false;
}

function setPrintFormat(fmt) {
  printFormat = fmt === 'a4' ? 'a4' : 'bobina';
  try { localStorage.setItem('cv_print_format', printFormat); } catch (e) {}
  document.querySelectorAll('.print-format-option').forEach(el => {
    el.classList.toggle('active', el.dataset.format === printFormat);
  });
  const tip = document.getElementById('printBobinaTip');
  if (tip) tip.style.display = printFormat === 'bobina' ? 'block' : 'none';
  renderPrintPreview();
}

function doPrintPurchase() {
  const p = getCompraById(printPurchaseId);
  if (!p) return;
  closePrintModal();
  imprimirDocumento(p, printFormat);
}

function verCompraDoc(id) {
  const p = getCompraById(id);
  if (p) openPrintModal(p, { afterSave: false, viewOnly: true });
}

function imprimirCompraDoc(id) {
  const p = getCompraById(id);
  if (p) openPrintModal(p, { afterSave: false });
}

function addCanvasToPdf(pdf, canvas, x, y, imgW, imgH, pageH) {
  const ratio = canvas.height / imgH;
  const cortarImg = (sy, sh) => {
    const c = document.createElement('canvas');
    c.width = canvas.width;
    c.height = sh;
    c.getContext('2d').drawImage(canvas, 0, sy, canvas.width, sh, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.92);
  };
  let sy = 0;
  let yy = y;
  while (sy < imgH) {
    const sh = Math.min(pageH - yy, imgH - sy);
    pdf.addImage(cortarImg(Math.round(sy * ratio), Math.round(sh * ratio)), 'JPEG', x, yy, imgW, sh);
    sy += sh;
    if (sy < imgH) { pdf.addPage(); yy = 0; }
  }
}

async function salvarCompraPDF() {
  const p = getCompraById(printPurchaseId);
  if (!p) return;
  if (!window.jspdf || !window.html2canvas) {
    showAlert('Biblioteca de PDF n\u00e3o carregada. Verifique sua conex\u00e3o e recarregue a p\u00e1gina.');
    return;
  }
  const { jsPDF } = window.jspdf;
  const formato = printFormat === 'a4' ? 'a4' : 'bobina';
  const holder = document.createElement('div');
  holder.style.cssText = 'position:absolute;left:-12000px;top:0;background:#fff;z-index:-1;' + (formato === 'a4' ? 'width:760px;' : '');
  holder.innerHTML = gerarDocumentoCompra(p, formato, true);
  document.body.appendChild(holder);
  const docEl = holder.querySelector('.cpv-doc');
  if (formato === 'bobina') {
    docEl.style.width = '72mm';
    docEl.style.maxWidth = '72mm';
    docEl.style.margin = '0';
  }
  try {
    const canvas = await html2canvas(docEl, { scale: 2, backgroundColor: '#ffffff', useCORS: true, windowWidth: docEl.scrollWidth, windowHeight: docEl.scrollHeight });
    if (formato === 'a4') {
      const pdf = new jsPDF({ unit: 'pt', format: 'a4' });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const margin = 28;
      const imgW = pageW - margin * 2;
      const imgH = canvas.height * imgW / canvas.width;
      addCanvasToPdf(pdf, canvas, margin, margin, imgW, imgH, pageH);
      pdf.save('Comprovante_Compra_' + p.id + '.pdf');
    } else {
      const pdfH = Math.max(30, Math.ceil(canvas.height * 72 / canvas.width));
      const pdf = new jsPDF({ unit: 'mm', format: [72, pdfH] });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const imgW = pageW;
      const imgH = canvas.height * imgW / canvas.width;
      addCanvasToPdf(pdf, canvas, 0, 0, imgW, imgH, pageH);
      pdf.save('Comprovante_Compra_' + p.id + '_Bobina.pdf');
    }
    showNotification('PDF gerado com sucesso', 'success');
  } catch (e) {
    console.error('Erro ao gerar PDF:', e);
  } finally {
    document.body.removeChild(holder);
  }
}

function imprimirDocumento(p, formato) {
  imprimirHtml(montarHTMLImpressao(p, formato), formato);
}

function imprimirHtml(html, formato) {
  let frame = document.getElementById('printFrame');
  if (!frame) {
    frame = document.createElement('iframe');
    frame.id = 'printFrame';
    frame.style.cssText = 'position:fixed;right:0;bottom:0;width:300px;height:600px;border:0;visibility:hidden;';
    document.body.appendChild(frame);
  }
  frame.onload = function () {
    const w = frame.contentWindow;
    if (!w) return;
    setTimeout(() => {
      try {
        if (formato === 'bobina' && w.document && w.document.querySelector) {
          const doc = w.document;
          const el = doc.querySelector('.cpv-doc.bobina');
          if (el && el.scrollHeight > 0) {
            // Largura imprimível da i8 (72,1mm). Página sempre retrato: altura > largura.
            // Mínimo de 76mm de altura para nunca ficar "deitada" mesmo em cupons curtos.
            const hmm = Math.max(76, Math.ceil(el.scrollHeight / 96 * 25.4));
            const st = doc.createElement('style');
            st.textContent = '@page{size:72mm ' + (hmm + 4) + 'mm;margin:0}@media print{html,body{margin:0;padding:0}}';
            doc.head.appendChild(st);
          }
        }
        w.focus(); w.print();
      } catch (e) { console.error('Erro ao imprimir:', e); }
    }, 100);
  };
  frame.srcdoc = html;
}

// ======================== FECHAMENTO DE CAIXA (BOBINA) ========================
function gerarDocumentoFechamentoCaixa(data, sessao) {
  const nome = appConfig.pdf_company_name || 'Metal Minas';
  const cnpj = appConfig.pdf_cnpj || '';
  const compras = getComprasDaSessao(data, sessao.id);
  const comprasDinheiro = compras.filter(p => p.paymentMethod !== 'pix');
  const estornos = getEstornosDaSessao(data, sessao.id);
  const estornosDinheiro = getTotalEstornosMetodo(data, sessao.id, 'dinheiro');
  const totalSaidas = comprasDinheiro.reduce((s, p) => s + p.totalPrice, 0);
  const totalSupr = getTotalSuprimentos(sessao);
  const saldo = sessao.abertura + totalSupr + estornosDinheiro - totalSaidas;
  const pixCompras = getPixComprasDaSessao(data, sessao.id);
  const pixTotal = pixCompras.reduce((s, p) => s + p.totalPrice, 0);
  const canceladas = getComprasDaSessao(data, sessao.id).filter(p => isCompraCancelada(p.id));
  const statusLabel = sessao.status === 'aberto' ? 'Aberto' : 'Fechado';
  const dataFmt = formatDate(data);
  const emitido = new Date().toLocaleString('pt-BR');

  const itensDinheiro = comprasDinheiro.map(c => `
    <div><span>${esc(c.pessoaName || '-')}${isCompraCancelada(c.id) ? ' *CANCELADO*' : ''}</span><span class="cpv-num">R$ ${formatNumber(c.totalPrice)}</span></div>
    <div class="cpv-sub">${esc(c.items.map(it => it.productName).join(', '))}</div>`).join('');

  const itensPix = pixCompras.map(c => `
    <div><span>${esc(c.pessoaName || '-')}${isCompraCancelada(c.id) ? ' *CANCELADO*' : ''}</span><span class="cpv-num">R$ ${formatNumber(c.totalPrice)}</span></div>
    <div class="cpv-sub">${esc(c.items.map(it => it.productName).join(', '))}</div>`).join('');

  const estornosDinheiroHtml = estornos.filter(c => (c.metodoDevolucao || 'dinheiro') !== 'pix').map(c => {
    const original = getCompraById(c.compraId);
    return `<div><span>Devol. #${c.compraId}${original ? ' ' + esc(original.pessoaName || '') : ''}</span><span class="cpv-num">+R$ ${formatNumber(Number(c.valorEstornado) || 0)}</span></div>` + (c.motivo ? `<div class="cpv-sub">${esc(c.motivo)}</div>` : '');
  }).join('');

  const estornosPixHtml = estornos.filter(c => (c.metodoDevolucao || 'dinheiro') === 'pix').map(c => {
    const original = getCompraById(c.compraId);
    return `<div><span>Devol. #${c.compraId}${original ? ' ' + esc(original.pessoaName || '') : ''}</span><span class="cpv-num">+R$ ${formatNumber(Number(c.valorEstornado) || 0)}</span></div>` + (c.motivo ? `<div class="cpv-sub">${esc(c.motivo)}</div>` : '');
  }).join('');

  return `
    <div class="cpv-doc bobina">
      <div class="cpv-head">
        <div class="cpv-brand">${esc(nome)}</div>
        ${cnpj ? `<div class="cpv-brand-sub">CNPJ ${esc(cnpj)}</div>` : ''}
        <div class="cpv-title">FECHAMENTO DE CAIXA</div>
        <div class="cpv-meta">${dataFmt} &middot; ${esc(sessao.periodo)}</div>
      </div>
      <div class="cpv-rule"></div>
      <div class="cpv-lines">
        <div><span class="cpv-lb">Status</span><span>${statusLabel}</span></div>
        <div><span class="cpv-lb">Sess&atilde;o</span><span>#${sessao.id}</span></div>
        ${sessao.fechadoEm ? `<div><span class="cpv-lb">Fechado em</span><span>${esc(sessao.fechadoEm)}</span></div>` : ''}
      </div>

      <div class="cpv-rule"></div>
      <div class="cpv-title">DINHEIRO</div>
      <div class="cpv-lines">
        <div><span class="cpv-lb">Saldo inicial</span><span class="cpv-num">R$ ${formatNumber(sessao.abertura)}</span></div>
        <div><span class="cpv-lb">Suprimentos</span><span class="cpv-num">R$ ${formatNumber(totalSupr)}</span></div>
        <div><span class="cpv-lb">Sa\u00eddas (compras)</span><span class="cpv-num">R$ ${formatNumber(totalSaidas)}</span></div>
        ${estornosDinheiro > 0 ? `<div><span class="cpv-lb">Devolu\u00e7\u00f5es (entrada)</span><span class="cpv-num">+R$ ${formatNumber(estornosDinheiro)}</span></div>` : ''}
      </div>
      <div class="cpv-total-caixa"><span>Saldo em dinheiro</span><span class="cpv-num">R$ ${formatNumber(saldo)}</span></div>
      ${itensDinheiro ? `<div class="cpv-rule"></div>
      <div class="cpv-title" style="font-size:11px;margin-top:2px">COMPRAS (DINHEIRO)</div>
      <div class="cpv-lines">${itensDinheiro}</div>` : ''}
      ${estornosDinheiroHtml ? `<div class="cpv-title" style="font-size:11px;margin-top:2px">DEVOLU\u00c7\u00d5ES (DINHEIRO)</div>
      <div class="cpv-lines">${estornosDinheiroHtml}</div>` : ''}

      ${pixCompras.length || estornosPixHtml ? `<div class="cpv-rule"></div>
      <div class="cpv-title">PIX</div>
      ${itensPix ? `<div class="cpv-title" style="font-size:11px;margin-top:2px">COMPRAS (PIX)</div>
      <div class="cpv-lines">${itensPix}</div>` : ''}
      ${estornosPixHtml ? `<div class="cpv-title" style="font-size:11px;margin-top:2px">DEVOLU\u00c7\u00d5ES (PIX)</div>
      <div class="cpv-lines">${estornosPixHtml}</div>` : ''}
      <div class="cpv-lines"><div><span class="cpv-lb">Total Pix</span><span class="cpv-num">R$ ${formatNumber(pixTotal)}</span></div></div>` : ''}

      ${canceladas.length > 0 ? `<div class="cpv-rule"></div>
      <div class="cpv-lines"><div><span class="cpv-lb">Cancelados</span><span>${canceladas.length} doc.</span></div></div>` : ''}
      <div class="cpv-rule"></div>
      <div class="cpv-note">N&Atilde;O &Eacute; DOCUMENTO FISCAL</div>
      <div class="cpv-foot">Emitido em: ${emitido}<br><strong>Comp Vision</strong> &mdash; Sistema de Compras</div>
    </div>`;
}

function montarHTMLImpressaoFechamento(data, sessao) {
  return '<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><title>Fechamento de Caixa - ' + formatDate(data) + '</title><style>' + cpvPageCss('bobina') + 'body{margin:0;background:#fff}' + CPV_PRINT_CSS + '</style></head><body>' + gerarDocumentoFechamentoCaixa(data, sessao) + '</body></html>';
}

async function imprimirFechamentoBobina(data, sessionId) {
  let sessao = getSessao(data, sessionId);
  if (!sessao && typeof carregarSessoes === 'function') { await carregarSessoes(data); sessao = getSessao(data, sessionId); }
  if (!sessao) return;
  imprimirHtml(montarHTMLImpressaoFechamento(data, sessao), 'bobina');
}

function exportarFechamentoBobina() {
  if (!caixaCurrentData || caixaCurrentSessionId === null) return;
  imprimirFechamentoBobina(caixaCurrentData, caixaCurrentSessionId);
}
