# Responsive cards with CSS container queries

This demo shows one card component placed in a wide main column and a narrow sidebar. The card switches between a stacked and a side-by-side layout based on the width of its container.

## Run it

1. Download or export the demo.
2. Open `index.html` in any current browser.

No server, package manager, or build step is needed.

## How it works

- `.card-host` declares `container-type: inline-size`, which makes it a query container.
- `@container (min-width: 28rem)` switches the card to a two-column grid.
- Because the query targets the container, the same markup works in any column width.

## Try this next

- Drag the browser window narrower and watch each card change independently.
- Change the breakpoint in `styles.css` and reload.
