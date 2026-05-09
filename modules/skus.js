(function (app) {
  function skuFields() {
    return [
      { name: "ProductId", label: "Product", type: "select", options: app.shared.productOptions(), required: true },
      { name: "SKU", label: "SKU", required: true },
      { name: "Barcode", label: "Barcode" },
      { name: "Uom", label: "Unit of measure", required: true },
      { name: "PackSize", label: "Pack size", required: true },
      { name: "CasePack", label: "Case pack", type: "number", min: 1, step: 1, required: true },
      { name: "ShelfLifeDays", label: "Shelf life days", type: "number", min: 0, step: 1, required: true },
      {
        name: "Channel",
        label: "Channel",
        type: "select",
        options: [
          { value: "Ambient", label: "Ambient" },
          { value: "Chilled", label: "Chilled" },
          { value: "Frozen", label: "Frozen" },
          { value: "Controlled", label: "Controlled" }
        ]
      },
      { name: "IsActive", label: "SKU is active", type: "checkbox", defaultValue: true }
    ];
  }

  function openSkuModal(sku, rerender) {
    const isEdit = Boolean(sku);
    app.shared.openFormModal(
      isEdit ? "Update SKU" : "Add SKU",
      skuFields(),
      sku || { ProductId: app.store.get("products")[0]?.ProductId, CasePack: 1, ShelfLifeDays: 0, Channel: "Ambient", IsActive: true },
      isEdit ? "Update SKU" : "Add SKU",
      (payload) => {
        if (isEdit) {
          app.skuService.updateSku({ ...sku, ...payload });
          app.toast.success("SKU updated successfully.");
        } else {
          app.skuService.addSku(payload);
          app.toast.success("SKU added successfully.");
        }
        rerender();
      },
      "large"
    );
  }

  app.pages = app.pages || {};
  app.pages.skus = {
    render(root) {
      const skus = app.skuService.getSkus();
      const chilled = skus.filter((sku) => sku.Channel === "Chilled").length;

      root.innerHTML = `
        <div class="page-stack">
          <section class="grid grid-4">
            ${app.shared.metric("SKU records", app.format.number(skus.length), "Sellable unit definitions", "Active")}
            ${app.shared.metric("Chilled SKUs", app.format.number(chilled), "Temperature-controlled assortment", "Ops")}
            ${app.shared.metric("Avg case pack", app.format.number(Math.round(app.helpers.avg(skus, (sku) => sku.CasePack))), "Units per case", "Supply")}
            ${app.shared.metric("Barcode coverage", app.format.percent((skus.filter((sku) => sku.Barcode).length / Math.max(1, skus.length)) * 100), "Traceability readiness", "QA")}
          </section>
          <section class="section-band">
            <div class="toolbar">
              <div>
                <h2 class="section-title">SKU Master</h2>
                <p class="section-copy">SKU-level packaging and channel control layered over the original product SKU field.</p>
              </div>
              <button class="btn btn-primary" type="button" data-add-sku>Add SKU</button>
            </div>
            <div data-sku-table></div>
          </section>
        </div>
      `;

      root.querySelector("[data-add-sku]").addEventListener("click", () => openSkuModal(null, () => this.render(root)));
      root.querySelector("[data-sku-table]").appendChild(app.table.create({
        title: "SKUs",
        exportName: "skus",
        data: skus,
        searchKeys: ["SKU", "ProductName", "Barcode", "Channel"],
        columns: [
          { key: "SkuId", label: "ID" },
          { key: "SKU", label: "SKU" },
          { key: "ProductName", label: "Product" },
          { key: "Barcode", label: "Barcode" },
          { key: "Uom", label: "UOM" },
          { key: "PackSize", label: "Pack" },
          { key: "CasePack", label: "Case" },
          { key: "ShelfLifeDays", label: "Shelf life" },
          { key: "Channel", label: "Channel", render: (row) => app.helpers.renderBadge(row.Channel, row.Channel === "Chilled" ? "blue" : "neutral") },
          { key: "IsActive", label: "Status", render: (row) => app.helpers.renderBadge(row.IsActive ? "Active" : "Inactive", row.IsActive ? "green" : "neutral") }
        ],
        actions: [
          { label: "Edit", handler: (row) => openSkuModal(row, () => this.render(root)) }
        ]
      }));
    }
  };
})(window.RetailOps = window.RetailOps || {});
