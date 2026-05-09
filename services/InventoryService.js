(function (app) {
  const validation = app.validation;

  function enrich(inventory) {
    const products = app.store.get("products");
    const warehouses = app.store.get("warehouses");
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

  app.inventoryService = {
    getInventory() {
      return enrich(app.store.get("inventory"))
        .sort((a, b) => app.helpers.compareValues(a.SKU, b.SKU) || app.helpers.compareValues(a.WarehouseId, b.WarehouseId));
    },

    getBySku(sku) {
      const normalized = validation.normalizeSku(sku);
      return this.getInventory().find((item) => item.SKU.toUpperCase() === normalized) || null;
    },

    totalStockBySku(sku) {
      const normalized = validation.normalizeSku(sku);
      return app.helpers.sum(app.store.get("inventory").filter((item) => item.SKU.toUpperCase() === normalized), (item) => item.QuantityAvailable);
    },

    addInventory(inventory) {
      validation.assertInventory(inventory);
      const list = app.store.get("inventory");
      const normalizedSku = validation.normalizeSku(inventory.SKU);
      const product = app.store.get("products").find((item) =>
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
        InventoryId: app.helpers.nextId(list, "InventoryId", "INV", 3),
        ProductId: product.ProductId,
        SKU: product.SKU,
        QuantityAvailable: Number(inventory.QuantityAvailable),
        SafetyStock: Number(inventory.SafetyStock),
        WarehouseId: warehouseId,
        LastUpdatedAt: app.helpers.nowIso()
      };

      app.store.set("inventory", [...list, created]);
      app.auditService.log(app.store.getUser(), "AddInventory", "Inventory", created.InventoryId, `Added inventory for ${created.SKU}.`);
      return created;
    },

    updateStock(sku, quantity, warehouseId) {
      const normalizedSku = validation.normalizeSku(sku);
      const list = app.store.get("inventory");
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
      list[index].LastUpdatedAt = app.helpers.nowIso();
      app.store.set("inventory", list);
      app.auditService.log(app.store.getUser(), "AdjustStock", "Inventory", normalizedSku, `Adjusted stock by ${quantity}.`);
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
          item.LastUpdatedAt = app.helpers.nowIso();
          remaining -= deduction;
        });
    }
  };
})(window.RetailOps = window.RetailOps || {});
