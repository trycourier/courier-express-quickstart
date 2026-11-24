import Courier from "@trycourier/courier";

const email = process.env.DEMO_EMAIL;
if (!email) throw new Error("Set DEMO_EMAIL to your own email address.");
const client = new Courier(); // Reads COURIER_API_KEY from the environment.

const { requestId } = await client.send.message({
  message: {
    to: { email },
    routing: { method: "single", channels: ["email"] },
    content: { title: "Hello from Express", body: "Your Express app can send notifications." },
  },
});

console.log(`Sent. Request id: ${requestId}`);
