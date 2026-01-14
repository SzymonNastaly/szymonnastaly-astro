#!/usr/bin/env node

/**
 * WordPress to Markdown Migration Script
 *
 * Run with: node scripts/migrate-wordpress.mjs
 *
 * This script:
 * 1. Fetches all posts and pages from WordPress REST API
 * 2. Downloads featured images and inline images
 * 3. Converts HTML content to Markdown
 * 4. Creates folder structure with co-located images
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import TurndownService from 'turndown';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WORDPRESS_URL = 'https://szymonnastaly.com';
const CONTENT_DIR = path.join(__dirname, '../src/content');
const POSTS_DIR = path.join(CONTENT_DIR, 'posts');
const PAGES_DIR = path.join(CONTENT_DIR, 'pages');

// Configure Turndown for better Markdown output
const turndown = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
  bulletListMarker: '-',
});

// Keep iframes (for YouTube embeds, etc.)
turndown.addRule('iframe', {
  filter: 'iframe',
  replacement: (content, node) => {
    const src = node.getAttribute('src');
    if (src && src.includes('youtube')) {
      // Extract video ID and create a simple link
      const videoId = src.match(/embed\/([^?]+)/)?.[1];
      if (videoId) {
        return `\n\n[Watch on YouTube](https://www.youtube.com/watch?v=${videoId})\n\n`;
      }
    }
    return '';
  },
});

// Handle WordPress image blocks
turndown.addRule('wpImage', {
  filter: (node) => {
    return (
      node.nodeName === 'FIGURE' &&
      node.classList.contains('wp-block-image')
    );
  },
  replacement: (content, node) => {
    const img = node.querySelector('img');
    const figcaption = node.querySelector('figcaption');
    if (!img) return '';

    const src = img.getAttribute('src') || '';
    const alt = img.getAttribute('alt') || '';
    const caption = figcaption ? figcaption.textContent : '';

    let result = `![${alt}](${src})`;
    if (caption) {
      result += `\n*${caption}*`;
    }
    return `\n\n${result}\n\n`;
  },
});

/**
 * Strip HTML tags and decode entities for plain text
 */
function stripHtml(html) {
  return html
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Download image to local file
 */
async function downloadImage(url, destPath) {
  try {
    console.log(`    Downloading: ${path.basename(destPath)}`);
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const buffer = await response.arrayBuffer();
    await fs.writeFile(destPath, Buffer.from(buffer));
    return true;
  } catch (error) {
    console.error(`    Failed to download ${url}: ${error.message}`);
    return false;
  }
}

/**
 * Get file extension from URL
 */
function getExtension(url) {
  try {
    const pathname = new URL(url).pathname;
    const ext = path.extname(pathname).toLowerCase();
    return ext || '.jpg';
  } catch {
    return '.jpg';
  }
}

/**
 * Extract all image URLs from HTML content
 */
function extractImageUrls(html) {
  const regex = /<img[^>]+src="([^"]+)"[^>]*>/gi;
  const urls = [];
  let match;
  while ((match = regex.exec(html)) !== null) {
    urls.push(match[1]);
  }
  return urls;
}

/**
 * Get featured image URL from embedded post data
 */
function getFeaturedImageUrl(post) {
  const media = post._embedded?.['wp:featuredmedia']?.[0];
  if (!media) return null;
  return (
    media.media_details?.sizes?.large?.source_url ||
    media.media_details?.sizes?.full?.source_url ||
    media.source_url ||
    null
  );
}

/**
 * Fetch all posts from WordPress
 */
async function fetchPosts() {
  console.log('Fetching posts from WordPress...');
  const response = await fetch(
    `${WORDPRESS_URL}/wp-json/wp/v2/posts?per_page=100&_embed`
  );
  if (!response.ok) throw new Error(`Failed to fetch posts: ${response.status}`);
  const posts = await response.json();
  console.log(`Found ${posts.length} posts\n`);
  return posts;
}

/**
 * Fetch all pages from WordPress
 */
async function fetchPages() {
  console.log('Fetching pages from WordPress...');
  const response = await fetch(
    `${WORDPRESS_URL}/wp-json/wp/v2/pages?per_page=100`
  );
  if (!response.ok) throw new Error(`Failed to fetch pages: ${response.status}`);
  const pages = await response.json();
  console.log(`Found ${pages.length} pages\n`);
  return pages;
}

/**
 * Migrate a single post
 */
