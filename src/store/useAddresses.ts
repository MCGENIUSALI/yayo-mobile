import type { AddressInput } from '@/domain/account';
import { currentAccount } from '@/domain/auth';
import { isServerMode } from '@/lib/supabase';
import { useStore } from './AppStore';
import { deleteAddress, saveAddress, setDefaultAddress, type AddressWrite } from './serverOrders';

export type AddressResult = { ok: true } | { ok: false; message: string };

/**
 * D13 to D15 writes. Demo: applied on the device. Server mode: written to
 * Supabase, then the address book is read back (a new address is selected
 * for the order being placed, as in the demo).
 */
export function useAddressActions() {
  const { state, dispatch, server } = useStore();
  const account = currentAccount(state.auth);
  const noAccount: AddressResult = { ok: false, message: 'Connecte-toi pour gérer tes adresses.' };

  const after = async (r: AddressWrite, selectId?: string): Promise<AddressResult> => {
    if (!r.ok) return { ok: false, message: r.message };
    await server.reloadAddresses(selectId);
    return { ok: true };
  };

  return {
    save: async (id: string | undefined, input: AddressInput, makeDefault: boolean): Promise<AddressResult> => {
      if (!isServerMode()) {
        dispatch({ type: 'address/save', id, input, makeDefault });
        return { ok: true };
      }
      if (!account) return noAccount;
      const r = await saveAddress(account.id, id, input, makeDefault);
      return after(r, !id && r.ok ? r.id : undefined);
    },
    remove: async (id: string): Promise<AddressResult> => {
      if (!isServerMode()) {
        dispatch({ type: 'address/delete', id });
        return { ok: true };
      }
      return account ? after(await deleteAddress(id)) : noAccount;
    },
    setDefault: async (id: string): Promise<AddressResult> => {
      if (!isServerMode()) {
        dispatch({ type: 'address/setDefault', id });
        return { ok: true };
      }
      return account ? after(await setDefaultAddress(account.id, id)) : noAccount;
    },
  };
}
