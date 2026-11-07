import { ShoppingCart } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import { useStore } from '@/store/AppStore';
import { useOpenWithAccount } from '@/store/useRequireAccount';
import { pressScale } from '@/theme/motion';
import { color, HIT, radius } from '@/theme/tokens';
import { PressableScale } from './Pressable';
import { Text } from './Text';

/** Icon Button with badge (panier). */
export function CartButton() {
  const { state } = useStore();
  const open = useOpenWithAccount();
  const count = state.cart.reduce((n, l) => n + l.qty, 0);
  return (
    <PressableScale
      accessibilityLabel={`Panier, ${count} article${count > 1 ? 's' : ''}`}
      onPress={() => open('/panier', 'Connecte-toi pour voir ton panier')}
      scaleTo={pressScale.icon}
      haptic="selection"
      style={styles.iconBtn}
    >
      <ShoppingCart size={24} color={color.icon.primary} strokeWidth={2} />
      {count > 0 ? (
        <View style={styles.count}>
          <Text variant="caption" color={color.text.inverse}>
            {count}
          </Text>
        </View>
      ) : null}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  iconBtn: { width: HIT, height: HIT, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  count: {
    position: 'absolute',
    top: 4,
    right: 2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: color.bg.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
