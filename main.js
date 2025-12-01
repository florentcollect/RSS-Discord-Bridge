const RSSParser = require('rss-parser');
const { Webhook } = require('discord-webhook-node');
const fs = require('fs');

// Gestion des doublons
const LAST_POSTS_FILE = 'last_posts.json';

function loadLastPosts() {
  try {
    if (!fs.existsSync(LAST_POSTS_FILE)) {
      fs.writeFileSync(LAST_POSTS_FILE, '{}');
      return {};
    }
    return JSON.parse(fs.readFileSync(LAST_POSTS_FILE, 'utf8'));
  } catch (err) {
    console.error('Erreur lecture last_posts.json:', err.message);
    return {};
  }
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

      if (lastPosts[name] !== lastItem.link) {
        console.log(`  -> NOUVEAU: ${lastItem.title.substring(0, 50)}...`);
        await webhook.send(formatDiscordPost(name, lastItem));
        saveLastPost(name, lastItem.link);
        newPosts++;
        await new Promise(resolve => setTimeout(resolve, 1000));
      } else {
        console.log(`  -> Pas de nouveau post`);
      }
    } catch (error) {
      errors++;
      console.error(`  -> ERREUR: ${error.message}`);
    }
  }
  
  console.log('=== Terminé ===');
  console.log(`Flux traités: ${processed}`);
  console.log(`Nouveaux posts: ${newPosts}`);
  console.log(`Erreurs: ${errors}`);
}

main().catch(err => {
  console.error('ERREUR FATALE:', err);
  process.exit(1);
});
