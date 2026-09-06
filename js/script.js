/* ==========================================================
   MEEZAN BOOK STORE — Management System
   Vanilla JS. All data is saved in the browser's localStorage,
   so it survives closing the page/browser (same computer,
   same browser).
   ==========================================================
   Data shape:
   {
     items: [{ id, name, category, school, qty, cost, price }],
     sales: [{
       id, billNo, date, time,
       customerName, customerPhone, note,
       lines: [{ itemId, name, qty, price, cost }],
       subtotal, discount, total, profit
     }],
     nextBill: number
   }
   ========================================================== */

const STORAGE_KEY = 'kitabghar_data_v1'; // kept as-is so existing shop data keeps working
const LOW_STOCK_THRESHOLD = 5;

/* ---------- Store (localStorage wrapper) ---------- */
const Store = {
  data: null,

  load(){
    try{
      const raw = localStorage.getItem(STORAGE_KEY);
      this.data = raw ? JSON.parse(raw) : { items: [], sales: [], nextBill: 1 };
      if(!this.data.items) this.data.items = [];
      if(!this.data.sales) this.data.sales = [];
      if(!this.data.nextBill) this.data.nextBill = (this.data.sales.length || 0) + 1;
    }catch(e){
      console.error('Could not read saved data, starting fresh.', e);
      this.data = { items: [], sales: [], nextBill: 1 };
    }
    return this.data;
  },

  save(){
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
  },

  addItem(item){
    item.id = 'it_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
    this.data.items.push(item);
    this.save();
    return item;
  },

  updateItem(id, updates){
    const item = this.data.items.find(i => i.id === id);
    if(!item) return null;
    Object.assign(item, updates);
    this.save();
    return item;
  },

  deleteItem(id){
    this.data.items = this.data.items.filter(i => i.id !== id);
    this.save();
  },

  adjustStock(id, delta){
    const item = this.data.items.find(i => i.id === id);
    if(item) item.qty = Math.max(0, item.qty + delta);
    this.save();
  },

  recordSale(sale){
    sale.id = 'sale_' + Date.now();
    sale.billNo = this.data.nextBill++;
    this.data.sales.push(sale);
    this.save();
    return sale;
  }
};

/* ---------- Small helpers ---------- */
const rupee = (n) => 'Rs. ' + Number(n || 0).toLocaleString('en-PK', { maximumFractionDigits: 2 });
const todayStr = () => new Date().toISOString().slice(0, 10);
const fmtDate = (d) => new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

// Escapes user-entered text before it goes into innerHTML, so item names,
// customer names, school names or notes can never break the page or inject
// scripts/markup.
function escapeHTML(str){
  return String(str ?? '').replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[ch]));
}

function stockStatus(qty){
  if(qty <= 0) return { label: 'Out of Stock', cls: 'badge-out' };
  if(qty <= LOW_STOCK_THRESHOLD) return { label: 'Low Stock', cls: 'badge-low' };
  return { label: 'In Stock', cls: 'badge-ok' };
}

/* Small toast message instead of alert() for normal feedback */
function toast(message, type = 'success', duration = 3200){
  const container = document.getElementById('toast-container');
  if(!container) return;
  const el = document.createElement('div');
  el.className = 'toast toast-' + type;
  el.textContent = message;
  container.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => {
    el.classList.remove('show');
    setTimeout(() => el.remove(), 250);
  }, duration);
}

let cart = []; // { itemId, name, price, cost, qty, stock }

/* ---------- Mobile sidebar ---------- */
function initMobileNav(){
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  const toggle = document.getElementById('menu-toggle');

  function openMenu(){ sidebar.classList.add('open'); overlay.classList.add('open'); }
  function closeMenu(){ sidebar.classList.remove('open'); overlay.classList.remove('open'); }

  toggle.addEventListener('click', () => {
    sidebar.classList.contains('open') ? closeMenu() : openMenu();
  });
  overlay.addEventListener('click', closeMenu);
  document.querySelectorAll('.nav-btn').forEach(btn => btn.addEventListener('click', closeMenu));
}

