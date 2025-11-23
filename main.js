const RSSParser = require('rss-parser');
const { Webhook } = require('discord-webhook-node');
const fs = require('fs');

// --- Configuration & Validation ---

// Vérification de la variable d'environnement critique
let webhooks;
try {
  if (!process.env.DISCORD_WEBHOOKS) {
    throw new Error("La variable d'environnement DISCORD_WEBHOOKS est manquante.");
  }
  webhooks = JSON.parse(process.env.DISCORD_WEBHOOKS);
} catch (e) {
  console.error(`[FATAL] Erreur de configuration des webhooks : ${e.message}`);
  console.error("Assurez-vous que le secret 'DISCORD_WEBHOOKS' est bien défini dans GitHub ou votre environnement.");
  process.exit(1);
}

// Chargement de la configuration des flux
let feeds;
try {
  feeds = require('./feeds.json');
} catch (e) {
  console.error(`[FATAL] Erreur de lecture de feeds.json : ${e.message}`);
  process.exit(1);
}

const LAST_POSTS_FILE = 'last_posts.json';

// --- Fonctions Utilitaires ---

function log(level, message) {
  const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
  console.log(`[${timestamp}] [${level}] ${message}`);
}

function loadLastPosts() {
  if (!fs.existsSync(LAST_POSTS_FILE)) {
    fs.writeFileSync(LAST_POSTS_FILE, '{}');
    return {};
  }
  try {
    return JSON.parse(fs.readFileSync(LAST_POSTS_FILE));
  } catch (e) {
    log('ERROR', `Fichier ${LAST_POSTS_FILE} corrompu, réinitialisation.`);
    return {};
  }
}

function saveLastPosts(data) {
  fs.writeFileSync(LAST_POSTS_FILE, JSON.stringify(data, null, 2));
}

function formatDiscordPost(feedName, item) {
  // Sécurisation basique du contenu (on pourrait aller plus loin avec du filtrage HTML)
  const title = item.title || 'Sans titre';
  const link = item.link || '';
  return `\u200b\n🔔 **${feedName}**\n# [${title}](${link})`;
}

// --- Cœur du script ---

async function checkFeeds() {
  const parser = new RSSParser();
  const lastPosts = loadLastPosts();
  // On ne charge pas tout en mémoire pour la sauvegarde, on mettra à jour l'objet lastPosts au fur et à mesure.

  log('INFO', 'Démarrage de la vérification des flux RSS...');

  for (const [name, config] of Object.entries(feeds)) {
    // Vérification de la config du webhook
    if (!config.webhookKey || !webhooks[config.webhookKey]) {
      log('ERROR', `Webhook introuvable pour le flux "${name}" (clé: ${config.webhookKey})`);
      continue;
    }

    try {
      log('INFO', `Vérification : ${name}`);
      
      // Timeout pour éviter que le script ne pende indéfiniment sur un flux mort
      const feed = await parser.parseURL(config.url).catch(err => {
         throw new Error(`Erreur réseau/parsing : ${err.message}`);
      });

      if (!feed.items || feed.items.length === 0) {
        log('WARN', `Flux vide : ${name}`);
        continue;
      }

      const lastKnownLink = lastPosts[name];
      const newItems = [];

      // Stratégie de récupération
      if (!lastKnownLink) {
        // Cas 1 : Nouveau flux (jamais traité)
        // On ne spamme pas l'historique, on prend juste le dernier
        log('INFO', `Premier lancement pour "${name}". Envoi du dernier article uniquement.`);
        newItems.push(feed.items[0]);
      } else {
        // Cas 2 : Flux déjà connu
        // On cherche tous les articles jusqu'à tomber sur le dernier connu
        for (const item of feed.items) {
          if (item.link === lastKnownLink) {
            break; // Point de synchronisation trouvé
          }
          newItems.push(item);
        }

        // Sécurité anti-spam / désynchronisation
        // Si on a pris TOUS les items du flux sans trouver le lien, c'est qu'on est désynchronisé.
        // Soit le flux a changé d'URL, soit il y a eu trop de posts.
        // On évite de spammer 20 notifs d'un coup.
        if (newItems.length === feed.items.length && feed.items.length > 1) {
          log('WARN', `Désynchronisation détectée pour "${name}" (dernier lien non trouvé). Recalibrage sur le dernier article.`);
          newItems.length = 0;
          newItems.push(feed.items[0]);
        }
      }

      if (newItems.length === 0) {
        continue; // Rien de nouveau
      }

      log('INFO', `${newItems.length} nouveaux articles pour "${name}"`);

      // On inverse pour publier dans l'ordre chronologique (du plus vieux au plus récent)
      newItems.reverse();

      const hook = new Webhook(webhooks[config.webhookKey]);

      for (const item of newItems) {
        if (!item.link) continue;

        try {
          await hook.send(formatDiscordPost(name, item));
          log('INFO', `→ Envoyé : ${item.title}`);

          // Mise à jour immédiate de l'état pour ne pas perdre la progression en cas de crash
          lastPosts[name] = item.link;
          saveLastPosts(lastPosts);

          // Délai respectueux pour Discord (Rate Limit)
          await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (err) {
          log('ERROR', `Échec d'envoi Discord pour "${item.title}" : ${err.message}`);
          // On continue quand même pour les autres articles
        }
      }

    } catch (error) {
      log('ERROR', `Problème avec le flux "${name}" : ${error.message}`);
    }
  }

  log('INFO', 'Vérification terminée.');
}

checkFeeds().catch(error => {
  console.error("Crash non géré :", error);
  process.exit(1);
});
