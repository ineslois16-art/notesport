# Mettre Notesport sur ton iPhone, puis sur l'App Store

Le code de l'application est prêt et compile (`mobile/`). Ce qui suit ne peut
pas être fait à ta place : **publier sur l'App Store passe obligatoirement par
ton compte Apple**, avec ton identifiant, ton moyen de paiement et ta signature
sur les contrats Apple. Personne d'autre ne peut le faire pour toi.

Quatre chemins, du gratuit au plus officiel.

| | Coût | Icône sur l'écran d'accueil | Hors ligne | Notifications | Durée |
|---|---|---|---|---|---|
| **0. PWA** (page web installée) | **0 €** | oui | oui | non (iOS) | illimitée |
| 1. Expo Go | 0 € | non | oui | non | tant que l'ordinateur sert la page |
| 2. TestFlight | 99 $/an | oui | oui | oui | 90 jours par build |
| 3. App Store | 99 $/an | oui | oui | oui | illimitée |

---

## Chemin 0 — sans aucun compte Apple : installer la page web (recommandé pour commencer)

**C'est la réponse à « il n'y a pas d'autre solution gratuite ? » : oui.** La
page `web/index.html` est une *progressive web app*. Sur iPhone, Safari sait
l'installer sur l'écran d'accueil : icône, plein écran sans barre d'adresse,
fonctionnement hors ligne. Aucun compte, aucun euro, aucune revue Apple.

### Publier la page (une fois)

1. Sur GitHub, ouvre le dépôt → **Settings → Pages**.
2. *Source* : **Deploy from a branch**, branche `main`, dossier `/ (root)`.
3. Après une minute, la page est en ligne à l'adresse :
   `https://ineslois16-art.github.io/notesport/web/`

HTTPS est obligatoire pour qu'une PWA s'installe — GitHub Pages le fournit.

### Installer sur l'iPhone

1. Ouvrir cette adresse **dans Safari** (pas Chrome : sur iOS, seul Safari sait
   installer une PWA).
2. Bouton **Partager** → **Sur l'écran d'accueil** → *Ajouter*.
3. L'icône verte apparaît. Elle s'ouvre en plein écran, fonctionne en avion.

### Ce que ce chemin ne donne pas

- **Pas de notifications de rappel** : Apple ne les autorise pas encore aux PWA
  installées de façon fiable en France. Une alarme récurrente dans l'app Horloge
  fait le même travail.
- **Stockage moins garanti.** Les données vivent dans le stockage de Safari.
  iOS peut le purger si l'application reste plusieurs semaines sans être
  ouverte, et « Effacer historique et données de site » l'efface. **Utilise
  « Exporter mes données » de temps en temps** : le fichier JSON se réimporte
  dans la PWA comme dans l'application native.
- Pas de retour haptique, pas de sélecteur d'heure natif.

Pour un usage quotidien, ces limites sont mineures. Si un jour tu veux les
notifications et un stockage sans réserve, l'application native est déjà prête
dans `mobile/` — les chemins ci-dessous.

---

## Faut-il un Supabase ou un Firebase ?

**Non — et ce serait un recul.** L'idée que « sans App Store, il faut un
serveur » vient d'une confusion entre *distribuer* l'application et *stocker*
les données. Ce sont deux choses séparées :

- La PWA du chemin 0 stocke tout dans le navigateur du téléphone, exactement
  comme la version native stocke tout dans SQLite. Aucun serveur n'intervient.
- Les versions gratuites de Supabase et Firebase suffiraient largement en
  volume — quelques kilo-octets par an. Ce n'est pas le problème.

Ce qu'un backend coûterait réellement ici :

- **un compte à créer et une connexion à gérer** (sinon n'importe qui pourrait
  lire tes données) ;
- **des données de santé — poids, séances — hébergées chez un tiers**, alors
  qu'aujourd'hui elles ne quittent pas ton téléphone ;
- **une dépendance réseau** : plus de saisie dans le métro ou en salle sans
  réseau, alors que c'est précisément le moment où on coche un bloc ;
- une offre gratuite qui peut changer, et un projet Supabase gratuit qui se met
  en pause après quelques semaines d'inactivité.

La seule vraie raison d'ajouter un serveur serait de **synchroniser plusieurs
appareils** (iPhone + iPad + ordinateur, en temps réel). Pour un suivi
personnel sur un seul téléphone, l'export JSON couvre le besoin de sauvegarde
et de changement d'appareil, sans aucun de ces coûts.

Si un jour tu veux vraiment la synchronisation, la porte reste ouverte : toute
la logique est déjà séparée du stockage (`src/domain/` ne connaît pas la base),
il n'y aurait qu'une couche de synchronisation à brancher derrière
`src/db/database.ts`.

---

## Chemin 1 — l'avoir sur ton téléphone en 10 minutes (gratuit)

Aucun compte développeur, aucun euro. L'application tourne dans **Expo Go**.

1. Installe **Expo Go** depuis l'App Store sur ton iPhone.
2. Sur l'ordinateur :
   ```bash
   cd mobile
   npm install
   npm start
   ```
3. Scanne le QR code affiché dans le terminal avec l'appareil photo de
   l'iPhone. L'application s'ouvre.

Limite : Expo Go doit rester installé et l'ordinateur allumé sur le même réseau
Wi-Fi pour recharger l'application. Les données, elles, restent bien enregistrées
sur le téléphone. C'est parfait pour essayer et dire ce qu'il faut changer.

---

## Chemin 2 — une vraie application installée (TestFlight)

