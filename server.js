const http = require("http");
const fs = require("fs/promises");
const path = require("path");
const crypto = require("crypto");

const PORT = process.env.PORT || 3000;
const DATA_FILE = process.env.DATA_FILE || path.join(__dirname, "data", "tramites.json");
const PUBLIC_DIR = path.join(__dirname, "public");

const columns = [
  "cantidad",
  "producto",
  "pedido",
  "rastreo",
  "fechaCompra",
  "fechaLlegada",
  "envio",
  "estado"
];

const defaultRows = [
  {
    id: crypto.randomUUID(),
    cantidad: "1",
    producto: "ASUS TUF Gaming B550-PLUS WIFI II AMD AM4",
    pedido: "",
    rastreo: "",
    fechaCompra: "2026-01-26",
    fechaLlegada: "",
    envio: "GERMAN",
    estado: "ENTREGADO"
  },
  {
    id: crypto.randomUUID(),
    cantidad: "1",
    producto: "ASUS TUF Gaming B550-PLUS WIFI II AMD AM4",
    pedido: "",
    rastreo: "",
    fechaCompra: "2026-01-26",
    fechaLlegada: "",
    envio: "GERMAN",
    estado: "ENTREGADO"
  }
];

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml"
};

async function ensureDataFile() {
  await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
  try {
    await fs.access(DATA_FILE);
  } catch {
    await writeRows(defaultRows);
  }
}

async function readRows() {
  await ensureDataFile();
  const raw = await fs.readFile(DATA_FILE, "utf8");
  const rows = JSON.parse(raw);
  return Array.isArray(rows) ? rows : [];
}

async function writeRows(rows) {
  await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
  await fs.writeFile(DATA_FILE, JSON.stringify(rows, null, 2), "utf8");
}

function json(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store"
  });
  res.end(JSON.stringify(payload));
}

function notFound(res) {
  json(res, 404, { error: "No encontrado" });
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        req.destroy();
        reject(new Error("El cuerpo es demasiado grande"));
      }
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error("JSON invalido"));
      }
    });
    req.on("error", reject);
  });
}

function cleanRow(input, existing = {}) {
  const row = { id: existing.id || input.id || crypto.randomUUID() };
  for (const column of columns) {
    row[column] = input[column] === undefined ? existing[column] || "" : String(input[column]);
  }
  return row;
}

async function handleApi(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname === "/api/health") {
    json(res, 200, { ok: true });
    return;
  }

  if (url.pathname === "/api/tramites" && req.method === "GET") {
    json(res, 200, { rows: await readRows() });
    return;
  }

  if (url.pathname === "/api/tramites" && req.method === "POST") {
    const payload = await readBody(req);
    const rows = await readRows();
    const row = cleanRow(payload);
    rows.push(row);
    await writeRows(rows);
    json(res, 201, row);
    return;
  }

  const match = url.pathname.match(/^\/api\/tramites\/([^/]+)$/);
  if (!match) {
    notFound(res);
    return;
  }

  const id = decodeURIComponent(match[1]);
  const rows = await readRows();
  const index = rows.findIndex((row) => row.id === id);

  if (index === -1) {
    notFound(res);
    return;
  }

  if (req.method === "PUT") {
    const payload = await readBody(req);
    rows[index] = cleanRow(payload, rows[index]);
    await writeRows(rows);
    json(res, 200, rows[index]);
    return;
  }

  if (req.method === "DELETE") {
    const [deleted] = rows.splice(index, 1);
    await writeRows(rows);
    json(res, 200, deleted);
    return;
  }

  notFound(res);
}

async function serveStatic(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const requestedPath = url.pathname === "/" ? "/index.html" : url.pathname;
  const safePath = path.normalize(decodeURIComponent(requestedPath)).replace(/^(\.\.[/\\])+/, "");
  const requested = safePath.startsWith("/") || safePath.startsWith("\\") ? safePath : `/${safePath}`;
  const filePath = path.join(PUBLIC_DIR, requested);

  if (!filePath.startsWith(PUBLIC_DIR)) {
    notFound(res);
    return;
  }

  try {
    const content = await fs.readFile(filePath);
    const ext = path.extname(filePath);
    res.writeHead(200, {
      "content-type": mimeTypes[ext] || "application/octet-stream"
    });
    res.end(content);
  } catch {
    notFound(res);
  }
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.url.startsWith("/api/")) {
      await handleApi(req, res);
      return;
    }
    await serveStatic(req, res);
  } catch (error) {
    json(res, 500, { error: error.message || "Error interno" });
  }
});

server.listen(PORT, () => {
  console.log(`ERP Tramite listo en http://localhost:${PORT}`);
});
