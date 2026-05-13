/* Inventory stock logic and inventory page. */

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


