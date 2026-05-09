(function (app) {
  function addInventoryFields() {
    return [
      { name: "ProductId", label: "Product", type: "select", options: app.shared.productOptions(), required: true },
      { name: "SKU", label: "SKU", required: true, help: "Must match an existing product SKU." },
      { name: "WarehouseId", label: "Warehouse", type: "select", options: app.shared.warehouseOptions() },
      { name: "QuantityAvailable", label: "Quantity", type: "number", min: 0, step: 1, required: true },
      { name: "SafetyStock", label: "Safety stock", type: "number", min: 0, step: 1, required: true }
    ];
  }

  function adjustFields(row) {
    return [
      { name: "SKU", label: "SKU", required: true },
      { name: "WarehouseId", label: "Warehouse", type: "select", options: app.shared.warehouseOptions() },
      { name: "Quantity", label: "Quantity adjustment", type: "number", step: 1, required: true, help: "Use negative values for outbound adjustment." }
    ];
  }

  app.pages = app.pages || {};
  app.pages.inventory = {
    render(root) {
      const inventory = app.inventoryService.getInventory();
      const warehouses = app.store.get("warehouses");
      const totalStock = app.helpers.sum(inventory, (item) => item.QuantityAvailable);
      const stockValue = app.helpers.sum(inventory, (item) => {
        const product = app.productService.getBySku(item.SKU);
        return Number(item.QuantityAvailable) * Number(product?.Price || 0);
      });
      const low = inventory.filter((item) => item.QuantityAvailable <= item.ReorderThreshold).length;

      root.innerHTML = `
        <div class="page-stack">
          <section class="grid grid-4">
            ${app.shared.metric("Stock units", app.format.number(totalStock), "Available units across warehouses", "Live")}
            ${app.shared.metric("Stock value", app.format.currency(stockValue), "Retail value estimate", "INR")}
            ${app.shared.metric("Low records", app.format.number(low), "Warehouse rows at or below threshold", "Alert")}
            ${app.shared.metric("Warehouses", app.format.number(warehouses.length), "Active local fulfillment nodes", "Network")}
          </section>
          <section class="section-band">
            <div class="toolbar">
              <div>
                <h2 class="section-title">Inventory Ledger</h2>
                <p class="section-copy">Add inventory rows and adjust stock with the same non-negative validation used by the console service.</p>
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
        const firstProduct = app.store.get("products")[0];
        app.shared.openFormModal("Add inventory", addInventoryFields(), {
          ProductId: firstProduct?.ProductId,
          SKU: firstProduct?.SKU,
          WarehouseId: "MAIN",
          QuantityAvailable: 0,
          SafetyStock: 0
        }, "Add inventory", (payload) => {
          app.inventoryService.addInventory(payload);
          app.toast.success("Inventory added successfully.");
          this.render(root);
        });
      });

      root.querySelector("[data-adjust-stock]").addEventListener("click", () => {
        app.shared.openFormModal("Adjust stock", adjustFields(), { WarehouseId: "MAIN", Quantity: 0 }, "Apply adjustment", (payload) => {
          app.inventoryService.updateStock(payload.SKU, payload.Quantity, payload.WarehouseId);
          app.toast.success("Stock updated successfully.");
          this.render(root);
        });
      });

      root.querySelector("[data-inventory-table]").appendChild(app.table.create({
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
          { key: "Status", label: "Status", value: (row) => row.QuantityAvailable <= row.ReorderThreshold ? "Low" : "Healthy", render: (row) => app.shared.stockBadge(row.QuantityAvailable, row.ReorderThreshold) },
          { key: "LastUpdatedAt", label: "Updated", render: (row) => app.format.dateTime(row.LastUpdatedAt) }
        ],
        actions: [
          {
            label: "Adjust",
            handler: (row) => {
              app.shared.openFormModal("Adjust stock", adjustFields(row), {
                SKU: row.SKU,
                WarehouseId: row.WarehouseId,
                Quantity: 0
              }, "Apply adjustment", (payload) => {
                app.inventoryService.updateStock(payload.SKU, payload.Quantity, payload.WarehouseId);
                app.toast.success("Stock updated successfully.");
                this.render(root);
              });
            }
          }
        ]
      }));
    }
  };
})(window.RetailOps = window.RetailOps || {});
