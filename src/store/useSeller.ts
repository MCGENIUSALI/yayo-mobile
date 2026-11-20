import { router } from 'expo-router';
import { currentAccount } from '@/domain/auth';
import { activeSellerSpace, shopOrders } from '@/domain/state';
import type { Order } from '@/domain/types';
import type { Kyc, ProductDraft, ProductStatus, SellerProduct, ShopProfile } from '@/domain/seller';
import { isServerMode } from '@/lib/supabase';
import { haptic } from '@/ui/Pressable';
import { useStore, type StoreAction } from './AppStore';
import { loadAccount } from './serverAuth';
import {
  deleteSellerProduct,
  markSellerOutOfStock,
  saveSellerProduct,
  saveShopPayout,
  saveShopProfile,
  setSellerProductOnline,
  submitShopKyc,
  type SellerWrite,
} from './serverSeller';

/** Signed-in seller: account, shop space (once V1 is saved) and the shop's paid orders. */
export function useSeller() {
  const store = useStore();
  const { state } = store;
  const account = currentAccount(state.auth);
  const space = activeSellerSpace(state);
  const orders = shopOrders(state, space?.status === 'verified' ? space.shopId : undefined);
  return { ...store, account, shop: space, orders };
}

/** V4 / V5 order cards: tap opens the order; "Préparer la commande" also starts the preparation. */
export function useSellerOrderNav() {
  const { dispatch } = useStore();
  const open = (o: Order) =>
    o.seller === 'ready'
      ? router.push({ pathname: '/vendeur/remise/[id]', params: { id: o.id } })
      : router.push({ pathname: '/vendeur/commande/[id]', params: { id: o.id } });
  const act = (o: Order) => {
    if (o.seller === 'new') {
      dispatch({ type: 'seller/orderEvent', orderId: o.id, event: { type: 'seller.start_preparing' } });
      haptic('success');
    }
    open(o);
  };
  return { open, act };
}

export type SellerActionResult = { ok: true; id?: string } | { ok: false; message: string };

/**
 * Seller writes (V1, V2, V7, V10, V12, V14, V15). Demo: applied on the device.
 * Server mode: written to Supabase first, then the space is reloaded from it;
 * the screen waits for the answer and keeps the form on a failure.
 */
export function useSellerActions() {
  const { state, dispatch, catalog } = useStore();
  const account = currentAccount(state.auth);
  const space = activeSellerSpace(state);

  const afterServer = async (r: SellerWrite & { id?: string }): Promise<SellerActionResult> => {
    if (!r.ok) return { ok: false, message: r.message };
    if (account) {
      dispatch({ type: 'sellerServer/loaded', accountId: account.id, space: r.space });
      // The shop review decides the seller role (pending → requested, approved → granted).
      const fresh = await loadAccount(account.id).catch(() => null);
      if (fresh) dispatch({ type: 'auth/serverRestored', account: fresh });
      // A product put online in a validated shop shows in the buyer catalogue.
      catalog.reload();
    }
    return { ok: true, id: r.id };
  };

  const demo = (a: StoreAction): SellerActionResult => {
    dispatch(a);
    return { ok: true };
  };

  const noAccount: SellerActionResult = { ok: false, message: 'Connecte-toi d’abord.' };

  return {
    server: isServerMode(),
    saveProfile: async (profile: ShopProfile) =>
      !isServerMode() ? demo({ type: 'seller/saveProfile', profile }) : account ? afterServer(await saveShopProfile(account.id, profile)) : noAccount,
    submitKyc: async (kyc: Kyc) =>
      !isServerMode() ? demo({ type: 'seller/submitKyc', kyc }) : account ? afterServer(await submitShopKyc(account.id, kyc)) : noAccount,
    setPayout: async (phone: string) =>
      !isServerMode() ? demo({ type: 'seller/setPayout', phone }) : account ? afterServer(await saveShopPayout(account.id, phone)) : noAccount,
    saveProduct: async (draft: ProductDraft, status: ProductStatus, id?: string) =>
      !isServerMode()
        ? demo({ type: 'seller/saveProduct', id, draft, status })
        : account && space
          ? afterServer(await saveSellerProduct(account.id, space.shopId, id, draft, status))
          : noAccount,
    setOnline: async (product: SellerProduct, online: boolean) =>
      !isServerMode() ? demo({ type: 'seller/setOnline', id: product.id, online }) : account ? afterServer(await setSellerProductOnline(account.id, product, online)) : noAccount,
    deleteProduct: async (id: string) =>
      !isServerMode() ? demo({ type: 'seller/deleteProduct', id }) : account ? afterServer(await deleteSellerProduct(account.id, id)) : noAccount,
    markOutOfStock: async (productIds: string[]) =>
      !isServerMode() ? demo({ type: 'seller/markOutOfStock', productIds }) : account ? afterServer(await markSellerOutOfStock(account.id, productIds)) : noAccount,
  };
}
