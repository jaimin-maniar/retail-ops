(function (app) {
  app.shared = {
    metric(label, value, note, trend) {
      return `
        <article class="metric-card">
          <div class="metric-label">
            <span>${app.helpers.escapeHtml(label)}</span>
            ${trend ? `<span class="metric-trend">${app.helpers.escapeHtml(trend)}</span>` : ""}
          </div>
          <div class="metric-value">${value}</div>
          <div class="metric-note">${app.helpers.escapeHtml(note || "")}</div>
        </article>
      `;
    },

    stockBadge(stock, threshold) {
      const tone = app.helpers.getStockTone(stock, threshold);
      const label = tone === "red" ? "Out" : tone === "amber" ? "Low" : "Healthy";
      return `
        <span class="stock-pill">
          <span class="stock-dot ${tone === "red" ? "out" : tone === "amber" ? "low" : ""}"></span>
          ${app.helpers.renderBadge(label, tone)}
        </span>
      `;
    },

    productOptions() {
      return app.productService.getProducts().map((product) => ({
        value: product.ProductId,
        label: `${product.SKU} - ${product.Name}`
      }));
    },

    supplierOptions() {
      return [{ value: "", label: "Unassigned" }].concat(app.store.get("suppliers").map((supplier) => ({
        value: supplier.SupplierId,
        label: supplier.Name
      })));
    },

    warehouseOptions() {
      return app.store.get("warehouses").map((warehouse) => ({
        value: warehouse.WarehouseId,
        label: `${warehouse.WarehouseId} - ${warehouse.Name}`
      }));
    },

    categoryOptions() {
      return [{ value: "", label: "No category scope" }].concat(
        app.helpers.unique(app.store.get("products").map((product) => product.Category))
          .sort()
          .map((category) => ({ value: category, label: category }))
      );
    },

    openFormModal(title, fields, values, submitLabel, onSubmit, size) {
      const modal = app.modal.open({
        title,
        size,
        content: document.createElement("div"),
        actions: []
      });
      const form = app.form.create(fields, values || {}, (payload) => {
        onSubmit(payload);
        modal.close();
      }, {
        submitLabel,
        onCancel: modal.close
      });
      modal.element.querySelector(".modal-body").appendChild(form);
      return modal;
    }
  };
})(window.RetailOps = window.RetailOps || {});
