import { Hono } from "hono";
import { auth } from "@/lib/auth"; // path to your auth file

const app = new Hono();

app.on(["POST", "GET"], "/*", (c) => auth.handler(c.req.raw));

export default app;
