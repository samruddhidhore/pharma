/* ============================================================
   BACKEND CONFIGURATION & API SERVICE MODULE
============================================================ */
const API_BASE_URL = 'http://localhost:5000/api'; // Replace with your production URL

class RxApiService {
  constructor() {
    this.token = localStorage.getItem('medcore_token') || null;
  }

  getHeaders() {
    const headers = { 'Content-Type': 'application/json' };
    if (this.token) headers['Authorization'] = `Bearer ${this.token}`;
    return headers;
  }

  async request(endpoint, options = {}) {
    options.headers = { ...this.getHeaders(), ...options.headers };
    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, options);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `API Error: ${response.statusText}`);
      }
      return await response.json();
    } catch (err) {
      console.error(`[API Error] ${endpoint}:`, err);
      throw err;
    }
  }

  // Dashboard / Stats
  getDashboardStats() { return this.request('/dashboard/stats'); }

  // Medicines (Inventory)
  getMedicines(query = '') { return this.request(`/medicines?q=${encodeURIComponent(query)}`); }
  createMedicine(data) { return this.request('/medicines', { method: 'POST', body: JSON.stringify(data) }); }
  updateMedicine(id, data) { return this.request(`/medicines/${id}`, { method: 'PUT', body: JSON.stringify(data) }); }
  deleteMedicine(id) { return this.request(`/medicines/${id}`, { method: 'DELETE' }); }

  // Bills
  getBills() { return this.request('/bills'); }
  createBill(billData) { return this.request('/bills', { method: 'POST', body: JSON.stringify(billData) }); }

  // OCR
  scanPrescription(file) {
    const formData = new FormData();
    formData.append('file', file);
    return fetch(`${API_BASE_URL}/ocr/scan-prescription`, {
      method: 'POST',
      headers: this.token ? { 'Authorization': `Bearer ${this.token}` } : {},
      body: formData
    }).then(res => res.json());
  }

  scanSupplierInvoice(file) {
    const formData = new FormData();
    formData.append('file', file);
    return fetch(`${API_BASE_URL}/ocr/scan-invoice`, {
      method: 'POST',
      headers: this.token ? { 'Authorization': `Bearer ${this.token}` } : {},
      body: formData
    }).then(res => res.json());
  }
}

const RxApi = new RxApiService();

/* ============================================================
   APPLICATION STATE & INITIALIZATION
============================================================ */
let medicines = [];
let recentBills = [];
let billItems = [];
let detectedRxItems = [];
let detectedInvItems = [];

const LOW_STOCK_THRESHOLD = 20;
const NEAR_EXPIRY_DAYS = 60;
const GST_RATE = 0.12;

document.addEventListener('DOMContentLoaded', () => {
  refreshAllData();
});

function daysLeft(dateStr){
  if(!dateStr) return 0;
  const diff = (new Date(dateStr) - new Date());
  return Math.ceil(diff / (1000*60*60*24));
}
function fmtDate(dateStr){
  if(!dateStr) return 'N/A';
  return new Date(dateStr).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' });
}
function fmtMoney(n){ return '₹' + Number(n||0).toLocaleString('en-IN', {minimumFractionDigits:2, maximumFractionDigits:2}); }
function stockStatus(m){
  const dl = daysLeft(m.expiry);
  if(dl < 0) return 'expired';
  if(dl <= NEAR_EXPIRY_DAYS) return 'near-expiry';
  if(m.qty < LOW_STOCK_THRESHOLD) return 'low';
  return 'ok';
}

/* ============================================================
   NAVIGATION & UI CONTROLS
============================================================ */
function goPage(pageId){
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const pageEl = document.getElementById('page-' + pageId);
  if(pageEl) pageEl.classList.add('active');
  
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const navEl = document.querySelector('.nav-item[data-page="' + pageId + '"]');
  if(navEl) navEl.classList.add('active');
  
  const titles = {
    dashboard:["Dashboard","Overview of today's counter activity"],
    scanner:["Prescription Scanner","OCR-assisted prescription reading"],
    billing:["Billing","Generate a patient invoice"],
    inventory:["Inventory","Full medicine stock register"],
    addstock:["Add Stock via OCR","Extract supplier invoices automatically"],
    expiry:["Expiry Management","Batch-level expiry tracking"]
  };
  if(titles[pageId]){
    document.getElementById('topbar-title').textContent = titles[pageId][0];
    document.getElementById('topbar-sub').textContent = titles[pageId][1];
  }

  refreshAllData();

  if(window.innerWidth <= 991) document.getElementById('sidebar').classList.remove('open');
  window.scrollTo({top:0, behavior:'smooth'});
}

