import type { ApiClient } from './client';
import { extractTokens, type Tokens } from './tokens';

/**
 * Typed calls to the YA YO API (OpenAPI « Yayo E-commerce API » 1.0).
 * Request bodies follow the spec's DTOs. Response bodies are `unknown`: the spec
 * leaves Product, Order, Content… empty, so the app converts them in
 * mappers.ts, adjusted to what `npm run api:check` shows.
 *
 * Left out on purpose: courier assignment, pick-up and delivery proof
 * (decision pending on the delivery model) and admin routes.
 */

// ---- Requests (from the spec) ----

export interface AddressInput {
  street: string;
  city: string;
  country: string;
  state?: string;
  zip?: string;
  label?: string;
  recipient?: string;
  phoneE164?: string;
  instructions?: string;
}

export interface ProductQuery {
  page?: number;
  limit?: number;
  search?: string;
  category?: string;
  vendorId?: string;
  minPrice?: number;
  maxPrice?: number;
  sortByPrice?: 'asc' | 'desc';
  mine?: boolean;
}

export interface VariantInput {
  sku: string;
  stock: number;
  size?: string;
  color?: string;
  weight?: number;
}

export interface ProductInput {
  name: string;
  description?: string;
  price: number;
  currency?: string;
  compareAtPrice?: number;
  categoryId?: string;
  imageUrls?: string[];
  variants?: VariantInput[];
  tags?: string[];
  labels?: string[];
  lowStockThreshold?: number;
  status?: string;
}

export interface OrderItemInput {
  productId: string;
  variantSku: string;
  quantity: number;
}

export interface VendorProfileInput {
  shopName?: string;
  bio?: string;
  logoUrl?: string;
  coverUrl?: string;
  categoryId?: string;
  city?: string;
  commune?: string;
  prepTimeMinHours?: number;
  prepTimeMaxHours?: number;
}

export interface ContentInput {
  type: 'image' | 'video';
  mediaUrl: string;
  thumbnailUrl?: string;
  caption?: string;
  hashtags?: string[];
  /** 20 at most. */
  taggedProductIds?: string[];
  status?: 'draft' | 'published' | 'archived';
}

export interface CollectionInput {
  name: string;
  coverUrl?: string;
  productIds?: string[];
}

export interface Page {
  page?: number;
  limit?: number;
}

/** A local photo picked on the phone, ready for multipart upload. */
export interface LocalFile {
  uri: string;
  name: string;
  type: string;
}

