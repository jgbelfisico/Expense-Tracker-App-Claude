// ============================================================
// Estado global
// ============================================================

const AppState = {
  movements: [],
  filter:    "all",  // "all" | "income" | "expense"
  editingId: null,   // id del movimiento en edición, o null
};

// ============================================================
// Constantes
// ============================================================

const STORAGE_KEY = "expense_tracker_movements";

// Categorías separadas por tipo — el select se llena desde aquí
const CATEGORIES = {
  income:  ["Salario", "Freelance", "Inversión", "Regalo", "Otro ingreso"],
  expense: ["Alimentación", "Transporte", "Vivienda", "Salud",
            "Entretenimiento", "Educación", "Ropa", "Otro gasto"],
};

// ============================================================
// localStorage
// ============================================================

function saveToStorage() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(AppState.movements));
}

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (error) {
    console.error("Error al leer localStorage:", error);
    return [];
  }
}

// ============================================================
// Utilidades
// ============================================================

function generateId() {
  return Date.now().toString();
}

// "2026-03-30" → "30 mar 2026"
function formatDate(isoDate) {
  const [year, month, day] = isoDate.split("-");
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" });
}

// 1234.5 → "$1,234.50"
function formatAmount(amount) {
  return amount.toLocaleString("es-ES", { style: "currency", currency: "USD" });
}

// "2026-03" → "marzo de 2026"
function formatMonthLabel(yearMonth) {
  const [year, month] = yearMonth.split("-");
  const date = new Date(year, month - 1, 1);
  return date.toLocaleDateString("es-ES", { month: "long", year: "numeric" });
}

// ============================================================
// Validación
// ============================================================

function validate(type, category, amount, date) {
  if (!type)     return "Selecciona un tipo (ingreso o gasto).";
  if (!category) return "Selecciona una categoría.";
  if (!amount || isNaN(amount) || Number(amount) <= 0)
                 return "Ingresa un monto válido mayor a cero.";
  if (!date)     return "Selecciona una fecha.";
  return null;
}

function showError(message) {
  const el = document.getElementById("form-error");
  el.textContent = message;
  el.classList.remove("hidden");
}

function hideError() {
  const el = document.getElementById("form-error");
  el.textContent = "";
  el.classList.add("hidden");
}

// ============================================================
// Cálculos
// ============================================================

// Recorre cualquier array de movimientos y devuelve income, expenses y balance.
// Se usa tanto para el resumen global como para los totales por mes.
function summarize(movements) {
  let income = 0, expenses = 0;

  movements.forEach(function(m) {
    if (m.type === "income") income   += m.amount;
    else                     expenses += m.amount;
  });

  return { income, expenses, balance: income - expenses };
}

// ============================================================
// Render: resumen
// ============================================================

function renderSummary({ income, expenses, balance }) {
  document.getElementById("total-balance").textContent  = formatAmount(balance);
  document.getElementById("total-income").textContent   = formatAmount(income);
  document.getElementById("total-expenses").textContent = formatAmount(expenses);

  document.querySelector(".card--balance").classList.toggle("negative", balance < 0);
}

// ============================================================
// Render: gráfica
// ============================================================

function renderChart({ income, expenses }) {
  const canvas = document.getElementById("chart");
  const ctx    = canvas.getContext("2d");

  // Ajustar el tamaño interno del canvas a su tamaño visual real
  canvas.width  = canvas.clientWidth;
  canvas.height = canvas.clientHeight;

  const W = canvas.width;
  const H = canvas.height;

  const totalIncome   = income;
  const totalExpenses = expenses;

  ctx.clearRect(0, 0, W, H);

  // Altura máxima disponible para las barras (dejamos espacio arriba y abajo)
  const maxBarH = H - 56;
  const baseY   = H - 28;
  const max     = Math.max(totalIncome, totalExpenses, 1); // evitar división por cero

  const barW  = Math.floor(W * 0.22);
  const gap   = Math.floor(W * 0.12);
  const leftX = Math.floor((W - 2 * barW - gap) / 2);
  const rightX = leftX + barW + gap;

  // Barra de ingresos
  const incomeH = Math.floor((totalIncome  / max) * maxBarH);
  ctx.fillStyle = "#2dc653";
  ctx.fillRect(leftX,  baseY - incomeH,  barW, incomeH);

  // Barra de gastos
  const expenseH = Math.floor((totalExpenses / max) * maxBarH);
  ctx.fillStyle  = "#e63946";
  ctx.fillRect(rightX, baseY - expenseH, barW, expenseH);

  ctx.textAlign = "center";

  // Monto sobre cada barra
  ctx.font = "bold 12px system-ui";
  ctx.fillStyle = "#2dc653";
  ctx.fillText(formatAmount(totalIncome),   leftX  + barW / 2, baseY - incomeH  - 8);
  ctx.fillStyle = "#e63946";
  ctx.fillText(formatAmount(totalExpenses), rightX + barW / 2, baseY - expenseH - 8);

  // Etiquetas debajo de cada barra
  ctx.font      = "13px system-ui";
  ctx.fillStyle = "#2dc653";
  ctx.fillText("Ingresos", leftX  + barW / 2, H - 8);
  ctx.fillStyle = "#e63946";
  ctx.fillText("Gastos",   rightX + barW / 2, H - 8);
}

