/* RetailOps training assignment app
   Kept as one plain JavaScript file on purpose so it feels like a student project. */
var app = window.retailApp = window.retailApp || {};

// small helper functions
{
const helpers = {
    clone(value) {
      return JSON.parse(JSON.stringify(value ?? null));
    },

    escapeHtml(value) {
      return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
    },

    normalizeText(value) {
      return String(value ?? "").trim().toLowerCase();
    },

    nowIso() {
      return new Date().toISOString();
    },

    todayDateOnly() {
      const now = new Date();
      return new Date(now.getFullYear(), now.getMonth(), now.getDate());
    },

    toDate(value) {
      if (!value) {
        return null;
      }
      const date = value instanceof Date ? value : new Date(value);
      return Number.isNaN(date.getTime()) ? null : date;
    },

    toDateOnly(value) {
      const date = helpers.toDate(value);
      if (!date) {
        return null;
      }
      return new Date(date.getFullYear(), date.getMonth(), date.getDate());
    },

    isBetweenDateInclusive(value, start, end) {
      const target = helpers.toDateOnly(value);
      const from = helpers.toDateOnly(start);
      const to = helpers.toDateOnly(end);

      if (!target || !from || !to) {
        return false;
      }

      return target >= from && target <= to;
    },

    addDays(value, days) {
      const date = helpers.toDate(value) || new Date();
      const result = new Date(date);
      result.setDate(result.getDate() + Number(days || 0));
      return result;
    },

    sum(items, selector) {
      return (items || []).reduce((total, item) => total + Number(selector(item) || 0), 0);
    },

    avg(items, selector) {
      if (!items || items.length === 0) {
        return 0;
      }
      return helpers.sum(items, selector) / items.length;
    },

    roundMoney(value) {
      return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
    },

    groupBy(items, keySelector) {
      return (items || []).reduce((groups, item) => {
        const key = keySelector(item);
        if (!groups[key]) {
          groups[key] = [];
        }
        groups[key].push(item);
        return groups;
      }, {});
    },

    unique(items) {
      return Array.from(new Set((items || []).filter(Boolean)));
    },

    compareValues(a, b) {
      const left = a ?? "";
      const right = b ?? "";

      if (typeof left === "number" && typeof right === "number") {
        return left - right;
      }

      return String(left).localeCompare(String(right), undefined, {
        numeric: true,
        sensitivity: "base"
      });
    },

    extractNumericSuffix(value, prefix) {
      const text = String(value || "");
      if (!text.toUpperCase().startsWith(prefix.toUpperCase())) {
        return 0;
      }
      const number = Number.parseInt(text.slice(prefix.length), 10);
      return Number.isFinite(number) ? number : 0;
    },

    nextId(items, field, prefix, width) {
      const lastNumber = Math.max(
        0,
        ...(items || []).map((item) => helpers.extractNumericSuffix(item[field], prefix))
      );
      return `${prefix}${String(lastNumber + 1).padStart(width, "0")}`;
    },

    debounce(fn, delay) {
      let timer = 0;
      return (...args) => {
        window.clearTimeout(timer);
        timer = window.setTimeout(() => fn(...args), delay);
      };
    },

    downloadFile(fileName, content, mimeType) {
      const blob = new Blob([content], { type: mimeType || "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    },

    toCsv(rows, columns) {
      const safeCell = (value) => {
        const text = String(value ?? "");
        if (/[",\n]/.test(text)) {
          return `"${text.replaceAll('"', '""')}"`;
        }
        return text;
      };

      const header = columns.map((column) => safeCell(column.label)).join(",");
      const body = rows.map((row) => columns
        .map((column) => safeCell(typeof column.value === "function" ? column.value(row) : row[column.key]))
        .join(","));
      return [header, ...body].join("\n");
    },

    renderBadge(text, tone) {
      const badgeTone = tone || "neutral";
      return `<span class="badge badge-${badgeTone}">${helpers.escapeHtml(text)}</span>`;
    },

    getStockTone(stock, threshold) {
      if (Number(stock) === 0) {
        return "red";
      }
      if (Number(stock) <= Number(threshold)) {
        return "amber";
      }
      return "green";
    }
  };

  app.help = helpers;
}

// form checks
{
const validation = {
    isRequired(value) {
      return String(value ?? "").trim().length > 0;
    },

    isPositive(value) {
      return Number(value) > 0;
    },

    isNonNegative(value) {
      return Number(value) >= 0;
    },

    normalizeSku(value) {
      return String(value ?? "").trim().toUpperCase();
    },

    assertProduct(product) {
      if (!validation.isRequired(product.SKU)) {
        throw new Error("SKU is required.");
      }
      if (!validation.isRequired(product.Name)) {
        throw new Error("Product name is required.");
      }
      if (!validation.isPositive(product.Price)) {
        throw new Error("Price must be greater than zero.");
      }
      if (!validation.isNonNegative(product.ReorderThreshold)) {
        throw new Error("Reorder threshold cannot be negative.");
      }
    },

    assertInventory(inventory) {
      if (!validation.isRequired(inventory.SKU) && !validation.isRequired(inventory.ProductId)) {
        throw new Error("SKU or Product ID is required.");
      }
      if (!validation.isNonNegative(inventory.QuantityAvailable)) {
        throw new Error("Quantity cannot be negative.");
      }
      if (!validation.isNonNegative(inventory.SafetyStock)) {
        throw new Error("Safety stock cannot be negative.");
      }
    },

    assertPromotion(promotion) {
      if (!validation.isRequired(promotion.Name)) {
        throw new Error("Promotion name is required.");
      }
      if (promotion.Type !== "BuyOneGetOne" && !validation.isPositive(promotion.DiscountValue)) {
        throw new Error("Discount value must be greater than zero.");
      }
      const start = app.help.toDateOnly(promotion.StartDate);
      const end = app.help.toDateOnly(promotion.EndDate);
      if (start && end && end < start) {
        throw new Error("End date cannot be earlier than start date.");
      }
      promotion.MinimumQuantity = Math.max(1, Number(promotion.MinimumQuantity || 1));
    }
  };

  app.check = validation;
}

// display formatting
{
const format = {
    currency(value) {
      const amount = Number(value || 0);
      return new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 2
      }).format(amount);
    },

    number(value) {
      return new Intl.NumberFormat("en-IN").format(Number(value || 0));
    },

    percent(value) {
      return `${Number(value || 0).toFixed(1)}%`;
    },

    date(value) {
      const date = app.help.toDate(value);
      if (!date) {
        return "-";
      }
      return new Intl.DateTimeFormat("en-IN", {
        year: "numeric",
        month: "short",
        day: "2-digit"
      }).format(date);
    },

    dateTime(value) {
      const date = app.help.toDate(value);
      if (!date) {
        return "-";
      }
      return new Intl.DateTimeFormat("en-IN", {
        year: "numeric",
        month: "short",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit"
      }).format(date);
    },

    isoDateInput(value) {
      const date = app.help.toDate(value);
      if (!date) {
        return "";
      }
      const yyyy = date.getFullYear();
      const mm = String(date.getMonth() + 1).padStart(2, "0");
      const dd = String(date.getDate()).padStart(2, "0");
      return `${yyyy}-${mm}-${dd}`;
    }
  };

  app.fmt = format;
}

// basic setup
{
const roles = {
    Admin: "Admin",
    InventoryManager: "InventoryManager",
    StoreManager: "StoreManager",
    Cashier: "Cashier"
  };

  const allOpsRoles = [roles.Admin, roles.InventoryManager, roles.StoreManager];
  const storeRoles = [roles.Admin, roles.StoreManager];
  const sellRoles = [roles.Admin, roles.StoreManager, roles.Cashier];

  app.setup = {
    appName: "RetailOps",
    storagePrefix: "retailops.web",
    taxRate: 0.05,
    roles,
    dataFiles: {
      products: true,
      skus: true,
      inventory: true,
      promotions: true,
      replenishment: true,
      forecast: true,
      suppliers: true,
      warehouses: true,
      activityLogs: true,
      orders: true,
      users: true,
      settings: true
    },
    routes: [
      { id: "dashboard", path: "#/dashboard", title: "Dashboard", subtitle: "Quick view of stock, sales, alerts, and promotions.", icon: "D", section: "Main", roles: Object.values(roles) },
      { id: "products", path: "#/products", title: "Products", subtitle: "Add and update product details.", icon: "P", section: "Data", roles: allOpsRoles },
      { id: "skus", path: "#/skus", title: "SKUs", subtitle: "Maintain SKU packaging and barcode details.", icon: "S", section: "Data", roles: allOpsRoles },
      { id: "inventory", path: "#/inventory", title: "Inventory", subtitle: "Check stock and make stock adjustments.", icon: "I", section: "Work", roles: allOpsRoles },
      { id: "replenishment", path: "#/replenishment", title: "Replenishment", subtitle: "See low stock suggestions and approvals.", icon: "R", section: "Work", roles: allOpsRoles },
      { id: "promotions", path: "#/promotions", title: "Promotions", subtitle: "Create discounts and test which one applies.", icon: "%", section: "Sales", roles: storeRoles },
      { id: "forecast", path: "#/forecast", title: "Forecast", subtitle: "Estimate demand and stock risk.", icon: "F", section: "Work", roles: allOpsRoles },
      { id: "reports", path: "#/reports", title: "Reports", subtitle: "Generate sales, stock, and promotion reports.", icon: "B", section: "Reports", roles: allOpsRoles },
      { id: "billing", path: "#/billing", title: "Billing", subtitle: "Create an order and deduct stock.", icon: "$", section: "Sales", roles: sellRoles },
      { id: "settings", path: "#/settings", title: "Settings", subtitle: "Change local settings and reset saved data.", icon: "G", section: "Admin", roles: [roles.Admin] },
      { id: "logs", path: "#/logs", title: "Logs", subtitle: "View login, product, inventory, promotion, and billing activity.", icon: "L", section: "Admin", roles: [roles.Admin] }
    ],
    promotionTypes: [
      { value: "Percentage", label: "Percentage" },
      { value: "FlatDiscount", label: "Flat Discount" },
      { value: "BuyOneGetOne", label: "Buy One Get One" },
      { value: "ComboOffer", label: "Combo Offer" }
    ]
  };
}

// local data storage
{
const listeners = new Set();
  const state = {
    collections: {},
    currentUser: null,
    isLoaded: false
  };

  const storageKey = (name) => `${app.setup.storagePrefix}.${name}`;

  async function loadSavedData(name) {
    const saved = localStorage.getItem(storageKey(name));
    if (saved) {
      return JSON.parse(saved);
    }
    return app.help.clone((window.RetailOpsSeedData || {})[name] || (name === "settings" ? {} : []));
  }

  function persist(name) {
    localStorage.setItem(storageKey(name), JSON.stringify(state.collections[name]));
  }

  function notify() {
    listeners.forEach((listener) => listener(app.help.clone(state.collections)));
  }

  app.data = {
    async load() {
      const entries = Object.keys(app.setup.dataFiles);
      for (let i = 0; i < entries.length; i += 1) {
        const name = entries[i];
        state.collections[name] = await loadSavedData(name);
      }

      const savedUser = sessionStorage.getItem(`${app.setup.storagePrefix}.sessionUser`);
      state.currentUser = savedUser ? JSON.parse(savedUser) : null;
      state.isLoaded = true;
      notify();
    },

    isLoaded() {
      return state.isLoaded;
    },

    get(name) {
      return app.help.clone(state.collections[name] || (name === "settings" ? {} : []));
    },

    set(name, value, options) {
      state.collections[name] = app.help.clone(value);
      if (!options || options.persist !== false) {
        persist(name);
      }
      notify();
    },

    update(name, updater) {
      const next = updater(app.help.clone(state.collections[name] || []));
      state.collections[name] = next;
      persist(name);
      notify();
      return app.help.clone(next);
    },

    getUser() {
      return state.currentUser ? app.help.clone(state.currentUser) : null;
    },

    setUser(user) {
      state.currentUser = user ? app.help.clone(user) : null;
      if (state.currentUser) {
        sessionStorage.setItem(`${app.setup.storagePrefix}.sessionUser`, JSON.stringify(state.currentUser));
      } else {
        sessionStorage.removeItem(`${app.setup.storagePrefix}.sessionUser`);
      }
      notify();
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    resetLocalData() {
      Object.keys(app.setup.dataFiles).forEach((name) => {
        localStorage.removeItem(storageKey(name));
        state.collections[name] = app.help.clone((window.RetailOpsSeedData || {})[name] || (name === "settings" ? {} : []));
      });
      notify();
    }
  };
}

// hash navigation
{
const routeHandlers = {};
  let currentRoute = null;

  function hasAccess(route, user) {
    return Boolean(user && route.roles.includes(user.Role));
  }

  function getRouteByHash(hash) {
    return app.setup.routes.find((route) => route.path === hash) || app.setup.routes[0];
  }

  function render() {
    const user = app.data.getUser();

    if (!user) {
      app.screens.renderLogin();
      return;
    }

    let route = getRouteByHash(window.location.hash || "#/dashboard");
    if (!hasAccess(route, user)) {
      route = app.setup.routes.find((item) => hasAccess(item, user)) || app.setup.routes[0];
      window.location.hash = route.path;
      return;
    }

    currentRoute = route;
    app.screens.renderShell(route);
    const outlet = document.querySelector("[data-route-outlet]");
    const handler = routeHandlers[route.id];

    if (outlet && handler) {
      handler(outlet);
    }
  }

  app.nav = {
    register(id, handler) {
      routeHandlers[id] = handler;
    },

    navigate(path) {
      window.location.hash = path;
    },

    current() {
      return currentRoute;
    },

    hasAccess,

    start() {
      window.addEventListener("hashchange", render);
      app.data.subscribe(() => {
        if (app.data.isLoaded()) {
          render();
        }
      });
      if (!window.location.hash) {
        window.location.hash = "#/dashboard";
      }
      render();
    }
  };
}

// toast messages
{
function ensureRegion() {
    let region = document.querySelector(".toast-region");
    if (!region) {
      region = document.createElement("div");
      region.className = "toast-region";
      region.setAttribute("aria-live", "polite");
      document.body.appendChild(region);
    }
    return region;
  }

  app.toast = {
    show(message, options) {
      const config = options || {};
      const region = ensureRegion();
      const toast = document.createElement("div");
      toast.className = `toast toast-${config.type || "info"}`;
      toast.innerHTML = `
        <strong>${app.help.escapeHtml(config.title || "RetailOps")}</strong>
        <span>${app.help.escapeHtml(message)}</span>
      `;
      region.appendChild(toast);

      window.setTimeout(() => {
        toast.remove();
      }, config.duration || 3600);
    },

    success(message, title) {
      app.toast.show(message, { type: "success", title: title || "Success" });
    },

    error(message, title) {
      app.toast.show(message, { type: "error", title: title || "Action failed" });
    },

    warning(message, title) {
      app.toast.show(message, { type: "warning", title: title || "Attention" });
    }
  };
}

// popup windows
{
function closeTopModal() {
    const modal = document.querySelector(".modal-backdrop");
    if (modal) {
      modal.remove();
    }
  }

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeTopModal();
    }
  });

  app.popup = {
    open(options) {
      const config = options || {};
      closeTopModal();

      const backdrop = document.createElement("div");
      backdrop.className = "modal-backdrop";
      backdrop.innerHTML = `
        <section class="modal-card ${config.size === "large" ? "modal-large" : ""}" role="dialog" aria-modal="true" aria-labelledby="modal-title">
          <header class="modal-header">
            <h2 class="modal-title" id="modal-title">${app.help.escapeHtml(config.title || "RetailOps")}</h2>
            <button class="icon-btn" type="button" data-modal-close aria-label="Close dialog">x</button>
          </header>
          <div class="modal-body"></div>
          <footer class="modal-footer"></footer>
        </section>
      `;

      const body = backdrop.querySelector(".modal-body");
      const footer = backdrop.querySelector(".modal-footer");

      if (typeof config.content === "string") {
        body.innerHTML = config.content;
      } else if (config.content) {
        body.appendChild(config.content);
      }

      const actions = config.actions || [{ label: "Close", variant: "secondary", action: closeTopModal }];
      actions.forEach((action) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = `btn btn-${action.variant || "secondary"}`;
        button.textContent = action.label;
        button.addEventListener("click", () => {
          if (action.action) {
            action.action(closeTopModal);
          } else {
            closeTopModal();
          }
        });
        footer.appendChild(button);
      });

      backdrop.addEventListener("click", (event) => {
        if (event.target === backdrop || event.target.matches("[data-modal-close]")) {
          closeTopModal();
        }
      });

      document.body.appendChild(backdrop);
      const focusTarget = backdrop.querySelector("input, select, textarea, button");
      if (focusTarget) {
        focusTarget.focus();
      }

      return {
        close: closeTopModal,
        element: backdrop
      };
    },

    confirm(options) {
      return new Promise((resolve) => {
        app.popup.open({
          title: options.title || "Confirm action",
          content: `<p class="section-copy">${app.help.escapeHtml(options.message || "Are you sure?")}</p>`,
          actions: [
            {
              label: options.cancelLabel || "Cancel",
              variant: "secondary",
              action: (close) => {
                close();
                resolve(false);
              }
            },
            {
              label: options.confirmLabel || "Confirm",
              variant: options.danger ? "danger" : "primary",
              action: (close) => {
                close();
                resolve(true);
              }
            }
          ]
        });
      });
    }
  };
}

