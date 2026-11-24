import { randomUUID } from "node:crypto";
import { join } from "node:path";
import express, { type Request } from "express";
import { courier, notifyTaskAssigned, type User } from "./lib/courier.ts";

// Build links from your configured URL, never from the request's Host header.
// Checked at startup, so a missing value fails before any request.
const appUrl = process.env.APP_URL;
if (!appUrl) throw new Error("APP_URL is not set. Links in notifications need your app's public URL.");

// The demo's one user. A real app reads the signed-in user from its session
// and loads teammates from its database. Pinning user_123 lets the inbox page
// and `npm run send` agree on who that is.
const demoUser: User = {
  id: "user_123",
  email: process.env.DEMO_EMAIL,
  phone_number: process.env.DEMO_PHONE || undefined,
};

function sessionUser(_req: Request): User {
  return demoUser; // Replace with req.session.user, or whatever your auth middleware sets.
}

function findTeammate(id: unknown): User | undefined {
  return id === demoUser.id ? demoUser : undefined; // Replace with a database lookup.
}

const app = express();
app.use(express.json());
app.use(express.static(join(import.meta.dirname, "public")));

app.get("/courier/token", async (req, res) => {
  // Read the user from your session here. Never from the query string or body:
  // a caller who can name any user id can read that user's inbox.
  const user = sessionUser(req);

  const { token } = await courier.auth.issueToken({
    scope: `user_id:${user.id} inbox:read:messages inbox:write:events`,
    expires_in: "1 day",
  });

  res.json({ userId: user.id, token });
});

app.post("/tasks/:taskId/assign", async (req, res) => {
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
    // queue a retry for this assignment id, with the same Idempotency-Key.
    console.error(`Notification failed for assignment ${assignment.id}:`, error);
    res.status(201).json({ assignment, requestId: null, error: "Courier didn't accept the notification. Check the server log." });
  }
});

const port = Number(process.env.PORT ?? 3000);
app.listen(port, () => {
  console.log(`Listening on http://localhost:${port}`);
});