// ============================================================
// Render: opciones de categoría (según tipo seleccionado)
// ============================================================

function renderCategoryOptions(type) {
  const select = document.getElementById("category");

  // Reconstruir desde cero con las categorías del tipo elegido
  select.innerHTML = '<option value="" disabled selected>Selecciona una categoría</option>';

  CATEGORIES[type].forEach(function(cat) {
    const option       = document.createElement("option");
    option.value       = cat;
    option.textContent = cat;
    select.appendChild(option);
  });
}

// ============================================================
// Render: filtros
// ============================================================

function renderFilters() {
  document.querySelectorAll(".btn--filter").forEach(function(btn) {
    btn.classList.toggle("active", btn.dataset.filter === AppState.filter);
  });
}

// ============================================================
// Render: lista de movimientos agrupada por mes
// ============================================================

function renderMovementList() {
  const list     = document.getElementById("movements-list");
  const emptyMsg = document.getElementById("empty-state");

  list.innerHTML = "";

  // Aplicar filtro de tipo
  const visible = AppState.movements.filter(function(m) {
    return AppState.filter === "all" || m.type === AppState.filter;
  });

  if (visible.length === 0) {
    emptyMsg.textContent = AppState.movements.length === 0
      ? "No hay movimientos registrados todavía."
      : "No hay movimientos de este tipo.";
    emptyMsg.classList.remove("hidden");
    return;
  }

  emptyMsg.classList.add("hidden");

  // Ordenar de más reciente a más antiguo por fecha
  const sorted = [...visible].sort(function(a, b) {
    return b.date.localeCompare(a.date);
  });

  // Agrupar en un Map: "YYYY-MM" → [movimientos]
  // Map preserva el orden de inserción, así los meses quedan ordenados
  const groups = new Map();
  sorted.forEach(function(m) {
    const key = m.date.substring(0, 7);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(m);
  });

  // Pintar un encabezado de mes y luego sus movimientos
  groups.forEach(function(monthMovements, monthKey) {
    const { income, expenses } = summarize(monthMovements);

    // Encabezado del mes con sus totales
    const header = document.createElement("li");
    header.className = "month-group";
    header.innerHTML =
      '<span class="month-group__label">'  + formatMonthLabel(monthKey) + '</span>' +
      '<span class="month-group__totals">' +
        '<span class="month-group__income">+'  + formatAmount(income)   + '</span>' +
        '<span class="month-group__expense">−' + formatAmount(expenses) + '</span>' +
      '</span>';
    list.appendChild(header);

    // Movimientos de ese mes
    monthMovements.forEach(function(movement) {
      const sign = movement.type === "income" ? "+" : "−";

      const li = document.createElement("li");
      li.className = "movement movement--" + movement.type;

      // Resaltar el movimiento que se está editando
      if (AppState.editingId === movement.id) {
        li.classList.add("movement--editing");
      }

      li.innerHTML =
        '<div class="movement__info">' +
          '<span class="movement__category">' + movement.category         + '</span>' +
          '<span class="movement__date">'     + formatDate(movement.date) + '</span>' +
          (movement.description
            ? '<span class="movement__description">' + movement.description + '</span>'
            : '') +
        '</div>' +
        '<div class="movement__right">' +
          '<span class="movement__amount">' + sign + formatAmount(movement.amount) + '</span>' +
          '<button class="btn btn--edit"   data-id="' + movement.id + '" title="Editar">✎</button>' +
          '<button class="btn btn--delete" data-id="' + movement.id + '" title="Eliminar">✕</button>' +
        '</div>';

      list.appendChild(li);
    });
  });
}

// ============================================================
// Mutaciones del array
// ============================================================

// Punto único de re-render y persistencia tras cualquier cambio en el array
function afterMutation() {
  const totals = summarize(AppState.movements);
  renderMovementList();
  renderSummary(totals);
  renderChart(totals);
  saveToStorage();
}

