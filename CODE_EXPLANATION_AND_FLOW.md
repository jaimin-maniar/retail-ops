# RetailOps Technical Documentation and Architecture Guide

This guide explains the RetailOps application from a developer point of view. It is written for someone who is new to the project, but it goes deep enough to support production-level maintenance, debugging, and future migration work.

RetailOps is a browser-only retail operations dashboard. It was converted from a console-style workflow into a single-page web application that runs entirely in the browser using vanilla JavaScript, local JSON seed data, `localStorage`, and `sessionStorage`.

The most important thing to understand first:

```text
RetailOps is not a React, Angular, Vue, or backend API application.

It is a vanilla JavaScript SPA built from ordered script files.
Every module attaches behavior to one shared global namespace:

window.RetailOps
```

Because there is no React, there are no hooks, Context providers, Redux reducers, or JSX components. The equivalent concepts are:

| React or framework concept | RetailOps equivalent |
| --- | --- |
| Component | Function that returns HTML or imperatively creates DOM |
| Props | Function arguments and options objects |
| Local state | Variables inside a page `render(root)` closure |
| Global state | `app.store` in `core/state.js` |
| Re-render | Replacing `innerHTML`, rerendering table rows, or calling `page.render(root)` |
| Effect | Event listener, store subscription, `hashchange`, or async startup |
| Context | Shared `window.RetailOps` namespace |
| Reducer or action | Service method that reads/writes `app.store` |
| Backend database | Browser `localStorage` plus JSON seed files |

---

## 1. Project Overview

### Purpose

RetailOps is a local retail management dashboard for:

- Product catalog management
- SKU master maintenance
- Inventory tracking
- Replenishment recommendation and approval
- Promotion setup and discount simulation
- Billing and POS-style order creation
- Forecast and stockout risk review
- Report generation and export
- Audit/activity tracking
- Local settings and data reset

The application is designed as a browser-based simulation of an enterprise retail operations system. It has role-aware navigation and business rules similar to a backend-driven ERP/POS system, but all data is loaded and persisted locally in the browser.

### Main Business Use Cases

| Business use case | Supported by |
| --- | --- |
| Cashier creates a bill | Billing module and `BillingService` |
| Store manager manages promotions | Promo Engine and `PromotionService` |
| Inventory team manages stock | Inventory module and `InventoryService` |
| Operations team reviews replenishment | Replenishment module and `ReplenishmentService` |
| Business user exports reports | Reports module and `ReportService` |
| Admin manages local settings | Settings module and `SettingsService` |
| Admin audits actions | Logs module and `AuditService` |

### Core Modules and Features

| Module | Primary feature |
| --- | --- |
| Dashboard | KPI and operational summary |
| Products | Product catalog CRUD and activate/deactivate |
| SKUs | SKU packaging/channel master |
| Inventory | Stock ledger, add inventory, stock adjustments |
| Replenishment | Low-stock recommendations and request approval/rejection |
| Promotions | Promotion CRUD, activation/deactivation, discount simulation |
| Forecast | Demand projection and stockout risk |
| Reports | Sales, low-stock, and promotion reports with filters/export |
| Billing | Cart, discounts, tax, payment, invoice/order creation |
| Settings | Local simulation settings and data reset |
| Logs | Audit trail table and activity chart |

### Typical User Workflow

```text
1. User opens index.html or serves the folder locally.
2. App loads seed data or saved browser data.
3. User signs in with a seeded account.
4. Router checks the user's role.
5. Layout renders the sidebar and route page.
6. User performs a workflow, such as creating a bill.
7. Page module handles DOM events.
8. Service validates and applies business rules.
9. Store updates browser state and localStorage.
10. Store notifies subscribers.
11. Router/page rerenders the current view.
12. Toasts, modals, tables, and reports reflect the updated state.
```

### Tech Stack

| Layer | Technology |
| --- | --- |
| UI | HTML, CSS, vanilla JavaScript |
| Application runtime | Browser |
| Routing | Hash routing with `window.location.hash` |
| State | Custom store in `core/state.js` |
| Persistence | `localStorage` for collections, `sessionStorage` for current user |
| Seed data | JSON files plus `data/seedData.js` embedded mirror |
| Components | Custom JavaScript helpers in `components/` |
| Charts | Simple generated HTML/SVG charts |
| Build tooling | None |
| Backend | None |
| Package manager | None currently required |

### Architecture Type

RetailOps is a modular vanilla JavaScript single-page application:

```text
index.html
  -> ordered script files
    -> window.RetailOps namespace
      -> config, store, router
      -> components
      -> services
      -> page modules
```

The app follows a practical layered architecture:

```text
UI pages/modules
  -> reusable components
    -> services/business logic
      -> app.store
        -> localStorage/sessionStorage
          -> JSON seed fallback
```

---

## 2. Folder Structure Explanation

### Top-Level Structure

```text
retailOpsUi/
  assets/
  components/
  core/
  css/
  data/
  js/
  modules/
  pages/
  services/
  utils/
  CODE_EXPLANATION_AND_FLOW.md
  README.md
  index.html
```

There is no `src/`, `dist/`, `build/`, `node_modules/`, `.env`, backend folder, or package manifest in the current project. The app is intentionally static.

### Root Files

| File | Purpose | Category | Interactions |
| --- | --- | --- | --- |
| `index.html` | Main HTML document and script loader | Entry point, configuration by script order | Loads CSS, seed data, utilities, core, components, services, modules, page registry, and app boot script |
| `README.md` | Minimal project readme | Documentation | Currently very small; this guide is the full technical documentation |
| `CODE_EXPLANATION_AND_FLOW.md` | Full architecture and developer guide | Documentation | This file |

### `assets/`

| File | Purpose | Category | Interactions |
| --- | --- | --- | --- |
| `assets/logo-mark.svg` | Brand mark used in login and sidebar | Asset/UI | Referenced by `components/layout.js` and `index.html` favicon |

### `components/`

Components are reusable UI helpers. They are not framework components. Each file attaches one object or helper group to `window.RetailOps`.

| File | Purpose | Handles | Interactions |
| --- | --- | --- | --- |
| `components/layout.js` | Login screen, app shell, sidebar, topbar, logout wiring | UI, routing shell, role rendering | Uses `app.config.routes`, `app.router.hasAccess`, `app.auth`, `app.store`, `app.toast` |
| `components/table.js` | Searchable, sortable, paginated, exportable tables | UI, search state, pagination, CSV export | Used by most page modules; uses `app.search`, `app.helpers`, `app.format` |
| `components/search.js` | Reusable debounced search input with clear button | UI, local search state, debounce | Used by `table.js` and `modules/reports.js` |
| `components/modal.js` | Modal dialogs and confirmation prompts | UI, user confirmation, error containment | Used by form workflows, billing order view, replenishment approve/reject, settings reset |
| `components/form.js` | Dynamic form generator for modal forms | UI, form parsing, frontend validation bridge | Used by shared form modal and page modules |
| `components/toast.js` | Toast notification region and success/error/warning messages | UI feedback | Used by services/pages after actions |
| `components/charts.js` | Small bar, donut, and sparkline chart renderers | UI visualization | Used by dashboard, replenishment, forecast, logs |

### `core/`

Core files create the app's platform layer.

| File | Purpose | Handles | Interactions |
| --- | --- | --- | --- |
| `core/config.js` | App constants, roles, route definitions, data file URLs, promotion types | Configuration, routing, authorization | Used by router, layout, services, settings |
| `core/state.js` | Global store, data loading, persistence, subscriptions | State, storage, initialization | Reads `dataFiles`, JSON/seed data, `localStorage`, `sessionStorage`; notifies router |
| `core/router.js` | Hash router, protected route enforcement, page registration | Routing, route protection | Uses `app.layout`, `app.store`, `app.config.routes`, registered page handlers |

### `css/`

