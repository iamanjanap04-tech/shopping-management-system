function initAuth() {
  const token = api.getToken();
  const user = api.getUser();
  const authBtns = document.getElementById('authButtons');
  const userMenu = document.getElementById('userMenu');
  const adminMenu = document.getElementById('adminMenu');
  const cartLink = document.querySelector('.cart-link');

  if (!authBtns) return;

  if (token && user) {
    authBtns.classList.add('hidden');
    if (user.role === 'Admin') {
      adminMenu?.classList.remove('hidden');
      userMenu?.classList.add('hidden');
      cartLink?.classList.add('hidden');
    } else {
      userMenu?.classList.remove('hidden');
      adminMenu?.classList.add('hidden');
      cartLink?.classList.remove('hidden');
      const nameEl = document.getElementById('userName');
      if (nameEl) nameEl.textContent = user.name;
    }
  } else {
    authBtns?.classList.remove('hidden');
    userMenu?.classList.add('hidden');
    adminMenu?.classList.add('hidden');
    cartLink?.classList.remove('hidden');
  }

  document.getElementById('logoutBtn')?.addEventListener('click', logout);
  document.getElementById('adminLogout')?.addEventListener('click', logout);
}

function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  location.href = '/';
}

async function updateCartCount() {
  const el = document.getElementById('cartCount');
  if (!el) return;
  const user = api.getUser();
  if (user?.role === 'Admin') {
    el.textContent = '0';
    return;
  }
  if (!api.getToken()) {
    el.textContent = '0';
    return;
  }
  try {
    const cart = await api.getCart();
    el.textContent = cart.items?.length || 0;
  } catch {
    el.textContent = '0';
  }
}

function renderProductCard(p) {
  const price = Number(p.PRICE || 0);
  const discount = Number(p.DISCOUNT || 0);
  const finalPrice = Number(
    p.FINAL_PRICE ?? (price * (1 - discount / 100))
  );
  const avgRating = Number(p.AVG_RATING || 0);
  const totalReviews = Number(p.TOTAL_REVIEWS || 0);
  const fullStars = Math.round(avgRating);
  const stars = '★'.repeat(fullStars) + '☆'.repeat(5 - fullStars);
  const outOfStock = p.STOCK === 0;
  const imgSrc = (p.IMAGE_URL?.startsWith('http') || p.IMAGE_URL?.startsWith('/'))
    ? p.IMAGE_URL
    : '/uploads/' + (p.IMAGE_URL || 'default-product.png');

  return `
    <div class="product-card">
      <a href="/product.html?id=${p.PRODUCT_ID}">
        <div class="product-image">
          <img src="${imgSrc}" alt="${p.NAME}" onerror="this.src='https://via.placeholder.com/300x300?text=No+Image'">
          ${p.DISCOUNT > 0 ? `<span class="discount-badge">${p.DISCOUNT}% OFF</span>` : ''}
        </div>
        <h3 class="product-name">${p.NAME}</h3>
        <div class="product-prices">
          ${discount > 0 ? `<span class="original-price">$${price.toFixed(2)}</span>` : ''}
          <span class="final-price">$${finalPrice.toFixed(2)}</span>
        </div>
        <p class="product-rating">${totalReviews > 0 ? `${stars} ${avgRating.toFixed(1)} (${totalReviews})` : 'No reviews yet'}</p>
        <p class="stock-status ${outOfStock ? 'out' : 'in'}">${outOfStock ? 'OUT OF STOCK' : 'In Stock'}</p>
      </a>
    </div>
  `;
}

async function loadProducts() {
  const grid = document.getElementById('productsGrid');
  if (!grid) return;
  grid.innerHTML = '<div class="loading">Loading...</div>';
  try {
    const products = await api.getProducts();
    grid.innerHTML = products.length
      ? products.map(renderProductCard).join('')
      : '<p class="empty">No products found.</p>';
  } catch (err) {
    grid.innerHTML = '<p class="error">Failed to load products.</p>';
  }
}