/* ---------- Navigation ---------- */
function initNav(){
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('view-' + btn.dataset.view).classList.add('active');

      if(btn.dataset.view === 'dashboard') renderDashboard();
      if(btn.dataset.view === 'inventory') renderInventory();
      if(btn.dataset.view === 'sell') renderSellList();
      if(btn.dataset.view === 'reports') renderReports();
    });
  });
}

/* ---------- Add item ---------- */
function initAddItemForm(){
  const form = document.getElementById('add-item-form');
  const msg = document.getElementById('add-item-msg');

  form.addEventListener('submit', (e) => {
    e.preventDefault();

    const name = document.getElementById('f-name').value.trim();
    const category = document.getElementById('f-category').value;
    const school = document.getElementById('f-school').value.trim();
    const qty = parseInt(document.getElementById('f-qty').value, 10);
    const cost = parseFloat(document.getElementById('f-cost').value);
    const price = parseFloat(document.getElementById('f-price').value);

    // Friendly validation instead of failing silently
    if(!name){
      showFormMsg(msg, 'Item name cannot be empty.', 'error');
      return;
    }
    if(isNaN(qty) || qty < 0){
      showFormMsg(msg, 'Quantity cannot be negative.', 'error');
      return;
    }
    if(!isNaN(cost) && cost < 0){
      showFormMsg(msg, 'Cost price cannot be negative.', 'error');
      return;
    }
    if(isNaN(price) || price <= 0){
      showFormMsg(msg, 'Sale price must be greater than 0.', 'error');
      return;
    }

    const item = {
      name, category, school,
      qty: qty || 0,
      cost: isNaN(cost) ? 0 : cost,
      price
    };

    Store.addItem(item);
    form.reset();
    showFormMsg(msg, `"${item.name}" added successfully.`, 'success');
    populateCategoryFilter();
    renderDashboard();
  });
}

function showFormMsg(el, text, type){
  el.textContent = text;
  el.className = 'form-msg ' + type;
  if(type === 'success'){
    setTimeout(() => { el.textContent = ''; el.className = 'form-msg'; }, 3500);
  }
}

/* ---------- Inventory view ---------- */
function populateCategoryFilter(){
  const sel = document.getElementById('inv-category-filter');
  const current = sel.value;
  const cats = [...new Set(Store.data.items.map(i => i.category))];
  sel.innerHTML = '<option value="">All Categories</option>' +
    cats.map(c => `<option value="${escapeHTML(c)}">${escapeHTML(c)}</option>`).join('');
  sel.value = current;
}

