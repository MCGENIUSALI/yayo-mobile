import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { BackHandler, View } from 'react-native';
import { productInfoError, productPriceError, type ProductDraft, type ProductStatus } from '@/domain/seller';
import { useSeller } from '@/store/useSeller';
import { color, space } from '@/theme/tokens';
import { Button } from '@/ui/Button';
import { useToast } from '@/ui/Feedback';
import { BottomBar, Content, Screen } from '@/ui/Layout';
import { draftOf, InfoFields, PriceFields } from '@/ui/ProductForm';
import { haptic } from '@/ui/Pressable';
import { Steps } from '@/ui/Seller';
import { TopAppBar } from '@/ui/TopAppBar';

/** V9 · Ajouter un produit (photos et infos) → V10 · Prix, stock et variantes. */
export default function NewProduct() {
  const { shop, dispatch } = useSeller();
  const toast = useToast();
  const [step, setStep] = useState<1 | 2>(1);
  const [draft, setDraft] = useState<ProductDraft>(() => draftOf());
  const [errors, setErrors] = useState(false);
  const set = (p: Partial<ProductDraft>) => setDraft((d) => ({ ...d, ...p }));

  // Android back on step 2 goes back to step 1, like the header arrow.
  useEffect(() => {
    if (step !== 2) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      setStep(1);
      return true;
    });
    return () => sub.remove();
  }, [step]);

  const next = () => {
    const err = productInfoError(draft);
    if (err) {
      setErrors(true);
      haptic('warning');
      toast(err, 'danger');
      return;
    }
    setErrors(false);
    setStep(2);
  };

  const save = (status: ProductStatus) => {
    // A draft only needs photos and a name; the price can be completed later.
    const err = status === 'draft' ? (draft.price.trim() ? productPriceError(draft) : null) : productPriceError(draft);
    if (err) {
      setErrors(true);
      haptic('warning');
      toast(err, 'danger');
      return;
    }
    dispatch({ type: 'seller/saveProduct', draft, status });
    haptic('success');
    toast(
      status === 'draft' ? 'Brouillon enregistré.' : shop?.status === 'verified' ? 'Produit publié dans ton catalogue.' : 'Produit prêt : il sera publié à la validation de ta boutique.',
      'success',
    );
    router.back();
  };

  return (
    <Screen>
      <TopAppBar title="Nouveau produit" background={color.bg.canvas} onBack={() => (step === 2 ? setStep(1) : router.back())} />
      <Content gap={space.xl} top={space.sm}>
        <Steps count={2} step={step} label={step === 1 ? 'Photos et description' : 'Prix, stock et variantes'} />
        {step === 1 ? <InfoFields draft={draft} set={set} errors={errors} /> : <PriceFields draft={draft} set={set} errors={errors} />}
      </Content>
      <BottomBar direction={step === 2 ? 'row' : 'column'}>
        {step === 1 ? (
          <Button label="Continuer" haptic="medium" onPress={next} fill />
        ) : (
          <>
            <View style={{ flex: 1 }}>
              <Button label="Brouillon" variant="outline" onPress={() => save('draft')} fill />
            </View>
            <View style={{ flex: 1.4 }}>
              <Button label="Publier le produit" haptic="success" onPress={() => save('online')} fill />
            </View>
          </>
        )}
      </BottomBar>
    </Screen>
  );
}
