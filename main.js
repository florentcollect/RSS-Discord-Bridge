const RSSParser = require('rss-parser');
const { Webhook } = require('discord-webhook-node');
const fs = require('fs');

// Configuration
// Récupère l'objet JSON contenant tous les webhooks depuis les secrets GitHub
const webhooks = JSON.parse(process.env.DISCORD_WEBHOOKS); 
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

// Formatage du message pour Discord
function formatDiscordPost(feedName, item) {
  return `\u200b\n📢 **${feedName}**\n# [${item.title}](${item.link})`;
}

async function checkFeeds() {
  const parser = new RSSParser();
  const lastPosts = loadLastPosts();

  for (const [name, config] of Object.entries(feeds)) {
    try {
      const feed = await parser.parseURL(config.url);
      const lastItem = feed.items[0];
      
      if (!lastItem?.link) continue;

      if (lastPosts[name] !== lastItem.link) {
        // Utilise la clé du webhook spécifiée dans feeds.json pour trouver la bonne URL
        const hook = new Webhook(webhooks[config.webhookKey]); 
        
        await hook.send(formatDiscordPost(name, lastItem));
        saveLastPost(name, lastItem.link);
        // Pause de 800ms pour ne pas se faire bloquer par l'API de Discord
        await new Promise(resolve => setTimeout(resolve, 800)); 
      }
    } catch (error) {
      console.error(`[ERREUR] Flux "${name}" :`, error.message);
    }
  }
}

checkFeeds().catch(console.error);