| File | Purpose | Handles | Interactions |
| --- | --- | --- | --- |
| `css/styles.css` | Full application styling, responsive layout, tables, forms, sidebar, cards, toasts, modals | UI, responsive design | Class names are used across all modules/components |

Important responsive rules:

- Desktop uses full sidebar width: `--sidebar-width`.
- Tablet/mobile uses compact rail: `--sidebar-compact-width` or 72px on very small screens.
- Tables use horizontal scrolling through `.table-wrap`.
- Grid layouts collapse at `900px`.

### `data/`

JSON data files are the source dataset. `data/seedData.js` is a browser-friendly mirror used when `fetch()` is not available, especially when opening the app with `file://`.

| File | Purpose | Model |
| --- | --- | --- |
| `products.json` | Product catalog | Product |
| `skus.json` | SKU master records | SKU |
| `inventory.json` | Warehouse stock rows | Inventory |
| `promotions.json` | Promotion programs | Promotion |
| `replenishment.json` | Replenishment request history | Replenishment |
| `forecast.json` | Forecast demand inputs | Forecast |
| `suppliers.json` | Supplier/vendor data | Supplier |
| `warehouses.json` | Warehouse/location data | Warehouse |
| `orders.json` | Completed billing orders | Order |
| `users.json` | Seeded users and roles | User |
| `settings.json` | Local simulation settings | Settings |
| `activityLogs.json` | Audit log records | AuditLog |
| `auditlogs.json` | Legacy or alternate audit data file | AuditLog/source data |
| `seedData.js` | Embedded mirror of JSON data | Runtime fallback |

### `js/`

| File | Purpose | Handles | Interactions |
| --- | --- | --- | --- |
| `js/app.js` | Runtime boot entry point | Startup lifecycle, startup error UI | Calls `app.store.load()`, `app.pageRegistry.registerAll()`, `app.router.start()` |

### `modules/`

Page modules own route-level UI. Each page defines `app.pages.<id>.render(root)`.

| File | Purpose | Handles | Interactions |
| --- | --- | --- | --- |
| `modules/dashboard.js` | Dashboard KPIs, alerts, charts, recent orders | UI, aggregation | Uses alert, replenishment, forecast, billing, promotion, inventory services |
| `modules/products.js` | Product catalog page | UI, product CRUD/status | Uses `ProductService`, shared forms, table |
| `modules/skus.js` | SKU master page | UI, SKU CRUD | Uses `SkuService`, shared forms, table |
| `modules/inventory.js` | Inventory ledger | UI, stock add/adjust | Uses `InventoryService`, shared forms, table |
| `modules/replenishment.js` | Recommendations and request history | UI, approval workflow | Uses `ReplenishmentService`, table, modal confirmations |
| `modules/promotions.js` | Promotion CRUD and discount simulator | UI, promo state | Uses `PromotionService`, products, table, shared forms |
| `modules/forecast.js` | Forecast workbench and trend modal | UI, forecasting visualization | Uses `ForecastService`, charts, table |
| `modules/reports.js` | Report generator, filters, search, download | UI, report state | Uses `ReportService`, `app.search`, forms |
| `modules/billing.js` | POS billing page | UI, cart state, payment | Uses `BillingService`, `PromotionService`, `ProductService`, table, modal |
| `modules/settings.js` | Local settings and data reset | UI, settings state | Uses `SettingsService`, `store.resetLocalData`, modal |
| `modules/logs.js` | Activity logs page | UI, audit table/chart | Uses `AuditService`, charts, table |
| `modules/shared.js` | Shared page helpers | UI utilities | Provides metric cards, badges, select options, form modal wrapper |

### `pages/`

| File | Purpose | Handles | Interactions |
| --- | --- | --- | --- |
| `pages/pageRegistry.js` | Registers all page render functions with router | Routing integration | Reads `app.pages` and calls `app.router.register(id, handler)` |

### `services/`

Services are the business logic layer. Page modules should call services instead of directly rewriting business rules.

| File | Purpose | Handles | Interactions |
| --- | --- | --- | --- |
| `AuthenticationService.js` | Login/logout | Auth, session state | Reads users from store, writes current user to session via `app.store.setUser` |
| `ProductService.js` | Product CRUD/status | Business logic, validation, state | Uses validation, store, audit |
| `SkuService.js` | SKU CRUD | Business logic, state | Uses products, validation, audit |
| `InventoryService.js` | Inventory rows and stock movement | Business logic, stock validation | Uses store, validation, audit |
| `PromotionService.js` | Promotion CRUD/status and discount calculation | Business logic | Used by billing and promo simulator |
| `BillingService.js` | Preview/create bill, totals, stock deduction | Business logic, validation, state | Uses products, inventory, promotions, audit |
| `ReplenishmentService.js` | Low-stock recommendations and approval/rejection | Business logic, workflow state | Uses products, inventory, replenishment collection, audit |
| `ForecastService.js` | Forecast projections and risk | Business logic, aggregation | Uses forecast, products, suppliers, inventory |
| `ReportService.js` | Generates report text and exports | Business logic, filtering, export | Uses orders, products, replenishment, promotions |
| `AlertService.js` | Generates alert list | Business logic, aggregation | Uses inventory, products, promotions |
| `AuditService.js` | Writes and reads activity logs | State/audit | Uses `app.store.update("activityLogs")` |
| `SettingsService.js` | Reads/updates settings | State/config-like business data | Uses settings collection and audit |

### `utils/`

| File | Purpose | Handles | Interactions |
| --- | --- | --- | --- |
| `utils/helpers.js` | Shared utility functions | Utilities, formatting helpers, IDs, date helpers, CSV, escaping, debounce | Used everywhere |
| `utils/validation.js` | Domain validation helpers | Validation | Used by product, inventory, SKU, promotion, billing services |
| `utils/format.js` | Currency, number, percent, date formatting | Utilities/UI formatting | Used by modules/services/components |

### Backend Structure

There is no backend in this repository.

Current behavior:

```text
Browser
  -> app.store
    -> localStorage/sessionStorage
      -> JSON files or seedData fallback
```

If a backend is added later, the service layer is the best boundary for API calls. For example, `ProductService.addProduct()` could call `POST /products`, then update local state from the response.

### Environment Variables

There are no environment variables. Configuration is hardcoded in `core/config.js`.

Future candidates:

- API base URL
- Auth provider settings
- Currency/tax settings
- Feature flags
- Build version

### Build Folders

There is no build output folder. The app can run directly from static files.

---

## 3. Application Flow

### App Startup Flow

The browser starts at `index.html`.

Script order matters because files attach objects to `window.RetailOps` and expect earlier objects to exist.

```text
index.html
  1. Load CSS
  2. Load data/seedData.js
  3. Load utilities
  4. Load core config/state/router
  5. Load components
  6. Load services
  7. Load modules/pages
  8. Load page registry
  9. Load js/app.js
```

`js/app.js` is the runtime entry point:

```text
renderBoot()
  -> show skeleton loading UI

await app.store.load()
  -> load each configured collection
  -> prefer localStorage if present
  -> otherwise fetch JSON when not on file://
  -> otherwise use window.RetailOpsSeedData
  -> restore session user from sessionStorage
  -> notify subscribers

app.pageRegistry.registerAll()
  -> register app.pages.* render methods with router

app.router.start()
  -> listen for hash changes
  -> subscribe to store changes
  -> default hash to #/dashboard
  -> render current route
```

### Authentication Check

```text
router.render()
  -> const user = app.store.getUser()
  -> if no user:
       app.layout.renderLogin()
     else:
       resolve route from hash
       check route access
       render shell
       render route page
```

Login flow:

```text
User submits login form
  -> AuthenticationService.login(username, password)
    -> normalize username
    -> find active matching user in users collection
    -> app.store.setUser(user)
       -> write sessionStorage
       -> notify subscribers
    -> AuditService.log(Login)
  -> toast welcome
  -> hash changes to #/dashboard
```

