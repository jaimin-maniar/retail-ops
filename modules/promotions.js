(function (app) {
  function promotionFields(includeActive) {
    const fields = [
      { name: "Name", label: "Promotion name", required: true },
      { name: "Type", label: "Promotion type", type: "select", options: app.config.promotionTypes },
      { name: "DiscountValue", label: "Discount value", type: "number", min: 0, step: 0.01, required: true },
      { name: "StartDate", label: "Start date", type: "date", required: true },
      { name: "EndDate", label: "End date", type: "date", required: true },
      { name: "MinimumQuantity", label: "Minimum quantity", type: "number", min: 1, step: 1, required: true },
      {
        name: "ScopeType",
        label: "Scope",
        type: "select",
        options: [
          { value: "All", label: "All products" },
          { value: "SKU", label: "SKU" },
          { value: "Category", label: "Category" },
          { value: "ProductId", label: "Product ID" }
        ]
      },
      { name: "ScopeValue", label: "Scope value", help: "Leave blank when scope is all products." }
    ];
    if (includeActive) {
      fields.push({ name: "IsActive", label: "Promotion is active", type: "checkbox", defaultValue: true });
    }
    return fields;
  }

  function inflatePromotion(promotion) {
    if (!promotion) {
      return {
        Type: "Percentage",
        DiscountValue: 10,
        StartDate: app.format.isoDateInput(new Date()),
        EndDate: app.format.isoDateInput(app.helpers.addDays(new Date(), 14)),
        MinimumQuantity: 1,
        ScopeType: "All",
        ScopeValue: "",
        IsActive: true
      };
    }

    let scopeType = "All";
    let scopeValue = "";
    if (promotion.SKU) {
      scopeType = "SKU";
      scopeValue = promotion.SKU;
    } else if (promotion.Category) {
      scopeType = "Category";
      scopeValue = promotion.Category;
    } else if (promotion.ProductId) {
      scopeType = "ProductId";
      scopeValue = promotion.ProductId;
    }

    return {
      ...promotion,
      StartDate: app.format.isoDateInput(promotion.StartDate),
      EndDate: app.format.isoDateInput(promotion.EndDate),
      ScopeType: scopeType,
      ScopeValue: scopeValue
    };
  }

  function deflatePromotion(payload, existing) {
    const promotion = {
      ...(existing || {}),
      Name: payload.Name,
      Type: payload.Type,
      DiscountValue: Number(payload.DiscountValue),
      StartDate: payload.StartDate,
      EndDate: payload.EndDate,
      MinimumQuantity: Number(payload.MinimumQuantity),
      IsActive: Boolean(payload.IsActive ?? true),
      ProductId: null,
      SKU: null,
      Category: null
    };

    if (payload.ScopeType === "SKU" && payload.ScopeValue) {
      promotion.SKU = payload.ScopeValue;
    } else if (payload.ScopeType === "Category" && payload.ScopeValue) {
      promotion.Category = payload.ScopeValue;
    } else if (payload.ScopeType === "ProductId" && payload.ScopeValue) {
      promotion.ProductId = payload.ScopeValue;
    }
    return promotion;
  }

  function openPromotionModal(promotion, rerender) {
    const isEdit = Boolean(promotion);
    app.shared.openFormModal(
      isEdit ? "Update promotion" : "Add promotion",
      promotionFields(isEdit),
      inflatePromotion(promotion),
      isEdit ? "Update promotion" : "Add promotion",
      (payload) => {
        if (isEdit) {
          app.promotionService.updatePromotion(deflatePromotion(payload, promotion));
          app.toast.success("Promotion updated successfully.");
        } else {
          app.promotionService.addPromotion(deflatePromotion(payload));
          app.toast.success("Promotion added successfully.");
        }
        rerender();
      },
      "large"
    );
  }

  function scopeLabel(promotion) {
    return promotion.SKU || promotion.ProductId || promotion.Category || "All products";
  }

  app.pages = app.pages || {};
  app.pages.promotions = {
    render(root) {
      const promotions = app.promotionService.getPromotions();
      const active = app.promotionService.getActivePromotions();
      const expiring = active.filter((promotion) => app.helpers.toDateOnly(promotion.EndDate) <= app.helpers.addDays(app.helpers.todayDateOnly(), 7)).length;

      root.innerHTML = `
        <div class="page-stack">
          <section class="grid grid-4">
            ${app.shared.metric("Promotions", app.format.number(promotions.length), "All configured offers", `${active.length} active`)}
            ${app.shared.metric("Expiring soon", app.format.number(expiring), "Active offers ending in 7 days", "Watch")}
            ${app.shared.metric("Avg discount", app.format.percent(app.helpers.avg(promotions.filter((p) => p.Type !== "BuyOneGetOne"), (p) => p.DiscountValue)), "Non-BOGO configured value", "Promo")}
            ${app.shared.metric("BOGO offers", app.format.number(promotions.filter((p) => p.Type === "BuyOneGetOne").length), "Unit-price based discount branch", "Logic")}
          </section>
          <section class="grid grid-2">
            <article class="panel">
              <div class="toolbar">
                <div>
                  <h2 class="section-title">Discount Simulator</h2>
                  <p class="section-copy">Tests the same best-active-promotion calculation used by billing.</p>
                </div>
              </div>
              <form data-discount-sim class="form-grid" style="margin-top:14px">
                <label class="form-field"><span>Product</span><select class="select" name="product">${app.shared.productOptions().map((option) => `<option value="${app.helpers.escapeHtml(option.value)}">${app.helpers.escapeHtml(option.label)}</option>`).join("")}</select></label>
                <label class="form-field"><span>Quantity</span><input class="input" type="number" min="1" step="1" value="2" name="quantity"></label>
                <div class="form-actions" style="grid-column:1 / -1"><button class="btn btn-primary" type="submit">Calculate Discount</button></div>
              </form>
              <div data-sim-result class="summary-list" style="margin-top:12px"></div>
            </article>
            <article class="panel">
              <h2 class="section-title">Promotion Discount Branches</h2>
              <div class="summary-list" style="margin-top:14px">
                <div class="summary-row"><span>Percentage</span><strong>line subtotal x min(value, 100)%</strong></div>
                <div class="summary-row"><span>Flat discount</span><strong>configured value capped at line subtotal</strong></div>
                <div class="summary-row"><span>Buy one get one</span><strong>unit price x floor(quantity / 2)</strong></div>
                <div class="summary-row"><span>Combo offer</span><strong>percentage only after minimum quantity</strong></div>
              </div>
            </article>
          </section>
          <section class="section-band">
            <div class="toolbar">
              <div>
                <h2 class="section-title">Promotion Programs</h2>
                <p class="section-copy">Create, edit, deactivate, and test scoped promotions.</p>
              </div>
              <button class="btn btn-primary" type="button" data-add-promotion>Add Promotion</button>
            </div>
            <div data-promo-table></div>
          </section>
        </div>
      `;

      root.querySelector("[data-add-promotion]").addEventListener("click", () => openPromotionModal(null, () => this.render(root)));
      root.querySelector("[data-discount-sim]").addEventListener("submit", (event) => {
        event.preventDefault();
        const data = new FormData(event.target);
        const product = app.productService.getById(data.get("product"));
        const quantity = Number(data.get("quantity"));
        const result = app.promotionService.getBestDiscount(product, quantity);
        root.querySelector("[data-sim-result]").innerHTML = `
          <div class="summary-row"><span>Line subtotal</span><strong>${app.format.currency(product.Price * quantity)}</strong></div>
          <div class="summary-row"><span>Best promotion</span><strong>${app.helpers.escapeHtml(result.Promotion?.Name || "No eligible promotion")}</strong></div>
          <div class="summary-row"><span>Discount</span><strong>${app.format.currency(result.Discount)}</strong></div>
          <div class="summary-row"><span>Net line</span><strong>${app.format.currency(product.Price * quantity - result.Discount)}</strong></div>
        `;
      });

      root.querySelector("[data-promo-table]").appendChild(app.table.create({
        title: "Promotions",
        exportName: "promotions",
        data: promotions,
        searchKeys: ["PromotionId", "Name", "Type", "SKU", "Category", "ProductId"],
        columns: [
          { key: "PromotionId", label: "ID" },
          { key: "Name", label: "Name" },
          { key: "Type", label: "Type" },
          { key: "DiscountValue", label: "Value", render: (row) => row.Type === "BuyOneGetOne" ? "BOGO" : String(row.DiscountValue) },
          { key: "Scope", label: "Scope", value: scopeLabel, render: (row) => app.helpers.escapeHtml(scopeLabel(row)) },
          { key: "MinimumQuantity", label: "Min Qty" },
          { key: "EndDate", label: "End", render: (row) => app.format.date(row.EndDate) },
          { key: "IsActive", label: "Status", render: (row) => app.helpers.renderBadge(row.IsActive ? "Active" : "Inactive", row.IsActive ? "green" : "neutral") }
        ],
        actions: [
          { label: "Edit", handler: (row) => openPromotionModal(row, () => this.render(root)) },
          {
            label: "Deactivate",
            handler: async (row) => {
              const ok = await app.modal.confirm({ title: "Deactivate promotion", message: `Deactivate ${row.Name}?`, danger: true });
              if (ok && app.promotionService.deactivatePromotion(row.PromotionId)) {
                app.toast.success("Promotion deactivated successfully.");
                this.render(root);
              }
            }
          }
        ]
      }));
    }
  };
})(window.RetailOps = window.RetailOps || {});