function addMovement(type, category, amount, date, description) {
  AppState.movements.push({
    id:          generateId(),
    type:        type,
    category:    category,
    amount:      Number(amount),
    date:        date,
    description: description,
  });

  afterMutation();
}

function deleteMovement(id) {
  AppState.movements = AppState.movements.filter(function(m) { return m.id !== id; });
  afterMutation();
}

function saveEdit(type, category, amount, date, description) {
  const index = AppState.movements.findIndex(function(m) {
    return m.id === AppState.editingId;
  });

  if (index !== -1) {
    AppState.movements[index] = {
      id:          AppState.editingId,
      type:        type,
      category:    category,
      amount:      Number(amount),
      date:        date,
      description: description,
    };
  }

  AppState.editingId = null;
  afterMutation();
}

// ============================================================
// Modo edición
// ============================================================

function startEdit(id) {
  const movement = AppState.movements.find(function(m) { return m.id === id; });
  if (!movement) return;

  AppState.editingId = id;

  // Poblar el formulario con los datos del movimiento
  const form = document.getElementById("movement-form");
  form.querySelector('input[name="type"][value="' + movement.type + '"]').checked = true;
  renderCategoryOptions(movement.type);                      // opciones del tipo correcto
  document.getElementById("category").value    = movement.category;
  document.getElementById("amount").value      = movement.amount;
  document.getElementById("date").value        = movement.date;
  document.getElementById("description").value = movement.description;

  // Cambiar el formulario a modo edición
  document.querySelector(".form-section h2").textContent = "Editar movimiento";
  document.getElementById("submit-btn").textContent      = "Guardar cambios";
  document.getElementById("cancel-btn").classList.remove("hidden");

  // Resaltar la fila y desplazar el formulario a la vista
  renderMovementList();
  document.querySelector(".form-section").scrollIntoView({ behavior: "smooth" });
}

function cancelEdit() {
  AppState.editingId = null;
  hideError();
  resetForm();
  renderMovementList();
}

// Vuelve el formulario a su estado inicial de "agregar"
function resetForm() {
  document.getElementById("movement-form").reset();
  renderCategoryOptions("income");
  document.querySelector(".form-section h2").textContent = "Agregar movimiento";
  document.getElementById("submit-btn").textContent      = "Agregar movimiento";
  document.getElementById("cancel-btn").classList.add("hidden");
}

// ============================================================
// Manejador del formulario
// ============================================================

function handleFormSubmit(event) {
  event.preventDefault();

  const form        = event.target;
  const type        = form.querySelector('input[name="type"]:checked')?.value;
  const category    = form.querySelector('#category').value;
  const amount      = form.querySelector('#amount').value;
  const date        = form.querySelector('#date').value;
  const description = form.querySelector('#description').value.trim();

  const error = validate(type, category, amount, date);
  if (error) { showError(error); return; }

  hideError();

  if (AppState.editingId) {
    saveEdit(type, category, amount, date, description);
  } else {
    addMovement(type, category, amount, date, description);
  }

  resetForm();
}

// ============================================================
// Inicialización
// ============================================================

function init() {
  // Formulario
  document.getElementById("movement-form")
    .addEventListener("submit", handleFormSubmit);

  // Actualizar categorías cuando cambia el tipo (ingreso/gasto)
  document.querySelectorAll('input[name="type"]').forEach(function(radio) {
    radio.addEventListener("change", function() {
      renderCategoryOptions(this.value);
    });
  });

  // Cancelar edición
  document.getElementById("cancel-btn")
    .addEventListener("click", cancelEdit);

  // Editar y eliminar movimientos (un listener para ambos)
  document.getElementById("movements-list").addEventListener("click", function(event) {
    const deleteBtn = event.target.closest(".btn--delete");
    if (deleteBtn) { deleteMovement(deleteBtn.dataset.id); return; }

    const editBtn = event.target.closest(".btn--edit");
    if (editBtn) { startEdit(editBtn.dataset.id); }
  });

  // Filtros
  document.getElementById("filters").addEventListener("click", function(event) {
    const btn = event.target.closest(".btn--filter");
    if (!btn) return;
    AppState.filter = btn.dataset.filter;
    renderFilters();
    renderMovementList();
  });

  // Cargar datos y primer render
  AppState.movements = loadFromStorage();
  renderCategoryOptions("income");
  renderFilters();

  const totals = summarize(AppState.movements);
  renderMovementList();
  renderSummary(totals);
  renderChart(totals);

  console.log("App iniciada");
}

init();
