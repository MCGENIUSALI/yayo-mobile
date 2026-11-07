# Serveur YA YO sur Supabase

La base, ses règles d'accès et les règles métier des commandes. L'app mobile s'y connecte avec `src/lib/supabase.ts` ; aucun écran ne l'utilise encore.

## Contenu

| Fichier | Rôle |
|---|---|
| `migrations/…_schema.sql` | Tables : comptes, boutiques, produits (une variante par couleur), adresses, favoris, paiements, commandes, codes secrets, journal, litiges, livreurs, fil social, collections, support. |
| `migrations/…_access.sql` | Qui lit et écrit quoi (RLS), colonne par colonne. Un utilisateur ne change jamais un statut de commande lui-même. |
| `migrations/…_orders.sql` | Les étapes de la commande, reprises de `src/domain/orderMachine.ts` : prix calculés par la base, stock réservé, séquestre, mission proposée au livreur YA YO le moins chargé (refus = au suivant), code de remise vendeur → livreur, code de réception acheteur → livreur (5 essais), incident avec photo, annulation avant remise, litige, remboursement, libération des fonds. |
| `migrations/…_storage.sql` | Deux espaces de fichiers : `media` (public : photos, vidéos) et `private` (pièces d'identité, photos de litige). Chacun écrit dans son dossier. |
| `migrations/…_social.sql` | Modération des commentaires et données de référence de l'app (catégories, créneaux, code YAYO10). Aucune donnée fictive. |
| `tests/run.sh` | Joue toutes les migrations et un parcours complet (commande, refus de mission, codes, annulation, nouvel essai de paiement, litige, fil social, fichiers) sur un PostgreSQL jetable. |

Règles chiffrées (fonction `rules()`) : livraison 5 000 FC par vendeur, commission 10 %, participation livraison du vendeur 5 %, livreur 3 000 FC + 500 FC/km (base seule si échec), demande Mobile Money valable 105 s, commande gardée 30 min après un échec.

## Mettre en ligne

1. Crée le projet sur supabase.com (région Europe de l'Ouest).
2. Applique les migrations, depuis le dossier `yayo-mobile` :
   ```bash
   npx supabase login
   npx supabase link --project-ref <ref du projet>
   npx supabase db push
   ```
3. **Authentication → Providers → Phone** : active-le et branche un fournisseur de SMS (Twilio, Vonage, MessageBird ou Textlocal). Vérifie qu'il livre en RDC avant d'ouvrir l'app.
4. **Database → Extensions** : active `pg_cron`, puis dans l'éditeur SQL :
   ```sql
   select cron.schedule('yayo-paiements', '* * * * *', 'select public.expire_payments()');
   select cron.schedule('yayo-dispatch', '* * * * *', 'select public.dispatch_waiting()');
   ```
5. Dans `.env` de l'app :
   ```
   EXPO_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=<clé anon>
   ```
   La clé `service_role` ne va jamais dans l'app ni dans le dépôt.
6. Pour donner les droits YA YO à un compte : `update public.profiles set is_admin = true where phone = '+243…';`

## Ce qui reste à faire

- **Paiement Mobile Money** : une fonction Edge qui envoie la demande à l'agrégateur choisi (CinetPay, FlexPay, MaxiCash…) et reçoit sa réponse, puis appelle `payment_result()`. Il faut un contrat avec l'agrégateur.
- **Versements** : une fonction Edge qui paie le vendeur après livraison puis appelle `release_escrow()`, et qui rembourse puis appelle `refund_received()`.
- **Distance des missions** : `orders.distance_km` est vide tant qu'aucun service de cartes ne la calcule ; la paie du livreur en dépend.
- **Back-office** : validation des boutiques et des livreurs, décisions de litige, modération (`posts.status = 'masked'`).
- **Notifications** : rien d'envoyé pour l'instant.
- **Brancher les écrans** de l'app sur Supabase, écran par écran, à la place du mode démo.
