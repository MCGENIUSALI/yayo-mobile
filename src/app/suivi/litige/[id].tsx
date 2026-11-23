import { router, useLocalSearchParams } from 'expo-router';
import { Clock, Info, ShieldAlert } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { getShop } from '@/domain/catalog';
import { formatDayTime } from '@/domain/format';
import { formatFC } from '@/domain/money';
import { DISPUTE_REASONS } from '@/domain/account';
import { canDispute, MAX_DISPUTE_PHOTOS } from '@/domain/orderMachine';
import type { DisputeReason, Order } from '@/domain/types';
import { useStore } from '@/store/AppStore';
import { color, radius, space } from '@/theme/tokens';
import { Button } from '@/ui/Button';
import { SummaryRow } from '@/ui/Commerce';
import { Alert, TimelineStep, useToast } from '@/ui/Feedback';
import { Radio, TextField } from '@/ui/Form';
import { BottomBar, Card, Content, Screen } from '@/ui/Layout';
import { PressableScale } from '@/ui/Pressable';
import { AddPhotoTile, PhotoTile } from '@/ui/Seller';
import { Sheet } from '@/ui/Sheet';
import { Badge } from '@/ui/Status';
import { Text } from '@/ui/Text';
import { TopAppBar } from '@/ui/TopAppBar';


/** D4 · Signaler un problème, then D5 · Litige en cours. */
export default function DisputeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { state } = useStore();
  const order = id ? state.orders[id] : undefined;
  if (order?.dispute) return <DisputeStatus order={order} />;
  if (!order || !canDispute(order)) {
    return (
      <Screen>
        <TopAppBar title="Signaler un problème" />
        <Content>
          <Alert
            tone="warning"
            title="Signalement impossible ici"
            body="Un problème se signale pendant la livraison, avant de donner ton code de réception. Pour une autre question, écris au support depuis le Centre d’aide."
          />
          <Button label="Centre d’aide" variant="outline" onPress={() => router.push('/aide')} fill />
        </Content>
      </Screen>
    );
  }
  return <ReportForm order={order} />;
}

function ReportForm({ order }: { order: Order }) {
  const { state, dispatch } = useStore();
  const toast = useToast();
  const [reason, setReason] = useState<DisputeReason | null>(null);
  const [description, setDescription] = useState('');
  const [photos, setPhotos] = useState<(number | string)[]>([]);
  const [error, setError] = useState<string | null>(null);
  const shop = getShop(order.shopId);
  const needsPhoto = reason !== null && reason !== 'not_received';

  const send = () => {
    if (!reason) return;
    if (description.trim().length < 10) return setError('Décris le problème en quelques mots.');
    if (needsPhoto && photos.length === 0) return setError('Ajoute au moins une photo du produit reçu.');
    const at = new Date().toISOString();
    dispatch({ type: 'order/dispute', orderId: order.id, reason, description, photos, at });
    toast('Signalement envoyé. Les fonds restent bloqués.', 'success');
  };

  return (
    <Screen>
      <TopAppBar title="Signaler un problème" />
      <Content gap={space.xl}>
        <Text variant="labelM" color={color.text.secondary}>
          {`Commande #${order.id} · ${shop.name}`}
        </Text>
        <View style={{ gap: space.md }}>
          <Text variant="h4" accessibilityRole="header">
            Quel est le problème ?
          </Text>
          <View style={{ gap: space.sm }} accessibilityRole="radiogroup">
            {DISPUTE_REASONS.map((r) => (
              <PressableScale
                key={r.id}
                accessibilityRole="radio"
                accessibilityState={{ checked: reason === r.id }}
                accessibilityLabel={r.label}
                onPress={() => {
                  setReason(r.id);
                  setError(null);
                }}
                haptic="selection"
                style={[styles.option, reason === r.id && styles.optionOn]}
              >
                <Radio checked={reason === r.id} />
                <Text variant="labelL">{r.label}</Text>
              </PressableScale>
            ))}
          </View>
        </View>
        <TextField
          label="Décris le problème"
          placeholder="Reçu en bleu, j’avais commandé la jaune."
          value={description}
          multiline
          maxLength={500}
          onChangeText={(t) => {
            setDescription(t);
            setError(null);
          }}
        />
        <View style={{ gap: space.sm }}>
          <Text variant="labelM">{needsPhoto ? 'Photos du produit reçu' : 'Photos (facultatif)'}</Text>
          <View style={styles.photos}>
            {photos.map((p, i) => (
              <PhotoTile key={i} photo={p} size={80} label={`Photo ${i + 1}`} onRemove={() => setPhotos(photos.filter((_, j) => j !== i))} />
            ))}
            {photos.length < MAX_DISPUTE_PHOTOS ? <AddPhotoTile size={80} title="Photo du produit reçu" onPick={(p) => setPhotos([...photos, p])} /> : null}
          </View>
        </View>
        {error ? <Alert tone="danger" title="Il manque une information" body={error} /> : null}
        <Alert tone="escrow" title="Les fonds restent bloqués" body="Le vendeur n’est pas payé tant que YA YO n’a pas tranché le litige (sous 72 h)." />
      </Content>
      <BottomBar>
        <Button label="Envoyer le signalement" variant="destructive" haptic="warning" disabled={!reason || state.auth.session === undefined} onPress={send} fill />
      </BottomBar>
    </Screen>
  );
}