function renderInventory(){
  const tbody = document.querySelector('#inventory-table tbody');
  const search = document.getElementById('inv-search').value.toLowerCase();
  const catFilter = document.getElementById('inv-category-filter').value;

  let items = Store.data.items.filter(i => {
    const matchesSearch = !search ||
      i.name.toLowerCase().includes(search) ||
      (i.school || '').toLowerCase().includes(search) ||
      (i.category || '').toLowerCase().includes(search);
    const matchesCat = !catFilter || i.category === catFilter;
    return matchesSearch && matchesCat;
  });

  items = items.slice().sort((a, b) => a.name.localeCompare(b.name));

  if(items.length === 0){
    tbody.innerHTML = `<tr class="empty-row"><td colspan="9">No items added yet. Start by adding your first book or stationery item.</td></tr>`;
    return;
  }

  tbody.innerHTML = items.map(i => {
    const status = stockStatus(i.qty);
    const stockValue = i.qty * i.cost;
    return `
    <tr>
      <td>${escapeHTML(i.name)}</td>
      <td>${escapeHTML(i.category)}</td>
      <td>${escapeHTML(i.school) || '—'}</td>
      <td class="num-cell">${i.qty}</td>
      <td class="num-cell">${rupee(i.cost)}</td>
      <td class="num-cell">${rupee(i.price)}</td>
      <td class="num-cell">${rupee(stockValue)}</td>
      <td><span class="badge ${status.cls}">${status.label}</span></td>
      <td>
        <button class="icon-btn" data-restock="${i.id}">Restock</button>
        <button class="icon-btn" data-edit="${i.id}">Edit</button>
        <button class="icon-btn danger" data-delete="${i.id}">Delete</button>
      </td>
    </tr>`;
  }).join('');

  tbody.querySelectorAll('[data-restock]').forEach(btn => {
    btn.addEventListener('click', () => {
      const amount = prompt('How many units to add to stock?', '10');
      if(amount === null) return;
      const n = parseInt(amount, 10);
      if(!isNaN(n) && n > 0){
        Store.adjustStock(btn.dataset.restock, n);
        renderInventory();
        renderDashboard();
        toast('Stock updated.', 'success');
      }else{
        toast('Please enter a valid positive number.', 'error');
      }
    });
  });

  tbody.querySelectorAll('[data-edit]').forEach(btn => {
    btn.addEventListener('click', () => openEditModal(btn.dataset.edit));
  });

  tbody.querySelectorAll('[data-delete]').forEach(btn => {
    btn.addEventListener('click', () => {
      if(confirm('Delete this item permanently? This cannot be undone.')){
        Store.deleteItem(btn.dataset.delete);
        renderInventory();
        renderDashboard();
        populateCategoryFilter();
        toast('Item deleted.', 'success');
      }
    });
  });
}

function initInventoryFilters(){
  document.getElementById('inv-search').addEventListener('input', renderInventory);
  document.getElementById('inv-category-filter').addEventListener('change', renderInventory);
}

/* ---------- Edit item modal ---------- */
function openEditModal(id){
  const item = Store.data.items.find(i => i.id === id);
  if(!item) return;

  document.getElementById('edit-id').value = item.id;
  document.getElementById('e-name').value = item.name;
  document.getElementById('e-category').value = item.category;
  document.getElementById('e-school').value = item.school || '';
  document.getElementById('e-cost').value = item.cost;
  document.getElementById('e-price').value = item.price;
  document.getElementById('edit-msg').textContent = '';

  document.getElementById('edit-modal').classList.remove('hidden');
}

function closeEditModal(){
  document.getElementById('edit-modal').classList.add('hidden');
}

function initEditModal(){
  document.getElementById('close-edit-btn').addEventListener('click', closeEditModal);

  document.getElementById('edit-item-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const id = document.getElementById('edit-id').value;
    const name = document.getElementById('e-name').value.trim();
    const category = document.getElementById('e-category').value;
    const school = document.getElementById('e-school').value.trim();
    const cost = parseFloat(document.getElementById('e-cost').value);
    const price = parseFloat(document.getElementById('e-price').value);
    const msg = document.getElementById('edit-msg');

    if(!name){ showFormMsg(msg, 'Item name cannot be empty.', 'error'); return; }
    if(isNaN(price) || price <= 0){ showFormMsg(msg, 'Sale price must be greater than 0.', 'error'); return; }
    if(!isNaN(cost) && cost < 0){ showFormMsg(msg, 'Cost price cannot be negative.', 'error'); return; }

    // Quantity is never changed here — use Restock for stock changes.
    Store.updateItem(id, { name, category, school, cost: isNaN(cost) ? 0 : cost, price });

    closeEditModal();
    renderInventory();
    renderSellList();
    renderDashboard();
    populateCategoryFilter();
    toast('Item updated.', 'success');
  });
}