export function createEndpoints(api: ApiClient) {
  const get = <T = unknown>(path: string, query?: Record<string, string | number | boolean | undefined>, auth = true) =>
    api.request<T>('GET', path, { query, auth });
  const id = encodeURIComponent;

  return {
    health: () => get('/health', undefined, false),

    auth: {
      /** Sends the SMS. The spec types the answer as an object; the app reads `challengeId`. */
      requestPhoneCode: async (phoneE164: string) => {
        const r = await api.request<{ challengeId?: unknown }>('POST', '/auth/otp/request', { body: { phoneE164 }, auth: false });
        return { challengeId: typeof r?.challengeId === 'string' ? r.challengeId : null, raw: r as unknown };
      },
      verifyPhoneCode: async (challengeId: string, code: string): Promise<{ tokens: Tokens | null; raw: unknown }> => {
        const raw = await api.request('POST', '/auth/otp/verify', { body: { challengeId, code }, auth: false });
        const tokens = extractTokens(raw);
        if (tokens) await api.tokens.set(tokens);
        return { tokens, raw };
      },
      requestEmailCode: async (email: string, name?: string) => {
        const r = await api.request<{ challengeId?: unknown }>('POST', '/auth/otp/email/request', { body: { email, name }, auth: false });
        return { challengeId: typeof r?.challengeId === 'string' ? r.challengeId : null, raw: r as unknown };
      },
      verifyEmailCode: async (challengeId: string, code: string) => {
        const raw = await api.request('POST', '/auth/otp/email/verify', { body: { challengeId, code }, auth: false });
        const tokens = extractTokens(raw);
        if (tokens) await api.tokens.set(tokens);
        return { tokens, raw };
      },
      profile: () => get('/auth/profile'),
      logout: async () => {
        try {
          await api.request('POST', '/auth/logout');
        } finally {
          await api.tokens.set(null);
        }
      },
    },

    me: {
      update: (name: string) => api.request('PATCH', '/users/me', { body: { name } }),
      completeOnboarding: () => api.request('POST', '/users/me/onboarding/complete'),
      addresses: () => get('/users/addresses'),
      addAddress: (a: AddressInput) => api.request('POST', '/users/addresses', { body: a }),
      updateAddress: (addressId: string, a: Partial<AddressInput>) => api.request('PATCH', `/users/addresses/${id(addressId)}`, { body: a }),
      removeAddress: (addressId: string) => api.request('DELETE', `/users/addresses/${id(addressId)}`),
      setDefaultAddress: (addressId: string) => api.request('PATCH', `/users/addresses/${id(addressId)}/default`),
      /** Toggle: the same call adds or removes the product. */
      toggleFavorite: (productId: string) => api.request('POST', `/users/wishlist/${id(productId)}`),
      favorites: () => get('/users/my-wishlist'),
      recentProducts: () => get('/users/recent-products'),
    },

    catalog: {
      products: (q: ProductQuery = {}) => get('/products', { ...q }, !!q.mine),
      product: (productId: string) => get(`/products/${id(productId)}`, undefined, false),
      categories: () => get('/categories', undefined, false),
      shops: () => get('/users/vendors', undefined, false),
      shop: (vendorId: string) => get(`/users/vendor/${id(vendorId)}`, undefined, false),
      productReviews: (productId: string) => get(`/reviews/product/${id(productId)}`, undefined, false),
      shopReviews: (vendorId: string) => get(`/reviews/vendor/${id(vendorId)}`, undefined, false),
    },

    cart: {
      get: () => get('/cart'),
      add: (item: OrderItemInput) => api.request('POST', '/cart', { body: item }),
      setQuantity: (productId: string, variantSku: string, quantity: number) =>
        api.request('PATCH', `/cart/${id(productId)}/${id(variantSku)}`, { body: { quantity } }),
      remove: (productId: string, variantSku: string) => api.request('DELETE', `/cart/${id(productId)}/${id(variantSku)}`),
      clear: () => api.request('DELETE', '/cart'),
    },

    orders: {
      fees: () => get('/orders/fees'),
      validateCoupon: (code: string, amount: number) => get('/coupons/validate', { code, amount: String(amount) }),
      /** Creates the order. Payment is not in the API: the app keeps simulating Mobile Money. */
      create: (items: OrderItemInput[], shippingAddressId: string, billingAddressId = shippingAddressId, couponCode?: string) =>
        api.request('POST', '/orders', { body: { items, shippingAddressId, billingAddressId, couponCode } }),
      mine: () => get('/orders'),
      one: (orderId: string) => get(`/orders/${id(orderId)}`),
      history: (orderId: string) => get(`/orders/${id(orderId)}/status-history`),
      cancel: (orderId: string) => api.request('PATCH', `/orders/${id(orderId)}/cancel`),
      /** The API requires both ratings (1 to 5). */
      rate: (orderId: string, r: { sellerRating: number; courierRating: number; sellerComment?: string }) =>
        api.request('POST', `/orders/${id(orderId)}/rating`, { body: r }),
      review: (productId: string, rating: number, comment?: string) => api.request('POST', '/reviews', { body: { productId, rating, comment } }),
    },

    disputes: {
      /** The API takes text only: photos and later additions stay in the app. */
      open: (orderId: string, reason: string, description: string) => api.request('POST', '/disputes', { body: { orderId, reason, description } }),
      mine: () => get('/disputes/my'),
      forMyShop: () => get('/disputes/vendor'),
    },

    seller: {
      apply: (shopName: string, bio?: string) => api.request('POST', '/users/vendor/apply', { body: { shopName, bio } }),
      updateProfile: (p: VendorProfileInput) => api.request('PATCH', '/users/vendor/profile', { body: p }),
      createProduct: (p: ProductInput) => api.request('POST', '/products', { body: p }),
      updateProduct: (productId: string, p: Partial<ProductInput>) => api.request('PATCH', `/products/${id(productId)}`, { body: p }),
      removeProduct: (productId: string) => api.request('DELETE', `/products/${id(productId)}`),
      orders: () => get('/orders/vendor'),
      dashboard: () => get('/dashboards/vendor'),
      earnings: () => get('/dashboards/vendor/earnings'),
      revenue: () => get('/dashboards/vendor/revenue'),
    },

    uploads: {
      /** Field name "file" / "files" assumed (the spec has no request body for uploads). */
      image: (f: LocalFile) => {
        const form = new FormData();
        form.append('file', f as unknown as Blob);
        return api.request('POST', '/uploads/image', { form });
      },
      images: (files: LocalFile[]) => {
        const form = new FormData();
        files.forEach((f) => form.append('files', f as unknown as Blob));
        return api.request('POST', '/uploads/images', { form });
      },
    },

    content: {
      feed: (p: Page = {}) => get('/content/feed', { ...p }),
      mine: () => get('/content/mine'),
      ofShop: (vendorId: string) => get(`/content/vendor/${id(vendorId)}`, undefined, false),
      ofProduct: (productId: string) => get(`/content/product/${id(productId)}`, undefined, false),
      one: (contentId: string) => get(`/content/${id(contentId)}`),
      create: (c: ContentInput) => api.request('POST', '/content', { body: c }),
      update: (contentId: string, c: Partial<ContentInput>) => api.request('PATCH', `/content/${id(contentId)}`, { body: c }),
      remove: (contentId: string) => api.request('DELETE', `/content/${id(contentId)}`),
      like: (contentId: string) => api.request('POST', `/content/${id(contentId)}/like`),
      unlike: (contentId: string) => api.request('DELETE', `/content/${id(contentId)}/like`),
      insights: () => get('/creators/me/insights'),
      creator: (vendorId: string) => get(`/creators/${id(vendorId)}`, undefined, false),
    },

    follows: {
      mine: () => get('/follows/me'),
      state: (vendorId: string) => get(`/follows/${id(vendorId)}`),
      follow: (vendorId: string) => api.request('POST', `/follows/${id(vendorId)}`),
      unfollow: (vendorId: string) => api.request('DELETE', `/follows/${id(vendorId)}`),
    },

    collections: {
      ofShop: (vendorId: string) => get(`/collections/vendor/${id(vendorId)}`, undefined, false),
      one: (collectionId: string) => get(`/collections/${id(collectionId)}`, undefined, false),
      create: (c: CollectionInput) => api.request('POST', '/collections', { body: c }),
      update: (collectionId: string, c: Partial<CollectionInput>) => api.request('PATCH', `/collections/${id(collectionId)}`, { body: c }),
      remove: (collectionId: string) => api.request('DELETE', `/collections/${id(collectionId)}`),
    },
  };
}

export type Endpoints = ReturnType<typeof createEndpoints>;
