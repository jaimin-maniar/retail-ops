(function (app) {
  function dateInRange(order, from, to) {
    const created = app.helpers.toDate(order.CreatedAt);
    const start = from ? app.helpers.toDateOnly(from) : null;
    const end = to ? app.helpers.addDays(app.helpers.toDateOnly(to), 1) : null;
    return (!start || created >= start) && (!end || created < end);
  }

  app.reportService = {
    generateSalesReport(from, to) {
      const orders = app.store.get("orders")
        .filter((order) => dateInRange(order, from, to))
        .sort((a, b) => new Date(a.CreatedAt) - new Date(b.CreatedAt));

      const lines = [];
      lines.push("RetailOps Sales Report");
      lines.push(`Generated: ${app.format.dateTime(new Date())}`);
      lines.push("");
      lines.push(`Orders: ${orders.length}`);
      lines.push(`Subtotal: ${app.helpers.sum(orders, (o) => o.Subtotal).toFixed(2)}`);
      lines.push(`Discounts: ${app.helpers.sum(orders, (o) => o.DiscountTotal).toFixed(2)}`);
      lines.push(`Tax: ${app.helpers.sum(orders, (o) => o.TaxAmount).toFixed(2)}`);
      lines.push(`Revenue: ${app.helpers.sum(orders, (o) => o.TotalAmount).toFixed(2)}`);
      lines.push("");
      lines.push("Recent Orders");
      orders.slice(-25).forEach((order) => {
        lines.push(`${app.format.dateTime(order.CreatedAt)} | ${order.OrderId} | ${order.CustomerName} | ${Number(order.TotalAmount).toFixed(2)}`);
      });
      return lines.join("\n");
    },

    generateLowStockReport() {
      const lines = [];
      lines.push("RetailOps Low Stock Report");
      lines.push(`Generated: ${app.format.dateTime(new Date())}`);
      lines.push("");

      app.replenishmentService.generateReplenishmentReport()
        .filter((item) => item.IsLowStock)
        .forEach((item) => {
          lines.push(`${item.SKU} | ${item.ProductName} | Stock ${item.CurrentStock} | Threshold ${item.ReorderThreshold} | Suggested ${item.SuggestedQuantity}`);
        });

      return lines.join("\n");
    },

    generatePromotionReport() {
      const lines = [];
      lines.push("RetailOps Promotion Report");
      lines.push(`Generated: ${app.format.dateTime(new Date())}`);
      lines.push("");

      app.promotionService.getPromotions().forEach((promotion) => {
        const scope = promotion.SKU || promotion.ProductId || promotion.Category || "All products";
        lines.push(`${promotion.PromotionId} | ${promotion.Name} | ${promotion.Type} | ${promotion.DiscountValue} | ${scope} | ${app.format.date(promotion.StartDate)} to ${app.format.date(promotion.EndDate)} | Active: ${promotion.IsActive}`);
      });

      return lines.join("\n");
    },

    saveReport(fileName, content) {
      app.helpers.downloadFile(fileName, content, "text/plain;charset=utf-8");
    }
  };
})(window.RetailOps = window.RetailOps || {});
