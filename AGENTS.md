# Courier notifications: Express quickstart

An Express 5 app in TypeScript that notifies a teammate by email, SMS, and in-app inbox when a task is assigned to them, through Courier, and shows the inbox on a static page.

Guide: https://www.courier.com/docs/guides/add-notifications-to-express

## Commands

- `npm install`: install dependencies (Node 22.18 or newer)
- `npm run first-send`: send one plain email to `DEMO_EMAIL`, to check the key
- `npm run dev`: start the server on port 3000, reloading on change, and serve the inbox page
- `npm run send`: assign a demo task to `user_123` through the running server and print the request id
- `npm run typecheck`: type-check with `tsc`

## Environment (`.env`, loaded by `tsx --env-file`)

- `COURIER_API_KEY`: read in `lib/courier.ts` and `scripts/first-send.ts`
- `APP_URL`: the public URL that links are built from, read in `server.ts`
- `DEMO_EMAIL`, `DEMO_PHONE`: the demo user's contact details, read in `server.ts` and the scripts. While `DEMO_EMAIL` is set, every request acts as `user_123`. Without `DEMO_PHONE`, the send skips SMS.

## Files

- `lib/courier.ts`: the Courier client and `notifyTaskAssigned`, one `client.send.message` with routing `all`
- `server.ts`: `GET /courier/token` mints the inbox JWT, `POST /tasks/:taskId/assign` sends
- `public/index.html`: renders `<courier-inbox>` from jsDelivr and signs in with the token
- `scripts/send.ts`: the demo send; `scripts/first-send.ts`: one direct email

## Rules

- Keep `COURIER_API_KEY` on the server. The browser gets only a scoped JWT.
- Read the user for the token from the session (`res.locals.user`), and answer 401 without one. Keep the "Read the user from your session here" comment, and never take a user id from the request.
- Pass one `Idempotency-Key` per assignment: `task-assigned-<assignment id>`. Reuse it only after a timeout, connection error, or 429. Courier replays any other error for that key for 25 hours.
- Send after the assignment's transaction commits.
- Build links from `APP_URL`, never from the request's `Host` header.
- Use the `@trycourier/courier` SDK, and don't call the email or SMS provider directly.
