# Stacked — technology blog

A responsive Express and React blog with an editorial tech aesthetic, dark mode, searchable articles, topic and tag filters, bookmarks, and an accessible post editor.

## Run locally

Requires Node.js 22.12+ (or a supported newer Node release).

```sh
npm ci
npm run lint
npm run build
npm start
```

Open http://localhost:3000. For development, run `npm run dev:server` and `npm run dev` in separate terminals; Vite proxies `/api` requests to Express on port 3000. `npm run preview` previews only the static build and does not support publishing.

## Read and write

Use the search field (Ctrl/Cmd+K), topic tabs, or tags to discover articles. Open an article to read it, or bookmark it for later. “Write a post” accepts a title, author, category, description, up to five comma-separated tags, and article text. Separate paragraphs with blank lines and use `## ` for section headings. Content is rendered as text, not executable HTML.

**Express persists published posts in `data/posts.json`.** They survive server restarts and are shared across browsers. Writes are serialized and atomic; input is validated on the server. The editor reports failures without losing the draft; cancelled drafts stay available until the page reloads. Bookmarks and theme preferences are browser-local.

Set `PUBLISH_KEY` to a strong private value before exposing the server publicly. The editor then asks for that key when publishing. Without it, publishing is open to anyone in development; the server refuses to start without a non-empty key when `NODE_ENV=production` (including the Docker image). Use HTTPS in production; do not commit or share the key. This starter supports one server process and up to 500 published posts. A multi-instance deployment needs a shared database; production community publishing also needs individual accounts, moderation, and rate limiting.

## Search engine discovery and deployment

Express serves readable HTML and descriptive metadata for every article, including newly published posts. Article tags, Open Graph/Twitter metadata, BlogPosting structured data, and robots.txt support search-engine discovery. The homepage includes article links in its initial HTML. The build also emits static pages for the included articles.

Set your actual deployment origin when building to generate canonical URLs and sitemap.xml:

```sh
SITE_URL=https://your-blog.example npm run build
SITE_URL=https://your-blog.example npm start
```

Deploy the application to a Node host, run `npm ci` and `npm run build`, then `npm start`. Keep the data directory on persistent storage and back it up. Without `SITE_URL`, no guessed canonical URL or sitemap is served. This application is intended to be hosted at the domain root. Edit included articles in `src/posts.js` and rebuild to change the initial content.

Environment variables:
- `PORT`: Express listen port (default `3000`).
- `SITE_URL`: Public HTTP(S) origin for canonical URLs and the live sitemap.
- `DATA_DIR`: Persistent storage directory (default `data/`).
- `PUBLISH_KEY`: Publishing credential; required when `NODE_ENV=production`, optional only in development.

Fonts load from Google Fonts with local sans-serif fallbacks. All article artwork is generated locally with CSS and SVG.

## Docker

```sh
docker build -t ped-tech-blog:1.0.0 .
docker volume create stacked-data
# Set PUBLISH_KEY in your environment first; never put it in the image.
docker run --rm -p 3000:3000 \
  -e PUBLISH_KEY -e SITE_URL \
  -v stacked-data:/app/data ped-tech-blog:1.0.0
```

The multi-stage image includes only production dependencies and built assets, runs as a non-root user, and checks `/healthz`. Back up the named volume to preserve articles.

## Kubernetes

The `kubernetes.yaml` manifest includes a ConfigMap, 1Gi persistent volume claim, single-replica Deployment, and ClusterIP Service. It uses non-root execution, a read-only root filesystem, health probes, and resource limits.

1. Build and push the image to your own registry, or load it into your local cluster. Update `image` in `kubernetes.yaml` to the available image reference. Add `imagePullSecrets` if your registry is private.
2. Set the ConfigMap’s `SITE_URL` to your public HTTPS origin if you want canonical URLs and the live sitemap.
3. Create the publishing Secret in the same namespace before deploying (set `PUBLISH_KEY` to a strong private value first):

   ```sh
   kubectl create secret generic stacked-publishing \
     --from-literal=publish-key="$PUBLISH_KEY"
   kubectl apply -f kubernetes.yaml
   kubectl rollout status deployment/stacked
   kubectl port-forward service/stacked 8080:80
   ```

4. Open http://localhost:8080. For public access, attach the Service to your cluster’s ingress or gateway with HTTPS termination. Keep the original Host header so same-origin publishing checks work.

A default StorageClass (or a manually provisioned matching persistent volume) is required. Set `storageClassName` on the claim if your cluster needs a particular class. The Secret must contain a non-empty `publish-key`; no credentials are included in the manifest. Kubernetes Secrets should be access-controlled and encrypted at rest.

Keep `replicas: 1` and the `Recreate` strategy: JSON storage is single-process, and rolling replicas could overwrite each other’s posts. Scaling requires replacing it with a shared database. The persistent volume survives Pod replacements; back it up separately. ConfigMap/Secret changes require a Deployment restart.
