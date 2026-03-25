const API_BASE = '';

const api = {
  getToken() {
    return localStorage.getItem('token');
  },
  getUser() {
    try {
      return JSON.parse(localStorage.getItem('user') || 'null');
    } catch {
      return null;
    }
  },

  async request(path, options = {}) {
    const token = this.getToken();
    const headers = { ...options.headers };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (options.body && !(options.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
    }
    const res = await fetch(API_BASE + path, { ...options, headers });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || data.message || 'Request failed');
    return data;
  },

  async signup(name, email, password, role) {
    return this.request('/api/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ name, email, password, role }),
    });
  },
  async login(email, password) {
    return this.request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  },

  async getProducts(params = {}) {
    const q = new URLSearchParams(params).toString();
    return this.request('/api/products' + (q ? '?' + q : ''));
  },
  async getProduct(id) {
    return this.request('/api/products/' + id);
  },
  async addProduct(formData) {
    return this.request('/api/products', { method: 'POST', body: formData });
  },
  async updateProduct(id, formData) {
    return this.request('/api/products/' + id, { method: 'PUT', body: formData });
  },
  async deleteProduct(id) {
    return this.request('/api/products/' + id, { method: 'DELETE' });
  },

  async getCart() {
    return this.request('/api/cart');
  },
  async addToCart(productId, quantity) {
    return this.request('/api/cart', {
      method: 'POST',
      body: JSON.stringify({ productId, quantity }),
    });
  },
  async removeFromCart(productId) {
    return this.request('/api/cart/' + productId, { method: 'DELETE' });
  },

  async createOrder() {
    return this.request('/api/orders', { method: 'POST' });
  },
  async getOrders() {
    return this.request('/api/orders');
  },
  async updateOrderStatus(orderId, status) {
    return this.request('/api/orders/' + orderId + '/status', {
      method: 'PUT',
      body: JSON.stringify({ status }),
    });
  },

  async createPayment(orderId, amount) {
    return this.request('/api/payments', {
      method: 'POST',
      body: JSON.stringify({ orderId, amount }),
    });
  },

  async getReviews(productId) {
    return this.request('/api/reviews/' + productId);
  },
  async addReview(productId, rating, comment, imageFile) {
    const formData = new FormData();
    formData.append('productId', productId);
    formData.append('rating', rating);
    formData.append('comment', comment || '');
    if (imageFile) formData.append('image', imageFile);
    return this.request('/api/reviews', {
      method: 'POST',
      body: formData,
    });
  },

  async getDailyReport() {
    return this.request('/api/reports/daily');
  },
  async getMonthlyReport() {
    return this.request('/api/reports/monthly');
  },
  async getInventory() {
    return this.request('/api/reports/inventory');
  },
  async getReportTrends() {
    return this.request('/api/reports/trends');
  },
};
