const RSSParser = require('rss-parser');
// *** NOUVELLE LIBRAIRIE OFFICIELLE ***
const { WebhookClient } = require('@discordjs/webhook-client');
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

// Le format du message ne change pas, il est déjà correct
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
        // *** ON UTILISE LE NOUVEAU CLIENT WEBHOOK ***
        // Il attend l'URL dans un objet, ce qui est beaucoup plus clair
        const hook = new WebhookClient({ url: webhooks[config.webhookKey] });
        
        const messagePayload = formatDiscordPost(name, lastItem);
        await hook.send(messagePayload);
        
        saveLastPost(name, lastItem.link);
        
        await new Promise(resolve => setTimeout(resolve, 1500));
      }
    } catch (error) {
      console.error(`[ERREUR] Flux "${name}" :`, error.message);
    }
  }
}

checkFeeds().catch(console.error);
