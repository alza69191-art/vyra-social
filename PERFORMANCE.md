# VYRA Performance Baseline

## Current measures
- Next.js production build (next build) and production server (next start).
- PostgreSQL connection pool uses pool_pre_ping, pool size 3, and no overflow to fit a small Render instance.
- Public feed supports bounded pagination (limit 1–100, offset >= 0).
- Post media is lazy-loaded in the browser.
- API responses use cache: no-store for user-specific requests.

## Remaining bottlenecks
- Feed profile details and reaction/comment counts used per-post queries (N+1 pattern); the feed query is being changed to batch profile and count retrieval.
- The frontend currently loads one feed page and has no infinite-scroll/pagination control.
- Render free services can sleep after inactivity; cold starts are platform-related and cannot be removed by frontend code.
- No CDN/image transformation presets, thumbnail generation, video transcoding, or background job queue are configured.

## Operational targets
- Keep list endpoints paginated and capped.
- Add indexes for frequently filtered/sorted columns and inspect PostgreSQL EXPLAIN (ANALYZE, BUFFERS) before adding indexes.
- Use Cloudinary transformations for responsive thumbnails and video delivery.
- Move slow media processing and AI jobs to a durable background queue when usage grows.
- Measure p50/p95 API latency, error rates, DB pool saturation, and frontend Web Vitals before claiming speed improvements.
