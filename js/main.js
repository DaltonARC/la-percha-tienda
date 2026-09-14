/* =========================================================
   CONFIGURACIÓN — esto es lo único que hay que tocar
   ========================================================= */
const CONFIG = {
  storeName: "La Percha",
  instagramDefaultAccounts: [{ id: "ig_seed", username: "janicegp18" }],
  currency: "RD$"
};

/* =========================================================
   ESTADO Y PERSISTENCIA (localStorage — solo en este navegador,
   pensado para validación / demo del cliente)
   ========================================================= */
const LS_PRODUCTS = "lapercha_products";
const LS_CART = "lapercha_cart";
const LS_AUTH = "lapercha_admin_auth_v2";
const LS_IG_ACCOUNTS = "lapercha_ig_accounts";
const LS_IG_ACTIVE = "lapercha_ig_active";
const LS_ADMIN_CRED = "lapercha_admin_cred";

const seedProducts = [
  {id:"p1", name:"Camisa Oversize Mango", category:"Camisas", price:1500, sizes:["S","M","L","XL"], stock:8, desc:"Camisa oversize de algodón, corte ancho, ideal para el calor de Santiago.", images:["https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=600"]},
  {id:"p2", name:"Sudadera Guayaba", category:"Sudaderas", price:2200, sizes:["M","L","XL"], stock:3, desc:"Sudadera unisex, felpa suave, estampado frontal.", images:["https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=600"]},
  {id:"p3", name:"Gorra Malecón", category:"Accesorios", price:900, sizes:["Única"], stock:12, desc:"Gorra ajustable, bordado frontal.", images:["https://images.unsplash.com/photo-1521369909029-2afed882baee?w=600"]},
  {id:"p4", name:"Jean Recto Cibao", category:"Pantalones", price:1900, sizes:["28","30","32","34"], stock:5, desc:"Jean corte recto, lavado medio.", images:["https://images.unsplash.com/photo-1542272604-787c3835535d?w=600"]},
];

function loadJSONStrict(key, fallback){
  const raw = localStorage.getItem(key);
  if(raw === null){
    localStorage.setItem(key, JSON.stringify(fallback));
    return [...fallback];
  }
  let parsed;
  try{ parsed = JSON.parse(raw); }
  catch(e){ parsed = null; }
  if(!Array.isArray(parsed)){
    localStorage.setItem(key, JSON.stringify(fallback));
    return [...fallback];
  }
  return parsed;
}
function loadProducts(){ return loadJSONStrict(LS_PRODUCTS, seedProducts); }
function saveProducts(list){ localStorage.setItem(LS_PRODUCTS, JSON.stringify(list)); }

let products = loadProducts();
let cart = loadJSONStrict(LS_CART, []);
let activeCategory = "Todos";
let currentProduct = null;
let selectedSize = null;
let selectedQty = 1;

/* =========================================================
   CUENTAS DE INSTAGRAM — destino del checkout
   (seed desde CONFIG.instagramDefaultAccounts al primer
   arranque; se gestionan desde el panel admin)
   ========================================================= */
