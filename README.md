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
- **Identité** : bandeau vert or, vert de marque `#689d71`, et sous le bandeau un
  dégradé du vert de marque, linéaire de 0 % à 60 % sur toute la hauteur du document.

  | Rôle | Couleur | Emploi |
  |---|---|---|
  | Vert or | `#9fab54` | le bandeau du haut (encre foncée dessus, 6,22:1) |
  | Vert de marque | `#689d71` | anneau, barres de progression, pastilles, dégradé |
  | Vert profond | `#4a7251` | toute surface pleine portant du texte blanc (il ne porte le blanc qu'à 3,16:1, d'où cette seconde nuance à 5,50:1) |
  | Prune | `#8b689c` | **l'acquis** : série en cours, objectif atteint, records |
  | Framboise | `#9b6678` | **l'instant présent** : bloc « maintenant », prochain bloc, jour courant |

  Le résumé du jour porte les deux : une tuile framboise pour le prochain bloc,
  une tuile prune pour la série en cours.

- **Validation avant d'enregistrer.** Cocher un bloc n'écrit plus rien
  directement : un panneau montre ce qui va être retenu — heure proposée et
  répétitions, tout deux modifiables — et seul « Valider ce bloc » enregistre.
  Annuler ne laisse aucune trace, pas même l'heure proposée. Décocher reste
  immédiat : on défait, on ne crée rien, et demander un accord pour corriger
  une erreur serait pénible. Même règle dans l'application.

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

### Le repos cesse d'être une défaite

Le modèle était le même 1 000 sauts tous les jours, sans repos prévu — et le
compteur de série punissait précisément le jour de repos, puisqu'un jour vide
le remettait à zéro. On demandait donc à l'utilisateur de saborder son propre
score pour se ménager. Trois changements retirent cette pression, sans rien
enlever au jeu.

- **Un niveau déclaré au réveil.** *Plein*, *Allégé*, *Ménagé* ou *Récup* : le
  programme du jour vaut 100 %, 80 %, 50 % ou rien. On allège les répétitions
  **sans toucher au nombre de blocs** — l'espacement entre deux efforts est
  justement ce qui protège les tendons, c'est la dernière chose à raboter.
- **Tenir son niveau est une réussite pleine.** L'objectif du jour suit le
  niveau déclaré : une journée « Ménagé » tenue à 500 sauts compte exactement
  comme une journée « Plein » tenue à 1 000. La tuile « objectifs atteints »
  devient **jours tenus au niveau déclaré** — c'est le calibrage qui est noté,
  plus le maximum.
- **Le repos se coche.** Un jour *Récup* n'a qu'un bloc, vide, qui se valide en
  un tap : il compte comme journée active, donc il maintient la série. Son bloc
  porte un identifiant à part (`rest`), si bien que les blocs de travail déjà
  saisis survivent intacts à un aller-retour Plein → Récup → Plein.
- **Deux jokers par mois.** Une journée vide que la série traverse consomme un
  joker du mois civil au lieu de tout remettre à zéro. Un joker protège, il ne
  s'entraîne pas : il ne fait pas monter le compteur. Et il n'est dépensé que
  s'il a réellement franchi un trou — ceux posés au-delà du début de la série
  sont rendus. Le but est de supprimer l'incitation à s'entraîner blessé pour
  ne pas perdre quarante jours : c'est ce réflexe-là qui transforme une gêne en
  tendinite.

Les sauvegardes antérieures n'ont pas de niveau : elles repartent en « Plein »,
et gardent donc exactement les chiffres qu'elles avaient. Même règle, mêmes
formules et même format d'échange dans l'application.

### Ce que le premier jet laissait passer

Un audit du dispositif ci-dessus a trouvé un trou et trois incohérences.

- **Le niveau se réécrivait après coup.** Une journée pleine réellement faite,
  rebasculée en « Ménagé », s'affichait « journée tenue · niveau ménagé » ; et
  passée en « Récup », ses 1 000 sauts disparaissaient des totaux. L'historique
  devenait falsifiable d'un seul tap — or c'est la donnée qui relie douleur et
  charge. Deux garde-fous : **tenir, c'est rester dans la fourchette** (au-delà
  de 15 % au-dessus de la cible, l'app dit « niveau dépassé », pas « tenue »,
  et un jour déclaré ménagé où l'on fait le double est précisément le jour à
  risque) ; et **une journée qui porte du travail validé ne peut plus être
  déclarée « Récup »**, la raison étant affichée au lieu de masquer la charge.
- **Les courbes jugeaient encore toute journée à 1 000 sauts.** La ligne de
  référence suit désormais la cible réellement visée sur la période, et la
  capacité des barres suit le nombre de blocs du jour (un jour de récup
  n'affiche plus « 1/7 »).
- **Les records ne couronnaient que le maximum**, à deux écrans d'un message
  disant l'inverse. S'y ajoute **les jours tenus au niveau déclaré** : la courbe
  lisse, pas le pic. Deux métriques devenues mortes ont été retirées.
- **Les rappels sonnaient sept fois un jour de repos**, avec les répétitions du
  programme entier. Ils suivent maintenant le niveau déclaré, et se taisent un
  jour de récup.
- **« Normal » nommait un niveau réduit tout en se lisant comme la norme.** Les
  libellés nomment la charge : **Plein · Allégé · Ménagé · Récup**. Les
  identifiants en base, eux, n'ont pas bougé.

Et deux ajouts qui manquaient au dispositif :

- **Le jour ménagé se gagne.** Six journées tenues d'affilée débloquent une
  septième allégée, annoncée comme un acquis avec un bouton pour la prendre.
  C'est un deload, mais présenté comme une récompense — la seule forme de
  décharge qu'on applique vraiment.
- **Le joker se montre quand il agit.** « Joker utilisé · 9 sept. : cette
  journée vide n'a pas cassé la série. » Une protection qu'on ne voit pas
  fonctionner ne soulage pas l'anxiété qui pousse à s'entraîner blessé.

### Le langage visuel

Fond quasi noir, chiffres énormes, étiquettes en petites capitales très
espacées, un seul accent, boutons en pilule pleine largeur : la grammaire des
applications d'entraînement. L'identité reste celle de Notesport — le vert de
marque `#689d71`, éclairci en `#8fd69a` pour tenir sur fond sombre — et aucune
marque tierce n'est reprise.

L'application mobile suit : elle est sombre en permanence, comme la page. Le
thème clair reste défini dans `theme.ts` comme référence de contraste, mais
rien ne le sélectionne.

| Rôle | Couleur | Sur le fond `#0b0c0a` |
|---|---|---|
| Encre | `#f3f6ef` | 17,96:1 |
| Sourdine | `#98a295` | 7,41:1 |
| Accent | `#8fd69a` | 11,44:1 |
| Encre sur accent | `#06120a` | 11,15:1 (sur l'accent) |

Prune et framboise gardent leurs rôles (l'acquis, l'instant présent) à 8,3:1 et
8,6:1 sur les surfaces ; les quatre couleurs de séries vont de 6,5:1 à 8,4:1.
Tout est au-dessus de AA, l'essentiel au-dessus de AAA.

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
npm test        # 31 tests du cœur métier, sans téléphone
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
