(function (app) {
  const validation = {
    isRequired(value) {
      return String(value ?? "").trim().length > 0;
    },

    isPositive(value) {
      return Number(value) > 0;
    },

    isNonNegative(value) {
      return Number(value) >= 0;
    },

    normalizeSku(value) {
      return String(value ?? "").trim().toUpperCase();
    },

    assertProduct(product) {
      if (!validation.isRequired(product.SKU)) {
        throw new Error("SKU is required.");
      }
      if (!validation.isRequired(product.Name)) {
        throw new Error("Product name is required.");
      }
      if (!validation.isPositive(product.Price)) {
        throw new Error("Price must be greater than zero.");
      }
      if (!validation.isNonNegative(product.ReorderThreshold)) {
        throw new Error("Reorder threshold cannot be negative.");
      }
    },

    assertInventory(inventory) {
      if (!validation.isRequired(inventory.SKU) && !validation.isRequired(inventory.ProductId)) {
        throw new Error("SKU or Product ID is required.");
      }
      if (!validation.isNonNegative(inventory.QuantityAvailable)) {
        throw new Error("Quantity cannot be negative.");
      }
      if (!validation.isNonNegative(inventory.SafetyStock)) {
        throw new Error("Safety stock cannot be negative.");
      }
    },

    assertPromotion(promotion) {
      if (!validation.isRequired(promotion.Name)) {
        throw new Error("Promotion name is required.");
      }
      if (promotion.Type !== "BuyOneGetOne" && !validation.isPositive(promotion.DiscountValue)) {
        throw new Error("Discount value must be greater than zero.");
      }
      const start = app.helpers.toDateOnly(promotion.StartDate);
      const end = app.helpers.toDateOnly(promotion.EndDate);
      if (start && end && end < start) {
        throw new Error("End date cannot be earlier than start date.");
      }
      promotion.MinimumQuantity = Math.max(1, Number(promotion.MinimumQuantity || 1));
    }
  };

  app.validation = validation;
})(window.RetailOps = window.RetailOps || {});
