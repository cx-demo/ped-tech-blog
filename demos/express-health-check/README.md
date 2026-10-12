# Express health checks for containers

A small Express service that exposes the two probes most orchestrators expect:

- `GET /healthz` reports that the process is alive.
- `GET /readyz` reports whether the service should receive traffic. It returns `503` while the service is starting or shutting down.

## Run it locally

```sh
npm install
npm start
curl -i http://localhost:3000/readyz
```

Requires Node.js 22 or newer.

## Run it in Docker

```sh
docker build -t health-demo .
docker run --rm -p 3000:3000 health-demo
```

The image `HEALTHCHECK` calls `/healthz`, so `docker ps` shows the container as healthy once the server is up.

## Graceful shutdown

When the process receives `SIGTERM`, readiness switches to `503` first, so load balancers stop sending new requests. The server then closes and the process exits.
