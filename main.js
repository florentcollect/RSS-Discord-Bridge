const RSSParser = require('rss-parser');
const { Webhook } = require('discord-webhook-node');
const fs = require('fs');

// Configuration anti-doublons
const LAST_POSTS_FILE = 'last_posts.json';
const MAX_HISTORY_PER_FEED = 5; // Nombre de posts mémorisés par flux

/**
 * Charge l'historique des posts.
 * Gère la migration depuis l'ancien format (string) vers le nouveau (array).
 */
function loadLastPosts() {
  try {
    if (!fs.existsSync(LAST_POSTS_FILE)) {
      fs.writeFileSync(LAST_POSTS_FILE, '{}');
      return {};
    }
    const data = JSON.parse(fs.readFileSync(LAST_POSTS_FILE, 'utf8'));
    
    // Migration : ancien format (une string par feed) -> nouveau format (array)
    for (const [key, value] of Object.entries(data)) {
      if (typeof value === 'string') {
        data[key] = [value];
      }
    }
    
    return data;
  } catch (err) {
    console.error('Erreur lecture last_posts.json:', err.message);
    return {};
  }
}

/**
 * Sauvegarde l'historique complet sur disque.
 */
function saveAllPosts(lastPosts) {
  fs.writeFileSync(LAST_POSTS_FILE, JSON.stringify(lastPosts, null, 2));
}

/**
 * Vérifie si un lien a déjà été publié pour ce flux.
 */
function isAlreadyPosted(lastPosts, feedName, link) {
  const history = lastPosts[feedName] || [];
  return history.includes(link);
}

/**
 * Enregistre un nouveau post dans l'historique d'un flux.
 * Garde uniquement les N derniers pour éviter que le fichier grossisse.
 */
function recordPost(lastPosts, feedName, link) {
  if (!lastPosts[feedName]) {
    lastPosts[feedName] = [];
  }
  lastPosts[feedName].unshift(link);
  // Garder uniquement les MAX_HISTORY_PER_FEED derniers
  if (lastPosts[feedName].length > MAX_HISTORY_PER_FEED) {
    lastPosts[feedName] = lastPosts[feedName].slice(0, MAX_HISTORY_PER_FEED);
  }
}

// Formatage Discord
function formatDiscordPost(feedName, item) {
  return `\u200b\n🔔 **${feedName}**\n# [${item.title}](${item.link})`;
}

async function main() {
  console.log('=== Démarrage RSS Discord Bridge ===');
  
  // Vérification du webhook
  const webhookUrl = process.env.DISCORD_WEBHOOK;
  if (!webhookUrl) {
    console.error('ERREUR: Variable DISCORD_WEBHOOK non définie!');
    console.error('Vérifiez que le secret est bien configuré dans GitHub.');
    process.exit(1);
  }
  console.log('Webhook URL trouvée ✓');
  
  // Chargement des feeds
  let feeds;
  try {
    feeds = require('./feeds.json');
    console.log(`${Object.keys(feeds).length} flux chargés ✓`);
  } catch (err) {
    console.error('ERREUR: Impossible de charger feeds.json:', err.message);
    process.exit(1);
  }
  
  const webhook = new Webhook(webhookUrl);
  const parser = new RSSParser();
  const lastPosts = loadLastPosts();
  
  let processed = 0;
  let newPosts = 0;
  let errors = 0;

  for (const [name, config] of Object.entries(feeds)) {
    processed++;
    try {
      console.log(`[${processed}/${Object.keys(feeds).length}] ${name}...`);
      
      const feed = await parser.parseURL(config.url);
      const lastItem = feed.items[0];
      
      if (!lastItem?.link) {
        console.log(`  -> Pas d'article trouvé`);
        continue;
      }

      if (isAlreadyPosted(lastPosts, name, lastItem.link)) {
        console.log(`  -> Déjà publié`);
      } else {
        console.log(`  -> NOUVEAU: ${lastItem.title.substring(0, 50)}...`);
        await webhook.send(formatDiscordPost(name, lastItem));
        recordPost(lastPosts, name, lastItem.link);
        newPosts++;
        // Pause entre les envois pour éviter le rate limiting Discord
        await new Promise(resolve => setTimeout(resolve, 1500));
      }
    } catch (error) {
      errors++;
      console.error(`  -> ERREUR: ${error.message}`);
    }
  }
  
  // Sauvegarde unique en fin de traitement (pas à chaque post)
  saveAllPosts(lastPosts);
  
  console.log('=== Terminé ===');
  console.log(`Flux traités: ${processed}`);
  console.log(`Nouveaux posts: ${newPosts}`);
  console.log(`Erreurs: ${errors}`);
}

main().catch(err => {
  console.error('ERREUR FATALE:', err);
  process.exit(1);
});
