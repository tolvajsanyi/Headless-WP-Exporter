// fetch-posts.js
import fs from 'fs/promises';
import path from 'path';
import fetch from 'node-fetch';
import { JSDOM } from 'jsdom';
import sharp from 'sharp';
import matter from 'gray-matter';

import TurndownService from 'turndown';
const turndownService = new TurndownService();

const API_URL = 'https://businessbloom.consulting/wp-json/wp/v2';
const POSTS_DIR = './src/content/posts/';
const IMAGES_DIR = './src/assets/images/blog-images/';
const INDEX_FILE = './src/content/posts/index.json';

await fs.mkdir(POSTS_DIR, { recursive: true });
await fs.mkdir(IMAGES_DIR, { recursive: true });

async function downloadImage(url, destPath) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch image: ${url}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  await sharp(buffer).webp().toFile(destPath);
}

function extractImageUrlsFromContent(html) {
  const dom = new JSDOM(html);
  const images = [...dom.window.document.querySelectorAll('img')];
  return images.map(img => img.src).filter(Boolean);
}

function replaceImageUrlsWithLocal(html, slug, urlMap) {
  let modified = html;
  for (const [remote, local] of Object.entries(urlMap)) {
    modified = modified.replaceAll(remote, `/assets/images/blog-images/${slug}/${local}`);
  }
  return modified;
}

function stripHtml(html) {
  return html.replace(/<[^>]+>/g, '').trim();
}

const indexList = [];

const postsRes = await fetch(`${API_URL}/posts?per_page=100&_embed`);
const posts = await postsRes.json();

for (const post of posts) {
  const slug = post.slug;
  const postPath = path.join(POSTS_DIR, `${slug}.md`);
  const imageFolder = path.join(IMAGES_DIR, slug);
  await fs.mkdir(imageFolder, { recursive: true });

  // 1. Featured image
  let coverImage = null;
  const featured = post._embedded?.['wp:featuredmedia']?.[0]?.source_url;
  if (featured) {
    try {
      const ext = path.extname(new URL(featured).pathname);
      const filename = 'boritokep.webp';
      await downloadImage(featured, path.join(imageFolder, filename));
      coverImage = `/assets/images/blog-images/${slug}/${filename}`;
    } catch (e) {
      console.warn(`❗ Cover image letöltési hiba: ${featured}`);
    }
  }

  // 2. Content képek letöltése
  const contentImages = extractImageUrlsFromContent(post.content.rendered);
  const imageMap = {};
  for (const [i, url] of contentImages.entries()) {
    try {
      const filename = `kep${i}.webp`;
      await downloadImage(url, path.join(imageFolder, filename));
      imageMap[url] = filename;
    } catch (e) {
      console.warn(`⚠️ Kép letöltési hiba (${url}):`, e.message);
    }
  }

  const cleanedContent = replaceImageUrlsWithLocal(post.content.rendered, slug, imageMap);

  // 3. Kategóriák és címkék
  const terms = post._embedded?.['wp:term'] || [];
  const categories = (terms[0] || []).map(t => t.name);
  const tags = (terms[1] || []).map(t => t.name);

  // Szerző
  const author = post._embedded?.author?.[0]?.name || '';

  // 4. SEO (Rank Math)
  const rankSeo = post.rank_math_seo || {};
  let ogImageUrl = rankSeo.og_image || featured;
  let twitterImageUrl = rankSeo.twitter_image || featured;

  // OG image mentés
  if (ogImageUrl) {
    try {
      const ext = path.extname(new URL(ogImageUrl).pathname);
      const filename = 'ogimage.webp';
      await downloadImage(ogImageUrl, path.join(imageFolder, filename));
      ogImageUrl = `/assets/images/blog-images/${slug}/${filename}`;
    } catch (e) {
      console.warn(`❗ OG image letöltési hiba: ${ogImageUrl}`);
      ogImageUrl = '';
    }
  }

  // Twitter image mentés
  if (twitterImageUrl) {
    try {
      const ext = path.extname(new URL(twitterImageUrl).pathname);
      const filename = 'twitter.webp';
      await downloadImage(twitterImageUrl, path.join(imageFolder, filename));
      twitterImageUrl = `/assets/images/blog-images/${slug}/${filename}`;
    } catch (e) {
      console.warn(`❗ Twitter image letöltési hiba: ${twitterImageUrl}`);
      twitterImageUrl = '';
    }
  }

  const canonical = rankSeo.canonical || `https://businessbloom.consulting/${slug}/`;
  const excerptHtml = post.excerpt?.rendered || '';
  const excerpt = stripHtml(excerptHtml);
  const seo = {
    title: rankSeo.title || post.title.rendered,
    description: rankSeo.description || excerpt,
    og_image: ogImageUrl || '',
    twitter_image: twitterImageUrl || '',
    robots: rankSeo.robots || '',
    canonical: canonical.endsWith('/') ? canonical : canonical + '/',
  };

  const frontmatter = {
    title: post.title.rendered,
    slug,
    pubDate: new Date(post.date).toISOString().split('T')[0], // javított Date formátum
    description: excerpt || post.title.rendered,              // kötelező description mező
    author,
    coverImage,
    categories,
    tags,
    excerpt,
    seo
  };

  const markdownBody = turndownService.turndown(cleanedContent);
  const mdContent = matter.stringify(markdownBody, frontmatter);
  await fs.writeFile(postPath, mdContent, 'utf8');

  indexList.push({
    slug,
    title: post.title.rendered,
    excerpt,
    pubDate: new Date(post.date).toISOString().split('T')[0], // javított Date formátum
    author,
    coverImage,
    categories,
    tags
  });
}

await fs.writeFile(INDEX_FILE, JSON.stringify(indexList, null, 2), 'utf8');
console.log(`✅ Sikeresen letöltve ${posts.length} bejegyzés`);
