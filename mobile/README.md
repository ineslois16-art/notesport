# Suivi sportif — application iOS / Android

Application mobile hors ligne pour le programme corde à sauter · pompes · squats.
Écrite avec Expo (React Native + TypeScript), base de données **SQLite locale**,
courbes de suivi dessinées en SVG.

## Ce que fait l'application

**Aujourd'hui** — la journée en cours, bloc par bloc
- navigation jour par jour (impossible d'aller dans le futur) ;
- une case à cocher par bloc, avec retour haptique ;
- **heure de chaque bloc modifiable à la minute** (sélecteur natif) : les
  horaires du programme ne sont que des repères, rappelés sous le champ ;
  cocher un bloc du jour l'horodate automatiquement ;
- répétitions réelles ajustables (sauts / pompes / squats) quand la séance ne
  s'est pas passée comme prévu ;
- durée et dépense estimées recalculées à chaque frappe ;
- **seuls les blocs cochés comptent** dans les totaux, l'historique et les
  courbes ;
- objectif de sauts du jour, poids et commentaires ;
- **enregistrement automatique** : il n'y a pas de bouton « sauvegarder ».

**Progression** — les courbes
- périodes 7 j / 30 j / 90 j / 1 an ;
- sauts par jour, avec la ligne d'objectif ;
- blocs terminés par jour (barres, sur fond du nombre de blocs prévus) ;
- poids, avec repère de chaque pesée réelle et écart début → fin ;
- dépense estimée ;
- série en cours, régularité, moyenne, total et records personnels ;
- chaque courbe se **parcourt au doigt** : la valeur du jour touché s'affiche en
  haut du graphique.

**Historique** — toutes les journées, groupées par mois, avec accès direct à
n'importe quel jour pour le corriger.

**Réglages** — programme (nombre de blocs, horaires, volumes, cadence, poids de
référence), rappels locaux à l'heure de chaque bloc, export JSON / CSV, import,
effacement complet.

## Données

Tout vit dans une base SQLite sur le téléphone (`suivi-sportif.db`) : aucun
compte, aucun serveur, aucune connexion réseau. Le schéma est versionné via
`PRAGMA user_version`.

| Table | Rôle |
|---|---|
| `settings` | réglages du programme (clé/valeur JSON) |
| `days` | une ligne par journée : poids, commentaires |
| `block_entries` | un bloc d'une journée : coché, heure réelle, répétitions |

L'import accepte **deux formats** : les sauvegardes de l'application, et le
fichier JSON exporté par la page web « Suivi sportif de Val » (`web/index.html`
dans ce dépôt) — l'historique existant n'est donc pas perdu.

## Développement

```bash
cd mobile
npm install
npm start          # ouvre Expo ; scanner le QR code avec Expo Go
npm run ios        # simulateur iOS (macOS requis)
npm run typecheck  # TypeScript
npm test           # 18 tests du cœur métier (node:test)
```

Les tests couvrent le calcul du programme, les totaux, les séries, les dates et
la relecture des sauvegardes. Ils tournent sans téléphone ni émulateur.

## Structure

```
App.tsx                      barre d'onglets + racine
src/domain/program.ts        programme, durées, calories  (pur, testé)
src/domain/stats.ts          agrégats, séries, records    (pur, testé)
src/db/database.ts           SQLite : schéma, migrations, requêtes
src/state/store.tsx          état partagé + écriture différée
src/components/charts/       courbes et barres en react-native-svg
src/screens/                 les quatre écrans
src/lib/                     dates locales, sauvegardes, rappels
```

## Publier sur l'App Store

Voir **[../docs/publication-app-store.md](../docs/publication-app-store.md)** pour la
procédure complète (compte développeur, EAS, TestFlight, fiche App Store).