document.querySelectorAll('.nav-item[data-page]').forEach(el=>{
  el.addEventListener('click', ()=> goPage(el.dataset.page));
});

async function refreshAllData(){
  try {
    const [fetchedMeds, fetchedBills] = await Promise.all([
      RxApi.getMedicines().catch(() => []),
      RxApi.getBills().catch(() => [])
    ]);
    
    medicines = fetchedMeds;
    recentBills = fetchedBills;

    renderDashboard();
    renderInventory();
    renderExpiry();
    renderBilling();
  } catch(e) {
    showToast("Failed to refresh server data", "danger", "bi-exclamation-triangle");
  }
}

/* ============================================================
   SEARCH & TOAST SYSTEM
============================================================ */
function handleGlobalSearch(q){
  q = q.trim().toLowerCase();
  if(!q) return;
  goPage('inventory');
  document.getElementById('invSearch').value = q;
  renderInventory();
}

function showToast(msg, type='primary', icon='bi-check-circle'){
  const wrap = document.createElement('div');
  wrap.className = 'toast align-items-center border-0 mb-2';
  wrap.setAttribute('role','alert');
  const colors = { primary:'var(--primary)', success:'var(--accent)', danger:'var(--danger)', warn:'var(--warn)' };
  wrap.style.background = 'var(--surface)';
  wrap.style.border = '1px solid var(--border)';
  wrap.style.borderLeft = '4px solid ' + (colors[type]||colors.primary);
  wrap.style.borderRadius = 'var(--radius-sm)';
  wrap.style.minWidth = '280px';
  wrap.innerHTML = `<div class="d-flex">
    <div class="toast-body" style="font-size:.85rem; color:var(--ink);"><i class="bi ${icon} me-2" style="color:${colors[type]||colors.primary}"></i>${msg}</div>
    <button type="button" class="btn-close me-2 m-auto" data-bs-dismiss="toast"></button>
  </div>`;
  document.getElementById('toastContainer').appendChild(wrap);
  const t = new bootstrap.Toast(wrap, { delay: 3200 });
  t.show();
  wrap.addEventListener('hidden.bs.toast', ()=> wrap.remove());
}

/* ============================================================
   LAYOUT CONTROLS
============================================================ */
document.getElementById('sidebarToggle').addEventListener('click', ()=>{
  document.getElementById('sidebar').classList.toggle('open');
});

document.getElementById('themeToggle').addEventListener('click', function(){
  const root = document.documentElement;
  const cur = root.getAttribute('data-theme');
  if(cur === 'dark'){ root.setAttribute('data-theme','light'); this.innerHTML = '<i class="bi bi-moon"></i>'; }
  else { root.setAttribute('data-theme','dark'); this.innerHTML = '<i class="bi bi-sun"></i>'; }
});

