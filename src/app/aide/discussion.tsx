import { useLocalSearchParams } from 'expo-router';
import { Send } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { FlatList, Platform, StyleSheet, TextInput, View, type TextStyle } from 'react-native';
import { MAX_SUPPORT_MESSAGE, SUPPORT_AGENT, type SupportMessage } from '@/domain/account';
import { formatTime } from '@/domain/format';
import { useStore } from '@/store/AppStore';
import { pressScale } from '@/theme/motion';
import { color, HIT, radius, space, type as typeScale } from '@/theme/tokens';
import { Avatar } from '@/ui/Commerce';
import { BottomBar, Screen } from '@/ui/Layout';
import { PressableScale } from '@/ui/Pressable';
import { Text } from '@/ui/Text';
import { TopAppBar } from '@/ui/TopAppBar';

const noWebOutline = (Platform.OS === 'web' ? { outlineStyle: 'none' } : {}) as TextStyle;

/** D17 · Discussion avec le support, optionally about one order (`order`). */
export default function SupportChat() {
  const { order: orderParam } = useLocalSearchParams<{ order?: string }>();
  const { state, dispatch } = useStore();
  const me = state.auth.session?.accountId;
  const thread = (me && state.support[me]) || [];
  const order = orderParam && state.orders[orderParam]?.buyerId === me ? state.orders[orderParam] : undefined;
  const [text, setText] = useState('');
  const list = useRef<FlatList<SupportMessage>>(null);

  useEffect(() => {
    dispatch({ type: 'support/open', at: new Date().toISOString() });
  }, [dispatch]);

  useEffect(() => {
    const t = setTimeout(() => list.current?.scrollToEnd({ animated: true }), 50);
    return () => clearTimeout(t);
  }, [thread.length]);

  const send = () => {
    const body = text.trim();
    if (!body) return;
    // The order is attached to the first message about it only.
    const attach = order && !thread.some((m) => m.orderId === order.id) ? order.id : undefined;
    dispatch({ type: 'support/send', text: body, orderId: attach, at: new Date().toISOString() });
    setText('');
  };

  return (
    <Screen>
      <TopAppBar title="Support YA YO" />
      <View style={styles.agent}>
        <Avatar initials={SUPPORT_AGENT.slice(0, 1)} />
        <View style={styles.flex}>
          <Text variant="labelM">{SUPPORT_AGENT} · support YA YO</Text>
          <Text variant="caption" color={color.text.secondary}>
            Démo : les réponses sont simulées tant que le support n’est pas branché.
          </Text>
        </View>
      </View>
      <FlatList
        ref={list}
        data={thread}
        keyExtractor={(m) => m.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          order ? (
            <View style={styles.context}>
              <Text variant="bodyS" color={color.text.secondary} align="center">
                {`À propos de la commande #${order.id}`}
              </Text>
            </View>
          ) : undefined
        }
        renderItem={({ item }) => <Bubble message={item} />}
      />
      <BottomBar direction="row">
        <View style={styles.composer}>
          <TextInput
            accessibilityLabel="Ton message"
            placeholder="Écris ton message"
            placeholderTextColor={color.text.tertiary}
            selectionColor={color.bg.accent}
            value={text}
            onChangeText={setText}
            maxLength={MAX_SUPPORT_MESSAGE}
            multiline
            style={[typeScale.bodyL, styles.input, noWebOutline]}
          />
        </View>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel="Envoyer"
          accessibilityState={{ disabled: !text.trim() }}
          disabled={!text.trim()}
          onPress={send}
          haptic="selection"
          scaleTo={pressScale.icon}
          style={[styles.send, !text.trim() && styles.sendOff]}
        >
          <Send size={20} color={text.trim() ? color.icon.inverse : color.icon.disabled} strokeWidth={2} />
        </PressableScale>
      </BottomBar>
    </Screen>
  );
}

function Bubble({ message: m }: { message: SupportMessage }) {
  const mine = m.from === 'me';
  return (
    <View style={[styles.bubbleRow, mine && styles.mineRow]}>
      <View style={[styles.bubble, mine ? styles.mine : styles.theirs]}>
        {m.orderId ? (
          <Text variant="caption" color={mine ? color.text.inverse : color.text.secondary}>
            {`Commande #${m.orderId}`}
          </Text>
        ) : null}
        <Text variant="bodyM" color={mine ? color.text.inverse : color.text.primary}>
          {m.text}
        </Text>
        <Text variant="caption" color={mine ? color.text.inverse : color.text.tertiary} style={styles.time}>
          {formatTime(m.at)}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  agent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.screen,
    paddingVertical: space.md,
    backgroundColor: color.bg.surface,
    borderBottomWidth: 1,
    borderBottomColor: color.border.subtle,
  },
  list: { padding: space.screen, gap: space.md },
  context: { paddingBottom: space.sm },
  bubbleRow: { flexDirection: 'row' },
  mineRow: { justifyContent: 'flex-end' },
  bubble: { maxWidth: '80%', borderRadius: radius.lg, paddingHorizontal: space.lg, paddingVertical: space.md, gap: 2 },
  mine: { backgroundColor: color.bg.brand, borderBottomRightRadius: radius.sm },
  theirs: { backgroundColor: color.bg.surface, borderBottomLeftRadius: radius.sm },
  time: { alignSelf: 'flex-end', opacity: 0.8 },
  composer: {
    flex: 1,
    minHeight: HIT,
    maxHeight: 120,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.border.default,
    paddingHorizontal: space.lg,
    justifyContent: 'center',
  },
  input: { color: color.text.primary, paddingVertical: space.sm },
  send: { width: HIT, height: HIT, borderRadius: radius.full, backgroundColor: color.bg.accent, alignItems: 'center', justifyContent: 'center' },
  sendOff: { backgroundColor: color.bg.surfaceSunken },
});