Logout flow:

```text
User clicks Logout
  -> AuthenticationService.logout()
    -> app.store.setUser(null)
       -> remove sessionStorage session user
       -> notify subscribers
    -> render login
```

### User Interaction Flow by Major Module

#### Billing

```text
User selects product and quantity
  -> modules/billing.js submit handler
  -> validate quantity > 0
  -> BillingService.validateCartItemAvailability()
       -> normalize SKU
       -> combine current cart quantity and added quantity
       -> ensure product is active
       -> ensure inventory stock is enough
  -> update local cart array
  -> renderCart()
       -> BillingService.previewBill(cart, manualDiscount)
       -> calculate promotion discount
       -> calculate manual discount
       -> calculate tax and total
       -> render cart table and bill preview
```

Completing a bill:

```text
User clicks Complete Bill
  -> BillingService.createBill()
       -> build order from cart
       -> reject empty/invalid cart
       -> reject insufficient payment
       -> deduct stock from inventory
       -> generate order ID
       -> save updated inventory
       -> save new order
       -> write audit log
  -> toast success or error
  -> reset cart and rerender billing page
```

#### Promo Engine

```text
User creates/edits promotion
  -> modules/promotions.js opens form modal
  -> form payload is deflated into promotion shape
  -> PromotionService.addPromotion/updatePromotion()
       -> validation.assertPromotion()
       -> normalize SKU/category/product scope
       -> save promotions collection
       -> audit log
  -> rerender page
```

Discount simulator:

```text
User selects product and quantity
  -> PromotionService.getBestDiscount(product, quantity)
       -> get active promotions for current date
       -> filter by quantity and scope
       -> calculate each eligible discount
       -> choose the largest discount
  -> render line subtotal, best promotion, discount, net line
```

#### Reports

```text
User changes report type or filters
  -> modules/reports.js reads current form values
  -> ReportService.generateSalesReport/generateLowStockReport/generatePromotionReport()
       -> normalize filters
       -> apply date/status/category/product/user/search filters
       -> aggregate totals or rows
       -> return plain text report
  -> module updates <pre> output
  -> empty state toggles if no data matched
```

Download:

```text
User clicks Download
  -> ReportService.saveReport()
  -> helpers.downloadFile()
  -> browser downloads .txt file
```

#### Inventory

```text
User adds inventory
  -> inventory form modal
  -> InventoryService.addInventory()
       -> validation.assertInventory()
       -> verify linked product exists
       -> prevent duplicate SKU/warehouse row
       -> create InventoryId
       -> save inventory
       -> audit log
  -> rerender inventory page
```

Stock adjustment:

```text
User adjusts stock
  -> InventoryService.updateStock(sku, quantity, warehouseId)
       -> find inventory row
       -> calculate updated quantity
       -> reject negative stock
       -> save inventory
       -> audit log
```

#### Products

```text
User adds/edits product
  -> modules/products.js opens shared form modal
  -> ProductService.addProduct/updateProduct()
       -> validation.assertProduct()
       -> normalize SKU
       -> reject duplicate SKU
       -> save products
       -> audit log
  -> rerender table
```

Activate/deactivate:

```text
User clicks Activate or Deactivate
  -> label is derived from row.IsActive
  -> ProductService.setProductStatus(productId, nextStatus)
       -> immutably update matching product
       -> write UpdatedAt
       -> save products
       -> audit log
  -> rerender page so label and badge stay synchronized
```

#### Authentication

```text
User signs in
  -> AuthenticationService.login()
  -> store current user in sessionStorage
  -> router renders authorized shell
  -> route config decides visible routes
```

#### Dashboard

```text
Dashboard render
  -> reads products, inventory, orders
  -> calls ReplenishmentService for low-stock report
  -> calls AlertService for alerts
  -> calls PromotionService for active promos
  -> calls BillingService for recent orders
  -> renders KPI cards, charts, low-stock table, recent orders table
```

---

## 4. Component Architecture

### High-Level Component Hierarchy

```text
index.html
  -> #app
    -> layout.renderLogin()
       OR
    -> layout.renderShell(route)
      -> sidebar navigation
      -> topbar
      -> [data-route-outlet]
        -> current page module render(root)
          -> shared metric cards
          -> forms/modals
          -> tables
          -> charts
          -> toasts
```

### Reusable Components

#### Layout

`components/layout.js` owns:

- Login page markup
- Sidebar navigation
- Topbar title/subtitle/actions
- Logout event binding
- Role-aware Reports button rendering

The sidebar is generated from routes the current user can access:

```text
app.config.routes
  -> app.router.hasAccess(route, user)
  -> group by route.section
  -> render nav links
```

#### Table

`components/table.js` creates a table shell with:

- Title
- Search input
- CSV export button
- Sortable headers
- Paginated body
- Optional actions
- Optional row-level action visibility

It is used heavily because most pages display business records.

#### Search

`components/search.js` creates a reusable search control:

- Screen-reader label
- Search input
- Clear button
- Debounced `onChange`
- `setValue()` method
- `focus()` method

#### Modal

`components/modal.js` provides:

- `app.modal.open(options)`
- `app.modal.confirm(options)`

Most destructive or important workflow changes use `confirm`.

#### Form

`components/form.js` creates forms from field metadata:

```js
[
  { name: "SKU", label: "SKU", required: true },
  { name: "Price", label: "Price", type: "number", min: 0.01 }
]
```

It converts number inputs to `Number`, checkboxes to booleans, and sends a payload to the caller.

#### Toast

`components/toast.js` shows success/error/warning notifications. It protects message content with `escapeHtml`.

#### Charts

`components/charts.js` returns simple chart markup:

- Bar chart
- Donut chart
- Sparkline SVG

### Props Flow

There is no framework prop system. Data flows through function arguments:

```text
page module
  -> app.table.create({ data, columns, actions })
  -> app.form.create(fields, values, onSubmit)
  -> app.modal.open({ title, content, actions })
```

### State Flow

```text
Global state:
  app.store collections and current user

Local page state:
  variables inside render(root), such as billing cart, report activeType, query

Component-local state:
  table query/page/sort
  search input value
```

### Event Handling

Events are attached after markup is inserted:

```text
root.innerHTML = ...
root.querySelector("[data-action]").addEventListener(...)
```

When a page rerenders, its old DOM and old event listeners are discarded with the replaced DOM.

---

## 5. State Management Flow

### Global Store

`core/state.js` owns the global state:

```js
state = {
  collections: {},
  currentUser: null,
  isLoaded: false
}
```

Main store methods:

| Method | Purpose |
| --- | --- |
| `load()` | Load all configured data files and restore session user |
| `get(name)` | Return cloned collection |
| `set(name, value, options)` | Replace a collection and persist by default |
| `update(name, updater)` | Update a collection through a function |
| `getUser()` | Return cloned current user |
| `setUser(user)` | Set/clear session user |
| `subscribe(listener)` | Subscribe to global state changes |
| `resetLocalData()` | Reload seed data and clear localStorage collections |

The store clones data on get/set. This reduces accidental mutation of internal state.

### Storage

| Data | Storage |
| --- | --- |
| Collections | `localStorage` using key `retailops.web.<collection>` |
| Current signed-in user | `sessionStorage` using key `retailops.web.sessionUser` |
| Seed fallback | `window.RetailOpsSeedData` from `data/seedData.js` |

### Local vs Global State

| State | Where it lives | Example |
| --- | --- | --- |
| Persistent business data | `app.store` | products, inventory, orders |
| Current user | `sessionStorage` through store | logged-in admin/cashier |
| Cart | Local variable in `modules/billing.js` | `let cart = []` |
| Table query/page/sort | Local variables in `components/table.js` | `query`, `page`, `sortKey` |
| Report filters | Form controls and local variables in reports page | `activeType`, `query` |
| Modal form values | DOM form controls | Add product form |