// simple form maker
{
function createField(field, values) {
    const wrapper = document.createElement("label");
    wrapper.className = field.type === "checkbox" ? "checkbox-line" : "form-field";
    const id = `field-${field.name}-${Math.random().toString(16).slice(2)}`;
    const value = values[field.name] ?? field.defaultValue ?? "";

    if (field.type === "checkbox") {
      wrapper.innerHTML = `
        <input id="${id}" name="${field.name}" type="checkbox" ${value ? "checked" : ""}>
        <span>${app.help.escapeHtml(field.label)}</span>
      `;
      return wrapper;
    }

    const label = document.createElement("span");
    label.textContent = field.label;
    wrapper.appendChild(label);

    let control;
    if (field.type === "select") {
      control = document.createElement("select");
      control.className = "select";
      (field.options || []).forEach((option) => {
        const opt = document.createElement("option");
        opt.value = option.value;
        opt.textContent = option.label;
        if (String(option.value) === String(value)) {
          opt.selected = true;
        }
        control.appendChild(opt);
      });
    } else if (field.type === "textarea") {
      control = document.createElement("textarea");
      control.className = "textarea";
      control.value = value;
    } else {
      control = document.createElement("input");
      control.className = "input";
      control.type = field.type || "text";
      control.value = value;
      if (field.min !== undefined) {
        control.min = field.min;
      }
      if (field.step !== undefined) {
        control.step = field.step;
      }
    }

    control.id = id;
    control.name = field.name;
    if (field.required) {
      control.required = true;
    }
    if (field.placeholder) {
      control.placeholder = field.placeholder;
    }

    wrapper.appendChild(control);

    if (field.help) {
      const help = document.createElement("span");
      help.className = "field-help";
      help.textContent = field.help;
      wrapper.appendChild(help);
    }

    return wrapper;
  }

  app.forms = {
    create(fields, values, onSubmit, options) {
      const config = options || {};
      const form = document.createElement("form");
      form.className = "app-form";
      form.innerHTML = `<div class="form-grid"></div><div class="form-actions"></div>`;
      const grid = form.querySelector(".form-grid");
      const actions = form.querySelector(".form-actions");

      fields.forEach((field) => {
        grid.appendChild(createField(field, values || {}));
      });

      const cancel = document.createElement("button");
      cancel.type = "button";
      cancel.className = "btn btn-secondary";
      cancel.textContent = config.cancelLabel || "Cancel";
      cancel.addEventListener("click", () => {
        if (config.onCancel) {
          config.onCancel();
        } else {
          const close = document.querySelector("[data-modal-close]");
          if (close) {
            close.click();
          }
        }
      });

      const submit = document.createElement("button");
      submit.type = "submit";
      submit.className = "btn btn-primary";
      submit.textContent = config.submitLabel || "Save";

      actions.append(cancel, submit);

      form.addEventListener("submit", (event) => {
        event.preventDefault();
        const data = {};
        fields.forEach((field) => {
          const control = form.elements[field.name];
          if (!control) {
            return;
          }
          if (field.type === "checkbox") {
            data[field.name] = control.checked;
          } else if (field.type === "number") {
            data[field.name] = Number(control.value);
          } else {
            data[field.name] = control.value;
          }
        });

        try {
          onSubmit(data);
        } catch (error) {
          app.toast.error(error.message);
        }
      });

      return form;
    }
  };
}

// search box maker
{
let sequence = 0;

  app.searchBox = {
    create(options) {
      const config = options || {};
      const wrapper = document.createElement("div");
      const id = `global-search-${sequence += 1}`;
      const label = config.label || "Search";
      const value = String(config.value || "");
      const emit = typeof config.onChange === "function"
        ? (config.debounceMs === 0
          ? config.onChange
          : app.help.debounce(config.onChange, config.debounceMs ?? 80))
        : null;

      wrapper.className = `global-search ${config.className || ""}`.trim();
      wrapper.innerHTML = `
        <label class="sr-only" for="${id}">${app.help.escapeHtml(label)}</label>
        <input
          id="${id}"
          class="input global-search-input"
          type="search"
          autocomplete="off"
          spellcheck="false"
          placeholder="${app.help.escapeHtml(config.placeholder || "Search records")}"
          value="${app.help.escapeHtml(value)}"
        >
        <button class="global-search-clear" type="button" data-search-clear aria-label="Clear search" hidden>Clear</button>
      `;

      const input = wrapper.querySelector("input");
      const clear = wrapper.querySelector("[data-search-clear]");

      function updateClearState() {
        clear.hidden = input.value.length === 0;
      }

      input.addEventListener("input", () => {
        updateClearState();
        if (emit) {
          emit(input.value);
        }
      });

      clear.addEventListener("click", () => {
        input.value = "";
        updateClearState();
        input.focus();
        if (emit) {
          emit("");
        }
      });

      updateClearState();

      return {
        element: wrapper,
        input,
        setValue(nextValue, notify) {
          input.value = String(nextValue || "");
          updateClearState();
          if (notify && emit) {
            emit(input.value);
          }
        },
        focus() {
          input.focus();
        }
      };
    }
  };
}

// table maker
{
function getCellValue(row, column) {
    if (typeof column.value === "function") {
      return column.value(row);
    }
    return row[column.key];
  }

  function getSearchValue(row, key, columns) {
    if (typeof key === "function") {
      return key(row);
    }
    const column = columns.find((item) => item.key === key);
    if (column && typeof column.value === "function") {
      return column.value(row);
    }
    return row[key];
  }

  function actionLabel(action, row) {
    return typeof action.label === "function" ? action.label(row) : action.label;
  }

  function actionVisible(action, row) {
    return typeof action.visible === "function" ? action.visible(row) : action.visible !== false;
  }

  app.tables = {
    create(options) {
      const config = options || {};
      const container = document.createElement("section");
      container.className = "table-shell";

      let rows = config.data || [];
      let query = String(config.initialQuery || "");
      let page = 1;
      let sortKey = config.defaultSort || null;
      let sortDirection = "asc";
      const pageSize = config.pageSize || 8;
      const columns = config.columns || [];

      function filteredRows() {
        const normalized = app.help.normalizeText(query);
        let result = rows.filter((row) => {
          if (!normalized) {
            return true;
          }
          const configuredKeys = config.searchKeys || [];
          const keys = Array.from(new Set([...configuredKeys, ...columns.map((column) => column.key)]));
          return keys.some((key) => app.help.normalizeText(getSearchValue(row, key, columns)).includes(normalized));
        });

        if (sortKey) {
          const column = columns.find((item) => item.key === sortKey);
          if (column) {
            result = result.slice().sort((a, b) => {
              const compared = app.help.compareValues(getCellValue(a, column), getCellValue(b, column));
              return sortDirection === "asc" ? compared : compared * -1;
            });
          }
        }

        return result;
      }

      container.innerHTML = `
        <div class="table-toolbar">
          <div class="table-tools" data-table-title></div>
          <div class="table-tools table-tools-search">
            <div data-table-search-slot></div>
            <button class="btn btn-secondary" type="button" data-export>Export CSV</button>
          </div>
        </div>
        <div class="table-wrap">
          <table class="data-table">
            <thead>
              <tr>
                ${columns.map((column) => `
                  <th class="${column.sortable === false ? "" : "sortable"}" data-sort="${app.help.escapeHtml(column.key)}" scope="col">
                    ${app.help.escapeHtml(column.label)}
                  </th>
                `).join("")}
                ${config.actions ? "<th scope=\"col\">Actions</th>" : ""}
              </tr>
            </thead>
            <tbody></tbody>
          </table>
        </div>
        <div class="table-footer">
          <span data-record-count>0 records</span>
          <div class="pagination">
            <button class="btn btn-secondary" type="button" data-prev>Previous</button>
            <span data-page-status>Page 1 of 1</span>
            <button class="btn btn-secondary" type="button" data-next>Next</button>
          </div>
        </div>
      `;

      const title = container.querySelector("[data-table-title]");
      title.innerHTML = config.title ? `<strong>${app.help.escapeHtml(config.title)}</strong>` : "<span></span>";

      const tbody = container.querySelector("tbody");
      const recordCount = container.querySelector("[data-record-count]");
      const pageStatus = container.querySelector("[data-page-status]");
      const previous = container.querySelector("[data-prev]");
      const next = container.querySelector("[data-next]");
      const exportButton = container.querySelector("[data-export]");
      const searchSlot = container.querySelector("[data-table-search-slot]");

      const search = app.searchBox.create({
        label: `${config.title || "Table"} search`,
        placeholder: config.searchPlaceholder || "Search records",
        value: query,
        debounceMs: config.searchDebounceMs ?? 80,
        onChange(value) {
          query = value;
          page = 1;
          renderRows();
        }
      });
      searchSlot.appendChild(search.element);

      function renderHeaders() {
        container.querySelectorAll("[data-sort]").forEach((header) => {
          const active = sortKey === header.dataset.sort;
          header.classList.toggle("sorted", active);
          header.dataset.direction = active ? sortDirection : "";
          header.setAttribute("aria-sort", active ? (sortDirection === "asc" ? "ascending" : "descending") : "none");
        });
      }

      function renderRows() {
        const all = filteredRows();
        const pageCount = Math.max(1, Math.ceil(all.length / pageSize));
        page = Math.min(page, pageCount);
        const visible = all.slice((page - 1) * pageSize, page * pageSize);

        if (visible.length === 0) {
          const colspan = columns.length + (config.actions ? 1 : 0);
          tbody.innerHTML = `
            <tr>
              <td colspan="${colspan}">
                <div class="empty-state">
                  <div><strong>No records found</strong><span>${app.help.escapeHtml(config.emptyMessage || "Try adjusting the current filters.")}</span></div>
                </div>
              </td>
            </tr>
          `;
        } else {
          tbody.innerHTML = visible.map((row, index) => `
            <tr>
              ${columns.map((column) => {
                const value = getCellValue(row, column);
                const html = column.render ? column.render(row, value) : app.help.escapeHtml(value);
                return `<td>${html}</td>`;
              }).join("")}
              ${config.actions ? `<td><div class="toolbar-left">${config.actions.map((action, actionIndex) => ({ action, actionIndex }))
                .filter(({ action }) => actionVisible(action, row))
                .map(({ action, actionIndex }) => `
                <button class="${app.help.escapeHtml(action.className || "btn btn-secondary")}" type="button" data-action="${actionIndex}" data-index="${index}">${app.help.escapeHtml(actionLabel(action, row))}</button>
              `).join("") || `<span class="table-muted">-</span>`}</div></td>` : ""}
            </tr>
          `).join("");
        }

        if (config.actions) {
          tbody.querySelectorAll("[data-action]").forEach((button) => {
            button.addEventListener("click", () => {
              const row = visible[Number(button.dataset.index)];
              config.actions[Number(button.dataset.action)].handler(row);
            });
          });
        }

        recordCount.textContent = `${all.length} records`;
        pageStatus.textContent = `Page ${page} of ${pageCount}`;
        previous.disabled = page <= 1;
        next.disabled = page >= pageCount;
        renderHeaders();
      }

      container.querySelectorAll("[data-sort]").forEach((header) => {
        header.addEventListener("click", () => {
          const column = columns.find((item) => item.key === header.dataset.sort);
          if (column && column.sortable === false) {
            return;
          }
          if (sortKey === header.dataset.sort) {
            sortDirection = sortDirection === "asc" ? "desc" : "asc";
          } else {
            sortKey = header.dataset.sort;
            sortDirection = "asc";
          }
          page = 1;
          renderRows();
        });
      });

      previous.addEventListener("click", () => {
        page -= 1;
        renderRows();
      });

      next.addEventListener("click", () => {
        page += 1;
        renderRows();
      });

      exportButton.addEventListener("click", () => {
        const csv = app.help.toCsv(filteredRows(), columns);
        app.help.downloadFile(`${config.exportName || "retailops-export"}.csv`, csv, "text/csv;charset=utf-8");
      });

      renderRows();
      return container;
    }
  };
}

