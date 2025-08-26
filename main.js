const RSSParser = require('rss-parser');
const { WebhookClient } = require('discord.js');
const fs = require('fs');

const webhooks = JSON.parse(process.env.DISCORD_WEBHOOKS); 
const feeds = require('./feeds.json');
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

// === VERSION AMÉLIORÉE DE LA FONCTION ===
function formatDiscordPost(feedName, item) {
  // On commence par créer la base de l'embed
  const embed = {
    author: {
      name: feedName
    },
    title: item.title,
    url: item.link,
    color: 0x0099ff,
    timestamp: new Date().toISOString()
  };

  // 1. On essaie d'ajouter une description (le "chapeau")
  // On utilise 'contentSnippet' qui est souvent un bon résumé
  if (item.contentSnippet) {
    // On coupe le texte s'il est trop long pour ne pas faire un pavé
    embed.description = item.contentSnippet.length > 280 
      ? item.contentSnippet.substring(0, 277) + '...' 
      : item.contentSnippet;
  }

  // 2. On essaie d'ajouter une image de preview
  // La source la plus fiable est la balise 'enclosure' du flux RSS
  if (item.enclosure && item.enclosure.type && item.enclosure.type.startsWith('image')) {
    embed.image = { url: item.enclosure.url };
  }

  return {
    embeds: [embed]
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
