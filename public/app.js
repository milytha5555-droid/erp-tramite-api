const loginView = document.querySelector("#loginView");
const appView = document.querySelector("#appView");
const loginForm = document.querySelector("#loginForm");
const loginStatus = document.querySelector("#loginStatus");
const usernameEl = document.querySelector("#username");
const passwordEl = document.querySelector("#password");
const rowsEl = document.querySelector("#rows");
const template = document.querySelector("#rowTemplate");
const addRowButton = document.querySelector("#addRow");
const deleteSelectedButton = document.querySelector("#deleteSelected");
const logoutButton = document.querySelector("#logout");
const statusEl = document.querySelector("#status");
const userLabel = document.querySelector("#userLabel");
const selectAllEl = document.querySelector("#selectAll");

const fields = ["cantidad", "producto", "pedido", "rastreo", "fechaCompra", "fechaLlegada", "envio", "estado"];
const REFRESH_MS = 10000;

let rows = [];
let saveTimers = new Map();
let refreshTimer = null;
let isLoading = false;
let currentUser = null;
let selectedIds = new Set();

function setStatus(text) {
  statusEl.textContent = text;
}

function showLogin(message = "") {
  clearInterval(refreshTimer);
  appView.hidden = true;
  loginView.hidden = false;
  loginStatus.textContent = message;
  passwordEl.focus();
}

function showApp(user) {
  currentUser = user;
  userLabel.textContent = user?.name || user?.username || "";
  loginView.hidden = true;
  appView.hidden = false;
}

async function api(path, options = {}) {
  const redirectOnUnauthorized = options.redirectOnUnauthorized !== false;
  const fetchOptions = { ...options };
  delete fetchOptions.redirectOnUnauthorized;

  const response = await fetch(path, {
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    ...fetchOptions
  });

  if (response.status === 401 && redirectOnUnauthorized) {
    showLogin("Sesion requerida");
    throw new Error("Sesion requerida");
  }

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

function updateSelectionControls() {
  const count = selectedIds.size;
  deleteSelectedButton.disabled = count === 0;
  deleteSelectedButton.textContent = count > 0 ? `Eliminar (${count})` : "Eliminar";
  selectAllEl.checked = rows.length > 0 && selectedIds.size === rows.length;
  selectAllEl.indeterminate = selectedIds.size > 0 && selectedIds.size < rows.length;
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
  selectedIds = new Set([...selectedIds].filter((id) => rows.some((row) => row.id === id)));

  if (rows.length === 0) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.className = "empty";
    td.colSpan = 9;
    td.textContent = "No hay pedidos registrados.";
    tr.append(td);
    rowsEl.append(tr);
    updateSelectionControls();
    return;
  }

  for (const row of rows) {
    const fragment = template.content.cloneNode(true);
    const tr = fragment.querySelector("tr");
    tr.dataset.id = row.id;

    const checkbox = tr.querySelector(".row-select");
    checkbox.checked = selectedIds.has(row.id);
    checkbox.addEventListener("change", () => {
      if (checkbox.checked) selectedIds.add(row.id);
      else selectedIds.delete(row.id);
      updateSelectionControls();
    });

    for (const field of fields) {
      const input = tr.querySelector(`[data-field="${field}"]`);
      input.value = row[field] || "";
      input.addEventListener("input", () => scheduleSave(tr));
    }

    rowsEl.append(fragment);
  }

  updateSelectionControls();
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
    if (error.message !== "Sesion requerida") setStatus(error.message);
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

async function boot() {
  try {
    const data = await api("/api/me");
    showApp(data.user);
    await loadRows();
    startAutoRefresh();
  } catch {
    showLogin();
  }
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  loginStatus.textContent = "Ingresando...";

  try {
    const data = await api("/api/login", {
      method: "POST",
      redirectOnUnauthorized: false,
      body: JSON.stringify({
        username: usernameEl.value,
        password: passwordEl.value
      })
    });
    showApp(data.user);
    await loadRows();
    startAutoRefresh();
  } catch (error) {
    loginStatus.textContent = error.message;
  }
});

logoutButton.addEventListener("click", async () => {
  await fetch("/api/logout", { method: "POST", credentials: "same-origin" });
  rows = [];
  render();
  showLogin("Sesion cerrada");
});

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

selectAllEl.addEventListener("change", () => {
  selectedIds = selectAllEl.checked ? new Set(rows.map((row) => row.id)) : new Set();
  render();
});

deleteSelectedButton.addEventListener("click", async () => {
  const ids = [...selectedIds];
  if (ids.length === 0) return;
  if (!confirm(`Eliminar ${ids.length} pedido(s) seleccionado(s)?`)) return;

  try {
    setStatus("Eliminando...");
    await Promise.all(ids.map((id) => api(`/api/tramites/${encodeURIComponent(id)}`, { method: "DELETE" })));
    rows = rows.filter((row) => !selectedIds.has(row.id));
    selectedIds.clear();
    render();
    setStatus("Guardado");
  } catch (error) {
    setStatus(error.message);
  }
});

boot();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}
