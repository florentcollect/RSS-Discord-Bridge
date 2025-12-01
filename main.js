const RSSParser = require('rss-parser');
const { Webhook } = require('discord-webhook-node');
const fs = require('fs');

// Debug - Vérifie que le webhook est bien configuré
if (!process.env.DISCORD_WEBHOOK) {
  console.error('ERREUR: DISCORD_WEBHOOK non défini !');
  process.exit(1);
}

console.log('Webhook configuré ✓');

// Configuration - Un seul webhook pour tous les flux
const webhook = new Webhook(process.env.DISCORD_WEBHOOK);
const feeds = require('./feeds.json');

// Gestion des doublons
const LAST_POSTS_FILE = 'last_posts.json';

function loadLastPosts() {
  if (!fs.existsSync(LAST_POSTS_FILE)) {
    fs.writeFileSync(LAST_POSTS_FILE, '{}');
    return {};
  }
  return JSON.parse(fs.readFileSync(LAST_POSTS_FILE));
}

function saveLastPost(feedName, postLink) {
  const lastPosts = loadLastPosts();
  lastPosts[feedName] = postLink;
  fs.writeFileSync(LAST_POSTS_FILE, JSON.stringify(lastPosts, null, 2));
}

// Formatage Discord
function formatDiscordPost(feedName, item) {
  return `\u200b\n🔔 **${feedName}**\n# [${item.title}](${item.link})`;
}

async function checkFeeds() {
  const parser = new RSSParser();
  const lastPosts = loadLastPosts();
  
  console.log(`Vérification de ${Object.keys(feeds).length} flux...`);

  for (const [name, config] of Object.entries(feeds)) {
    try {
      console.log(`Checking: ${name}`);
      const feed = await parser.parseURL(config.url);
      const lastItem = feed.items[0];
      
      if (!lastItem?.link) {
        console.log(`  -> Pas de lien trouvé`);
        continue;
      }

      if (lastPosts[name] !== lastItem.link) {
        console.log(`  -> Nouveau post: ${lastItem.title}`);
        await webhook.send(formatDiscordPost(name, lastItem));
        saveLastPost(name, lastItem.link);
        await new Promise(resolve => setTimeout(resolve, 800));
      } else {
        console.log(`  -> Aucun nouveau post`);
      }
    } catch (error) {
      console.error(`[ERREUR] Flux "${name}" :`, error.message);
    }
  }
  
  console.log('Terminé !');
}

checkFeeds().catch(console.error);