### Search State Flow

Generic table search:

```text
app.table.create()
  -> creates app.search component
  -> search input emits debounced query
  -> table stores query in local variable
  -> renderRows()
       -> filteredRows()
       -> update tbody only
```

Report search:

```text
app.search.create({ onChange })
  -> query local variable in reports module
  -> updateReport()
  -> ReportService filters matching rows
  -> <pre> output updates
```

### Cart State Flow

Billing cart is intentionally local to the billing page:

```text
let cart = []

Add item:
  -> validate stock
  -> cart = [...cart, newItem] or map existing item
  -> renderCart()

Change quantity:
  -> clamp to integer >= 0
  -> quantity 0 removes only that SKU
  -> validate stock for positive quantity
  -> renderCart()

Complete bill:
  -> BillingService.createBill(cart, ...)
  -> orders and inventory saved globally
  -> cart reset
```

This keeps incomplete carts out of global persistence.

### Promo State Flow

Promotions are persistent global data:

```text
Promo page form
  -> PromotionService.addPromotion/updatePromotion/setPromotionStatus
  -> app.store.set("promotions", updated)
  -> localStorage persists collection
  -> store subscribers rerender route
```

Billing reads active promotions at preview and bill creation time. That means billing always uses the latest promotion state.

### Filter State Flow

Report filters live in DOM form controls plus local variables:

```text
form input/change
  -> readFilters()
  -> ReportService.generateXReport(filters)
  -> update output
```

This avoids persisting temporary report criteria globally.

### React, Context, Redux, Zustand

None of these are used. The project uses a custom store plus local page closure variables.

---

## 6. Routing System

Routing is hash based. Routes are configured in `core/config.js`.

```text
URL hash: #/billing
router:
  -> find route by route.path
  -> check current user role
  -> render shell
  -> call page handler registered under route.id
```

### Protected Routes

Access control is centralized in:

```js
app.router.hasAccess(route, user)
```

The route must include the user's role:

```js
return Boolean(user && route.roles.includes(user.Role));
```

If a user navigates directly to an unauthorized hash, router redirects to the first route they can access.

### Route Mapping Table

| ID | Path | Title | Section | Roles |
| --- | --- | --- | --- | --- |
| `dashboard` | `#/dashboard` | Dashboard | Workspace | Admin, InventoryManager, StoreManager, Cashier |
| `products` | `#/products` | Product Management | Master Data | Admin, InventoryManager, StoreManager |
| `skus` | `#/skus` | SKU Management | Master Data | Admin, InventoryManager, StoreManager |
| `inventory` | `#/inventory` | Inventory Overview | Operations | Admin, InventoryManager, StoreManager |
| `replenishment` | `#/replenishment` | Replenishment Engine | Operations | Admin, InventoryManager, StoreManager |
| `promotions` | `#/promotions` | Promo Engine | Commercial | Admin, StoreManager |
| `forecast` | `#/forecast` | Forecasting | Planning | Admin, InventoryManager, StoreManager |
| `reports` | `#/reports` | Reports | Planning | Admin, InventoryManager, StoreManager |
| `billing` | `#/billing` | Billing | Commercial | Admin, StoreManager, Cashier |
| `settings` | `#/settings` | Settings | System | Admin |
| `logs` | `#/logs` | Logs / Activity | System | Admin |

### Nested Routes

There are no nested routes. Each hash maps to a single page module.

### Lazy Loading

There is no lazy loading. All scripts are loaded up front by `index.html`.

This is simple and reliable for a small static app. For a larger production app, lazy loading could reduce initial load time.

---

## 7. Billing System Logic

Billing is one of the most important flows because it combines product state, inventory state, promotion logic, manual discounts, tax, payment, and order persistence.

### Main Files

| File | Responsibility |
| --- | --- |
| `modules/billing.js` | UI, cart local state, forms, event handlers, bill preview |
| `services/BillingService.js` | Business rules, totals, stock validation, order creation |
| `services/PromotionService.js` | Best discount calculation |
| `services/InventoryService.js` | Stock total and deduction |

### Cart Management Flow

The billing page keeps cart state local:

```js
let cart = [];
```

Cart items have this minimal shape before becoming order lines:

```js
{
  SKU: "MILK-1L",
  Quantity: 2
}
```

When rendering the bill, `BillingService` expands these into full order line objects:

```js
{
  ProductId,
  SKU,
  ProductName,
  Quantity,
  UnitPrice,
  DiscountAmount,
  LineTotal,
  PromotionId,
  PromotionName
}
```

### Add Product to Cart

```text
User submits Add to Cart
  -> read SKU and quantity
  -> ensure quantity is positive integer
  -> validate stock availability
  -> if SKU already exists, increase quantity immutably
  -> otherwise append item
  -> reset paid amount suggestion
  -> renderCart()
```

### Change Quantity or Remove Product

Cart quantity controls allow direct count editing and step buttons.

```text
Quantity decreases to 0
  -> setCartQuantity()
  -> cartWithoutSku(sku)
  -> only that SKU is removed
  -> remaining items stay intact
  -> renderCart()
```

Negative values are blocked by normalizing to zero and showing a warning. The service layer also filters out zero and negative quantities as a safety net.

### Stock Validation

`BillingService.validateCartItemAvailability(cartItems, sku, additionalQuantity)`:

```text
1. Normalize SKU.
2. Convert quantity to a positive integer.
3. Normalize current cart.
4. Calculate requestedQuantity = currentCartQuantityForSku + additionalQuantity.
5. Confirm active product exists.
6. Read available stock with InventoryService.totalStockBySku().
7. Reject when available stock < requested quantity.
```

### Discount Calculation

Billing has two discount layers:

1. Promotion discount per line.
2. Manual discount on the subtotal after promotion discounts.

Promotion discount:

```text
For each order line:
  lineSubtotal = product.Price * quantity
  bestPromotion = PromotionService.getBestDiscount(product, quantity)
  lineTotal = lineSubtotal - bestPromotion.Discount
```

Manual discount:

```text
discountBase = subtotal - promotionDiscountTotal

None:
  manualAmount = 0

Percentage:
  manualAmount = discountBase * percent / 100

FlatAmount:
  manualAmount = flat value

Manual discount cannot be negative.
Manual discount cannot exceed discountBase.
Percentage cannot exceed 100.
```

### Tax and Total Formulas

Current tax rate comes from `app.config.taxRate`:

```text
subtotal = sum(unitPrice * quantity)
promotionDiscountTotal = sum(line promotion discounts)
manualDiscountAmount = calculated manual discount
discountTotal = promotionDiscountTotal + manualDiscountAmount
taxableAmount = subtotal - discountTotal
taxAmount = taxableAmount * app.config.taxRate
totalAmount = taxableAmount + taxAmount
changeDue = paidAmount - totalAmount
```

Money values are rounded with `app.helpers.roundMoney()`.

### Example

```text
Product price: INR 100
Quantity: 2
Promotion: 10 percent
Manual discount: flat INR 20
Tax: 5 percent

subtotal = 100 * 2 = 200
promotionDiscountTotal = 20
discountBase = 200 - 20 = 180
manualDiscountAmount = 20
discountTotal = 40
taxableAmount = 160
taxAmount = 8
totalAmount = 168
```

### Invoice/Order Generation Flow

```text
createBill(cart, cashierUserId, cashierName, customerName, paidAmount, manualDiscount)
  -> buildOrder()
  -> reject invalid cart
  -> reject insufficient payment
  -> deduct stock from inventory rows
  -> generate OrderId
  -> set PaidAmount, ChangeDue, CreatedAt, Status
  -> app.store.set("inventory", updatedInventory)
  -> app.store.set("orders", [...orders, newOrder])
  -> AuditService.log(CreateBill)
```

