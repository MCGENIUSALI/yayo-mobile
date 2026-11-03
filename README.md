# YA YO — app mobile

App acheteur de la marketplace YA YO en React Native + Expo (SDK 58, expo-router, TypeScript strict).
Fidèle au Figma `marketplace-YAYO` (page 07_App_Mobile_User_Stories).

## Lancer

```
npm install
npx expo start
```

Scanne le QR code avec Expo Go, ou ouvre un simulateur iOS / Android.

## Vérifier

```
npm run typecheck
npm run lint
npm test
```

## Contenu

- `src/theme` : tokens Figma (couleurs, typo Inter, espacements, rayons, motion).
- `src/ui` : primitives réutilisables (boutons, champs, cartes, statuts, timeline…).
- `src/domain` : règles métier et machines d'état mock (commande, paiement, escrow, livraison), testées.
- `src/store` : état persistant (AsyncStorage) et fournisseur de paiement simulé.
- `src/app` : écrans (expo-router).
- `assets/products` : visuels produits originaux, générés par `scripts/product-renders`.

Scénarios du paiement simulé (numéro Mobile Money se terminant par) : `0000` solde insuffisant, `1111` refusé, `9999` sans réponse ; tout autre numéro est accepté après 4 s.

Historique : ce code vient du dossier `mobile/` de [yayo-dashboard](https://github.com/MCGENIUSALI/yayo-dashboard).

## Feed découverte (P1)

- **B1 · Accueil** (`src/app/(tabs)/index.tsx`) : recherche, catégories, bannière promo, fil des boutiques (photos et vidéos), sélection du moment.
- **SC1 · Fil vidéo** (`src/app/fil.tsx`) : vidéos plein écran, lecture automatique de la vidéo visible uniquement, pause au toucher, double-tap pour aimer, onglets « Pour toi » / « Abonnements ».
- **SC2 · Achat rapide** (`src/ui/QuickBuySheet.tsx`) : couleur, quantité et ajout au panier sans quitter la vidéo.
- Médias : photos issues du Figma (`assets/feed`) et clips muets générés par `scripts/feed-videos/make.sh`.

## Recherche et boutique

- **Explorer** (`src/app/(tabs)/explorer.tsx`) : E3 catégories, E4 saisie avec recherches récentes et suggestions, B2 résultats avec puces de catégorie et tri, E2 squelette de chargement, E5 aucun résultat avec produits proches.
- **B3 · Filtres** (`src/ui/Search.tsx`) : catégorie, prix min/max (contrôle min ≤ max), note minimale, vendeurs certifiés, livraison 24 h, paiement à la livraison ; le bouton annonce le nombre de résultats avant d'appliquer.
- **B5 · Boutique** (`src/app/boutique/[id].tsx`) : identité, note, badges de confiance, Suivre, produits par famille et promos. Accessible depuis le fil, l'accueil, la fiche produit et la recherche.
- Moteur de recherche dans `src/domain/search.ts` (accents, pluriels, pertinence), testé.
