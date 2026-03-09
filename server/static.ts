import express, { type Express } from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

export function serveStatic(app: Express) {
  const currentDir = typeof __dirname !== 'undefined' ? __dirname : path.dirname(fileURLToPath(import.meta.url));

  const candidates = [
    path.resolve(currentDir, "..", "angular-client", "dist", "angular-client", "browser"),
    path.resolve(process.cwd(), "angular-client", "dist", "angular-client", "browser"),
    path.resolve(currentDir, "public"),
    path.resolve(process.cwd(), "dist", "public"),
  ];

  let distPath = candidates.find(p => fs.existsSync(p));
  if (!distPath) {
    throw new Error(
      `Could not find build directory. Checked: ${candidates.join(', ')}. Build the client first.`,
    );
  }

  app.use(express.static(distPath, {
    etag: false,
    lastModified: false,
    setHeaders: (res) => {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
    }
  }));

  app.use("/{*path}", (_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
