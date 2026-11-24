/**
 * Assigns a demo task to user_123 (the demo user pinned in server.ts) through
 * the running server, which sends the email, SMS, and in-app message.
 *
 * Start the server first: `npm run dev`.
 */
const baseUrl = `http://localhost:${process.env.PORT ?? 3000}`;

async function main() {
  if (!process.env.COURIER_API_KEY) {
    console.error("COURIER_API_KEY is not set. Add it to .env, then restart the server.");
    process.exit(1);
  }

  const demoEmail = process.env.DEMO_EMAIL;
  if (!demoEmail || demoEmail === "YOUR_EMAIL") {
    console.error("DEMO_EMAIL is not set. Put your own email address in .env, then restart the server.");
    process.exit(1);
  }

  let response: Response;
  try {
    response = await fetch(`${baseUrl}/tasks/task_1/assign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assignee_id: "user_123" }),
    });
  } catch {
    console.error(`No server at ${baseUrl}. Start it with \`npm run dev\` in another terminal.`);
    process.exit(1);
  }

  const result = await response.json();
  if (!response.ok || !result.requestId) {
    console.error(`POST /tasks/task_1/assign returned ${response.status}: ${result.error}`);
    process.exit(1);
  }

  console.log(`Sent. Request id: ${result.requestId}`);
  console.log(
    process.env.DEMO_PHONE
      ? `Email to ${demoEmail}, a text to ${process.env.DEMO_PHONE}, and an inbox message.`
      : `Email to ${demoEmail} and an inbox message. Set DEMO_PHONE to add SMS.`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