function normalizeUsername(raw){
  return String(raw || "").trim().replace(/^@/, "").replace(/\s+/g, "").toLowerCase();
}
function isValidInstagramUsername(u){
  return /^[A-Za-z0-9._]{1,30}$/.test(u);
}
function isValidInstagramAccountId(id){
  // los ids se generan internamente (ig_seed / ig_<timestamp>); validar acá
  // evita que un id manipulado en localStorage rompa los onclick del panel
  return typeof id === "string" && /^[A-Za-z0-9_:-]{1,64}$/.test(id);
}
function seedInstagramAccounts(){
  const seed = CONFIG.instagramDefaultAccounts
    .map(a => ({ id: a.id, username: normalizeUsername(a.username) }))
    .filter(a => isValidInstagramAccountId(a.id) && isValidInstagramUsername(a.username));
  localStorage.setItem(LS_IG_ACCOUNTS, JSON.stringify(seed));
  return seed;
}
function loadInstagramAccounts(){
  const raw = localStorage.getItem(LS_IG_ACCOUNTS);
  if(!raw) return seedInstagramAccounts();
  try{
    return JSON.parse(raw)
      .map(a => ({ id: a.id, username: normalizeUsername(a.username) }))
      .filter(a => isValidInstagramAccountId(a.id) && isValidInstagramUsername(a.username));
  }catch(e){
    return seedInstagramAccounts();
  }
}
function saveInstagramAccounts(list){ localStorage.setItem(LS_IG_ACCOUNTS, JSON.stringify(list)); }
function getActiveInstagramAccount(){
  const activeId = localStorage.getItem(LS_IG_ACTIVE);
  const stored = instagramAccounts.find(a => a.id === activeId);
  if(stored) return stored;
  if(instagramAccounts.length > 0){
    const promoted = instagramAccounts[0];
    localStorage.setItem(LS_IG_ACTIVE, promoted.id);
    return promoted;
  }
  return null;
}
function setActiveInstagramAccount(id){
  if(!instagramAccounts.some(a => a.id === id)) return false;
  localStorage.setItem(LS_IG_ACTIVE, id);
  return true;
}
let instagramAccounts = loadInstagramAccounts();

function saveCart(){ localStorage.setItem(LS_CART, JSON.stringify(cart)); updateCartCount(); }
function money(cents){ return CONFIG.currency + " " + (cents).toLocaleString("es-DO"); }

/* =========================================================
   RENDER TIENDA
   ========================================================= */
function renderFilters(){
  const cats = ["Todos", ...new Set(products.map(p=>p.category))];
  document.getElementById("filters").innerHTML = cats.map(c =>
    `<button class="chip ${c===activeCategory?'active':''}" onclick="setCategory('${c.replace(/'/g,"\\'")}')">${c}</button>`
  ).join("");
}
function setCategory(c){ activeCategory = c; renderFilters(); renderProducts(); }

function renderProducts(){
  const q = document.getElementById("searchInput").value.trim().toLowerCase();
  const visible = products.filter(p =>
    !p.hidden &&
    (activeCategory==="Todos" || p.category===activeCategory) &&
    (!q || p.name.toLowerCase().includes(q))
  );
  const grid = document.getElementById("grid");
  const empty = document.getElementById("emptyState");
  if(visible.length===0){ grid.innerHTML=""; empty.style.display="block"; return; }
  empty.style.display="none";
  grid.innerHTML = visible.map(p => `
    <div class="tag-card" onclick="openProduct('${p.id}')">
      <div class="tag-hole"></div>
      <div class="img-wrap"><img src="${p.images[0]||''}" alt="${p.name}" loading="lazy"></div>
      <div class="tag-body">
        <div class="tag-cat">${p.category}</div>
        <div class="tag-name">${p.name}</div>
        ${p.stock<=3 ? `<div class="stock-low">¡Últimas ${p.stock} unidades!</div>` : ``}
        <div class="tag-price-row">
          <span class="stamp">${money(p.price)}</span>
        </div>
      </div>
    </div>
  `).join("");
}

function openProduct(id){
  currentProduct = products.find(p=>p.id===id);
  if(!currentProduct) return;
  selectedSize = currentProduct.sizes[0];
  selectedQty = 1;
  renderProductModal();
  document.getElementById("productOverlay").classList.add("show");
}
function closeProduct(){ document.getElementById("productOverlay").classList.remove("show"); }

