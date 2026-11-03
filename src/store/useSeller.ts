import { router } from 'expo-router';
import { currentAccount } from '@/domain/auth';
import { activeSellerSpace, shopOrders } from '@/domain/state';
import type { Order } from '@/domain/types';
import { haptic } from '@/ui/Pressable';
import { useStore } from './AppStore';

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
