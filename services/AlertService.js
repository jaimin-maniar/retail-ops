(function (app) {
  app.alertService = {
    getAlerts() {
      const alerts = [];
      const products = app.store.get("products");

      app.store.get("inventory").forEach((inventory) => {
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

      const now = app.helpers.todayDateOnly();
      const expiryWindow = app.helpers.addDays(now, 7);
      app.store.get("promotions").forEach((promotion) => {
        const end = app.helpers.toDateOnly(promotion.EndDate);
        if (promotion.IsActive && end >= now && end <= expiryWindow) {
          alerts.push({
            Type: "PromotionExpiring",
            Tone: "blue",
            Title: `Promotion expiring: ${promotion.Name}`,
            Details: `Ends on ${app.format.date(promotion.EndDate)}.`
          });
        }
      });

      return alerts;
    }
  };
})(window.RetailOps = window.RetailOps || {});
