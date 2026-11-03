# YA YO — app mobile

App acheteur de la marketplace YA YO en React Native + Expo (SDK 58, expo-router, TypeScript strict).
Fidèle au Figma `marketplace-YAYO` (page 07_App_Mobile_User_Stories).

## Lancer

```
npm install
npx expo start
```

Scanne le QR code avec Expo Go, ou ouvre un simulateur iOS / Android.

## Aperçu web (Vercel)

`vercel.json` construit la version web (`npx expo export -p web`, dossier `dist`). Importer le dépôt dans Vercel suffit : chaque branche reçoit un lien d'aperçu à ouvrir dans Safari ou Chrome. La version web sert à parcourir les écrans ; l'haptique et le comportement natif se vérifient dans Expo Go.

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

## Inscription et connexion (US-01)

- **A1** écran de démarrage, **A2–A4** introduction (une seule fois), **A5** connexion ou inscription par téléphone ou e-mail, **A6** code à 6 chiffres, **E8** code incorrect, expiré ou trop d'essais, **A7** création du profil, **A8** choix du profil, **E9** compte suspendu. Déconnexion dans Profil.
- Règles (`src/domain/auth.ts`, testées) : code valable 10 min, renvoi après 45 s, 3 essais puis 15 min d'attente, 5 codes par heure, session de 7 jours d'inactivité et 30 jours au maximum, revérifiée au lancement et au retour au premier plan.
- Alignées sur l'authentification du dashboard : statuts `active` / `suspended`, rôles jamais accordés par l'app (« Vendeur » et « Livreur » sont des demandes à valider), pas de rattachement de compte par e-mail, journal sans données personnelles.
- Démo : le code s'affiche sur l'écran de vérification (aucun SMS n'est envoyé). `81 234 5678` ouvre le compte de Jean Mukendi, `85 000 0000` un compte suspendu, tout autre numéro crée un compte. Google arrivera avec le serveur.

## Espace vendeur (US-10 à US-14)

- **V1** présenter la boutique, **V2** vérification d'identité, **V3** vérification en cours ou validée, **V4** tableau de bord, **V5** commandes (Nouvelles, À préparer, Prêtes, Remises), **V6** détail et « ce que tu recevras », **V7** remise au livreur avec code, **V8** mes produits, **V9–V10** ajout d'un produit en 2 étapes, **V11** revenus et retrait Mobile Money, **V12** ma boutique, **V13** notifications, **V14** modifier un produit, **V15** supprimer un produit.
- Règles (`src/domain/seller.ts`, testées) reprises des écrans Figma : commission 10 %, participation livraison 5 %, net versé après la livraison (séquestre), 6 photos maximum, rupture automatique à 0, stock faible à 3, suppression sans annuler les commandes en cours, retrait limité au solde disponible.
- Le rôle vendeur n'est jamais accordé par l'app : V2 envoie la demande, la validation de l'équipe YA YO est simulée par un bouton « démo » sur V3. Un vendeur ne peut agir que sur les commandes de sa boutique ; le livreur confirme la collecte avec le code de remise.
- On passe d'une app à l'autre depuis Profil (« Passer en mode vendeur ») et Ma boutique (« Passer en mode acheteur »). Une commande payée par un acheteur dans l'app arrive chez le vendeur de la boutique.
- Démo : `89 765 4321` ouvre le compte de Grâce, vendeuse de JBL Store Kin (2 nouvelles commandes, historique de revenus). Le bouton « Ajouter » photo choisit une image de démo ; l'appareil photo et la galerie demandent `expo-image-picker` (compatible Expo Go), qui n'a pas pu être installé depuis l'environnement de développement.
- Limites : les modifications du catalogue vendeur ne changent pas encore les fiches vues par les acheteurs, et une nouvelle boutique n'a pas encore de page publique ; il faut le serveur pour partager le catalogue. L'onglet Contenus (US-26) remplacera Boutique quand ses écrans seront codés.
