import { router } from "expo-router";
import { ShoppingCart } from "lucide-react-native";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { getProduct } from "@/domain/catalog";
import { formatFC, formatUSD } from "@/domain/money";
import { addToCartError } from "@/domain/state";
import { useStore } from "@/store/AppStore";
import { pressScale } from "@/theme/motion";
import { color, radius, space } from "@/theme/tokens";
import { Button } from "./Button";
import { EscrowBanner, ProductImage, QuantityStepper } from "./Commerce";
import { Alert, useToast } from "./Feedback";
import { haptic, PressableScale } from "./Pressable";
import { Sheet } from "./Sheet";
import { Text } from "./Text";

/**
 * SC2 · Achat rapide depuis une vidéo: pick colour and quantity in a sheet,
 * without leaving the feed. "Ajouter au panier" closes the sheet and the
 * video keeps playing; "Commander" adds and opens the cart.
 */
export function QuickBuySheet({
  productId,
  onClose,
}: {
  productId: string | null;
  onClose: () => void;
}) {
  return (
    <Sheet visible={!!productId} onClose={onClose} title="Ajouter au panier">
      {productId ? (
        <SheetBody key={productId} productId={productId} onClose={onClose} />
      ) : null}
    </Sheet>
  );
}

function SheetBody({
  productId,
  onClose,
}: {
  productId: string;
  onClose: () => void;
}) {
  const product = getProduct(productId);
  const { state, dispatch } = useStore();
  const toast = useToast();
  const [colorName, setColorName] = useState(product.colors[0]?.name ?? "");
  const [qty, setQty] = useState(1);
  const out = product.stock <= 0;

  const add = (then: "stay" | "cart") => {
    const error = addToCartError(state, product.id, colorName, qty);
    if (error) {
      haptic("warning");
      toast(error, "danger");
      return;
    }
    dispatch({
      type: "cart/add",
      productId: product.id,
      color: colorName,
      qty,
    });
    haptic("success");
    onClose();
    if (then === "cart") router.push("/panier");
    else toast("Ajouté au panier", "success");
  };

  return (
    <>
      <View style={styles.product}>
        <ProductImage product={product} size={56} rounded={radius.sm} />
        <View style={styles.flex}>
          <Text variant="labelM" numberOfLines={1}>
            {product.name}
          </Text>
          <View style={styles.row}>
            <Text variant="priceS">{formatFC(product.price)}</Text>
            <Text variant="caption" color={color.text.tertiary}>
              {formatUSD(product.price)}
            </Text>
          </View>
        </View>
        <Button
          label="Voir"
          variant="accent"
          size="S"
          leadingIcon={ShoppingCart}
          onPress={() => {
            onClose();
            router.push({
              pathname: "/produit/[id]",
              params: { id: product.id },
            });
          }}
        />
      </View>

      {out ? (
        <Alert
          tone="danger"
          title="En rupture de stock"
          body="Ce produit n’est plus disponible pour le moment."
        />
      ) : (
        <View style={styles.options}>
          <View style={{ gap: space.sm }}>
            <Text variant="labelM">Couleur : {colorName}</Text>
            <View style={styles.swatches} accessibilityRole="radiogroup">
              {product.colors.map((c) => {
                const selected = c.name === colorName;
                return (
                  <PressableScale
                    key={c.name}
                    accessibilityRole="radio"
                    accessibilityLabel={c.name}
                    accessibilityState={{ selected, checked: selected }}
                    onPress={() => setColorName(c.name)}
                    haptic="selection"
                    scaleTo={pressScale.icon}
                    style={[
                      styles.swatchRing,
                      {
                        borderColor: selected
                          ? color.border.focus
                          : "transparent",
                      },
                    ]}
                  >
                    <View style={[styles.swatch, { backgroundColor: c.hex }]} />
                  </PressableScale>
                );
              })}
            </View>
          </View>
          <View style={{ gap: space.sm, alignItems: "flex-end" }}>
            <Text variant="labelM">Quantité</Text>
            <QuantityStepper
              value={qty}
              max={product.stock}
              onChange={setQty}
              size="M"
              label={product.shortName}
            />
          </View>
        </View>
      )}

      <EscrowBanner />

      <View style={styles.actions}>
        <Button
          label="Ajouter au panier"
          variant="outline"
          disabled={out}
          onPress={() => add("stay")}
          style={styles.flex}
        />
        <Button
          label="Commander"
          disabled={out}
          haptic="medium"
          onPress={() => add("cart")}
          style={styles.flex}
        />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  row: { flexDirection: "row", alignItems: "baseline", gap: space.xs },
  product: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    padding: space.sm,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: color.border.subtle,
  },
  options: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  swatches: { flexDirection: "row", gap: space.sm },
  swatchRing: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  swatch: { width: 30, height: 30, borderRadius: 15 },
  actions: { flexDirection: "row", gap: space.md },
});
