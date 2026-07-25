import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import { clerkMiddleware } from "@clerk/express";
import { publishableKeyFromHost } from "@clerk/shared/keys";
import { randomUUID } from "node:crypto";
import router from "./routes";
import { logger } from "./lib/logger";
import {
  CLERK_PROXY_PATH,
  clerkProxyMiddleware,
  getClerkProxyHost,
} from "./middlewares/clerkProxyMiddleware";
import { gameEngine } from "./lib/gameEngine";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());
app.use(cors({ credentials: true, origin: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Game stream (SSE) — mounted BEFORE Clerk middleware ───────────────────────
// The game is visible to everyone; no auth is needed for the stream.
// Placing it here prevents Clerk from intercepting and 500-ing when
// CLERK_SECRET_KEY is absent or when a user is not signed in.
app.get("/api/game/stream", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Connection", "keep-alive");
  // Tell reverse proxies (Nginx/Apache) not to buffer this response.
  // For Apache, also add `flushpackets=on` to the ProxyPass directive
  // in scripts/apache-vhost.conf (already updated).
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  const clientId = randomUUID();
  const unsubscribe = gameEngine.subscribe(clientId, res);
  req.on("close", unsubscribe);
});

app.use(
  clerkMiddleware((req) => ({
    publishableKey: publishableKeyFromHost(
      getClerkProxyHost(req) ?? "",
      process.env.CLERK_PUBLISHABLE_KEY,
    ),
  })),
);

app.use("/api", router);

export default app;
