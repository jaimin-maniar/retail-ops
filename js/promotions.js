/* Promotion logic and promotions page. */

// promotion code
{
const validation = app.check;

  function isActiveOn(promotion, effectiveDate) {
    return Boolean(promotion.IsActive) && app.help.isBetweenDateInclusive(effectiveDate, promotion.StartDate, promotion.EndDate);
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

    return app.help.roundMoney(Math.min(discount, lineSubtotal));
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

  app.promos = {
    calculateDiscount,
    isApplicable,
    isActiveOn,

    addPromotion(promotion) {
      validation.assertPromotion(promotion);
      const promotions = app.data.get("promotions");
      const created = cleanPromotion({
        ...promotion,
        PromotionId: app.help.nextId(promotions, "PromotionId", "PROMO", 3),
        IsActive: true
      });
      app.data.set("promotions", [...promotions, created]);
      app.logs.log(app.data.getUser(), "AddPromotion", "Promotion", created.PromotionId, `Added promotion ${created.Name}.`);
      return created;
    },

    updatePromotion(promotion) {
      validation.assertPromotion(promotion);
      const promotions = app.data.get("promotions");
      const existing = promotions.find((item) => item.PromotionId === promotion.PromotionId);
      if (!existing) {
        throw new Error("Promotion not found.");
      }

      app.data.set("promotions", promotions.map((item) => item.PromotionId === promotion.PromotionId ? cleanPromotion(promotion) : item));
      app.logs.log(app.data.getUser(), "UpdatePromotion", "Promotion", promotion.PromotionId, `Updated promotion ${promotion.Name}.`);
    },

    setPromotionStatus(promotionId, isActive) {
      let found = false;
      const promotions = app.data.get("promotions").map((promotion) => {
        if (promotion.PromotionId === promotionId) {
          found = true;
          return { ...promotion, IsActive: Boolean(isActive) };
        }
        return promotion;
      });
      if (found) {
        app.data.set("promotions", promotions);
        app.logs.log(
          app.data.getUser(),
          Boolean(isActive) ? "ActivatePromotion" : "DeactivatePromotion",
          "Promotion",
          promotionId,
          Boolean(isActive) ? "Promotion activated." : "Promotion deactivated."
        );
      }
      return found;
    },

    activatePromotion(promotionId) {
      return this.setPromotionStatus(promotionId, true);
    },

    deactivatePromotion(promotionId) {
      return this.setPromotionStatus(promotionId, false);
    },

    getPromotions() {
      return app.data.get("promotions")
        .sort((a, b) => Number(b.IsActive) - Number(a.IsActive) || new Date(a.EndDate) - new Date(b.EndDate));
    },

    getActivePromotions(asOf) {
      const effectiveDate = app.help.toDateOnly(asOf || new Date());
      return app.data.get("promotions")
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
}


// promotions page
{
function promotionFields(includeActive) {
    const fields = [
      { name: "Name", label: "Promotion name", required: true },
      { name: "Type", label: "Promotion type", type: "select", options: app.setup.promotionTypes },
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
        StartDate: app.fmt.isoDateInput(new Date()),
        EndDate: app.fmt.isoDateInput(app.help.addDays(new Date(), 14)),
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
      StartDate: app.fmt.isoDateInput(promotion.StartDate),
      EndDate: app.fmt.isoDateInput(promotion.EndDate),
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
    app.parts.openFormModal(
      isEdit ? "Update promotion" : "Add promotion",
      promotionFields(isEdit),
      inflatePromotion(promotion),
      isEdit ? "Update promotion" : "Add promotion",
      (payload) => {
        if (isEdit) {
          app.promos.updatePromotion(deflatePromotion(payload, promotion));
          app.toast.success("Promotion updated successfully.");
        } else {
          app.promos.addPromotion(deflatePromotion(payload));
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
      const promotions = app.promos.getPromotions();
      const active = app.promos.getActivePromotions();
      const expiring = active.filter((promotion) => app.help.toDateOnly(promotion.EndDate) <= app.help.addDays(app.help.todayDateOnly(), 7)).length;

      root.innerHTML = `
        <div class="page-stack">
          <section class="grid grid-4">
            ${app.parts.metric("Promotions", app.fmt.number(promotions.length), "All configured offers", `${active.length} active`)}
            ${app.parts.metric("Expiring soon", app.fmt.number(expiring), "Active offers ending in 7 days", "Watch")}
            ${app.parts.metric("Avg discount", app.fmt.percent(app.help.avg(promotions.filter((p) => p.Type !== "BuyOneGetOne"), (p) => p.DiscountValue)), "Non-BOGO configured value", "Promo")}
            ${app.parts.metric("BOGO offers", app.fmt.number(promotions.filter((p) => p.Type === "BuyOneGetOne").length), "Free-unit promotion logic", "Logic")}
          </section>
          <section class="section-band">
            <article class="panel">
              <div class="toolbar">
                <div>
                  <h2 class="section-title">Discount Simulator</h2>
                  <p class="section-copy">Tests the same best-active-promotion calculation used by billing.</p>
                </div>
              </div>
              <form data-discount-sim class="form-grid" style="margin-top:14px">
                <label class="form-field"><span>Product</span><select class="select" name="product">${app.parts.productOptions().map((option) => `<option value="${app.help.escapeHtml(option.value)}">${app.help.escapeHtml(option.label)}</option>`).join("")}</select></label>
                <label class="form-field"><span>Quantity</span><input class="input" type="number" min="1" step="1" value="2" name="quantity"></label>
                <div class="form-actions" style="grid-column:1 / -1"><button class="btn btn-primary" type="submit">Calculate Discount</button></div>
              </form>
              <div data-sim-result class="summary-list" style="margin-top:12px"></div>
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
        const product = app.products.getById(data.get("product"));
        const quantity = Number(data.get("quantity"));
        const result = app.promos.getBestDiscount(product, quantity);
        root.querySelector("[data-sim-result]").innerHTML = `
          <div class="summary-row"><span>Line subtotal</span><strong>${app.fmt.currency(product.Price * quantity)}</strong></div>
          <div class="summary-row"><span>Best promotion</span><strong>${app.help.escapeHtml(result.Promotion?.Name || "No eligible promotion")}</strong></div>
          <div class="summary-row"><span>Discount</span><strong>${app.fmt.currency(result.Discount)}</strong></div>
          <div class="summary-row"><span>Net line</span><strong>${app.fmt.currency(product.Price * quantity - result.Discount)}</strong></div>
        `;
      });

      root.querySelector("[data-promo-table]").appendChild(app.tables.create({
        title: "Promotions",
        exportName: "promotions",
        data: promotions,
        searchKeys: ["PromotionId", "Name", "Type", "SKU", "Category", "ProductId"],
        columns: [
          { key: "PromotionId", label: "ID" },
          { key: "Name", label: "Name" },
          { key: "Type", label: "Type" },
          { key: "DiscountValue", label: "Value", render: (row) => row.Type === "BuyOneGetOne" ? "BOGO" : String(row.DiscountValue) },
          { key: "Scope", label: "Scope", value: scopeLabel, render: (row) => app.help.escapeHtml(scopeLabel(row)) },
          { key: "MinimumQuantity", label: "Min Qty" },
          { key: "EndDate", label: "End", render: (row) => app.fmt.date(row.EndDate) },
          { key: "IsActive", label: "Status", value: (row) => row.IsActive ? "Active" : "Inactive", render: (row) => app.help.renderBadge(row.IsActive ? "Active" : "Inactive", row.IsActive ? "green" : "neutral") }
        ],
        actions: [
          { label: "Edit", handler: (row) => openPromotionModal(row, () => this.render(root)) },
          {
            label: (row) => row.IsActive ? "Deactivate" : "Activate",
            handler: async (row) => {
              const nextStatus = !row.IsActive;
              const ok = nextStatus || await app.popup.confirm({ title: "Deactivate promotion", message: `Deactivate ${row.Name}?`, danger: true });
              if (ok && app.promos.setPromotionStatus(row.PromotionId, nextStatus)) {
                app.toast.success(`Promotion ${nextStatus ? "activated" : "deactivated"} successfully.`);
                this.render(root);
              }
            }
          }
        ]
      }));
    }
  };
}


