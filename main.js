const RSSParser = require('rss-parser');
const { WebhookClient } = require('discord.js');
const fs = require('fs');

const webhooks = JSON.parse(process.env.DISCORD_WEBHOOKS);
const feeds = require('./feeds.json');
const LAST_POSTS_FILE = 'last_posts.json';

// ---------- utils état ----------
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

// ---------- helpers image ----------
function absolutize(u, base) {
  try {
    if (!u) return null;
    if (u.startsWith('//')) return 'https:' + u;
    return new URL(u, base).href;
  } catch {
    return null;
  }
}
function extractFromHtmlContent(html, base) {
  if (!html) return null;
  const m = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  return absolutize(m && m[1], base);
}
async function fetchOgImage(pageUrl) {
  try {
    const res = await fetch(pageUrl, { redirect: 'follow' });
    const html = await res.text();
    const og =
      html.match(/<meta[^>]+property=["']og:image:secure_url["'][^>]+content=["']([^"']+)["']/i) ||
      html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ||
      html.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i);
    const url = og && og[1];
    return absolutize(url, pageUrl);
  } catch {
    return null;
  }
}
function pickFromMedia(item) {
  // media:content
  const mcRaw = item['media:content'];
  const mc = Array.isArray(mcRaw) ? mcRaw : mcRaw ? [mcRaw] : [];
  for (const entry of mc) {
    const c = entry?.url || entry?.$?.url || entry?.['@_url'];
    if (c) return c;
  }
  // media:thumbnail
  const mtRaw = item['media:thumbnail'];
  const mt = Array.isArray(mtRaw) ? mtRaw : mtRaw ? [mtRaw] : [];
  for (const entry of mt) {
    const c = entry?.url || entry?.$?.url || entry?.['@_url'];
    if (c) return c;
  }
  // itunes:image
  if (item['itunes:image']?.href) return item['itunes:image'].href;
  return null;
}
async function chooseImageUrl(item) {
  // 1) enclosure (priorité si image explicite)
  if (item.enclosure?.url) {
    const isImage =
      (item.enclosure.type && item.enclosure.type.startsWith('image')) ||
      /\.(png|jpe?g|webp|gif|bmp|svg)(\?|$)/i.test(item.enclosure.url);
    if (isImage) return absolutize(item.enclosure.url, item.link);
  }
  // 2) media:* balises
  const mediaUrl = pickFromMedia(item);
  if (mediaUrl) return absolutize(mediaUrl, item.link);
  // 3) <img> dans content:encoded / content
  const bodyImg = extractFromHtmlContent(item['content:encoded'] || item.content, item.link);
  if (bodyImg) return bodyImg;
  // 4) og:image de la page
  const og = await fetchOgImage(item.link);
  if (og) return og;
  return null;
}

// ---------- payload Discord ----------
async function formatDiscordPost(feedName, item) {
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
        ? item.contentSnippet.substring(0, 277) + '…'
        : item.contentSnippet;
  }

  const imageUrl = await chooseImageUrl(item);
  if (imageUrl) {
    embed.image = { url: imageUrl };
  }

  return { embeds: [embed] };
}

// ---------- boucle principale ----------
async function checkFeeds() {
  const parser = new RSSParser({
    customFields: {
      item: [
        ['media:content', 'media:content', { keepArray: true }],
        ['media:thumbnail', 'media:thumbnail', { keepArray: true }],
        ['content:encoded', 'content:encoded'],
        ['itunes:image', 'itunes:image']
      ]
    }
  });

  const lastPosts = loadLastPosts();

  for (const [name, config] of Object.entries(feeds)) {
    try {
      if (!config || typeof config.url !== 'string') {
        console.error(`[CONFIG ERREUR] Flux "${name}" invalide dans feeds.json.`);
        continue;
      }

      const feed = await parser.parseURL(config.url);
      const lastItem = feed.items[0];
      if (!lastItem?.link) continue;

      if (lastPosts[name] !== lastItem.link) {
        const hook = new WebhookClient({ url: webhooks[config.webhookKey] });
        const messagePayload = await formatDiscordPost(name, lastItem);
        await hook.send(messagePayload);
        saveLastPost(name, lastItem.link);
        await new Promise((r) => setTimeout(r, 1500));
      }
    } catch (error) {
      console.error(`[ERREUR] Flux "${name}" :`, error.message);
    }
  }
}

checkFeeds().catch(console.error);
