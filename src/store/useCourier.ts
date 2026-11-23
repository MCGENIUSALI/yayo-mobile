import { router } from 'expo-router';
import { currentAccount } from '@/domain/auth';
import { cashDue, missionStage, pickupLine, sortMissions } from '@/domain/courier';
import { activeCourierSpace, courierMissions } from '@/domain/state';
import type { Order } from '@/domain/types';
import { useStore } from './AppStore';

/** Signed-in courier: account, courier space (once L1 is saved), missions and cash to pay back. */
export function useCourier() {
  const store = useStore();
  const { state } = store;
  const account = currentAccount(state.auth);
  const space = activeCourierSpace(state);
  const missions = sortMissions(courierMissions(state, space?.status === 'verified' ? space.accountId : undefined));
  const due = cashDue(missions, space?.remittances ?? []);
  /** Pick-up address: the seller's V1 address when the shop uses the seller app. */
  const pickup = (o: Order) => pickupLine(o, Object.values(state.seller).find((s) => s.shopId === o.shopId)?.profile.pickupAddress);
  return { ...store, account, space, missions, due, pickup };
}

/** Opens a mission on the screen of its current step (L5/L6, L7, L8). */
export function openMission(o: Order) {
  const stage = missionStage(o);
  if (stage === 'handover') router.push({ pathname: '/livreur/remise/[id]', params: { id: o.id } });
  else if (stage === 'delivered') router.push({ pathname: '/livreur/livree/[id]', params: { id: o.id } });
  else router.push({ pathname: '/livreur/mission/[id]', params: { id: o.id } });
}