function renderProductModal(){
  const p = currentProduct;
  document.getElementById("productModal").innerHTML = `
    <button class="modal-close" onclick="closeProduct()">✕</button>
    <div class="img-wrap"><img src="${p.images[0]||''}" alt="${p.name}"></div>
    <div class="modal-body">
      <div class="tag-cat">${p.category}</div>
      <h2>${p.name}</h2>
      <p class="desc">${p.desc||''}</p>
      <div class="price-big">${money(p.price)}</div>
      <div class="field-label">Talla</div>
      <div class="size-row">
        ${p.sizes.map(s=>`<button class="size-btn ${s===selectedSize?'active':''}" onclick="pickSize('${s.replace(/'/g,"\\'")}')">${s}</button>`).join("")}
      </div>
      <div class="field-label">Cantidad</div>
      <div class="qty-row">
        <button class="qty-btn" onclick="changeQty(-1)">−</button>
        <span class="qty-val" id="qtyVal">${selectedQty}</span>
        <button class="qty-btn" onclick="changeQty(1)">+</button>
      </div>
      <button class="btn-primary" onclick="addToCart()" ${p.stock<1?'disabled':''}>
        ${p.stock<1 ? 'Agotado' : 'Agregar al carrito'}
      </button>
    </div>
  `;
}
function pickSize(s){ selectedSize=s; renderProductModal(); }
function changeQty(d){
  selectedQty = Math.max(1, Math.min(currentProduct.stock, selectedQty+d));
  document.getElementById("qtyVal").textContent = selectedQty;
}
function addToCart(){
  const p = currentProduct;
  const existing = cart.find(i=>i.id===p.id && i.size===selectedSize);
  if(existing){ existing.qty += selectedQty; }
  else{ cart.push({id:p.id, name:p.name, price:p.price, size:selectedSize, qty:selectedQty, image:p.images[0]||''}); }
  saveCart();
  showToast("Agregado al carrito 🛍️");
  closeProduct();
  openCart();
}

/* =========================================================
   CARRITO
   ========================================================= */
function updateCartCount(){
  const count = cart.reduce((a,i)=>a+i.qty,0);
  document.getElementById("cartCount").textContent = count;
}
function openCart(){
  renderCart();
  document.getElementById("drawer").classList.add("show");
  document.getElementById("drawerOverlay").classList.add("show");
}
function closeCart(){
  document.getElementById("drawer").classList.remove("show");
  document.getElementById("drawerOverlay").classList.remove("show");
}
function renderCart(){
  const itemsEl = document.getElementById("drawerItems");
  const footEl = document.getElementById("drawerFoot");
  if(cart.length===0){
    itemsEl.innerHTML = `<div class="empty-cart">Tu carrito está vacío.<br>Explora la colección y agrega tus piezas.</div>`;
    footEl.innerHTML = "";
    return;
  }
  itemsEl.innerHTML = cart.map((i,idx)=>`
    <div class="cart-item">
      <img src="${i.image}" alt="${i.name}">
      <div class="cart-item-info">
        <div class="name">${i.name}</div>
        <div class="meta">Talla ${i.size} · ${money(i.price)}</div>
        <div class="cart-item-actions">
          <button class="mini-btn" onclick="cartQty(${idx},-1)">−</button>
          <span>${i.qty}</span>
          <button class="mini-btn" onclick="cartQty(${idx},1)">+</button>
          <button class="remove-link" onclick="cartRemove(${idx})">Quitar</button>
        </div>
      </div>
    </div>
  `).join("");
  const subtotal = cart.reduce((a,i)=>a+i.price*i.qty,0);
  const igAccount = getActiveInstagramAccount();
  footEl.innerHTML = `
    <div class="shipping-label">
      <div class="to">📦 Se enviará a Instagram</div>
      ${igAccount
        ? `Al confirmar, copiamos tu pedido y abrimos el chat de
           <span class="ig">@${igAccount.username}</span> para que cierres la compra.`
        : `<div>Configurá una cuenta de Instagram en el panel admin</div>`}
    </div>
    <div class="subtotal-row"><span>Subtotal</span><strong>${money(subtotal)}</strong></div>
    <button class="btn-primary" onclick="checkout()" ${igAccount ? "" : "disabled"}>Enviar pedido por Instagram</button>
  `;
}
function cartQty(idx,d){
  cart[idx].qty += d;
  if(cart[idx].qty<=0) cart.splice(idx,1);
  saveCart(); renderCart();
}
function cartRemove(idx){ cart.splice(idx,1); saveCart(); renderCart(); }

function checkout(){
  if(cart.length===0) return;
  const igAccount = getActiveInstagramAccount();
  if(!igAccount){
    showToast("Configurá una cuenta de Instagram en el panel admin");
    return;
  }
  const lines = cart.map(i => `• ${i.name} (Talla ${i.size}) x${i.qty} — ${money(i.price*i.qty)}`);
  const total = cart.reduce((a,i)=>a+i.price*i.qty,0);
  const text = `¡Hola! Quiero hacer este pedido 🛍️\n\n${lines.join("\n")}\n\nTotal: ${money(total)}`;

  const finish = () => {
    window.open(`https://instagram.com/${igAccount.username}`, "_blank");
  };

  if(navigator.clipboard && window.isSecureContext){
    navigator.clipboard.writeText(text).then(()=>{
      showToast("Pedido copiado — pégalo en el chat de Instagram 📋");
      finish();
    }).catch(finish);
  } else {
    finish();
  }
}

