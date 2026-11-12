# VYRA support and notifications setup

## Required Render environment variable
Set **SUPPORT_ADMIN_EMAIL** on the VYRA API (backend) Render service to the exact email address used by the support administrator's VYRA login. Alternatively, set SUPPORT_ADMIN_USER_ID to that account's user ID. Do not put either value in the frontend service.

After setting the variable, redeploy the backend. The configured account can view all support tickets through the private support API and reply to users. Other accounts can only view their own tickets and messages.

## New routes
- Frontend: /support, /notifications, /friends
- API: /api/support/tickets, /api/notifications, /api/friends

Support messages are stored as private ticket messages. Access is restricted to the ticket owner and the configured support administrator. They are not public posts and are not exposed in the public feed.

## Important
This is an initial support inbox and notification center. The bell currently counts stored notification records, and the API supports support replies and friend-request notifications. Other event types (likes, comments, follows, group invites, live calls) still need their event producers connected before they can appear. Do not treat the presence of a notification type label as proof that all events are emitted.
