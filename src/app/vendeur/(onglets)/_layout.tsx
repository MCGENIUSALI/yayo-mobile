import { Tabs } from 'expo-router/tabs';
import { ChartColumn, Package, Store, Tag, Wallet } from 'lucide-react-native';
import { color } from '@/theme/tokens';
import { BottomNavigation, type TabSpec } from '@/ui/BottomNav';

/**
 * Seller app (Figma V4, V5, V8, V11, V12): Tableau, Commandes, Produits, Revenus, Boutique.
 * The "Contenus" tab decided for the content-management stories (US-26) will
 * replace "Boutique" once those screens are built; Boutique then opens from Tableau.
 */
const TABS: TabSpec = {
  tableau: { label: 'Tableau', icon: ChartColumn },
  commandes: { label: 'Commandes', icon: Package },
  produits: { label: 'Produits', icon: Tag },
  revenus: { label: 'Revenus', icon: Wallet },
  boutique: { label: 'Boutique', icon: Store },
};

export const unstable_settings = { initialRouteName: 'tableau' };

export default function SellerTabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <BottomNavigation {...props} tabs={TABS} />}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: color.bg.canvas }, animation: 'shift' }}
    >
      <Tabs.Screen name="tableau" />
      <Tabs.Screen name="commandes" />
      <Tabs.Screen name="produits" />
      <Tabs.Screen name="revenus" />
      <Tabs.Screen name="boutique" />
    </Tabs>
  );
}