// small charts
{
app.chart = {
    bar(items, options) {
      const config = options || {};
      const max = Math.max(1, ...items.map((item) => Number(item.value || 0)));
      return `
        <div class="bar-chart" role="img" aria-label="${app.help.escapeHtml(config.label || "Bar chart")}">
          ${items.map((item) => {
            const value = Number(item.value || 0);
            const width = Math.max(3, (value / max) * 100);
            return `
              <div class="bar-row">
                <span class="bar-label">${app.help.escapeHtml(item.label)}</span>
                <span class="bar-track"><span class="bar-fill" style="width:${width}%"></span></span>
                <span class="bar-value">${app.help.escapeHtml(item.displayValue ?? value)}</span>
              </div>
            `;
          }).join("")}
        </div>
      `;
    },

    donut(value, label) {
      const safeValue = Math.max(0, Math.min(100, Number(value || 0)));
      return `
        <div class="donut" style="--value:${safeValue}">
          <strong>${Math.round(safeValue)}%</strong>
        </div>
        <div class="section-copy">${app.help.escapeHtml(label || "")}</div>
      `;
    },

    sparkline(values, options) {
      const config = options || {};
      const nums = (values || []).map(Number);
      const width = 520;
      const height = 100;
      const max = Math.max(1, ...nums);
      const min = Math.min(...nums, 0);
      const range = Math.max(1, max - min);
      const points = nums.map((value, index) => {
        const x = nums.length <= 1 ? 0 : (index / (nums.length - 1)) * width;
        const y = height - ((value - min) / range) * (height - 14) - 7;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      }).join(" ");

      return `
        <svg class="sparkline" viewBox="0 0 ${width} ${height}" role="img" aria-label="${app.help.escapeHtml(config.label || "Trend chart")}">
          <polyline fill="none" stroke="#0f62fe" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" points="${points}"></polyline>
          ${nums.map((value, index) => {
            const x = nums.length <= 1 ? 0 : (index / (nums.length - 1)) * width;
            const y = height - ((value - min) / range) * (height - 14) - 7;
            return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="4" fill="#0f62fe"></circle>`;
          }).join("")}
        </svg>
      `;
    }
  };
}

// login and page layout
{
let detachShellEvents = null;

  function allowedRoutes(user) {
    return app.setup.routes.filter((route) =>
      app.nav.hasAccess(route, user),
    );
  }

  function sidebar(user, currentRoute) {
    const groups = app.help.groupBy(
      allowedRoutes(user),
      (route) => route.section,
    );
    return `
      <aside class="sidebar" id="primary-sidebar" data-sidebar>
        <div class="brand">
          <div class="logo-box">R</div>
          <div>
            <span class="brand-title">RetailOps</span>
            <span class="brand-subtitle">Store project</span>
          </div>
        </div>
        <nav class="nav" aria-label="Primary navigation">
          ${Object.entries(groups)
            .map(
              ([section, routes]) => `
            <div class="nav-section-label">${app.help.escapeHtml(section)}</div>
            ${routes
              .map(
                (route) => `
              <a class="nav-link ${route.id === currentRoute.id ? "active" : ""}" href="${route.path}" title="${app.help.escapeHtml(route.title)}" data-nav-link>
                <span class="nav-icon">${app.help.escapeHtml(route.icon)}</span>
                <span>${app.help.escapeHtml(route.title)}</span>
              </a>
            `,
              )
              .join("")}
          `,
            )
            .join("")}
        </nav>
        <div class="sidebar-footer">
          <div class="user-card">
            <div class="user-name">${app.help.escapeHtml(user.Username)}</div>
            <div class="user-role">${app.help.escapeHtml(user.Role)}</div>
          </div>
        </div>
      </aside>
    `;
  }

  function attachShellEvents() {
    if (detachShellEvents) {
      detachShellEvents();
    }

    const subscriptions = [];
    const listen = (target, event, handler) => {
      if (!target) {
        return;
      }
      target.addEventListener(event, handler);
      subscriptions.push(() => target.removeEventListener(event, handler));
    };

    const logout = document.querySelector("[data-logout]");
    if (logout) {
      listen(logout, "click", () => {
        app.auth.logout();
        app.toast.success("Signed out successfully.");
      });
    }

    detachShellEvents = () => {
      subscriptions.forEach((unsubscribe) => unsubscribe());
      detachShellEvents = null;
    };
  }

  app.screens = {
    renderLogin() {
      document.getElementById("app").innerHTML = `
        <main class="login-page">
          <section class="login-visual">
            <div>
              <p class="hero-eyebrow">Retail inventory project</p>
              <h1>Simple stock, billing, promotion, and report screens in one browser app.</h1>
            </div>
            <p>This version keeps the same calculations and saved data, but the code is kept in plain HTML, CSS, and JavaScript for the training assignment.</p>
            <div class="login-pattern" aria-hidden="true">
              ${Array.from({ length: 12 })
                .map(
                  (_, index) =>
                    `<div class="pattern-cell" style="opacity:${0.55 + (index % 4) * 0.1}"></div>`,
                )
                .join("")}
            </div>
          </section>
          <section class="login-panel">
            <div class="auth-card">
              <div class="logo-box big-logo">R</div>
              <h2>Sign in</h2>
              <p>Use one of the sample users to open the app.</p>
              <form data-login-form class="app-form">
                <div class="field">
                  <label for="username">Username</label>
                  <input class="input" id="username" name="username" autocomplete="username" required>
                </div>
                <div class="field" style="margin-top:12px">
                  <label for="password">Password</label>
                  <input class="input" id="password" name="password" type="password" autocomplete="current-password" required>
                </div>
                <button class="btn btn-primary" type="submit" style="width:100%; margin-top:16px">Sign in</button>
              </form>
              <div class="demo-users">
                ${app.data
                  .get("users")
                  .map(
                    (user) => `
                  <button class="demo-user" type="button" data-demo-user="${app.help.escapeHtml(user.Username)}" data-demo-password="${app.help.escapeHtml(user.Password)}">
                    <span>${app.help.escapeHtml(user.Username)} / ${app.help.escapeHtml(user.Password)}</span>
                    <span>${app.help.escapeHtml(user.Role)}</span>
                  </button>
                `,
                  )
                  .join("")}
              </div>
            </div>
          </section>
        </main>
      `;

      const form = document.querySelector("[data-login-form]");
      form.addEventListener("submit", (event) => {
        event.preventDefault();
        const data = new FormData(form);
        try {
          app.auth.login(data.get("username"), data.get("password"));
          app.toast.success(`Welcome ${app.data.getUser().Username}.`);
          window.location.hash = "#/dashboard";
        } catch (error) {
          app.toast.error(error.message);
        }
      });

      document.querySelectorAll("[data-demo-user]").forEach((button) => {
        button.addEventListener("click", () => {
          form.username.value = button.dataset.demoUser;
          form.password.value = button.dataset.demoPassword;
          form.requestSubmit();
        });
      });
    },

    renderShell(route) {
      const user = app.data.getUser();
      const reportsRoute = app.setup.routes.find((item) => item.id === "reports");
      const canViewReports = reportsRoute && app.nav.hasAccess(reportsRoute, user);
      document.getElementById("app").innerHTML = `
        <div class="app-shell">
          ${sidebar(user, route)}
          <main class="main">
            <header class="topbar">
              <div>
                <div>
                  <h1 class="topbar-title">${app.help.escapeHtml(route.title)}</h1>
                  <div class="topbar-subtitle">${app.help.escapeHtml(route.subtitle)}</div>
                </div>
              </div>
              <div class="topbar-actions">
                ${canViewReports ? `<a class="btn btn-secondary" href="#/reports">Reports</a>` : ""}
                <button class="btn btn-ghost" type="button" data-logout>Logout</button>
              </div>
            </header>
            <section class="content">
              <div data-route-outlet></div>
            </section>
          </main>
        </div>
      `;
      attachShellEvents();
    },
  };
}

// activity log code
{
app.logs = {
    log(user, action, entityName, entityId, details) {
      app.data.update("activityLogs", (logs) => {
        const next = logs || [];
        next.push({
          AuditLogId: app.help.nextId(next, "AuditLogId", "AUD", 5),
          UserId: user?.UserId || "",
          Username: user?.Username || "System",
          Action: action,
          EntityName: entityName,
          EntityId: entityId,
          Details: details,
          CreatedAt: app.help.nowIso()
        });
        return next;
      });
    },

    getRecent(count) {
      return app.data.get("activityLogs")
        .sort((a, b) => new Date(b.CreatedAt) - new Date(a.CreatedAt))
        .slice(0, count || 50);
    }
  };
}

// login code
{
app.auth = {
    login(username, password) {
      const normalized = String(username || "").trim().toLowerCase();
      const user = app.data.get("users").find((item) =>
        String(item.Username).toLowerCase() === normalized &&
        item.Password === password &&
        item.IsActive
      );

      if (!user) {
        throw new Error("Invalid credentials or inactive user.");
      }

      app.data.setUser(user);
      app.logs.log(user, "Login", "User", user.UserId, "User signed in.");
      return user;
    },

    logout() {
      app.data.setUser(null);
      app.screens.renderLogin();
    }
  };
}

// product code
{
const validation = app.check;

  function ordered(products) {
    return products.sort((a, b) =>
      app.help.compareValues(a.Category, b.Category) ||
      app.help.compareValues(a.Name, b.Name)
    );
  }

  app.products = {
    getProducts() {
      return ordered(app.data.get("products"));
    },

    getBySku(sku) {
      const normalized = validation.normalizeSku(sku);
      return app.data.get("products").find((product) => product.SKU.toUpperCase() === normalized) || null;
    },

    getById(productId) {
      return app.data.get("products").find((product) =>
        String(product.ProductId).toLowerCase() === String(productId || "").toLowerCase()
      ) || null;
    },

    addProduct(product) {
      validation.assertProduct(product);
      const products = app.data.get("products");
      const normalizedSku = validation.normalizeSku(product.SKU);
      const exists = products.some((item) => item.SKU.toUpperCase() === normalizedSku);

      if (exists) {
        throw new Error("A product with this SKU already exists.");
      }

      const created = {
        ProductId: app.help.nextId(products, "ProductId", "PROD", 3),
        Name: String(product.Name).trim(),
        SKU: normalizedSku,
        Category: String(product.Category || "").trim(),
        Price: Number(product.Price),
        ReorderThreshold: Number(product.ReorderThreshold),
        SupplierId: String(product.SupplierId || "").trim(),
        IsActive: true,
        CreatedAt: app.help.nowIso(),
        UpdatedAt: app.help.nowIso()
      };

      app.data.set("products", [...products, created]);
      app.logs.log(app.data.getUser(), "AddProduct", "Product", created.ProductId, `Added product ${created.SKU}.`);
      return created;
    },

    updateProduct(product) {
      validation.assertProduct(product);
      const products = app.data.get("products");
      const existing = products.find((item) => item.ProductId === product.ProductId);

      if (!existing) {
        throw new Error("Product not found.");
      }

      const normalizedSku = validation.normalizeSku(product.SKU);
      const skuTaken = products.some((item) =>
        item.ProductId !== product.ProductId &&
        item.SKU.toUpperCase() === normalizedSku
      );

      if (skuTaken) {
        throw new Error("Another product already uses this SKU.");
      }

      const updated = products.map((item) => item.ProductId === product.ProductId
        ? {
            ...item,
            Name: String(product.Name).trim(),
            SKU: normalizedSku,
            Category: String(product.Category || "").trim(),
            Price: Number(product.Price),
            ReorderThreshold: Number(product.ReorderThreshold),
            SupplierId: String(product.SupplierId || "").trim(),
            IsActive: Boolean(product.IsActive),
            UpdatedAt: app.help.nowIso()
          }
        : item);

      app.data.set("products", updated);
      app.logs.log(app.data.getUser(), "UpdateProduct", "Product", product.ProductId, `Updated product ${normalizedSku}.`);
    },

    setProductStatus(productId, isActive) {
      let found = false;
      const active = Boolean(isActive);
      const products = app.data.get("products").map((product) => {
        if (product.ProductId === productId) {
          found = true;
          return { ...product, IsActive: active, UpdatedAt: app.help.nowIso() };
        }
        return product;
      });

      if (found) {
        app.data.set("products", products);
        app.logs.log(
          app.data.getUser(),
          active ? "ActivateProduct" : "DeactivateProduct",
          "Product",
          productId,
          active ? "Product activated." : "Product deactivated."
        );
      }

      return found;
    },

    activateProduct(productId) {
      return this.setProductStatus(productId, true);
    },

    deactivateProduct(productId) {
      return this.setProductStatus(productId, false);
    }
  };
}

// sku code
{
app.skus = {
    getSkus() {
      const products = app.data.get("products");
      return app.data.get("skus")
        .map((sku) => ({
          ...sku,
          ProductName: products.find((product) => product.ProductId === sku.ProductId)?.Name || "Unknown"
        }))
        .sort((a, b) => app.help.compareValues(a.SKU, b.SKU));
    },

    addSku(payload) {
      const skus = app.data.get("skus");
      const product = app.products.getById(payload.ProductId);
      if (!product) {
        throw new Error("SKU must be linked to an existing product.");
      }

      const normalizedSku = app.check.normalizeSku(payload.SKU || product.SKU);
      const exists = skus.some((sku) => sku.SKU.toUpperCase() === normalizedSku);
      if (exists) {
        throw new Error("A SKU record already exists for this code.");
      }

      const created = {
        SkuId: app.help.nextId(skus, "SkuId", "SKU", 3),
        ProductId: product.ProductId,
        SKU: normalizedSku,
        Barcode: String(payload.Barcode || "").trim(),
        Uom: String(payload.Uom || "").trim(),
        PackSize: String(payload.PackSize || "").trim(),
        CasePack: Math.max(1, Number(payload.CasePack || 1)),
        ShelfLifeDays: Math.max(0, Number(payload.ShelfLifeDays || 0)),
        Channel: String(payload.Channel || "Ambient").trim(),
        IsActive: Boolean(payload.IsActive ?? true)
      };

      app.data.set("skus", [...skus, created]);
      app.logs.log(app.data.getUser(), "AddSku", "SKU", created.SkuId, `Added SKU ${created.SKU}.`);
      return created;
    },

    updateSku(payload) {
      const skus = app.data.get("skus");
      const existing = skus.find((sku) => sku.SkuId === payload.SkuId);
      if (!existing) {
        throw new Error("SKU record not found.");
      }

      const normalizedSku = app.check.normalizeSku(payload.SKU);
      const skuTaken = skus.some((sku) => sku.SkuId !== payload.SkuId && sku.SKU.toUpperCase() === normalizedSku);
      if (skuTaken) {
        throw new Error("Another SKU record already uses this code.");
      }

      app.data.set("skus", skus.map((sku) => sku.SkuId === payload.SkuId
        ? {
            ...sku,
            ProductId: payload.ProductId,
            SKU: normalizedSku,
            Barcode: String(payload.Barcode || "").trim(),
            Uom: String(payload.Uom || "").trim(),
            PackSize: String(payload.PackSize || "").trim(),
            CasePack: Math.max(1, Number(payload.CasePack || 1)),
            ShelfLifeDays: Math.max(0, Number(payload.ShelfLifeDays || 0)),
            Channel: String(payload.Channel || "Ambient").trim(),
            IsActive: Boolean(payload.IsActive)
          }
        : sku));
      app.logs.log(app.data.getUser(), "UpdateSku", "SKU", payload.SkuId, `Updated SKU ${normalizedSku}.`);
    }
  };
}

// inventory code
{
const validation = app.check;

  function enrich(inventory) {
    const products = app.data.get("products");
    const warehouses = app.data.get("warehouses");
    return inventory.map((item) => {
      const product = products.find((p) =>
        p.ProductId === item.ProductId ||
        p.SKU.toUpperCase() === String(item.SKU).toUpperCase()
      );
      const warehouse = warehouses.find((w) => w.WarehouseId === item.WarehouseId);
      return {
        ...item,
        ProductName: product?.Name || "Unknown",
        Category: product?.Category || "",
        ReorderThreshold: Number(product?.ReorderThreshold || 0),
        WarehouseName: warehouse?.Name || item.WarehouseId
      };
    });
  }

  app.stock = {
    getInventory() {
      return enrich(app.data.get("inventory"))
        .sort((a, b) => app.help.compareValues(a.SKU, b.SKU) || app.help.compareValues(a.WarehouseId, b.WarehouseId));
    },

    getBySku(sku) {
      const normalized = validation.normalizeSku(sku);
      return this.getInventory().find((item) => item.SKU.toUpperCase() === normalized) || null;
    },

    totalStockBySku(sku) {
      const normalized = validation.normalizeSku(sku);
      return app.help.sum(app.data.get("inventory").filter((item) => item.SKU.toUpperCase() === normalized), (item) => item.QuantityAvailable);
    },

    addInventory(inventory) {
      validation.assertInventory(inventory);
      const list = app.data.get("inventory");
      const normalizedSku = validation.normalizeSku(inventory.SKU);
      const product = app.data.get("products").find((item) =>
        item.SKU.toUpperCase() === normalizedSku ||
        String(item.ProductId).toLowerCase() === String(inventory.ProductId || "").toLowerCase()
      );

      if (!product) {
        throw new Error("Inventory must be linked to an existing product.");
      }

      const warehouseId = String(inventory.WarehouseId || "MAIN").trim().toUpperCase();
      const duplicate = list.some((item) =>
        item.SKU.toUpperCase() === product.SKU.toUpperCase() &&
        String(item.WarehouseId).toUpperCase() === warehouseId
      );

      if (duplicate) {
        throw new Error("Inventory already exists for this SKU and warehouse.");
      }

      const created = {
        InventoryId: app.help.nextId(list, "InventoryId", "INV", 3),
        ProductId: product.ProductId,
        SKU: product.SKU,
        QuantityAvailable: Number(inventory.QuantityAvailable),
        SafetyStock: Number(inventory.SafetyStock),
        WarehouseId: warehouseId,
        LastUpdatedAt: app.help.nowIso()
      };

      app.data.set("inventory", [...list, created]);
      app.logs.log(app.data.getUser(), "AddInventory", "Inventory", created.InventoryId, `Added inventory for ${created.SKU}.`);
      return created;
    },

    updateStock(sku, quantity, warehouseId) {
      const normalizedSku = validation.normalizeSku(sku);
      const list = app.data.get("inventory");
      const index = list.findIndex((item) =>
        item.SKU.toUpperCase() === normalizedSku &&
        (!warehouseId || String(item.WarehouseId).toUpperCase() === String(warehouseId).toUpperCase())
      );

      if (index < 0) {
        throw new Error("Inventory not found.");
      }

      const updatedQuantity = Number(list[index].QuantityAvailable) + Number(quantity);
      if (updatedQuantity < 0) {
        throw new Error("Stock cannot be negative.");
      }

      list[index].QuantityAvailable = updatedQuantity;
      list[index].LastUpdatedAt = app.help.nowIso();
      app.data.set("inventory", list);
      app.logs.log(app.data.getUser(), "AdjustStock", "Inventory", normalizedSku, `Adjusted stock by ${quantity}.`);
    },

    deductStock(inventoryList, sku, quantity) {
      let remaining = Number(quantity);
      inventoryList
        .filter((item) => item.SKU.toUpperCase() === validation.normalizeSku(sku))
        .sort((a, b) => Number(a.QuantityAvailable) - Number(b.QuantityAvailable))
        .forEach((item) => {
          if (remaining === 0) {
            return;
          }
          const deduction = Math.min(Number(item.QuantityAvailable), remaining);
          item.QuantityAvailable -= deduction;
          item.LastUpdatedAt = app.help.nowIso();
          remaining -= deduction;
        });
    }
  };
}

// promotion code
{
const validation = app.check;

  function isActiveOn(promotion, effectiveDate) {
    return Boolean(promotion.IsActive) && app.help.isBetweenDateInclusive(effectiveDate, promotion.StartDate, promotion.EndDate);
  }

  function isApplicable(promotion, product, quantity) {
    if (Number(quantity) < Math.max(1, Number(promotion.MinimumQuantity || 1))) {
      return false;
    }

    const hasScope = Boolean(promotion.ProductId || promotion.SKU || promotion.Category);
    if (!hasScope) {
      return true;
    }

    return String(promotion.ProductId || "").toLowerCase() === String(product.ProductId || "").toLowerCase() ||
      String(promotion.SKU || "").toLowerCase() === String(product.SKU || "").toLowerCase() ||
      String(promotion.Category || "").toLowerCase() === String(product.Category || "").toLowerCase();
  }

  function calculateDiscount(promotion, unitPrice, quantity, lineSubtotal) {
    let discount = 0;
    if (promotion.Type === "Percentage") {
      discount = lineSubtotal * Math.min(Number(promotion.DiscountValue), 100) / 100;
    } else if (promotion.Type === "FlatDiscount") {
      discount = Number(promotion.DiscountValue);
    } else if (promotion.Type === "BuyOneGetOne") {
      discount = Number(unitPrice) * Math.floor(Number(quantity) / 2);
    } else if (promotion.Type === "ComboOffer") {
      discount = Number(quantity) >= Number(promotion.MinimumQuantity || 1)
        ? lineSubtotal * Math.min(Number(promotion.DiscountValue), 100) / 100
        : 0;
    }

    return app.help.roundMoney(Math.min(discount, lineSubtotal));
  }

  function cleanPromotion(promotion) {
    return {
      ...promotion,
      Name: String(promotion.Name || "").trim(),
      SKU: promotion.SKU ? validation.normalizeSku(promotion.SKU) : null,
      ProductId: promotion.ProductId ? String(promotion.ProductId).trim() : null,
      Category: promotion.Category ? String(promotion.Category).trim() : null,
      DiscountValue: promotion.Type === "BuyOneGetOne" ? 0 : Number(promotion.DiscountValue),
      MinimumQuantity: Math.max(1, Number(promotion.MinimumQuantity || 1))
    };
  }

  app.promos = {
    calculateDiscount,
    isApplicable,
    isActiveOn,

    addPromotion(promotion) {
      validation.assertPromotion(promotion);
      const promotions = app.data.get("promotions");
      const created = cleanPromotion({
        ...promotion,
        PromotionId: app.help.nextId(promotions, "PromotionId", "PROMO", 3),
        IsActive: true
      });
      app.data.set("promotions", [...promotions, created]);
      app.logs.log(app.data.getUser(), "AddPromotion", "Promotion", created.PromotionId, `Added promotion ${created.Name}.`);
      return created;
    },

    updatePromotion(promotion) {
      validation.assertPromotion(promotion);
      const promotions = app.data.get("promotions");
      const existing = promotions.find((item) => item.PromotionId === promotion.PromotionId);
      if (!existing) {
        throw new Error("Promotion not found.");
      }

      app.data.set("promotions", promotions.map((item) => item.PromotionId === promotion.PromotionId ? cleanPromotion(promotion) : item));
      app.logs.log(app.data.getUser(), "UpdatePromotion", "Promotion", promotion.PromotionId, `Updated promotion ${promotion.Name}.`);
    },

    setPromotionStatus(promotionId, isActive) {
      let found = false;
      const promotions = app.data.get("promotions").map((promotion) => {
        if (promotion.PromotionId === promotionId) {
          found = true;
          return { ...promotion, IsActive: Boolean(isActive) };
        }
        return promotion;
      });
      if (found) {
        app.data.set("promotions", promotions);
        app.logs.log(
          app.data.getUser(),
          Boolean(isActive) ? "ActivatePromotion" : "DeactivatePromotion",
          "Promotion",
          promotionId,
          Boolean(isActive) ? "Promotion activated." : "Promotion deactivated."
        );
      }
      return found;
    },

    activatePromotion(promotionId) {
      return this.setPromotionStatus(promotionId, true);
    },

    deactivatePromotion(promotionId) {
      return this.setPromotionStatus(promotionId, false);
    },

    getPromotions() {
      return app.data.get("promotions")
        .sort((a, b) => Number(b.IsActive) - Number(a.IsActive) || new Date(a.EndDate) - new Date(b.EndDate));
    },

    getActivePromotions(asOf) {
      const effectiveDate = app.help.toDateOnly(asOf || new Date());
      return app.data.get("promotions")
        .filter((promotion) => isActiveOn(promotion, effectiveDate))
        .sort((a, b) => new Date(a.EndDate) - new Date(b.EndDate));
    },

    getBestDiscount(product, quantity) {
      const lineSubtotal = Number(product.Price) * Number(quantity);
      const best = this.getActivePromotions()
        .filter((promotion) => isApplicable(promotion, product, quantity))
        .map((promotion) => ({
          Promotion: promotion,
          Discount: calculateDiscount(promotion, product.Price, quantity, lineSubtotal)
        }))
        .sort((a, b) => b.Discount - a.Discount)[0];

      return best || { Promotion: null, Discount: 0 };
    }
  };
}

// billing code
{
function generateOrderId(orders) {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    const prefix = `ORD${yyyy}${mm}${dd}`;
    const lastNumber = Math.max(0, ...orders
      .filter((order) => String(order.OrderId || "").startsWith(prefix))
      .map((order) => Number.parseInt(String(order.OrderId).slice(prefix.length), 10) || 0));
    return `${prefix}${String(lastNumber + 1).padStart(4, "0")}`;
  }

  function failure(message, order) {
    return { Success: false, Message: message, Order: order || null };
  }

  function normalizeManualDiscount(discount) {
    const type = discount?.Type || discount?.type || "None";
    const value = Number(discount?.Value ?? discount?.value ?? 0);
    return {
      Type: ["Percentage", "FlatAmount"].includes(type) ? type : "None",
      Value: Number.isFinite(value) ? value : 0
    };
  }

  function calculateManualDiscount(subtotal, promotionDiscountTotal, discount) {
    const normalized = normalizeManualDiscount(discount);
    if (normalized.Type === "None" || Number(normalized.Value) === 0) {
      return { Success: true, Type: "None", Value: 0, Amount: 0 };
    }

    if (normalized.Value < 0) {
      return failure("Discount cannot be negative.");
    }

    const discountBase = app.help.roundMoney(Math.max(0, Number(subtotal) - Number(promotionDiscountTotal)));
    let amount = 0;

    if (normalized.Type === "Percentage") {
      if (normalized.Value > 100) {
        return failure("Discount cannot exceed subtotal.");
      }
      amount = app.help.roundMoney(discountBase * normalized.Value / 100);
    } else if (normalized.Type === "FlatAmount") {
      amount = app.help.roundMoney(normalized.Value);
    }

    if (amount > discountBase) {
      return failure("Discount cannot exceed subtotal.");
    }

    return {
      Success: true,
      Type: normalized.Type,
      Value: normalized.Value,
      Amount: amount
    };
  }

  function normalizeCartItems(items) {
    const grouped = app.help.groupBy(
      (items || [])
        .map((item) => ({
          SKU: app.check.normalizeSku(item.SKU),
          Quantity: Math.max(0, Math.trunc(Number(item.Quantity) || 0))
        }))
        .filter((item) => item.SKU && item.Quantity > 0),
      (item) => item.SKU
    );

    return Object.keys(grouped).map((sku) => ({
      SKU: sku,
      Quantity: app.help.sum(grouped[sku], (item) => item.Quantity)
    }));
  }

  function buildOrder(requestedItems, cashierUserId, cashierName, customerName, manualDiscount) {
    const requests = normalizeCartItems(requestedItems);
    if (requests.length === 0) {
      return failure("Cart is empty.");
    }

    const products = app.data.get("products");
    const inventoryList = app.data.get("inventory");
    const grouped = app.help.groupBy(
      requests,
      (item) => app.check.normalizeSku(item.SKU)
    );

    const finalItems = [];
    for (const sku of Object.keys(grouped)) {
      const quantity = app.help.sum(grouped[sku], (item) => item.Quantity);
      const product = products.find((item) => item.IsActive && item.SKU.toUpperCase() === sku);

      if (!product) {
        return failure(`Product with SKU ${sku} was not found.`);
      }

      const availableStock = app.help.sum(
        inventoryList.filter((item) => item.SKU.toUpperCase() === sku),
        (item) => item.QuantityAvailable
      );

      if (availableStock < quantity) {
        return failure(`Insufficient stock for ${product.Name}. Available: ${availableStock}.`);
      }

      const lineSubtotal = Number(product.Price) * Number(quantity);
      const best = app.promos.getBestDiscount(product, quantity);
      finalItems.push({
        ProductId: product.ProductId,
        SKU: product.SKU,
        ProductName: product.Name,
        Quantity: quantity,
        UnitPrice: Number(product.Price),
        DiscountAmount: best.Discount,
        LineTotal: app.help.roundMoney(lineSubtotal - best.Discount),
        PromotionId: best.Promotion?.PromotionId || null,
        PromotionName: best.Promotion?.Name || null
      });
    }

    if (finalItems.length === 0) {
      return failure("Cart does not contain any billable items.");
    }

    const subtotal = app.help.roundMoney(app.help.sum(finalItems, (item) => item.UnitPrice * item.Quantity));
    const promotionDiscountTotal = app.help.roundMoney(app.help.sum(finalItems, (item) => item.DiscountAmount));
    const manual = calculateManualDiscount(subtotal, promotionDiscountTotal, manualDiscount);
    if (!manual.Success) {
      return manual;
    }

    const discountTotal = app.help.roundMoney(promotionDiscountTotal + manual.Amount);
    const taxableAmount = app.help.roundMoney(subtotal - discountTotal);
    const taxAmount = app.help.roundMoney(taxableAmount * app.setup.taxRate);
    const totalAmount = app.help.roundMoney(taxableAmount + taxAmount);

    return {
      Success: true,
      Message: "Bill preview generated.",
      Order: {
        OrderId: "",
        CustomerName: String(customerName || "").trim() || "Walk-in Customer",
        CashierUserId: cashierUserId || "",
        CashierName: cashierName || "",
        Items: finalItems,
        Subtotal: subtotal,
        PromotionDiscountTotal: promotionDiscountTotal,
        ManualDiscountType: manual.Type,
        ManualDiscountValue: manual.Value,
        ManualDiscountAmount: manual.Amount,
        DiscountTotal: discountTotal,
        TaxAmount: taxAmount,
        TotalAmount: totalAmount,
        PaidAmount: 0,
        ChangeDue: 0,
        Status: "Preview"
      }
    };
  }

  app.bills = {
    previewBill(cartItems, manualDiscount) {
      return buildOrder(cartItems, "", "", "", manualDiscount);
    },

    validateCartItemAvailability(cartItems, sku, additionalQuantity) {
      const normalizedSku = app.check.normalizeSku(sku);
      const rawQuantity = Number(additionalQuantity || 0);
      const quantity = Number.isFinite(rawQuantity) && rawQuantity > 0 ? Math.trunc(rawQuantity) : 0;
      const requestedQuantity = app.help.sum(normalizeCartItems(cartItems), (item) =>
        app.check.normalizeSku(item.SKU) === normalizedSku ? item.Quantity : 0
      ) + quantity;
      const product = app.products.getBySku(normalizedSku);

      if (!product || !product.IsActive) {
        return { Success: false, Message: "Product is not available." };
      }

      const availableStock = app.stock.totalStockBySku(normalizedSku);
      if (availableStock < requestedQuantity) {
        return { Success: false, Message: "Item is out of stock", AvailableStock: availableStock };
      }

      return { Success: true, AvailableStock: availableStock };
    },

    createBill(cartItems, cashierUserId, cashierName, customerName, paidAmount, manualDiscount) {
      const result = buildOrder(cartItems, cashierUserId, cashierName, customerName, manualDiscount);
      if (!result.Success || !result.Order) {
        return result;
      }

      if (Number(paidAmount) < Number(result.Order.TotalAmount)) {
        return failure(`Paid amount is short by ${app.fmt.currency(result.Order.TotalAmount - Number(paidAmount))}.`, result.Order);
      }

      const orders = app.data.get("orders");
      const inventoryList = app.data.get("inventory");
      result.Order.Items.forEach((item) => {
        app.stock.deductStock(inventoryList, item.SKU, item.Quantity);
      });

      result.Order.OrderId = generateOrderId(orders);
      result.Order.PaidAmount = Number(paidAmount);
      result.Order.ChangeDue = app.help.roundMoney(Number(paidAmount) - Number(result.Order.TotalAmount));
      result.Order.CreatedAt = app.help.nowIso();
      result.Order.Status = "Completed";

      app.data.set("inventory", inventoryList);
      app.data.set("orders", [...orders, result.Order]);
      app.logs.log(
        { UserId: cashierUserId, Username: cashierName },
        "CreateBill",
        "Order",
        result.Order.OrderId,
        `Order completed for ${result.Order.TotalAmount.toFixed(2)}.`
      );
      result.Message = "Bill created successfully.";
      return result;
    },

    getRecentOrders(count) {
      return app.data.get("orders")
        .sort((a, b) => new Date(b.CreatedAt) - new Date(a.CreatedAt))
        .slice(0, count || 20);
    }
  };
}

// replenishment code
{
function generateResult(inventory, product) {
    const lowStock = Number(inventory.QuantityAvailable) <= Number(product.ReorderThreshold);
    const suggestedQuantity = Math.max(
      0,
      Number(product.ReorderThreshold) + Number(inventory.SafetyStock) - Number(inventory.QuantityAvailable)
    );

    return {
      ProductId: product.ProductId,
      SKU: product.SKU,
      ProductName: product.Name,
      WarehouseId: inventory.WarehouseId,
      CurrentStock: Number(inventory.QuantityAvailable),
      ReorderThreshold: Number(product.ReorderThreshold),
      SafetyStock: Number(inventory.SafetyStock),
      SuggestedQuantity: suggestedQuantity,
      IsLowStock: lowStock,
      LastUpdatedAt: inventory.LastUpdatedAt,
      SupplierId: product.SupplierId
    };
  }

  function setRequestStatus(replenishmentId, status) {
    const user = app.data.getUser();
    const now = app.help.nowIso();
    let updatedRecord = null;
    const approved = status === "Approved";
    const rejected = status === "Rejected";
    const records = app.data.get("replenishment").map((record) => {
      if (record.ReplenishmentId !== replenishmentId) {
        return record;
      }

      updatedRecord = {
        ...record,
        ApprovedQuantity: approved && Number(record.ApprovedQuantity) <= 0
          ? Number(record.SuggestedQuantity || 0)
          : Number(record.ApprovedQuantity || 0),
        Status: status,
        UpdatedAt: now,
        UpdatedBy: user?.Username || "System",
        ApprovedAt: approved ? now : record.ApprovedAt || null,
        ApprovedBy: approved ? user?.Username || "System" : record.ApprovedBy || "",
        RejectedAt: rejected ? now : record.RejectedAt || null,
        RejectedBy: rejected ? user?.Username || "System" : record.RejectedBy || ""
      };
      return updatedRecord;
    });

    if (!updatedRecord) {
      return null;
    }

    app.data.set("replenishment", records);
    app.logs.log(
      user,
      approved ? "ApproveReplenishment" : "RejectReplenishment",
      "Replenishment",
      replenishmentId,
      `${status} replenishment for ${updatedRecord.SKU}.`
    );
    return updatedRecord;
  }

  app.restock = {
    generateReplenishmentReport() {
      const products = app.data.get("products");
      return app.data.get("inventory")
        .map((inventory) => {
          const product = products.find((item) =>
            item.ProductId === inventory.ProductId ||
            item.SKU.toUpperCase() === String(inventory.SKU).toUpperCase()
          );
          return product ? generateResult(inventory, product) : null;
        })
        .filter(Boolean)
        .sort((a, b) => Number(b.IsLowStock) - Number(a.IsLowStock) || app.help.compareValues(a.SKU, b.SKU));
    },

    createRequest(row, approvedQuantity) {
      const records = app.data.get("replenishment");
      const user = app.data.getUser();
      const created = {
        ReplenishmentId: app.help.nextId(records, "ReplenishmentId", "REP", 3),
        SKU: row.SKU,
        ProductId: row.ProductId,
        WarehouseId: row.WarehouseId,
        SuggestedQuantity: Number(row.SuggestedQuantity),
        ApprovedQuantity: Number(approvedQuantity || row.SuggestedQuantity),
        Status: Number(approvedQuantity || row.SuggestedQuantity) > 0 ? "Approved" : "Pending",
        CreatedAt: app.help.nowIso(),
        CreatedBy: user?.Username || "System",
        SupplierId: row.SupplierId
      };

      app.data.set("replenishment", [...records, created]);
      app.logs.log(user, "CreateReplenishment", "Replenishment", created.ReplenishmentId, `Created replenishment for ${created.SKU}.`);
      return created;
    },

    approveRequest(replenishmentId) {
      return setRequestStatus(replenishmentId, "Approved");
    },

    rejectRequest(replenishmentId) {
      return setRequestStatus(replenishmentId, "Rejected");
    }
  };
}

// forecast code
{
app.forecast = {
    getForecastRows() {
      const products = app.data.get("products");
      const suppliers = app.data.get("suppliers");
      const forecast = app.data.get("forecast");

      return forecast.map((item) => {
        const product = products.find((p) => p.ProductId === item.ProductId || p.SKU === item.SKU);
        const supplier = suppliers.find((s) => s.SupplierId === product?.SupplierId);
        const stock = app.stock.totalStockBySku(item.SKU);
        const averageWeeklyDemand = app.help.avg(item.WeeklyDemand || [], (value) => value);
        const effectiveDailyDemand = (averageWeeklyDemand / 7) * Number(item.SeasonalityIndex || 1) * Number(item.PromoLift || 1);
        const projectedDemand = Math.round(effectiveDailyDemand * Number(item.HorizonDays || 21));
        const daysOfCover = effectiveDailyDemand > 0 ? stock / effectiveDailyDemand : 999;
        const stockoutDate = daysOfCover >= 999 ? null : app.help.addDays(app.help.todayDateOnly(), Math.floor(daysOfCover));
        const leadTime = Number(supplier?.LeadTimeDays || 0);
        const risk = stock === 0 ? "Out of stock" : daysOfCover <= leadTime ? "Critical" : daysOfCover <= leadTime + 5 ? "Watch" : "Stable";

        return {
          ...item,
          ProductName: product?.Name || "Unknown",
          Category: product?.Category || "",
          SupplierName: supplier?.Name || "",
          StockOnHand: stock,
          AverageWeeklyDemand: averageWeeklyDemand,
          EffectiveDailyDemand: effectiveDailyDemand,
          ProjectedDemand: projectedDemand,
          DaysOfCover: daysOfCover,
          StockoutDate: stockoutDate,
          LeadTimeDays: leadTime,
          Risk: risk
        };
      }).sort((a, b) => app.help.compareValues(a.Risk, b.Risk) || app.help.compareValues(a.SKU, b.SKU));
    }
  };
}

// report code
{
function normalizeFilters(filtersOrFrom, to) {
    if (filtersOrFrom && typeof filtersOrFrom === "object" && !Array.isArray(filtersOrFrom)) {
      return filtersOrFrom;
    }
    return { from: filtersOrFrom, to };
  }

  function dateInRange(value, from, to) {
    const target = app.help.toDate(value);
    const start = from ? app.help.toDateOnly(from) : null;
    const end = to ? app.help.addDays(app.help.toDateOnly(to), 1) : null;
    return (!start || target >= start) && (!end || target < end);
  }

  function dateRangesOverlap(startValue, endValue, from, to) {
    const start = app.help.toDateOnly(startValue);
    const end = app.help.toDateOnly(endValue);
    const filterStart = from ? app.help.toDateOnly(from) : null;
    const filterEnd = to ? app.help.toDateOnly(to) : null;

    if (!start || !end) {
      return true;
    }
    if (filterStart && end < filterStart) {
      return false;
    }
    if (filterEnd && start > filterEnd) {
      return false;
    }
    return true;
  }

  function productForItem(item) {
    return app.products.getById(item.ProductId) || app.products.getBySku(item.SKU);
  }

  function selectedProduct(filters) {
    return filters.productId ? app.products.getById(filters.productId) : null;
  }

  function matchesText(values, query) {
    const normalized = app.help.normalizeText(query);
    if (!normalized) {
      return true;
    }
    return values.some((value) => app.help.normalizeText(value).includes(normalized));
  }

  function orderMatchesProductFilters(order, filters) {
    if (!filters.productId && !filters.category) {
      return true;
    }

    return (order.Items || []).some((item) => {
      const product = productForItem(item);
      const categoryMatches = !filters.category || app.help.normalizeText(product?.Category) === app.help.normalizeText(filters.category);
      const productMatches = !filters.productId || String(item.ProductId || product?.ProductId || "") === String(filters.productId);
      return categoryMatches && productMatches;
    });
  }

  function filterSalesOrders(filters) {
    return app.data.get("orders")
      .filter((order) => dateInRange(order.CreatedAt, filters.from, filters.to))
      .filter((order) => !filters.status || app.help.normalizeText(order.Status) === app.help.normalizeText(filters.status))
      .filter((order) => !filters.userId || String(order.CashierUserId || "") === String(filters.userId))
      .filter((order) => orderMatchesProductFilters(order, filters))
      .filter((order) => matchesText([
        order.OrderId,
        order.CustomerName,
        order.CashierName,
        order.Status,
        ...(order.Items || []).flatMap((item) => {
          const product = productForItem(item);
          return [item.SKU, item.ProductName, product?.Category];
        })
      ], filters.query))
      .sort((a, b) => new Date(a.CreatedAt) - new Date(b.CreatedAt));
  }

  function filterStockRows(filters) {
    return app.restock.generateReplenishmentReport()
      .filter((item) => (!filters.from && !filters.to) || dateInRange(item.LastUpdatedAt, filters.from, filters.to))
      .filter((item) => {
        const status = item.IsLowStock ? "Low" : "Healthy";
        return filters.status
          ? app.help.normalizeText(status) === app.help.normalizeText(filters.status)
          : item.IsLowStock;
      })
      .filter((item) => !filters.category || app.help.normalizeText(app.products.getById(item.ProductId)?.Category) === app.help.normalizeText(filters.category))
      .filter((item) => !filters.productId || String(item.ProductId || "") === String(filters.productId))
      .filter((item) => matchesText([
        item.SKU,
        item.ProductName,
        item.WarehouseId,
        item.IsLowStock ? "Low" : "Healthy"
      ], filters.query));
  }

  function promotionAppliesToProduct(promotion, product) {
    if (!product) {
      return true;
    }
    const hasScope = Boolean(promotion.ProductId || promotion.SKU || promotion.Category);
    if (!hasScope) {
      return true;
    }
    return String(promotion.ProductId || "") === String(product.ProductId || "") ||
      app.help.normalizeText(promotion.SKU) === app.help.normalizeText(product.SKU) ||
      app.help.normalizeText(promotion.Category) === app.help.normalizeText(product.Category);
  }

  function filterPromotions(filters) {
    const product = selectedProduct(filters);
    return app.promos.getPromotions()
      .filter((promotion) => dateRangesOverlap(promotion.StartDate, promotion.EndDate, filters.from, filters.to))
      .filter((promotion) => !filters.status || app.help.normalizeText(promotion.IsActive ? "Active" : "Inactive") === app.help.normalizeText(filters.status))
      .filter((promotion) => !filters.category || app.help.normalizeText(promotion.Category || (promotionAppliesToProduct(promotion, product) ? product?.Category : "")) === app.help.normalizeText(filters.category))
      .filter((promotion) => !filters.productId || promotionAppliesToProduct(promotion, product))
      .filter((promotion) => {
        const scope = promotion.SKU || promotion.ProductId || promotion.Category || "All products";
        return matchesText([
          promotion.PromotionId,
          promotion.Name,
          promotion.Type,
          scope,
          promotion.IsActive ? "Active" : "Inactive"
        ], filters.query);
      });
  }

  function appendEmptyState(lines) {
    lines.push("No data matched the selected filters.");
  }

  app.reports = {
    generateSalesReport(filtersOrFrom, to) {
      const filters = normalizeFilters(filtersOrFrom, to);
      const orders = filterSalesOrders(filters);

      const lines = [];
      lines.push("RetailOps Sales Report");
      lines.push(`Generated: ${app.fmt.dateTime(new Date())}`);
      lines.push("");
      lines.push(`Orders: ${orders.length}`);
      lines.push(`Subtotal: ${app.help.sum(orders, (o) => o.Subtotal).toFixed(2)}`);
      lines.push(`Discounts: ${app.help.sum(orders, (o) => o.DiscountTotal).toFixed(2)}`);
      lines.push(`Tax: ${app.help.sum(orders, (o) => o.TaxAmount).toFixed(2)}`);
      lines.push(`Revenue: ${app.help.sum(orders, (o) => o.TotalAmount).toFixed(2)}`);
      lines.push("");

      if (orders.length === 0) {
        appendEmptyState(lines);
      } else {
        lines.push("Orders");
        orders.slice(-50).forEach((order) => {
          lines.push(`${app.fmt.dateTime(order.CreatedAt)} | ${order.OrderId} | ${order.CustomerName} | ${order.CashierName} | ${order.Status} | ${Number(order.TotalAmount).toFixed(2)}`);
        });
      }
      return lines.join("\n");
    },

    generateLowStockReport(filtersOrFrom) {
      const filters = normalizeFilters(filtersOrFrom);
      const rows = filterStockRows(filters);
      const lines = [];
      lines.push("RetailOps Low Stock Report");
      lines.push(`Generated: ${app.fmt.dateTime(new Date())}`);
      lines.push("");
      lines.push(`Rows: ${rows.length}`);
      lines.push("");

      if (rows.length === 0) {
        appendEmptyState(lines);
      } else {
        rows.forEach((item) => {
          const status = item.IsLowStock ? "Low" : "Healthy";
          lines.push(`${item.SKU} | ${item.ProductName} | ${item.WarehouseId} | ${status} | Stock ${item.CurrentStock} | Threshold ${item.ReorderThreshold} | Suggested ${item.SuggestedQuantity}`);
        });
      }

      return lines.join("\n");
    },

    generatePromotionReport(filtersOrFrom) {
      const filters = normalizeFilters(filtersOrFrom);
      const promotions = filterPromotions(filters);
      const lines = [];
      lines.push("RetailOps Promotion Report");
      lines.push(`Generated: ${app.fmt.dateTime(new Date())}`);
      lines.push("");
      lines.push(`Promotions: ${promotions.length}`);
      lines.push("");

      if (promotions.length === 0) {
        appendEmptyState(lines);
      } else {
        promotions.forEach((promotion) => {
          const scope = promotion.SKU || promotion.ProductId || promotion.Category || "All products";
          lines.push(`${promotion.PromotionId} | ${promotion.Name} | ${promotion.Type} | ${promotion.DiscountValue} | ${scope} | ${app.fmt.date(promotion.StartDate)} to ${app.fmt.date(promotion.EndDate)} | ${promotion.IsActive ? "Active" : "Inactive"}`);
        });
      }

      return lines.join("\n");
    },

    saveReport(fileName, content) {
      app.help.downloadFile(fileName, content, "text/plain;charset=utf-8");
    }
  };
}

// alert code
{
app.alerts = {
    getAlerts() {
      const alerts = [];
      const products = app.data.get("products");

      app.data.get("inventory").forEach((inventory) => {
        const product = products.find((item) =>
          item.ProductId === inventory.ProductId ||
          item.SKU.toUpperCase() === String(inventory.SKU).toUpperCase()
        );
        if (!product) {
          return;
        }

        if (Number(inventory.QuantityAvailable) === 0) {
          alerts.push({
            Type: "OutOfStock",
            Tone: "red",
            Title: `Out of stock: ${product.Name}`,
            Details: `${product.SKU} has no available units in ${inventory.WarehouseId}.`
          });
        } else if (Number(inventory.QuantityAvailable) <= Number(product.ReorderThreshold)) {
          alerts.push({
            Type: "LowStock",
            Tone: "amber",
            Title: `Low stock: ${product.Name}`,
            Details: `${product.SKU} has ${inventory.QuantityAvailable} units in ${inventory.WarehouseId}.`
          });
        }
      });

      const now = app.help.todayDateOnly();
      const expiryWindow = app.help.addDays(now, 7);
      app.data.get("promotions").forEach((promotion) => {
        const end = app.help.toDateOnly(promotion.EndDate);
        if (promotion.IsActive && end >= now && end <= expiryWindow) {
          alerts.push({
            Type: "PromotionExpiring",
            Tone: "blue",
            Title: `Promotion expiring: ${promotion.Name}`,
            Details: `Ends on ${app.fmt.date(promotion.EndDate)}.`
          });
        }
      });

      return alerts;
    }
  };
}

// settings code
{
app.settings = {
    getSettings() {
      return app.data.get("settings");
    },

    updateSettings(settings) {
      app.data.set("settings", {
        ...app.data.get("settings"),
        ...settings,
        TaxRate: Number(settings.TaxRate),
        LowStockAlertWindowDays: Number(settings.LowStockAlertWindowDays),
        ForecastHorizonDays: Number(settings.ForecastHorizonDays),
        RequireManagerApproval: Boolean(settings.RequireManagerApproval)
      });
      app.logs.log(app.data.getUser(), "UpdateSettings", "Settings", "LOCAL", "Updated local simulation settings.");
    }
  };
}

// shared html pieces
{
app.parts = {
    metric(label, value, note, trend) {
      return `
        <article class="metric-card">
          <div class="metric-label">
            <span>${app.help.escapeHtml(label)}</span>
            ${trend ? `<span class="metric-trend">${app.help.escapeHtml(trend)}</span>` : ""}
          </div>
          <div class="metric-value">${value}</div>
          <div class="metric-note">${app.help.escapeHtml(note || "")}</div>
        </article>
      `;
    },

    stockBadge(stock, threshold) {
      const tone = app.help.getStockTone(stock, threshold);
      const label = tone === "red" ? "Out" : tone === "amber" ? "Low" : "Healthy";
      return `
        <span class="stock-pill">
          <span class="stock-dot ${tone === "red" ? "out" : tone === "amber" ? "low" : ""}"></span>
          ${app.help.renderBadge(label, tone)}
        </span>
      `;
    },

    productOptions() {
      return app.products.getProducts().map((product) => ({
        value: product.ProductId,
        label: `${product.SKU} - ${product.Name}`
      }));
    },

    supplierOptions() {
      return [{ value: "", label: "Unassigned" }].concat(app.data.get("suppliers").map((supplier) => ({
        value: supplier.SupplierId,
        label: supplier.Name
      })));
    },

    warehouseOptions() {
      return app.data.get("warehouses").map((warehouse) => ({
        value: warehouse.WarehouseId,
        label: `${warehouse.WarehouseId} - ${warehouse.Name}`
      }));
    },

    categoryOptions() {
      return [{ value: "", label: "No category scope" }].concat(
        app.help.unique(app.data.get("products").map((product) => product.Category))
          .sort()
          .map((category) => ({ value: category, label: category }))
      );
    },

    openFormModal(title, fields, values, submitLabel, onSubmit, size) {
      const modal = app.popup.open({
        title,
        size,
        content: document.createElement("div"),
        actions: []
      });
      const form = app.forms.create(fields, values || {}, (payload) => {
        onSubmit(payload);
        modal.close();
      }, {
        submitLabel,
        onCancel: modal.close
      });
      modal.element.querySelector(".modal-body").appendChild(form);
      return modal;
    }
  };
}

// dashboard page
{
function kpis() {
    const products = app.data.get("products");
    const inventory = app.data.get("inventory");
    const report = app.restock.generateReplenishmentReport();
    const orders = app.data.get("orders");
    const activePromos = app.promos.getActivePromotions();
    const stockUnits = app.help.sum(
      inventory,
      (item) => item.QuantityAvailable,
    );
    const lowStock = report.filter((item) => item.IsLowStock).length;
    const revenue = app.help.sum(orders, (order) => order.TotalAmount);

    return [
      app.parts.metric(
        "Active products",
        app.fmt.number(products.filter((p) => p.IsActive).length),
        "Products ready for sale",
        "Live",
      ),
      app.parts.metric(
        "Stock on hand",
        app.fmt.number(stockUnits),
        "Units available across warehouses",
        `${lowStock} low`,
      ),
      app.parts.metric(
        "Open promotions",
        app.fmt.number(activePromos.length),
        "Currently eligible discount programs",
        "Best deal",
      ),
      app.parts.metric(
        "Sales revenue",
        app.fmt.currency(revenue),
        "Completed local orders",
        `${orders.length} orders`,
      ),
    ].join("");
  }

  function categoryChart() {
    const products = app.data.get("products");
    const stockByCategory = {};
    app.stock.getInventory().forEach((item) => {
      stockByCategory[item.Category || "Unassigned"] =
        (stockByCategory[item.Category || "Unassigned"] || 0) +
        Number(item.QuantityAvailable);
    });
    const data = Object.entries(stockByCategory).map(([label, value]) => ({
      label,
      value,
      displayValue: app.fmt.number(value),
    }));
    return app.chart.bar(data, { label: "Stock by category" });
  }

  function flowVisual() {
    const report = app.restock.generateReplenishmentReport();
    const totalSuggestions = app.help.sum(
      report,
      (item) => item.SuggestedQuantity,
    );
    const activePromos = app.promos.getActivePromotions().length;
    const forecastRisk = app.forecast
      .getForecastRows()
      .filter((row) => row.Risk !== "Stable").length;
    const rows = [
      ["Low stock SKUs", report.filter((item) => item.IsLowStock).length, 100],
      ["Suggested units", totalSuggestions, Math.max(100, totalSuggestions)],
      ["Active promos", activePromos, 10],
      ["Forecast risks", forecastRisk, 12],
    ];

    return `
      <div class="flow-chart">
        ${rows
          .map(
            ([label, value, max]) => `
          <div class="flow-row">
            <span class="flow-label">${app.help.escapeHtml(label)}</span>
            <span class="flow-track"><span class="flow-fill" style="width:${Math.max(4, Math.min(100, (value / max) * 100))}%"></span></span>
            <span class="flow-value">${app.help.escapeHtml(value)}</span>
          </div>
        `,
          )
          .join("")}
      </div>
    `;
  }

  app.pages = app.pages || {};
  app.pages.dashboard = {
    render(root) {
      const alerts = app.alerts.getAlerts().slice(0, 5);
      const lowStockRows = app.restock
        .generateReplenishmentReport()
        .filter((item) => item.IsLowStock)
        .slice(0, 8);
      const recentOrders = app.bills.getRecentOrders(5);
      const orders = app.data.get("orders");
      const lastOrder = recentOrders[0];

      root.innerHTML = `
        <div class="page-stack">
          <section class="hero-panel">
            <div class="hero-copy">
              <p class="hero-eyebrow">Store overview</p>
              <h2 class="hero-title">Stock, promotions, forecast risk, and recent bills in one place.</h2>
              <p class="hero-text">This page shows the main numbers from the same product, inventory, promotion, billing, report, and log data used in the rest of the app.</p>
              <div class="hero-insights">
                <div class="mini-stat"><strong>${app.fmt.number(lowStockRows.length)}</strong><span>low-stock records</span></div>
                <div class="mini-stat"><strong>${app.fmt.currency(app.help.sum(orders, (o) => o.DiscountTotal))}</strong><span>promo discounts given</span></div>
                <div class="mini-stat"><strong>${lastOrder ? app.fmt.date(lastOrder.CreatedAt) : "-"}</strong><span>latest order date</span></div>
              </div>
            </div>
            <div class="hero-visual">${flowVisual()}</div>
          </section>

          <section class="grid grid-4">${kpis()}</section>

          <section class="grid grid-2">
            <article class="panel chart-card">
              <div class="section-header">
                <div><h3 class="section-title">Inventory by Category</h3></div>
              </div>
              ${categoryChart()}
            </article>
            <article class="panel">
              <div class="section-header">
                <div><h3 class="section-title">Alerts</h3><p class="section-copy">Low stock and promotions ending soon.</p></div>
              </div>
              <div class="alert-list" style="margin-top:14px">
                ${
                  alerts.length
                    ? alerts
                        .map(
                          (alert) => `
                  <div class="alert-item">
                    <div><strong>${app.help.escapeHtml(alert.Title)}</strong><span class="section-copy">${app.help.escapeHtml(alert.Details)}</span></div>
                    ${app.help.renderBadge(alert.Type, alert.Tone)}
                  </div>
                `,
                        )
                        .join("")
                    : `<div class="empty-state"><div><strong>No alerts</strong><span>Inventory and promotions are currently within expected ranges.</span></div></div>`
                }
              </div>
            </article>
          </section>

          <section class="grid grid-2">
            <div data-low-stock-table></div>
            <div data-orders-table></div>
          </section>
        </div>
      `;

      root.querySelector("[data-low-stock-table]").appendChild(
        app.tables.create({
          title: "Low Stock Exceptions",
          exportName: "low-stock-exceptions",
          data: lowStockRows,
          pageSize: 5,
          searchKeys: ["SKU", "ProductName", "WarehouseId"],
          columns: [
            { key: "SKU", label: "SKU" },
            { key: "ProductName", label: "Product" },
            { key: "WarehouseId", label: "Warehouse" },
            { key: "CurrentStock", label: "Stock" },
            { key: "SuggestedQuantity", label: "Suggest" },
            {
              key: "Status",
              label: "Status",
              value: (row) => (row.IsLowStock ? "Low" : "Healthy"),
              render: (row) =>
                app.parts.stockBadge(row.CurrentStock, row.ReorderThreshold),
            },
          ],
        }),
      );

      root.querySelector("[data-orders-table]").appendChild(
        app.tables.create({
          title: "Recent Orders",
          exportName: "recent-orders",
          data: recentOrders,
          pageSize: 5,
          searchKeys: ["OrderId", "CustomerName", "CashierName"],
          columns: [
            { key: "OrderId", label: "Order" },
            {
              key: "CreatedAt",
              label: "Date",
              render: (row) => app.fmt.dateTime(row.CreatedAt),
            },
            { key: "CustomerName", label: "Customer" },
            {
              key: "TotalAmount",
              label: "Total",
              render: (row) => app.fmt.currency(row.TotalAmount),
            },
          ],
        }),
      );
    },
  };
}

// products page
{
function productFields(includeActive) {
    const fields = [
      { name: "SKU", label: "SKU", required: true, placeholder: "SKU-CODE" },
      { name: "Name", label: "Product name", required: true },
      { name: "Category", label: "Category", required: true },
      { name: "Price", label: "Price", type: "number", min: 0.01, step: 0.01, required: true },
      { name: "ReorderThreshold", label: "Reorder threshold", type: "number", min: 0, step: 1, required: true },
      { name: "SupplierId", label: "Supplier", type: "select", options: app.parts.supplierOptions() }
    ];
    if (includeActive) {
      fields.push({ name: "IsActive", label: "Product is active", type: "checkbox", defaultValue: true });
    }
    return fields;
  }

  function openProductModal(product, rerender) {
    const isEdit = Boolean(product);
    app.parts.openFormModal(
      isEdit ? "Update product" : "Add product",
      productFields(isEdit),
      product || { ReorderThreshold: 0, Price: 1, SupplierId: "" },
      isEdit ? "Update product" : "Add product",
      (payload) => {
        if (isEdit) {
          app.products.updateProduct({ ...product, ...payload });
          app.toast.success("Product updated successfully.");
        } else {
          app.products.addProduct(payload);
          app.toast.success("Product added successfully.");
        }
        rerender();
      }
    );
  }

  app.pages = app.pages || {};
  app.pages.products = {
    render(root) {
      const products = app.products.getProducts();
      const suppliers = app.data.get("suppliers");
      const active = products.filter((product) => product.IsActive).length;
      const avgPrice = app.help.avg(products, (product) => product.Price);

      root.innerHTML = `
        <div class="page-stack">
          <section class="grid grid-4">
            ${app.parts.metric("Products", app.fmt.number(products.length), "Total catalog records", `${active} active`)}
            ${app.parts.metric("Average price", app.fmt.currency(avgPrice), "Across sellable products", "Items")}
            ${app.parts.metric("Categories", app.fmt.number(app.help.unique(products.map((p) => p.Category)).length), "Product groups", "List")}
            ${app.parts.metric("Suppliers", app.fmt.number(suppliers.filter((s) => s.IsActive).length), "Active suppliers", "Vendor")}
          </section>
          <section class="section-band">
            <div class="toolbar">
              <div>
                <h2 class="section-title">Product List</h2>
                <p class="section-copy">Search, sort, add, edit, activate, and deactivate products.</p>
              </div>
              <button class="btn btn-primary" type="button" data-add-product>Add Product</button>
            </div>
            <div data-products-table></div>
          </section>
        </div>
      `;

      root.querySelector("[data-add-product]").addEventListener("click", () => openProductModal(null, () => this.render(root)));

      root.querySelector("[data-products-table]").appendChild(app.tables.create({
        title: "Products",
        exportName: "products",
        data: products.map((product) => ({
          ...product,
          SupplierName: suppliers.find((supplier) => supplier.SupplierId === product.SupplierId)?.Name || "Unassigned"
        })),
        searchKeys: ["SKU", "Name", "Category", "SupplierName"],
        columns: [
          { key: "ProductId", label: "ID" },
          { key: "SKU", label: "SKU" },
          { key: "Name", label: "Name" },
          { key: "Category", label: "Category" },
          { key: "SupplierName", label: "Supplier" },
          { key: "Price", label: "Price", render: (row) => app.fmt.currency(row.Price) },
          { key: "ReorderThreshold", label: "Threshold" },
          { key: "IsActive", label: "Status", value: (row) => row.IsActive ? "Active" : "Inactive", render: (row) => app.help.renderBadge(row.IsActive ? "Active" : "Inactive", row.IsActive ? "green" : "neutral") }
        ],
        actions: [
          { label: "Edit", handler: (row) => openProductModal(row, () => this.render(root)) },
          {
            label: (row) => row.IsActive ? "Deactivate" : "Activate",
            handler: async (row) => {
              const nextStatus = !row.IsActive;
              const ok = nextStatus || await app.popup.confirm({ title: "Deactivate product", message: `Deactivate ${row.SKU}?`, danger: true });
              if (ok && app.products.setProductStatus(row.ProductId, nextStatus)) {
                app.toast.success(`Product ${nextStatus ? "activated" : "deactivated"} successfully.`);
                this.render(root);
              }
            }
          }
        ]
      }));
    }
  };
}

// skus page
{
function skuFields() {
    return [
      { name: "ProductId", label: "Product", type: "select", options: app.parts.productOptions(), required: true },
      { name: "SKU", label: "SKU", required: true },
      { name: "Barcode", label: "Barcode" },
      { name: "Uom", label: "Unit of measure", required: true },
      { name: "PackSize", label: "Pack size", required: true },
      { name: "CasePack", label: "Case pack", type: "number", min: 1, step: 1, required: true },
      { name: "ShelfLifeDays", label: "Shelf life days", type: "number", min: 0, step: 1, required: true },
      {
        name: "Channel",
        label: "Channel",
        type: "select",
        options: [
          { value: "Ambient", label: "Ambient" },
          { value: "Chilled", label: "Chilled" },
          { value: "Frozen", label: "Frozen" },
          { value: "Controlled", label: "Controlled" }
        ]
      },
      { name: "IsActive", label: "SKU is active", type: "checkbox", defaultValue: true }
    ];
  }

  function openSkuModal(sku, rerender) {
    const isEdit = Boolean(sku);
    app.parts.openFormModal(
      isEdit ? "Update SKU" : "Add SKU",
      skuFields(),
      sku || { ProductId: app.data.get("products")[0]?.ProductId, CasePack: 1, ShelfLifeDays: 0, Channel: "Ambient", IsActive: true },
      isEdit ? "Update SKU" : "Add SKU",
      (payload) => {
        if (isEdit) {
          app.skus.updateSku({ ...sku, ...payload });
          app.toast.success("SKU updated successfully.");
        } else {
          app.skus.addSku(payload);
          app.toast.success("SKU added successfully.");
        }
        rerender();
      },
      "large"
    );
  }

  app.pages = app.pages || {};
  app.pages.skus = {
    render(root) {
      const skus = app.skus.getSkus();
      const chilled = skus.filter((sku) => sku.Channel === "Chilled").length;

      root.innerHTML = `
        <div class="page-stack">
          <section class="grid grid-4">
            ${app.parts.metric("SKU records", app.fmt.number(skus.length), "Sellable unit definitions", "Active")}
            ${app.parts.metric("Chilled SKUs", app.fmt.number(chilled), "Temperature-controlled assortment", "Ops")}
            ${app.parts.metric("Avg case pack", app.fmt.number(Math.round(app.help.avg(skus, (sku) => sku.CasePack))), "Units per case", "Supply")}
            ${app.parts.metric("Barcode coverage", app.fmt.percent((skus.filter((sku) => sku.Barcode).length / Math.max(1, skus.length)) * 100), "Traceability readiness", "QA")}
          </section>
          <section class="section-band">
            <div class="toolbar">
              <div>
                <h2 class="section-title">SKU List</h2>
                <p class="section-copy">SKU-level packaging and channel control layered over the original product SKU field.</p>
              </div>
              <button class="btn btn-primary" type="button" data-add-sku>Add SKU</button>
            </div>
            <div data-sku-table></div>
          </section>
        </div>
      `;

      root.querySelector("[data-add-sku]").addEventListener("click", () => openSkuModal(null, () => this.render(root)));
      root.querySelector("[data-sku-table]").appendChild(app.tables.create({
        title: "SKUs",
        exportName: "skus",
        data: skus,
        searchKeys: ["SKU", "ProductName", "Barcode", "Channel"],
        columns: [
          { key: "SkuId", label: "ID" },
          { key: "SKU", label: "SKU" },
          { key: "ProductName", label: "Product" },
          { key: "Barcode", label: "Barcode" },
          { key: "Uom", label: "UOM" },
          { key: "PackSize", label: "Pack" },
          { key: "CasePack", label: "Case" },
          { key: "ShelfLifeDays", label: "Shelf life" },
          { key: "Channel", label: "Channel", render: (row) => app.help.renderBadge(row.Channel, row.Channel === "Chilled" ? "blue" : "neutral") },
          { key: "IsActive", label: "Status", value: (row) => row.IsActive ? "Active" : "Inactive", render: (row) => app.help.renderBadge(row.IsActive ? "Active" : "Inactive", row.IsActive ? "green" : "neutral") }
        ],
        actions: [
          { label: "Edit", handler: (row) => openSkuModal(row, () => this.render(root)) }
        ]
      }));
    }
  };
}

// inventory page
{
function addInventoryFields() {
    return [
      { name: "ProductId", label: "Product", type: "select", options: app.parts.productOptions(), required: true },
      { name: "SKU", label: "SKU", required: true, help: "Must match an existing product SKU." },
      { name: "WarehouseId", label: "Warehouse", type: "select", options: app.parts.warehouseOptions() },
      { name: "QuantityAvailable", label: "Quantity", type: "number", min: 0, step: 1, required: true },
      { name: "SafetyStock", label: "Safety stock", type: "number", min: 0, step: 1, required: true }
    ];
  }

  function adjustFields(row) {
    return [
      { name: "SKU", label: "SKU", required: true },
      { name: "WarehouseId", label: "Warehouse", type: "select", options: app.parts.warehouseOptions() },
      { name: "Quantity", label: "Quantity adjustment", type: "number", step: 1, required: true, help: "Use negative values for outbound adjustment." }
    ];
  }

  app.pages = app.pages || {};
  app.pages.inventory = {
    render(root) {
      const inventory = app.stock.getInventory();
      const warehouses = app.data.get("warehouses");
      const totalStock = app.help.sum(inventory, (item) => item.QuantityAvailable);
      const stockValue = app.help.sum(inventory, (item) => {
        const product = app.products.getBySku(item.SKU);
        return Number(item.QuantityAvailable) * Number(product?.Price || 0);
      });
      const low = inventory.filter((item) => item.QuantityAvailable <= item.ReorderThreshold).length;

      root.innerHTML = `
        <div class="page-stack">
          <section class="grid grid-4">
            ${app.parts.metric("Stock units", app.fmt.number(totalStock), "Available units across warehouses", "Live")}
            ${app.parts.metric("Stock value", app.fmt.currency(stockValue), "Retail value estimate", "INR")}
            ${app.parts.metric("Low records", app.fmt.number(low), "Warehouse rows at or below threshold", "Alert")}
            ${app.parts.metric("Warehouses", app.fmt.number(warehouses.length), "Active local fulfillment nodes", "Network")}
          </section>
          <section class="section-band">
            <div class="toolbar">
              <div>
                <h2 class="section-title">Inventory Ledger</h2>
                <p class="section-copy">Add inventory rows and adjust stock. Stock cannot go below zero.</p>
              </div>
              <div class="toolbar-right">
                <button class="btn btn-secondary" type="button" data-adjust-stock>Adjust Stock</button>
                <button class="btn btn-primary" type="button" data-add-inventory>Add Inventory</button>
              </div>
            </div>
            <div data-inventory-table></div>
          </section>
        </div>
      `;

      root.querySelector("[data-add-inventory]").addEventListener("click", () => {
        const firstProduct = app.data.get("products")[0];
        app.parts.openFormModal("Add inventory", addInventoryFields(), {
          ProductId: firstProduct?.ProductId,
          SKU: firstProduct?.SKU,
          WarehouseId: "MAIN",
          QuantityAvailable: 0,
          SafetyStock: 0
        }, "Add inventory", (payload) => {
          app.stock.addInventory(payload);
          app.toast.success("Inventory added successfully.");
          this.render(root);
        });
      });

      root.querySelector("[data-adjust-stock]").addEventListener("click", () => {
        app.parts.openFormModal("Adjust stock", adjustFields(), { WarehouseId: "MAIN", Quantity: 0 }, "Apply adjustment", (payload) => {
          app.stock.updateStock(payload.SKU, payload.Quantity, payload.WarehouseId);
          app.toast.success("Stock updated successfully.");
          this.render(root);
        });
      });

      root.querySelector("[data-inventory-table]").appendChild(app.tables.create({
        title: "Inventory",
        exportName: "inventory",
        data: inventory,
        searchKeys: ["SKU", "ProductName", "WarehouseId", "WarehouseName"],
        columns: [
          { key: "InventoryId", label: "ID" },
          { key: "SKU", label: "SKU" },
          { key: "ProductName", label: "Product" },
          { key: "WarehouseName", label: "Warehouse" },
          { key: "QuantityAvailable", label: "Stock" },
          { key: "SafetyStock", label: "Safety" },
          { key: "ReorderThreshold", label: "Threshold" },
          { key: "Status", label: "Status", value: (row) => row.QuantityAvailable <= row.ReorderThreshold ? "Low" : "Healthy", render: (row) => app.parts.stockBadge(row.QuantityAvailable, row.ReorderThreshold) },
          { key: "LastUpdatedAt", label: "Updated", render: (row) => app.fmt.dateTime(row.LastUpdatedAt) }
        ],
        actions: [
          {
            label: "Adjust",
            handler: (row) => {
              app.parts.openFormModal("Adjust stock", adjustFields(row), {
                SKU: row.SKU,
                WarehouseId: row.WarehouseId,
                Quantity: 0
              }, "Apply adjustment", (payload) => {
                app.stock.updateStock(payload.SKU, payload.Quantity, payload.WarehouseId);
                app.toast.success("Stock updated successfully.");
                this.render(root);
              });
            }
          }
        ]
      }));
    }
  };
}

// replenishment page
{
function replenishmentStatusTone(status) {
    if (status === "Approved") {
      return "green";
    }
    if (status === "Rejected") {
      return "red";
    }
    return "amber";
  }

  app.pages = app.pages || {};
  app.pages.replenishment = {
    render(root) {
      const recommendations = app.restock.generateReplenishmentReport();
      const low = recommendations.filter((item) => item.IsLowStock);
      const suggestedUnits = app.help.sum(recommendations, (item) => item.SuggestedQuantity);
      const pending = app.data.get("replenishment").filter((item) => item.Status === "Pending").length;
      const replenishmentRoute = app.setup.routes.find((route) => route.id === "replenishment");
      const canManageRequests = app.nav.hasAccess(replenishmentRoute, app.data.getUser());

      root.innerHTML = `
        <div class="page-stack">
          <section class="grid grid-4">
            ${app.parts.metric("Recommendations", app.fmt.number(recommendations.length), "Inventory rows analyzed", "Engine")}
            ${app.parts.metric("Low stock", app.fmt.number(low.length), "Rows requiring action", "Threshold")}
            ${app.parts.metric("Suggested units", app.fmt.number(suggestedUnits), "Threshold + safety - stock", "Formula")}
            ${app.parts.metric("Pending approvals", app.fmt.number(pending), "Saved replenishment records", "Workflow")}
          </section>
          <section class="grid grid-2">
            <article class="panel chart-card">
              <div><h2 class="section-title">Suggested Quantity by SKU</h2><p class="section-copy">Uses the same threshold plus safety stock formula.</p></div>
              ${app.chart.bar(low.slice(0, 8).map((item) => ({ label: item.SKU, value: item.SuggestedQuantity, displayValue: app.fmt.number(item.SuggestedQuantity) })), { label: "Suggested reorder quantities" })}
            </article>
            <article class="panel">
              <h2 class="section-title">Calculation Rule</h2>
              <div class="summary-list" style="margin-top:14px">
                <div class="summary-row"><span>Low stock</span><strong>QuantityAvailable <= ReorderThreshold</strong></div>
                <div class="summary-row"><span>Suggested quantity</span><strong>max(0, Threshold + SafetyStock - Stock)</strong></div>
                <div class="summary-row"><span>Product match</span><strong>ProductId or SKU</strong></div>
                <div class="summary-row"><span>Ordering</span><strong>Low stock first, then SKU</strong></div>
              </div>
            </article>
          </section>
          <div data-replenishment-table></div>
          <div data-replenishment-history></div>
        </div>
      `;

      root.querySelector("[data-replenishment-table]").appendChild(app.tables.create({
        title: "Replenishment Recommendations",
        exportName: "replenishment-recommendations",
        data: recommendations,
        searchKeys: ["SKU", "ProductName", "WarehouseId"],
        columns: [
          { key: "SKU", label: "SKU" },
          { key: "ProductName", label: "Product" },
          { key: "WarehouseId", label: "Warehouse" },
          { key: "CurrentStock", label: "Stock" },
          { key: "ReorderThreshold", label: "Threshold" },
          { key: "SafetyStock", label: "Safety" },
          { key: "SuggestedQuantity", label: "Suggest" },
          { key: "IsLowStock", label: "Status", render: (row) => app.parts.stockBadge(row.CurrentStock, row.ReorderThreshold) }
        ],
        actions: [
          {
            label: "Create",
            handler: (row) => {
              app.parts.openFormModal("Create replenishment", [
                { name: "ApprovedQuantity", label: "Approved quantity", type: "number", min: 0, step: 1, required: true }
              ], { ApprovedQuantity: row.SuggestedQuantity }, "Create request", (payload) => {
                app.restock.createRequest(row, payload.ApprovedQuantity);
                app.toast.success("Replenishment request created.");
                this.render(root);
              });
            }
          }
        ]
      }));

      root.querySelector("[data-replenishment-history]").appendChild(app.tables.create({
        title: "Replenishment History",
        exportName: "replenishment-history",
        data: app.data.get("replenishment"),
        pageSize: 5,
        searchKeys: ["ReplenishmentId", "SKU", "WarehouseId", "Status"],
        columns: [
          { key: "ReplenishmentId", label: "ID" },
          { key: "SKU", label: "SKU" },
          { key: "WarehouseId", label: "Warehouse" },
          { key: "SuggestedQuantity", label: "Suggested" },
          { key: "ApprovedQuantity", label: "Approved" },
          { key: "Status", label: "Status", render: (row) => app.help.renderBadge(row.Status, replenishmentStatusTone(row.Status)) },
          { key: "CreatedBy", label: "Created by" },
          { key: "CreatedAt", label: "Created", render: (row) => app.fmt.dateTime(row.CreatedAt) },
          { key: "UpdatedAt", label: "Updated", value: (row) => row.ApprovedAt || row.RejectedAt || row.UpdatedAt || "", render: (row) => row.ApprovedAt || row.RejectedAt || row.UpdatedAt ? app.fmt.dateTime(row.ApprovedAt || row.RejectedAt || row.UpdatedAt) : "-" }
        ],
        actions: [
          {
            label: "Approve",
            visible: (row) => canManageRequests && row.Status === "Pending",
            handler: async (row) => {
              const ok = await app.popup.confirm({ title: "Approve replenishment", message: `Approve replenishment request ${row.ReplenishmentId}?`, confirmLabel: "Approve" });
              if (ok && app.restock.approveRequest(row.ReplenishmentId)) {
                app.toast.success("Replenishment request approved.");
                this.render(root);
              }
            }
          },
          {
            label: "Reject",
            className: "btn btn-secondary",
            visible: (row) => canManageRequests && row.Status === "Pending",
            handler: async (row) => {
              const ok = await app.popup.confirm({ title: "Reject replenishment", message: `Reject replenishment request ${row.ReplenishmentId}?`, confirmLabel: "Reject", danger: true });
              if (ok && app.restock.rejectRequest(row.ReplenishmentId)) {
                app.toast.success("Replenishment request rejected.");
                this.render(root);
              }
            }
          }
        ]
      }));
    }
  };
}

// promotions page
{
function promotionFields(includeActive) {
    const fields = [
      { name: "Name", label: "Promotion name", required: true },
      { name: "Type", label: "Promotion type", type: "select", options: app.setup.promotionTypes },
      { name: "DiscountValue", label: "Discount value", type: "number", min: 0, step: 0.01, required: true },
      { name: "StartDate", label: "Start date", type: "date", required: true },
      { name: "EndDate", label: "End date", type: "date", required: true },
      { name: "MinimumQuantity", label: "Minimum quantity", type: "number", min: 1, step: 1, required: true },
      {
        name: "ScopeType",
        label: "Scope",
        type: "select",
        options: [
          { value: "All", label: "All products" },
          { value: "SKU", label: "SKU" },
          { value: "Category", label: "Category" },
          { value: "ProductId", label: "Product ID" }
        ]
      },
      { name: "ScopeValue", label: "Scope value", help: "Leave blank when scope is all products." }
    ];
    if (includeActive) {
      fields.push({ name: "IsActive", label: "Promotion is active", type: "checkbox", defaultValue: true });
    }
    return fields;
  }

  function inflatePromotion(promotion) {
    if (!promotion) {
      return {
        Type: "Percentage",
        DiscountValue: 10,
        StartDate: app.fmt.isoDateInput(new Date()),
        EndDate: app.fmt.isoDateInput(app.help.addDays(new Date(), 14)),
        MinimumQuantity: 1,
        ScopeType: "All",
        ScopeValue: "",
        IsActive: true
      };
    }

    let scopeType = "All";
    let scopeValue = "";
    if (promotion.SKU) {
      scopeType = "SKU";
      scopeValue = promotion.SKU;
    } else if (promotion.Category) {
      scopeType = "Category";
      scopeValue = promotion.Category;
    } else if (promotion.ProductId) {
      scopeType = "ProductId";
      scopeValue = promotion.ProductId;
    }

    return {
      ...promotion,
      StartDate: app.fmt.isoDateInput(promotion.StartDate),
      EndDate: app.fmt.isoDateInput(promotion.EndDate),
      ScopeType: scopeType,
      ScopeValue: scopeValue
    };
  }

  function deflatePromotion(payload, existing) {
    const promotion = {
      ...(existing || {}),
      Name: payload.Name,
      Type: payload.Type,
      DiscountValue: Number(payload.DiscountValue),
      StartDate: payload.StartDate,
      EndDate: payload.EndDate,
      MinimumQuantity: Number(payload.MinimumQuantity),
      IsActive: Boolean(payload.IsActive ?? true),
      ProductId: null,
      SKU: null,
      Category: null
    };

    if (payload.ScopeType === "SKU" && payload.ScopeValue) {
      promotion.SKU = payload.ScopeValue;
    } else if (payload.ScopeType === "Category" && payload.ScopeValue) {
      promotion.Category = payload.ScopeValue;
    } else if (payload.ScopeType === "ProductId" && payload.ScopeValue) {
      promotion.ProductId = payload.ScopeValue;
    }
    return promotion;
  }

  function openPromotionModal(promotion, rerender) {
    const isEdit = Boolean(promotion);
    app.parts.openFormModal(
      isEdit ? "Update promotion" : "Add promotion",
      promotionFields(isEdit),
      inflatePromotion(promotion),
      isEdit ? "Update promotion" : "Add promotion",
      (payload) => {
        if (isEdit) {
          app.promos.updatePromotion(deflatePromotion(payload, promotion));
          app.toast.success("Promotion updated successfully.");
        } else {
          app.promos.addPromotion(deflatePromotion(payload));
          app.toast.success("Promotion added successfully.");
        }
        rerender();
      },
      "large"
    );
  }

  function scopeLabel(promotion) {
    return promotion.SKU || promotion.ProductId || promotion.Category || "All products";
  }

  app.pages = app.pages || {};
  app.pages.promotions = {
    render(root) {
      const promotions = app.promos.getPromotions();
      const active = app.promos.getActivePromotions();
      const expiring = active.filter((promotion) => app.help.toDateOnly(promotion.EndDate) <= app.help.addDays(app.help.todayDateOnly(), 7)).length;

      root.innerHTML = `
        <div class="page-stack">
          <section class="grid grid-4">
            ${app.parts.metric("Promotions", app.fmt.number(promotions.length), "All configured offers", `${active.length} active`)}
            ${app.parts.metric("Expiring soon", app.fmt.number(expiring), "Active offers ending in 7 days", "Watch")}
            ${app.parts.metric("Avg discount", app.fmt.percent(app.help.avg(promotions.filter((p) => p.Type !== "BuyOneGetOne"), (p) => p.DiscountValue)), "Non-BOGO configured value", "Promo")}
            ${app.parts.metric("BOGO offers", app.fmt.number(promotions.filter((p) => p.Type === "BuyOneGetOne").length), "Free-unit promotion logic", "Logic")}
          </section>
          <section class="section-band">
            <article class="panel">
              <div class="toolbar">
                <div>
                  <h2 class="section-title">Discount Simulator</h2>
                  <p class="section-copy">Tests the same best-active-promotion calculation used by billing.</p>
                </div>
              </div>
              <form data-discount-sim class="form-grid" style="margin-top:14px">
                <label class="form-field"><span>Product</span><select class="select" name="product">${app.parts.productOptions().map((option) => `<option value="${app.help.escapeHtml(option.value)}">${app.help.escapeHtml(option.label)}</option>`).join("")}</select></label>
                <label class="form-field"><span>Quantity</span><input class="input" type="number" min="1" step="1" value="2" name="quantity"></label>
                <div class="form-actions" style="grid-column:1 / -1"><button class="btn btn-primary" type="submit">Calculate Discount</button></div>
              </form>
              <div data-sim-result class="summary-list" style="margin-top:12px"></div>
            </article>
          </section>
          <section class="section-band">
            <div class="toolbar">
              <div>
                <h2 class="section-title">Promotion Programs</h2>
                <p class="section-copy">Create, edit, deactivate, and test scoped promotions.</p>
              </div>
              <button class="btn btn-primary" type="button" data-add-promotion>Add Promotion</button>
            </div>
            <div data-promo-table></div>
          </section>
        </div>
      `;

      root.querySelector("[data-add-promotion]").addEventListener("click", () => openPromotionModal(null, () => this.render(root)));
      root.querySelector("[data-discount-sim]").addEventListener("submit", (event) => {
        event.preventDefault();
        const data = new FormData(event.target);
        const product = app.products.getById(data.get("product"));
        const quantity = Number(data.get("quantity"));
        const result = app.promos.getBestDiscount(product, quantity);
        root.querySelector("[data-sim-result]").innerHTML = `
          <div class="summary-row"><span>Line subtotal</span><strong>${app.fmt.currency(product.Price * quantity)}</strong></div>
          <div class="summary-row"><span>Best promotion</span><strong>${app.help.escapeHtml(result.Promotion?.Name || "No eligible promotion")}</strong></div>
          <div class="summary-row"><span>Discount</span><strong>${app.fmt.currency(result.Discount)}</strong></div>
          <div class="summary-row"><span>Net line</span><strong>${app.fmt.currency(product.Price * quantity - result.Discount)}</strong></div>
        `;
      });

      root.querySelector("[data-promo-table]").appendChild(app.tables.create({
        title: "Promotions",
        exportName: "promotions",
        data: promotions,
        searchKeys: ["PromotionId", "Name", "Type", "SKU", "Category", "ProductId"],
        columns: [
          { key: "PromotionId", label: "ID" },
          { key: "Name", label: "Name" },
          { key: "Type", label: "Type" },
          { key: "DiscountValue", label: "Value", render: (row) => row.Type === "BuyOneGetOne" ? "BOGO" : String(row.DiscountValue) },
          { key: "Scope", label: "Scope", value: scopeLabel, render: (row) => app.help.escapeHtml(scopeLabel(row)) },
          { key: "MinimumQuantity", label: "Min Qty" },
          { key: "EndDate", label: "End", render: (row) => app.fmt.date(row.EndDate) },
          { key: "IsActive", label: "Status", value: (row) => row.IsActive ? "Active" : "Inactive", render: (row) => app.help.renderBadge(row.IsActive ? "Active" : "Inactive", row.IsActive ? "green" : "neutral") }
        ],
        actions: [
          { label: "Edit", handler: (row) => openPromotionModal(row, () => this.render(root)) },
          {
            label: (row) => row.IsActive ? "Deactivate" : "Activate",
            handler: async (row) => {
              const nextStatus = !row.IsActive;
              const ok = nextStatus || await app.popup.confirm({ title: "Deactivate promotion", message: `Deactivate ${row.Name}?`, danger: true });
              if (ok && app.promos.setPromotionStatus(row.PromotionId, nextStatus)) {
                app.toast.success(`Promotion ${nextStatus ? "activated" : "deactivated"} successfully.`);
                this.render(root);
              }
            }
          }
        ]
      }));
    }
  };
}

// forecast page
{
function riskTone(risk) {
    if (risk === "Out of stock" || risk === "Critical") {
      return "red";
    }
    if (risk === "Watch") {
      return "amber";
    }
    return "green";
  }

  app.pages = app.pages || {};
  app.pages.forecast = {
    render(root) {
      const rows = app.forecast.getForecastRows();
      const riskRows = rows.filter((row) => row.Risk !== "Stable");
      const projected = app.help.sum(rows, (row) => row.ProjectedDemand);
      const demandChart = rows
        .slice()
        .sort((a, b) => b.ProjectedDemand - a.ProjectedDemand)
        .slice(0, 8)
        .map((row) => ({ label: row.SKU, value: row.ProjectedDemand, displayValue: app.fmt.number(row.ProjectedDemand) }));
      const selected = rows[0];

      root.innerHTML = `
        <div class="page-stack">
          <section class="grid grid-4">
            ${app.parts.metric("Forecast SKUs", app.fmt.number(rows.length), "Forecast records loaded", "Rows")}
            ${app.parts.metric("Projected demand", app.fmt.number(projected), "Units in configured horizons", "Demand")}
            ${app.parts.metric("At-risk SKUs", app.fmt.number(riskRows.length), "Critical, watch, or out of stock", "Risk")}
            ${app.parts.metric("Avg confidence", app.fmt.percent(app.help.avg(rows, (row) => row.Confidence)), "Forecast confidence score", "Score")}
          </section>
          <section class="grid grid-2">
            <article class="panel chart-card">
              <h2 class="section-title">Projected Demand</h2>
              <p class="section-copy">Average weekly demand / 7 x horizon x seasonality x promo lift.</p>
              ${app.chart.bar(demandChart, { label: "Projected demand by SKU" })}
            </article>
            <article class="panel chart-card">
              <h2 class="section-title">Demand Trend</h2>
              <p class="section-copy">${selected ? app.help.escapeHtml(selected.SKU) : "No forecast"} weekly movement from the JSON forecast dataset.</p>
              ${selected ? app.chart.sparkline(selected.WeeklyDemand, { label: `${selected.SKU} weekly trend` }) : ""}
            </article>
          </section>
          <div data-forecast-table></div>
        </div>
      `;

      root.querySelector("[data-forecast-table]").appendChild(app.tables.create({
        title: "Forecast Workbench",
        exportName: "forecast",
        data: rows,
        searchKeys: ["SKU", "ProductName", "Category", "Risk"],
        columns: [
          { key: "SKU", label: "SKU" },
          { key: "ProductName", label: "Product" },
          { key: "Category", label: "Category" },
          { key: "StockOnHand", label: "Stock" },
          { key: "AverageWeeklyDemand", label: "Avg Week", render: (row) => row.AverageWeeklyDemand.toFixed(1) },
          { key: "ProjectedDemand", label: "Projected" },
          { key: "DaysOfCover", label: "Cover Days", render: (row) => Number(row.DaysOfCover).toFixed(1) },
          { key: "StockoutDate", label: "Stockout", render: (row) => row.StockoutDate ? app.fmt.date(row.StockoutDate) : "-" },
          { key: "LeadTimeDays", label: "Lead" },
          { key: "Risk", label: "Risk", render: (row) => app.help.renderBadge(row.Risk, riskTone(row.Risk)) },
          { key: "Confidence", label: "Confidence", render: (row) => app.fmt.percent(row.Confidence) }
        ],
        actions: [
          {
            label: "Trend",
            handler: (row) => {
              app.popup.open({
                title: `${row.SKU} weekly demand`,
                content: `
                  <div class="panel chart-card" style="box-shadow:none">
                    ${app.chart.sparkline(row.WeeklyDemand, { label: `${row.SKU} weekly demand` })}
                    <div class="summary-list">
                      <div class="summary-row"><span>Seasonality index</span><strong>${row.SeasonalityIndex}</strong></div>
                      <div class="summary-row"><span>Promo lift</span><strong>${row.PromoLift}</strong></div>
                      <div class="summary-row"><span>Effective daily demand</span><strong>${row.EffectiveDailyDemand.toFixed(2)}</strong></div>
                    </div>
                  </div>
                `
              });
            }
          }
        ]
      }));
    }
  };
}

// reports page
{
function statusOptions(type) {
    if (type === "sales") {
      const statuses = app.help.unique(app.data.get("orders").map((order) => order.Status)).sort();
      return statuses.map((status) => ({ value: status, label: status }));
    }
    if (type === "low") {
      return [
        { value: "Low", label: "Low stock" },
        { value: "Healthy", label: "Healthy" }
      ];
    }
    return [
      { value: "Active", label: "Active" },
      { value: "Inactive", label: "Inactive" }
    ];
  }

  function fileName(type) {
    return type === "sales"
      ? "SalesReport.txt"
      : type === "low"
        ? "LowStockReport.txt"
        : "PromotionReport.txt";
  }

  function generate(type, filters) {
    if (type === "sales") {
      return app.reports.generateSalesReport(filters);
    }
    if (type === "low") {
      return app.reports.generateLowStockReport(filters);
    }
    return app.reports.generatePromotionReport(filters);
  }

  app.pages = app.pages || {};
  app.pages.reports = {
    render(root) {
      let activeType = "sales";
      let query = "";
      const orders = app.data.get("orders");
      const users = app.data.get("users");
      const products = app.products.getProducts();
      const discounts = app.help.sum(orders, (order) => order.DiscountTotal);
      const revenue = app.help.sum(orders, (order) => order.TotalAmount);
      const lowStock = app.restock.generateReplenishmentReport().filter((item) => item.IsLowStock).length;
      const categoryOptions = app.help.unique(products.map((product) => product.Category)).sort();

      root.innerHTML = `
        <div class="page-stack">
          <section class="grid grid-4">
            ${app.parts.metric("Orders", app.fmt.number(orders.length), "Completed sales orders", "Sales")}
            ${app.parts.metric("Revenue", app.fmt.currency(revenue), "Tax-inclusive completed revenue", "Report")}
            ${app.parts.metric("Discounts", app.fmt.currency(discounts), "Promotion value consumed", "Promo")}
            ${app.parts.metric("Low stock lines", app.fmt.number(lowStock), "Rows in low-stock report", "Supply")}
          </section>
          <section class="panel">
            <div class="toolbar">
              <div>
                <h2 class="section-title">Report Generator</h2>
                <p class="section-copy">Filter sales, stock, and promotion reports before downloading the generated text output.</p>
              </div>
              <div class="toolbar-right">
                <button class="btn btn-primary" type="button" data-report-type="sales">Sales</button>
                <button class="btn btn-secondary" type="button" data-report-type="low">Low Stock</button>
                <button class="btn btn-secondary" type="button" data-report-type="promo">Promotion</button>
                <button class="btn btn-primary" type="button" data-save-report>Download</button>
              </div>
            </div>
            <form class="form-grid report-filter-grid" data-report-filters style="margin:16px 0">
              <label class="form-field"><span>Date from</span><input class="input" type="date" name="from"></label>
              <label class="form-field"><span>Date to</span><input class="input" type="date" name="to"></label>
              <label class="form-field"><span>Category</span><select class="select" name="category">
                <option value="">All categories</option>
                ${categoryOptions.map((category) => `<option value="${app.help.escapeHtml(category)}">${app.help.escapeHtml(category)}</option>`).join("")}
              </select></label>
              <label class="form-field"><span>Product</span><select class="select" name="productId">
                <option value="">All products</option>
                ${products.map((product) => `<option value="${app.help.escapeHtml(product.ProductId)}">${app.help.escapeHtml(product.SKU)} - ${app.help.escapeHtml(product.Name)}</option>`).join("")}
              </select></label>
              <label class="form-field"><span>Status</span><select class="select" name="status"></select></label>
              <label class="form-field"><span>Sales user</span><select class="select" name="userId">
                <option value="">All users</option>
                ${users.map((user) => `<option value="${app.help.escapeHtml(user.UserId)}">${app.help.escapeHtml(user.Username)} - ${app.help.escapeHtml(user.Role)}</option>`).join("")}
              </select></label>
              <div data-report-search style="grid-column:1 / -1"></div>
            </form>
            <div class="empty-state report-empty hidden" data-report-empty>
              <div><strong>No report data found</strong><span>Adjust the filters to widen the result set.</span></div>
            </div>
            <pre class="report-output" data-report-output></pre>
          </section>
        </div>
      `;

      const filterForm = root.querySelector("[data-report-filters]");
      const output = root.querySelector("[data-report-output]");
      const empty = root.querySelector("[data-report-empty]");
      const save = root.querySelector("[data-save-report]");
      const status = filterForm.elements.status;
      const user = filterForm.elements.userId;
      const searchSlot = root.querySelector("[data-report-search]");

      const search = app.searchBox.create({
        label: "Report search",
        placeholder: "Search orders, products, users, statuses, or promotions",
        debounceMs: 80,
        onChange(value) {
          query = value;
          updateReport();
        }
      });
      searchSlot.appendChild(search.element);

      function readFilters() {
        return {
          from: filterForm.elements.from.value,
          to: filterForm.elements.to.value,
          category: filterForm.elements.category.value,
          productId: filterForm.elements.productId.value,
          status: filterForm.elements.status.value,
          userId: activeType === "sales" ? filterForm.elements.userId.value : "",
          query
        };
      }

      function refreshFilterState() {
        status.innerHTML = `<option value="">All statuses</option>${statusOptions(activeType)
          .map((option) => `<option value="${app.help.escapeHtml(option.value)}">${app.help.escapeHtml(option.label)}</option>`)
          .join("")}`;
        user.disabled = activeType !== "sales";
        if (user.disabled) {
          user.value = "";
        }
      }

      function setActiveType(type) {
        activeType = type;
        root.querySelectorAll("[data-report-type]").forEach((button) => {
          const active = button.dataset.reportType === activeType;
          button.classList.toggle("btn-primary", active);
          button.classList.toggle("btn-secondary", !active);
        });
        refreshFilterState();
        updateReport();
      }

      function updateReport() {
        const content = generate(activeType, readFilters());
        const isEmpty = content.includes("No data matched the selected filters.");
        output.textContent = content;
        output.classList.toggle("hidden", isEmpty);
        empty.classList.toggle("hidden", !isEmpty);
        save.dataset.content = content;
        save.dataset.file = fileName(activeType);
      }

      root.querySelectorAll("[data-report-type]").forEach((button) => {
        button.addEventListener("click", () => setActiveType(button.dataset.reportType));
      });

      filterForm.addEventListener("input", app.help.debounce(updateReport, 80));
      filterForm.addEventListener("change", updateReport);

      save.addEventListener("click", (event) => {
        const content = event.currentTarget.dataset.content || output.textContent;
        const file = event.currentTarget.dataset.file || fileName(activeType);
        app.reports.saveReport(file, content);
      });

      refreshFilterState();
      updateReport();
    }
  };
}

// billing page
{
function discountLabel(order) {
    if (!order?.ManualDiscountAmount) {
      return "No manual discount";
    }
    return order.ManualDiscountType === "Percentage"
      ? `${order.ManualDiscountValue}% manual discount`
      : `${app.fmt.currency(order.ManualDiscountAmount)} manual discount`;
  }

  app.pages = app.pages || {};
  app.pages.billing = {
    render(root) {
      let cart = [];
      let suggestedPaidAmount = "";
      const recentOrders = app.bills.getRecentOrders(8);

      root.innerHTML = `
        <div class="page-stack">
          <section class="grid grid-4">
            ${app.parts.metric("Recent orders", app.fmt.number(recentOrders.length), "Latest completed transactions", "POS")}
            ${app.parts.metric("Tax rate", app.fmt.percent(app.setup.taxRate * 100), "Applied after discounts", "Tax")}
            ${app.parts.metric("Active promos", app.fmt.number(app.promos.getActivePromotions().length), "Eligible discount programs", "Best")}
            ${app.parts.metric("Stocked SKUs", app.fmt.number(app.help.unique(app.data.get("inventory").map((i) => i.SKU)).length), "Available in inventory", "Stock")}
          </section>
          <section class="grid grid-2">
            <article class="panel">
              <h2 class="section-title">Create Bill</h2>
              <p class="section-copy">Add products to the cart, apply discounts and tax, then complete the bill.</p>
              <form data-add-cart class="form-grid" style="margin-top:16px">
                <label class="form-field"><span>Product</span><select class="select" name="sku">${app.products.getProducts().filter((p) => p.IsActive).map((product) => `<option value="${app.help.escapeHtml(product.SKU)}">${app.help.escapeHtml(product.SKU)} - ${app.help.escapeHtml(product.Name)}</option>`).join("")}</select></label>
                <label class="form-field"><span>Quantity</span><input class="input" name="quantity" type="number" min="1" step="1" value="1"></label>
                <div class="form-actions" style="grid-column:1 / -1"><button class="btn btn-primary" type="submit">Add to Cart</button></div>
              </form>
              <div data-cart-table style="margin-top:16px"></div>
            </article>
            <article class="panel">
              <h2 class="section-title">Bill Preview</h2>
              <div data-bill-preview class="summary-list" style="margin-top:14px"></div>
              <form data-complete-bill class="form-grid" style="margin-top:16px">
                <label class="form-field"><span>Manual discount type</span><select class="select" name="manualDiscountType">
                  <option value="None">No manual discount</option>
                  <option value="Percentage">Percentage</option>
                  <option value="FlatAmount">Flat amount</option>
                </select></label>
                <label class="form-field"><span>Manual discount value</span><input class="input" name="manualDiscountValue" type="number" min="0" step="0.01" value="0" disabled></label>
                <div class="field-help" data-discount-help style="grid-column:1 / -1">No manual discount applied.</div>
                <label class="form-field"><span>Customer name</span><input class="input" name="customerName" placeholder="Walk-in Customer"></label>
                <label class="form-field"><span>Paid amount</span><input class="input" name="paidAmount" type="number" min="0" step="0.01"></label>
                <div class="form-actions" style="grid-column:1 / -1">
                  <button class="btn btn-secondary" type="button" data-clear-cart>Clear</button>
                  <button class="btn btn-primary" type="submit">Complete Bill</button>
                </div>
              </form>
            </article>
          </section>
          <div data-recent-orders></div>
        </div>
      `;

      const cartTarget = root.querySelector("[data-cart-table]");
      const previewTarget = root.querySelector("[data-bill-preview]");
      const paidInput = root.querySelector("[name=paidAmount]");
      const discountTypeInput = root.querySelector("[name=manualDiscountType]");
      const discountValueInput = root.querySelector("[name=manualDiscountValue]");
      const discountHelp = root.querySelector("[data-discount-help]");

      function resetPaymentSuggestion() {
        paidInput.value = "";
        suggestedPaidAmount = "";
      }

      function normalizeQuantity(value) {
        const quantity = Number(value);
        if (!Number.isFinite(quantity)) {
          return null;
        }
        return Math.max(0, Math.trunc(quantity));
      }

      function sanitizeCart() {
        const grouped = app.help.groupBy(
          cart
            .map((item) => ({
              SKU: app.check.normalizeSku(item.SKU),
              Quantity: normalizeQuantity(item.Quantity)
            }))
            .filter((item) => item.SKU && item.Quantity > 0),
          (item) => item.SKU
        );

        cart = Object.keys(grouped).map((sku) => ({
          SKU: sku,
          Quantity: app.help.sum(grouped[sku], (item) => item.Quantity)
        }));
      }

      function cartWithoutSku(sku) {
        const normalizedSku = app.check.normalizeSku(sku);
        return cart.filter((item) => app.check.normalizeSku(item.SKU) !== normalizedSku);
      }

      function setCartQuantity(sku, value) {
        const normalizedSku = app.check.normalizeSku(sku);
        const quantity = normalizeQuantity(value);
        if (quantity === null) {
          renderCart();
          return;
        }

        if (Number(value) < 0) {
          app.toast.warning("Quantity cannot be negative.");
        }

        if (quantity <= 0) {
          cart = cartWithoutSku(normalizedSku);
          resetPaymentSuggestion();
          renderCart();
          return;
        }

        const remainingCart = cartWithoutSku(normalizedSku);
        const availability = app.bills.validateCartItemAvailability(remainingCart, normalizedSku, quantity);
        if (!availability.Success) {
          app.toast.error(availability.Message === "Item is out of stock" ? "Item is out of stock" : availability.Message);
          renderCart();
          return;
        }

        cart = [...remainingCart, { SKU: normalizedSku, Quantity: quantity }];
        resetPaymentSuggestion();
        renderCart();
      }

      function getManualDiscount() {
        if (discountTypeInput.value === "None") {
          return { Type: "None", Value: 0 };
        }
        return {
          Type: discountTypeInput.value,
          Value: Number(discountValueInput.value || 0)
        };
      }

      function refreshDiscountState() {
        const isEnabled = discountTypeInput.value !== "None";
        discountValueInput.disabled = !isEnabled;
        if (!isEnabled) {
          discountValueInput.value = "0";
          discountHelp.textContent = "No manual discount applied.";
        } else {
          discountHelp.textContent = discountTypeInput.value === "Percentage"
            ? "Enter a percentage from 0 to 100."
            : "Enter a flat amount that does not exceed the discounted subtotal.";
        }
      }

      function setSuggestedPaidAmount(totalAmount) {
        const nextValue = Number(totalAmount).toFixed(2);
        if (!paidInput.value || paidInput.value === suggestedPaidAmount) {
          paidInput.value = nextValue;
        }
        suggestedPaidAmount = nextValue;
      }

      function renderCart() {
        sanitizeCart();
        const cartPreview = app.bills.previewBill(cart);
        const preview = app.bills.previewBill(cart, getManualDiscount());
        const items = cartPreview.Order?.Items || [];

        cartTarget.innerHTML = items.length
          ? `
            <div class="table-wrap">
              <table class="data-table cart-table" style="min-width:560px">
                <thead><tr><th>SKU</th><th>Item</th><th>Count</th><th>Discount</th><th>Line</th><th></th></tr></thead>
                <tbody>
                  ${items.map((item) => `
                    <tr>
                      <td>${app.help.escapeHtml(item.SKU)}</td>
                      <td>${app.help.escapeHtml(item.ProductName)}</td>
                      <td>
                        <div class="quantity-control">
                          <button class="icon-btn quantity-step" type="button" data-decrease-cart="${app.help.escapeHtml(item.SKU)}" aria-label="Decrease ${app.help.escapeHtml(item.SKU)} quantity">-</button>
                          <input class="input quantity-input" type="number" min="0" step="1" value="${app.help.escapeHtml(item.Quantity)}" data-cart-quantity="${app.help.escapeHtml(item.SKU)}" aria-label="Quantity for ${app.help.escapeHtml(item.SKU)}">
                          <button class="icon-btn quantity-step" type="button" data-increase-cart="${app.help.escapeHtml(item.SKU)}" aria-label="Increase ${app.help.escapeHtml(item.SKU)} quantity">+</button>
                        </div>
                      </td>
                      <td>${app.fmt.currency(item.DiscountAmount)}</td>
                      <td>${app.fmt.currency(item.LineTotal)}</td>
                      <td><button class="btn btn-secondary" type="button" data-remove-cart="${app.help.escapeHtml(item.SKU)}">Remove</button></td>
                    </tr>
                  `).join("")}
                </tbody>
              </table>
            </div>
          `
          : `<div class="empty-state"><div><strong>Cart is empty</strong><span>Add SKU quantities to preview discounts and tax.</span></div></div>`;

        if (!preview.Success) {
          previewTarget.innerHTML = `<div class="alert-item"><div><strong>Preview unavailable</strong><span class="section-copy">${app.help.escapeHtml(preview.Message)}</span></div>${app.help.renderBadge("Blocked", "red")}</div>`;
        } else {
          previewTarget.innerHTML = `
            <div class="summary-row"><span>Subtotal</span><strong>${app.fmt.currency(preview.Order.Subtotal)}</strong></div>
            <div class="summary-row"><span>Promotion discount</span><strong>${app.fmt.currency(preview.Order.PromotionDiscountTotal)}</strong></div>
            <div class="summary-row"><span>Manual discount</span><strong>${app.fmt.currency(preview.Order.ManualDiscountAmount)}</strong></div>
            <div class="summary-row"><span>Total discount</span><strong>${app.fmt.currency(preview.Order.DiscountTotal)}</strong></div>
            <div class="summary-row"><span>Tax</span><strong>${app.fmt.currency(preview.Order.TaxAmount)}</strong></div>
            <div class="summary-row"><span>Total</span><strong>${app.fmt.currency(preview.Order.TotalAmount)}</strong></div>
          `;
          setSuggestedPaidAmount(preview.Order.TotalAmount);
        }

        root.querySelectorAll("[data-remove-cart]").forEach((button) => {
          button.addEventListener("click", () => {
            cart = cart.filter((item) => app.check.normalizeSku(item.SKU) !== app.check.normalizeSku(button.dataset.removeCart));
            resetPaymentSuggestion();
            renderCart();
          });
        });

        root.querySelectorAll("[data-decrease-cart]").forEach((button) => {
          button.addEventListener("click", () => {
            const current = cart.find((item) => app.check.normalizeSku(item.SKU) === app.check.normalizeSku(button.dataset.decreaseCart));
            setCartQuantity(button.dataset.decreaseCart, Number(current?.Quantity || 0) - 1);
          });
        });

        root.querySelectorAll("[data-increase-cart]").forEach((button) => {
          button.addEventListener("click", () => {
            const current = cart.find((item) => app.check.normalizeSku(item.SKU) === app.check.normalizeSku(button.dataset.increaseCart));
            setCartQuantity(button.dataset.increaseCart, Number(current?.Quantity || 0) + 1);
          });
        });

        root.querySelectorAll("[data-cart-quantity]").forEach((input) => {
          input.addEventListener("input", () => {
            if (input.value !== "") {
              const current = cart.find((item) => app.check.normalizeSku(item.SKU) === app.check.normalizeSku(input.dataset.cartQuantity));
              const quantity = normalizeQuantity(input.value);
              if (quantity !== null && quantity === Number(current?.Quantity || 0)) {
                return;
              }
              setCartQuantity(input.dataset.cartQuantity, input.value);
            }
          });
          input.addEventListener("change", () => {
            if (input.value === "") {
              renderCart();
              return;
            }
            setCartQuantity(input.dataset.cartQuantity, input.value);
          });
        });
      }

      root.querySelector("[data-add-cart]").addEventListener("submit", (event) => {
        event.preventDefault();
        const data = new FormData(event.target);
        const sku = data.get("sku");
        const rawQuantity = Number(data.get("quantity") || 1);
        const quantity = Number.isFinite(rawQuantity) && rawQuantity > 0 ? Math.trunc(rawQuantity) : 0;

        if (quantity <= 0) {
          app.toast.error("Quantity must be greater than zero.");
          return;
        }

        const availability = app.bills.validateCartItemAvailability(cart, sku, quantity);

        if (!availability.Success) {
          app.toast.error(availability.Message === "Item is out of stock" ? "Item is out of stock" : availability.Message);
          return;
        }

        const existing = cart.find((item) => app.check.normalizeSku(item.SKU) === app.check.normalizeSku(sku));
        if (existing) {
          cart = cart.map((item) => app.check.normalizeSku(item.SKU) === app.check.normalizeSku(sku)
            ? { ...item, Quantity: Number(item.Quantity) + quantity }
            : item);
        } else {
          cart = [...cart, { SKU: app.check.normalizeSku(sku), Quantity: quantity }];
        }
        event.target.quantity.value = 1;
        resetPaymentSuggestion();
        renderCart();
      });

      discountTypeInput.addEventListener("change", () => {
        refreshDiscountState();
        resetPaymentSuggestion();
        renderCart();
      });

      discountValueInput.addEventListener("input", app.help.debounce(() => {
        resetPaymentSuggestion();
        renderCart();
      }, 80));

      root.querySelector("[data-clear-cart]").addEventListener("click", () => {
        cart = [];
        resetPaymentSuggestion();
        discountTypeInput.value = "None";
        refreshDiscountState();
        renderCart();
      });

      root.querySelector("[data-complete-bill]").addEventListener("submit", (event) => {
        event.preventDefault();
        const user = app.data.getUser();
        const data = new FormData(event.target);
        const result = app.bills.createBill(
          cart,
          user.UserId,
          user.Username,
          data.get("customerName"),
          Number(data.get("paidAmount")),
          getManualDiscount()
        );

        if (!result.Success) {
          app.toast.error(result.Message);
          return;
        }

        app.toast.success(`${result.Message} Change due: ${app.fmt.currency(result.Order.ChangeDue)}.`);
        cart = [];
        this.render(root);
      });

      root.querySelector("[data-recent-orders]").appendChild(app.tables.create({
        title: "Recent Orders",
        exportName: "orders",
        data: recentOrders,
        searchKeys: ["OrderId", "CustomerName", "CashierName", "Status"],
        columns: [
          { key: "OrderId", label: "Order" },
          { key: "CreatedAt", label: "Date", render: (row) => app.fmt.dateTime(row.CreatedAt) },
          { key: "CustomerName", label: "Customer" },
          { key: "CashierName", label: "Cashier" },
          { key: "Subtotal", label: "Subtotal", render: (row) => app.fmt.currency(row.Subtotal) },
          { key: "DiscountTotal", label: "Discount", render: (row) => app.fmt.currency(row.DiscountTotal) },
          { key: "TaxAmount", label: "Tax", render: (row) => app.fmt.currency(row.TaxAmount) },
          { key: "TotalAmount", label: "Total", render: (row) => app.fmt.currency(row.TotalAmount) }
        ],
        actions: [
          {
            label: "View",
            handler: (row) => {
              app.popup.open({
                title: row.OrderId,
                size: "large",
                content: `
                  <div class="summary-list">
                    ${row.Items.map((item) => `
                      <div class="summary-row">
                        <span>${app.help.escapeHtml(item.SKU)} x ${item.Quantity} - ${app.help.escapeHtml(item.ProductName)}</span>
                        <strong>${app.fmt.currency(item.LineTotal)}</strong>
                      </div>
                    `).join("")}
                    <div class="summary-row"><span>Subtotal</span><strong>${app.fmt.currency(row.Subtotal)}</strong></div>
                    <div class="summary-row"><span>Promotion discount</span><strong>${app.fmt.currency(row.PromotionDiscountTotal ?? row.DiscountTotal)}</strong></div>
                    <div class="summary-row"><span>Manual discount</span><strong>${app.fmt.currency(row.ManualDiscountAmount || 0)}</strong></div>
                    <div class="summary-row"><span>Discount note</span><strong>${app.help.escapeHtml(discountLabel(row))}</strong></div>
                    <div class="summary-row"><span>Total</span><strong>${app.fmt.currency(row.TotalAmount)}</strong></div>
                    <div class="summary-row"><span>Paid</span><strong>${app.fmt.currency(row.PaidAmount)}</strong></div>
                    <div class="summary-row"><span>Change due</span><strong>${app.fmt.currency(row.ChangeDue)}</strong></div>
                  </div>
                `
              });
            }
          }
        ]
      }));

      refreshDiscountState();
      renderCart();
    }
  };
}

// settings page
{
app.pages = app.pages || {};
  app.pages.settings = {
    render(root) {
      const settings = app.settings.getSettings();
      const collectionStats = Object.keys(app.setup.dataFiles).map((name) => {
        const value = app.data.get(name);
        return {
          Collection: name,
          Records: Array.isArray(value) ? value.length : 1,
          StorageKey: `${app.setup.storagePrefix}.${name}`
        };
      });

      root.innerHTML = `
        <div class="page-stack">
          <section class="grid grid-4">
            ${app.parts.metric("Company", app.help.escapeHtml(settings.CompanyName || "RetailOps"), "Displayed throughout the workspace", "Local")}
            ${app.parts.metric("Currency", app.help.escapeHtml(settings.Currency || "INR"), "Formatting locale en-IN", "Finance")}
            ${app.parts.metric("Tax rate", app.fmt.percent(Number(settings.TaxRate || app.setup.taxRate) * 100), "Billing tax calculation", "Tax")}
            ${app.parts.metric("Default WH", app.help.escapeHtml(settings.DefaultWarehouseId || "MAIN"), "Inventory creation default", "Ops")}
          </section>
          <section class="grid grid-2">
            <article class="panel">
              <h2 class="section-title">Simulation Settings</h2>
              <div data-settings-form style="margin-top:16px"></div>
            </article>
            <article class="panel">
              <h2 class="section-title">Local Data Controls</h2>
              <p class="section-copy">Changes are saved in browser localStorage. Reset reloads the bundled sample data.</p>
              <div class="summary-list" style="margin-top:16px">
                <div class="summary-row"><span>Persistence</span><strong>localStorage</strong></div>
                <div class="summary-row"><span>Sample data</span><strong>js/data.js</strong></div>
                <div class="summary-row"><span>Runtime</span><strong>Browser only</strong></div>
              </div>
              <div class="form-actions">
                <button class="btn btn-danger" type="button" data-reset-data>Reset Local Data</button>
              </div>
            </article>
          </section>
          <div data-collections-table></div>
        </div>
      `;

      const form = app.forms.create([
        { name: "CompanyName", label: "Company name", required: true },
        { name: "Currency", label: "Currency", required: true },
        { name: "TaxRate", label: "Tax rate", type: "number", min: 0, step: 0.01, required: true },
        { name: "DefaultWarehouseId", label: "Default warehouse", type: "select", options: app.parts.warehouseOptions() },
        { name: "LowStockAlertWindowDays", label: "Low stock alert window", type: "number", min: 1, step: 1 },
        { name: "ForecastHorizonDays", label: "Forecast horizon days", type: "number", min: 1, step: 1 },
        {
          name: "ThemeDensity",
          label: "Theme density",
          type: "select",
          options: [
            { value: "Comfortable", label: "Comfortable" },
            { value: "Compact", label: "Compact" }
          ]
        },
        { name: "RequireManagerApproval", label: "Require manager approval", type: "checkbox" }
      ], settings, (payload) => {
        app.settings.updateSettings(payload);
        app.toast.success("Settings updated.");
        this.render(root);
      }, { submitLabel: "Save settings", cancelLabel: "Revert", onCancel: () => this.render(root) });
      root.querySelector("[data-settings-form]").appendChild(form);

      root.querySelector("[data-reset-data]").addEventListener("click", async () => {
        const ok = await app.popup.confirm({
          title: "Reset local data",
          message: "This clears localStorage changes and reloads the bundled sample data.",
          danger: true,
          confirmLabel: "Reset"
        });
        if (ok) {
          app.data.resetLocalData();
          app.logs.log(app.data.getUser(), "ResetData", "Settings", "LOCAL", "Reset browser-local data to sample data.");
          app.toast.success("Local data reset.");
          this.render(root);
        }
      });

      root.querySelector("[data-collections-table]").appendChild(app.tables.create({
        title: "Local Collections",
        exportName: "collections",
        data: collectionStats,
        pageSize: 12,
        searchKeys: ["Collection", "StorageKey"],
        columns: [
          { key: "Collection", label: "Collection" },
          { key: "Records", label: "Records" },
          { key: "StorageKey", label: "Storage key" }
        ]
      }));
    }
  };
}

// logs page
{
app.pages = app.pages || {};
  app.pages.logs = {
    render(root) {
      const logs = app.logs.getRecent(200);
      const actions = app.help.groupBy(logs, (log) => log.Action);
      const actionChart = Object.entries(actions)
        .map(([label, rows]) => ({ label, value: rows.length, displayValue: app.fmt.number(rows.length) }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 8);

      root.innerHTML = `
        <div class="page-stack">
          <section class="grid grid-4">
            ${app.parts.metric("Audit events", app.fmt.number(logs.length), "Recent browser-local events", "Trace")}
            ${app.parts.metric("Users", app.fmt.number(app.help.unique(logs.map((log) => log.Username)).length), "Actors in log history", "Access")}
            ${app.parts.metric("Entities", app.fmt.number(app.help.unique(logs.map((log) => log.EntityName)).length), "Touched business objects", "Audit")}
            ${app.parts.metric("Latest event", logs[0] ? app.fmt.date(logs[0].CreatedAt) : "-", "Most recent activity", "Now")}
          </section>
          <section class="panel chart-card">
            <h2 class="section-title">Activity by Action</h2>
            ${app.chart.bar(actionChart, { label: "Activity by action" })}
          </section>
          <div data-logs-table></div>
        </div>
      `;

      root.querySelector("[data-logs-table]").appendChild(app.tables.create({
        title: "Activity Log",
        exportName: "activity-log",
        data: logs,
        searchKeys: ["AuditLogId", "Username", "Action", "EntityName", "EntityId", "Details"],
        columns: [
          { key: "CreatedAt", label: "Time", render: (row) => app.fmt.dateTime(row.CreatedAt) },
          { key: "Username", label: "User" },
          { key: "Action", label: "Action" },
          { key: "EntityName", label: "Entity" },
          { key: "EntityId", label: "Entity ID" },
          { key: "Details", label: "Details" }
        ]
      }));
    }
  };
}

// start the app
async function startApp() {
  function showLoading() {
    document.getElementById("app").innerHTML = `
      <main class="content">
        <div class="page-stack">
          <section class="grid grid-4">
            <div class="metric-card"><div class="skeleton"></div><div class="skeleton" style="height:32px"></div><div class="skeleton"></div></div>
            <div class="metric-card"><div class="skeleton"></div><div class="skeleton" style="height:32px"></div><div class="skeleton"></div></div>
            <div class="metric-card"><div class="skeleton"></div><div class="skeleton" style="height:32px"></div><div class="skeleton"></div></div>
            <div class="metric-card"><div class="skeleton"></div><div class="skeleton" style="height:32px"></div><div class="skeleton"></div></div>
          </section>
        </div>
      </main>
    `;
  }

  try {
    showLoading();
    await app.data.load();
    for (var pageName in app.pages) {
      app.nav.register(pageName, app.pages[pageName].render.bind(app.pages[pageName]));
    }
    app.nav.start();
  } catch (error) {
    console.error(error);
    document.getElementById("app").innerHTML = `
      <main class="content">
        <section class="panel">
          <h1 class="section-title">RetailOps could not start</h1>
          <p class="section-copy">${app.help.escapeHtml(error.message)}</p>
        </section>
      </main>
    `;
  }
}

startApp();

