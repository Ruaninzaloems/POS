import express, { type Express } from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const BUILD_VERSION = Date.now().toString(36);

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

  let indexHtml = fs.readFileSync(path.resolve(distPath, "index.html"), "utf-8");
  indexHtml = indexHtml
    .replace(/src="main\.js"/g, `src="main.js?v=${BUILD_VERSION}"`)
    .replace(/href="styles\.css"/g, `href="styles.css?v=${BUILD_VERSION}"`)
    .replace(/src="polyfills\.js"/g, `src="polyfills.js?v=${BUILD_VERSION}"`);

  const sendIndex = (_req: any, res: any) => {
    res.set({
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Content-Type': 'text/html; charset=utf-8',
    });
    res.send(indexHtml);
  };

  app.get("/", sendIndex);

  app.use(express.static(distPath, {
    etag: true,
    lastModified: true,
    maxAge: 0,
    index: false,
    setHeaders: (res, filePath) => {
      const ext = path.extname(filePath).toLowerCase();
      const basename = path.basename(filePath);
      if (filePath.endsWith('index.html') || ext === '.html') {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
      } else if (basename === 'main.js' || basename === 'styles.css' || basename === 'polyfills.js') {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
      } else if (/[-\.][A-Za-z0-9_-]{8,}\.(js|css|woff2?|ttf|eot|svg|png|jpg|webp|avif|ico)$/i.test(basename)) {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      } else if (['.js', '.css'].includes(ext)) {
        res.setHeader('Cache-Control', 'no-cache, must-revalidate');
      } else if (['.woff2', '.woff', '.ttf', '.eot'].includes(ext)) {
        res.setHeader('Cache-Control', 'public, max-age=604800');
      } else if (['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.avif', '.ico'].includes(ext)) {
        res.setHeader('Cache-Control', 'public, max-age=604800');
      }
    }
  }));

  app.use("/{*path}", sendIndex);
}
