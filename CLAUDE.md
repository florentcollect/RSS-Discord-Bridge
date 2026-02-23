# CLAUDE.md - RSS-Discord-Bridge

## Projet

Bot automatise qui surveille 35 flux RSS (blogs JDR, chaines YouTube, editeurs FR/EN) et pousse les nouveaux articles dans un salon Discord via webhook. Tourne sur GitHub Actions (cron horaire).

- **Repo** : https://github.com/florentcollect/RSS-Discord-Bridge
- **Origine** : fork de Gabryel666/RSS-Discord-Bridge (detache, aucune synchro upstream)
- **Langage** : Node.js 20 (CommonJS, `require()`)
- **Dependances** : `rss-parser`, `discord-webhook-node`, `axios` (declare mais non utilise)
- **Hebergement** : GitHub Actions (pas de serveur, pas de base de donnees)
- **Branche principale** : `main` (la branche locale `master` est obsolete)

## Architecture

```
main.js                  Script principal (parsing RSS + envoi Discord + anti-doublons)
feeds.json               Liste des 35 flux RSS (nom + URL)
last_posts.json          Memoire des articles deja envoyes (auto-gere, commite par le bot)
.github/workflows/
  rss-check.yml          Workflow GitHub Actions (cron + concurrency + retry push)
package.json             Dependances npm (v1.3.0)
discution_claude_web/    Fichiers mis a jour non encore pushes (embeds Discord, .gitignore)
```

## Fonctionnement

1. Le cron declenche le workflow toutes les heures (`0 * * * *`)
2. `main.js` charge `feeds.json` et `last_posts.json`
3. Pour chaque flux, parse le RSS avec un timeout de 15 secondes (`Promise.race`)
4. Compare le dernier article avec l'historique (5 URLs memorisees par flux, format array)
5. Si nouveau, envoie sur Discord + enregistre le lien dans l'historique
6. Sauvegarde `last_posts.json` en fin de traitement (une seule ecriture)
7. Le workflow commit et push `last_posts.json` avec retry (3 tentatives + rebase)

## Conventions code

- **Langue** : commentaires et logs en francais
- **Style** : CommonJS (`require`), `async/await`, `for...of` pour les boucles async
- **Nommage** : camelCase pour les fonctions, UPPER_SNAKE_CASE pour les constantes
- **Erreurs** : try/catch par flux (un flux en erreur ne bloque pas les autres)
- **Rate limiting** : 1500ms entre chaque envoi Discord
- **Anti-doublons** : historique de 5 URLs par flux, migration auto ancien format (string -> array)

## Variables d'environnement

| Variable | Description | Stockage |
|---|---|---|
| `DISCORD_WEBHOOK` | URL du webhook Discord | GitHub Secrets |

## Workflow GitHub Actions

- **Cron** : `0 * * * *` (toutes les heures)
- **Concurrency** : `group: rss-check` (empeche les runs paralleles)
- **Timeout** : 15 min sur le job
- **Push** : retry 3x avec `git pull --rebase`, nettoyage node_modules avant rebase
- **Declenchement manuel** : `workflow_dispatch` disponible

## Historique des problemes resolus

### Doublons Discord
- Causes : runs paralleles, `node_modules/` commite (salissait le working tree), historique a 1 seul lien
- Fix : concurrency group, historique 5 URLs/flux, nettoyage node_modules avant git ops

### Runs de 41+ minutes
- Cause : `parseURL()` sans timeout sur des flux qui ne repondaient pas
- Fix : `parseWithTimeout()` (15s), timeout-minutes: 15 sur le job, cron passe a 1h

### Pas de vignettes Discord
- Cause : `webhook.send(string)` en texte brut
- Fix : `MessageBuilder` (embeds) avec extraction d'image (enclosure, media:content, media:thumbnail, HTML)
- **Status** : code pret dans `discution_claude_web/main.js`, pas encore pushe

## Dette technique

- **`node_modules/` dans le repo** : ~6 Mo inutiles. A supprimer du tracking (`git rm -r --cached`). Le `.gitignore` prevu empeche les nouveaux ajouts.
- **`axios` dans package.json** : non utilise, vestige d'une ancienne version
- **`release notes.md` obsolete** : decrit des fonctionnalites qui ne sont plus dans le code actuel
- **Pas de tests** : `npm test` retourne une erreur. Un test de smoke serait utile.
- **Branche locale `master` desynchronisee** : tout le travail recent est sur `origin/main`

## Corrections en attente de push

Fichiers dans `discution_claude_web/` a appliquer sur le repo :
1. **`.gitignore`** : exclut `node_modules/`
2. **`main.js`** : version avec embeds Discord (`MessageBuilder`), `extractImage()`, `customFields` rss-parser
3. **`rss-check.yml`** : nettoyage `node_modules/` et `package-lock.json` avant operations git

## Flux RSS surveilles (35 flux)

### Communaute FR (9 blogs + 5 YouTube)
Le Fix, Le Grog, PTGPTB, Radio Roliste, Geek Powa, Jeuxderole.com, Hugin & Munin, Guerre & plomb JDR, Le Cyberspace de Jerome Darmont, Geek Powa (Podcast), La Cellule, Roliskatonic, Ind100, SciFi-Universe (critiques + actualites)

### Editeurs internationaux (8 blogs)
Free League Publishing, Kobold Press, Monte Cook Games, Evil Hat Productions, Pelgrane Press, Modiphius Entertainment, Agate Editions, Critical Role (Blog)

### YouTube EN (7 chaines)
Matthew Colville, Critical Role, Chaosium, Ginny Di, How to be a Great GM, Web DM, Roll For Combat

### Medias EN (2 blogs)
Dicebreaker, Geek Native

### YouTube FR (3 chaines)
Au bazar d'Hectelyon, Caverne Du Roliste, Imagine ton aventure

## Developpement local

```bash
git clone https://github.com/florentcollect/RSS-Discord-Bridge.git
cd RSS-Discord-Bridge
npm install
DISCORD_WEBHOOK="https://discord.com/api/webhooks/..." node main.js
```
