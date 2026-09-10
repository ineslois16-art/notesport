# Mettre « Suivi sportif » sur ton iPhone, puis sur l'App Store

Le code de l'application est prêt et compile (`mobile/`). Ce qui suit ne peut
pas être fait à ta place : **publier sur l'App Store passe obligatoirement par
ton compte Apple**, avec ton identifiant, ton moyen de paiement et ta signature
sur les contrats Apple. Personne d'autre ne peut le faire pour toi.

Trois chemins, du plus rapide au plus officiel.

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
   `com.val.suivisportif`. La convention est ton nom de domaine à l'envers, par
   exemple `fr.valerie.suivisportif`.
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

**Nom** (30 car. max) : `Suivi sportif`
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
