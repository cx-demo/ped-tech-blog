# Stacked demo catalog

A searchable catalog of ready-to-run technology demos, built with Express and React. Each demo lives in its own folder in this repository with a `demo.json` manifest (title, description, search tags) and its standalone resources. Visitors can export any demo as a `.zip` archive from the web UI, and import archives to add new demos.

* [User guide](docs/user-guide.md): browse, search, export, and import demos; archive format and troubleshooting.
* [Developer guide](docs/developer-guide.md): architecture, manifest and archive contracts, API, security model, and extension points.

## Run locally

Requires Node.js 22.12+ (or a supported newer Node release).

```sh
npm ci
npm run lint
npm test
npm run build
npm start
```

Open http://localhost:3000. For development, run `npm run dev:server` and `npm run dev` in separate terminals; Vite proxies `/api` requests to Express on port 3000. `npm run preview` previews only the static build and does not support import or export.

## Demos in this repository

```text
demos/
├── demo.schema.json            JSON Schema for demo.json
├── container-query-cards/      one folder per demo; the folder name is the demo ID
│   ├── demo.json               manifest: title, description, tags, ...
│   ├── README.md               shown on the demo page
│   └── index.html, styles.css  the demo's own files
├── express-health-check/
└── fetch-retry-helper/
```

To add a demo, create a folder under `demos/`, add a `demo.json` and `README.md`, then run `npm run demos:check`. To produce the same archive the web UI exports, run `npm run demos:pack -- <id>`. See the [developer guide](docs/developer-guide.md#add-a-demo-by-hand) for the full contract.

When you run the server locally, demos imported through the web UI are written to `demos/<id>/`, so you can review and commit them like any other change.

## Import and export

Every demo card and demo page has an Export button that downloads `<id>.zip` with `demo.json` at the root and every resource file. "Import demo" uploads such an archive, validates it, and adds it to the catalog. Archives can be up to 25 MB with up to 200 files. The [user guide](docs/user-guide.md#import-a-demo) explains how to prepare an archive and fix import errors.

Set `PUBLISH_KEY` to a strong private value before exposing the server publicly. The import dialog then asks for that key. Without it, importing is open to anyone in development; the server refuses to start without a non-empty key when `NODE_ENV=production` (including the Docker image). Use HTTPS in production; do not commit or share the key. Export is always public. A shared key suits a small team; public community catalogs also need individual accounts, moderation, and rate limiting.

Demo files always download as attachments and are never executed by the catalog, so imported HTML or scripts cannot run on the catalog's origin.

## Search engine discovery and deployment

Express serves readable HTML and descriptive metadata for the catalog and for every demo at `/catalog/<id>/`, including newly imported demos. Demo tags, Open Graph/Twitter metadata, `SoftwareSourceCode` structured data, and robots.txt support search-engine discovery. The build also emits static pages for the bundled demos.

Set your actual deployment origin when building to generate canonical URLs and sitemap.xml:

```sh
SITE_URL=https://your-catalog.example npm run build
SITE_URL=https://your-catalog.example npm start
```

Deploy the application to a Node host, run `npm ci` and `npm run build`, then `npm start`. Point `DEMOS_DIR` at persistent storage if the application directory is replaced on deploy, and back it up. Without `SITE_URL`, no guessed canonical URL or sitemap is served. This application is intended to be hosted at the domain root.

Environment variables:

* `PORT`: Express listen port (default `3000`).
* `SITE_URL`: Public HTTP(S) origin for canonical URLs and the live sitemap.
* `DEMOS_DIR`: Writable directory for imported demos (default `demos/` in the application directory). When it differs from `demos/`, the bundled demos are read-only.
* `PUBLISH_KEY`: Import credential; required when `NODE_ENV=production`, optional only in development.

Fonts load from Google Fonts with local sans-serif fallbacks. All card artwork is generated locally with CSS and SVG.

### Migrating from the blog

This project was previously the Stacked technology blog. Blog posts and the "Write a post" editor have been removed. The server no longer reads `data/posts.json` or `DATA_DIR`; old `/articles/...` links redirect to the catalog home page. Keep a backup of `posts.json` if you need the old content.

## Docker

```sh
docker build -t ped-tech-blog:1.0.0 .
docker volume create stacked-data
# Set PUBLISH_KEY in your environment first; never put it in the image.
docker run --rm -p 3000:3000 \
  -e PUBLISH_KEY -e SITE_URL \
  -v stacked-data:/app/data ped-tech-blog:1.0.0
```

The multi-stage image includes only production dependencies, built assets, and the bundled demos; it runs as a non-root user and checks `/healthz`. Imported demos are stored in the named volume under `/app/data/demos`; back it up to preserve them.

## Harness CI

The pipeline in `.harness/pipeline.yaml` installs locked dependencies, runs Oxlint, the `node:test` suites, and `npm run demos:check` as the repository's test gate, and creates the production build with Node.js 22.

Before importing the pipeline into Harness:

1. Replace `YOUR_HARNESS_PROJECT_ID` and `YOUR_HARNESS_ORG_ID` with your Harness project and organization identifiers.
2. Provide the code repository connector and branch or pull request when prompted.
3. Provide a Kubernetes connector and namespace for the CI build infrastructure.
4. Provide a Docker-compatible registry connector that can pull `node:22-alpine` for each run step.

Harness shares the cloned workspace between steps, so the test and build steps reuse dependencies installed by `npm ci`.

## Kubernetes

The `kubernetes.yaml` manifest includes a ConfigMap, 1Gi persistent volume claim, single-replica Deployment, and ClusterIP Service. It uses non-root execution, a read-only root filesystem, health probes, and resource limits. Imported demos are written to `DEMOS_DIR=/app/data/demos` on the persistent volume; bundled demos stay read-only in the image.

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

4. Open http://localhost:8080. For public access, attach the Service to your cluster’s ingress or gateway with HTTPS termination. Keep the original Host header so same-origin import checks work, and allow request bodies of at least 25 MB.

A default StorageClass (or a manually provisioned matching persistent volume) is required. Set `storageClassName` on the claim if your cluster needs a particular class. The Secret must contain a non-empty `publish-key`; no credentials are included in the manifest. Kubernetes Secrets should be access-controlled and encrypted at rest.

Keep `replicas: 1` and the `Recreate` strategy: imports are serialized within one process, and the catalog is loaded from local disk. Scaling requires shared storage and coordination. The persistent volume survives Pod replacements; back it up separately. ConfigMap/Secret changes require a Deployment restart. The 512Mi memory limit leaves room for in-memory archive processing.
