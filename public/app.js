const rowsEl = document.querySelector("#rows");
const template = document.querySelector("#rowTemplate");
const addRowButton = document.querySelector("#addRow");
const statusEl = document.querySelector("#status");

const fields = [
  "cantidad",
  "producto",
  "pedido",
  "rastreo",
  "fechaCompra",
  "fechaLlegada",
  "envio",
  "estado"
];

let rows = [];
let saveTimers = new Map();
let refreshTimer = null;
let isLoading = false;

const REFRESH_MS = 10000;

function setStatus(text) {
  statusEl.textContent = text;
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: { "content-type": "application/json" },
    ...options
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Error de servidor" }));
    throw new Error(error.error || "Error de servidor");
  }

  return response.json();
}

function readRowFromTr(tr) {
  const row = { id: tr.dataset.id };
  for (const field of fields) {
    row[field] = tr.querySelector(`[data-field="${field}"]`).value;
  }
  return row;
}

function scheduleSave(tr) {
  const id = tr.dataset.id;
  clearTimeout(saveTimers.get(id));
  setStatus("Guardando...");
  saveTimers.set(
    id,
    setTimeout(async () => {
      try {
        const updated = await api(`/api/tramites/${encodeURIComponent(id)}`, {
          method: "PUT",
          body: JSON.stringify(readRowFromTr(tr))
        });
        rows = rows.map((row) => (row.id === id ? updated : row));
        setStatus("Guardado");
      } catch (error) {
        setStatus(error.message);
      }
    }, 350)
  );
}

function render() {
  rowsEl.innerHTML = "";

  if (rows.length === 0) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.className = "empty";
    td.colSpan = 9;
    td.textContent = "No hay trámites registrados.";
    tr.append(td);
    rowsEl.append(tr);
    return;
  }

  for (const row of rows) {
    const fragment = template.content.cloneNode(true);
    const tr = fragment.querySelector("tr");
    tr.dataset.id = row.id;

    for (const field of fields) {
      const input = tr.querySelector(`[data-field="${field}"]`);
      input.value = row[field] || "";
      input.addEventListener("input", () => scheduleSave(tr));
    }

    tr.querySelector(".delete").addEventListener("click", async () => {
      if (!confirm("Eliminar esta fila de trámite?")) return;
      try {
        setStatus("Eliminando...");
        await api(`/api/tramites/${encodeURIComponent(row.id)}`, { method: "DELETE" });
        rows = rows.filter((item) => item.id !== row.id);
        render();
        setStatus("Guardado");
      } catch (error) {
        setStatus(error.message);
      }
    });

    rowsEl.append(fragment);
  }
}

function hasActiveEdit() {
  return document.activeElement && document.activeElement.matches("input[data-field]");
}

async function loadRows({ silent = false } = {}) {
  if (isLoading) return;
  isLoading = true;

  try {
    if (!silent) setStatus("Cargando...");
    const data = await api("/api/tramites");
    rows = data.rows || [];
    render();
    setStatus(silent ? "Actualizado" : "Guardado");
  } catch (error) {
    setStatus(error.message);
  } finally {
    isLoading = false;
  }
}

function startAutoRefresh() {
  clearInterval(refreshTimer);
  refreshTimer = setInterval(() => {
    if (hasActiveEdit()) return;
    loadRows({ silent: true });
  }, REFRESH_MS);
}

addRowButton.addEventListener("click", async () => {
  const row = {
    cantidad: "1",
    producto: "",
    pedido: "",
    rastreo: "",
    fechaCompra: "",
    fechaLlegada: "",
    envio: "",
    estado: ""
  };

  try {
    setStatus("Agregando...");
    const created = await api("/api/tramites", {
      method: "POST",
      body: JSON.stringify(row)
    });
    rows.push(created);
    render();
    setStatus("Guardado");
  } catch (error) {
    setStatus(error.message);
  }
});

loadRows();
startAutoRefresh();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}