/* ============================================================
   DASHBOARD
============================================================ */
function renderDashboard(){
  const total = medicines.length;
  const totalStock = medicines.reduce((s,m)=>s+(m.qty||0),0);
  const lowStock = medicines.filter(m=>(m.qty||0) < LOW_STOCK_THRESHOLD && daysLeft(m.expiry) >= 0).length;
  const nearExpiry = medicines.filter(m=> daysLeft(m.expiry) >= 0 && daysLeft(m.expiry) <= NEAR_EXPIRY_DAYS).length;
  const expiredCount = medicines.filter(m=> daysLeft(m.expiry) < 0).length;
  const todaySales = recentBills.reduce((s,b)=>s+(b.total||0),0);

  const stats = [
    { label:'Total Medicines', value: total, icon:'bi-capsule', chip:'var(--primary-light)', fg:'var(--primary)', bar:'var(--primary)', trend:'+ active items' },
    { label:'Available Stock (units)', value: totalStock.toLocaleString('en-IN'), icon:'bi-boxes', chip:'var(--accent-light)', fg:'var(--accent)', bar:'var(--accent)', trend:'Live units' },
    { label:'Low Stock Items', value: lowStock, icon:'bi-exclamation-triangle', chip:'var(--warn-light)', fg:'var(--warn)', bar:'var(--warn)', trend:'Reorder needed', down:true },
    { label:'Near Expiry Batches', value: nearExpiry, icon:'bi-hourglass-split', chip:'var(--danger-light)', fg:'var(--danger)', bar:'var(--danger)', trend:'Within 60 days', down:true },
    { label:"Today's Sales", value: fmtMoney(todaySales), icon:'bi-graph-up-arrow', chip:'var(--primary-light)', fg:'var(--primary)', bar:'var(--primary)', trend:'Real-time sales' },
    { label:'Recent Bills', value: recentBills.length, icon:'bi-receipt', chip:'var(--accent-light)', fg:'var(--accent)', bar:'var(--accent)', trend: recentBills.length ? 'Last: ' + (recentBills[0].time || 'Today') : 'No bills yet' },
  ];

  document.getElementById('stat-grid').innerHTML = stats.map(s => `
    <div class="stat-card" style="--accent-bar:${s.bar}; --chip-bg:${s.chip}; --chip-fg:${s.fg};">
      <div class="top-row"><div class="icon-chip"><i class="bi ${s.icon}"></i></div></div>
      <div class="stat-num">${s.value}</div>
      <div class="stat-label">${s.label}</div>
      <div class="stat-trend ${s.down?'down':''}"><i class="bi ${s.down?'bi-arrow-down-short':'bi-arrow-up-short'}"></i>${s.trend}</div>
    </div>`).join('');
  document.getElementById('stat-grid').style.display = 'grid';
  document.getElementById('stat-grid').style.gridTemplateColumns = 'repeat(6, 1fr)';

  const low = medicines.filter(m=>(m.qty||0) < LOW_STOCK_THRESHOLD && daysLeft(m.expiry) >= 0).sort((a,b)=>a.qty-b.qty);
  document.getElementById('low-stock-table').innerHTML = `
    <thead><tr><th>Medicine</th><th>Batch</th><th>Qty left</th><th>Status</th></tr></thead>
    <tbody>${low.map(m=>`<tr><td><b>${m.name}</b></td><td>${m.batch}</td><td>${m.qty}</td><td>${badge('low')}</td></tr>`).join('') || emptyRow(4,'No low-stock items')}</tbody>`;

  const near = medicines.filter(m=> daysLeft(m.expiry) >= 0 && daysLeft(m.expiry) <= NEAR_EXPIRY_DAYS).sort((a,b)=>daysLeft(a.expiry)-daysLeft(b.expiry));
  document.getElementById('near-expiry-table').innerHTML = `
    <thead><tr><th>Medicine</th><th>Expiry</th><th>Days left</th></tr></thead>
    <tbody>${near.map(m=>`<tr><td><b>${m.name}</b></td><td>${fmtDate(m.expiry)}</td><td>${badge('near-expiry', daysLeft(m.expiry)+'d')}</td></tr>`).join('') || emptyRow(3,'Nothing expiring soon')}</tbody>`;

  document.getElementById('recent-bills-table').innerHTML = `
    <thead><tr><th>Bill ID</th><th>Patient</th><th>Items</th><th>Total</th><th>Payment</th><th>Time</th></tr></thead>
    <tbody>${recentBills.map(b=>`<tr><td><b>${b.id}</b></td><td>${b.patient}</td><td>${b.items}</td><td>${fmtMoney(b.total)}</td><td>${b.mode}</td><td>${b.time || 'N/A'}</td></tr>`).join('') || emptyRow(6, 'No recent bills recorded')}</tbody>`;

  document.getElementById('expiry-badge').textContent = expiredCount + nearExpiry;
}

function emptyRow(cols, text){ return `<tr><td colspan="${cols}" style="text-align:center; color:var(--ink-faint); padding:22px;">${text}</td></tr>`; }

function badge(status, extra){
  const map = {
    'ok': ['badge-ok','In stock'],
    'low': ['badge-warn','Low stock'],
    'near-expiry': ['badge-warn', extra ? extra+' left' : 'Near expiry'],
    'expired': ['badge-danger','Expired']
  };
  const [cls,label] = map[status];
  return `<span class="badge-status ${cls}"><span class="dot"></span>${label}</span>`;
}

/* ============================================================
   PRESCRIPTION SCANNER (OCR API INTEGRATION)
============================================================ */
let rxSelectedFile = null;
const rxFileInput = document.getElementById('rxFileInput');

