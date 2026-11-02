import type { Address, Courier, DeliverySlot, Product, Shop } from './types';

/** Fictional but coherent Kinshasa demo data, taken from the Figma screens. */

export const shops: Record<string, Shop> = {
  'jbl-store-kin': {
    id: 'jbl-store-kin',
    name: 'JBL Store Kin',
    initials: 'JS',
    area: 'Gombe',
    verified: true,
    deliveryLead: '24–48 h',
  },
  'audio-plus-gombe': {
    id: 'audio-plus-gombe',
    name: 'Audio Plus Gombe',
    initials: 'AP',
    area: 'Gombe',
    verified: true,
    deliveryLead: '24–48 h',
  },
  'tech-lingwala': {
    id: 'tech-lingwala',
    name: 'Tech Lingwala',
    initials: 'TL',
    area: 'Lingwala',
    verified: true,
    deliveryLead: '24–48 h',
  },
};

export const products: Record<string, Product> = {
  'jbl-go-3': {
    id: 'jbl-go-3',
    shopId: 'jbl-store-kin',
    name: 'JBL Go 3 – Enceinte Bluetooth portable, étanche IP67',
    shortName: 'JBL Go 3 – Enceinte portable',
    price: 95_000,
    compareAt: 118_000,
    stock: 14,
    rating: 4.5,
    reviews: 128,
    colors: [
      { name: 'Jaune', hex: '#f2c230' },
      { name: 'Bleu', hex: '#2f7be5' },
      { name: 'Noir', hex: '#1c1c1e' },
    ],
    tint: '#3fc5b5',
    description:
      'Son JBL Pro puissant, 5 h d’autonomie, résistant à l’eau et à la poussière. Livraison à Kinshasa en 24 à 48 h.',
  },
  'jbl-charge-5': {
    id: 'jbl-charge-5',
    shopId: 'jbl-store-kin',
    name: 'JBL Charge 5 – Enceinte Bluetooth, 20 h d’autonomie',
    shortName: 'JBL Charge 5',
    price: 310_000,
    stock: 6,
    rating: 4.8,
    reviews: 64,
    colors: [
      { name: 'Bleu', hex: '#2f7be5' },
      { name: 'Noir', hex: '#1c1c1e' },
    ],
    tint: '#9aa4ad',
    description: 'Basses profondes, batterie 20 h qui recharge aussi ton téléphone. Étanche IP67.',
  },
  'jbl-tune-510': {
    id: 'jbl-tune-510',
    shopId: 'audio-plus-gombe',
    name: 'JBL Tune 510BT – Casque sans fil',
    shortName: 'JBL Tune 510BT – Casque',
    price: 125_000,
    stock: 9,
    rating: 4.6,
    reviews: 87,
    colors: [
      { name: 'Noir', hex: '#1c1c1e' },
      { name: 'Blanc', hex: '#f2f2f2' },
    ],
    tint: '#1d1d1f',
    description: 'Casque pliable, 40 h d’autonomie, charge rapide 5 min = 2 h d’écoute.',
  },
  'earbuds-pro': {
    id: 'earbuds-pro',
    shopId: 'tech-lingwala',
    name: 'Earbuds Pro – Écouteurs sans fil',
    shortName: 'Earbuds Pro – Orange',
    price: 82_000,
    stock: 0,
    rating: 4.3,
    reviews: 41,
    colors: [{ name: 'Orange', hex: '#fb7800' }],
    tint: '#e9651f',
    description: 'Réduction de bruit, boîtier de charge 24 h.',
  },
};

export const addresses: Address[] = [
  { id: 'home', label: 'Maison', line: '12, av. Kasa-Vubu, Q. Matonge, Kalamu', phone: '+243 81 234 5678' },
  { id: 'office', label: 'Bureau', line: '45, bd du 30 Juin, Gombe', phone: '+243 99 876 5432' },
];

export const deliverySlots: DeliverySlot[] = [
  { id: 'asap', label: 'Dès que possible' },
  { id: 'tomorrow-am', label: 'Demain 9h–12h' },
  { id: 'tomorrow-pm', label: 'Demain 14h–18h' },
];

export const demoCourier: Courier = { name: 'Patrick K.', initials: 'PK', vehicle: 'Moto', rating: 4.9 };

export function getProduct(id: string): Product {
  const p = products[id];
  if (!p) throw new Error(`Produit inconnu : ${id}`);
  return p;
}

export function getShop(id: string): Shop {
  const s = shops[id];
  if (!s) throw new Error(`Boutique inconnue : ${id}`);
  return s;
}
