const RSSParser = require('rss-parser');
const { Webhook } = require('discord-webhook-node');
const fs = require('fs');

// Configuration
const HOOK_URL = 'https://discord.com/api/webhooks/1354085734436438156/12q1tXNI9LRpnNBvwHBFOzkh7rdbq00_raoL4Wi37sYBWQz2DoWcWSn7Pxje8xxdoNsh';
const feeds = require('./feeds.json');
const hook = new Webhook(HOOK_URL);

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

// Formatage Discord avec espace invisible avant le nom du site
function formatDiscordPost(feedName, item) {
  return `\u200b\n🔔 **${feedName}**\n# [${item.title}](${item.link})`;
}

async function checkFeeds() {
  const parser = new RSSParser();
  const lastPosts = loadLastPosts();

  for (const [name, url] of Object.entries(feeds)) {
    try {
      const feed = await parser.parseURL(url);
      const lastItem = feed.items[0];
      
      if (!lastItem?.link) continue;

      if (lastPosts[name] !== lastItem.link) {
        await hook.send(formatDiscordPost(name, lastItem));
        saveLastPost(name, lastItem.link);
        // Pause pour éviter le rate limit
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    } catch (error) {
      console.error(`[ERREUR] Flux "${name}" :`, error.message);
    }
  }
}

checkFeeds();