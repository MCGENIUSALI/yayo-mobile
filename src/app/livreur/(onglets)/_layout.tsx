import { Tabs } from 'expo-router/tabs';
import { Bike, History, House, User, Wallet } from 'lucide-react-native';
import { color } from '@/theme/tokens';
import { BottomNavigation, type TabSpec } from '@/ui/BottomNav';

/** Courier app (Figma L4, L13, L11, L14): Accueil, Missions, Revenus, Historique, Profil. */
const TABS: TabSpec = {
  accueil: { label: 'Accueil', icon: House },
  missions: { label: 'Missions', icon: Bike },
  revenus: { label: 'Revenus', icon: Wallet },
  historique: { label: 'Historique', icon: History },
  profil: { label: 'Profil', icon: User },
};

export const unstable_settings = { initialRouteName: 'accueil' };

export default function CourierTabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <BottomNavigation {...props} tabs={TABS} />}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: color.bg.canvas }, animation: 'shift' }}
    >
      <Tabs.Screen name="accueil" />
      <Tabs.Screen name="missions" />
      <Tabs.Screen name="revenus" />
      <Tabs.Screen name="historique" />
      <Tabs.Screen name="profil" />
    </Tabs>
  );
}
