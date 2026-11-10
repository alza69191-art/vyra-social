# VYRA Performance Baseline

## Implemented optimizations
- Public feed uses bounded pagination and returns post media in the same batched response.
- Feed author metadata, reaction totals, comment totals, and media are fetched in grouped queries rather than issuing one request per post.
- Community member and page follower totals are aggregated in grouped queries to avoid N+1 database calls.
- Browser feed now needs one API request for its first page instead of a feed request plus a media request for every post.
- Video elements do not preload full media before the visitor chooses playback; images are lazy-loaded.
- Media uploads run in small parallel batches to avoid saturating the free API instance.
- Marketplace listing reads are paginated; listing creation and status updates require authentication.
- PostgreSQL connection pool remains deliberately small for the free Render instance.

## Platform constraints
- Render free services can sleep after inactivity. Cold starts are platform-related and cannot be eliminated by frontend code.
- Video uploads are stored and delivered by Cloudinary; upload size and account quotas still apply.
- No dedicated video transcoding queue, thumbnail-generation worker, Redis cache, or background job system is configured.
- The marketplace currently supports text listings and seller-owned status changes; payments, checkout, product image galleries, orders, and dispute handling are not implemented.

## Operational targets
- Keep list endpoints paginated and capped.
- Use Cloudinary transformations for responsive thumbnails and video delivery.
- Move slow media processing and AI jobs to a durable background queue when usage grows.
- Measure p50/p95 API latency, error rates, DB pool saturation, and frontend Web Vitals before claiming speed improvements.
