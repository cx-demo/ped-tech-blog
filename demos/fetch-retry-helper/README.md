# Fetch with retries and exponential backoff

`fetchWithRetry` wraps the standard `fetch` API. It retries network errors and retryable status codes (`408`, `429`, and `5xx`), waits longer after each failure, and stops each attempt after a timeout.

## Run the example

```sh
node example.js
```

Requires Node.js 18 or newer (or any modern browser for `retry.js`).

## Options

- `retries`: number of extra attempts (default `3`).
- `baseDelay`: first wait in milliseconds (default `250`). Each retry doubles it.
- `timeout`: per-attempt timeout in milliseconds (default `5000`).

## Why jitter matters

When many clients fail at once, identical delays make them retry at the same moment. Random jitter spreads retries out and reduces load spikes on a recovering service.