/* =========================================================
   TOAST
   ========================================================= */
let toastTimer;
function showToast(msg){
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(()=>t.classList.remove("show"), 3200);
}

/* =========================================================
   ADMIN — acceso con clave enrolada (SHA-256 + salt)
   La primera vez que se entra se registra la clave en
   localStorage (lapercha_admin_cred). Requiere secure
   context (https o localhost) para crypto.subtle.
   ========================================================= */
async function hashPasscode(pass, salt){
  const data = new TextEncoder().encode(salt + pass);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, "0")).join("");
}
async function enrollAdminPasscode(pass){
  const saltBytes = new Uint8Array(16);
  crypto.getRandomValues(saltBytes);
  const salt = Array.from(saltBytes, b => b.toString(16).padStart(2, "0")).join("");
  const hash = await hashPasscode(pass, salt);
  const cred = { salt, hash };
  localStorage.setItem(LS_ADMIN_CRED, JSON.stringify(cred));
  return cred;
}
async function verifyAdminPasscode(pass, cred){
  const hash = await hashPasscode(pass, cred.salt);
  return hash === cred.hash;
}

function openAdmin(){
  document.getElementById("adminOverlay").classList.add("show");
  if(sessionStorage.getItem(LS_AUTH)==="1"){ renderAdminPanel(); }
  else{ renderAdminLogin(); }
}
function closeAdmin(){ document.getElementById("adminOverlay").classList.remove("show"); }

function renderAdminLogin(){
  const hasCred = !!localStorage.getItem(LS_ADMIN_CRED);
  document.getElementById("adminBody").innerHTML = `
    <h2 style="font-size:22px;">Acceso administrador</h2>
    <div class="admin-login">
      <p style="font-size:13px;color:#6b6250;">${hasCred ? "Introduce la clave de administrador." : "Registra la clave la primera vez para habilitar el panel."}</p>
      <input type="password" id="passInput" placeholder="••••" maxlength="64" onkeydown="if(event.key==='Enter')tryLogin()">
      <button class="btn-primary" onclick="tryLogin()">Entrar</button>
    </div>
  `;
  setTimeout(()=>document.getElementById("passInput")?.focus(), 50);
}
async function tryLogin(){
  const val = document.getElementById("passInput").value;
  if(!val){ showToast("Introduce una clave"); return; }
  if(!window.isSecureContext){
    showToast("La gestión de claves requiere https o localhost (secure context)");
    return;
  }
  const raw = localStorage.getItem(LS_ADMIN_CRED);
  if(!raw){
    try{
      await enrollAdminPasscode(val);
    }catch(e){
      showToast("No se pudo registrar la clave en este contexto (https o localhost)");
      return;
    }
    sessionStorage.setItem(LS_AUTH, "1");
    renderAdminPanel();
    showToast("Clave registrada — ya podés gestionar la tienda");
    return;
  }
  let cred = null;
  try{ cred = JSON.parse(raw); }catch(e){ cred = null; }
  if(!cred || !cred.salt || !cred.hash){
    showToast("La clave guardada está dañada — borrá " + LS_ADMIN_CRED + " y registrala de nuevo");
    return;
  }
  const ok = await verifyAdminPasscode(val, cred);
  if(ok){
    sessionStorage.setItem(LS_AUTH, "1");
    renderAdminPanel();
  } else {
    showToast("Clave incorrecta");
  }
}
function logoutAdmin(){ sessionStorage.removeItem(LS_AUTH); renderAdminLogin(); }

