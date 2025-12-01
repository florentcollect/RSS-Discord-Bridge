# RSS-Discord-Bridge

<p align="center">
  <a href="https://github.com/florentcollect/RSS-Discord-Bridge/releases" target="_blank">
    <img src="https://img.shields.io/github/v/release/florentcollect/RSS-Discord-Bridge" alt="Dernière Version">
  </a>
  <a href="https://github.com/florentcollect/RSS-Discord-Bridge/blob/main/LICENSE" target="_blank">
    <img src="https://img.shields.io/github/license/florentcollect/RSS-Discord-Bridge" alt="Licence">
  </a>
</p>

Un script automatisé qui surveille des flux RSS et envoie les nouveaux articles sur Discord.

## ✨ Fonctionnalités

- 📡 **38 flux RSS** surveillés (blogs JDR, chaînes YouTube, éditeurs)
- 🔔 **Notifications Discord** automatiques pour les nouveaux articles
- ⏰ **Vérification toutes les 30 minutes** via GitHub Actions
- 🚫 **Anti-doublons** : ne publie jamais deux fois le même article
- 🎲 **Focus JDR** : éditeurs FR/EN, podcasts, actualités rôlistes

## 📋 Flux inclus

### 🇫🇷 Communauté française
- Le Fix, Le Grog, PTGPTB, Radio Rôliste
- Geek Powa, La Cellule, Rôliskatonic, Ind100
- Hugin & Munin, Guerre & plomb JDR, Jeuxderole.com

### 🇫🇷 Éditeurs français
- Agate Éditions (Ombres d'Esteren, Dragons, 7e Mer)
- Edge Studio (Star Wars, L5R)

### 🌍 Éditeurs internationaux
- Free League Publishing (Alien, Blade Runner, Vaesen)
- Kobold Press (Tales of the Valiant)
- Monte Cook Games (Numenera, Cypher)
- Evil Hat Productions (Fate, Blades in the Dark)
- Pelgrane Press (Trail of Cthulhu, 13th Age)
- Modiphius (Star Trek, Fallout, Dune)
- Critical Role / Darrington Press

### 📺 Chaînes YouTube
- Matthew Colville, Critical Role, Chaosium
- How to be a Great GM, Web DM, Ginny Di
- Roll For Combat, Imagine ton aventure
- Et plus encore...

## 🚀 Installation

1. **Fork ce repository**

2. **Configurer le webhook Discord** :
   - Créer un webhook dans les paramètres de ton serveur Discord
   - Aller dans Settings → Secrets and variables → Actions
   - Créer un secret `DISCORD_WEBHOOK` avec l'URL du webhook

3. **C'est tout !** Le workflow s'exécute automatiquement toutes les 30 minutes.

## ⚙️ Configuration

### Modifier la fréquence
Éditer `.github/workflows/rss-check.yml` :
```yaml
schedule:
  - cron: '*/30 * * * *'  # Toutes les 30 minutes
```

### Ajouter un flux RSS
Éditer `feeds.json` :
```json
{
  "Nom du flux": {
    "url": "https://example.com/feed"
  }
}
```

### Ajouter une chaîne YouTube
Trouver le Channel ID et ajouter dans `feeds.json` :
```json
{
  "Nom de la chaîne": {
    "url": "https://www.youtube.com/feeds/videos.xml?channel_id=UC..."
  }
}
```

## 📁 Structure

```
.
├── .github/workflows/
│   └── rss-check.yml    # Automatisation GitHub Actions
├── feeds.json           # Liste des flux RSS
├── last_posts.json      # Mémoire des articles traités (auto-généré)
├── main.js              # Script principal
└── package.json
```

## 📄 Licence

MIT © [florentcollect]