/* ---------- Sell / Billing ---------- */
function renderSellList(){
  const tbody = document.querySelector('#sell-item-table tbody');
  const search = document.getElementById('sell-search').value.toLowerCase();

  let items = Store.data.items.filter(i => i.qty > 0 && (
    !search ||
    i.name.toLowerCase().includes(search) ||
    (i.school || '').toLowerCase().includes(search) ||
    (i.category || '').toLowerCase().includes(search)
  ));
  items = items.slice().sort((a, b) => a.name.localeCompare(b.name));

  if(items.length === 0){
    tbody.innerHTML = `<tr class="empty-row"><td colspan="6">No stock available. Add items first from "Add Item".</td></tr>`;
    return;
  }

  tbody.innerHTML = items.map(i => `
    <tr>
      <td>${escapeHTML(i.name)}</td>
      <td>${escapeHTML(i.school) || '—'}</td>
      <td class="num-cell">${i.qty}</td>
      <td class="num-cell">${rupee(i.price)}</td>
      <td><input type="number" class="qty-input" min="1" max="${i.qty}" value="1" data-qty="${i.id}"></td>
      <td><button class="icon-btn" data-add="${i.id}">Add to Bill</button></td>
    </tr>
  `).join('');

  tbody.querySelectorAll('[data-add]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.add;
      const item = Store.data.items.find(x => x.id === id);
      const qtyInput = tbody.querySelector(`[data-qty="${id}"]`);
      let qty = parseInt(qtyInput.value, 10) || 1;

      if(qty < 1){
        toast('Quantity must be at least 1.', 'error');
        return;
      }
      if(qty > item.qty){
        toast(`Only ${item.qty} units are available.`, 'error');
        qty = item.qty;
      }
      addToCart(item, qty);
    });
  });
}

function addToCart(item, qty){
  const existing = cart.find(c => c.itemId === item.id);
  const alreadyInCart = existing ? existing.qty : 0;
  const maxAllowed = item.qty;
  const newQty = Math.min(alreadyInCart + qty, maxAllowed);

  if(newQty === alreadyInCart && existing){
    toast(`Only ${item.qty} units of "${item.name}" are available.`, 'error');
    return;
  }

  if(existing){
    existing.qty = newQty;
  }else{
    // Price/cost is captured now, so later price edits don't change bills already in progress.
    cart.push({ itemId: item.id, name: item.name, price: item.price, cost: item.cost, qty: newQty, stock: item.qty });
  }
  renderCart();
}

function computeCartTotals(){
  const subtotal = cart.reduce((s, c) => s + c.price * c.qty, 0);
  const discountInput = document.getElementById('cart-discount');
  let discount = parseFloat(discountInput.value) || 0;
  if(discount < 0) discount = 0;
  if(discount > subtotal) discount = subtotal;
  discountInput.value = discount;
  const grandTotal = subtotal - discount;
  return { subtotal, discount, grandTotal };
}

function renderCart(){
  const tbody = document.querySelector('#cart-table tbody');
  const emptyMsg = document.getElementById('cart-empty-msg');
  const checkoutBtn = document.getElementById('checkout-btn');

  if(cart.length === 0){
    tbody.innerHTML = '';
    emptyMsg.style.display = 'block';
    checkoutBtn.disabled = true;
  }else{
    emptyMsg.style.display = 'none';
    checkoutBtn.disabled = false;

    tbody.innerHTML = cart.map((c, idx) => {
      const amount = c.price * c.qty; // Amount = Qty x Unit Price
      return `
        <tr>
          <td>${escapeHTML(c.name)}</td>
          <td><input type="number" class="qty-input" min="1" max="${c.stock}" value="${c.qty}" data-cart-qty="${idx}"></td>
          <td class="num-cell">${rupee(c.price)}</td>
          <td class="num-cell">${rupee(amount)}</td>
          <td><button class="icon-btn danger" data-cart-remove="${idx}">Remove</button></td>
        </tr>
      `;
    }).join('');

    tbody.querySelectorAll('[data-cart-qty]').forEach(inp => {
      inp.addEventListener('change', () => {
        const idx = parseInt(inp.dataset.cartQty, 10);
        let val = parseInt(inp.value, 10) || 1;
        if(val < 1) val = 1;
        if(val > cart[idx].stock){
          toast(`Only ${cart[idx].stock} units are available.`, 'error');
          val = cart[idx].stock;
        }
        cart[idx].qty = val;
        renderCart();
      });
    });
    tbody.querySelectorAll('[data-cart-remove]').forEach(btn => {
      btn.addEventListener('click', () => {
        cart.splice(parseInt(btn.dataset.cartRemove, 10), 1);
        renderCart();
      });
    });
  }

  const totals = computeCartTotals();
  document.getElementById('sum-subtotal').textContent = rupee(totals.subtotal);
  document.getElementById('sum-total').textContent = rupee(totals.grandTotal);
}

