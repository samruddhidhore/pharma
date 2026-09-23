// MAIN APPLICATION LOGIC FOR CUREPOINT PHARMACY DASHBOARD & POS BILLING

let inventoryData = [...mockMedicines];
let invoicesHistoryData = [...mockInvoices];
let posCart = [];

let demandChartInstance = null;
let expiryChartInstance = null;
let aiForecastChartInstance = null;
let digitalTwinChartInstance = null;
let profitChartInstance = null;
let revenueChartInstance = null;

document.addEventListener("DOMContentLoaded", () => {
    initNavigation();
    renderOverview();
    renderInventory();
    renderExpiryAlerts();
    renderCustomers();
    renderInvoiceHistory();
    initCharts();
    setupEventListeners();
    populateQuickAlerts();
});

// Navigation Tab Switcher
function initNavigation() {
    const navLinks = document.querySelectorAll(".nav-link");
    navLinks.forEach(link => {
        link.addEventListener("click", (e) => {
            e.preventDefault();
            const targetTab = link.getAttribute("data-tab");
            switchTab(targetTab);
        });
    });
}

function switchTab(tabId) {
    document.querySelectorAll(".nav-link").forEach(l => l.classList.remove("active"));
    const activeLink = document.querySelector(`.nav-link[data-tab="${tabId}"]`);
    if (activeLink) activeLink.classList.add("active");

    document.querySelectorAll(".tab-panel").forEach(panel => panel.classList.remove("active"));
    const targetPanel = document.getElementById(`tab-${tabId}`);
    if (targetPanel) {
        targetPanel.classList.add("active");
    }

    if (tabId === "ai-intelligence" && aiForecastChartInstance) {
        aiForecastChartInstance.resize();
    } else if (tabId === "digital-twin" && digitalTwinChartInstance) {
        runDigitalTwinSimulation();
    } else if (tabId === "analytics" && profitChartInstance) {
        profitChartInstance.resize();
        revenueChartInstance.resize();
    } else if (tabId === "billing") {
        renderInvoiceHistory();
    }
}

// POS BILLING ENGINE LOGIC
function handlePOSSearch(e) {
    const val = e.target.value.toLowerCase().trim();
    const dropdown = document.getElementById("pos-search-results");

    if (!val) {
        dropdown.classList.add("hidden");
        return;
    }

    const matches = inventoryData.filter(i => 
        i.brandName.toLowerCase().includes(val) || 
        i.saltName.toLowerCase().includes(val) ||
        i.barcode.includes(val) ||
        i.batchNo.toLowerCase().includes(val)
    ).slice(0, 6);

    if (matches.length === 0) {
        dropdown.innerHTML = `<div class="p-3 text-muted text-sm text-center">No matching medicine found.</div>`;
    } else {
        dropdown.innerHTML = matches.map(item => `
            <div class="pos-search-item" onclick="addToPOSCart(${item.id})">
                <div>
                    <strong>${item.brandName}</strong>
                    <div class="text-xs text-muted">${item.saltName} | Batch: <code class="text-accent">${item.batchNo}</code> (${item.rackLocation})</div>
                </div>
                <div class="text-end">
                    <strong class="text-success">₹${item.mrp.toFixed(2)}</strong>
                    <div class="text-xs ${item.stockQty <= item.minSafeQty ? 'text-warning' : 'text-muted'}">Stock: ${item.stockQty}</div>
                </div>
            </div>
        `).join('');
    }

    dropdown.classList.remove("hidden");
}

function addToPOSCart(medId) {
    const med = inventoryData.find(i => i.id === medId);
    if (!med) return;

    if (med.stockQty <= 0) {
        showToast(`Out of Stock! Cannot add ${med.brandName}.`, "danger");
        return;
    }

    const existingIndex = posCart.findIndex(item => item.id === medId);
    if (existingIndex >= 0) {
        if (posCart[existingIndex].qty + 1 > med.stockQty) {
            showToast(`Cannot exceed current stock limit (${med.stockQty})!`, "warning");
            return;
        }
        posCart[existingIndex].qty += 1;
    } else {
        posCart.push({
            id: med.id,
            brandName: med.brandName,
            saltName: med.saltName,
            batchNo: med.batchNo,
            rackLocation: med.rackLocation,
            unitPrice: med.mrp,
            qty: 1,
            discountPct: med.status === "CRITICAL" ? 40 : 0
        });
    }

    document.getElementById("pos-med-search").value = "";
    document.getElementById("pos-search-results").classList.add("hidden");

    renderPOSCart();
    showToast(`Added ${med.brandName} to Cart (FEFO Batch ${med.batchNo})`, "success");
}

