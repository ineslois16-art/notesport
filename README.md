# Notesport

Suivi d’entraînement corde à sauter · pompes · squats, hors ligne.

Deux choses dans ce dépôt :

| Dossier | Contenu |
|---|---|
| [`web/`](web/) | la page HTML d'origine, **corrigée** |
| [`mobile/`](mobile/) | l'application iOS / Android (Expo + SQLite locale + courbes) |
| [`docs/`](docs/) | publication sur l'App Store, politique de confidentialité |

---

## 1. La page web corrigée

`web/index.html` — un seul fichier, à ouvrir directement dans un navigateur.
Même apparence et mêmes calculs qu'avant, mais les bugs sont réparés — et la
page s'installe maintenant sur l'écran d'accueil de l'iPhone (voir plus bas).

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

### Ce qui a changé ensuite

- **Deux onglets.** « Aujourd'hui » (la saisie) et « Progression » (les courbes
  de l'application, portées sur la page : sauts par jour avec ligne d'objectif,
  blocs terminés, poids, dépense, séries et records). Le logo est en tête des
  deux.
- **Bouton « Importer un fichier »**, qui relit aussi bien une sauvegarde de
  cette page qu'un export de l'application mobile, au choix en fusion ou en
  remplacement.
- Bouton « Recalculer maintenant » retiré : tout se recalcule à la frappe.
- **Refonte de l'onglet Aujourd'hui.** Le tableau de 1020 px de large forçait
  toute la page à déborder sur téléphone (1059 px sur un écran de 390) : il
  fallait la faire glisser latéralement pour voir la colonne « Fait ». Chaque
  bloc est désormais une carte pilotée par une grille CSS — empilée sur
  téléphone, alignée en colonnes sur grand écran. Une seule structure HTML pour
  les deux : c'est la largeur de la **carte** qui décide, via une *container
  query*, et non celle de l'écran (sur un écran large la carte reste étroite).
- **Enregistrement automatique** : sur téléphone personne ne pense à appuyer sur
  « Enregistrer » avant de fermer l'onglet. Le bouton reste, comme confirmation.
- Navigation ‹ / › entre les jours, historique en lignes lisibles, et poids
  arrondi à l'affichage (`96.60000000000001 kg` apparaissait après un import).
- **Deuxième refonte de l'onglet Aujourd'hui.** La première corrigeait le
  débordement mais montrait 37 champs de saisie d'un coup, sans hiérarchie : la
  saisie était traitée comme le cas normal alors que le geste quotidien est un
  simple tap. Les blocs sont désormais une liste calme — une ligne chacun, rien
  d'éditable tant qu'on n'ouvre pas, **un seul bloc déplié à la fois**. Le bloc
  en cours est mis en avant avec un bouton « C'est fait ». Un anneau de
  progression remplace les quatre tuiles du résumé. Au repos, la page ne
  contient plus qu'un seul champ de saisie (le poids).
- **Identité** : vert `#689d71`, barre d'en-tête pleine, et sous elle un dégradé
  du même vert, linéaire de 0 % à 60 % sur toute la hauteur du document.

  | Rôle | Couleur | Emploi |
  |---|---|---|
  | Vert de marque | `#689d71` | barre, anneau, barres de progression, pastilles, dégradé |
  | Vert profond | `#4a7251` | toute surface pleine portant du texte blanc (il ne porte le blanc qu'à 3,16:1, d'où cette seconde nuance à 5,50:1) |
  | Prune | `#8b689c` | les jalons : objectif atteint, records |
  | Framboise | `#9b6678` | l'instant présent : bloc « maintenant », jour courant |

  Prune et framboise sont les **complémentaires partagées** exactes du vert
  (280° et 340° contre 130°, même saturation et même clarté), ajustées pour
  porter du blanc à 4,6:1. Elles habillent l'interface et **jamais les
  courbes**, qui gardent leur palette de séries validée séparément.

- **Seuls les blocs cochés « Fait » comptent.** Le résultat du jour et
  l'historique ignorent désormais les répétitions saisies sans avoir coché la
  case : une valeur tapée reste une intention, pas une séance réalisée.
- **Heure de chaque bloc modifiable à la minute.** Les horaires du programme
  (08:00, 10:00, …) deviennent de simples repères, affichés sous le champ.
  Cocher un bloc du jour l'horodate automatiquement à la minute ; l'heure reste
  modifiable ensuite. La grille de repère elle-même accepte une minute de
  départ (08:35 aussi bien que 08:00).

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
npm test        # 18 tests du cœur métier, sans téléphone
```

Détail des fonctionnalités et de l'architecture : [`mobile/README.md`](mobile/README.md).

L'application **importe le fichier JSON exporté par la page web**, donc
l'historique déjà accumulé n'est pas perdu.

---

## 3. Avoir l'application sur le téléphone

Quatre chemins, détaillés dans
[`docs/publication-app-store.md`](docs/publication-app-store.md) :

| | Coût | Icône | Hors ligne | Notifications |
|---|---|---|---|---|
| **PWA** — la page web installée depuis Safari | **0 €** | oui | oui | non |
| Expo Go — l'app native servie par l'ordinateur | 0 € | non | oui | non |
| TestFlight — l'app native installée | 99 $/an | oui | oui | oui |
| App Store — publiée | 99 $/an | oui | oui | oui |

**Sans compte Apple Developer, la PWA fait le travail** : activer GitHub Pages
sur ce dépôt, ouvrir `https://<compte>.github.io/notesport/web/` dans Safari,
puis *Partager → Sur l'écran d'accueil*. Icône, plein écran, fonctionne en
avion. Les rappels de bloc sont la seule chose qui manque.

> La mise en ligne sur l'App Store demande **ton** compte Apple Developer
> (99 $/an) : cette étape-là ne peut pas être faite à ta place.

Et non, se passer de l'App Store n'oblige pas à passer par Supabase ou
Firebase : distribuer l'application et stocker les données sont deux choses
distinctes, et les données restent très bien sur le téléphone dans les deux
cas. Le raisonnement complet est dans le même document.
