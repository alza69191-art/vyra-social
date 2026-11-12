# VYRA support, stories, channel analytics and ads setup

## Required Render environment variable

Set **SUPPORT_ADMIN_EMAIL** on the VYRA API (backend) Render service to the exact email address used by the administrator's VYRA login. Alternatively, set **SUPPORT_ADMIN_USER_ID** to that account's user ID. Do not put either value in the frontend service.

After setting the variable, redeploy the backend. The configured account can manage all private support tickets at **/support**, receive notifications for new tickets and user replies, and review submitted ads at **/ads**. Render is used to configure the environment variable and inspect backend logs; support conversations themselves are handled inside VYRA, not in the Render dashboard.

## Required media storage

Story and ad uploads use the existing Cloudinary integration. The VYRA API service must have **CLOUDINARY_CLOUD_NAME**, **CLOUDINARY_API_KEY**, and **CLOUDINARY_API_SECRET** configured. Keep these secrets only on the backend.

## Frontend routes

- **/support** — private user-to-support tickets and administrator inbox.
- **/notifications** — notification center.
- **/friends** — friend requests and relationships.
- **/stories** — create and view image/video stories; stories expire after 24 hours.
- **/channel** — account/channel metrics.
- **/ads** — submit branded or external-link ads; configured administrator reviews them.

## API routes

- Support: `/api/support/tickets` and `/api/support/tickets/{id}/messages`
- Notifications: `/api/notifications`
- Stories: `/api/stories` and `/api/stories/{id}/view`
- Channel metrics: `/api/channel/analytics`
- Post views: `/api/posts/{id}/view`
- Ads: `/api/ads`, `/api/ads/mine`, `/api/ads/admin`, `/api/ads/{id}/status`

Support messages are private ticket messages, not public posts or ordinary direct messages. Only the ticket owner and configured support administrator can read them.

The bell receives stored notifications for support tickets/replies, friend requests/acceptance, direct/group messages, post reactions/comments, page follows, and ad review status changes. Story and post views are counted once per viewer account. Post view tracking currently starts when a post card is hovered in the feed; verify this behavior on touch devices after deployment.

## Deployment and verification

New database tables are created by SQLAlchemy during backend startup. Confirm the backend starts without migration/import errors, then test registration/login, support tickets from a normal account, administrator replies, story upload/view counts, channel analytics, ad submission, and administrator approval. A GitHub commit alone does not confirm that Render deployed successfully.