/** D5 · Litige en cours (and its decision). */
function DisputeStatus({ order }: { order: Order }) {
  const { dispatch } = useStore();
  const toast = useToast();
  const [adding, setAdding] = useState(false);
  const [note, setNote] = useState('');
  const d = order.dispute!;
  const decided = d.decision;
  const reason = DISPUTE_REASONS.find((r) => r.id === d.reason)?.short ?? 'Autre problème';
  const steps = [
    { key: 'sent', title: 'Signalement envoyé', description: formatDayTime(d.openedAt), state: 'done' as const, icon: ShieldAlert },
    { key: 'review', title: 'Examen par l’équipe YA YO', description: 'Nous contactons le vendeur et le livreur', state: decided ? ('done' as const) : ('current' as const), icon: Info },
    {
      key: 'decision',
      title: decided ? (decided.outcome === 'refund' ? 'Tu es remboursé' : 'Le vendeur est payé') : 'Décision',
      description: decided ? formatDayTime(decided.at) : 'Remboursement, échange ou paiement du vendeur',
      state: decided ? ('done' as const) : ('upcoming' as const),
      icon: Clock,
    },
  ];

  const addNote = () => {
    if (!note.trim()) return;
    dispatch({ type: 'order/disputeNote', orderId: order.id, text: note, at: new Date().toISOString() });
    setNote('');
    setAdding(false);
    toast('Information ajoutée au litige.', 'success');
  };

  return (
    <Screen>
      <TopAppBar title={`Litige #${d.id}`} />
      <Content>
        <View style={styles.head}>
          <Text variant="labelL">{`Commande #${order.id}`}</Text>
          {decided ? <Badge label="Litige clos" tone="neutral" /> : <Badge label="Litige · fonds bloqués" icon={ShieldAlert} tone="danger" />}
        </View>
        {decided ? (
          <Alert
            tone="info"
            title={decided.outcome === 'refund' ? `${formatFC(order.total)} remboursés` : 'YA YO a payé le vendeur'}
            body={
              decided.outcome === 'refund'
                ? 'Le montant revient sur ton moyen de paiement.'
                : 'Après examen, la commande est considérée comme livrée. Écris au support si tu n’es pas d’accord.'
            }
          />
        ) : (
          <Alert tone="escrow" title={`${formatFC(order.total)} bloqués par YA YO`} body="Ni le vendeur ni le livreur ne sont payés pendant l’examen. Décision sous 72 h." />
        )}
        <Card gap={space.sm}>
          <SummaryRow label="Motif" value={reason} />
          <SummaryRow label="Ouvert le" value={formatDayTime(d.openedAt)} />
          <SummaryRow label="Pièces jointes" value={d.photos.length ? `${d.photos.length} photo${d.photos.length > 1 ? 's' : ''}` : 'Aucune'} />
        </Card>
        <Text variant="h4" accessibilityRole="header">
          Avancement
        </Text>
        <View accessibilityRole="list">
          {steps.map((s, i) => (
            <TimelineStep key={s.key} title={s.title} description={s.description} state={s.state} icon={s.icon} last={i === steps.length - 1} />
          ))}
        </View>
        {d.notes.length ? (
          <Card gap={space.sm}>
            <Text variant="labelL">Tes informations</Text>
            {d.notes.map((n, i) => (
              <View key={i} style={{ gap: 2 }}>
                <Text variant="bodyM">{n.text}</Text>
                <Text variant="caption" color={color.text.tertiary}>
                  {formatDayTime(n.at)}
                </Text>
              </View>
            ))}
          </Card>
        ) : null}
        {!decided ? (
          <View style={styles.demo}>
            <Text variant="caption" color={color.text.secondary}>
              MODE DÉMO · SIMULER LA DÉCISION DE YA YO
            </Text>
            <Button label="Rembourser l’acheteur" size="M" variant="outline" onPress={() => dispatch({ type: 'order/disputeDecide', orderId: order.id, outcome: 'refund', at: new Date().toISOString() })} fill />
            <Button label="Payer le vendeur" size="M" variant="outline" onPress={() => dispatch({ type: 'order/disputeDecide', orderId: order.id, outcome: 'pay_seller', at: new Date().toISOString() })} fill />
          </View>
        ) : null}
      </Content>
      <BottomBar>
        {decided ? (
          <Button label="Contacter le support" variant="outline" onPress={() => router.push({ pathname: '/aide/discussion', params: { order: order.id } })} fill />
        ) : (
          <Button label="Ajouter une information" variant="outline" onPress={() => setAdding(true)} fill />
        )}
      </BottomBar>
      <Sheet
        visible={adding}
        onClose={() => setAdding(false)}
        title="Ajouter une information"
        footer={<Button label="Envoyer" disabled={!note.trim()} onPress={addNote} fill />}
      >
        <TextField label="Ton information" placeholder="Le livreur est reparti avec le colis." value={note} multiline maxLength={500} onChangeText={setNote} />
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: color.bg.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.border.subtle,
    paddingHorizontal: space.lg,
    minHeight: 52,
  },
  optionOn: { borderWidth: 2, borderColor: color.border.focus, paddingHorizontal: space.lg - 1 },
  photos: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm, flexWrap: 'wrap' },
  demo: { borderRadius: radius.md, borderWidth: 1, borderStyle: 'dashed', borderColor: color.border.strong, padding: space.md, gap: space.sm },
});
