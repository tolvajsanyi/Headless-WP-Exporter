# Headless-WP-Exporter

Export WordPress posts from a headless WordPress instance to local Markdown files – including images, SEO metadata, categories, and tags. Perfect for static site generators like Astro, Eleventy, or Hugo.
## Features

- Fetches posts via the WordPress REST API (`/wp-json/wp/v2`)
- Downloads featured images and inline content images
- Saves posts as `.md` files with [YAML frontmatter](https://jekyllrb.com/docs/front-matter/)
- Preserves HTML content (no Markdown conversion)
- Extracts SEO metadata (Rank Math compatible)
- Cleans up HTML output (OCD-friendly 🧼)
- Outputs index file with basic metadata (`index.json`)

## Usage

### 1. Install dependencies

```bash
npm install
```

### 2. Configure your WordPress API endpoint

Edit the top of `fetch-md.js` or `fetch-json.js`:

```js
const API_URL = 'https://your-site.com/wp-json/wp/v2';`
```

### 3. Run the export

#### For Markdown export:

```bash
npm run export:md
```

#### For JSON export:

```bash
npm run export:json
```

## Output structure

```bash
src/
  content/
    posts/
      your-post-slug.md     ← with frontmatter + HTML content
      index.json            ← post listing with metadata
  assets/
    images/
      blog-images/
        your-post-slug/
          boritokep.webp
          kep0.webp
          ogimage.webp
          twitter.webp
```

## OCD-friendly HTML cleanup

We remove:

- Extra blank lines
- Newlines between HTML tags
- `<p>` tags inside `<li>` elements (flattened)
- Duplicate whitespace

But we keep:

- Your `class=""` attributes for custom styling
- Clean semantic HTML inside Markdown

## Scripts

```json
"scripts": {
  "export:md": "node fetch-md.js",
  "export:json": "node fetch-json.js"
}
```