# VYRA File Processing and Media Handling

## Implemented
- Upload endpoint: POST /api/uploads.
- Supported image formats: JPEG, PNG, WEBP, GIF (maximum 15 MB).
- Supported video formats: MP4, WEBM, MOV (maximum 100 MB).
- Cloudinary is used for storage; credentials are read server-side from environment variables.
- Avatar and cover uploads update the authenticated profile. Post media requires an existing post owned by the uploader.
- The API returns a secure Cloudinary URL and stores post-media metadata in PostgreSQL.

## Not implemented
- Malware scanning and quarantine.
- Deep file-signature inspection (the current endpoint also checks the browser-provided MIME type).
- Image sanitization/re-encoding, EXIF removal, thumbnail generation, video transcoding, and asynchronous processing.
- User-facing progress, retry/resume, and upload cancellation.
- Automated deletion of orphaned Cloudinary assets when a database record is deleted.

## Safe extension path
1. Verify file signatures from bytes, not only Content-Type.
2. Stream uploads with strict total-size enforcement.
3. Quarantine and scan files before public delivery.
4. Strip metadata and generate optimized variants.
5. Run video conversion in a background worker with resource/time limits.
6. Store processing state and failure reasons in the database; make retries idempotent.
