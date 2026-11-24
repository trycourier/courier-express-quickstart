import Courier from "@trycourier/courier";

// Fail at startup, not mid-request, when the key is missing.
const apiKey = process.env.COURIER_API_KEY;
if (!apiKey) {
  throw new Error("COURIER_API_KEY is not set. Add it to .env.");
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

// Call once per assignment, after it's saved.
export async function notifyTaskAssigned(assignee: User, task: Task, assignmentId: string) {
  // Text only teammates with a phone number.
  const channels = assignee.phone_number ? ["email", "sms", "inbox"] : ["email", "inbox"];

  const { requestId } = await courier.send.message(
    {
      message: {
        // user_id picks the inbox, so it must match the token's user.
        to: { user_id: assignee.id, email: assignee.email, phone_number: assignee.phone_number },
        content: {
          title: `New task: ${task.title}`,
          body: `You're assigned to it. Open it here: ${task.url}`,
        },
        // "all" sends on every listed channel, not just the first that works.
        routing: { method: "all", channels },
      },
      // One key per assignment, so a retry sends at most once.
      "Idempotency-Key": `task-assigned-${assignmentId}`,
    },
    // Fail fast: SDK retries would wait out Retry-After inside the request.
    { maxRetries: 0 },
  );

  return requestId;
}
