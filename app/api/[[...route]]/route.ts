import { Hono } from "hono";
import { handle } from "hono/vercel";
import authRouter from "./auth";
import slideGeneratorRouter from "./slide-generator";

const app = new Hono().basePath("/api");

app.route("/auth", authRouter);
app.route("/slide-generator", slideGeneratorRouter);

// https://nextjs.org/docs/app/api-reference/file-conventions/route#reference
export const GET = handle(app);
export const HEAD = handle(app);
export const POST = handle(app);
export const PUT = handle(app);
export const DELETE = handle(app);
export const PATCH = handle(app);
export const OPTIONS = handle(app);
