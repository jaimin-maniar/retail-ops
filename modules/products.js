(function (app) {
  function productFields(includeActive) {
    const fields = [
      { name: "SKU", label: "SKU", required: true, placeholder: "SKU-CODE" },
      { name: "Name", label: "Product name", required: true },
      { name: "Category", label: "Category", required: true },
      { name: "Price", label: "Price", type: "number", min: 0.01, step: 0.01, required: true },
      { name: "ReorderThreshold", label: "Reorder threshold", type: "number", min: 0, step: 1, required: true },
      { name: "SupplierId", label: "Supplier", type: "select", options: app.shared.supplierOptions() }
    ];
    if (includeActive) {
      fields.push({ name: "IsActive", label: "Product is active", type: "checkbox", defaultValue: true });
    }
    return fields;
  }

  function openProductModal(product, rerender) {
    const isEdit = Boolean(product);
    app.shared.openFormModal(
      isEdit ? "Update product" : "Add product",
      productFields(isEdit),
      product || { ReorderThreshold: 0, Price: 1, SupplierId: "" },
      isEdit ? "Update product" : "Add product",
      (payload) => {
        if (isEdit) {
          app.productService.updateProduct({ ...product, ...payload });
          app.toast.success("Product updated successfully.");
        } else {
          app.productService.addProduct(payload);
          app.toast.success("Product added successfully.");
        }
        rerender();
      }
    );
  }

  app.pages = app.pages || {};
  app.pages.products = {
    render(root) {
      const products = app.productService.getProducts();
      const suppliers = app.store.get("suppliers");
      const active = products.filter((product) => product.IsActive).length;
      const avgPrice = app.helpers.avg(products, (product) => product.Price);

      root.innerHTML = `
        <div class="page-stack">
          <section class="grid grid-4">
            ${app.shared.metric("Products", app.format.number(products.length), "Total catalog records", `${active} active`)}
            ${app.shared.metric("Average price", app.format.currency(avgPrice), "Across sellable products", "Catalog")}
            ${app.shared.metric("Categories", app.format.number(app.helpers.unique(products.map((p) => p.Category)).length), "Merchandise groups", "Master")}
            ${app.shared.metric("Suppliers", app.format.number(suppliers.filter((s) => s.IsActive).length), "Active vendor partners", "Sourcing")}
          </section>
          <section class="section-band">
            <div class="toolbar">
              <div>
                <h2 class="section-title">Product Catalog</h2>
                <p class="section-copy">Console product workflows converted into searchable, sortable catalog maintenance.</p>
              </div>
              <button class="btn btn-primary" type="button" data-add-product>Add Product</button>
            </div>
            <div data-products-table></div>
          </section>
        </div>
      `;

      root.querySelector("[data-add-product]").addEventListener("click", () => openProductModal(null, () => this.render(root)));

      root.querySelector("[data-products-table]").appendChild(app.table.create({
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
          { key: "Price", label: "Price", render: (row) => app.format.currency(row.Price) },
          { key: "ReorderThreshold", label: "Threshold" },
          { key: "IsActive", label: "Status", render: (row) => app.helpers.renderBadge(row.IsActive ? "Active" : "Inactive", row.IsActive ? "green" : "neutral") }
        ],
        actions: [
          { label: "Edit", handler: (row) => openProductModal(row, () => this.render(root)) },
          {
            label: "Deactivate",
            handler: async (row) => {
              const ok = await app.modal.confirm({ title: "Deactivate product", message: `Deactivate ${row.SKU}?`, danger: true });
              if (ok && app.productService.deactivateProduct(row.ProductId)) {
                app.toast.success("Product deactivated successfully.");
                this.render(root);
              }
            }
          }
        ]
      }));
    }
  };
})(window.RetailOps = window.RetailOps || {});
