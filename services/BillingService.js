(function (app) {
  function generateOrderId(orders) {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    const prefix = `ORD${yyyy}${mm}${dd}`;
    const lastNumber = Math.max(0, ...orders
      .filter((order) => String(order.OrderId || "").startsWith(prefix))
      .map((order) => Number.parseInt(String(order.OrderId).slice(prefix.length), 10) || 0));
    return `${prefix}${String(lastNumber + 1).padStart(4, "0")}`;
  }

  function failure(message, order) {
    return { Success: false, Message: message, Order: order || null };
  }

  function buildOrder(requestedItems, cashierUserId, cashierName, customerName) {
    const requests = requestedItems || [];
    if (requests.length === 0) {
      return failure("Cart is empty.");
    }

    const products = app.store.get("products");
    const inventoryList = app.store.get("inventory");
    const grouped = app.helpers.groupBy(
      requests.filter((item) => Number(item.Quantity) > 0),
      (item) => app.validation.normalizeSku(item.SKU)
    );

    const finalItems = [];
    for (const sku of Object.keys(grouped)) {
      const quantity = app.helpers.sum(grouped[sku], (item) => item.Quantity);
      const product = products.find((item) => item.IsActive && item.SKU.toUpperCase() === sku);

      if (!product) {
        return failure(`Product with SKU ${sku} was not found.`);
      }

      const availableStock = app.helpers.sum(
        inventoryList.filter((item) => item.SKU.toUpperCase() === sku),
        (item) => item.QuantityAvailable
      );

      if (availableStock < quantity) {
        return failure(`Insufficient stock for ${product.Name}. Available: ${availableStock}.`);
      }

      const lineSubtotal = Number(product.Price) * Number(quantity);
      const best = app.promotionService.getBestDiscount(product, quantity);
      finalItems.push({
        ProductId: product.ProductId,
        SKU: product.SKU,
        ProductName: product.Name,
        Quantity: quantity,
        UnitPrice: Number(product.Price),
        DiscountAmount: best.Discount,
        LineTotal: app.helpers.roundMoney(lineSubtotal - best.Discount),
        PromotionId: best.Promotion?.PromotionId || null,
        PromotionName: best.Promotion?.Name || null
      });
    }

    if (finalItems.length === 0) {
      return failure("Cart does not contain any billable items.");
    }

    const subtotal = app.helpers.sum(finalItems, (item) => item.UnitPrice * item.Quantity);
    const discountTotal = app.helpers.sum(finalItems, (item) => item.DiscountAmount);
    const taxableAmount = subtotal - discountTotal;
    const taxAmount = app.helpers.roundMoney(taxableAmount * app.config.taxRate);
    const totalAmount = app.helpers.roundMoney(taxableAmount + taxAmount);

    return {
      Success: true,
      Message: "Bill preview generated.",
      Order: {
        OrderId: "",
        CustomerName: String(customerName || "").trim() || "Walk-in Customer",
        CashierUserId: cashierUserId || "",
        CashierName: cashierName || "",
        Items: finalItems,
        Subtotal: app.helpers.roundMoney(subtotal),
        DiscountTotal: app.helpers.roundMoney(discountTotal),
        TaxAmount: taxAmount,
        TotalAmount: totalAmount,
        PaidAmount: 0,
        ChangeDue: 0,
        Status: "Preview"
      }
    };
  }

  app.billingService = {
    previewBill(cartItems) {
      return buildOrder(cartItems, "", "", "");
    },

    createBill(cartItems, cashierUserId, cashierName, customerName, paidAmount) {
      const result = buildOrder(cartItems, cashierUserId, cashierName, customerName);
      if (!result.Success || !result.Order) {
        return result;
      }

      if (Number(paidAmount) < Number(result.Order.TotalAmount)) {
        return failure(`Paid amount is short by ${app.format.currency(result.Order.TotalAmount - Number(paidAmount))}.`, result.Order);
      }

      const orders = app.store.get("orders");
      const inventoryList = app.store.get("inventory");
      result.Order.Items.forEach((item) => {
        app.inventoryService.deductStock(inventoryList, item.SKU, item.Quantity);
      });

      result.Order.OrderId = generateOrderId(orders);
      result.Order.PaidAmount = Number(paidAmount);
      result.Order.ChangeDue = app.helpers.roundMoney(Number(paidAmount) - Number(result.Order.TotalAmount));
      result.Order.CreatedAt = app.helpers.nowIso();
      result.Order.Status = "Completed";

      app.store.set("inventory", inventoryList);
      app.store.set("orders", [...orders, result.Order]);
      app.auditService.log(
        { UserId: cashierUserId, Username: cashierName },
        "CreateBill",
        "Order",
        result.Order.OrderId,
        `Order completed for ${result.Order.TotalAmount.toFixed(2)}.`
      );
      result.Message = "Bill created successfully.";
      return result;
    },

    getRecentOrders(count) {
      return app.store.get("orders")
        .sort((a, b) => new Date(b.CreatedAt) - new Date(a.CreatedAt))
        .slice(0, count || 20);
    }
  };
})(window.RetailOps = window.RetailOps || {});