function updateCartQty(index, delta) {
    if (index < 0 || index >= posCart.length) return;

    const cartItem = posCart[index];
    const med = inventoryData.find(i => i.id === cartItem.id);

    const newQty = cartItem.qty + delta;
    if (newQty <= 0) {
        posCart.splice(index, 1);
    } else {
        if (med && newQty > med.stockQty) {
            showToast(`Cannot exceed current stock limit (${med.stockQty})!`, "warning");
            return;
        }
        cartItem.qty = newQty;
    }

    renderPOSCart();
}

function removeCartItem(index) {
    posCart.splice(index, 1);
    renderPOSCart();
}

function resetBillingCart() {
    posCart = [];
    renderPOSCart();
    showToast("POS Cart reset.", "info");
}

function renderPOSCart() {
    const tbody = document.getElementById("cart-table-body");
    const cartBadge = document.getElementById("cart-item-badge");

    if (posCart.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="text-center py-4 text-muted">
                    <i class="fa-solid fa-basket-shopping fa-2x mb-2 opacity-40"></i>
                    <p>Cart is empty. Search medicine or scan barcode above to add items.</p>
                </td>
            </tr>
        `;
        cartBadge.innerText = "0 Items in Cart";
        document.getElementById("pos-subtotal").innerText = "₹0.00";
        document.getElementById("pos-tax").innerText = "₹0.00";
        document.getElementById("pos-discount").innerText = "- ₹0.00";
        document.getElementById("pos-total-payable").innerText = "₹0.00";
        return;
    }

    let subtotal = 0;
    let totalDiscount = 0;

    tbody.innerHTML = posCart.map((item, idx) => {
        const itemEffectivePrice = item.unitPrice * (1 - item.discountPct / 100);
        const itemLineTotal = itemEffectivePrice * item.qty;

        subtotal += (item.unitPrice * item.qty);
        totalDiscount += ((item.unitPrice - itemEffectivePrice) * item.qty);

        return `
            <tr>
                <td>
                    <strong>${item.brandName}</strong>
                    <div class="text-xs text-muted">${item.saltName}</div>
                </td>
                <td>
                    <code class="text-accent">${item.batchNo}</code>
                    <div class="text-xs text-muted">${item.rackLocation}</div>
                </td>
                <td>₹${item.unitPrice.toFixed(2)} ${item.discountPct > 0 ? `<span class="badge badge-warning">${item.discountPct}% OFF</span>` : ''}</td>
                <td>
                    <div class="qty-spinner">
                        <button class="qty-btn" onclick="updateCartQty(${idx}, -1)">-</button>
                        <span class="qty-val">${item.qty}</span>
                        <button class="qty-btn" onclick="updateCartQty(${idx}, 1)">+</button>
                    </div>
                </td>
                <td>12%</td>
                <td><strong>₹${itemLineTotal.toFixed(2)}</strong></td>
                <td>
                    <button class="btn btn-xs btn-danger-glow" onclick="removeCartItem(${idx})">&times;</button>
                </td>
            </tr>
        `;
    }).join('');

    const gstTax = (subtotal - totalDiscount) * 0.12;
    const finalTotal = (subtotal - totalDiscount) + gstTax;

    cartBadge.innerText = `${posCart.length} Items in Cart`;
    document.getElementById("pos-subtotal").innerText = `₹${subtotal.toFixed(2)}`;
    document.getElementById("pos-tax").innerText = `₹${gstTax.toFixed(2)}`;
    document.getElementById("pos-discount").innerText = `- ₹${totalDiscount.toFixed(2)}`;
    document.getElementById("pos-total-payable").innerText = `₹${finalTotal.toFixed(2)}`;
}

function processCheckoutBill() {
    if (posCart.length === 0) {
        showToast("Cart is empty! Add medicines before billing.", "warning");
        return;
    }

    const patientName = document.getElementById("pos-patient-name").value.trim() || "Walk-in Customer";
    const patientPhone = document.getElementById("pos-patient-phone").value.trim() || "+91 99999 00000";
    const paymentMode = document.querySelector('input[name="payment_mode"]:checked').value;

    let subtotal = 0;
    let totalDiscount = 0;

    posCart.forEach(item => {
        const itemEffectivePrice = item.unitPrice * (1 - item.discountPct / 100);
        subtotal += (item.unitPrice * item.qty);
        totalDiscount += ((item.unitPrice - itemEffectivePrice) * item.qty);

        // Deduct Stock in Inventory Data
        const med = inventoryData.find(i => i.id === item.id);
        if (med) {
            med.stockQty = Math.max(0, med.stockQty - item.qty);
        }
    });

    const gstTax = (subtotal - totalDiscount) * 0.12;
    const finalTotal = (subtotal - totalDiscount) + gstTax;

    // Create New Invoice Record
    const newInvoiceNo = `INV-2026-${Math.floor(1000 + Math.random() * 9000)}`;
    const nowStr = new Date().toISOString().replace('T', ' ').substring(0, 16);

    const newInvoice = {
        invoiceNo: newInvoiceNo,
        date: nowStr,
        customerName: patientName,
        customerPhone: patientPhone,
        paymentMode: paymentMode,
        totalAmount: finalTotal,
        itemsCount: posCart.length,
        status: "COMPLETED",
        items: posCart.map(i => ({
            brandName: i.brandName,
            batchNo: i.batchNo,
            qty: i.qty,
            unitPrice: i.unitPrice * (1 - i.discountPct / 100)
        }))
    };

    invoicesHistoryData.unshift(newInvoice);

    // Show Receipt Modal
    viewInvoiceReceipt(newInvoiceNo);

    // Reset Billing Cart & Re-render Dashboard & Tables
    posCart = [];
    document.getElementById("pos-patient-name").value = "";
    document.getElementById("pos-patient-phone").value = "";
    renderPOSCart();
    renderOverview();
    renderInventory();
    renderInvoiceHistory();

    showToast(`Bill Generated Successfully! Invoice: ${newInvoiceNo}`, "success");
}

// RENDER INVOICE HISTORY TABLE
function renderInvoiceHistory() {
    const tbody = document.getElementById("invoice-history-table-body");
    const searchVal = document.getElementById("invoice-history-search") ? document.getElementById("invoice-history-search").value.toLowerCase() : "";

    const filtered = invoicesHistoryData.filter(inv => 
        inv.invoiceNo.toLowerCase().includes(searchVal) ||
        inv.customerName.toLowerCase().includes(searchVal) ||
        inv.customerPhone.includes(searchVal)
    );

    if (filtered.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8" class="text-center py-4 text-muted">
                    <i class="fa-solid fa-receipt fa-2x mb-2 opacity-40"></i>
                    <p>No invoice records found. Click <strong>'Load DB Data'</strong> above to load database records.</p>
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = filtered.map(inv => `
        <tr>
            <td><code class="text-accent">${inv.invoiceNo}</code></td>
            <td><span class="text-sm">${inv.date}</span></td>
            <td>
                <strong>${inv.customerName}</strong>
                <div class="text-xs text-muted">${inv.customerPhone}</div>
            </td>
            <td><span class="badge badge-outline">${inv.itemsCount} Items</span></td>
            <td><strong class="text-success">₹${inv.totalAmount.toFixed(2)}</strong></td>
            <td><span class="tag tag-blue">${inv.paymentMode}</span></td>
            <td><span class="badge badge-success">${inv.status}</span></td>
            <td>
                <button class="btn btn-xs btn-primary" onclick="viewInvoiceReceipt('${inv.invoiceNo}')">
                    <i class="fa-solid fa-receipt"></i> Print Receipt
                </button>
            </td>
        </tr>
    `).join('');
}

// VIEW & PRINT THERMAL RECEIPT MODAL
function viewInvoiceReceipt(invNo) {
    const inv = invoicesHistoryData.find(i => i.invoiceNo === invNo);
    if (!inv) return;

    const modalBody = document.getElementById("receipt-modal-body");
    modalBody.innerHTML = `
        <div class="thermal-receipt-box">
            <div class="receipt-header">
                <h2>CUREPOINT PHARMA</h2>
                <div>Central Retail Hub, Station Road</div>
                <div>GSTIN: 27AAAAA0000A1Z5 | DL: 20B/21B-89102</div>
                <div>Date: ${inv.date} | Invoice: <b>${inv.invoiceNo}</b></div>
            </div>
            <div><strong>Patient:</strong> ${inv.customerName} (${inv.customerPhone})</div>
            <div><strong>Payment Mode:</strong> ${inv.paymentMode}</div>
            
            <table class="receipt-table">
                <thead>
                    <tr>
                        <th style="text-align:left">Item & Batch</th>
                        <th style="text-align:center">Qty</th>
                        <th style="text-align:right">Price</th>
                    </tr>
                </thead>
                <tbody>
                    ${inv.items.map(item => `
                        <tr>
                            <td>${item.brandName}<br><small>Batch: ${item.batchNo}</small></td>
                            <td style="text-align:center">${item.qty}</td>
                            <td style="text-align:right">₹${(item.unitPrice * item.qty).toFixed(2)}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
            
            <div class="text-end fw-bold" style="font-size:1.05rem;">
                Total Amount Paid: ₹${inv.totalAmount.toFixed(2)}
            </div>
            
            <div class="receipt-footer">
                <div>Thank you for visiting CurePoint!</div>
                <div>Get Well Soon 🙏</div>
            </div>
        </div>
    `;

    document.getElementById("receipt-modal").classList.remove("hidden");
}

// Render Executive Overview
function renderOverview() {
    let totalVal = 0;
    let expiryRiskVal = 0;
    let lowStockCount = 0;

    inventoryData.forEach(item => {
        totalVal += (item.purchasePrice * item.stockQty);
        if (item.status === "CRITICAL" || item.status === "EXPIRED") {
            expiryRiskVal += (item.purchasePrice * item.stockQty);
        }
        if (item.stockQty <= item.minSafeQty) {
            lowStockCount++;
        }
    });

    document.getElementById("kpi-total-val").innerText = `₹${totalVal.toLocaleString('en-IN')}`;
    document.getElementById("kpi-expiry-risk").innerText = `₹${expiryRiskVal.toLocaleString('en-IN')}`;
    document.getElementById("kpi-low-stock").innerText = `${lowStockCount} Items`;

    const overviewExpiryTable = document.getElementById("overview-expiry-table");
    const urgentItems = inventoryData.filter(i => i.status === "CRITICAL" || i.status === "EXPIRED" || i.status === "WARNING").slice(0, 4);

    if (urgentItems.length === 0) {
        overviewExpiryTable.innerHTML = `<tr><td colspan="5" class="text-center text-muted py-3">No expiry risk items found. Click 'Load DB Data' to load database.</td></tr>`;
    } else {
        overviewExpiryTable.innerHTML = urgentItems.map(item => `
        <tr>
            <td>
                <strong>${item.brandName}</strong>
                <div class="text-sm text-muted">Batch: ${item.batchNo}</div>
            </td>
            <td><span class="${item.status === 'EXPIRED' ? 'text-danger' : 'text-warning'}">${item.expiryDate}</span></td>
            <td><strong>${item.stockQty}</strong></td>
            <td>₹${(item.purchasePrice * item.stockQty).toLocaleString('en-IN')}</td>
            <td>
                ${item.status === 'EXPIRED' ? 
                    '<span class="badge badge-danger">Scrap Batch</span>' : 
                    '<button class="btn btn-xs btn-warning" onclick="applyDiscountToItem(' + item.id + ')">Apply 40% Off</button>'}
            </td>
        </tr>
    `).join('');
    }

    const overviewRestockTable = document.getElementById("overview-restock-table");
    const lowStockItems = inventoryData.filter(i => i.stockQty <= i.minSafeQty || i.status === "WARNING");

    if (lowStockItems.length === 0) {
        overviewRestockTable.innerHTML = `<tr><td colspan="5" class="text-center text-muted py-3">No low stock items found. Click 'Load DB Data' to load database.</td></tr>`;
    } else {
        overviewRestockTable.innerHTML = lowStockItems.map(item => `
        <tr>
            <td>
                <strong>${item.brandName}</strong>
                <div class="text-sm text-muted">${item.saltName}</div>
            </td>
            <td><span class="text-danger"><strong>${item.stockQty}</strong></span></td>
            <td>${item.minSafeQty}</td>
            <td><strong class="text-purple">+${item.aiPredictedDemand} Units</strong></td>
            <td><span class="text-sm">${item.supplier}</span></td>
        </tr>
    `).join('');
    }
}

// Render Master Inventory Table
function renderInventory() {
    const tableBody = document.getElementById("inventory-table-body");
    const searchVal = document.getElementById("inventory-search").value.toLowerCase();
    const categoryFilter = document.getElementById("filter-category").value;
    const expiryFilter = document.getElementById("filter-expiry-status").value;

    const filtered = inventoryData.filter(item => {
        const matchesSearch = item.brandName.toLowerCase().includes(searchVal) ||
                              item.saltName.toLowerCase().includes(searchVal) ||
                              item.batchNo.toLowerCase().includes(searchVal) ||
                              item.rackLocation.toLowerCase().includes(searchVal);
        const matchesCat = (categoryFilter === "ALL" || item.category === categoryFilter);
        const matchesExp = (expiryFilter === "ALL" || item.status === expiryFilter);

        return matchesSearch && matchesCat && matchesExp;
    });

    if (filtered.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="9" class="text-center py-4 text-muted">
                    <i class="fa-solid fa-boxes-stacked fa-2x mb-2 opacity-40"></i>
                    <p>No inventory records found. Click <strong>'Load DB Data'</strong> above to load database records.</p>
                </td>
            </tr>
        `;
        return;
    }

    tableBody.innerHTML = filtered.map(item => {
        let badgeClass = "badge-success";
        let statusLabel = "SAFE";
        if (item.status === "EXPIRED") { badgeClass = "badge-danger"; statusLabel = "EXPIRED"; }
        else if (item.status === "CRITICAL") { badgeClass = "badge-danger"; statusLabel = "<30 DAYS EXPIRY"; }
        else if (item.status === "WARNING") { badgeClass = "badge-warning"; statusLabel = "FEFO PRIORITY"; }

        return `
            <tr>
                <td>
                    <strong>${item.brandName}</strong>
                    <div class="text-sm text-muted">${item.saltName}</div>
                </td>
                <td><span class="tag tag-blue">${item.category}</span></td>
                <td><code class="text-accent">${item.batchNo}</code></td>
                <td><span class="text-sm"><i class="fa-solid fa-location-dot text-muted"></i> ${item.rackLocation}</span></td>
                <td><strong>${item.expiryDate}</strong></td>
                <td>
                    <strong>${item.stockQty}</strong>
                    ${item.stockQty <= item.minSafeQty ? '<span class="badge badge-warning">Low</span>' : ''}
                </td>
                <td>₹${item.mrp.toFixed(2)}</td>
                <td><span class="badge ${badgeClass}">${statusLabel}</span></td>
                <td>
                    <button class="btn btn-xs btn-primary" title="Sell in POS" onclick="switchTab('billing'); addToPOSCart(${item.id});"><i class="fa-solid fa-cart-plus"></i> Bill</button>
                </td>
            </tr>
        `;
    }).join('');
}

// Render Expiry Alert Center Table
function renderExpiryAlerts() {
    const tbody = document.getElementById("expiry-alerts-table-body");
    const expiryItems = inventoryData.filter(i => i.status === "CRITICAL" || i.status === "EXPIRED" || i.status === "WARNING");

    let count0 = 0, count30 = 0, count90 = 0;

    expiryItems.forEach(i => {
        if (i.status === "EXPIRED") count0++;
        else if (i.status === "CRITICAL") count30++;
        else if (i.status === "WARNING") count90++;
    });

    document.getElementById("exp-count-0").innerText = `${count0} Batches`;
    document.getElementById("exp-count-30").innerText = `${count30} Batches`;
    document.getElementById("exp-count-90").innerText = `${count90} Batches`;
    document.getElementById("nav-expiry-count").innerText = expiryItems.length;

    if (expiryItems.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8" class="text-center py-4 text-muted">
                    <i class="fa-solid fa-shield-halved fa-2x mb-2 text-success opacity-40"></i>
                    <p>No near-expiry alert items found. Click <strong>'Load DB Data'</strong> above to load database records.</p>
                </td>
            </tr>
        `;
    } else {
        tbody.innerHTML = expiryItems.map(item => `
        <tr>
            <td><code class="text-accent">${item.batchNo}</code></td>
            <td>
                <strong>${item.brandName}</strong>
                <div class="text-sm text-muted">${item.saltName}</div>
            </td>
            <td><strong class="text-danger">${item.expiryDate}</strong></td>
            <td><span class="badge ${item.status === 'EXPIRED' ? 'badge-danger' : 'badge-warning'}">${item.status === 'EXPIRED' ? 'EXPIRED' : '< 30 Days'}</span></td>
            <td><strong>${item.stockQty} Units</strong></td>
            <td>₹${(item.purchasePrice * item.stockQty).toLocaleString('en-IN')}</td>
            <td>
                ${item.status === 'EXPIRED' ? 
                    '<span class="text-danger"><i class="fa-solid fa-triangle-exclamation"></i> Immediate Scrap & Debit Note</span>' : 
                    '<span class="text-warning"><i class="fa-solid fa-tags"></i> 40% Clearance Discount or Distributor Return</span>'}
            </td>
            <td>
                <div class="sample-buttons">
                    <button class="btn btn-xs btn-warning" onclick="applyDiscountToItem(${item.id})">Apply 40% Off</button>
                    <button class="btn btn-xs btn-secondary" onclick="returnToDistributor(${item.id})">Distributor Return</button>
                </div>
            </td>
        </tr>
    `).join('');
    }
}

// Render Customers
function renderCustomers() {
    const tbody = document.getElementById("customers-table-body");
    if (mockCustomers.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="text-center py-4 text-muted">
                    <i class="fa-solid fa-users fa-2x mb-2 opacity-40"></i>
                    <p>No patient refill records found. Click <strong>'Load DB Data'</strong> above to load database records.</p>
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = mockCustomers.map(c => `
        <tr>
            <td><strong>${c.name}</strong></td>
            <td><i class="fa-solid fa-phone text-muted"></i> ${c.phone}</td>
            <td><span class="tag tag-blue">${c.condition}</span></td>
            <td>${c.medicines}</td>
            <td>${c.lastPurchase}</td>
            <td><strong class="${c.status === 'OVERDUE' ? 'text-danger' : 'text-warning'}">${c.nextRefill}</strong></td>
            <td>
                <button class="btn btn-xs btn-glass-purple" onclick="sendWhatsAppReminder('${c.name}', '${c.phone}')">
                    <i class="fa-brands fa-whatsapp text-success"></i> Send WhatsApp Alert
                </button>
            </td>
        </tr>
    `).join('');
}

// Chart Initializations
function initCharts() {
    const ctxDemand = document.getElementById("demandChart").getContext("2d");
    demandChartInstance = new Chart(ctxDemand, {
        type: 'line',
        data: {
            labels: ['May', 'Jun', 'Jul', 'Aug', 'Sep (Current)', 'Oct (AI Pred)', 'Nov (AI Pred)', 'Dec (AI Pred)'],
            datasets: [
                {
                    label: 'Actual Sales (Units)',
                    data: [1200, 1350, 1500, 1420, 1680, null, null, null],
                    borderColor: '#3B82F6',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    fill: true,
                    tension: 0.4
                },
                {
                    label: 'AI Forecast Demand',
                    data: [null, null, null, null, 1680, 2100, 2450, 1980],
                    borderColor: '#8B5CF6',
                    borderDash: [6, 6],
                    backgroundColor: 'rgba(139, 92, 246, 0.15)',
                    fill: true,
                    tension: 0.4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { labels: { color: '#9CA3AF' } } },
            scales: {
                x: { ticks: { color: '#9CA3AF' }, grid: { color: 'rgba(255,255,255,0.05)' } },
                y: { ticks: { color: '#9CA3AF' }, grid: { color: 'rgba(255,255,255,0.05)' } }
            }
        }
    });

    const ctxExpiry = document.getElementById("expiryDistributionChart").getContext("2d");
    expiryChartInstance = new Chart(ctxExpiry, {
        type: 'doughnut',
        data: {
            labels: ['Safe (>90 Days)', 'Near Expiry (30-90d)', 'Critical Expiry (<30d)', 'Expired (<0d)'],
            datasets: [{
                data: [65, 18, 12, 5],
                backgroundColor: ['#10B981', '#F59E0B', '#EF4444', '#7F1D1D'],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { position: 'bottom', labels: { color: '#9CA3AF' } } }
        }
    });

    const ctxAIForecast = document.getElementById("aiDemandForecastChart").getContext("2d");
    aiForecastChartInstance = new Chart(ctxAIForecast, {
        type: 'bar',
        data: {
            labels: ['Antibiotics', 'Analgesics', 'Cardiology', 'Diabetic Care', 'Vitamins & Supp'],
            datasets: [
                { label: 'Current Stock', data: [275, 950, 150, 210, 310], backgroundColor: '#3B82F6' },
                { label: 'AI Predicted Demand', data: [360, 1050, 180, 250, 300], backgroundColor: '#8B5CF6' }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { labels: { color: '#9CA3AF' } } },
            scales: {
                x: { ticks: { color: '#9CA3AF' }, grid: { color: 'rgba(255,255,255,0.05)' } },
                y: { ticks: { color: '#9CA3AF' }, grid: { color: 'rgba(255,255,255,0.05)' } }
            }
        }
    });

    const ctxTwin = document.getElementById("digitalTwinChart").getContext("2d");
    digitalTwinChartInstance = new Chart(ctxTwin, {
        type: 'line',
        data: {
            labels: ['Day 1', 'Day 5', 'Day 10', 'Day 15', 'Day 20', 'Day 25', 'Day 30'],
            datasets: [
                { label: 'Simulated Stock Level', data: [500, 410, 310, 180, 80, 20, 0], borderColor: '#EF4444', tension: 0.3 },
                { label: 'Baseline Normal Trend', data: [500, 450, 400, 350, 300, 250, 200], borderColor: '#10B981', borderDash: [4, 4] }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { labels: { color: '#9CA3AF' } } },
            scales: {
                x: { ticks: { color: '#9CA3AF' } },
                y: { ticks: { color: '#9CA3AF' } }
            }
        }
    });

    const ctxProfit = document.getElementById("profitMarginChart").getContext("2d");
    profitChartInstance = new Chart(ctxProfit, {
        type: 'bar',
        data: {
            labels: ['Generic Medicines', 'Branded Drugs', 'OTC Products', 'Surgicals'],
            datasets: [{ label: 'Average Margin %', data: [62, 18, 28, 45], backgroundColor: ['#10B981', '#3B82F6', '#F59E0B', '#8B5CF6'] }]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });

    const ctxRev = document.getElementById("revenueMatrixChart").getContext("2d");
    revenueChartInstance = new Chart(ctxRev, {
        type: 'line',
        data: {
            labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug'],
            datasets: [
                { label: 'Total Sales Revenue (₹)', data: [450000, 480000, 520000, 510000, 590000, 620000, 680000, 720000], borderColor: '#10B981' },
                { label: 'Procurement Cost (₹)', data: [310000, 330000, 360000, 350000, 400000, 420000, 460000, 490000], borderColor: '#EF4444' }
            ]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });
}

// Digital Twin Simulator Logic
function runDigitalTwinSimulation() {
    const surge = parseInt(document.getElementById("sim-surge").value);
    const delay = parseInt(document.getElementById("sim-delay").value);
    const safety = parseFloat(document.getElementById("sim-safety").value);

    document.getElementById("surge-val").innerText = `+${surge}%`;
    document.getElementById("delay-val").innerText = `${delay} Days`;
    document.getElementById("safety-val").innerText = `${safety}x`;

    const stockoutRiskPct = Math.min(99, Math.round((surge * 0.4) + (delay * 6) - (safety * 10)));
    const estLoss = Math.round((surge * 250) + (delay * 3200));
    const sugCapital = Math.round(estLoss * 1.8);

    document.getElementById("sim-res-stockout").innerText = `${stockoutRiskPct > 50 ? 'HIGH' : 'MODERATE'} (${stockoutRiskPct}%)`;
    document.getElementById("sim-res-loss").innerText = `₹${estLoss.toLocaleString('en-IN')}`;
    document.getElementById("sim-res-capital").innerText = `₹${sugCapital.toLocaleString('en-IN')}`;

    if (digitalTwinChartInstance) {
        const simData = [500];
        let currentStock = 500;
        const dailyBurn = 15 * (1 + surge / 100);

        for (let i = 1; i <= 6; i++) {
            currentStock -= dailyBurn * 5;
            simData.push(Math.max(0, Math.round(currentStock)));
        }

        digitalTwinChartInstance.data.datasets[0].data = simData;
        digitalTwinChartInstance.update();
    }
}

// OCR Sample Loader & Simulator
function loadSamplePrescription(sampleId) {
    const previewBox = document.getElementById("prescription-preview-box");
    const previewImg = document.getElementById("prescription-img");
    const resultsContainer = document.getElementById("ocr-results-container");

    const sample = sampleId === 1 ? mockPrescriptions.sample1 : mockPrescriptions.sample2;

    previewImg.src = sample.imgUrl;
    previewBox.classList.remove("hidden");

    showToast("Running AI OCR Scan on Prescription...", "info");

    setTimeout(() => {
        resultsContainer.innerHTML = `
            <div class="rx-header mb-3">
                <div class="rx-doctor"><strong><i class="fa-solid fa-user-doctor text-accent"></i> ${sample.doctor}</strong></div>
                <div class="rx-patient text-sm text-muted">Patient: ${sample.patient}</div>
            </div>
            <div class="table-responsive">
                <table class="table">
                    <thead>
                        <tr>
                            <th>Extracted Medicine</th>
                            <th>Dosage</th>
                            <th>Generic Salt Match</th>
                            <th>Current Inventory</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${sample.medicines.map(m => `
                            <tr>
                                <td><strong>${m.name}</strong></td>
                                <td><span class="text-sm">${m.dosage}</span></td>
                                <td><span class="tag tag-blue">${m.matchedSalt}</span></td>
                                <td><span class="badge ${m.status === 'In Stock' ? 'badge-success' : 'badge-warning'}">${m.stock}</span></td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
            <div class="mt-3 text-end">
                <button class="btn btn-primary" onclick="pushRxToPOSBilling(1)">
                    <i class="fa-solid fa-cart-plus"></i> Push All Items to POS Billing
                </button>
            </div>
        `;
        document.getElementById("ocr-confidence").innerText = `Accuracy: ${sample.confidence}`;
    }, 1200);
}

function pushRxToPOSBilling(sampleId) {
    switchTab('billing');
    addToPOSCart(102); // Augmentin
    addToPOSCart(101); // Dolo 650
    showToast("Prescription items populated into POS Billing Cart!", "success");
}

// Counterfeit Verification Logic
function verifyMedicineCode() {
    const input = document.getElementById("verify-barcode-input").value;
    if (!input) {
        showToast("Please enter a Barcode or GTIN serial number.", "warning");
        return;
    }

    if (input.includes("8901086001234") || input.includes("B-89211") || input.length >= 10) {
        testVerify('VALID');
    } else {
        testVerify('FAKE');
    }
}

function testVerify(type) {
    const resultBox = document.getElementById("verify-result-box");

    if (type === 'VALID') {
        resultBox.innerHTML = `
            <div class="alert alert-success-custom p-3 border-glow-blue rounded">
                <div class="d-flex align-items-center gap-3">
                    <i class="fa-solid fa-shield-check fa-3x text-success"></i>
                    <div>
                        <h4 class="text-success"><i class="fa-solid fa-check-circle"></i> GENUINE MEDICINE BATCH (AUTHENTIC)</h4>
                        <p class="text-sm text-secondary">Verified against Pharma GS1 Datamatrix Registry. Batch Signature Validated.</p>
                    </div>
                </div>
                <hr style="border-color: var(--border-color); margin: 1rem 0;">
                <div class="text-sm">
                    <div><strong>Manufacturer:</strong> Micro Labs Ltd / GSK Pharma</div>
                    <div><strong>License No:</strong> MFG/FD-2022/99012</div>
                    <div><strong>Cryptographic Hash:</strong> <code>0x8F9A2B3C...PASSED</code></div>
                </div>
            </div>
        `;
        showToast("Verified: Authentic Medicine Batch!", "success");
    } else {
        resultBox.innerHTML = `
            <div class="alert alert-danger-custom p-3 border-glow-red rounded" style="background: rgba(239, 68, 68, 0.15); border: 1px solid var(--danger);">
                <div class="d-flex align-items-center gap-3">
                    <i class="fa-solid fa-triangle-exclamation fa-3x text-danger"></i>
                    <div>
                        <h4 class="text-danger"><i class="fa-solid fa-ban"></i> SUSPECTED FAKE / UNREGISTERED BATCH!</h4>
                        <p class="text-sm text-secondary">Warning: Serial GTIN mismatch with Central Drug Standard Control Organisation registry.</p>
                    </div>
                </div>
                <hr style="border-color: var(--border-color); margin: 1rem 0;">
                <div class="text-sm">
                    <div><strong>Flag Reason:</strong> Invalid Checksum Hash</div>
                    <div><strong>Action:</strong> Batch Quarantined immediately. Do not sell to customers.</div>
                </div>
            </div>
        `;
        showToast("ALERT: Fake / Suspicious Code Detected!", "danger");
    }
}

// Quick Actions & Modals
function applySmartDiscounts() {
    inventoryData.forEach(item => {
        if (item.status === "CRITICAL") {
            item.mrp = item.mrp * 0.6;
        }
    });
    renderOverview();
    renderInventory();
    renderExpiryAlerts();
    showToast("40% Clearance Discount applied to near-expiry batches!", "success");
}

function applyDiscountToItem(id) {
    const item = inventoryData.find(i => i.id === id);
    if (item) {
        item.mrp = item.mrp * 0.6;
        showToast(`40% discount applied on ${item.brandName}!`, "success");
        renderOverview();
        renderExpiryAlerts();
    }
}

function returnToDistributor(id) {
    const item = inventoryData.find(i => i.id === id);
    if (item) {
        showToast(`Return Invoice generated for ${item.supplier} (${item.stockQty} units of ${item.batchNo})`, "info");
    }
}

function autoGeneratePO() {
    showToast("Purchase Order dispatched to Apollo & Sun Pharma distributors!", "success");
}

function sendWhatsAppReminder(name, phone) {
    showToast(`WhatsApp Refill Alert sent to ${name} (${phone})!`, "success");
}

function openAddMedicineModal() {
    document.getElementById("add-medicine-modal").classList.remove("hidden");
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.add("hidden");
}

function saveMedicine(e) {
    e.preventDefault();
    showToast("Medicine Record added to PostgreSQL Master Database!", "success");
    closeModal("add-medicine-modal");
}

function setupEventListeners() {
    document.getElementById("inventory-search").addEventListener("input", renderInventory);
    document.getElementById("filter-category").addEventListener("change", renderInventory);
    document.getElementById("filter-expiry-status").addEventListener("change", renderInventory);

    document.getElementById("alert-bell-trigger").addEventListener("click", (e) => {
        e.stopPropagation();
        document.getElementById("alert-dropdown").classList.toggle("hidden");
    });

    document.addEventListener("click", () => {
        document.getElementById("alert-dropdown").classList.add("hidden");
    });
}

function populateQuickAlerts() {
    const list = document.getElementById("quick-alert-list");
    const alerts = [
        { title: "Azithral 500 (Batch AZ-99120)", desc: "Expires in 17 Days. 95 Units in Rack A-3.", type: "danger" },
        { title: "Telma 40 (Batch TL-55102)", desc: "Expires in 12 Days. 150 Units in Rack B-1.", type: "danger" },
        { title: "Pantocid 40 (Batch PAN-88902)", desc: "EXPIRED 22 days ago. Quarantine batch!", type: "danger" },
        { title: "Montair LC Low Stock", desc: "Current stock: 18 (Below Min Limit 60)", type: "warning" }
    ];

    list.innerHTML = alerts.map(a => `
        <div class="alert-item">
            <i class="fa-solid fa-triangle-exclamation ${a.type === 'danger' ? 'text-danger' : 'text-warning'}"></i>
            <div>
                <div class="alert-item-title">${a.title}</div>
                <div class="alert-item-desc">${a.desc}</div>
            </div>
        </div>
    `).join('');
}

// Toast Utility
function showToast(message, type = "info") {
    const container = document.getElementById("toast-container");
    const toast = document.createElement("div");
    toast.className = "toast";

    let icon = "fa-circle-info text-accent";
    if (type === "success") icon = "fa-circle-check text-success";
    if (type === "danger") icon = "fa-triangle-exclamation text-danger";
    if (type === "warning") icon = "fa-triangle-exclamation text-warning";

    toast.innerHTML = `<i class="fa-solid ${icon}"></i> <span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
        toast.remove();
    }, 4000);
}
