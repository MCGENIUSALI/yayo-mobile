import { EyeOff, Heart, Pin } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { initialsOf } from '@/domain/auth';
import { MAX_COMMENT, type Comment } from '@/domain/content';
import { formatAgo } from '@/domain/format';
import { useStore } from '@/store/AppStore';
import { color, radius, space } from '@/theme/tokens';
import { Button } from './Button';
import { useToast } from './Feedback';
import { TextField } from './Form';
import { Sheet } from './Sheet';
import { useRefusal } from './SocialSheets';
import { Text } from './Text';

type Moderation = 'hide' | 'show' | 'pin' | 'unpin' | 'block' | 'keep';

/** SV4 « Commentaires à modérer » and SV8 · Tous les commentaires: one comment and the seller's actions. */
export function SellerCommentCard({ comment: c, onReply }: { comment: Comment; onReply: (c: Comment) => void }) {
  const { dispatch } = useStore();
  const toast = useToast();
  const stamp = useRefusal();
  const act = (action: Moderation, done: string) => {
    dispatch({ type: 'comment/moderate', postId: c.postId, commentId: c.id, action, at: stamp() });
    toast(done, 'success');
  };
  const masked = c.status === 'masked';
  const actions: { label: string; primary?: boolean; onPress: () => void }[] = c.seller
    ? []
    : c.autoMasked
      ? [
          { label: 'Laisser masqué', primary: true, onPress: () => act('keep', 'Le commentaire reste masqué.') },
          ...(c.authorId ? [{ label: 'Bloquer', onPress: () => act('block', 'Auteur bloqué sur tes publications.') }] : []),
        ]
      : masked
        ? [{ label: 'Réafficher', primary: true, onPress: () => act('show', 'Commentaire réaffiché.') }]
        : [
            { label: 'Répondre', primary: true, onPress: () => onReply(c) },
            c.review
              ? { label: 'Masquer', onPress: () => act('hide', 'Commentaire masqué.') }
              : c.pinned
                ? { label: 'Désépingler', onPress: () => act('unpin', 'Commentaire désépinglé.') }
                : { label: 'Épingler', onPress: () => act('pin', 'Commentaire épinglé.') },
          ];

  return (
    <View style={styles.card}>
      {c.pinned ? (
        <View style={[styles.tag, { backgroundColor: color.bg.accentSubtle }]}>
          <Pin size={12} color={color.icon.accent} strokeWidth={2} />
          <Text variant="caption" color={color.text.accent}>
            Épinglé par toi
          </Text>
        </View>
      ) : null}
      {masked ? (
        <View style={[styles.tag, { backgroundColor: color.bg.warningSubtle }]}>
          <EyeOff size={12} color={color.icon.warning} strokeWidth={2} />
          <Text variant="caption" color={color.text.warning}>
            {c.autoMasked ? 'Masqué automatiquement' : 'Masqué par toi'}
          </Text>
        </View>
      ) : null}
      <View style={styles.row}>
        <View style={[styles.avatar, c.seller && { backgroundColor: color.bg.accentSubtle }]}>
          <Text variant="labelS" color={color.text.secondary}>
            {initialsOf(c.author)}
          </Text>
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <View style={styles.head}>
            <Text variant="labelM">{c.author}</Text>
            {c.seller ? (
              <View style={styles.seller}>
                <Text variant="caption" color={color.text.inverse}>
                  Vendeur
                </Text>
              </View>
            ) : null}
            <Text variant="caption" color={color.text.tertiary}>{`· ${formatAgo(c.at)}`}</Text>
          </View>
          <Text variant="bodyM">{c.text}</Text>
        </View>
        <View style={styles.likes}>
          <Heart size={16} color={color.icon.secondary} strokeWidth={2} />
          <Text variant="caption" color={color.text.secondary}>
            {c.likes}
          </Text>
        </View>
      </View>
      {actions.length ? (
        <View style={styles.actions}>
          {actions.map((a) => (
            <Button key={a.label} label={a.label} size="S" variant={a.primary ? 'secondary' : 'ghost'} onPress={a.onPress} style={{ flex: 1 }} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

/** Reply as the shop (badge « Vendeur »). */
export function ReplySheet({ target, onClose }: { target: Comment | null; onClose: () => void }) {
  const { dispatch } = useStore();
  const toast = useToast();
  const stamp = useRefusal();
  const [text, setText] = useState('');
  const send = () => {
    if (!target || !text.trim()) return;
    dispatch({ type: 'comment/add', postId: target.postId, text, replyTo: target.id, at: stamp() });
    setText('');
    onClose();
    toast('Réponse publiée.', 'success');
  };
  return (
    <Sheet visible={!!target} onClose={onClose} title={target ? `Répondre à ${target.author}` : 'Répondre'} footer={<Button label="Publier la réponse" disabled={!text.trim()} onPress={send} fill />}>
      {target ? (
        <Text variant="bodyS" color={color.text.secondary} numberOfLines={3}>
          {`« ${target.text} »`}
        </Text>
      ) : null}
      <TextField label="Ta réponse" placeholder="Oui, livraison partout à Kinshasa." value={text} multiline maxLength={MAX_COMMENT} onChangeText={setText} />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: color.bg.surface, borderRadius: radius.lg, padding: space.lg, gap: space.sm },
  tag: { flexDirection: 'row', alignItems: 'center', gap: space.xs, alignSelf: 'flex-start', borderRadius: radius.full, paddingHorizontal: space.sm, paddingVertical: 2 },
  row: { flexDirection: 'row', gap: space.md },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.sm, flexWrap: 'wrap' },
  avatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: color.bg.surfaceSunken, alignItems: 'center', justifyContent: 'center' },
  seller: { backgroundColor: color.bg.accent, borderRadius: radius.full, paddingHorizontal: space.sm, paddingVertical: 1 },
  likes: { alignItems: 'center', gap: 2 },
  actions: { flexDirection: 'row', gap: space.sm, marginTop: space.xs },
});