Order IDs use the current date:

```text
ORDYYYYMMDD0001
```

### Edge Cases

| Edge case | Handling |
| --- | --- |
| Empty cart | Fails with `Cart is empty.` |
| Quantity 0 | Item removed from UI cart; ignored by service safety normalization |
| Negative quantity | Prevented/clamped in UI and ignored by service |
| Product inactive | Billing availability fails |
| Insufficient stock | Add/update rejected |
| Manual discount > subtotal after promos | Rejected |
| Payment less than total | Bill creation rejected |
| Duplicate cart rows | Grouped by normalized SKU in service |

---

## 8. Promo Engine Logic

### Main Files

| File | Responsibility |
| --- | --- |
| `modules/promotions.js` | UI, forms, simulator, table actions |
| `services/PromotionService.js` | Promo validation, storage, status, discount logic |
| `core/config.js` | Allowed promotion types |

### Promotion Model

```js
{
  PromotionId: "PROMO001",
  Name: "Dairy Saver",
  Type: "Percentage",
  DiscountValue: 10,
  StartDate: "2026-05-01T00:00:00",
  EndDate: "2026-06-30T00:00:00",
  IsActive: true,
  ProductId: null,
  SKU: null,
  Category: "Dairy",
  MinimumQuantity: 1
}
```

### Supported Promotion Types

| Type | Formula |
| --- | --- |
| `Percentage` | `lineSubtotal * min(DiscountValue, 100) / 100` |
| `FlatDiscount` | `min(DiscountValue, lineSubtotal)` |
| `BuyOneGetOne` | `unitPrice * floor(quantity / 2)` |
| `ComboOffer` | Percentage discount when quantity meets minimum |

### Promo Creation Flow

```text
User clicks Add Promotion
  -> module opens shared form modal
  -> inflatePromotion() sets defaults
  -> user submits
  -> deflatePromotion() converts form fields to domain shape
  -> PromotionService.addPromotion()
       -> validation.assertPromotion()
       -> assign PromotionId
       -> clean scope and numeric fields
       -> save promotions
       -> audit log
```

### Activation/Deactivation

The table action label is derived from the row state:

```text
row.IsActive ? "Deactivate" : "Activate"
```

Status updates use:

```js
PromotionService.setPromotionStatus(promotionId, isActive)
```

This avoids stale button labels because the page rerenders after the store update.

### Promo Validation

`validation.assertPromotion()` enforces:

- Name is required.
- Discount value is positive except for BOGO.
- End date cannot be earlier than start date.
- Minimum quantity is at least 1.

`cleanPromotion()` additionally:

- Normalizes SKU.
- Converts product/category scope to strings/nulls.
- Sets BOGO discount value to 0.
- Ensures minimum quantity is at least 1.

### Discount Application Logic

`PromotionService.getBestDiscount(product, quantity)`:

```text
1. lineSubtotal = product.Price * quantity
2. Get active promotions for current date.
3. Filter promotions by:
   - minimum quantity
   - product ID, SKU, category, or all-products scope
4. Calculate discount for each eligible promotion.
5. Sort by discount descending.
6. Return the largest discount.
7. If none apply, return { Promotion: null, Discount: 0 }.
```

### Conflict Handling

The app does not stack multiple promotions. If multiple promotions match, the highest monetary discount wins.

Why this matters:

- Cashier gets the best available offer.
- Billing stays deterministic.
- There is no need for priority rules or manual conflict resolution.

---

## 9. Reports Module Logic

### Main Files

| File | Responsibility |
| --- | --- |
| `modules/reports.js` | UI, filters, active report type, search input, download |
| `services/ReportService.js` | Filtering, aggregation, text report generation |
| `utils/helpers.js` | Text normalization and file download |

### Report Types

| Type | Service method | Output file |
| --- | --- | --- |
| Sales | `generateSalesReport(filters)` | `SalesReport.txt` |
| Low Stock | `generateLowStockReport(filters)` | `LowStockReport.txt` |
| Promotion | `generatePromotionReport(filters)` | `PromotionReport.txt` |

### Filter Inputs

Reports support:

- Date from
- Date to
- Category
- Product
- Status
- Sales user
- Search query

The available status values change by report type:

| Report | Status options |
| --- | --- |
| Sales | Statuses from orders |
| Low Stock | Low, Healthy |
| Promotion | Active, Inactive |

### Date Handling

`ReportService` uses:

- `dateInRange(value, from, to)` for point-in-time records such as orders.
- `dateRangesOverlap(start, end, from, to)` for promotions.

The `to` date is handled as inclusive for date ranges by adding one day and comparing with `< end`.

### Aggregation Logic

Sales report:

```text
orders = filtered orders
subtotal = sum(order.Subtotal)
discounts = sum(order.DiscountTotal)
tax = sum(order.TaxAmount)
revenue = sum(order.TotalAmount)
```

Low-stock report:

```text
rows = replenishmentService.generateReplenishmentReport()
if no status selected, default to low-stock rows
filter by category/product/date/query
```

Promotion report:

```text
promotions = promotionService.getPromotions()
filter by date overlap, status, category, product, query
```

### Export Functionality

Reports are downloaded as text:

```text
ReportService.saveReport(fileName, content)
  -> helpers.downloadFile(fileName, content, "text/plain;charset=utf-8")
```

Tables export CSV through `app.table.create()` using `helpers.toCsv()`.

### Search Functionality

Report search uses `components/search.js`:

```text
input event
  -> debounced onChange
  -> query variable updated
  -> updateReport()
  -> service filters values with normalizeText()
```

---

## 10. Search System Architecture

### Search Component

`components/search.js` creates a reusable search input:

```js
app.search.create({
  label: "Report search",
  placeholder: "Search records",
  value: "",
  debounceMs: 80,
  onChange(value) {
    // caller updates local state
  }
});
```

It returns:

```js
{
  element,
  input,
  setValue(nextValue, notify),
  focus()
}
```

### Table Search

`components/table.js` owns table search state:

```text
let query = "";
let page = 1;
let sortKey = null;
let sortDirection = "asc";
```

On search change:

```text
query = value
page = 1
renderRows()
```

`renderRows()` only updates table body/footer/header state, not the whole table shell. That keeps the search input stable.

### Filtering Logic

The table searches:

- Explicit `searchKeys`
- All visible column keys
- Column `value(row)` when provided

Values are normalized through:

```js
app.helpers.normalizeText(value)
```

This makes searches case-insensitive and tolerant of null/undefined.

### Debouncing

Debounce is provided by `helpers.debounce(fn, delay)`.

Purpose:

- Prevent expensive filtering on every keystroke.
- Keep typing smooth.
- Reduce DOM updates.

Current default: `80ms`.

### Why Search Bugs Commonly Happen

A common bug in vanilla DOM apps is recreating the search input on every keypress.

Bad flow:

```text
input event
  -> update query
  -> render entire table component
  -> old input is destroyed
  -> new input is created
  -> focus/cursor can jump
  -> debounced callback may reference old DOM
```

This causes symptoms such as:

- Search text disappearing.
- Cursor losing focus.
- Clear button out of sync.
- Search applying one character late.
- Export using stale filters.

### Proper Fix

RetailOps uses the correct approach:

```text
Create table shell once.
Create search input once.
On query change, rerender only rows/footer/header state.
Keep query in closure state.
Use debounced onChange.
Use filteredRows() for both render and export.
```

If future bugs appear, check:

1. Is the input being recreated while typing?
2. Is the query stored in a stable closure?
3. Are `searchKeys` correct?
4. Does the column use `value(row)` for derived values?
5. Are filters and exports using the same filtered data source?

---

## 11. API/Data Flow

### Does This App Use APIs?

No. There are no HTTP API endpoints, middleware, controllers, database drivers, or backend services.

The only network-like call is optional static JSON fetch during startup:

