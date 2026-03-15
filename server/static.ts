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
    etag: true,
    lastModified: true,
    maxAge: 0,
    setHeaders: (res, filePath) => {
      const ext = path.extname(filePath).toLowerCase();
      if (filePath.endsWith('index.html') || ext === '.html') {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
      } else if (/[-\.][A-Za-z0-9_-]{8,}\.(js|css|woff2?|ttf|eot|svg|png|jpg|webp|avif|ico)$/i.test(path.basename(filePath))) {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      } else if (['.js', '.css', '.woff2', '.woff', '.ttf', '.eot'].includes(ext)) {
        res.setHeader('Cache-Control', 'public, max-age=86400');
      } else if (['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.avif', '.ico'].includes(ext)) {
        res.setHeader('Cache-Control', 'public, max-age=604800');
      }
    }
  }));

  app.use("/{*path}", (_req, res) => {
    res.set({
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
    });
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
