(function (app) {
  app.pages = app.pages || {};
  app.pages.billing = {
    render(root) {
      let cart = [];
      const recentOrders = app.billingService.getRecentOrders(8);

      root.innerHTML = `
        <div class="page-stack">
          <section class="grid grid-4">
            ${app.shared.metric("Recent orders", app.format.number(recentOrders.length), "Latest completed transactions", "POS")}
            ${app.shared.metric("Tax rate", app.format.percent(app.config.taxRate * 100), "Applied after discounts", "C# parity")}
            ${app.shared.metric("Active promos", app.format.number(app.promotionService.getActivePromotions().length), "Eligible discount programs", "Best")}
            ${app.shared.metric("Stocked SKUs", app.format.number(app.helpers.unique(app.store.get("inventory").map((i) => i.SKU)).length), "Available in inventory", "Stock")}
          </section>
          <section class="grid grid-2">
            <article class="panel">
              <h2 class="section-title">Create Bill</h2>
              <p class="section-copy">Builds the same grouped cart, stock validation, best-promotion discount, tax, and change-due workflow as the console billing screen.</p>
              <form data-add-cart class="form-grid" style="margin-top:16px">
                <label class="form-field"><span>Product</span><select class="select" name="sku">${app.productService.getProducts().filter((p) => p.IsActive).map((product) => `<option value="${app.helpers.escapeHtml(product.SKU)}">${app.helpers.escapeHtml(product.SKU)} - ${app.helpers.escapeHtml(product.Name)}</option>`).join("")}</select></label>
                <label class="form-field"><span>Quantity</span><input class="input" name="quantity" type="number" min="1" step="1" value="1"></label>
                <div class="form-actions" style="grid-column:1 / -1"><button class="btn btn-primary" type="submit">Add to Cart</button></div>
              </form>
              <div data-cart-table style="margin-top:16px"></div>
            </article>
            <article class="panel">
              <h2 class="section-title">Bill Preview</h2>
              <div data-bill-preview class="summary-list" style="margin-top:14px"></div>
              <form data-complete-bill class="form-grid" style="margin-top:16px">
                <label class="form-field"><span>Customer name</span><input class="input" name="customerName" placeholder="Walk-in Customer"></label>
                <label class="form-field"><span>Paid amount</span><input class="input" name="paidAmount" type="number" min="0" step="0.01"></label>
                <div class="form-actions" style="grid-column:1 / -1">
                  <button class="btn btn-secondary" type="button" data-clear-cart>Clear</button>
                  <button class="btn btn-primary" type="submit">Complete Bill</button>
                </div>
              </form>
            </article>
          </section>
          <div data-recent-orders></div>
        </div>
      `;

      const cartTarget = root.querySelector("[data-cart-table]");
      const previewTarget = root.querySelector("[data-bill-preview]");
      const paidInput = root.querySelector("[name=paidAmount]");

      function renderCart() {
        const preview = app.billingService.previewBill(cart);
        const items = preview.Order?.Items || [];

        cartTarget.innerHTML = items.length
          ? `
            <div class="table-wrap">
              <table class="data-table" style="min-width:520px">
                <thead><tr><th>SKU</th><th>Item</th><th>Qty</th><th>Discount</th><th>Line</th><th></th></tr></thead>
                <tbody>
                  ${items.map((item) => `
                    <tr>
                      <td>${app.helpers.escapeHtml(item.SKU)}</td>
                      <td>${app.helpers.escapeHtml(item.ProductName)}</td>
                      <td>${app.format.number(item.Quantity)}</td>
                      <td>${app.format.currency(item.DiscountAmount)}</td>
                      <td>${app.format.currency(item.LineTotal)}</td>
                      <td><button class="btn btn-secondary" type="button" data-remove-cart="${app.helpers.escapeHtml(item.SKU)}">Remove</button></td>
                    </tr>
                  `).join("")}
                </tbody>
              </table>
            </div>
          `
          : `<div class="empty-state"><div><strong>Cart is empty</strong><span>Add SKU quantities to preview discounts and tax.</span></div></div>`;

        if (!preview.Success) {
          previewTarget.innerHTML = `<div class="alert-item"><div><strong>Preview unavailable</strong><span class="section-copy">${app.helpers.escapeHtml(preview.Message)}</span></div>${app.helpers.renderBadge("Blocked", "red")}</div>`;
        } else {
          previewTarget.innerHTML = `
            <div class="summary-row"><span>Subtotal</span><strong>${app.format.currency(preview.Order.Subtotal)}</strong></div>
            <div class="summary-row"><span>Discount</span><strong>${app.format.currency(preview.Order.DiscountTotal)}</strong></div>
            <div class="summary-row"><span>Tax</span><strong>${app.format.currency(preview.Order.TaxAmount)}</strong></div>
            <div class="summary-row"><span>Total</span><strong>${app.format.currency(preview.Order.TotalAmount)}</strong></div>
          `;
          if (!paidInput.value) {
            paidInput.value = preview.Order.TotalAmount;
          }
        }

        root.querySelectorAll("[data-remove-cart]").forEach((button) => {
          button.addEventListener("click", () => {
            cart = cart.filter((item) => app.validation.normalizeSku(item.SKU) !== app.validation.normalizeSku(button.dataset.removeCart));
            renderCart();
          });
        });
      }

      root.querySelector("[data-add-cart]").addEventListener("submit", (event) => {
        event.preventDefault();
        const data = new FormData(event.target);
        cart.push({ SKU: data.get("sku"), Quantity: Number(data.get("quantity")) });
        event.target.quantity.value = 1;
        paidInput.value = "";
        renderCart();
      });

      root.querySelector("[data-clear-cart]").addEventListener("click", () => {
        cart = [];
        paidInput.value = "";
        renderCart();
      });

      root.querySelector("[data-complete-bill]").addEventListener("submit", (event) => {
        event.preventDefault();
        const user = app.store.getUser();
        const data = new FormData(event.target);
        const result = app.billingService.createBill(
          cart,
          user.UserId,
          user.Username,
          data.get("customerName"),
          Number(data.get("paidAmount"))
        );

        if (!result.Success) {
          app.toast.error(result.Message);
          return;
        }

        app.toast.success(`${result.Message} Change due: ${app.format.currency(result.Order.ChangeDue)}.`);
        cart = [];
        this.render(root);
      });

      root.querySelector("[data-recent-orders]").appendChild(app.table.create({
        title: "Recent Orders",
        exportName: "orders",
        data: recentOrders,
        searchKeys: ["OrderId", "CustomerName", "CashierName"],
        columns: [
          { key: "OrderId", label: "Order" },
          { key: "CreatedAt", label: "Date", render: (row) => app.format.dateTime(row.CreatedAt) },
          { key: "CustomerName", label: "Customer" },
          { key: "CashierName", label: "Cashier" },
          { key: "Subtotal", label: "Subtotal", render: (row) => app.format.currency(row.Subtotal) },
          { key: "DiscountTotal", label: "Discount", render: (row) => app.format.currency(row.DiscountTotal) },
          { key: "TaxAmount", label: "Tax", render: (row) => app.format.currency(row.TaxAmount) },
          { key: "TotalAmount", label: "Total", render: (row) => app.format.currency(row.TotalAmount) }
        ],
        actions: [
          {
            label: "View",
            handler: (row) => {
              app.modal.open({
                title: row.OrderId,
                size: "large",
                content: `
                  <div class="summary-list">
                    ${row.Items.map((item) => `
                      <div class="summary-row">
                        <span>${app.helpers.escapeHtml(item.SKU)} x ${item.Quantity} - ${app.helpers.escapeHtml(item.ProductName)}</span>
                        <strong>${app.format.currency(item.LineTotal)}</strong>
                      </div>
                    `).join("")}
                    <div class="summary-row"><span>Total</span><strong>${app.format.currency(row.TotalAmount)}</strong></div>
                    <div class="summary-row"><span>Paid</span><strong>${app.format.currency(row.PaidAmount)}</strong></div>
                    <div class="summary-row"><span>Change due</span><strong>${app.format.currency(row.ChangeDue)}</strong></div>
                  </div>
                `
              });
            }
          }
        ]
      }));

      renderCart();
    }
  };
})(window.RetailOps = window.RetailOps || {});
