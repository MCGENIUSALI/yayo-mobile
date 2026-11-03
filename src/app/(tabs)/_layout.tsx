import { Tabs } from 'expo-router/tabs';
import { Bell, House, Package, Search, User } from 'lucide-react-native';
import { color } from '@/theme/tokens';
import { BottomNavigation, type TabSpec } from '@/ui/BottomNav';

/** Buyer: Accueil, Explorer, Commandes, Alertes, Profil. */
const TABS: TabSpec = {
  index: { label: 'Accueil', icon: House },
  explorer: { label: 'Explorer', icon: Search },
  commandes: { label: 'Commandes', icon: Package },
  alertes: { label: 'Alertes', icon: Bell },
  profil: { label: 'Profil', icon: User },
};

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <BottomNavigation {...props} tabs={TABS} />}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: color.bg.canvas }, animation: 'shift' }}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="explorer" />
      <Tabs.Screen name="commandes" />
      <Tabs.Screen name="alertes" />
      <Tabs.Screen name="profil" />
    </Tabs>
  );
}