```js
fetch(url, { cache: "no-store" })
```

This happens only when the app is not running under `file://`.

### Local JSON to UI Flow

```text
core/config.js
  -> app.config.dataFiles maps collection names to JSON files

core/state.js load()
  -> for each data file:
       if localStorage has saved collection:
         use localStorage
       else if protocol is not file://:
         try fetch JSON
       else:
         use seedData.js mirror
  -> store in state.collections
  -> notify subscribers

services
  -> app.store.get(collection)
  -> apply business logic

modules
  -> call services
  -> render UI
```

### Persistence Flow

```text
Service writes change:
  -> app.store.set("products", updatedProducts)
  -> state.collections.products = clone(updatedProducts)
  -> localStorage["retailops.web.products"] = JSON.stringify(updatedProducts)
  -> notify subscribers
  -> router rerenders current route
```

### Request/Response Lifecycle if Backend Is Added Later

Future backend flow should be:

```text
Page module
  -> service method
    -> API client
      -> HTTP request
      -> backend validation/auth
      -> database transaction
      -> response DTO
    -> store update from response
  -> UI rerender/toast
```

Keep page modules free of raw `fetch()` calls. Services should remain the boundary.

---

## 12. Database/Data Models

The app has no real database, but the JSON collections act like tables.

### User

```js
{
  UserId: "U001",
  Username: "admin",
  Password: "admin123",
  Role: "Admin",
  IsActive: true
}
```

Roles:

- `Admin`
- `InventoryManager`
- `StoreManager`
- `Cashier`

Relationship:

- Orders store cashier user ID/name.
- Audit logs store user ID/name.
- Router uses `Role` for access control.

### Product

```js
{
  ProductId: "PROD001",
  Name: "Whole Milk 1L",
  SKU: "MILK-1L",
  Category: "Dairy",
  Price: 62.50,
  ReorderThreshold: 80,
  SupplierId: "SUP001",
  IsActive: true,
  CreatedAt: "...",
  UpdatedAt: "..."
}
```

Relationships:

- Inventory rows link by `ProductId` or `SKU`.
- SKU records link by `ProductId`.
- Promotions can target `ProductId`, `SKU`, `Category`, or all products.
- Order items copy product details at sale time.

### SKU

```js
{
  SkuId: "SKU001",
  ProductId: "PROD001",
  SKU: "MILK-1L",
  Barcode: "...",
  Uom: "Each",
  PackSize: "1L",
  CasePack: 12,
  ShelfLifeDays: 7,
  Channel: "Chilled",
  IsActive: true
}
```

Purpose:

- Adds packaging/channel metadata beyond the product record.

### Inventory

```js
{
  InventoryId: "INV001",
  ProductId: "PROD001",
  SKU: "MILK-1L",
  QuantityAvailable: 120,
  SafetyStock: 20,
  WarehouseId: "MAIN",
  LastUpdatedAt: "..."
}
```

Relationships:

- Product supplies name/category/reorder threshold.
- Warehouse supplies display name.
- Billing deducts stock.
- Replenishment reads stock and safety stock.
- Forecast reads total stock by SKU.

### Promotion

```js
{
  PromotionId: "PROMO001",
  Name: "Dairy Saver",
  Type: "Percentage",
  DiscountValue: 10,
  StartDate: "...",
  EndDate: "...",
  IsActive: true,
  ProductId: null,
  SKU: null,
  Category: "Dairy",
  MinimumQuantity: 1
}
```

Relationships:

- Billing uses promotions to calculate line discounts.
- Reports filter promotions.
- Alerts flag active promotions expiring soon.

### Cart

Cart is not persisted. It is local page state:

```js
{
  SKU: "MILK-1L",
  Quantity: 2
}
```

Billing converts cart items to order items during preview or bill creation.

### Order / Report Source

```js
{
  OrderId: "ORD202605070001",
  CustomerName: "Walk-in Customer",
  CashierUserId: "U004",
  CashierName: "cashier",
  Items: [ ... ],
  Subtotal: 357.50,
  PromotionDiscountTotal: 18.75,
  ManualDiscountType: "None",
  ManualDiscountValue: 0,
  ManualDiscountAmount: 0,
  DiscountTotal: 18.75,
  TaxAmount: 16.94,
  TotalAmount: 355.69,
  PaidAmount: 400,
  ChangeDue: 44.31,
  Status: "Completed",
  CreatedAt: "..."
}
```

Older seed orders may not include the newer manual discount fields. UI code uses fallbacks where needed.

### Replenishment

```js
{
  ReplenishmentId: "REP002",
  SKU: "TEA-GREEN-25",
  ProductId: "PROD008",
  WarehouseId: "SOUTH",
  SuggestedQuantity: 52,
  ApprovedQuantity: 0,
  Status: "Pending",
  CreatedAt: "...",
  CreatedBy: "manager",
  SupplierId: "SUP004",
  UpdatedAt: "...",
  UpdatedBy: "...",
  ApprovedAt: "...",
  ApprovedBy: "...",
  RejectedAt: "...",
  RejectedBy: "..."
}
```

Status values:

- `Pending`
- `Approved`
- `Rejected`

### Forecast

```js
{
  ProductId: "PROD001",
  SKU: "MILK-1L",
  WeeklyDemand: [120, 132, 128],
  SeasonalityIndex: 1.1,
  PromoLift: 1.0,
  HorizonDays: 21,
  Confidence: 87
}
```

Derived fields:

- ProductName
- Category
- SupplierName
- StockOnHand
- AverageWeeklyDemand
- EffectiveDailyDemand
- ProjectedDemand
- DaysOfCover
- StockoutDate
- LeadTimeDays
- Risk

### Audit Log

```js
{
  AuditLogId: "AUD00001",
  UserId: "U001",
  Username: "admin",
  Action: "UpdateProduct",
  EntityName: "Product",
  EntityId: "PROD001",
  Details: "Updated product MILK-1L.",
  CreatedAt: "..."
}
```

---

## 13. Error Handling Strategy

### Frontend Validation

Frontend validation is mostly handled by:

- HTML attributes (`required`, `min`, `step`, `type`)
- Form parser in `components/form.js`
- Page-level checks, such as billing quantity > 0
- Modal confirmations for destructive actions

### Business Validation

Services enforce business rules:

| Service | Examples |
| --- | --- |
| ProductService | SKU required, price > 0, duplicate SKU rejected |
| InventoryService | Quantity non-negative, linked product exists, no duplicate SKU/warehouse |
| PromotionService | Valid dates, valid discount, valid minimum quantity |
| BillingService | Empty cart rejected, stock check, payment check, discount limits |
| ReplenishmentService | Request ID must exist for approval/rejection |

### Error Display

Most page actions use:

```js
try {
  service.call()
} catch (error) {
  app.toast.error(error.message)
}
```

`components/form.js` catches errors thrown by submit handlers and shows a toast.

### Startup Error Handling

`js/app.js` wraps startup in `try/catch`.

If startup fails:

```text
Render "RetailOps could not start" panel
Show escaped error message
Log error to console
```

### UI Fallbacks

Examples:

- Empty tables show `No records found`.
- Empty cart shows `Cart is empty`.
- Missing dates format as `-`.
- Unknown product names display as `Unknown`.
- Reports show a custom empty state when no data matches.

### Toast Strategy

| Toast type | Usage |
| --- | --- |
| Success | Completed mutation or workflow |
| Error | Validation/business failure |
| Warning | Non-fatal issue, such as invalid quantity input |

Toasts auto-remove after a short duration.

---

## 14. Performance Optimization

### Current Optimizations

| Area | Optimization |
| --- | --- |
| Data reads | Store returns cloned data to prevent mutation leaks |
| Search | Debounced input |
| Tables | Pagination limits visible rows |
| Table updates | Search/sort rerender rows instead of recreating full table shell |
| Routing | Only current page renders |
| Charts | Lightweight HTML/SVG, no external library |
| Exports | Generated only on click |

