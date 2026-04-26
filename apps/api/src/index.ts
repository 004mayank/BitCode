import "dotenv/config";
import express from "express";
import cors from "cors";
import { apiRouter } from "./routes.js";

const app = express();
app.use(express.json({ limit: "2mb" }));

const origin = process.env.CORS_ORIGIN || "http://localhost:3000";
app.use(
  cors({
    origin,
    credentials: true
  })
);

app.get("/health", (_req, res) => res.json({ ok: true }));
app.use("/api", apiRouter);

const port = Number(process.env.PORT || 8000);
app.listen(port, () => {
  console.log(`[bitcode-api] listening on http://localhost:${port}`);
});

