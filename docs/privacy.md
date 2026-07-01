# Privacy

BagDrop's privacy promise is:

> ROS bag file contents, decoded messages, derived statistics, and generated reports are not sent outside the browser.

This does not mean the browser never communicates. The first page load downloads static application assets from the hosting origin, such as GitHub Pages. Hosting providers may receive normal site access logs such as IP address and user agent.

## Requirements

- No external CDN.
- No external fonts.
- No analytics.
- No telemetry.
- No online map tiles.
- No arbitrary remote plugin loading.
- Content Security Policy restricted to same-origin assets.
- Offline operation after the first successful cache.
- Tests should cover analysis while the network is blocked.
- OPFS temporary data must be removable and old temporary data should be cleaned at startup.
