import { randomUUID } from "node:crypto";
import { join } from "node:path";
import express, { type NextFunction, type Request, type Response } from "express";
import { APIConnectionError, ConflictError, RateLimitError } from "@trycourier/courier";
import { courier, notifyTaskAssigned, type User } from "./lib/courier.ts";

// Build links from APP_URL, never the request's Host header.
const appUrl = process.env.APP_URL;
if (!appUrl) throw new Error("APP_URL is not set. Links in notifications need your app's public URL.");

const demoEmail = process.env.DEMO_EMAIL;
if (demoEmail === "YOUR_EMAIL") throw new Error("Set DEMO_EMAIL in .env to your own email address.");

// DEMO ONLY. While DEMO_EMAIL is set, every request acts as user_123.
const demoUser: User | undefined = demoEmail
  ? { id: "user_123", email: demoEmail, phone_number: process.env.DEMO_PHONE || undefined }
  : undefined;

// Your auth middleware puts the signed-in user in res.locals.user.
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

  // The inbox doesn't refresh the token, so mint a new one before the day is up.
  const { token } = await courier.auth.issueToken({
    scope: `user_id:${user.id} inbox:read:messages inbox:write:events`,
    expires_in: "1 day",
  });

  res.set("Cache-Control", "no-store").json({ userId: user.id, token });
});

app.post("/tasks/:taskId/assign", async (req, res) => {
  // Allow only the task's workspace members. The demo checks sign-in only.
  if (!sessionUser(res)) {
    res.status(401).json({ error: "Sign in first." });
    return;
  }

  const assignee = findTeammate(req.body?.assignee_id);
  if (!assignee) {
    res.status(400).json({ error: "assignee_id must be a teammate in this workspace." });
    return;
  }

  // Save the assignment here. Send after it commits, so a rollback notifies nobody.
  const task = { id: req.params.taskId, title: "Review the launch checklist" };
  const assignment = { id: randomUUID(), taskId: task.id, assigneeId: assignee.id };
  const url = `${appUrl}/tasks/${encodeURIComponent(task.id)}`;

  try {
    const requestId = await notifyTaskAssigned(assignee, { ...task, url }, assignment.id);
    res.status(201).json({ assignment, requestId });
  } catch (error) {
    // The assignment is saved, so answer 201 and leave retries to your queue.
    const retryable =
      error instanceof APIConnectionError || error instanceof RateLimitError || error instanceof ConflictError;
    console.error(`Notification failed for assignment ${assignment.id} (retryable: ${retryable}):`, error);
    res.status(201).json({ assignment, requestId: null, error: "Courier didn't accept the notification. Check the server log." });
  }
});

// Answer errors as JSON, not Express's HTML stack trace page.
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
