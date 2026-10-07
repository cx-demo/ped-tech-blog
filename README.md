# Stacked — technology blog

A responsive React blog with an editorial tech aesthetic, dark mode, searchable articles, topic and tag filters, bookmarks, and an accessible post editor.

## Run locally

Requires Node.js 22.12+ (or a supported newer Node release).

```sh
npm ci
npm run dev
npm run lint
npm run build
npm run preview
```

## Read and write

Use the search field (Ctrl/Cmd+K), topic tabs, or tags to discover articles. Open an article to read it, or bookmark it for later. “Write a post” accepts a title, author, category, description, up to five comma-separated tags, and article text. Separate paragraphs with blank lines and use `## ` for section headings. Content is rendered as text, not executable HTML.

**New posts and bookmarks are stored only in this browser’s local storage.** They survive reloads but are not shared between browsers or publicly published. Clearing browser data removes them. The editor reports storage failures without losing the draft; cancelled drafts stay available until the page reloads. Add a backend/CMS with authentication and server-side validation before using this as a multi-user publishing service.

## Search engine discovery and deployment

The production build outputs readable static HTML pages for all included articles, descriptive metadata, article tags, Open Graph/Twitter metadata, BlogPosting structured data, and robots.txt. The homepage also includes article links in its initial HTML. Browser-local posts cannot be crawled by search engines.

Set your actual deployment origin when building to generate canonical URLs and sitemap.xml:

```sh
VITE_SITE_URL=https://your-blog.example npm run build
```

Deploy `dist/` to a static host that serves directory `index.html` files (including `/articles/<slug>/`). Without `VITE_SITE_URL`, no guessed canonical URL or sitemap is emitted. This application is intended to be hosted at the domain root. Edit included articles in `src/posts.js` and rebuild to publicly publish additional static articles.

Fonts load from Google Fonts with local sans-serif fallbacks. All article artwork is generated locally with CSS and SVG.
