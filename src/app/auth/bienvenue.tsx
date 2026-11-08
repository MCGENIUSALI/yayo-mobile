import { Image } from 'expo-image';
import { router } from 'expo-router';
import { ArrowRight, Lock, PackageCheck, ShieldCheck, Undo2, type LucideIcon } from 'lucide-react-native';
import { useRef, useState, type ComponentRef } from 'react';
import { FlatList, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStore } from '@/store/AppStore';
import { pressScale } from '@/theme/motion';
import { color, radius, space } from '@/theme/tokens';
import { Logo } from '@/ui/Auth';
import { Button } from '@/ui/Button';
import { PageIndicator } from '@/ui/Form';
import { PressableScale } from '@/ui/Pressable';
import { Text } from '@/ui/Text';
import { TrackingMap } from '@/ui/TrackingMap';

type Page = { key: string; title: string; body: string; image: number; overlay?: 'escrow' | 'map' };

const PAGES: Page[] = [
  {
    key: 'decouvrir',
    title: 'Toute la RDC dans ta poche',
    body: 'Mode, électronique, beauté : des milliers de produits de vendeurs locaux vérifiés.',
    image: require('../../../assets/onboarding/decouvrir.jpg') as number,
  },
  {
    key: 'escrow',
    title: 'Ton argent est protégé',
    body: 'Tu paies YA YO, pas le vendeur. Il n’est payé qu’une fois ton colis livré et vérifié.',
    image: require('../../../assets/onboarding/escrow.jpg') as number,
    overlay: 'escrow',
  },
  {
    key: 'livraison',
    title: 'Livré chez toi, suivi en direct',
    body: 'Un livreur YA YO récupère ta commande et te la remet contre ton code de réception.',
    image: require('../../../assets/onboarding/livraison.jpg') as number,
    overlay: 'map',
  },
];

const ESCROW_POINTS: { icon: LucideIcon; text: string }[] = [
  { icon: Lock, text: 'Ton argent est bloqué par YA YO, pas par le vendeur' },
  { icon: PackageCheck, text: 'Le vendeur est payé après la livraison confirmée' },
  { icon: Undo2, text: 'Remboursé si le colis n’arrive pas ou n’est pas conforme' },
];

/** A2–A4 · Onboarding: three pages, swipe or "Suivant", skippable. Shown once, then the feed opens as a guest. */
export default function Onboarding() {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { dispatch } = useStore();
  const [index, setIndex] = useState(0);
  const list = useRef<ComponentRef<typeof FlatList<Page>>>(null);
  const last = index === PAGES.length - 1;
  const finish = () => dispatch({ type: 'auth/onboarded' });

  return (
    <View style={[styles.screen, { paddingTop: insets.top + space.sm }]}>
      <View style={styles.top}>
        <Logo />
        {!last ? (
          <PressableScale accessibilityRole="button" accessibilityLabel="Passer l’introduction" onPress={finish} hitSlop={12} scaleTo={pressScale.icon}>
            <Text variant="labelM">Passer</Text>
          </PressableScale>
        ) : null}
      </View>

      <FlatList
        ref={list}
        data={PAGES}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(p) => p.key}
        getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
        onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
        onScroll={(e) => {
          const i = Math.round(e.nativeEvent.contentOffset.x / width);
          if (i !== index) setIndex(i);
        }}
        scrollEventThrottle={64}
        renderItem={({ item, index: i }) => <OnboardingPage page={item} width={width} index={i} />}
        style={styles.flex}
      />

      <View style={[styles.bottom, { paddingBottom: insets.bottom + space.lg }]}>
        {last ? (
          <>
            {/* A4 « Commencer »: straight to the feed as a guest (A10); the account is asked when needed (A9). */}
            <Button label="Commencer" haptic="medium" onPress={finish} fill />
            <Button
              label="J’ai déjà un compte"
              variant="ghost"
              onPress={() => {
                finish();
                // The feed replaces the onboarding first, then A5 opens over it.
                setTimeout(() => router.push('/auth/connexion'), 350);
              }}
              fill
            />
          </>
        ) : (
          <Button
            label="Suivant"
            trailingIcon={ArrowRight}
            onPress={() => {
              const next = index + 1;
              list.current?.scrollToIndex({ index: next, animated: true });
              setIndex(next);
            }}
            fill
          />
        )}
      </View>
    </View>
  );
}

function OnboardingPage({ page, width, index }: { page: Page; width: number; index: number }) {
  const visualW = width - space.screen * 2;
  return (
    <View style={[styles.page, { width }]} accessible accessibilityLabel={`${index + 1} sur ${PAGES.length}. ${page.title}. ${page.body}`}>
      <View style={[styles.visual, { height: Math.min(380, Math.round(visualW * 1.07)) }]}>
        <Image source={page.image} style={StyleSheet.absoluteFill} contentFit="cover" accessibilityIgnoresInvertColors />
        {page.overlay === 'escrow' ? (
          <View style={styles.escrow}>
            <View style={styles.escrowHead}>
              <ShieldCheck size={22} color={color.icon.success} strokeWidth={2} />
              <Text variant="labelL" color={color.text.inverse}>
                Protection YA YO Escrow
              </Text>
            </View>
            {ESCROW_POINTS.map(({ icon: Icon, text }) => (
              <View key={text} style={styles.escrowRow}>
                <Icon size={16} color={color.icon.success} strokeWidth={2} />
                <Text variant="bodyS" color="rgba(255,255,255,0.86)" style={styles.flex}>
                  {text}
                </Text>
              </View>
            ))}
          </View>
        ) : null}
        {page.overlay === 'map' ? (
          <View style={styles.map} pointerEvents="none">
            <TrackingMap status="delivering" width={visualW - space.lg * 2} />
          </View>
        ) : null}
      </View>
      <View style={styles.text}>
        <Text variant="h1" accessibilityRole="header">
          {page.title}
        </Text>
        <Text variant="bodyL" color={color.text.secondary}>
          {page.body}
        </Text>
        <View style={{ marginTop: space.md }}>
          <PageIndicator count={PAGES.length} index={index} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.bg.canvas },
  flex: { flex: 1, minWidth: 0 },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.screen, height: 48 },
  page: { paddingHorizontal: space.screen, paddingTop: space.lg, gap: space.xl },
  visual: { borderRadius: 24, overflow: 'hidden', backgroundColor: color.bg.inverse },
  escrow: {
    position: 'absolute',
    left: space.lg,
    right: space.lg,
    bottom: space.lg,
    backgroundColor: 'rgba(10,10,11,0.92)',
    borderRadius: radius.lg,
    padding: space.lg,
    gap: space.sm,
  },
  escrowHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginBottom: space.xs },
  escrowRow: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm },
  map: { position: 'absolute', left: space.lg, right: space.lg, bottom: space.lg, borderRadius: radius.lg, overflow: 'hidden', height: 150 },
  text: { gap: space.sm },
  bottom: { paddingHorizontal: space.screen, paddingTop: space.lg, gap: space.sm },
});
