(function (app) {
  const validation = app.validation;

  function ordered(products) {
    return products.sort((a, b) =>
      app.helpers.compareValues(a.Category, b.Category) ||
      app.helpers.compareValues(a.Name, b.Name)
    );
  }

  app.productService = {
    getProducts() {
      return ordered(app.store.get("products"));
    },

    getBySku(sku) {
      const normalized = validation.normalizeSku(sku);
      return app.store.get("products").find((product) => product.SKU.toUpperCase() === normalized) || null;
    },

    getById(productId) {
      return app.store.get("products").find((product) =>
        String(product.ProductId).toLowerCase() === String(productId || "").toLowerCase()
      ) || null;
    },

    addProduct(product) {
      validation.assertProduct(product);
      const products = app.store.get("products");
      const normalizedSku = validation.normalizeSku(product.SKU);
      const exists = products.some((item) => item.SKU.toUpperCase() === normalizedSku);

      if (exists) {
        throw new Error("A product with this SKU already exists.");
      }

      const created = {
        ProductId: app.helpers.nextId(products, "ProductId", "PROD", 3),
        Name: String(product.Name).trim(),
        SKU: normalizedSku,
        Category: String(product.Category || "").trim(),
        Price: Number(product.Price),
        ReorderThreshold: Number(product.ReorderThreshold),
        SupplierId: String(product.SupplierId || "").trim(),
        IsActive: true,
        CreatedAt: app.helpers.nowIso(),
        UpdatedAt: app.helpers.nowIso()
      };

      app.store.set("products", [...products, created]);
      app.auditService.log(app.store.getUser(), "AddProduct", "Product", created.ProductId, `Added product ${created.SKU}.`);
      return created;
    },

    updateProduct(product) {
      validation.assertProduct(product);
      const products = app.store.get("products");
      const existing = products.find((item) => item.ProductId === product.ProductId);

      if (!existing) {
        throw new Error("Product not found.");
      }

      const normalizedSku = validation.normalizeSku(product.SKU);
      const skuTaken = products.some((item) =>
        item.ProductId !== product.ProductId &&
        item.SKU.toUpperCase() === normalizedSku
      );

      if (skuTaken) {
        throw new Error("Another product already uses this SKU.");
      }

      const updated = products.map((item) => item.ProductId === product.ProductId
        ? {
            ...item,
            Name: String(product.Name).trim(),
            SKU: normalizedSku,
            Category: String(product.Category || "").trim(),
            Price: Number(product.Price),
            ReorderThreshold: Number(product.ReorderThreshold),
            SupplierId: String(product.SupplierId || "").trim(),
            IsActive: Boolean(product.IsActive),
            UpdatedAt: app.helpers.nowIso()
          }
        : item);

      app.store.set("products", updated);
      app.auditService.log(app.store.getUser(), "UpdateProduct", "Product", product.ProductId, `Updated product ${normalizedSku}.`);
    },

    deactivateProduct(productId) {
      let found = false;
      const products = app.store.get("products").map((product) => {
        if (product.ProductId === productId) {
          found = true;
          return { ...product, IsActive: false, UpdatedAt: app.helpers.nowIso() };
        }
        return product;
      });

      if (found) {
        app.store.set("products", products);
        app.auditService.log(app.store.getUser(), "DeactivateProduct", "Product", productId, "Product deactivated.");
      }

      return found;
    }
  };
})(window.RetailOps = window.RetailOps || {});
