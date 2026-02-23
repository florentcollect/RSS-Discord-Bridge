const RSSParser = require('rss-parser');
const { Webhook, MessageBuilder } = require('discord-webhook-node');
const fs = require('fs');

// Configuration
const LAST_POSTS_FILE = 'last_posts.json';
const MAX_HISTORY_PER_FEED = 5;
const FEED_TIMEOUT_MS = 15000;
const DISCORD_COLOR = '#5865F2';

// ============================================================
// Gestion de l'historique (anti-doublons)
// ============================================================

function loadLastPosts() {
  try {
    if (!fs.existsSync(LAST_POSTS_FILE)) {
      fs.writeFileSync(LAST_POSTS_FILE, '{}');
      return {};
    }
    const data = JSON.parse(fs.readFileSync(LAST_POSTS_FILE, 'utf8'));
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

function saveAllPosts(lastPosts) {
  fs.writeFileSync(LAST_POSTS_FILE, JSON.stringify(lastPosts, null, 2));
}

function isAlreadyPosted(lastPosts, feedName, link) {
  const history = lastPosts[feedName] || [];
  return history.includes(link);
}

function recordPost(lastPosts, feedName, link) {
  if (!lastPosts[feedName]) {
    lastPosts[feedName] = [];
  }
  lastPosts[feedName].unshift(link);
  if (lastPosts[feedName].length > MAX_HISTORY_PER_FEED) {
    lastPosts[feedName] = lastPosts[feedName].slice(0, MAX_HISTORY_PER_FEED);
  }
}

// ============================================================
// Parsing RSS avec timeout
// ============================================================

function parseWithTimeout(parser, url, timeoutMs) {
  return Promise.race([
    parser.parseURL(url),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout après ${timeoutMs / 1000}s`)), timeoutMs)
    )
  ]);
}

// ============================================================
// Extraction d'image depuis les items RSS
// ============================================================

function extractImage(item) {
  // 1. Enclosure image (courant pour les blogs)
  if (item.enclosure?.url && item.enclosure.type?.startsWith('image/')) {
    return item.enclosure.url;
  }

  // 2. media:content ou media:thumbnail (courant pour YouTube)
  if (item['media:group']?.['media:thumbnail']?.[0]?.$?.url) {
    return item['media:group']['media:thumbnail'][0].$.url;
  }
  if (item['media:thumbnail']?.$?.url) {
    return item['media:thumbnail'].$.url;
  }
  if (item['media:content']?.$?.url && item['media:content'].$.medium === 'image') {
    return item['media:content'].$.url;
  }

  // 3. Première image dans le contenu HTML
  const content = item['content:encoded'] || item.content || '';
  const imgMatch = content.match(/<img[^>]+src=["']([^"']+)["']/i);
  if (imgMatch) {
    return imgMatch[1];
  }

  return null;
}

// ============================================================
// Formatage Discord avec embed (vignettes + titre propre)
// ============================================================

function buildDiscordEmbed(feedName, item) {
  const embed = new MessageBuilder()
    .setTitle(item.title)
    .setURL(item.link)
    .setAuthor(feedName)
    .setColor(DISCORD_COLOR)
    .setTimestamp();

  // Description courte si disponible
  if (item.contentSnippet) {
    const snippet = item.contentSnippet.substring(0, 200);
    embed.setDescription(snippet + (item.contentSnippet.length > 200 ? '...' : ''));
  }

  // Image / vignette
  const imageUrl = extractImage(item);
  if (imageUrl) {
    embed.setImage(imageUrl);
  }

  return embed;
}

// ============================================================
// Main
// ============================================================

async function main() {
  const startTime = Date.now();
  console.log('=== Démarrage RSS Discord Bridge ===');

  const webhookUrl = process.env.DISCORD_WEBHOOK;
  if (!webhookUrl) {
    console.error('ERREUR: Variable DISCORD_WEBHOOK non définie!');
    process.exit(1);
  }
  console.log('Webhook URL trouvée ✓');

  let feeds;
  try {
    feeds = require('./feeds.json');
    console.log(`${Object.keys(feeds).length} flux chargés ✓`);
  } catch (err) {
    console.error('ERREUR: Impossible de charger feeds.json:', err.message);
    process.exit(1);
  }

  const webhook = new Webhook(webhookUrl);
  const parser = new RSSParser({
    customFields: {
      item: [
        ['media:group', 'media:group'],
        ['media:thumbnail', 'media:thumbnail'],
        ['media:content', 'media:content'],
        ['content:encoded', 'content:encoded']
      ]
    }
  });
  const lastPosts = loadLastPosts();

  let processed = 0;
  let newPosts = 0;
  let errors = 0;
  let timeouts = 0;

  for (const [name, config] of Object.entries(feeds)) {
    processed++;
    try {
      console.log(`[${processed}/${Object.keys(feeds).length}] ${name}...`);

      const feed = await parseWithTimeout(parser, config.url, FEED_TIMEOUT_MS);
      const lastItem = feed.items[0];

      if (!lastItem?.link) {
        console.log(`  -> Pas d'article trouvé`);
        continue;
      }

      if (isAlreadyPosted(lastPosts, name, lastItem.link)) {
        console.log(`  -> Déjà publié`);
      } else {
        console.log(`  -> NOUVEAU: ${lastItem.title.substring(0, 50)}...`);
        const embed = buildDiscordEmbed(name, lastItem);
        await webhook.send(embed);
        recordPost(lastPosts, name, lastItem.link);
        newPosts++;
        await new Promise(resolve => setTimeout(resolve, 1500));
      }
    } catch (error) {
      errors++;
      if (error.message.includes('Timeout')) {
        timeouts++;
        console.error(`  -> TIMEOUT: ${name} n'a pas répondu en ${FEED_TIMEOUT_MS / 1000}s`);
      } else {
        console.error(`  -> ERREUR: ${error.message}`);
      }
    }
  }

  saveAllPosts(lastPosts);

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log('=== Terminé ===');
  console.log(`Durée totale: ${duration}s`);
  console.log(`Flux traités: ${processed}`);
  console.log(`Nouveaux posts: ${newPosts}`);
  console.log(`Erreurs: ${errors} (dont ${timeouts} timeouts)`);
}

main().catch(err => {
  console.error('ERREUR FATALE:', err);
  process.exit(1);
});
