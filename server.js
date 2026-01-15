// Minimal Node server to serve the HKU Biz Undergrad Simulator
// and expose the DeepSeek-backed /api-professor endpoint.
//
// Usage:
//   (in env file) DEEPSEEK_API_KEY="your-key" node server.js
//
// Then open: http://localhost:3000
import "dotenv/config";
import http from "http";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import handler from "./api-professor.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3000;

function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case ".html":
      return "text/html; charset=utf-8";
    case ".css":
      return "text/css; charset=utf-8";
    case ".js":
      return "application/javascript; charset=utf-8";
    case ".json":
      return "application/json; charset=utf-8";
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".svg":
      return "image/svg+xml";
    default:
      return "application/octet-stream";
  }
}

function serveStatic(req, res) {
  let urlPath = req.url;
  if (urlPath === "/") {
    urlPath = "/index.html";
  }

  const safePath = path.normalize(urlPath).replace(/^(\.\.[/\\])+/, "");
  const filePath = path.join(__dirname, safePath);

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.statusCode = 404;
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.end("404 Not Found");
      return;
    }
    res.statusCode = 200;
    res.setHeader("Content-Type", getMimeType(filePath));
    res.end(data);
  });
}

const server = http.createServer((req, res) => {
  if (req.url === "/api-professor" && req.method === "POST") {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk.toString();
      // safety limit ~1MB
      if (body.length > 1_000_000) {
        req.destroy();
      }
    });
    req.on("end", () => {
      try {
        req.body = body ? JSON.parse(body) : {};
      } catch (e) {
        res.statusCode = 400;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ error: "Invalid JSON body" }));
        return;
      }
      handler(req, res);
    });
  } else {
    serveStatic(req, res);
  }
});

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});

