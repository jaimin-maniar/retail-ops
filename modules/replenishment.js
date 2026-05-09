(function (app) {
  app.pages = app.pages || {};
  app.pages.replenishment = {
    render(root) {
      const recommendations = app.replenishmentService.generateReplenishmentReport();
      const low = recommendations.filter((item) => item.IsLowStock);
      const suggestedUnits = app.helpers.sum(recommendations, (item) => item.SuggestedQuantity);
      const pending = app.store.get("replenishment").filter((item) => item.Status === "Pending").length;

      root.innerHTML = `
        <div class="page-stack">
          <section class="grid grid-4">
            ${app.shared.metric("Recommendations", app.format.number(recommendations.length), "Inventory rows analyzed", "Engine")}
            ${app.shared.metric("Low stock", app.format.number(low.length), "Rows requiring action", "Threshold")}
            ${app.shared.metric("Suggested units", app.format.number(suggestedUnits), "Threshold + safety - stock", "Formula")}
            ${app.shared.metric("Pending approvals", app.format.number(pending), "Saved replenishment records", "Workflow")}
          </section>
          <section class="grid grid-2">
            <article class="panel chart-card">
              <div><h2 class="section-title">Suggested Quantity by SKU</h2><p class="section-copy">Generated directly from the converted replenishment formula.</p></div>
              ${app.charts.bar(low.slice(0, 8).map((item) => ({ label: item.SKU, value: item.SuggestedQuantity, displayValue: app.format.number(item.SuggestedQuantity) })), { label: "Suggested reorder quantities" })}
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

      root.querySelector("[data-replenishment-table]").appendChild(app.table.create({
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
          { key: "IsLowStock", label: "Status", render: (row) => app.shared.stockBadge(row.CurrentStock, row.ReorderThreshold) }
        ],
        actions: [
          {
            label: "Create",
            handler: (row) => {
              app.shared.openFormModal("Create replenishment", [
                { name: "ApprovedQuantity", label: "Approved quantity", type: "number", min: 0, step: 1, required: true }
              ], { ApprovedQuantity: row.SuggestedQuantity }, "Create request", (payload) => {
                app.replenishmentService.createRequest(row, payload.ApprovedQuantity);
                app.toast.success("Replenishment request created.");
                this.render(root);
              });
            }
          }
        ]
      }));

      root.querySelector("[data-replenishment-history]").appendChild(app.table.create({
        title: "Replenishment History",
        exportName: "replenishment-history",
        data: app.store.get("replenishment"),
        pageSize: 5,
        searchKeys: ["ReplenishmentId", "SKU", "WarehouseId", "Status"],
        columns: [
          { key: "ReplenishmentId", label: "ID" },
          { key: "SKU", label: "SKU" },
          { key: "WarehouseId", label: "Warehouse" },
          { key: "SuggestedQuantity", label: "Suggested" },
          { key: "ApprovedQuantity", label: "Approved" },
          { key: "Status", label: "Status", render: (row) => app.helpers.renderBadge(row.Status, row.Status === "Approved" ? "green" : "amber") },
          { key: "CreatedBy", label: "Created by" },
          { key: "CreatedAt", label: "Created", render: (row) => app.format.dateTime(row.CreatedAt) }
        ]
      }));
    }
  };
})(window.RetailOps = window.RetailOps || {});