Une icône sur l'écran d'accueil, qui fonctionne sans ordinateur ni Wi-Fi. Il
faut un **compte Apple Developer** (99 $/an, https://developer.apple.com/programs/).

### Une seule fois

1. Choisis un identifiant unique et remplace-le dans `mobile/app.json`
   (`ios.bundleIdentifier` et `android.package`). Aujourd'hui :
   `com.val.notesport`. La convention est ton nom de domaine à l'envers, par
   exemple `fr.valerie.notesport`.
2. Crée un compte Expo (gratuit) puis :
   ```bash
   npm install -g eas-cli
   eas login
   cd mobile
   eas init          # rattache le projet à ton compte, écrit l'ID dans app.json
   ```

### Construire et envoyer

```bash
cd mobile
eas build --platform ios --profile production
```

EAS demande tes identifiants Apple et gère seul les certificats et profils de
provisionnement. La compilation se fait sur leurs serveurs (~15-25 min) : pas
besoin de Mac.

```bash
eas submit --platform ios --latest
```

Renseigne d'abord `submit.production.ios` dans `mobile/eas.json` :
- `appleId` : ton identifiant Apple (adresse e-mail) ;
- `appleTeamId` : visible sur https://developer.apple.com/account (Membership) ;
- `ascAppId` : l'identifiant de l'app créée dans App Store Connect.

Ensuite, dans **App Store Connect → TestFlight**, ajoute-toi comme testeur.
Tu reçois une invitation, tu installes l'app via l'application TestFlight, et
elle vit sur ton téléphone comme n'importe quelle autre. Chaque build reste
valable 90 jours ; il suffit de refaire un `eas build` + `eas submit` ensuite.

Pour beaucoup de gens, **TestFlight suffit** : l'app est sur le téléphone, sans
passer par la revue Apple ni exposer l'application au public.

---

## Chemin 3 — publication publique sur l'App Store

Même build que le chemin 2, plus la revue d'Apple (comptez 24 h à 3 jours). Dans
App Store Connect, remplis la fiche. Voici de quoi la remplir.

### Fiche produit (prête à copier)

**Nom** (30 car. max) : `Notesport`
**Sous-titre** (30 car. max) : `Corde, pompes, squats`

**Description**

> Un suivi d'entraînement simple, pensé pour les micro-séances réparties dans
> la journée : quelques blocs de corde à sauter, de pompes et de squats, du
> matin au soir.
>
> • Coche un bloc quand il est fait — c'est tout.
> • Ajuste les répétitions réelles quand la séance ne s'est pas passée comme
>   prévu.
> • Durée et dépense énergétique estimées à partir de ton poids et de ta
>   cadence.
> • Courbes de progression : sauts par jour, blocs terminés, poids, dépense.
> • Série en cours, régularité, records personnels.
> • Rappels à l'heure de chaque bloc, si tu le souhaites.
> • Programme entièrement modifiable : nombre de blocs, horaires, volumes.
>
> Tout est enregistré sur ton téléphone. Aucun compte, aucune publicité, aucune
> connexion Internet, aucune donnée envoyée où que ce soit. Export JSON ou CSV
> quand tu veux récupérer ton historique.
>
> Les calories affichées sont des estimations et ne remplacent pas un avis
> médical.

**Mots-clés** : `corde à sauter,pompes,squats,entraînement,suivi,poids,fitness,séance,habitude,progression`

**Catégorie** : Forme et santé (principale) · Style de vie (secondaire)
**Classification** : 4+
**URL d'assistance** : obligatoire — une page GitHub du dépôt fait l'affaire.
**URL de politique de confidentialité** : voir `docs/confidentialite.md`, à
publier sur une page accessible (GitHub Pages, par exemple).

### Confidentialité (App Store Connect → « Confidentialité de l'app »)

Réponds **« Non, nous ne collectons aucune donnée »**. C'est exact : l'app n'a
aucun code réseau, aucun SDK d'analyse, aucun identifiant publicitaire.

### Chiffrement

`ios.config.usesNonExemptEncryption` est déjà à `false` dans `app.json` : la
question sur le chiffrement est donc déjà répondue à chaque envoi.

### Captures d'écran obligatoires

Il en faut pour iPhone 6,9" (1290 × 2796) et 6,5" (1242 × 2688). Le plus simple :
ouvrir l'app dans le simulateur iOS (`npm run ios`), remplir deux ou trois
journées, puis `Cmd + S` sur chaque écran. Quatre suffisent : Aujourd'hui,
Progression, Historique, Réglages.

### Deux points où Apple refuse souvent

- **Guideline 4.2 (fonctionnalité minimale)** : une app de suivi très simple
  peut être jugée trop légère. Les courbes, les rappels, l'import/export et les
  records jouent en notre faveur ; si le refus tombe, réponds en pointant ces
  fonctions dans les notes de revue.
- **Santé** : la mention « estimation, pas un avis médical » est déjà affichée
  dans l'app (écran Aujourd'hui et Réglages) et dans la description. Ne
  revendique jamais une mesure exacte de calories.

### Notes pour l'équipe de revue (champ « Notes »)

> Application hors ligne de suivi d'entraînement personnel. Aucun compte
> n'est nécessaire : ouvrez l'app, cochez un bloc dans l'onglet Aujourd'hui,
> les onglets Progression et Historique se remplissent. Aucune donnée n'est
> transmise ; tout est stocké en SQLite local.

---

## Android (bonus)

Le même code produit l'application Android :

```bash
eas build --platform android --profile production
eas submit --platform android --latest
```

Le compte Google Play Console coûte 25 $ une fois pour toutes.

---

## Mettre à jour l'application plus tard

1. Modifier le code.
2. Incrémenter `version` dans `mobile/app.json` (ex. `1.0.1`).
3. `eas build --platform ios --profile production` puis `eas submit`.

Le profil `production` d'`eas.json` incrémente tout seul le numéro de build.
