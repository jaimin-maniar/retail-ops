(function (app) {
  const validation = app.validation;

  function isActiveOn(promotion, effectiveDate) {
    return Boolean(promotion.IsActive) && app.helpers.isBetweenDateInclusive(effectiveDate, promotion.StartDate, promotion.EndDate);
  }

  function isApplicable(promotion, product, quantity) {
    if (Number(quantity) < Math.max(1, Number(promotion.MinimumQuantity || 1))) {
      return false;
    }

    const hasScope = Boolean(promotion.ProductId || promotion.SKU || promotion.Category);
    if (!hasScope) {
      return true;
    }

    return String(promotion.ProductId || "").toLowerCase() === String(product.ProductId || "").toLowerCase() ||
      String(promotion.SKU || "").toLowerCase() === String(product.SKU || "").toLowerCase() ||
      String(promotion.Category || "").toLowerCase() === String(product.Category || "").toLowerCase();
  }

  function calculateDiscount(promotion, unitPrice, quantity, lineSubtotal) {
    let discount = 0;
    if (promotion.Type === "Percentage") {
      discount = lineSubtotal * Math.min(Number(promotion.DiscountValue), 100) / 100;
    } else if (promotion.Type === "FlatDiscount") {
      discount = Number(promotion.DiscountValue);
    } else if (promotion.Type === "BuyOneGetOne") {
      discount = Number(unitPrice) * Math.floor(Number(quantity) / 2);
    } else if (promotion.Type === "ComboOffer") {
      discount = Number(quantity) >= Number(promotion.MinimumQuantity || 1)
        ? lineSubtotal * Math.min(Number(promotion.DiscountValue), 100) / 100
        : 0;
    }

    return app.helpers.roundMoney(Math.min(discount, lineSubtotal));
  }

  function cleanPromotion(promotion) {
    return {
      ...promotion,
      Name: String(promotion.Name || "").trim(),
      SKU: promotion.SKU ? validation.normalizeSku(promotion.SKU) : null,
      ProductId: promotion.ProductId ? String(promotion.ProductId).trim() : null,
      Category: promotion.Category ? String(promotion.Category).trim() : null,
      DiscountValue: promotion.Type === "BuyOneGetOne" ? 0 : Number(promotion.DiscountValue),
      MinimumQuantity: Math.max(1, Number(promotion.MinimumQuantity || 1))
    };
  }

  app.promotionService = {
    calculateDiscount,
    isApplicable,
    isActiveOn,

    addPromotion(promotion) {
      validation.assertPromotion(promotion);
      const promotions = app.store.get("promotions");
      const created = cleanPromotion({
        ...promotion,
        PromotionId: app.helpers.nextId(promotions, "PromotionId", "PROMO", 3),
        IsActive: true
      });
      app.store.set("promotions", [...promotions, created]);
      app.auditService.log(app.store.getUser(), "AddPromotion", "Promotion", created.PromotionId, `Added promotion ${created.Name}.`);
      return created;
    },

    updatePromotion(promotion) {
      validation.assertPromotion(promotion);
      const promotions = app.store.get("promotions");
      const existing = promotions.find((item) => item.PromotionId === promotion.PromotionId);
      if (!existing) {
        throw new Error("Promotion not found.");
      }

      app.store.set("promotions", promotions.map((item) => item.PromotionId === promotion.PromotionId ? cleanPromotion(promotion) : item));
      app.auditService.log(app.store.getUser(), "UpdatePromotion", "Promotion", promotion.PromotionId, `Updated promotion ${promotion.Name}.`);
    },

    deactivatePromotion(promotionId) {
      let found = false;
      const promotions = app.store.get("promotions").map((promotion) => {
        if (promotion.PromotionId === promotionId) {
          found = true;
          return { ...promotion, IsActive: false };
        }
        return promotion;
      });
      if (found) {
        app.store.set("promotions", promotions);
        app.auditService.log(app.store.getUser(), "DeactivatePromotion", "Promotion", promotionId, "Promotion deactivated.");
      }
      return found;
    },

    getPromotions() {
      return app.store.get("promotions")
        .sort((a, b) => Number(b.IsActive) - Number(a.IsActive) || new Date(a.EndDate) - new Date(b.EndDate));
    },

    getActivePromotions(asOf) {
      const effectiveDate = app.helpers.toDateOnly(asOf || new Date());
      return app.store.get("promotions")
        .filter((promotion) => isActiveOn(promotion, effectiveDate))
        .sort((a, b) => new Date(a.EndDate) - new Date(b.EndDate));
    },

    getBestDiscount(product, quantity) {
      const lineSubtotal = Number(product.Price) * Number(quantity);
      const best = this.getActivePromotions()
        .filter((promotion) => isApplicable(promotion, product, quantity))
        .map((promotion) => ({
          Promotion: promotion,
          Discount: calculateDiscount(promotion, product.Price, quantity, lineSubtotal)
        }))
        .sort((a, b) => b.Discount - a.Discount)[0];

      return best || { Promotion: null, Discount: 0 };
    }
  };
})(window.RetailOps = window.RetailOps || {});
