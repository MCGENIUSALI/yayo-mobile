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
- **B3 · Filtres** (`src/ui/Search.tsx`) : catégorie, prix min/max (contrôle min ≤ max), note minimale, vendeurs certifiés, livraison 24 h ; le bouton annonce le nombre de résultats avant d'appliquer.
- **B5 · Boutique** (`src/app/boutique/[id].tsx`) : identité, note, badges de confiance, Suivre, produits par famille et promos. Accessible depuis le fil, l'accueil, la fiche produit et la recherche.
- Moteur de recherche dans `src/domain/search.ts` (accents, pluriels, pertinence), testé.

## Inscription et connexion (US-01)

- **A1** écran de démarrage, **A2–A4** introduction (une seule fois, puis directement le fil), **A5** connexion ou inscription par téléphone ou e-mail, **A6** code à 6 chiffres, **E8** code incorrect, expiré ou trop d'essais, **A7** création du profil, **A8** choix du profil, **E9** compte suspendu. Déconnexion dans Profil.
- Règles (`src/domain/auth.ts`, testées) : code valable 10 min, renvoi après 45 s, 3 essais puis 15 min d'attente, 5 codes par heure, session de 7 jours d'inactivité et 30 jours au maximum, revérifiée au lancement et au retour au premier plan.
- Alignées sur l'authentification du dashboard : statuts `active` / `suspended`, rôles jamais accordés par l'app (« Vendeur » et « Livreur » sont des demandes à valider), pas de rattachement de compte par e-mail, journal sans données personnelles.
- Démo : le code s'affiche sur l'écran de vérification (aucun SMS n'est envoyé). `81 234 5678` ouvre le compte de Jean Mukendi, `85 000 0000` un compte suspendu, tout autre numéro crée un compte. Google arrivera avec le serveur.

## Espace vendeur (US-10 à US-14)

- **V1** présenter la boutique, **V2** vérification d'identité, **V3** vérification en cours ou validée, **V4** tableau de bord, **V5** commandes (Nouvelles, À préparer, Prêtes, Remises), **V6** détail et « ce que tu recevras », **V7** remise au livreur avec code, **V8** mes produits, **V9–V10** ajout d'un produit en 2 étapes, **V11** revenus et retrait Mobile Money, **V12** ma boutique, **V13** notifications, **V14** modifier un produit, **V15** supprimer un produit.
- Règles (`src/domain/seller.ts`, testées) reprises des écrans Figma : commission 10 %, participation livraison 5 %, net versé après la livraison (séquestre), 6 photos maximum, rupture automatique à 0, stock faible à 3, suppression sans annuler les commandes en cours, retrait limité au solde disponible.
- Le rôle vendeur n'est jamais accordé par l'app : V2 envoie la demande, la validation de l'équipe YA YO est simulée par un bouton « démo » sur V3. Un vendeur ne peut agir que sur les commandes de sa boutique ; le livreur confirme la collecte avec le code de remise.
- On passe d'une app à l'autre depuis Profil (« Passer en mode vendeur ») et Ma boutique (« Passer en mode acheteur »). Une commande payée par un acheteur dans l'app arrive chez le vendeur de la boutique.
- Démo : `89 765 4321` ouvre le compte de Grâce, vendeuse de JBL Store Kin (2 nouvelles commandes, historique de revenus). Les photos viennent de l'appareil photo ou de la galerie du téléphone (voir « Photos »).
- Limites : les modifications du catalogue vendeur ne changent pas encore les fiches vues par les acheteurs, et une nouvelle boutique n'a pas encore de page publique ; il faut le serveur pour partager le catalogue. L'onglet Contenus (US-26) remplacera Boutique quand ses écrans seront codés.

## Espace livreur (US-15 à US-19)

- **L1** profil et véhicule (moto, voiture, vélo, à pied ; plaque, zone de travail, numéro Mobile Money), **L2** documents KYC, **L3** validation en attente, **L4** accueil disponible avec la mission proposée, **L5** collecte avec le code du vendeur, **L6** en livraison, **L7** code de réception du client et cash, **L8** livraison confirmée, **L9** incident (client absent, refus, adresse, colis endommagé, avec photo), **L10** cash à reverser, **L11** revenus, **L12** accueil indisponible, **L13** mes missions, **L14** profil livreur. Un onglet Historique liste toutes les missions terminées.
- Règles (`src/domain/courier.ts`, testées) : rémunération de 3 000 FC + 500 FC par km (réglage « Rémunération livreur par course » de l'admin), tarif de base seulement pour une mission en échec ; le cash encaissé sur les anciennes commandes payées à la livraison est reversé à YA YO le jour même, avant 20h ; permis et carte grise demandés seulement pour une moto ou une voiture.
- Une commande prête est proposée au livreur disponible et validé qui a le moins de missions en cours ; sinon à la flotte YA YO simulée. Une mission refusée n'est plus jamais proposée au même livreur ; passer indisponible rend les propositions en attente.
- Le livreur confirme la collecte avec le code de remise du vendeur (V7) et la livraison avec le code de réception de l'acheteur (D2), ce qui libère le paiement du vendeur. Un incident laisse les fonds bloqués jusqu'à la décision de YA YO.
- Le rôle livreur n'est jamais accordé par l'app : L2 envoie la demande, la validation est simulée par un bouton « démo » sur L3.
- Démo : `99 876 5432` ouvre le compte de Patrick (une mission proposée par JBL Store Kin, une mission en cours, du cash à reverser et un historique). Les codes à saisir sont rappelés en mode démo sur L5 et L7.
- Limites : la carte est un dessin en attendant le SDK de cartes, la distance est simulée, et l'appel masqué, le support et la validation par l'admin attendent le serveur.

## Corrections UX et Android (7 novembre)

- **Champs de saisie** (`src/ui/Form.tsx`, `src/ui/keyboard.ts`, `src/ui/Layout.tsx`) : sur Android, fermer le clavier avec Retour laissait le champ actif, et le toucher de nouveau ne rouvrait pas le clavier. Le champ est maintenant désactivé quand le clavier se ferme. Depuis le SDK 54, Android s'affiche bord à bord et la fenêtre ne se redimensionne plus pour le clavier : les écrans et les sheets se décalent eux-mêmes, donc les champs et les boutons du bas restent visibles. Toute la case du champ ouvre le clavier, le texte est centré sans marge de police, l'autofocus attend la fin de la transition, et les claviers téléphone, e-mail et chiffres sont adaptés.
- **Bottom sheets** (`src/ui/Sheet.tsx`) : un seul glissement de 220 ms à l'ouverture et 180 ms à la fermeture, sans rebond, avec le fond qui s'assombrit en même temps. On ferme en glissant la poignée ou le titre vers le bas, en touchant le fond ou avec Retour. Les formulaires (nouvelle adresse, aperçu photo) ne se ferment pas par erreur.
- **Paiement à la livraison retiré** : l'acheteur paie par Mobile Money ou par carte. La logique de commande (`src/domain/state.ts`) refuse aussi le cash (`METHOD_NOT_ALLOWED`) si l'écran est contourné ; le serveur devra faire la même vérification. Les commandes cash déjà passées gardent leur historique, et le livreur reverse encore le cash déjà encaissé.
- **Lancement** : écran de démarrage natif (même logo, même fond que A1, `assets/splash-logo.png`), puis l'introduction au premier lancement seulement, puis le fil. L'introduction et la session sont deux états séparés. Sans compte, on parcourt le catalogue, les fiches, les boutiques, le fil et le panier. « Commander », Commandes, Alertes et Profil demandent de se connecter, puis reprennent là où on allait.
- **Pays, province, ville, commune** (`src/domain/geo`, `src/ui/Location.tsx`) : champs dépendants avec recherche, réutilisés pour l'inscription (A7), les adresses de livraison (C2 « Ajouter une adresse »), la boutique (V1) et la zone du livreur (L1). Changer un niveau vide les niveaux en dessous.
  - Source : Référentiel Géographique Commun de l'OCHA RDC (26 provinces, 189 villes et territoires), publié par geoBoundaries sous licence CC BY 3.0 IGO. `node scripts/geo/build-cd.mjs` régénère le fichier.
  - Communes : le RGC ne descend pas sous la ville. Les communes de Kinshasa (24), Lubumbashi, Goma, Bukavu, Kisangani et Matadi sont dans `scripts/geo/communes-cd.json`, avec leur source, à faire valider par l'équipe. Ailleurs, l'app demande le quartier.
  - Les données sont dans l'app et marchent hors connexion. Si `EXPO_PUBLIC_GEO_URL` est défini, une version plus récente est téléchargée et gardée sur le téléphone ; en cas d'erreur réseau, la version de l'app reste utilisée. Seule la RDC est disponible pour l'instant.
- **Photos** (`src/ui/media.ts`, `src/ui/PhotoPicker.tsx`) : appareil photo ou galerie (sélecteur système, sans autorisation pour la galerie), recadrage carré pour la photo de profil et le logo, aperçu avant d'enregistrer, plusieurs photos d'un coup pour un produit (dans l'ordre choisi). Les images sont réduites (1 600 px, 800 px pour le profil), compressées en JPEG à 80 % et copiées dans les fichiers de l'app pour survivre au redémarrage. La photo de profil se change dans Profil (acheteur), à l'inscription et sur L14 (livreur) ; elle apparaît aussi au client et au vendeur pour le livreur.
- Limites : aucune photo n'est envoyée à un serveur (YA YO n'a pas encore d'API de fichiers), et rien n'a été testé sur un téléphone Android ou iOS réel.
