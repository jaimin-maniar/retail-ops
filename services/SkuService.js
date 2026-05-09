(function (app) {
  app.skuService = {
    getSkus() {
      const products = app.store.get("products");
      return app.store.get("skus")
        .map((sku) => ({
          ...sku,
          ProductName: products.find((product) => product.ProductId === sku.ProductId)?.Name || "Unknown"
        }))
        .sort((a, b) => app.helpers.compareValues(a.SKU, b.SKU));
    },

    addSku(payload) {
      const skus = app.store.get("skus");
      const product = app.productService.getById(payload.ProductId);
      if (!product) {
        throw new Error("SKU must be linked to an existing product.");
      }

      const normalizedSku = app.validation.normalizeSku(payload.SKU || product.SKU);
      const exists = skus.some((sku) => sku.SKU.toUpperCase() === normalizedSku);
      if (exists) {
        throw new Error("A SKU record already exists for this code.");
      }

      const created = {
        SkuId: app.helpers.nextId(skus, "SkuId", "SKU", 3),
        ProductId: product.ProductId,
        SKU: normalizedSku,
        Barcode: String(payload.Barcode || "").trim(),
        Uom: String(payload.Uom || "").trim(),
        PackSize: String(payload.PackSize || "").trim(),
        CasePack: Math.max(1, Number(payload.CasePack || 1)),
        ShelfLifeDays: Math.max(0, Number(payload.ShelfLifeDays || 0)),
        Channel: String(payload.Channel || "Ambient").trim(),
        IsActive: Boolean(payload.IsActive ?? true)
      };

      app.store.set("skus", [...skus, created]);
      app.auditService.log(app.store.getUser(), "AddSku", "SKU", created.SkuId, `Added SKU ${created.SKU}.`);
      return created;
    },

    updateSku(payload) {
      const skus = app.store.get("skus");
      const existing = skus.find((sku) => sku.SkuId === payload.SkuId);
      if (!existing) {
        throw new Error("SKU record not found.");
      }

      const normalizedSku = app.validation.normalizeSku(payload.SKU);
      const skuTaken = skus.some((sku) => sku.SkuId !== payload.SkuId && sku.SKU.toUpperCase() === normalizedSku);
      if (skuTaken) {
        throw new Error("Another SKU record already uses this code.");
      }

      app.store.set("skus", skus.map((sku) => sku.SkuId === payload.SkuId
        ? {
            ...sku,
            ProductId: payload.ProductId,
            SKU: normalizedSku,
            Barcode: String(payload.Barcode || "").trim(),
            Uom: String(payload.Uom || "").trim(),
            PackSize: String(payload.PackSize || "").trim(),
            CasePack: Math.max(1, Number(payload.CasePack || 1)),
            ShelfLifeDays: Math.max(0, Number(payload.ShelfLifeDays || 0)),
            Channel: String(payload.Channel || "Ambient").trim(),
            IsActive: Boolean(payload.IsActive)
          }
        : sku));
      app.auditService.log(app.store.getUser(), "UpdateSku", "SKU", payload.SkuId, `Updated SKU ${normalizedSku}.`);
    }
  };
})(window.RetailOps = window.RetailOps || {});
