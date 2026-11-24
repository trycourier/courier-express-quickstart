import Courier from "@trycourier/courier";

// Check the key once, at startup, so a missing key fails before any request.
const apiKey = process.env.COURIER_API_KEY;
if (!apiKey) {
  throw new Error("COURIER_API_KEY is not set. Copy .env.example to .env and add your key.");
}

export const courier = new Courier({ apiKey });

export type User = {
  id: string;
  email?: string;
  phone_number?: string;
};

export type Task = {
  id: string;
  title: string;
  url: string;
};

/**
 * Tells a teammate a task is theirs by email, SMS, and in-app inbox, in one send.
 * Call it once per assignment, after the assignment is saved.
 */
export async function notifyTaskAssigned(assignee: User, task: Task, assignmentId: string) {
  // Text only teammates who gave you a phone number. Everyone gets email and inbox.
  const channels = assignee.phone_number ? ["email", "sms", "inbox"] : ["email", "inbox"];

  const { requestId } = await courier.send.message({
    message: {
      // user_id is the inbox the message lands in. It must match the token's user.
      to: { user_id: assignee.id, email: assignee.email, phone_number: assignee.phone_number },
      content: {
        title: `New task: ${task.title}`,
        body: `You're assigned to it. Open it here: ${task.url}`,
      },
      // "all" sends on every listed channel at once. Courier picks the provider inside each one.
      routing: { method: "all", channels },
    },
    // One key per assignment. The SDK retries timeouts and server errors with
    // the same key, and Courier returns the first response instead of resending.
    "Idempotency-Key": `task-assigned-${assignmentId}`,
  });

  return requestId;
}
