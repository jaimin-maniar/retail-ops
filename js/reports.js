/* Report filtering, report output, and reports page. */

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