### Render Optimization

Pages generally rerender after a data mutation. This is simple and acceptable at the current data size.

For larger datasets:

- Avoid rerendering the whole route on every store update.
- Add route-level dirty checks.
- Use keyed row updates for very large tables.
- Move expensive aggregates into memoized selectors.

### Memoization

There is no memoization library. Derived values are recalculated on render.

Potential future memoization targets:

- `replenishmentService.generateReplenishmentReport()`
- `forecastService.getForecastRows()`
- Report filtering
- Dashboard KPI aggregation

### Pagination

Tables default to `pageSize = 8`. Some modules set custom sizes.

Pagination reduces DOM node count and keeps table rendering predictable.

### Lazy Loading

Not currently used. All scripts load up front.

Future improvement:

```text
router navigates to #/reports
  -> dynamically import reports module
  -> register/render page
```

This would require moving from plain ordered scripts to modules/build tooling.

---

## 15. Responsive Design System

### Breakpoints

Main breakpoints in `css/styles.css`:

| Breakpoint | Behavior |
| --- | --- |
| `max-width: 1180px` | Four-column grids become two-column; hero layout stacks |
| `max-width: 900px` | App shell uses compact sidebar rail; grids/forms become single-column |
| `max-width: 560px` | Sidebar rail narrows; topbar stacks; tables/buttons stretch more |

### Responsive Sidebar

Desktop:

```text
app-shell grid:
  [272px sidebar] [content]
```

Tablet/mobile:

```text
app-shell grid:
  [84px compact rail] [content]

very small screens:
  [72px compact rail] [content]
```

The current implementation does not use a hamburger menu. The previous drawer/toggle/overlay model was removed to keep navigation stable and always available.

### Hamburger Menu Flow

Current state:

```text
No hamburger icon.
No mobile drawer state.
No sidebar overlay.
No Escape/resize drawer listeners.
No body.nav-open state.
```

Why:

- A compact rail avoids hidden navigation.
- It removes overlay z-index bugs.
- It avoids state synchronization issues between route changes and drawer state.
- Desktop behavior stays unchanged.

If a hamburger menu is reintroduced later, it should be implemented as a single controlled state in `layout.js`, with explicit cleanup on route changes and resize.

### Responsive Tables

Tables use:

```css
.table-wrap {
  overflow-x: auto;
}

.data-table {
  min-width: 760px;
}
```

This preserves table readability instead of squeezing too many columns into mobile width.

### Responsive Forms

Forms use `.form-grid` with two columns on desktop and one column below `900px`.

### Responsive Navigation

The sidebar is role-aware and route-driven:

```text
routes filtered by current role
  -> desktop full labels
  -> mobile compact icons with title tooltips
```

---

## 16. Security and Validation

### Input Validation

The app uses both frontend and service validation:

- HTML input constraints
- `validation.js` domain checks
- Service-specific duplicate and relationship checks
- Billing stock/payment/discount checks

### Authentication Security

Current authentication is for local simulation only:

- Passwords are stored in `data/users.json`.
- No hashing.
- No token.
- No server-side session.
- Current user is stored in `sessionStorage`.

This is not production-secure authentication. A real deployment should use a backend identity provider, hashed passwords, short-lived tokens or secure cookies, and server-side authorization.

### Route Protection

Route protection is centralized in `router.hasAccess()`.

This protects:

- Sidebar visibility
- Direct hash navigation
- Topbar Reports action visibility

Important: client-side route protection is not sufficient for a real backend. Backend APIs must also enforce permissions.

### XSS Prevention

The app frequently uses:

```js
app.helpers.escapeHtml(value)
```

This protects user/data values inserted into template strings.

Developers must continue escaping dynamic values in `innerHTML`.

Safer alternatives for future work:

- Prefer `textContent` for untrusted text.
- Use DOM APIs for complex user-provided content.
- Use a sanitizer if rich HTML is ever required.

### Token Handling

No tokens are used.

Future token guidance:

- Avoid storing long-lived tokens in `localStorage`.
- Prefer secure, HTTP-only cookies for server sessions.
- If using bearer tokens, keep lifetimes short and refresh safely.

### Secure Storage Practices

Current local data is readable and editable by the user through browser dev tools. This is acceptable for a local simulation, not for production.

---

## 17. Developer Onboarding Guide

### Prerequisites

You need:

- A modern browser.
- Optional: a local static web server.
- Optional: Node.js only for syntax checks such as `node --check`.

No package installation is required.

### Installation

```text
1. Clone or copy the repository.
2. Open the project folder.
3. No npm install is required.
```

### Running the Frontend

Option 1: open directly:

```text
Open index.html in a browser.
```

The app supports this because `data/seedData.js` mirrors the JSON files when `file://` fetch is blocked.

Option 2: serve locally:

```powershell
python -m http.server 8080
```

Then open:

```text
http://localhost:8080
```

If Python is not available, any static file server works.

### Running the Backend

There is no backend.

### Build Process

There is no build process.

The deployed artifact is the static folder:

```text
index.html
css/
js/
core/
components/
services/
modules/
pages/
utils/
data/
assets/
```

### Deployment Process

For static hosting:

```text
1. Copy the project files to a static web server.
2. Ensure JSON files are served with correct MIME type.
3. Open index.html.
```

Possible hosting targets:

- IIS static site
- Apache/Nginx static folder
- GitHub Pages
- Azure Static Web Apps
- Netlify/Vercel static deployment

### Demo Credentials

Seeded users:

| Username | Password | Role |
| --- | --- | --- |
| `admin` | `admin123` | Admin |
| `inventory` | `inventory123` | InventoryManager |
| `manager` | `manager123` | StoreManager |
| `cashier` | `cashier123` | Cashier |

### Resetting Local Data

Use:

```text
Settings -> Reset Local Data
```

This clears saved collections from `localStorage` and reloads seed data.

Manual browser reset:

```text
DevTools -> Application -> Local Storage -> remove retailops.web.* keys
DevTools -> Application -> Session Storage -> remove retailops.web.sessionUser
```

---

## 18. Debugging Guide

### Common Bugs and Where to Look

| Symptom | Likely area |
| --- | --- |
| Page does not load | `index.html` script order, console error, `js/app.js` startup |
| Login fails | `users` collection, `AuthenticationService.js` |
| Route redirects unexpectedly | `core/config.js` route roles, `core/router.js` |
| Sidebar missing links | Role-based route filtering in `layout.js` |
| Table search behaves oddly | `components/search.js`, `components/table.js`, search keys |
| Cart totals wrong | `BillingService.buildOrder()`, promotion logic, manual discount |
| Stock not updating | `InventoryService.deductStock()` or `updateStock()` |
| Promotion not applying | `PromotionService.isActiveOn()` or `isApplicable()` |
| Reports empty | Report filters/date range/query |
| Data resets after refresh | localStorage unavailable or reset action used |

### Debugging State Issues

In browser console:

```js
RetailOps.store.get("products")
RetailOps.store.get("inventory")
RetailOps.store.get("orders")
RetailOps.store.getUser()
```

Because `get()` returns clones, mutating the returned object does not update app state. Use service methods or `app.store.set/update`.

### Debugging Search Issues

Check:

```js
app.helpers.normalizeText(value)
```

Then inspect:

- `searchKeys` passed to `app.table.create()`.
- Column `value(row)` for derived columns.
- Whether `renderRows()` is being called.
- Whether query state resets unexpectedly.

### Debugging Cart Issues

Use:

```js
RetailOps.billingService.previewBill([
  { SKU: "MILK-1L", Quantity: 2 }
])
```

Check:

- Is product active?
- Does inventory have enough stock?
- Is quantity positive?
- Are promotions active for today's date?
- Is manual discount valid?