let editingId = null;
let formImages = [];

function renderAdminPanel(){
  document.getElementById("adminBody").innerHTML = `
    <div class="admin-topbar">
      <h2 style="font-size:22px;">Gestionar productos</h2>
      <button class="btn-secondary" onclick="logoutAdmin()">Cerrar sesión</button>
    </div>
    <form class="admin-form" onsubmit="return saveProduct(event)">
      <div class="full"><label>Nombre</label><input id="f_name" required></div>
      <div><label>Categoría</label><input id="f_category" required placeholder="Ej: Camisas"></div>
      <div><label>Precio (${CONFIG.currency})</label><input id="f_price" type="number" min="1" required></div>
      <div><label>Tallas (separadas por coma)</label><input id="f_sizes" placeholder="S, M, L, XL"></div>
      <div><label>Stock</label><input id="f_stock" type="number" min="0" required></div>
      <div class="full"><label>Descripción</label><textarea id="f_desc"></textarea></div>
      <div class="full">
        <label>Fotos</label>
        <input id="f_images" type="file" accept="image/*" multiple onchange="handleImages(event)">
        <div class="thumbs" id="f_thumbs"></div>
      </div>
      <div class="full" style="display:flex; gap:10px;">
        <button type="submit" class="btn-primary" style="flex:1;">${editingId?'Guardar cambios':'Publicar producto'}</button>
        ${editingId?`<button type="button" class="btn-secondary" onclick="cancelEdit()">Cancelar</button>`:''}
      </div>
    </form>
    <div class="admin-list" id="adminList"></div>
    <div id="adminAccounts"></div>
  `;
  renderAdminThumbs();
  renderAdminList();
  renderAdminAccounts();
}

function handleImages(e){
  const files = Array.from(e.target.files).slice(0,4);
  formImages = [];
  let loaded = 0;
  if(files.length===0){ renderAdminThumbs(); return; }
  files.forEach(file=>{
    const reader = new FileReader();
    reader.onload = ev => {
      formImages.push(ev.target.result);
      loaded++;
      if(loaded===files.length) renderAdminThumbs();
    };
    reader.readAsDataURL(file);
  });
}
function renderAdminThumbs(){
  document.getElementById("f_thumbs").innerHTML = formImages.map(src=>`<img src="${src}">`).join("");
}

function saveProduct(e){
  e.preventDefault();
  const name = document.getElementById("f_name").value.trim();
  const category = document.getElementById("f_category").value.trim();
  const price = parseInt(document.getElementById("f_price").value,10);
  const stock = parseInt(document.getElementById("f_stock").value,10);
  const sizes = document.getElementById("f_sizes").value.split(",").map(s=>s.trim()).filter(Boolean);
  const desc = document.getElementById("f_desc").value.trim();

  if(!name || !category || !price || price<1 || isNaN(stock)){
    showToast("Revisa los campos obligatorios"); return false;
  }
  const images = formImages.length ? formImages : (editingId ? products.find(p=>p.id===editingId).images : []);
  if(images.length===0){ showToast("Agrega al menos una foto"); return false; }

  if(editingId){
    const idx = products.findIndex(p=>p.id===editingId);
    products[idx] = {...products[idx], name, category, price, stock, sizes: sizes.length?sizes:["Única"], desc, images};
  } else {
    products.push({
      id: "p"+Date.now(), name, category, price, stock,
      sizes: sizes.length?sizes:["Única"], desc, images, hidden:false
    });
  }
  saveProducts(products);
  cancelEdit();
  renderAdminList();
  renderFilters();
  renderProducts();
  showToast(editingId ? "Producto actualizado" : "Producto publicado");
  return false;
}

