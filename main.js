const RSSParser = require('rss-parser');
const { Webhook } = require('webhook-discord'); // On n'a besoin que de Webhook
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

// *** C'est ici que la logique change ***
// On va créer un objet "embed" manuellement, ce qui est plus standard.
function formatDiscordPost(feedName, item) {
  return {
    embeds: [{
      author: {
        name: feedName // Le nom du flux apparaît en haut
      },
      title: item.title,
      url: item.link,
      color: 0x0099ff, // Couleur en format numérique
      timestamp: new Date().toISOString()
    }]
  };
}

async function checkFeeds() {
  const parser = new RSSParser();
  const lastPosts = loadLastPosts();

  for (const [name, config] of Object.entries(feeds)) {
    try {
      // Ajout d'une vérification pour l'erreur de config
      if (!config || typeof config.url !== 'string') {
        console.error(`[CONFIG ERREUR] Flux "${name}" a une configuration invalide dans feeds.json.`);
        continue;
      }

      const feed = await parser.parseURL(config.url);
      const lastItem = feed.items[0];
      
      if (!lastItem?.link) continue;

      if (lastPosts[name] !== lastItem.link) {
        const hook = new Webhook(webhooks[config.webhookKey]);
        
        // On crée le message et on l'envoie
        const messagePayload = formatDiscordPost(name, lastItem);
        await hook.send(messagePayload);
        
        saveLastPost(name, lastItem.link);
        await new Promise(resolve => setTimeout(resolve, 800)); 
      }
    } catch (error) {
      console.error(`[ERREUR] Flux "${name}" :`, error.message);
    }
  }
}

checkFeeds().catch(console.error);