### Debugging API Issues

There are no backend APIs. If data loading fails:

1. Check if the app is running under `file://`.
2. Check `data/seedData.js` exists and is loaded.
3. Check JSON files are valid.
4. Check browser console for fetch/CORS errors.

### Debugging Rendering Issues

Inspect:

- The route outlet: `[data-route-outlet]`
- Whether the page handler is registered in `pageRegistry`
- Whether the route ID matches `app.pages.<id>`
- Console errors during `render(root)`
- Escaping issues in template strings

### Debugging Role Access

```js
const route = RetailOps.config.routes.find(r => r.id === "reports");
RetailOps.router.hasAccess(route, RetailOps.store.getUser());
```

### Debugging Local Storage

Browser storage keys use:

```text
retailops.web.products
retailops.web.inventory
retailops.web.orders
retailops.web.sessionUser
```

---

## 19. Future Scalability Suggestions

### Architecture Improvements

1. Move from global namespace scripts to ES modules.
2. Add a small API client layer behind services.
3. Introduce typed models with TypeScript.
4. Add centralized error objects instead of string-only errors.
5. Add a domain event layer for audit and notifications.
6. Separate read selectors from write services.

### Better State Management

For larger scale:

- Keep `app.store`, but add selectors and collection-specific subscriptions.
- Or migrate to a lightweight state library.
- Avoid whole-route rerenders on unrelated collection updates.
- Add immutable helper utilities.

### Backend/API Migration

Recommended production architecture:

```text
Frontend SPA
  -> API client
    -> REST/GraphQL backend
      -> service layer
        -> database
        -> authentication provider
        -> audit logging
```

Services in this app already provide a natural migration boundary.

### Database Suggestions

Suggested relational model:

- Users
- Roles
- Products
- SKUs
- Suppliers
- Warehouses
- Inventory
- Promotions
- Orders
- OrderItems
- ReplenishmentRequests
- ForecastRows
- AuditLogs

### Testing Strategy

Add:

| Test type | Target |
| --- | --- |
| Unit tests | Services and utilities |
| Integration tests | Store + services |
| UI tests | Billing, reports, login, route protection |
| Accessibility checks | Modals, tables, forms |
| Regression tests | Discounts, stock deduction, report filters |

High-value first tests:

- Billing totals and stock deduction.
- Promotion best-discount selection.
- Product status toggling.
- Replenishment approve/reject.
- Cashier route protection.
- Report filters.

### CI/CD Suggestions

Pipeline steps:

```text
1. Validate JSON files.
2. Run node --check on all JS files.
3. Run unit tests.
4. Run Playwright smoke tests.
5. Run accessibility checks.
6. Package static files.
7. Deploy to static hosting.
```

### Performance Improvements

- Memoize dashboard/replenishment/report selectors.
- Virtualize large tables.
- Move exports to Web Worker for large datasets.
- Split routes into lazy chunks if migrated to modules/build tooling.
- Cache active promotion calculations by date/product/quantity.

### Enterprise-Level Improvements

- Real authentication and authorization.
- Backend audit log immutability.
- Optimistic UI with rollback.
- Server-side pagination/filtering.
- Centralized design system tokens.
- API error codes.
- Feature flags.
- Environment-specific config.
- Data migration/versioning.

---

## 20. Module Interaction Diagrams

### Runtime Layer Diagram

```text
index.html
  |
  v
js/app.js
  |
  v
app.store.load()
  |
  +--> localStorage
  +--> JSON fetch
  +--> seedData.js fallback
  |
  v
app.router.start()
  |
  v
layout shell
  |
  v
page module
  |
  v
service method
  |
  v
app.store.set/update()
  |
  v
localStorage + subscribers
```

### Billing Interaction Diagram

```text
Billing UI
  |
  +--> ProductService.getProducts()
  +--> BillingService.validateCartItemAvailability()
  +--> BillingService.previewBill()
         |
         +--> ProductService/get store products
         +--> InventoryService.totalStockBySku()
         +--> PromotionService.getBestDiscount()
  |
  +--> BillingService.createBill()
         |
         +--> InventoryService.deductStock()
         +--> app.store.set("inventory")
         +--> app.store.set("orders")
         +--> AuditService.log()
```

### Report Interaction Diagram

```text
Reports UI
  |
  +--> Search component
  +--> Filter form
  |
  v
ReportService
  |
  +--> Orders
  +--> Replenishment report
  +--> Promotions
  +--> Products
  |
  v
Text output + download
```

### Route Protection Diagram

```text
Hash changes to #/reports
  |
  v
router.getRouteByHash()
  |
  v
router.hasAccess(route, user)
  |
  +--> yes: render reports
  |
  +--> no: redirect to first allowed route
```

---

## 21. Why the App Is Implemented This Way

RetailOps uses simple static architecture because the current project goal is a browser-only conversion of console business logic.

Benefits:

- Easy to run without setup.
- Easy to inspect in a browser.
- No dependency installation.
- Business logic remains readable in service files.
- Data persistence works locally through browser storage.
- Role workflows can be demonstrated without a backend.

Tradeoffs:

- No real security boundary.
- No multi-user data consistency.
- No server-side validation.
- No typed compile-time checks.
- Large datasets would need stronger performance patterns.

The codebase is therefore best understood as a clean local simulation and UI shell around retail business rules. The service layer is the most important long-term investment because it can be preserved if the app later moves to a real backend or framework.

---

## 22. Developer Rules of Thumb

When making changes:

1. Put route/page UI in `modules/`.
2. Put reusable UI in `components/`.
3. Put business rules in `services/`.
4. Put generic helpers in `utils/`.
5. Put route/role config in `core/config.js`.
6. Use `app.store.set/update()` for persistent state changes.
7. Use service methods instead of mutating collections directly from UI.
8. Escape dynamic values inserted into `innerHTML`.
9. Rerender only what is needed for frequent interactions like search.
10. Add audit logs for meaningful business mutations.

Good example:

```text
Button click
  -> page handler
  -> service method
  -> validation
  -> store update
  -> audit log
  -> toast
  -> rerender
```

Avoid:

```text
Button click
  -> direct localStorage manipulation
  -> duplicate business rule in page
  -> no audit log
```

---

## 23. Quick File Ownership Map

| Change needed | Best place to edit |
| --- | --- |
| Add new route | `core/config.js`, new `modules/<page>.js`, `index.html` script |
| Change route permissions | `core/config.js` |
| Change sidebar/topbar | `components/layout.js`, `css/styles.css` |
| Change table behavior | `components/table.js`, `components/search.js` |
| Change product business rules | `services/ProductService.js`, `utils/validation.js` |
| Change billing formulas | `services/BillingService.js` |
| Change promotion formulas | `services/PromotionService.js` |
| Change report filters/output | `services/ReportService.js`, `modules/reports.js` |
| Change seed data | `data/*.json` and `data/seedData.js` mirror |
| Change visual styling | `css/styles.css` |

---

## 24. Final Summary

RetailOps is a static, vanilla JavaScript single-page application with a clear separation between:

- Core app infrastructure (`core/`)
- Reusable UI (`components/`)
- Route pages (`modules/`)
- Business logic (`services/`)
- Shared utilities (`utils/`)
- Local seed data (`data/`)

The most important execution path is:

```text
index.html
  -> js/app.js
  -> app.store.load()
  -> app.router.start()
  -> app.layout.renderShell()
  -> route module render()
  -> service methods
  -> app.store updates
  -> localStorage persistence
```

The app is beginner-friendly because everything is plain JavaScript, but it still uses important enterprise patterns:

- Centralized route permissions
- Service-based business logic
- Store-based state management
- Reusable components
- Audit logging
- Validation boundaries
- Responsive layout
- Exportable reports

For production modernization, preserve the service boundaries and domain formulas. Those are the parts that encode the business value of the application.
