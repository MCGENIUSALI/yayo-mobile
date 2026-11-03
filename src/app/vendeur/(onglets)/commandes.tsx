import { Package, PackageCheck, Store, Truck } from 'lucide-react-native';
import { useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { plural } from '@/domain/format';
import { sellerTab, type SellerOrderTab } from '@/domain/seller';
import { useSeller, useSellerOrderNav } from '@/store/useSeller';
import { color, space } from '@/theme/tokens';
import { Segmented } from '@/ui/Form';
import { EmptyState, SellerOrderCard } from '@/ui/Seller';
import { LargeTitleBar } from '@/ui/TopAppBar';

const EMPTY: Record<SellerOrderTab, { title: string; body: string; icon: typeof Package }> = {
  new: { title: 'Aucune nouvelle commande', body: 'Tu es notifié dès qu’un acheteur paie : les fonds sont sécurisés par YA YO.', icon: Package },
  preparing: { title: 'Rien à préparer', body: 'Les commandes que tu commences à préparer s’affichent ici.', icon: Store },
  ready: { title: 'Aucun colis prêt', body: 'Marque une commande comme prête : un livreur est assigné pour la collecte.', icon: Truck },
  handed_over: { title: 'Aucun colis remis', body: 'Les colis remis au livreur s’affichent ici jusqu’à la livraison.', icon: PackageCheck },
};

/** V5 · Commandes (seller). */
export default function SellerOrders() {
  const { shop, orders } = useSeller();
  const nav = useSellerOrderNav();
  const [tab, setTab] = useState<SellerOrderTab>('new');
  const count = (t: SellerOrderTab) => orders.filter((o) => sellerTab(o) === t).length;
  const list = orders.filter((o) => sellerTab(o) === tab);
  const todo = count('new') + count('preparing');
  const empty = shop?.status === 'verified' ? EMPTY[tab] : { title: 'Pas encore de commandes', body: 'Les commandes arrivent quand ta boutique est vérifiée et tes produits en ligne.', icon: Package };

  return (
    <View style={styles.screen}>
      <LargeTitleBar title="Commandes" subtitle={todo ? `${plural(todo, 'commande', 'commandes')} à traiter` : 'Tout est à jour'} />
      <FlatList
        data={list}
        keyExtractor={(o) => o.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <Segmented<SellerOrderTab>
            value={tab}
            onChange={setTab}
            fit
            options={[
              { value: 'new', label: count('new') ? `Nouvelles (${count('new')})` : 'Nouvelles' },
              { value: 'preparing', label: 'À préparer' },
              { value: 'ready', label: 'Prêtes' },
              { value: 'handed_over', label: 'Remises' },
            ]}
          />
        }
        ListEmptyComponent={<EmptyState icon={empty.icon} title={empty.title} body={empty.body} />}
        renderItem={({ item, index }) => (
          <SellerOrderCard order={item} index={index} onOpen={() => nav.open(item)} onAction={() => nav.act(item)} />
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.bg.canvas },
  list: { paddingHorizontal: space.screen, paddingTop: space.sm, paddingBottom: space.lg, gap: space.lg },
});