function checkout(){
  if(cart.length === 0) return;

  // Re-check stock right before finalizing, in case it changed elsewhere.
  for(const c of cart){
    const item = Store.data.items.find(i => i.id === c.itemId);
    if(!item || item.qty < c.qty){
      toast(`Not enough stock for "${c.name}". Only ${item ? item.qty : 0} left.`, 'error');
      renderSellList();
      renderCart();
      return;
    }
  }

  const totals = computeCartTotals();
  if(totals.discount > totals.subtotal){
    toast('Discount cannot be greater than subtotal.', 'error');
    return;
  }

  const lines = cart.map(c => ({ itemId: c.itemId, name: c.name, qty: c.qty, price: c.price, cost: c.cost }));
  const grossProfit = lines.reduce((s, l) => s + (l.price - l.cost) * l.qty, 0);
  const profit = grossProfit - totals.discount;

  const now = new Date();
  const sale = Store.recordSale({
    date: todayStr(),
    time: now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
    customerName: document.getElementById('cart-customer-name').value.trim(),
    customerPhone: document.getElementById('cart-customer-phone').value.trim(),
    note: document.getElementById('cart-note').value.trim(),
    lines,
    subtotal: totals.subtotal,
    discount: totals.discount,
    total: totals.grandTotal,
    profit
  });

  // Deduct stock for each line
  lines.forEach(l => Store.adjustStock(l.itemId, -l.qty));

  showBill(sale);

  cart = [];
  document.getElementById('cart-discount').value = 0;
  document.getElementById('cart-customer-name').value = '';
  document.getElementById('cart-customer-phone').value = '';
  document.getElementById('cart-note').value = '';
  renderCart();
  renderSellList();
  renderDashboard();
  toast('Bill created successfully.', 'success');
}

/* ---------- Bill / Receipt ---------- */
function showBill(sale){
  const content = document.getElementById('receipt-content');
  const subtotal = sale.subtotal != null ? sale.subtotal : sale.total;
  const discount = sale.discount || 0;

  const itemRows = sale.lines.map(l => `
    <tr>
      <td>${escapeHTML(l.name)}</td>
      <td>${l.qty}</td>
      <td>${rupee(l.price)}</td>
      <td>${rupee(l.price * l.qty)}</td>
    </tr>
  `).join('');

  content.innerHTML = `
    <div class="receipt-header">
      <p class="r-name">MEEZAN BOOK STORE</p>
    </div>
    <div class="r-meta">
      <div class="r-row"><span>Bill No:</span><span>#${String(sale.billNo).padStart(4, '0')}</span></div>
      <div class="r-row"><span>Date:</span><span>${fmtDate(sale.date)}</span></div>
      <div class="r-row"><span>Time:</span><span>${sale.time}</span></div>
      ${sale.customerName ? `<div class="r-row"><span>Customer:</span><span>${escapeHTML(sale.customerName)}</span></div>` : ''}
      ${sale.customerPhone ? `<div class="r-row"><span>Phone:</span><span>${escapeHTML(sale.customerPhone)}</span></div>` : ''}
      ${sale.note ? `<div class="r-row"><span>Note:</span><span>${escapeHTML(sale.note)}</span></div>` : ''}
    </div>
    <hr>
    <table class="receipt-table">
      <thead><tr><th>Item</th><th>Qty</th><th>Unit</th><th>Amount</th></tr></thead>
      <tbody>${itemRows}</tbody>
    </table>
    <hr>
    <div class="r-summary">
      <div class="r-row"><span>Subtotal</span><span>${rupee(subtotal)}</span></div>
      <div class="r-row"><span>Discount</span><span>${rupee(discount)}</span></div>
      <div class="r-row r-total"><span>Grand Total</span><span>${rupee(sale.total)}</span></div>
    </div>
    <p class="r-thanks">Thank you for shopping with Meezan Book Store.<br>Please visit us again.</p>
  `;
  document.getElementById('bill-modal').classList.remove('hidden');
}

