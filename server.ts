import { randomUUID } from "node:crypto";
import { join } from "node:path";
import express, { type NextFunction, type Request, type Response } from "express";
import { APIConnectionError, ConflictError, RateLimitError } from "@trycourier/courier";
import { courier, notifyTaskAssigned, type User } from "./lib/courier.ts";

// Build links from your configured URL, never from the request's Host header.
// Checked at startup, so a missing value fails before any request.
const appUrl = process.env.APP_URL;
if (!appUrl) throw new Error("APP_URL is not set. Links in notifications need your app's public URL.");

const demoEmail = process.env.DEMO_EMAIL;
if (demoEmail === "YOUR_EMAIL") throw new Error("Set DEMO_EMAIL in .env to your own email address.");

// DEMO ONLY. This app has no login, so while DEMO_EMAIL is set, every request
// acts as user_123. A real app gets the user from its session or database, and
// leaves DEMO_EMAIL unset in production.
const demoUser: User | undefined = demoEmail
  ? { id: "user_123", email: demoEmail, phone_number: process.env.DEMO_PHONE || undefined }
  : undefined;

// The signed-in user, or undefined. res.locals.user is where your auth
// middleware puts it. The demo user fills in only when DEMO_EMAIL is set.
function sessionUser(res: Response): User | undefined {
  return res.locals.user ?? demoUser;
}

function findTeammate(id: unknown): User | undefined {
  return id === demoUser?.id ? demoUser : undefined; // Replace with a database lookup.
}

const app = express();
app.use(express.json());
app.use(express.static(join(import.meta.dirname, "public")));

app.get("/courier/token", async (_req, res) => {
  // Read the user from your session here. Never from the query string or body:
  // a caller who can name any user id can read that user's inbox.
  const user = sessionUser(res);
  if (!user) {
    res.status(401).json({ error: "Sign in first." });
    return;
  }

  // The token lasts a day. The inbox doesn't refresh it, so a real app mints a
  // new one and signs in again before it expires.
  const { token } = await courier.auth.issueToken({
    scope: `user_id:${user.id} inbox:read:messages inbox:write:events`,
    expires_in: "1 day",
  });

  res.set("Cache-Control", "no-store").json({ userId: user.id, token });
});

app.post("/tasks/:taskId/assign", async (req, res) => {
  // This route needs your app's auth: only a signed-in member of the task's
  // workspace may assign it. The demo checks only that someone is signed in.
  if (!sessionUser(res)) {
    res.status(401).json({ error: "Sign in first." });
    return;
  }

  const assignee = findTeammate(req.body?.assignee_id);
  if (!assignee) {
    res.status(400).json({ error: "assignee_id must be a teammate in this workspace." });
    return;
  }

  // Load the task and save the assignment in your database here. Send after the
  // transaction commits, so a rolled-back assignment notifies nobody. The saved
  // assignment's id keys the send, and a later reassignment gets a new id.
  const task = { id: req.params.taskId, title: "Review the launch checklist" };
  const assignment = { id: randomUUID(), taskId: task.id, assigneeId: assignee.id };
  const url = `${appUrl}/tasks/${encodeURIComponent(task.id)}`;

  try {
    const requestId = await notifyTaskAssigned(assignee, { ...task, url }, assignment.id);
    res.status(201).json({ assignment, requestId });
  } catch (error) {
    // The assignment is saved, so answer 201 rather than prompt a retry that
    // would create a second one. This demo only logs the failure. In your app,
    // retry a timeout, connection error, 429, or 409 with the same key, after 60
    // seconds. Courier replays any other error for that key, so fix the cause and
    // use a new key.
    const retryable =
      error instanceof APIConnectionError || error instanceof RateLimitError || error instanceof ConflictError;
    console.error(`Notification failed for assignment ${assignment.id} (retryable: ${retryable}):`, error);
    res.status(201).json({ assignment, requestId: null, error: "Courier didn't accept the notification. Check the server log." });
  }
});

// Answer errors as JSON, instead of Express's HTML stack trace page.
app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (error instanceof SyntaxError) {
    res.status(400).json({ error: "The request body isn't valid JSON." });
    return;
  }
  console.error(error);
  res.status(500).json({ error: "Something went wrong. Check the server log." });
});

const port = Number(process.env.PORT ?? 3000);
app.listen(port, () => {
  console.log(`Listening on http://localhost:${port}`);
  if (demoUser) console.log("Demo mode: every request acts as user_123, because DEMO_EMAIL is set.");
});