async function migratePost(post) {
  const slug = post.slug;
  const postDir = path.join(POSTS_DIR, slug);

  console.log(`  [POST] ${slug}`);

  // Create post directory
  await fs.mkdir(postDir, { recursive: true });

  // Download featured image if exists
  let featuredImagePath = null;
  const featuredUrl = getFeaturedImageUrl(post);
  if (featuredUrl) {
    const ext = getExtension(featuredUrl);
    featuredImagePath = `featured${ext}`;
    const downloaded = await downloadImage(
      featuredUrl,
      path.join(postDir, featuredImagePath)
    );
    if (!downloaded) {
      featuredImagePath = null;
    }
  }

  // Process content - extract and download inline images
  let content = post.content.rendered;
  const inlineImages = extractImageUrls(content);
  let imageIndex = 1;

  for (const imgUrl of inlineImages) {
    // Only download images from the WordPress domain
    if (imgUrl.includes('szymonnastaly.com')) {
      const ext = getExtension(imgUrl);
      const localName = `image-${imageIndex}${ext}`;
      const downloaded = await downloadImage(
        imgUrl,
        path.join(postDir, localName)
      );
      if (downloaded) {
        // Replace URL in content with local reference
        content = content.split(imgUrl).join(`./${localName}`);
        imageIndex++;
      }
    }
  }

  // Convert HTML to Markdown
  const markdownContent = turndown.turndown(content);

  // Create description from excerpt
  const description = stripHtml(post.excerpt.rendered).slice(0, 200);

  // Build frontmatter
  const frontmatter = [
    '---',
    `title: "${stripHtml(post.title.rendered).replace(/"/g, '\\"')}"`,
  ];

  if (description) {
    frontmatter.push(`description: "${description.replace(/"/g, '\\"')}"`);
  }

  frontmatter.push(`date: ${post.date.split('T')[0]}`);

  if (post.modified && post.modified !== post.date) {
    frontmatter.push(`modified: ${post.modified.split('T')[0]}`);
  }

  if (featuredImagePath) {
    frontmatter.push(`featured: ./${featuredImagePath}`);
    frontmatter.push(`featuredAlt: ""`);
  }

  frontmatter.push('draft: false');
  frontmatter.push('---');

  // Write markdown file
  const fileContent = `${frontmatter.join('\n')}\n\n${markdownContent}\n`;
  await fs.writeFile(path.join(postDir, 'index.md'), fileContent);

  console.log(`    Created: ${slug}/index.md`);
}

/**
 * Migrate a single page
 */
async function migratePage(page) {
  const slug = page.slug;

  console.log(`  [PAGE] ${slug}`);

  // Convert HTML to Markdown
  const markdownContent = turndown.turndown(page.content.rendered);

  const frontmatter = [
    '---',
    `title: "${stripHtml(page.title.rendered).replace(/"/g, '\\"')}"`,
    `date: ${page.date.split('T')[0]}`,
    '---',
  ];

  const fileContent = `${frontmatter.join('\n')}\n\n${markdownContent}\n`;
  await fs.writeFile(path.join(PAGES_DIR, `${slug}.md`), fileContent);

  console.log(`    Created: ${slug}.md`);
}

/**
 * Main migration function
 */
async function migrate() {
  console.log('='.repeat(50));
  console.log('WordPress to Markdown Migration');
  console.log('='.repeat(50));
  console.log(`Source: ${WORDPRESS_URL}`);
  console.log(`Destination: ${CONTENT_DIR}`);
  console.log('='.repeat(50) + '\n');

  // Create directories
  await fs.mkdir(POSTS_DIR, { recursive: true });
  await fs.mkdir(PAGES_DIR, { recursive: true });

  // Migrate posts
  const posts = await fetchPosts();
  for (const post of posts) {
    await migratePost(post);
  }

  console.log('');

  // Migrate pages
  const pages = await fetchPages();
  for (const page of pages) {
    await migratePage(page);
  }

  console.log('\n' + '='.repeat(50));
  console.log('Migration complete!');
  console.log('='.repeat(50));
  console.log('\nNext steps:');
  console.log('1. Review migrated content in src/content/');
  console.log('2. Add alt text to featured images (featuredAlt field)');
  console.log('3. Check inline images were downloaded correctly');
  console.log('4. Fix any markdown formatting issues');
  console.log('5. Run: npm run dev');
}

migrate().catch((error) => {
  console.error('\nMigration failed:', error.message);
  // Using standard exit for error indication
  throw error;
});
