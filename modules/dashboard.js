(function (app) {
  function kpis() {
    const products = app.store.get("products");
    const inventory = app.store.get("inventory");
    const report = app.replenishmentService.generateReplenishmentReport();
    const orders = app.store.get("orders");
    const activePromos = app.promotionService.getActivePromotions();
    const stockUnits = app.helpers.sum(inventory, (item) => item.QuantityAvailable);
    const lowStock = report.filter((item) => item.IsLowStock).length;
    const revenue = app.helpers.sum(orders, (order) => order.TotalAmount);

    return [
      app.shared.metric("Active products", app.format.number(products.filter((p) => p.IsActive).length), "Catalog records ready for sale", "Live"),
      app.shared.metric("Stock on hand", app.format.number(stockUnits), "Units available across warehouses", `${lowStock} low`),
      app.shared.metric("Open promotions", app.format.number(activePromos.length), "Currently eligible discount programs", "Best deal"),
      app.shared.metric("Sales revenue", app.format.currency(revenue), "Completed local orders", `${orders.length} orders`)
    ].join("");
  }

  function categoryChart() {
    const products = app.store.get("products");
    const stockByCategory = {};
    app.inventoryService.getInventory().forEach((item) => {
      stockByCategory[item.Category || "Unassigned"] = (stockByCategory[item.Category || "Unassigned"] || 0) + Number(item.QuantityAvailable);
    });
    const data = Object.entries(stockByCategory).map(([label, value]) => ({ label, value, displayValue: app.format.number(value) }));
    return app.charts.bar(data, { label: "Stock by category" });
  }

  function flowVisual() {
    const report = app.replenishmentService.generateReplenishmentReport();
    const totalSuggestions = app.helpers.sum(report, (item) => item.SuggestedQuantity);
    const activePromos = app.promotionService.getActivePromotions().length;
    const forecastRisk = app.forecastService.getForecastRows().filter((row) => row.Risk !== "Stable").length;
    const rows = [
      ["Low stock SKUs", report.filter((item) => item.IsLowStock).length, 100],
      ["Suggested units", totalSuggestions, Math.max(100, totalSuggestions)],
      ["Active promos", activePromos, 10],
      ["Forecast risks", forecastRisk, 12]
    ];

    return `
      <div class="flow-chart">
        ${rows.map(([label, value, max]) => `
          <div class="flow-row">
            <span class="flow-label">${app.helpers.escapeHtml(label)}</span>
            <span class="flow-track"><span class="flow-fill" style="width:${Math.max(4, Math.min(100, (value / max) * 100))}%"></span></span>
            <span class="flow-value">${app.helpers.escapeHtml(value)}</span>
          </div>
        `).join("")}
      </div>
    `;
  }

  app.pages = app.pages || {};
  app.pages.dashboard = {
    render(root) {
      const alerts = app.alertService.getAlerts().slice(0, 5);
      const lowStockRows = app.replenishmentService.generateReplenishmentReport().filter((item) => item.IsLowStock).slice(0, 8);
      const recentOrders = app.billingService.getRecentOrders(5);
      const orders = app.store.get("orders");
      const lastOrder = recentOrders[0];

      root.innerHTML = `
        <div class="page-stack">
          <section class="hero-panel">
            <div class="hero-copy">
              <p class="hero-eyebrow">Operations command center</p>
              <h2 class="hero-title">Stock, promotions, forecast risk, and replenishment exceptions in one planning view.</h2>
              <p class="hero-text">The dashboard consolidates the console application's product, inventory, promotion, billing, alert, replenishment, report, and audit workflows into an enterprise navigation model.</p>
              <div class="hero-insights">
                <div class="mini-stat"><strong>${app.format.number(lowStockRows.length)}</strong><span>low-stock records</span></div>
                <div class="mini-stat"><strong>${app.format.currency(app.helpers.sum(orders, (o) => o.DiscountTotal))}</strong><span>promo discounts given</span></div>
                <div class="mini-stat"><strong>${lastOrder ? app.format.date(lastOrder.CreatedAt) : "-"}</strong><span>latest order date</span></div>
              </div>
            </div>
            <div class="hero-visual">${flowVisual()}</div>
          </section>

          <section class="grid grid-4">${kpis()}</section>

          <section class="grid grid-2">
            <article class="panel chart-card">
              <div class="section-header">
                <div><h3 class="section-title">Inventory by Category</h3><p class="section-copy">Pure CSS bars using live inventory rows.</p></div>
              </div>
              ${categoryChart()}
            </article>
            <article class="panel">
              <div class="section-header">
                <div><h3 class="section-title">Alerts</h3><p class="section-copy">Same low-stock and promotion-expiry rules as the console alert service.</p></div>
              </div>
              <div class="alert-list" style="margin-top:14px">
                ${alerts.length ? alerts.map((alert) => `
                  <div class="alert-item">
                    <div><strong>${app.helpers.escapeHtml(alert.Title)}</strong><span class="section-copy">${app.helpers.escapeHtml(alert.Details)}</span></div>
                    ${app.helpers.renderBadge(alert.Type, alert.Tone)}
                  </div>
                `).join("") : `<div class="empty-state"><div><strong>No alerts</strong><span>Inventory and promotions are currently within expected ranges.</span></div></div>`}
              </div>
            </article>
          </section>

          <section class="grid grid-2">
            <div data-low-stock-table></div>
            <div data-orders-table></div>
          </section>
        </div>
      `;

      root.querySelector("[data-low-stock-table]").appendChild(app.table.create({
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
          { key: "Status", label: "Status", value: (row) => row.IsLowStock ? "Low" : "Healthy", render: (row) => app.shared.stockBadge(row.CurrentStock, row.ReorderThreshold) }
        ]
      }));

      root.querySelector("[data-orders-table]").appendChild(app.table.create({
        title: "Recent Orders",
        exportName: "recent-orders",
        data: recentOrders,
        pageSize: 5,
        searchKeys: ["OrderId", "CustomerName", "CashierName"],
        columns: [
          { key: "OrderId", label: "Order" },
          { key: "CreatedAt", label: "Date", render: (row) => app.format.dateTime(row.CreatedAt) },
          { key: "CustomerName", label: "Customer" },
          { key: "TotalAmount", label: "Total", render: (row) => app.format.currency(row.TotalAmount) }
        ]
      }));
    }
  };
})(window.RetailOps = window.RetailOps || {});