function editProduct(id){
  const p = products.find(x=>x.id===id);
  editingId = id;
  formImages = [...p.images];
  renderAdminPanel();
  document.getElementById("f_name").value = p.name;
  document.getElementById("f_category").value = p.category;
  document.getElementById("f_price").value = p.price;
  document.getElementById("f_stock").value = p.stock;
  document.getElementById("f_sizes").value = p.sizes.join(", ");
  document.getElementById("f_desc").value = p.desc||"";
  renderAdminThumbs();
}
function cancelEdit(){ editingId=null; formImages=[]; renderAdminPanel(); }

function toggleVisible(id){
  const p = products.find(x=>x.id===id);
  p.hidden = !p.hidden;
  saveProducts(products);
  renderAdminList(); renderProducts();
}
function deleteProduct(id){
  if(!confirm("¿Eliminar este producto? Esta acción no se puede deshacer.")) return;
  products = products.filter(p=>p.id!==id);
  saveProducts(products);
  renderAdminList(); renderFilters(); renderProducts();
  showToast("Producto eliminado");
}

function renderAdminList(){
  const list = document.getElementById("adminList");
  if(!list) return;
  if(products.length===0){ list.innerHTML = `<p style="color:#6b6250;font-size:13px;">Aún no hay productos.</p>`; return; }
  list.innerHTML = products.map(p=>`
    <div class="admin-row ${p.hidden?'hidden-flag':''}">
      <img src="${p.images[0]||''}">
      <div class="info">
        <div class="n">${p.name} ${p.hidden?'(oculto)':''}</div>
        <div class="m">${p.category} · ${money(p.price)} · stock ${p.stock}</div>
      </div>
      <div class="actions">
        <button class="icon-btn" title="Mostrar/ocultar" onclick="toggleVisible('${p.id}')">${p.hidden?'👁️':'🙈'}</button>
        <button class="icon-btn" title="Editar" onclick="editProduct('${p.id}')">✏️</button>
        <button class="icon-btn danger" title="Eliminar" onclick="deleteProduct('${p.id}')">🗑️</button>
      </div>
    </div>
  `).join("");
}

/* =========================================================
   ADMIN — cuentas de Instagram destino
   ========================================================= */
