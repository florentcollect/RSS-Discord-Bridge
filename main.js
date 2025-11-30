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
  return JSON.parse(fs.readFileSync(LAST_POSTS_FILE, 'utf8'));
}

function saveLastPost(feedName, postLink) {
  const lastPosts = loadLastPosts();
  lastPosts[feedName] = postLink;
  fs.writeFileSync(LAST_POSTS_FILE, JSON.stringify(lastPosts, null, 2), 'utf8');
}

function findImageUrl(item) {
  // 1) Enclosure direct (classique pour images/podcasts)
  if (item.enclosure && item.enclosure.url) {
    const type = item.enclosure.type;
    if (!type || (typeof type === 'string' && type.startsWith('image'))) {
      return item.enclosure.url;
    }
  }

  // 2) media:content (souvent sur certains flux vidéo / images)
  const media = item['media:content'];
  if (media) {
    if (Array.isArray(media) && media[0]?.$?.url) {
      return media[0].$.url;
    } else if (!Array.isArray(media) && media.$?.url) {
      return media.$.url;
    }
  }

  // 3) Fallback : chercher une <img> dans le contenu HTML
  const content = item.content || item['content:encoded'];
  if (!content) {
    return null;
  }

  const srcsetMatch = content.match(/<img[^>]+srcset="([^"]+)"/i);
  if (srcsetMatch && srcsetMatch[1]) {
    const sources = srcsetMatch[1].split(',').map(s => s.trim().split(' ')[0]);
    if (sources[0]) return sources[0];
  }

  const srcMatch = content.match(/<img[^>]+src=["']([^"']+)["']/i);
  if (srcMatch && srcMatch[1]) {
    return srcMatch[1];
  }

  return null;
}

function formatDiscordPost(feedName, item) {
  const embed = {
    author: { name: feedName },
    title: item.title,
    url: item.link,
    color: 0x0099ff,
    timestamp: new Date().toISOString()
  };

  if (item.contentSnippet) {
    embed.description =
      item.contentSnippet.length > 280
        ? item.contentSnippet.substring(0, 277) + '...'
        : item.contentSnippet;
  }

  const imageUrl = findImageUrl(item);
  if (imageUrl) {
    embed.image = { url: imageUrl };
  }

  return { embeds: [embed] };
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
        const webhookUrl = webhooks[config.webhookKey];

        if (!webhookUrl) {
          console.error(`[CONFIG ERREUR] Aucun webhook pour la clé "${config.webhookKey}" (flux "${name}").`);
          continue;
        }

        const hook = new WebhookClient({ url: webhookUrl });
        const messagePayload = formatDiscordPost(name, lastItem);

        await hook.send(messagePayload);
        saveLastPost(name, lastItem.link);

        // Petite pause pour éviter de spammer l'API Discord
        await new Promise(resolve => setTimeout(resolve, 1500));
      }
    } catch (error) {
      console.error(`[ERREUR] Flux "${name}" :`, error.message);
    }
  }
}

checkFeeds().catch(console.error);

