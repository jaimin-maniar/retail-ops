/* SKU master logic and SKU page. */

// sku code
{
app.skus = {
    getSkus() {
      const products = app.data.get("products");
      return app.data.get("skus")
        .map((sku) => ({
          ...sku,
          ProductName: products.find((product) => product.ProductId === sku.ProductId)?.Name || "Unknown"
        }))
        .sort((a, b) => app.help.compareValues(a.SKU, b.SKU));
    },

    addSku(payload) {
      const skus = app.data.get("skus");
      const product = app.products.getById(payload.ProductId);
      if (!product) {
        throw new Error("SKU must be linked to an existing product.");
      }

      const normalizedSku = app.check.normalizeSku(payload.SKU || product.SKU);
      const exists = skus.some((sku) => sku.SKU.toUpperCase() === normalizedSku);
      if (exists) {
        throw new Error("A SKU record already exists for this code.");
      }

      const created = {
        SkuId: app.help.nextId(skus, "SkuId", "SKU", 3),
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

      app.data.set("skus", [...skus, created]);
      app.logs.log(app.data.getUser(), "AddSku", "SKU", created.SkuId, `Added SKU ${created.SKU}.`);
      return created;
    },

    updateSku(payload) {
      const skus = app.data.get("skus");
      const existing = skus.find((sku) => sku.SkuId === payload.SkuId);
      if (!existing) {
        throw new Error("SKU record not found.");
      }

      const normalizedSku = app.check.normalizeSku(payload.SKU);
      const skuTaken = skus.some((sku) => sku.SkuId !== payload.SkuId && sku.SKU.toUpperCase() === normalizedSku);
      if (skuTaken) {
        throw new Error("Another SKU record already uses this code.");
      }

      app.data.set("skus", skus.map((sku) => sku.SkuId === payload.SkuId
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
      app.logs.log(app.data.getUser(), "UpdateSku", "SKU", payload.SkuId, `Updated SKU ${normalizedSku}.`);
    }
  };
}


// skus page
{
function skuFields() {
    return [
      { name: "ProductId", label: "Product", type: "select", options: app.parts.productOptions(), required: true },
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
    app.parts.openFormModal(
      isEdit ? "Update SKU" : "Add SKU",
      skuFields(),
      sku || { ProductId: app.data.get("products")[0]?.ProductId, CasePack: 1, ShelfLifeDays: 0, Channel: "Ambient", IsActive: true },
      isEdit ? "Update SKU" : "Add SKU",
      (payload) => {
        if (isEdit) {
          app.skus.updateSku({ ...sku, ...payload });
          app.toast.success("SKU updated successfully.");
        } else {
          app.skus.addSku(payload);
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
      const skus = app.skus.getSkus();
      const chilled = skus.filter((sku) => sku.Channel === "Chilled").length;

      root.innerHTML = `
        <div class="page-stack">
          <section class="grid grid-4">
            ${app.parts.metric("SKU records", app.fmt.number(skus.length), "Sellable unit definitions", "Active")}
            ${app.parts.metric("Chilled SKUs", app.fmt.number(chilled), "Temperature-controlled assortment", "Ops")}
            ${app.parts.metric("Avg case pack", app.fmt.number(Math.round(app.help.avg(skus, (sku) => sku.CasePack))), "Units per case", "Supply")}
            ${app.parts.metric("Barcode coverage", app.fmt.percent((skus.filter((sku) => sku.Barcode).length / Math.max(1, skus.length)) * 100), "Traceability readiness", "QA")}
          </section>
          <section class="section-band">
            <div class="toolbar">
              <div>
                <h2 class="section-title">SKU List</h2>
                <p class="section-copy">SKU-level packaging and channel control layered over the original product SKU field.</p>
              </div>
              <button class="btn btn-primary" type="button" data-add-sku>Add SKU</button>
            </div>
            <div data-sku-table></div>
          </section>
        </div>
      `;

      root.querySelector("[data-add-sku]").addEventListener("click", () => openSkuModal(null, () => this.render(root)));
      root.querySelector("[data-sku-table]").appendChild(app.tables.create({
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
          { key: "Channel", label: "Channel", render: (row) => app.help.renderBadge(row.Channel, row.Channel === "Chilled" ? "blue" : "neutral") },
          { key: "IsActive", label: "Status", value: (row) => row.IsActive ? "Active" : "Inactive", render: (row) => app.help.renderBadge(row.IsActive ? "Active" : "Inactive", row.IsActive ? "green" : "neutral") }
        ],
        actions: [
          { label: "Edit", handler: (row) => openSkuModal(row, () => this.render(root)) }
        ]
      }));
    }
  };
}


