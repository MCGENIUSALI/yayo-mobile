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
- **Sans compte (A9, A10)** : après l'introduction, on découvre l'app sans compte (accueil, fil, recherche, boutiques, fiches, centre d'aide). Ajouter au panier, ouvrir le panier, commander ou écrire au support ouvre la feuille A9 « Connecte-toi pour… » ; après la connexion, l'action reprend (le produit est ajouté, l'écran s'ouvre). Commandes, Alertes et Profil invitent à se connecter. L'action en attente est gardée en mémoire seulement : une app fermée pendant la connexion repart de zéro.
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

## Espace livreur (US-15 à US-19)

- **L1** profil et véhicule (moto, voiture, vélo, à pied ; plaque, zone de travail, numéro Mobile Money), **L2** documents KYC, **L3** validation en attente, **L4** accueil disponible avec la mission proposée, **L5** collecte avec le code du vendeur, **L6** en livraison, **L7** code de réception du client et cash, **L8** livraison confirmée, **L9** incident (client absent, refus, adresse, colis endommagé, avec photo), **L10** cash à reverser, **L11** revenus, **L12** accueil indisponible, **L13** mes missions, **L14** profil livreur. Un onglet Historique liste toutes les missions terminées.
- Règles (`src/domain/courier.ts`, testées) : rémunération de 3 000 FC + 500 FC par km (réglage « Rémunération livreur par course » de l'admin), tarif de base seulement pour une mission en échec ; le cash encaissé est reversé à YA YO le jour même, avant 20h ; permis et carte grise demandés seulement pour une moto ou une voiture.
- Une commande prête est proposée au livreur disponible et validé qui a le moins de missions en cours ; sinon à la flotte YA YO simulée. Une mission refusée n'est plus jamais proposée au même livreur ; passer indisponible rend les propositions en attente.
- Le livreur confirme la collecte avec le code de remise du vendeur (V7) et la livraison avec le code de réception de l'acheteur (D2), ce qui libère le paiement du vendeur. Un incident laisse les fonds bloqués jusqu'à la décision de YA YO.
- Le rôle livreur n'est jamais accordé par l'app : L2 envoie la demande, la validation est simulée par un bouton « démo » sur L3.
- Démo : `99 876 5432` ouvre le compte de Patrick (une mission proposée par JBL Store Kin, une mission en cours, du cash à reverser et un historique). Les codes à saisir sont rappelés en mode démo sur L5 et L7.
- Limites : la carte est un dessin en attendant le SDK de cartes, la distance est simulée, et l'appel masqué, le support et la validation par l'admin attendent le serveur.

## Mon compte, annulation et support (US-06, US-09)

- **D7 · Profil** : adresses, moyens de paiement, favoris, vendre ou livrer avec YA YO, centre d'aide, langue, déconnexion et suppression du compte. Moyens de paiement et Favoris n'ont pas encore d'écran : un message le dit.
- **D13–D15 · Adresses** : liste avec adresse par défaut, ajout et modification (nom, ville, commune, quartier et avenue, repère, téléphone sur place), suppression avec confirmation, 10 adresses au maximum. L'étape Livraison (C2) propose ces adresses, l'adresse par défaut en premier, et « Ajouter une adresse » ouvre D14. L'adresse choisie est copiée sur la commande.
- **D18–D19 · Annuler une commande** : possible depuis le suivi tant que le vendeur n'a pas remis le colis au livreur ; motif obligatoire. Une commande payée est remboursée en entier sur son moyen de paiement ; à la livraison, rien n'est débité. Le vendeur est prévenu, la commande sort de sa file et la mission du livreur est retirée. Démo : la confirmation du remboursement par l'opérateur est simulée après 6 s.
- **D16–D17 · Aide et support** : questions fréquentes, mes demandes (annulations, litiges, livraisons impossibles), discussion avec le support, éventuellement liée à une commande. Démo : la réponse du support est simulée. Le téléphone et l'e-mail du service client ne sont pas encore configurés : l'app le dit au lieu d'afficher des coordonnées inventées.
- **D9–D12 · Supprimer mon compte** : ce qui est supprimé et gardé, motif facultatif, puis code envoyé au numéro du compte (mêmes règles que A6). La suppression est refusée (D10) tant qu'une commande, un litige, un remboursement, une commande de boutique, une mission ou du cash à reverser est en cours. Supprimés : profil, adresses, panier, favoris, discussion, boutique et dossier livreur. Les commandes passées restent sans le nom de l'acheteur.
- Règles dans `src/domain/account.ts`, `src/domain/orderMachine.ts` et `src/domain/state.ts`, testées (`account.test.ts`).
