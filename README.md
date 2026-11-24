# Courier notifications: Express quickstart

An Express 5 app in TypeScript that notifies a teammate by email, SMS, and in-app inbox when a task is assigned to them. One route saves the assignment and makes one call to Courier with `@trycourier/courier`. Courier delivers on every channel, through the providers you connect, and logs each one in one place. A static page renders the `<courier-inbox>` web component, signed in with a JWT from a second route, so you watch the in-app message arrive.

This is the companion project for [Add notifications to an Express app](https://www.courier.com/docs/guides/add-notifications-to-express) in the Courier docs.

## Build this with a coding agent

Paste this into Claude Code, Cursor, or Codex from the root of your Express app:

```text
Add email, SMS, and in-app notifications to this Express app with Courier.
Follow https://www.courier.com/docs/guides/add-notifications-to-express.md and the reference app at https://github.com/trycourier/courier-express-quickstart.
Use @trycourier/courier and read COURIER_API_KEY from the environment, on the server only.
Send all three channels in one client.send.message with routing method "all", after the event's transaction commits, with one Idempotency-Key per event, and skip SMS when the user has no phone.
Add GET /courier/token that mints the inbox JWT for the session user, never a user id from the request, and render <courier-inbox> on a page.
When done, add a send command like the reference app's npm run send (scripts/send.ts), run it, and show me the request id.
```

Install the Courier skill with `npx skills add trycourier/courier-skills` and connect the [Courier MCP server](https://www.courier.com/docs/resources/mcp), so the agent can read Courier Logs and templates itself. `AGENTS.md` lists the commands and the rules to keep.

## Prerequisites

- Node.js 22.18 or newer
- A [Courier account](https://app.courier.com/signup) and an [API key](https://app.courier.com/settings/api-keys). A Test key is fine.
- For SMS: an SMS provider such as Twilio connected in [Integrations](https://app.courier.com/integrations/catalog), and your phone number in E.164 form

Email works on day one. In a Test environment, the Courier Test Email Provider delivers to the teammates in your workspace, so set `DEMO_EMAIL` to the address you log in to Courier with.

## Run it

```bash
git clone https://github.com/trycourier/courier-express-quickstart.git
cd courier-express-quickstart
npm install
cp .env.example .env      # add your API key and DEMO_EMAIL
npm run first-send        # one plain email, to check the key
npm run dev
```

Open [localhost:3000](http://localhost:3000). The inbox renders, signed in as `user_123` and empty.

Then, in a second terminal:

```bash
npm run send
```

The script assigns a demo task to `user_123` and prints Courier's request id. The email arrives at `DEMO_EMAIL`, the text at `DEMO_PHONE` if you set one, and the message appears in the open inbox without a refresh. Without a phone number, the send leaves SMS out and still delivers the email and the inbox message. Find the request id in [Courier Logs](https://app.courier.com/logs) to see each channel's delivery.

## How the pieces fit

| File | What it does |
|---|---|
| `lib/courier.ts` | The Courier client and `notifyTaskAssigned`: one `client.send.message` call with routing method `all` over email, SMS, and inbox, keyed by the assignment id |
| `server.ts` | `POST /tasks/:taskId/assign` saves the assignment and sends. `GET /courier/token` mints a JWT scoped to the session user |
| `public/index.html` | Renders `<courier-inbox>` from jsDelivr, pinned to 2.7.4 with no bundler, and signs in with that JWT |
| `scripts/send.ts` | Calls `POST /tasks/task_1/assign` on the running server and prints the request id |
| `scripts/first-send.ts` | Sends one plain email straight from the SDK |

## Adapting it to your app

**Read the user from your session.** While `DEMO_EMAIL` is set, `server.ts` treats every request as `user_123`, so the inbox page and the send script agree. Have your auth middleware set `res.locals.user`, leave `DEMO_EMAIL` unset in production, and keep the token route reading from the session. A token route that takes a user id from the request lets any caller read any user's inbox. The assign route needs your app's auth too.

**Send after you commit.** Call `notifyTaskAssigned` once the assignment row is saved, so a rolled-back write notifies nobody. The assignment id is the idempotency key. Retry a timeout, connection error, or 429 with the same key, and it sends at most once. Courier replays any other error for that key for 25 hours, so fix the cause and send with a new key.

**Refresh the inbox token.** It lasts a day, and the inbox doesn't refresh it. Mint a new one and sign in again before it expires, as [Authenticate users](https://www.courier.com/docs/in-app/authenticate-users#5-refresh-tokens) shows.

**Keep your providers.** Connect SendGrid, Postmark, Amazon SES, your SMTP server, or Twilio in Courier. The code doesn't change when you switch or add a backup provider.

## Scripts

| | |
|---|---|
| `npm run first-send` | Send one plain email to `DEMO_EMAIL` |
| `npm run dev` | Start the server on port 3000, reloading on change |
| `npm run start` | Start the server without watching |
| `npm run send` | Assign a demo task through the running server and print the request id |
| `npm run typecheck` | Type-check with `tsc` |

## Troubleshooting

**The inbox stays empty.** The send's `to.user_id` and the token's `user_id` must match. Both are `user_123` in this app.

**SMS is `UNROUTABLE` with `DEMO_PHONE` set.** Connect an SMS provider in the key's environment, and write the number in E.164 form, such as `+12025550156`.

**`node: .env: not found`.** Run `cp .env.example .env` and fill it in.

**`npm run send` prints `Courier didn't accept the notification`.** The server log has Courier's error. A `401` means the key is wrong. Copy it again from [Platform → API Keys](https://app.courier.com/settings/api-keys) and restart `npm run dev`.

## Further reading

- [Send a message](https://www.courier.com/docs/send/overview): routing, idempotency, and every channel
- [Add an inbox](https://www.courier.com/docs/in-app/add-an-inbox?lang=Web%20Components): the `<courier-inbox>` web component
- [Batch notifications into a daily digest in Node.js](https://www.courier.com/docs/guides/batch-notifications-into-a-daily-digest-in-node)

## License

MIT