function initBillModal(){
  document.getElementById('close-bill-btn').addEventListener('click', () => {
    document.getElementById('bill-modal').classList.add('hidden');
  });
  document.getElementById('print-bill-btn').addEventListener('click', () => window.print());
}

/* ---------- Dashboard ---------- */
function renderDashboard(){
  document.getElementById('today-date').textContent = fmtDate(todayStr());

  const todaySales = Store.data.sales.filter(s => s.date === todayStr());
  const todayProfit = todaySales.reduce((s, sale) => s + sale.profit, 0);
  const todayAmount = todaySales.reduce((s, sale) => s + sale.total, 0);
  const lowStockCount = Store.data.items.filter(i => i.qty <= LOW_STOCK_THRESHOLD).length;

  document.getElementById('stat-today-bills').textContent = todaySales.length;
  document.getElementById('stat-today-profit').textContent = rupee(todayProfit);
  document.getElementById('stat-today-sales').textContent = rupee(todayAmount);
  document.getElementById('stat-low-stock').textContent = lowStockCount;
  document.getElementById('stat-today-sales-hint').textContent =
    `${todaySales.length} bill${todaySales.length === 1 ? '' : 's'} today`;
  document.getElementById('stat-low-stock-hint').textContent =
    `${LOW_STOCK_THRESHOLD} or fewer units left`;

  // Remaining stock table
  const search = (document.getElementById('dash-search').value || '').toLowerCase();
  const tbody = document.querySelector('#dash-stock-table tbody');
  let items = Store.data.items.filter(i =>
    !search ||
    i.name.toLowerCase().includes(search) ||
    (i.school || '').toLowerCase().includes(search) ||
    (i.category || '').toLowerCase().includes(search)
  ).sort((a, b) => a.qty - b.qty);

  if(items.length === 0){
    tbody.innerHTML = `<tr class="empty-row"><td colspan="6">No items added yet.</td></tr>`;
  }else{
    tbody.innerHTML = items.map(i => {
      const status = stockStatus(i.qty);
      return `
      <tr>
        <td>${escapeHTML(i.name)}</td>
        <td>${escapeHTML(i.category)}</td>
        <td>${escapeHTML(i.school) || '—'}</td>
        <td class="num-cell">${i.qty}</td>
        <td class="num-cell">${rupee(i.price)}</td>
        <td><span class="badge ${status.cls}">${status.label}</span></td>
      </tr>`;
    }).join('');
  }

  // Recent bills — each has a View button that reopens its receipt
  const recentTbody = document.querySelector('#recent-bills-table tbody');
  const recent = Store.data.sales.slice().reverse().slice(0, 8);
  if(recent.length === 0){
    recentTbody.innerHTML = `<tr class="empty-row"><td colspan="6">No sales recorded yet.</td></tr>`;
  }else{
    recentTbody.innerHTML = recent.map(s => `
      <tr>
        <td class="mono">#${String(s.billNo).padStart(4, '0')}</td>
        <td>${fmtDate(s.date)}</td>
        <td>${escapeHTML(s.customerName) || '—'}</td>
        <td class="num-cell">${s.lines.reduce((n, l) => n + l.qty, 0)}</td>
        <td class="num-cell">${rupee(s.total)}</td>
        <td><button class="icon-btn" data-view-sale="${s.id}">View</button></td>
      </tr>
    `).join('');

    recentTbody.querySelectorAll('[data-view-sale]').forEach(btn => {
      btn.addEventListener('click', () => {
        const sale = Store.data.sales.find(s => s.id === btn.dataset.viewSale);
        if(sale) showBill(sale);
      });
    });
  }
}

