/* Product catalog logic and product page. */

// product code
{
const validation = app.check;

  function ordered(products) {
    return products.sort((a, b) =>
      app.help.compareValues(a.Category, b.Category) ||
      app.help.compareValues(a.Name, b.Name)
    );
  }

  app.products = {
    getProducts() {
      return ordered(app.data.get("products"));
    },

    getBySku(sku) {
      const normalized = validation.normalizeSku(sku);
      return app.data.get("products").find((product) => product.SKU.toUpperCase() === normalized) || null;
    },

    getById(productId) {
      return app.data.get("products").find((product) =>
        String(product.ProductId).toLowerCase() === String(productId || "").toLowerCase()
      ) || null;
    },

    addProduct(product) {
      validation.assertProduct(product);
      const products = app.data.get("products");
      const normalizedSku = validation.normalizeSku(product.SKU);
      const exists = products.some((item) => item.SKU.toUpperCase() === normalizedSku);

      if (exists) {
        throw new Error("A product with this SKU already exists.");
      }

      const created = {
        ProductId: app.help.nextId(products, "ProductId", "PROD", 3),
        Name: String(product.Name).trim(),
        SKU: normalizedSku,
        Category: String(product.Category || "").trim(),
        Price: Number(product.Price),
        ReorderThreshold: Number(product.ReorderThreshold),
        SupplierId: String(product.SupplierId || "").trim(),
        IsActive: true,
        CreatedAt: app.help.nowIso(),
        UpdatedAt: app.help.nowIso()
      };

      app.data.set("products", [...products, created]);
      app.logs.log(app.data.getUser(), "AddProduct", "Product", created.ProductId, `Added product ${created.SKU}.`);
      return created;
    },

    updateProduct(product) {
      validation.assertProduct(product);
      const products = app.data.get("products");
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
            UpdatedAt: app.help.nowIso()
          }
        : item);

      app.data.set("products", updated);
      app.logs.log(app.data.getUser(), "UpdateProduct", "Product", product.ProductId, `Updated product ${normalizedSku}.`);
    },

    setProductStatus(productId, isActive) {
      let found = false;
      const active = Boolean(isActive);
      const products = app.data.get("products").map((product) => {
        if (product.ProductId === productId) {
          found = true;
          return { ...product, IsActive: active, UpdatedAt: app.help.nowIso() };
        }
        return product;
      });

      if (found) {
        app.data.set("products", products);
        app.logs.log(
          app.data.getUser(),
          active ? "ActivateProduct" : "DeactivateProduct",
          "Product",
          productId,
          active ? "Product activated." : "Product deactivated."
        );
      }

      return found;
    },

    activateProduct(productId) {
      return this.setProductStatus(productId, true);
    },

    deactivateProduct(productId) {
      return this.setProductStatus(productId, false);
    }
  };
}


// products page
{
function productFields(includeActive) {
    const fields = [
      { name: "SKU", label: "SKU", required: true, placeholder: "SKU-CODE" },
      { name: "Name", label: "Product name", required: true },
      { name: "Category", label: "Category", required: true },
      { name: "Price", label: "Price", type: "number", min: 0.01, step: 0.01, required: true },
      { name: "ReorderThreshold", label: "Reorder threshold", type: "number", min: 0, step: 1, required: true },
      { name: "SupplierId", label: "Supplier", type: "select", options: app.parts.supplierOptions() }
    ];
    if (includeActive) {
      fields.push({ name: "IsActive", label: "Product is active", type: "checkbox", defaultValue: true });
    }
    return fields;
  }

  function openProductModal(product, rerender) {
    const isEdit = Boolean(product);
    app.parts.openFormModal(
      isEdit ? "Update product" : "Add product",
      productFields(isEdit),
      product || { ReorderThreshold: 0, Price: 1, SupplierId: "" },
      isEdit ? "Update product" : "Add product",
      (payload) => {
        if (isEdit) {
          app.products.updateProduct({ ...product, ...payload });
          app.toast.success("Product updated successfully.");
        } else {
          app.products.addProduct(payload);
          app.toast.success("Product added successfully.");
        }
        rerender();
      }
    );
  }

  app.pages = app.pages || {};
  app.pages.products = {
    render(root) {
      const products = app.products.getProducts();
      const suppliers = app.data.get("suppliers");
      const active = products.filter((product) => product.IsActive).length;
      const avgPrice = app.help.avg(products, (product) => product.Price);

      root.innerHTML = `
        <div class="page-stack">
          <section class="grid grid-4">
            ${app.parts.metric("Products", app.fmt.number(products.length), "Total catalog records", `${active} active`)}
            ${app.parts.metric("Average price", app.fmt.currency(avgPrice), "Across sellable products", "Items")}
            ${app.parts.metric("Categories", app.fmt.number(app.help.unique(products.map((p) => p.Category)).length), "Product groups", "List")}
            ${app.parts.metric("Suppliers", app.fmt.number(suppliers.filter((s) => s.IsActive).length), "Active suppliers", "Vendor")}
          </section>
          <section class="section-band">
            <div class="toolbar">
              <div>
                <h2 class="section-title">Product List</h2>
                <p class="section-copy">Search, sort, add, edit, activate, and deactivate products.</p>
              </div>
              <button class="btn btn-primary" type="button" data-add-product>Add Product</button>
            </div>
            <div data-products-table></div>
          </section>
        </div>
      `;

      root.querySelector("[data-add-product]").addEventListener("click", () => openProductModal(null, () => this.render(root)));

      root.querySelector("[data-products-table]").appendChild(app.tables.create({
        title: "Products",
        exportName: "products",
        data: products.map((product) => ({
          ...product,
          SupplierName: suppliers.find((supplier) => supplier.SupplierId === product.SupplierId)?.Name || "Unassigned"
        })),
        searchKeys: ["SKU", "Name", "Category", "SupplierName"],
        columns: [
          { key: "ProductId", label: "ID" },
          { key: "SKU", label: "SKU" },
          { key: "Name", label: "Name" },
          { key: "Category", label: "Category" },
          { key: "SupplierName", label: "Supplier" },
          { key: "Price", label: "Price", render: (row) => app.fmt.currency(row.Price) },
          { key: "ReorderThreshold", label: "Threshold" },
          { key: "IsActive", label: "Status", value: (row) => row.IsActive ? "Active" : "Inactive", render: (row) => app.help.renderBadge(row.IsActive ? "Active" : "Inactive", row.IsActive ? "green" : "neutral") }
        ],
        actions: [
          { label: "Edit", handler: (row) => openProductModal(row, () => this.render(root)) },
          {
            label: (row) => row.IsActive ? "Deactivate" : "Activate",
            handler: async (row) => {
              const nextStatus = !row.IsActive;
              const ok = nextStatus || await app.popup.confirm({ title: "Deactivate product", message: `Deactivate ${row.SKU}?`, danger: true });
              if (ok && app.products.setProductStatus(row.ProductId, nextStatus)) {
                app.toast.success(`Product ${nextStatus ? "activated" : "deactivated"} successfully.`);
                this.render(root);
              }
            }
          }
        ]
      }));
    }
  };
}


