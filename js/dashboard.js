/* Dashboard alerts and dashboard page. */

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


