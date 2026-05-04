const loginView = document.querySelector("#loginView");
const appView = document.querySelector("#appView");
const loginForm = document.querySelector("#loginForm");
const loginStatus = document.querySelector("#loginStatus");
const usernameEl = document.querySelector("#username");
const passwordEl = document.querySelector("#password");
const rowsEl = document.querySelector("#rows");
const template = document.querySelector("#rowTemplate");
const restoreBackupButton = document.querySelector("#restoreBackup");
const editProductsButton = document.querySelector("#editProducts");
const editStatusesButton = document.querySelector("#editStatuses");
const addRowButton = document.querySelector("#addRow");
const deleteSelectedButton = document.querySelector("#deleteSelected");
const logoutButton = document.querySelector("#logout");
const statusEl = document.querySelector("#status");
const userLabel = document.querySelector("#userLabel");
const selectAllEl = document.querySelector("#selectAll");

const fields = ["cantidad", "producto", "pedido", "rastreo", "fechaCompra", "fechaLlegada", "envio", "estado"];
const REFRESH_MS = 10000;
const BACKUP_KEY = "erp-gf-amazon-pedidos-backup-v1";

let rows = [];
let saveTimers = new Map();
let refreshTimer = null;
let isLoading = false;
let currentUser = null;
let selectedIds = new Set();
let productsEditable = false;
let statusesEditable = false;
let usingLocalBackup = false;

function setStatus(text) {
  statusEl.textContent = text;
}

function getLocalBackupInfo() {
  try {
    const backup = JSON.parse(localStorage.getItem(BACKUP_KEY) || "[]");
    if (Array.isArray(backup)) return { rows: backup, savedAt: "" };
    if (backup && Array.isArray(backup.rows)) return { rows: backup.rows, savedAt: backup.savedAt || "" };
    return { rows: [], savedAt: "" };
  } catch {
    return { rows: [], savedAt: "" };
  }
}

function getLocalBackup() {
  return getLocalBackupInfo().rows;
}

function saveLocalBackup(nextRows) {
  if (!Array.isArray(nextRows)) return;
  localStorage.setItem(
    BACKUP_KEY,
    JSON.stringify({
      rows: nextRows,
      savedAt: new Date().toISOString()
    })
  );
  updateBackupControls();
}

function updateBackupControls() {
  const backup = getLocalBackupInfo();
  restoreBackupButton.hidden = backup.rows.length === 0 || backup.rows.length <= rows.length;
  restoreBackupButton.textContent =
    backup.rows.length > 0 ? `Restaurar respaldo (${backup.rows.length})` : "Restaurar respaldo";
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
  updateBackupControls();
}

function updateProductEditMode() {
  editProductsButton.textContent = productsEditable ? "Bloquear productos" : "Editar productos";
  document.querySelectorAll('[data-field="producto"]').forEach((input) => {
    input.readOnly = !productsEditable;
    input.title = productsEditable ? "Producto editable" : "Producto bloqueado";
    input.closest("td")?.classList.toggle("locked-cell", !productsEditable);
  });
}

function normalizeStatus(value) {
  const normalized = String(value || "").trim().toUpperCase();
  const aliases = {
    ENTREGADO: "ENTREGADO",
    ENTREGADA: "ENTREGADO",
    CANCELADO: "CANCELADO",
    CANCELADA: "CANCELADO",
    RECHAZADO: "RECHAZADO",
    RECHAZADA: "RECHAZADO",
    "EN CAMINO": "EN CAMINO",
    CAMINO: "EN CAMINO",
    PENDIENTE: "EN CAMINO"
  };
  return aliases[normalized] || normalized;
}

function applyStatusStyle(select) {
  const status = normalizeStatus(select.value);
  select.value = status;
  select.closest("td")?.classList.remove("status-entregado", "status-cancelado", "status-rechazado", "status-camino");
  if (status === "ENTREGADO") select.closest("td")?.classList.add("status-entregado");
  if (status === "CANCELADO") select.closest("td")?.classList.add("status-cancelado");
  if (status === "RECHAZADO") select.closest("td")?.classList.add("status-rechazado");
  if (status === "EN CAMINO") select.closest("td")?.classList.add("status-camino");
}

function updateStatusEditMode() {
  editStatusesButton.textContent = statusesEditable ? "Bloquear estados" : "Editar estados";
  document.querySelectorAll('[data-field="estado"]').forEach((select) => {
    select.disabled = !statusesEditable;
    select.title = statusesEditable ? "Estado editable" : "Estado bloqueado";
    select.closest("td")?.classList.toggle("locked-cell", !statusesEditable);
    applyStatusStyle(select);
  });
}

function scheduleSave(tr) {
  const id = tr.dataset.id;
  const draft = readRowFromTr(tr);
  rows = rows.map((row) => (row.id === id ? draft : row));
  saveLocalBackup(rows);
  clearTimeout(saveTimers.get(id));
  setStatus("Guardando...");
  saveTimers.set(
    id,
    setTimeout(async () => {
      try {
        const updated = await api(`/api/tramites/${encodeURIComponent(id)}`, {
          method: "PUT",
          body: JSON.stringify(draft)
        });
        rows = rows.map((row) => (row.id === id ? updated : row));
        saveLocalBackup(rows);
        setStatus("Guardado");
      } catch (error) {
        setStatus(error.message);
      }
    }, 350)
  );
}

