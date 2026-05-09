(function (app) {
  function renderReport(root, type) {
    let content = "";
    if (type === "sales") {
      const from = root.querySelector("[name=from]")?.value;
      const to = root.querySelector("[name=to]")?.value;
      content = app.reportService.generateSalesReport(from, to);
    } else if (type === "low") {
      content = app.reportService.generateLowStockReport();
    } else {
      content = app.reportService.generatePromotionReport();
    }

    root.querySelector("[data-report-output]").textContent = content;
    root.querySelector("[data-save-report]").dataset.content = content;
    root.querySelector("[data-save-report]").dataset.file = type === "sales"
      ? "SalesReport.txt"
      : type === "low"
        ? "LowStockReport.txt"
        : "PromotionReport.txt";
  }

  app.pages = app.pages || {};
  app.pages.reports = {
    render(root) {
      const orders = app.store.get("orders");
      const discounts = app.helpers.sum(orders, (order) => order.DiscountTotal);
      const revenue = app.helpers.sum(orders, (order) => order.TotalAmount);
      const lowStock = app.replenishmentService.generateReplenishmentReport().filter((item) => item.IsLowStock).length;

      root.innerHTML = `
        <div class="page-stack">
          <section class="grid grid-4">
            ${app.shared.metric("Orders", app.format.number(orders.length), "Completed sales orders", "Sales")}
            ${app.shared.metric("Revenue", app.format.currency(revenue), "Tax-inclusive completed revenue", "Report")}
            ${app.shared.metric("Discounts", app.format.currency(discounts), "Promotion value consumed", "Promo")}
            ${app.shared.metric("Low stock lines", app.format.number(lowStock), "Rows in low-stock report", "Supply")}
          </section>
          <section class="panel">
            <div class="toolbar">
              <div>
                <h2 class="section-title">Report Generator</h2>
                <p class="section-copy">The console text reports are preserved and can be downloaded locally.</p>
              </div>
              <div class="toolbar-right">
                <button class="btn btn-secondary" type="button" data-report-type="sales">Sales</button>
                <button class="btn btn-secondary" type="button" data-report-type="low">Low Stock</button>
                <button class="btn btn-secondary" type="button" data-report-type="promo">Promotion</button>
                <button class="btn btn-primary" type="button" data-save-report>Download</button>
              </div>
            </div>
            <div class="form-grid" style="margin:16px 0">
              <label class="form-field"><span>Sales from</span><input class="input" type="date" name="from"></label>
              <label class="form-field"><span>Sales to</span><input class="input" type="date" name="to"></label>
            </div>
            <pre class="report-output" data-report-output></pre>
          </section>
        </div>
      `;

      root.querySelectorAll("[data-report-type]").forEach((button) => {
        button.addEventListener("click", () => renderReport(root, button.dataset.reportType));
      });
      root.querySelector("[data-save-report]").addEventListener("click", (event) => {
        const content = event.currentTarget.dataset.content || root.querySelector("[data-report-output]").textContent;
        const file = event.currentTarget.dataset.file || "SalesReport.txt";
        app.reportService.saveReport(file, content);
      });
      renderReport(root, "sales");
    }
  };
})(window.RetailOps = window.RetailOps || {});
