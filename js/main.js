/* =========================================================
   CONFIGURACIÓN — esto es lo único que hay que tocar
   ========================================================= */
const CONFIG = {
  storeName: "La Percha",
  instagramUsername: "TU_USUARIO_DE_INSTAGRAM",   // <-- CAMBIAR: sin @ y sin espacios
  adminPasscode: "1234",                           // <-- CAMBIAR: clave para entrar al panel admin
  currency: "RD$"
};

/* =========================================================
   ESTADO Y PERSISTENCIA (localStorage — solo en este navegador,
   pensado para validación / demo del cliente)
   ========================================================= */
const LS_PRODUCTS = "lapercha_products";
const LS_CART = "lapercha_cart";
const LS_AUTH = "lapercha_admin_auth";

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
  footEl.innerHTML = `
    <div class="shipping-label">
      <div class="to">📦 Se enviará a Instagram</div>
      Al confirmar, copiamos tu pedido y abrimos el chat de
      <span class="ig">@${CONFIG.instagramUsername}</span> para que cierres la compra.
    </div>
    <div class="subtotal-row"><span>Subtotal</span><strong>${money(subtotal)}</strong></div>
    <button class="btn-primary" onclick="checkout()">Enviar pedido por Instagram</button>
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
  const lines = cart.map(i => `• ${i.name} (Talla ${i.size}) x${i.qty} — ${money(i.price*i.qty)}`);
  const total = cart.reduce((a,i)=>a+i.price*i.qty,0);
  const text = `¡Hola! Quiero hacer este pedido 🛍️\n\n${lines.join("\n")}\n\nTotal: ${money(total)}`;

  const finish = () => {
    window.open(`https://instagram.com/${CONFIG.instagramUsername}`, "_blank");
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
   ADMIN — acceso con clave simple (CONFIG.adminPasscode)
   Nota: pensado para validación/demo. Los productos se guardan
   en localStorage de este navegador.
   ========================================================= */
function openAdmin(){
  document.getElementById("adminOverlay").classList.add("show");
  if(sessionStorage.getItem(LS_AUTH)==="1"){ renderAdminPanel(); }
  else{ renderAdminLogin(); }
}
function closeAdmin(){ document.getElementById("adminOverlay").classList.remove("show"); }

function renderAdminLogin(){
  document.getElementById("adminBody").innerHTML = `
    <h2 style="font-size:22px;">Acceso administrador</h2>
    <div class="admin-login">
      <p style="font-size:13px;color:#6b6250;">Introduce la clave para gestionar los productos.</p>
      <input type="password" id="passInput" placeholder="••••" maxlength="12" onkeydown="if(event.key==='Enter')tryLogin()">
      <button class="btn-primary" onclick="tryLogin()">Entrar</button>
    </div>
  `;
  setTimeout(()=>document.getElementById("passInput")?.focus(), 50);
}
function tryLogin(){
  const val = document.getElementById("passInput").value;
  if(val === CONFIG.adminPasscode){
    sessionStorage.setItem(LS_AUTH,"1");
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
  `;
  renderAdminThumbs();
  renderAdminList();
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
   INIT
   ========================================================= */
document.getElementById("year").textContent = new Date().getFullYear();
renderFilters();
renderProducts();
updateCartCount();
