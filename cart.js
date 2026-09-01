// ---- Panier candle_bymisk (partagé entre les pages) ----

function getCart() {
  try { return JSON.parse(localStorage.getItem('candlebymisk_cart') || '[]'); }
  catch (e) { return []; }
}

function saveCart(cart) {
  localStorage.setItem('candlebymisk_cart', JSON.stringify(cart));
  updateCartBadge();
}

function addToCart(id, productId, name, price, image) {
  const cart = getCart();
  const existing = cart.find(item => item.id === id);
  if (existing) { existing.qty += 1; }
  else { cart.push({ id, productId, name, price, image, qty: 1 }); }
  saveCart(cart);
  openCart();
}

function addToCartFromCard(idx) {
  const product = window.productsData[idx];
  const priceEl = document.getElementById(`price-${idx}`);
  const imgWrap = document.getElementById(`img-${idx}`);
  const imgEl = imgWrap ? imgWrap.querySelector('img') : null;
  const price = parseFloat((priceEl.textContent || '0').replace(/[^\d.]/g, ''));
  const image = imgEl ? imgEl.getAttribute('src') : '';

  let name = product.name;
  let variantKey = product._id;
  if (product.sizes && product.sizes.length > 0) {
    const card = imgWrap.closest('.product-card');
    const activeBtn = card.querySelector('.size-btn.active');
    if (activeBtn) {
      name += ' (' + activeBtn.textContent.trim() + ')';
      variantKey += '-' + activeBtn.textContent.trim();
    }
  }
  addToCart(variantKey, product._id, name, price, image);
}

function removeFromCart(id) {
  const cart = getCart().filter(item => item.id !== id);
  saveCart(cart);
  renderCart();
}

function changeQty(id, delta) {
  const cart = getCart();
  const item = cart.find(i => i.id === id);
  if (!item) return;
  item.qty += delta;
  if (item.qty <= 0) { removeFromCart(id); return; }
  saveCart(cart);
  renderCart();
}

function cartTotal(cart) {
  return cart.reduce((sum, i) => sum + i.price * i.qty, 0);
}

function calculateShipping(subtotal, zone) {
  if (subtotal >= 199) return 0;
  return zone === 'casablanca' ? 20 : 35;
}

function updateShippingDisplay() {
  const cart = getCart();
  const subtotal = cartTotal(cart);
  const zoneInput = document.querySelector('#cartFormWrap input[name="zone"]:checked');
  const zone = zoneInput ? zoneInput.value : 'casablanca';
  const shipping = calculateShipping(subtotal, zone);

  const subtotalEl = document.getElementById('cartSubtotal');
  const shippingEl = document.getElementById('cartShipping');
  const totalEl = document.getElementById('cartTotal');
  if (subtotalEl) subtotalEl.textContent = subtotal + ' dh';
  if (shippingEl) shippingEl.textContent = subtotal === 0 ? '—' : (shipping === 0 ? 'Gratuite' : shipping + ' dh');
  if (totalEl) totalEl.textContent = (subtotal + shipping) + ' dh';
}

function updateCartBadge() {
  const cart = getCart();
  const count = cart.reduce((sum, i) => sum + i.qty, 0);
  document.querySelectorAll('.cart-badge').forEach(b => {
    b.textContent = count;
    b.style.display = count > 0 ? 'flex' : 'none';
  });
}

function renderCart() {
  const cart = getCart();
  const container = document.getElementById('cartItems');
  const totalEl = document.getElementById('cartTotal');
  const formWrap = document.getElementById('cartFormWrap');
  if (!container) return;

  if (cart.length === 0) {
    container.innerHTML = '<p class="cart-empty">Votre panier est vide.</p>';
    if (formWrap) formWrap.style.display = 'none';
    updateShippingDisplay();
    return;
  }

  if (formWrap) formWrap.style.display = 'block';

  container.innerHTML = cart.map(item => `
    <div class="cart-item">
      <div class="cart-item-img">${item.image ? `<img src="${item.image}" alt="${item.name}">` : '🕯️'}</div>
      <div class="cart-item-info">
        <p class="cart-item-name">${item.name}</p>
        <p class="cart-item-price">${item.price} dh</p>
        <div class="cart-qty">
          <button type="button" onclick="changeQty('${item.id}', -1)">−</button>
          <span>${item.qty}</span>
          <button type="button" onclick="changeQty('${item.id}', 1)">+</button>
        </div>
      </div>
      <button type="button" class="cart-item-remove" onclick="removeFromCart('${item.id}')" aria-label="Retirer">✕</button>
    </div>
  `).join('');

  updateShippingDisplay();
}

function openCart() {
  renderCart();
  document.getElementById('cartModal').classList.add('open');
}

function closeCart() {
  document.getElementById('cartModal').classList.remove('open');
}

function decrementStock(cart) {
  return fetch('/.netlify/functions/products')
    .then(res => res.json())
    .then(products => {
      const updates = cart.map(item => {
        const product = products.find(p => p._id === item.productId);
        if (!product) return Promise.resolve();
        const newStock = Math.max(0, (product.stock || 0) - item.qty);
        const updatedProduct = Object.assign({}, product, { stock: newStock });
        delete updatedProduct._id;
        return fetch('/.netlify/functions/products/' + item.productId, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updatedProduct)
        });
      });
      return Promise.all(updates);
    })
    .catch(() => { /* silencieux : la commande reste valide même si la maj du stock échoue */ });
}

function submitOrder(event) {
  event.preventDefault();
  const cart = getCart();
  if (cart.length === 0) return;

  const form = event.target;
  const subtotal = cartTotal(cart);
  const zone = form.querySelector('[name="zone"]:checked').value;
  const shipping = calculateShipping(subtotal, zone);
  const grandTotal = subtotal + shipping;

  const summary = cart.map(i => `${i.name} x${i.qty} — ${i.price * i.qty} dh`).join('\n');
  form.querySelector('[name="commande"]').value = summary;
  form.querySelector('[name="frais_livraison"]').value = shipping === 0 ? 'Gratuite' : shipping + ' dh';
  form.querySelector('[name="total"]').value = grandTotal + ' dh';

  const data = new URLSearchParams(new FormData(form)).toString();

  fetch('/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: data
  }).then(() => {
    decrementStock(cart);
    localStorage.removeItem('candlebymisk_cart');
    updateCartBadge();
    document.getElementById('cartItems').innerHTML = '<p class="cart-empty">Merci ! Votre commande a bien été envoyée. Nous vous contacterons rapidement.</p>';
    document.getElementById('cartFormWrap').style.display = 'none';
    document.getElementById('cartTotal').textContent = '0 dh';
    form.reset();
  }).catch(() => {
    alert("Une erreur s'est produite lors de l'envoi. Merci de réessayer ou de nous contacter via WhatsApp.");
  });
}

document.addEventListener('DOMContentLoaded', updateCartBadge);