function normalizePastedDate(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;

  const slash = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (slash) {
    const month = slash[1].padStart(2, "0");
    const day = slash[2].padStart(2, "0");
    const year = slash[3].length === 2 ? `20${slash[3]}` : slash[3];
    return `${year}-${month}-${day}`;
  }

  const months = {
    ene: "01",
    enero: "01",
    feb: "02",
    febrero: "02",
    mar: "03",
    marzo: "03",
    abr: "04",
    abril: "04",
    may: "05",
    mayo: "05",
    jun: "06",
    junio: "06",
    jul: "07",
    julio: "07",
    ago: "08",
    agosto: "08",
    sep: "09",
    septiembre: "09",
    oct: "10",
    octubre: "10",
    nov: "11",
    noviembre: "11",
    dic: "12",
    diciembre: "12"
  };
  const textDate = raw.toLowerCase().match(/^(\d{1,2})\s*(?:de)?\s*([a-záéíóúñ]+)(?:\s*(?:de)?\s*(\d{2,4}))?$/i);
  if (textDate) {
    const day = textDate[1].padStart(2, "0");
    const monthKey = textDate[2].normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const month = months[monthKey];
    const year = textDate[3] ? (textDate[3].length === 2 ? `20${textDate[3]}` : textDate[3]) : String(new Date().getFullYear());
    if (month) return `${year}-${month}-${day}`;
  }

  return raw;
}

function normalizePastedValue(field, value) {
  if (field === "fechaCompra" || field === "fechaLlegada") return normalizePastedDate(value);
  if (field === "estado") return normalizeStatus(value);
  return String(value || "").trim();
}

async function createBlankRow() {
  const created = await api("/api/tramites", {
    method: "POST",
    body: JSON.stringify({
      cantidad: "1",
      producto: "",
      pedido: "",
      rastreo: "",
      fechaCompra: "",
      fechaLlegada: "",
      envio: "",
      estado: ""
    })
  });
  rows.push(created);
  return created;
}

async function handleExcelPaste(event, tr, field) {
  const text = event.clipboardData?.getData("text");
  if (!text || (!text.includes("\t") && !text.includes("\n"))) return;

  event.preventDefault();
  setStatus("Pegando...");

  const startRow = rows.findIndex((row) => row.id === tr.dataset.id);
  const startField = fields.indexOf(field);
  const pastedRows = text.replace(/\r/g, "").split("\n").filter((line) => line.length > 0);

  try {
    while (rows.length < startRow + pastedRows.length) {
      await createBlankRow();
    }

    for (let rowOffset = 0; rowOffset < pastedRows.length; rowOffset += 1) {
      const rowIndex = startRow + rowOffset;
      const values = pastedRows[rowOffset].split("\t");
      const nextRow = { ...rows[rowIndex] };

      values.forEach((value, colOffset) => {
        const nextField = fields[startField + colOffset];
        if (!nextField) return;
        if (nextField === "producto" && !productsEditable) return;
        if (nextField === "estado" && !statusesEditable) return;
        nextRow[nextField] = normalizePastedValue(nextField, value);
      });

      rows[rowIndex] = await api(`/api/tramites/${encodeURIComponent(nextRow.id)}`, {
        method: "PUT",
        body: JSON.stringify(nextRow)
      });
    }

    saveLocalBackup(rows);
    render();
    setStatus("Pegado");
  } catch (error) {
    setStatus(error.message);
  }
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
      input.value = field === "estado" ? normalizeStatus(row[field]) : row[field] || "";
      const saveEvent = input.tagName === "SELECT" ? "change" : "input";
      input.addEventListener(saveEvent, () => {
        if (field === "estado") applyStatusStyle(input);
        scheduleSave(tr);
      });
      input.addEventListener("paste", (event) => handleExcelPaste(event, tr, field));
      if (field === "estado") applyStatusStyle(input);
    }

    rowsEl.append(fragment);
  }

  updateSelectionControls();
  updateProductEditMode();
  updateStatusEditMode();
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
    const backup = getLocalBackup();
    rows = data.rows || [];
    usingLocalBackup = false;
    render();
    if (rows.length > 0 && rows.length >= backup.length) {
      saveLocalBackup(rows);
    } else {
      updateBackupControls();
    }
    setStatus(backup.length > rows.length ? "Servidor con menos datos" : silent ? "Actualizado" : "Guardado");
  } catch (error) {
    if (error.message !== "Sesion requerida") {
      const backup = getLocalBackup();
      if (backup.length > 0) {
        rows = backup;
        usingLocalBackup = true;
        render();
        setStatus("Respaldo local");
      } else {
        setStatus(error.message);
      }
    }
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
    saveLocalBackup(rows);
    render();
    setStatus("Guardado");
  } catch (error) {
    setStatus(error.message);
  }
});

editProductsButton.addEventListener("click", () => {
  productsEditable = !productsEditable;
  updateProductEditMode();
});

editStatusesButton.addEventListener("click", () => {
  statusesEditable = !statusesEditable;
  updateStatusEditMode();
});

selectAllEl.addEventListener("change", () => {
  selectedIds = selectAllEl.checked ? new Set(rows.map((row) => row.id)) : new Set();
  render();
});

restoreBackupButton.addEventListener("click", async () => {
  const backup = getLocalBackup();
  if (backup.length === 0) return;
  if (!confirm(`Restaurar ${backup.length} pedido(s) desde la tablet?`)) return;

  try {
    setStatus("Restaurando...");
    const restored = await api("/api/tramites/restore", {
      method: "POST",
      body: JSON.stringify({ rows: backup })
    });
    rows = restored.rows || [];
    usingLocalBackup = false;
    selectedIds.clear();
    saveLocalBackup(rows);
    render();
    setStatus("Respaldo restaurado");
  } catch (error) {
    setStatus(error.message);
  }
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
    saveLocalBackup(rows);
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
