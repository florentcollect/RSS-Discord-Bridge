const RSSParser = require('rss-parser');
const { Webhook } = require('webhook-discord');
const fs = require('fs');

// Configuration (rien ne change)
const webhooks = JSON.parse(process.env.DISCORD_WEBHOOKS); 
const feeds = require('./feeds.json');

// Gestion des doublons (rien ne change)
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

function formatDiscordPost(feedName, item) {
  return {
    embeds: [{
      author: {
        name: feedName
      },
      title: item.title,
      url: item.link,
      color: 0x0099ff,
      timestamp: new Date().toISOString()
    }]
  };
}

async function checkFeeds() {
  const parser = new RSSParser();
  const lastPosts = loadLastPosts();

  for (const [name, config] of Object.entries(feeds)) {
    try {
      if (!config || typeof config.url !== 'string') {
        console.error(`[CONFIG ERREUR] Flux "${name}" a une configuration invalide dans feeds.json.`);
        continue;
      }

      const feed = await parser.parseURL(config.url);
      const lastItem = feed.items[0];
      
      if (!lastItem?.link) continue;

      if (lastPosts[name] !== lastItem.link) {
        // *** FIX N°1 : On passe l'URL dans un objet comme attendu par la librairie ***
        const hook = new Webhook(webhooks[config.webhookKey]);
        
        const messagePayload = formatDiscordPost(name, lastItem);
        await hook.send(messagePayload);
        
        saveLastPost(name, lastItem.link);

        // *** FIX N°2 : On augmente la pause pour éviter le rate limit de Discord ***
        await new Promise(resolve => setTimeout(resolve, 1500)); // Pause de 1.5 secondes
      }
    } catch (error) {
      console.error(`[ERREUR] Flux "${name}" :`, error.message);
    }
  }
}

checkFeeds().catch(console.error);
