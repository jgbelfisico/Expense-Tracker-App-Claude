# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Expense Tracker — aplicación web para registrar ingresos y gastos personales. Vanilla HTML, CSS y JavaScript puro. Sin frameworks, sin backend. Los datos persisten en `localStorage`.

## Cómo ejecutar

Abrir `index.html` directamente en el navegador. No requiere servidor ni instalación.

## Arquitectura

Tres archivos con responsabilidades claras:

- `index.html` — markup estático. El JS llena `#movements-list` y actualiza `#total-balance`, `#total-income`, `#total-expenses` en cada render.
- `styles.css` — estilos organizados en secciones comentadas (reset, tarjetas, formulario, botones, lista, responsive).
- `script.js` — toda la lógica. Organizado de arriba a abajo: estado → storage → utilidades → validación → cálculos → render → mutaciones → manejadores → `init()`.

## Estado global

```js
AppState = {
  movements: [],          // fuente de verdad única
  filter: "all"           // "all" | "income" | "expense"
}
```

## Flujo de datos

Unidireccional: evento DOM → mutación del array → `saveToStorage()` → `render*()`.

El DOM nunca es fuente de verdad. Todo se deriva del array en cada render.

## Modelo de cada movimiento

```js
{
  id:          string,   // Date.now().toString()
  type:        "income" | "expense",
  category:    string,
  amount:      number,   // siempre positivo; el signo vive en type
  date:        string,   // "YYYY-MM-DD"
  description: string    // puede ser ""
}
```

## Funciones clave

| Función | Qué hace |
|---|---|
| `addMovement()` | push → renderMovementList + renderSummary + saveToStorage |
| `deleteMovement(id)` | filter → renderMovementList + renderSummary + saveToStorage |
| `calculateSummary()` | un solo recorrido del array, devuelve `{ balance, totalIncome, totalExpenses }` |
| `renderMovementList()` | aplica `AppState.filter` sobre el array, repinta la lista completa |
| `renderSummary()` | llama a calculateSummary y actualiza las tres tarjetas del DOM |
| `renderFilters()` | marca el botón activo según `AppState.filter` |
| `init()` | loadFromStorage → renderFilters + renderMovementList + renderSummary + event listeners |

## localStorage

Clave: `"expense_tracker_movements"`. Se guarda el array completo como JSON tras cada mutación. Se lee con `try/catch`; si falla devuelve `[]`.

## Convenciones CSS

Clases de color: `.movement--income` / `.movement--expense`, `.card--income` / `.card--expense`. La clase `.card--balance.negative` pinta el balance en rojo (se agrega/quita por JS).