function renderAdminAccounts(){
  const wrap = document.getElementById("adminAccounts");
  if(!wrap) return;
  wrap.innerHTML = `
    <h3 class="admin-section-title">Cuentas de Instagram</h3>
    <form class="admin-form admin-accounts-form" onsubmit="return addInstagramAccount(event)">
      <div class="full">
        <label>Cuenta destino para el checkout (sin @)</label>
        <div class="ig-add-row">
          <input id="igNewUsername" placeholder="@usuario" required>
          <button type="submit" class="btn-primary ig-add-btn">Agregar</button>
        </div>
      </div>
    </form>
    <div class="admin-list" id="igAdminList"></div>
  `;
  renderIgList();
}
function renderIgList(){
  const list = document.getElementById("igAdminList");
  if(!list) return;
  if(instagramAccounts.length===0){
    list.innerHTML = `<p style="color:#6b6250;font-size:13px;">Aún no hay cuentas de Instagram.</p>`;
    return;
  }
  const activeId = localStorage.getItem(LS_IG_ACTIVE);
  list.innerHTML = instagramAccounts.map(a => `
    <div class="admin-row" data-id="${a.id}">
      <div class="info">
        <div class="n">@${a.username} ${a.id===activeId ? '<span class="ig-badge">ACTIVA</span>' : ''}</div>
        <div class="m">${a.id}</div>
      </div>
      <div class="actions">
        ${a.id!==activeId ? `<button class="mini-btn" title="Hacer activa" onclick="selectActiveAccount('${a.id}')">Hacer activa</button>` : ''}
        <button class="icon-btn" title="Editar" onclick="editInstagramAccount('${a.id}')">✏️</button>
        <button class="icon-btn danger" title="Eliminar" onclick="deleteInstagramAccount('${a.id}')">🗑️</button>
      </div>
    </div>
  `).join("");
}
function addInstagramAccount(e){
  e.preventDefault();
  const input = document.getElementById("igNewUsername");
  const username = normalizeUsername(input.value);
  if(!isValidInstagramUsername(username)){
    showToast("Usuario de Instagram inválido — solo letras, números, puntos y guion bajo (máx. 30)");
    return false;
  }
  if(instagramAccounts.some(a => a.username.toLowerCase() === username)){
    showToast("Esa cuenta ya está en la lista");
    return false;
  }
  instagramAccounts.push({ id: "ig_" + Date.now(), username });
  saveInstagramAccounts(instagramAccounts);
  input.value = "";
  renderIgList();
  renderCart();
  showToast("Cuenta agregada");
  return false;
}
function editInstagramAccount(id){
  const row = document.querySelector(`#igAdminList .admin-row[data-id="${id}"]`);
  const a = instagramAccounts.find(x => x.id === id);
  if(!row || !a) return;
  row.innerHTML = `
    <div class="info" style="flex:1; min-width:0;">
      <input id="igEditInput" value="${a.username}" maxlength="30" onkeydown="if(event.key==='Enter')saveInstagramAccountEdit('${id}')">
    </div>
    <div class="actions">
      <button class="icon-btn" title="Guardar" onclick="saveInstagramAccountEdit('${id}')">💾</button>
      <button class="icon-btn danger" title="Cancelar" onclick="renderIgList()">✕</button>
    </div>
  `;
  const edit = document.getElementById("igEditInput");
  if(edit) edit.focus();
}
function saveInstagramAccountEdit(id){
  const input = document.getElementById("igEditInput");
  if(!input) return;
  const username = normalizeUsername(input.value);
  if(!isValidInstagramUsername(username)){
    showToast("Usuario de Instagram inválido — solo letras, números, puntos y guion bajo (máx. 30)");
    return;
  }
  if(instagramAccounts.some(a => a.id!==id && a.username.toLowerCase() === username)){
    showToast("Esa cuenta ya está en la lista");
    return;
  }
  const a = instagramAccounts.find(x => x.id === id);
  if(a){
    a.username = username;
    saveInstagramAccounts(instagramAccounts);
  }
  renderIgList();
  renderCart();
  showToast("Cuenta actualizada");
}
function deleteInstagramAccount(id){
  if(!confirm("¿Eliminar esta cuenta de Instagram? Esta acción no se puede deshacer.")) return;
  instagramAccounts = instagramAccounts.filter(a => a.id !== id);
  saveInstagramAccounts(instagramAccounts);
  if(localStorage.getItem(LS_IG_ACTIVE) === id){
    localStorage.removeItem(LS_IG_ACTIVE);
    const next = getActiveInstagramAccount();
    if(next) setActiveInstagramAccount(next.id);
  }
  renderIgList();
  renderCart();
  showToast("Cuenta eliminada");
}
function selectActiveAccount(id){
  if(setActiveInstagramAccount(id)){
    renderIgList();
    renderCart();
    showToast("Cuenta activa actualizada");
  }
}

/* =========================================================
   INIT
   ========================================================= */
document.getElementById("year").textContent = new Date().getFullYear();
renderFilters();
renderProducts();
updateCartCount();