function initDashboardSearch(){
  document.getElementById('dash-search').addEventListener('input', renderDashboard);
}

/* ---------- Reports ---------- */
function renderReports(){
  const sales = Store.data.sales;
  const totalProfit = sales.reduce((s, x) => s + x.profit, 0);
  const totalSales = sales.reduce((s, x) => s + x.total, 0);
  const totalItems = sales.reduce((s, x) => s + x.lines.reduce((n, l) => n + l.qty, 0), 0);

  document.getElementById('stat-total-profit').textContent = rupee(totalProfit);
  document.getElementById('stat-total-sales').textContent = rupee(totalSales);
  document.getElementById('stat-total-bills').textContent = sales.length;
  document.getElementById('stat-total-items').textContent = totalItems;

  const byDate = {};
  sales.forEach(s => {
    if(!byDate[s.date]) byDate[s.date] = { bills: 0, items: 0, amount: 0, profit: 0 };
    byDate[s.date].bills += 1;
    byDate[s.date].items += s.lines.reduce((n, l) => n + l.qty, 0);
    byDate[s.date].amount += s.total;
    byDate[s.date].profit += s.profit;
  });

  const dates = Object.keys(byDate).sort((a, b) => b.localeCompare(a));
  const tbody = document.querySelector('#reports-table tbody');
  if(dates.length === 0){
    tbody.innerHTML = `<tr class="empty-row"><td colspan="5">No sales recorded yet.</td></tr>`;
  }else{
    tbody.innerHTML = dates.map(d => `
      <tr>
        <td>${fmtDate(d)}</td>
        <td class="num-cell">${byDate[d].bills}</td>
        <td class="num-cell">${byDate[d].items}</td>
        <td class="num-cell">${rupee(byDate[d].amount)}</td>
        <td class="num-cell">${rupee(byDate[d].profit)}</td>
      </tr>
    `).join('');
  }
}

/* ---------- Backup / Restore ---------- */
function initBackup(){
  document.getElementById('export-data').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(Store.data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `meezan-book-store-backup-${todayStr()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast('Backup downloaded.', 'success');
  });

  document.getElementById('import-data').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try{
        const parsed = JSON.parse(evt.target.result);
        if(!Array.isArray(parsed.items) || !Array.isArray(parsed.sales)){
          throw new Error('Invalid file');
        }
        if(confirm('Importing this backup will replace your current data. Continue?')){
          Store.data = parsed;
          if(!Store.data.nextBill) Store.data.nextBill = (Store.data.sales.length || 0) + 1;
          Store.save();
          populateCategoryFilter();
          renderDashboard();
          renderInventory();
          renderSellList();
          renderReports();
          toast('Backup imported successfully.', 'success');
        }
      }catch(err){
        toast('This file is not a valid backup. Nothing was changed.', 'error');
      }
      e.target.value = '';
    };
    reader.readAsText(file);
  });
}

/* ---------- Init ---------- */
function init(){
  Store.load();
  initMobileNav();
  initNav();
  initAddItemForm();
  initInventoryFilters();
  initEditModal();
  initDashboardSearch();
  initBillModal();
  initBackup();

  document.getElementById('sell-search').addEventListener('input', renderSellList);
  document.getElementById('cart-discount').addEventListener('input', renderCart);
  document.getElementById('checkout-btn').addEventListener('click', checkout);

  populateCategoryFilter();
  renderDashboard();
  renderInventory();
  renderSellList();
  renderCart();
  renderReports();
}

document.addEventListener('DOMContentLoaded', init);
