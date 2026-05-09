(function (app) {
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
      SupplierId: product.SupplierId
    };
  }

  app.replenishmentService = {
    generateReplenishmentReport() {
      const products = app.store.get("products");
      return app.store.get("inventory")
        .map((inventory) => {
          const product = products.find((item) =>
            item.ProductId === inventory.ProductId ||
            item.SKU.toUpperCase() === String(inventory.SKU).toUpperCase()
          );
          return product ? generateResult(inventory, product) : null;
        })
        .filter(Boolean)
        .sort((a, b) => Number(b.IsLowStock) - Number(a.IsLowStock) || app.helpers.compareValues(a.SKU, b.SKU));
    },

    createRequest(row, approvedQuantity) {
      const records = app.store.get("replenishment");
      const user = app.store.getUser();
      const created = {
        ReplenishmentId: app.helpers.nextId(records, "ReplenishmentId", "REP", 3),
        SKU: row.SKU,
        ProductId: row.ProductId,
        WarehouseId: row.WarehouseId,
        SuggestedQuantity: Number(row.SuggestedQuantity),
        ApprovedQuantity: Number(approvedQuantity || row.SuggestedQuantity),
        Status: Number(approvedQuantity || row.SuggestedQuantity) > 0 ? "Approved" : "Pending",
        CreatedAt: app.helpers.nowIso(),
        CreatedBy: user?.Username || "System",
        SupplierId: row.SupplierId
      };

      app.store.set("replenishment", [...records, created]);
      app.auditService.log(user, "CreateReplenishment", "Replenishment", created.ReplenishmentId, `Created replenishment for ${created.SKU}.`);
      return created;
    }
  };
})(window.RetailOps = window.RetailOps || {});
