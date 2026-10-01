/* ══════════════════════════════════════════════════
   JARVIS server.js  —  auto-port, CORS, ready-signal
══════════════════════════════════════════════════ */
const http = require("http");
const fs   = require("fs");
const path = require("path");
const { exec } = require("child_process");

const ROOT  = __dirname;
const PORTS = [3000, 3001, 3002, 8080, 8081];

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css":  "text/css",
  ".js":   "application/javascript",
  ".json": "application/json",
  ".png":  "image/png",
  ".jpg":  "image/jpeg",
  ".svg":  "image/svg+xml",
  ".ico":  "image/x-icon",
};

const handler = (req, res) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin":  "*",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    });
    res.end(); return;
  }

  let urlPath = req.url.split("?")[0];
  if (urlPath === "/") urlPath = "/index.html";
  const filePath = path.join(ROOT, urlPath);
  const ext      = path.extname(filePath).toLowerCase();
  const mime     = MIME[ext] || "text/plain";

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("404 Not Found: " + urlPath);
      return;
    }
    res.writeHead(200, {
      "Content-Type": mime,
      "Access-Control-Allow-Origin":  "*",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Cache-Control": "no-cache",
    });
    res.end(data);
  });
};

function tryListen(ports, idx) {
  if (idx >= ports.length) {
    console.error("  [ERROR] All ports blocked:", ports.join(", "));
    console.error("  Try closing other apps and run again.");
    process.exit(1);
  }
  const port   = ports[idx];
  const server = http.createServer(handler);

  server.on("error", (e) => {
    if (e.code === "EADDRINUSE") {
      console.log("  Port " + port + " in use, trying " + ports[idx + 1] + "...");
      tryListen(ports, idx + 1);
    } else {
      console.error("  Server error:", e.message);
      process.exit(1);
    }
  });

  server.listen(port, "0.0.0.0", () => {
    const url = "http://localhost:" + port;
    console.log("");
    console.log("  ==========================================");
    console.log("   JARVIS is READY");
    console.log("  ==========================================");
    console.log("");
    console.log("  Open this URL in Chrome or Edge:");
    console.log("  " + url);
    console.log("");
    console.log("  Keep this window open while using JARVIS.");
    console.log("  Press Ctrl+C to stop.");
    console.log("");

    // Auto-open browser (Windows)
    exec('start "" "' + url + '"', (err) => {
      if (err) {
        // fallback: try rundll32
        exec("rundll32 url.dll,FileProtocolHandler " + url);
      }
    });
  });
}

tryListen(PORTS, 0);
