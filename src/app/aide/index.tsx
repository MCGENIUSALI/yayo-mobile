import { router } from 'expo-router';
import { ChevronDown, Mail, MessageCircle, Phone } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { FAQ } from '@/domain/account';
import { formatDay } from '@/domain/format';
import { confirmedOrders } from '@/domain/state';
import type { Order } from '@/domain/types';
import { useStore } from '@/store/AppStore';
import { useOpenWithAccount } from '@/store/useRequireAccount';
import { pressScale } from '@/theme/motion';
import { color, radius, space } from '@/theme/tokens';
import { useToast } from '@/ui/Feedback';
import { Content, Screen } from '@/ui/Layout';
import { PressableScale } from '@/ui/Pressable';
import { MenuGroup, MenuRow } from '@/ui/Seller';
import { Badge } from '@/ui/Status';
import { Text } from '@/ui/Text';
import { TopAppBar } from '@/ui/TopAppBar';

/** The service-client phone and e-mail are not configured yet: nothing is invented. */
const NOT_CONFIGURED = 'Ce canal sera ouvert avec le service client YA YO. En attendant, écris-nous dans la discussion.';

/** D16 · Centre d’aide: questions fréquentes, mes demandes, nous contacter. */
export default function HelpCenter() {
  const { state } = useStore();
  const toast = useToast();
  const openWithAccount = useOpenWithAccount();
  const [open, setOpen] = useState<string | null>(null);
  const requests = useMemo(() => (state.auth.session ? confirmedOrders(state).filter(isRequest) : []), [state]);

  return (
    <Screen>
      <TopAppBar title="Centre d’aide" />
      <Content gap={space.xl}>
        <View style={{ gap: space.sm }}>
          <Text variant="h4" accessibilityRole="header">
            Questions fréquentes
          </Text>
          <View style={styles.faq}>
            {FAQ.map((q, i) => {
              const expanded = open === q.id;
              return (
                <View key={q.id} style={[styles.faqItem, i > 0 && styles.faqDivider]}>
                  <PressableScale
                    accessibilityRole="button"
                    accessibilityState={{ expanded }}
                    accessibilityLabel={q.question}
                    onPress={() => setOpen(expanded ? null : q.id)}
                    haptic="selection"
                    scaleTo={pressScale.card}
                    style={styles.faqHead}
                  >
                    <Text variant="labelL" style={styles.flex}>
                      {q.question}
                    </Text>
                    <ChevronDown size={20} color={color.icon.secondary} strokeWidth={2} style={expanded ? styles.flip : undefined} />
                  </PressableScale>
                  {expanded ? (
                    <Text variant="bodyM" color={color.text.secondary}>
                      {q.answer}
                    </Text>
                  ) : null}
                </View>
              );
            })}
          </View>
        </View>

        {requests.length ? (
          <View style={{ gap: space.sm }}>
            <Text variant="h4" accessibilityRole="header">
              Mes demandes
            </Text>
            {requests.map((o) => (
              <PressableScale
                key={o.id}
                accessibilityRole="link"
                onPress={() => (o.dispute ? router.push({ pathname: '/suivi/litige/[id]', params: { id: o.id } }) : router.push({ pathname: '/suivi/[id]', params: { id: o.id } }))}
                scaleTo={pressScale.card}
                style={styles.request}
              >
                <View style={styles.flex}>
                  <Text variant="labelM">{requestTitle(o)}</Text>
                  <Text variant="bodyS" color={color.text.secondary}>
                    {`#${o.id} · ${formatDay(o.milestones.cancelledAt ?? o.milestones.disputedAt ?? o.milestones.createdAt)}`}
                  </Text>
                </View>
                <Badge {...requestBadge(o)} />
              </PressableScale>
            ))}
          </View>
        ) : null}

        <MenuGroup title="Nous contacter">
          <MenuRow
            icon={MessageCircle}
            title="Écrire au support"
            subtitle="Réponse dans l’app, en général en quelques minutes"
            onPress={() => openWithAccount('/aide/discussion', 'Connecte-toi pour écrire au support')}
          />
          <MenuRow icon={Phone} title="Appeler le service client" onPress={() => toast(NOT_CONFIGURED)} />
          <MenuRow icon={Mail} title="Écrire un e-mail" onPress={() => toast(NOT_CONFIGURED)} />
        </MenuGroup>
      </Content>
    </Screen>
  );
}

/** An order that needed (or needs) YA YO: cancelled, disputed or failed delivery. */
function isRequest(o: Order): boolean {
  return !!o.cancellation || !!o.dispute || o.payment === 'disputed' || o.delivery === 'failed';
}

function requestTitle(o: Order): string {
  if (o.cancellation) return o.cancellation.refund === 'none' ? 'Commande annulée' : 'Remboursement après annulation';
  if (o.dispute) return `Litige #${o.dispute.id}`;
  if (o.delivery === 'failed') return 'Livraison impossible';
  return 'Litige';
}

function requestBadge(o: Order): { label: string; tone: 'neutral' | 'success' | 'warning' } {
  if (o.cancellation) {
    if (o.cancellation.refund === 'sent') return { label: 'En cours', tone: 'warning' };
    return { label: 'Terminé', tone: 'success' };
  }
  if (o.dispute?.decision) return { label: 'Terminé', tone: 'success' };
  return { label: 'En cours', tone: 'warning' };
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0, gap: 2 },
  faq: { backgroundColor: color.bg.surface, borderRadius: radius.lg, paddingHorizontal: space.lg },
  faqItem: { paddingVertical: space.lg, gap: space.sm },
  faqDivider: { borderTopWidth: 1, borderTopColor: color.border.subtle },
  faqHead: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  flip: { transform: [{ rotate: '180deg' }] },
  request: { flexDirection: 'row', alignItems: 'center', gap: space.md, backgroundColor: color.bg.surface, borderRadius: radius.lg, padding: space.lg },
});
