const RSSParser = require('rss-parser');
// On importe les deux outils de la nouvelle librairie
const { Webhook, MessageBuilder } = require('webhook-discord');
const fs = require('fs');

// Configuration (rien ne change ici)
const webhooks = JSON.parse(process.env.DISCORD_WEBHOOKS); 
const feeds = require('./feeds.json');

// Gestion des doublons (rien ne change ici)
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

// Le formatage du message va maintenant créer un "embed"
function formatDiscordPost(feedName, item) {
  return new MessageBuilder()
    .setName(feedName) // Le nom du flux apparaît en haut
    .setTitle(item.title)
    .setURL(item.link)
    .setColor('#0099ff') // Une couleur pour la barre latérale de l'embed
    .setTimestamp();
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
        // La création du webhook ne change pas
        const hook = new Webhook(webhooks[config.webhookKey]);
        
        // On envoie l'embed formaté
        const embed = formatDiscordPost(name, lastItem);
        await hook.send(embed);
        
        saveLastPost(name, lastItem.link);
        await new Promise(resolve => setTimeout(resolve, 800)); 
      }
    } catch (error) {
      console.error(`[ERREUR] Flux "${name}" :`, error.message);
    }
  }
}

checkFeeds().catch(console.error);
