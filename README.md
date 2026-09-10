# Suivi sportif

Deux choses dans ce dépôt :

| Dossier | Contenu |
|---|---|
| [`web/`](web/) | la page HTML d'origine, **corrigée** |
| [`mobile/`](mobile/) | l'application iOS / Android (Expo + SQLite locale + courbes) |
| [`docs/`](docs/) | publication sur l'App Store, politique de confidentialité |

---

## 1. La page web corrigée

`web/suivi-sportif.html` — un seul fichier, à ouvrir directement dans un
navigateur. Même apparence et mêmes calculs qu'avant, mais les bugs sont
réparés.

### Le bug bloquant

Dans `readRows()`, la boucle sélectionnait `.done` :

```js
document.querySelectorAll('.done').forEach(e => { … })
```

Or la classe `done` était portée par **deux** éléments différents : la case à
cocher (`<input class="check done">`) **et** la ligne du tableau une fois
terminée (`<tr class="done">`). Dès qu'une ligne cochée était redessinée, la
boucle tombait sur un `<tr>` qui n'a pas de `data-id`, cherchait
`.actual-jumps[data-id="undefined"]`, ne trouvait rien, et plantait sur
`null.value`.

Conséquence : après avoir coché un bloc puis changé de date (ou rechargé la
page), **plus rien ne se mettait à jour** — totaux, calories, enregistrement.
Et une entrée fantôme `undefined` se glissait dans les données sauvegardées.

Reproduit puis vérifié dans un navigateur automatisé :

| | Cases cochées | Résumé affiché | Sauts | Erreurs JS |
|---|---|---|---|---|
| avant | 2 | `1/7` | 150 | 3 × `Cannot read properties of null` |
| après | 2 | `2/7` | 300 | aucune |

Le correctif cible uniquement les cases (`input.check`), la classe de ligne est
renommée `row-done`, et les événements passent par délégation sur `<tbody>`
plutôt que par des attributs `onchange` inline.

### Les autres corrections

- **Dates en heure locale.** `toISOString()` renvoie une date UTC : le suivi
  changeait de jour au mauvais moment selon le fuseau. Remplacé partout.
- **Historique et résumé du jour d'accord entre eux.** L'un comptait les blocs
  cochés, l'autre les blocs cochés *ou* modifiés : les mêmes chiffres pouvaient
  s'afficher différemment sur la même journée. Un seul calcul (`dayTotals`) sert
  désormais aux deux.
- **Objectif à 0 sauts.** Il était traité comme « valeur absente » et
  réinitialisait tout le programme au modèle par défaut.
- **« Réinitialiser le modèle »** ne redessinait pas le tableau : les anciennes
  valeurs restaient à l'écran.
- **Poids reporté.** Une nouvelle journée reprend le dernier poids connu au lieu
  de retomber sur 97 kg en dur.
- **Export.** L'URL du fichier était révoquée immédiatement après le clic, ce qui
  annulait le téléchargement sur certains navigateurs.
- **Données illisibles.** Un `localStorage` corrompu faisait planter le
  chargement ; il repart maintenant proprement d'un état vide.

---

## 2. L'application mobile

`mobile/` — Expo (React Native + TypeScript), base **SQLite locale**, courbes en
SVG. Quatre onglets : Aujourd'hui, Progression, Historique, Réglages.

```bash
cd mobile
npm install
npm start       # puis scanner le QR code avec Expo Go sur l'iPhone
npm test        # 15 tests du cœur métier, sans téléphone
```

Détail des fonctionnalités et de l'architecture : [`mobile/README.md`](mobile/README.md).

L'application **importe le fichier JSON exporté par la page web**, donc
l'historique déjà accumulé n'est pas perdu.

### Pour l'avoir sur le téléphone

- tout de suite, gratuitement, via Expo Go ;
- comme une vraie application installée, via TestFlight ;
- publiée sur l'App Store.

Les trois procédures, avec les commandes et la fiche App Store prête à copier :
[`docs/publication-app-store.md`](docs/publication-app-store.md).

> La mise en ligne sur l'App Store demande **ton** compte Apple Developer
> (99 $/an) : cette étape-là ne peut pas être faite à ta place.