rxFileInput.addEventListener('change', function(){
  if(this.files && this.files[0]){
    rxSelectedFile = this.files[0];
    const reader = new FileReader();
    reader.onload = e => {
      document.getElementById('rxPreviewBox').innerHTML = `<img src="${e.target.result}" alt="Prescription preview">`;
      document.getElementById('scanRxBtn').disabled = false;
      showToast('Prescription file ready to scan.', 'primary', 'bi-image');
    };
    reader.readAsDataURL(rxSelectedFile);
  }
});

document.getElementById('scanRxBtn').addEventListener('click', async function(){
  if(!rxSelectedFile) return;
  const btn = this;
  btn.disabled = true;
  btn.innerHTML = `<span class="spinner-border spinner-border-sm me-2"></span> Processing OCR...`;

  try {
    const response = await RxApi.scanPrescription(rxSelectedFile);
    detectedRxItems = response.items || [];
    
    document.getElementById('rxResults').style.display = 'block';
    document.getElementById('ocrTextBox').textContent = response.extractedText || 'No text extracted.';

    document.getElementById('rxDetectedBody').innerHTML = detectedRxItems.map(d => `
      <tr>
        <td><b>${d.name}</b></td>
        <td>${d.strength || 'N/A'}</td>
        <td>${d.dosage || 'N/A'}</td>
        <td>${d.qty || 1}</td>
        <td><div class="d-flex align-items-center gap-2">
          <div class="conf-bar"><span style="width:${d.confidence || 90}%; background:${(d.confidence||90)>=90?'var(--accent)':'var(--warn)'};"></span></div>
          <span style="font-size:.78rem; color:var(--ink-muted);">${d.confidence || 90}%</span>
        </div></td>
      </tr>`).join('');

    showToast(`Prescription scanned successfully.`, 'success', 'bi-check2-circle');
    document.getElementById('rxResults').scrollIntoView({behavior:'smooth', block:'nearest'});
  } catch(err) {
    showToast(err.message || 'OCR Processing failed', 'danger', 'bi-exclamation-triangle');
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<i class="bi bi-magic me-1"></i>Scan Prescription`;
  }
});

function verifyAndBill(){
  if(detectedRxItems.length === 0) return;
  billItems = detectedRxItems.map((d, i) => ({
    uid: 'b' + Date.now() + i,
    medId: d.medId || null,
    name: d.name,
    qty: d.qty || 1,
    price: d.price || 0
  }));
  goPage('billing');
  showToast('Medicines loaded into billing form.', 'primary', 'bi-arrow-right-circle');
}

/* ============================================================
   BILLING SYSTEM
============================================================ */
function renderBilling(){
  const body = document.getElementById('billBody');
  body.innerHTML = billItems.map(it => {
    const sub = it.qty * it.price;
    const gst = sub * GST_RATE;
    return `<tr data-uid="${it.uid}">
      <td style="min-width:170px;"><b>${it.name}</b></td>
      <td style="width:90px;"><input type="number" min="1" class="form-control form-control-pharm form-control-sm" style="padding:6px 8px;" value="${it.qty}" onchange="updateBillQty('${it.uid}', this.value)"></td>
      <td>${fmtMoney(it.price)}</td>
      <td>${fmtMoney(gst)}</td>
      <td><b>${fmtMoney(sub+gst)}</b></td>
      <td><button class="btn-sm-icon danger" onclick="removeBillRow('${it.uid}')"><i class="bi bi-trash3"></i></button></td>
    </tr>`;
  }).join('') || emptyRow(6,'No medicines added to bill. Click "Add medicine" or scan a prescription.');
  renderBillTotals();
}

function updateBillQty(uid, val){
  const it = billItems.find(b=>b.uid===uid);
  if(it) it.qty = Math.max(1, parseInt(val)||1);
  renderBilling();
}

function removeBillRow(uid){
  billItems = billItems.filter(b=>b.uid!==uid);
  renderBilling();
  showToast('Medicine removed from bill.', 'warn', 'bi-dash-circle');
}

function addBillRow(){
  if(medicines.length === 0){ showToast('Inventory is empty. Add medicines first.', 'danger', 'bi-exclamation-circle'); return; }
  const randomMed = medicines[Math.floor(Math.random() * medicines.length)];
  billItems.push({
    uid: 'b' + Date.now() + Math.random().toString(36).substr(2, 4),
    medId: randomMed.id,
    name: randomMed.name,
    qty: 1,
    price: randomMed.price
  });
  renderBilling();
}

function renderBillTotals(){
  const sub = billItems.reduce((s,it)=>s+it.qty*it.price,0);
  const gst = sub * GST_RATE;
  document.getElementById('billTotals').innerHTML = `
    <div class="row"><span>Subtotal</span><span>${fmtMoney(sub)}</span></div>
    <div class="row"><span>GST (12%)</span><span>${fmtMoney(gst)}</span></div>
    <div class="row total"><span>Total payable</span><span>${fmtMoney(sub+gst)}</span></div>`;
}

async function generateBill(){
  if(billItems.length === 0){ showToast('Add at least one medicine to the bill.', 'danger', 'bi-exclamation-circle'); return; }

  const sub = billItems.reduce((s,it)=>s+it.qty*it.price,0);
  const gst = sub * GST_RATE;
  const total = sub + gst;

  const payload = {
    patientName: document.getElementById('patName').value || 'Walk-in Patient',
    patientAge: document.getElementById('patAge').value || 'N/A',
    patientPhone: document.getElementById('patPhone').value || 'N/A',
    doctorName: document.getElementById('patDoctor').value || 'N/A',
    paymentMode: document.getElementById('patPayment').value,
    items: billItems,
    subtotal: sub,
    gst: gst,
    total: total
  };

  try {
    const createdBill = await RxApi.createBill(payload);

    document.getElementById('invoicePreviewContent').innerHTML = `
      <div class="inv-head">
        <div>
          <h4>MedCore RX</h4>
          <div style="font-size:.78rem; color:var(--ink-faint);">Shop 4, Wellness Plaza, Shegaon, Maharashtra · GSTIN 27ABCDE1234F1Z5</div>
        </div>
        <div class="inv-meta">
          <div><b>${createdBill.id || 'INV-SUCCESS'}</b></div>
          <div>${new Date().toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'})}</div>
        </div>
      </div>
      <div class="row mb-3" style="font-size:.85rem;">
        <div class="col-6"><b>Patient:</b> ${payload.patientName}<br><span style="color:var(--ink-muted);">${payload.patientAge} · ${payload.patientPhone}</span></div>
        <div class="col-6 text-md-end"><b>Doctor:</b> ${payload.doctorName}<br><span style="color:var(--ink-muted);">Payment: ${payload.paymentMode}</span></div>
      </div>
      <table>
        <thead><tr><th>Medicine</th><th>Qty</th><th>Unit price</th><th>GST</th><th>Subtotal</th></tr></thead>
        <tbody>${billItems.map(it=>{ const s=it.qty*it.price; const g=s*GST_RATE; return `<tr><td>${it.name}</td><td>${it.qty}</td><td>${fmtMoney(it.price)}</td><td>${fmtMoney(g)}</td><td>${fmtMoney(s+g)}</td></tr>`; }).join('')}</tbody>
      </table>
      <div class="inv-totals">
        <div class="row"><span>Subtotal</span><span>${fmtMoney(sub)}</span></div>
        <div class="row"><span>GST (12%)</span><span>${fmtMoney(gst)}</span></div>
        <div class="row total"><span>Total payable</span><span>${fmtMoney(total)}</span></div>
      </div>
      <div style="margin-top:22px; font-size:.76rem; color:var(--ink-faint); text-align:center;">Thank you for choosing MedCore RX · Get well soon</div>`;

    new bootstrap.Modal(document.getElementById('invoiceModal')).show();
    showToast('Bill successfully created and posted to server.', 'success', 'bi-receipt-cutoff');
    billItems = [];
    await refreshAllData();
  } catch(err) {
    showToast(err.message || 'Failed to submit bill to server', 'danger', 'bi-exclamation-triangle');
  }
}

/* ============================================================
   INVENTORY MANAGEMENT (API CONNECTED)
============================================================ */
function renderInventory(){
  const q = (document.getElementById('invSearch').value || '').toLowerCase();
  const list = medicines.filter(m => (m.name||'').toLowerCase().includes(q) || (m.batch||'').toLowerCase().includes(q));
  document.getElementById('inventoryBody').innerHTML = list.map(m => {
    const dl = daysLeft(m.expiry);
    const status = stockStatus(m);
    return `<tr>
      <td><b>${m.name}</b></td>
      <td>${m.batch || 'N/A'}</td>
      <td>${fmtDate(m.expiry)} <span style="color:var(--ink-faint); font-size:.74rem;">(${dl<0? 'expired' : dl+'d left'})</span></td>
      <td><b>${m.qty}</b></td>
      <td>${fmtMoney(m.price)}</td>
      <td>${badge(status)}</td>
      <td>
        <div class="d-flex gap-1">
          <button class="btn-sm-icon" onclick="openMedicineModal('${m.id}')" data-bs-toggle="modal" data-bs-target="#medicineModal"><i class="bi bi-pencil"></i></button>
          <button class="btn-sm-icon danger" onclick="deleteMedicine('${m.id}')"><i class="bi bi-trash3"></i></button>
        </div>
      </td>
    </tr>`;
  }).join('') || emptyRow(7,'No medicines match search criteria');
}

function openMedicineModal(id){
  const title = document.getElementById('medModalTitle');
  if(id){
    const m = medicines.find(x => String(x.id) === String(id));
    if(!m) return;
    title.textContent = 'Edit medicine';
    document.getElementById('medEditId').value = m.id;
    document.getElementById('medName').value = m.name;
    document.getElementById('medBatch').value = m.batch || '';
    document.getElementById('medExpiry').value = m.expiry ? m.expiry.slice(0,10) : '';
    document.getElementById('medQty').value = m.qty;
    document.getElementById('medPrice').value = m.price;
  } else {
    title.textContent = 'Add medicine';
    document.getElementById('medEditId').value = '';
    document.getElementById('medName').value = '';
    document.getElementById('medBatch').value = '';
    document.getElementById('medExpiry').value = '';
    document.getElementById('medQty').value = 50;
    document.getElementById('medPrice').value = 10.0;
  }
}

async function saveMedicine(){
  const id = document.getElementById('medEditId').value;
  const data = {
    name: document.getElementById('medName').value.trim(),
    batch: document.getElementById('medBatch').value.trim(),
    expiry: document.getElementById('medExpiry').value,
    qty: parseInt(document.getElementById('medQty').value)||0,
    price: parseFloat(document.getElementById('medPrice').value)||0,
  };

  if(!data.name){ showToast('Medicine name is required.', 'danger', 'bi-exclamation-circle'); return; }

  try {
    if(id){
      await RxApi.updateMedicine(id, data);
      showToast('Medicine updated on server.', 'success', 'bi-pencil-square');
    } else {
      await RxApi.createMedicine(data);
      showToast('New medicine added to server.', 'success', 'bi-plus-circle');
    }

    const modalEl = document.getElementById('medicineModal');
    const modal = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
    modal.hide();
    await refreshAllData();
  } catch (err) {
    showToast(err.message || 'Failed to save medicine', 'danger', 'bi-exclamation-triangle');
  }
}

async function deleteMedicine(id){
  if(!confirm('Are you sure you want to remove this item?')) return;
  try {
    await RxApi.deleteMedicine(id);
    showToast('Medicine deleted from server.', 'warn', 'bi-trash3');
    await refreshAllData();
  } catch (err) {
    showToast(err.message || 'Failed to delete medicine', 'danger', 'bi-exclamation-triangle');
  }
}

/* ============================================================
   ADD STOCK VIA INVOICE OCR
============================================================ */
let invSelectedFile = null;
const invFileInput = document.getElementById('invFileInput');

invFileInput.addEventListener('change', function(){
  if(this.files && this.files[0]){
    invSelectedFile = this.files[0];
    const reader = new FileReader();
    reader.onload = e => {
      document.getElementById('invPreviewBox').innerHTML = `<img src="${e.target.result}" alt="Invoice preview">`;
      document.getElementById('scanInvBtn').disabled = false;
      showToast('Invoice image ready for OCR.', 'primary', 'bi-image');
    };
    reader.readAsDataURL(invSelectedFile);
  }
});

document.getElementById('scanInvBtn').addEventListener('click', async function(){
  if(!invSelectedFile) return;
  const btn = this;
  btn.disabled = true;
  btn.innerHTML = `<span class="spinner-border spinner-border-sm me-2"></span> Extracting line items...`;

  try {
    const response = await RxApi.scanSupplierInvoice(invSelectedFile);
    detectedInvItems = response.items || [];

    document.getElementById('invResults').style.display = 'block';
    document.getElementById('invDetectedBody').innerHTML = detectedInvItems.map((d,i) => `
      <tr>
        <td><input class="form-control form-control-pharm form-control-sm" style="padding:6px 8px;" value="${d.name}" id="invd-name-${i}"></td>
        <td><input class="form-control form-control-pharm form-control-sm" style="padding:6px 8px;" value="${d.batch || ''}" id="invd-batch-${i}"></td>
        <td><input type="date" class="form-control form-control-pharm form-control-sm" style="padding:6px 8px;" value="${d.expiry ? d.expiry.slice(0,10) : ''}" id="invd-expiry-${i}"></td>
        <td><input type="number" class="form-control form-control-pharm form-control-sm" style="padding:6px 8px; width:90px;" value="${d.qty || 0}" id="invd-qty-${i}"></td>
        <td><input type="number" step="0.01" class="form-control form-control-pharm form-control-sm" style="padding:6px 8px; width:90px;" value="${d.price || 0}" id="invd-price-${i}"></td>
      </tr>`).join('');

    showToast(`Invoice scanned successfully.`, 'success', 'bi-check2-circle');
    document.getElementById('invResults').scrollIntoView({behavior:'smooth', block:'nearest'});
  } catch(err) {
    showToast(err.message || 'Invoice OCR processing failed', 'danger', 'bi-exclamation-triangle');
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<i class="bi bi-upc-scan me-1"></i>Scan Invoice`;
  }
});

async function verifyAndAddStock(){
  if(detectedInvItems.length === 0) return;
  
  const payload = detectedInvItems.map((_, i) => ({
    name: document.getElementById('invd-name-'+i).value.trim(),
    batch: document.getElementById('invd-batch-'+i).value.trim(),
    expiry: document.getElementById('invd-expiry-'+i).value,
    qty: parseInt(document.getElementById('invd-qty-'+i).value) || 0,
    price: parseFloat(document.getElementById('invd-price-'+i).value) || 0
  })).filter(item => item.name);

  try {
    await Promise.all(payload.map(item => RxApi.createMedicine(item)));
    showToast('Stock items committed to inventory.', 'success', 'bi-box-seam');
    document.getElementById('invResults').style.display = 'none';
    document.getElementById('invPreviewBox').innerHTML = `<div class="preview-placeholder"><i class="bi bi-receipt" style="font-size:2rem;"></i><br>No invoice uploaded yet</div>`;
    document.getElementById('scanInvBtn').disabled = true;
    detectedInvItems = [];
    goPage('inventory');
  } catch(err) {
    showToast('Failed to add some inventory items to server.', 'danger', 'bi-exclamation-triangle');
  }
}

/* ============================================================
   EXPIRY MANAGEMENT
============================================================ */
let expiryTab = 'expired';
document.getElementById('expiryTabs').addEventListener('click', function(e){
  const btn = e.target.closest('button');
  if(!btn) return;
  document.querySelectorAll('#expiryTabs button').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  expiryTab = btn.dataset.tab;
  renderExpiry();
});

function renderExpiry(){
  const expired = medicines.filter(m=>daysLeft(m.expiry) < 0);
  const soon = medicines.filter(m=>daysLeft(m.expiry) >= 0 && daysLeft(m.expiry) <= NEAR_EXPIRY_DAYS);
  const safe = medicines.filter(m=>daysLeft(m.expiry) > NEAR_EXPIRY_DAYS);

  document.getElementById('cnt-expired').textContent = expired.length;
  document.getElementById('cnt-soon').textContent = soon.length;
  document.getElementById('cnt-safe').textContent = safe.length;

  const map = { expired, soon, safe };
  const list = (map[expiryTab] || []).sort((a,b)=>daysLeft(a.expiry)-daysLeft(b.expiry));

  document.getElementById('expiryBody').innerHTML = list.map(m=>{
    const dl = daysLeft(m.expiry);
    const status = stockStatus(m);
    return `<tr>
      <td><b>${m.name}</b></td>
      <td>${m.batch || 'N/A'}</td>
      <td>${fmtDate(m.expiry)}</td>
      <td>${dl<0 ? (Math.abs(dl)+'d ago') : dl+'d'}</td>
      <td>${m.qty}</td>
      <td>${badge(status)}</td>
    </tr>`;
  }).join('') || emptyRow(6,'No items matching this category');
}
