import { ArrowDownLeft, ArrowUpRight, ChartColumn, ShieldCheck, Wallet } from 'lucide-react-native';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatDay } from '@/domain/format';
import { formatFC, formatUSD } from '@/domain/money';
import { detectOperator } from '@/domain/paymentProvider';
import { maskPhone, parseAmount, revenue, trend } from '@/domain/seller';
import { useSeller } from '@/store/useSeller';
import { color, radius, space } from '@/theme/tokens';
import { Button } from '@/ui/Button';
import { SummaryRow } from '@/ui/Commerce';
import { Alert, useToast } from '@/ui/Feedback';
import { TextField } from '@/ui/Form';
import { Divider } from '@/ui/Layout';
import { groupDigits } from '@/ui/ProductForm';
import { haptic } from '@/ui/Pressable';
import { StatTile, TrendPill } from '@/ui/Seller';
import { Sheet } from '@/ui/Sheet';
import { Text } from '@/ui/Text';

const MONTHS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

/** V11 · Revenus: net = commande − commission − livraison, withdrawal to Mobile Money. */
export default function SellerRevenue() {
  const { shop, orders, dispatch, state } = useSeller();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const now = new Date();
  const r = revenue(orders, shop?.withdrawals ?? [], now.toISOString());
  const operator = shop?.kyc ? detectOperator(shop.kyc.payoutPhone.slice(4)) : null;
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const monthTrend = trend(r.monthSales, r.previousMonthSales);
  const verified = shop?.status === 'verified';
  const value = parseAmount(amount);
  const amountError = amount && (!(value > 0) || value > r.available) ? 'Le montant dépasse ton solde disponible.' : undefined;

  const withdraw = () => {
    if (!(value > 0) || value > r.available) {
      haptic('warning');
      return;
    }
    dispatch({ type: 'seller/withdraw', amount: value });
    haptic('success');
    setOpen(false);
    toast(`${formatFC(value)} envoyés vers ${operator ?? 'Mobile Money'}.`, 'success');
  };

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + space.lg }]}>
        <Text variant="bodyM" color={color.text.secondary}>
          {MONTHS[now.getMonth()]} {now.getFullYear()}
        </Text>
        <Text variant="h1" accessibilityRole="header">
          Revenus
        </Text>
      </View>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.balance}>
          <Text variant="labelM" color={color.text.inverse}>
            Solde disponible
          </Text>
          <Text variant="display" color={color.text.inverse} numberOfLines={1} adjustsFontSizeToFit>
            {formatFC(r.available)}
          </Text>
          <Text variant="bodyS" color={color.text.inverse} style={{ opacity: 0.8 }}>
            {formatUSD(r.available)}
            {shop?.kyc ? ` · virement vers ${operator ?? 'Mobile Money'} ${maskPhone(shop.kyc.payoutPhone)}` : ''}
          </Text>
          <Button
            label={`Retirer vers ${operator ?? 'Mobile Money'}`}
            variant="accent"
            size="M"
            leadingIcon={Wallet}
            disabled={!verified || r.available <= 0}
            onPress={() => {
              setAmount(groupDigits(String(r.available)));
              setOpen(true);
            }}
            style={{ alignSelf: 'flex-start', marginTop: space.sm }}
          />
          {!verified ? (
            <Text variant="bodyS" color={color.text.inverse} style={{ opacity: 0.8 }}>
              Les retraits s’ouvrent après la vérification de ta boutique.
            </Text>
          ) : null}
        </View>

        <View style={styles.row}>
          <StatTile icon={ShieldCheck} label="Bloqués (séquestre)" value={formatFC(r.blocked)} />
          <StatTile
            icon={ChartColumn}
            label="Ce mois"
            value={formatFC(r.monthSales)}
            footer={monthTrend !== null ? <TrendPill tone={monthTrend >= 0 ? 'up' : 'down'} value={`${monthTrend >= 0 ? '+' : '−'}${Math.abs(monthTrend)} %`} suffix="vs mois dernier" /> : null}
          />
        </View>

        <View style={styles.card}>
          <Text variant="caption" color={color.text.secondary} style={{ letterSpacing: 0.6 }}>
            CALCUL DU NET · CE MOIS
          </Text>
          <SummaryRow label="Ventes encaissées" value={formatFC(r.month.items)} />
          <SummaryRow label="Commission YA YO (10 %)" value={formatFC(-r.month.commission)} type="discount" />
          <SummaryRow label="Frais de livraison" value={formatFC(-r.month.delivery)} type="discount" />
          <Divider />
          <SummaryRow label="Net vendeur" value={formatFC(r.month.net)} type="total" />
        </View>

        <Text variant="h4" accessibilityRole="header">
          Derniers mouvements
        </Text>
        <View style={styles.card}>
          {r.movements.length === 0 ? (
            <Text variant="bodyM" color={color.text.secondary}>
              Aucun mouvement pour l’instant. Un paiement est libéré quand l’acheteur confirme la livraison.
            </Text>
          ) : (
            r.movements.slice(0, 8).map((m, i) => (
              <View key={m.id}>
                {i > 0 ? <Divider /> : null}
                <View style={styles.move}>
                  <View style={[styles.moveIcon, { backgroundColor: m.amount > 0 ? color.bg.successSubtle : color.bg.surfaceSunken }]}>
                    {m.amount > 0 ? <ArrowDownLeft size={18} color={color.icon.success} strokeWidth={2} /> : <ArrowUpRight size={18} color={color.icon.primary} strokeWidth={2} />}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text variant="labelM">{m.label}</Text>
                    <Text variant="bodyS" color={color.text.secondary}>
                      {m.detail.startsWith('+243') ? maskPhone(m.detail) : m.detail} · {formatDay(m.at)}
                    </Text>
                  </View>
                  <Text variant="labelM" color={m.amount > 0 ? color.text.success : color.text.primary}>
                    {m.amount > 0 ? '+ ' : ''}
                    {formatFC(m.amount)}
                  </Text>
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      <Sheet
        visible={open}
        onClose={() => setOpen(false)}
        title={`Retirer vers ${operator ?? 'Mobile Money'}`}
        footer={<Button label="Confirmer le retrait" haptic="medium" disabled={!!amountError || !(value > 0)} onPress={withdraw} fill />}
      >
        <TextField label="Montant (FC)" value={amount} onChangeText={(v) => setAmount(groupDigits(v))} keyboardType="number-pad" inputMode="numeric" error={amountError} />
        <Text variant="bodyS" color={color.text.secondary}>
          Disponible : {formatFC(r.available)} · vers {shop?.kyc ? maskPhone(shop.kyc.payoutPhone) : '—'}
        </Text>
        {state.lastError?.code === 'INSUFFICIENT_BALANCE' ? <Alert tone="danger" title="Retrait impossible" body={state.lastError.message} /> : null}
        <Alert tone="info" title="Démo" body="Aucun argent n’est envoyé : le virement Mobile Money sera branché avec le serveur YA YO." />
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.bg.canvas },
  header: { backgroundColor: color.bg.surface, paddingHorizontal: space.screen, paddingBottom: space.md, gap: space.xs },
  content: { padding: space.screen, paddingTop: space.sm, gap: space.lg },
  balance: { backgroundColor: color.bg.inverse, borderRadius: radius.lg, padding: space.xl, gap: space.xs },
  row: { flexDirection: 'row', gap: space.md },
  card: { backgroundColor: color.bg.surface, borderRadius: radius.lg, padding: space.lg, gap: space.sm },
  move: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm },
  moveIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
});
