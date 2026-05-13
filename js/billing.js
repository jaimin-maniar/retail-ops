/* Billing calculations and billing page. */

// billing code
{
function generateOrderId(orders) {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    const prefix = `ORD${yyyy}${mm}${dd}`;
    const lastNumber = Math.max(0, ...orders
      .filter((order) => String(order.OrderId || "").startsWith(prefix))
      .map((order) => Number.parseInt(String(order.OrderId).slice(prefix.length), 10) || 0));
    return `${prefix}${String(lastNumber + 1).padStart(4, "0")}`;
  }

  function failure(message, order) {
    return { Success: false, Message: message, Order: order || null };
  }

  function normalizeManualDiscount(discount) {
    const type = discount?.Type || discount?.type || "None";
    const value = Number(discount?.Value ?? discount?.value ?? 0);
    return {
      Type: ["Percentage", "FlatAmount"].includes(type) ? type : "None",
      Value: Number.isFinite(value) ? value : 0
    };
  }

  function calculateManualDiscount(subtotal, promotionDiscountTotal, discount) {
    const normalized = normalizeManualDiscount(discount);
    if (normalized.Type === "None" || Number(normalized.Value) === 0) {
      return { Success: true, Type: "None", Value: 0, Amount: 0 };
    }

    if (normalized.Value < 0) {
      return failure("Discount cannot be negative.");
    }

    const discountBase = app.help.roundMoney(Math.max(0, Number(subtotal) - Number(promotionDiscountTotal)));
    let amount = 0;

    if (normalized.Type === "Percentage") {
      if (normalized.Value > 100) {
        return failure("Discount cannot exceed subtotal.");
      }
      amount = app.help.roundMoney(discountBase * normalized.Value / 100);
    } else if (normalized.Type === "FlatAmount") {
      amount = app.help.roundMoney(normalized.Value);
    }

    if (amount > discountBase) {
      return failure("Discount cannot exceed subtotal.");
    }

    return {
      Success: true,
      Type: normalized.Type,
      Value: normalized.Value,
      Amount: amount
    };
  }

  function normalizeCartItems(items) {
    const grouped = app.help.groupBy(
      (items || [])
        .map((item) => ({
          SKU: app.check.normalizeSku(item.SKU),
          Quantity: Math.max(0, Math.trunc(Number(item.Quantity) || 0))
        }))
        .filter((item) => item.SKU && item.Quantity > 0),
      (item) => item.SKU
    );

    return Object.keys(grouped).map((sku) => ({
      SKU: sku,
      Quantity: app.help.sum(grouped[sku], (item) => item.Quantity)
    }));
  }

  function buildOrder(requestedItems, cashierUserId, cashierName, customerName, manualDiscount) {
    const requests = normalizeCartItems(requestedItems);
    if (requests.length === 0) {
      return failure("Cart is empty.");
    }

    const products = app.data.get("products");
    const inventoryList = app.data.get("inventory");
    const grouped = app.help.groupBy(
      requests,
      (item) => app.check.normalizeSku(item.SKU)
    );

    const finalItems = [];
    for (const sku of Object.keys(grouped)) {
      const quantity = app.help.sum(grouped[sku], (item) => item.Quantity);
      const product = products.find((item) => item.IsActive && item.SKU.toUpperCase() === sku);

      if (!product) {
        return failure(`Product with SKU ${sku} was not found.`);
      }

      const availableStock = app.help.sum(
        inventoryList.filter((item) => item.SKU.toUpperCase() === sku),
        (item) => item.QuantityAvailable
      );

      if (availableStock < quantity) {
        return failure(`Insufficient stock for ${product.Name}. Available: ${availableStock}.`);
      }

      const lineSubtotal = Number(product.Price) * Number(quantity);
      const best = app.promos.getBestDiscount(product, quantity);
      finalItems.push({
        ProductId: product.ProductId,
        SKU: product.SKU,
        ProductName: product.Name,
        Quantity: quantity,
        UnitPrice: Number(product.Price),
        DiscountAmount: best.Discount,
        LineTotal: app.help.roundMoney(lineSubtotal - best.Discount),
        PromotionId: best.Promotion?.PromotionId || null,
        PromotionName: best.Promotion?.Name || null
      });
    }

    if (finalItems.length === 0) {
      return failure("Cart does not contain any billable items.");
    }

    const subtotal = app.help.roundMoney(app.help.sum(finalItems, (item) => item.UnitPrice * item.Quantity));
    const promotionDiscountTotal = app.help.roundMoney(app.help.sum(finalItems, (item) => item.DiscountAmount));
    const manual = calculateManualDiscount(subtotal, promotionDiscountTotal, manualDiscount);
    if (!manual.Success) {
      return manual;
    }

    const discountTotal = app.help.roundMoney(promotionDiscountTotal + manual.Amount);
    const taxableAmount = app.help.roundMoney(subtotal - discountTotal);
    const taxAmount = app.help.roundMoney(taxableAmount * app.setup.taxRate);
    const totalAmount = app.help.roundMoney(taxableAmount + taxAmount);

    return {
      Success: true,
      Message: "Bill preview generated.",
      Order: {
        OrderId: "",
        CustomerName: String(customerName || "").trim() || "Walk-in Customer",
        CashierUserId: cashierUserId || "",
        CashierName: cashierName || "",
        Items: finalItems,
        Subtotal: subtotal,
        PromotionDiscountTotal: promotionDiscountTotal,
        ManualDiscountType: manual.Type,
        ManualDiscountValue: manual.Value,
        ManualDiscountAmount: manual.Amount,
        DiscountTotal: discountTotal,
        TaxAmount: taxAmount,
        TotalAmount: totalAmount,
        PaidAmount: 0,
        ChangeDue: 0,
        Status: "Preview"
      }
    };
  }

  app.bills = {
    previewBill(cartItems, manualDiscount) {
      return buildOrder(cartItems, "", "", "", manualDiscount);
    },

    validateCartItemAvailability(cartItems, sku, additionalQuantity) {
      const normalizedSku = app.check.normalizeSku(sku);
      const rawQuantity = Number(additionalQuantity || 0);
      const quantity = Number.isFinite(rawQuantity) && rawQuantity > 0 ? Math.trunc(rawQuantity) : 0;
      const requestedQuantity = app.help.sum(normalizeCartItems(cartItems), (item) =>
        app.check.normalizeSku(item.SKU) === normalizedSku ? item.Quantity : 0
      ) + quantity;
      const product = app.products.getBySku(normalizedSku);

      if (!product || !product.IsActive) {
        return { Success: false, Message: "Product is not available." };
      }

      const availableStock = app.stock.totalStockBySku(normalizedSku);
      if (availableStock < requestedQuantity) {
        return { Success: false, Message: "Item is out of stock", AvailableStock: availableStock };
      }

      return { Success: true, AvailableStock: availableStock };
    },

    createBill(cartItems, cashierUserId, cashierName, customerName, paidAmount, manualDiscount) {
      const result = buildOrder(cartItems, cashierUserId, cashierName, customerName, manualDiscount);
      if (!result.Success || !result.Order) {
        return result;
      }

      if (Number(paidAmount) < Number(result.Order.TotalAmount)) {
        return failure(`Paid amount is short by ${app.fmt.currency(result.Order.TotalAmount - Number(paidAmount))}.`, result.Order);
      }

      const orders = app.data.get("orders");
      const inventoryList = app.data.get("inventory");
      result.Order.Items.forEach((item) => {
        app.stock.deductStock(inventoryList, item.SKU, item.Quantity);
      });

      result.Order.OrderId = generateOrderId(orders);
      result.Order.PaidAmount = Number(paidAmount);
      result.Order.ChangeDue = app.help.roundMoney(Number(paidAmount) - Number(result.Order.TotalAmount));
      result.Order.CreatedAt = app.help.nowIso();
      result.Order.Status = "Completed";

      app.data.set("inventory", inventoryList);
      app.data.set("orders", [...orders, result.Order]);
      app.logs.log(
        { UserId: cashierUserId, Username: cashierName },
        "CreateBill",
        "Order",
        result.Order.OrderId,
        `Order completed for ${result.Order.TotalAmount.toFixed(2)}.`
      );
      result.Message = "Bill created successfully.";
      return result;
    },

    getRecentOrders(count) {
      return app.data.get("orders")
        .sort((a, b) => new Date(b.CreatedAt) - new Date(a.CreatedAt))
        .slice(0, count || 20);
    }
  };
}


// billing page
{
function discountLabel(order) {
    if (!order?.ManualDiscountAmount) {
      return "No manual discount";
    }
    return order.ManualDiscountType === "Percentage"
      ? `${order.ManualDiscountValue}% manual discount`
      : `${app.fmt.currency(order.ManualDiscountAmount)} manual discount`;
  }

  app.pages = app.pages || {};
  app.pages.billing = {
    render(root) {
      let cart = [];
      let suggestedPaidAmount = "";
      const recentOrders = app.bills.getRecentOrders(8);

      root.innerHTML = `
        <div class="page-stack">
          <section class="grid grid-4">
            ${app.parts.metric("Recent orders", app.fmt.number(recentOrders.length), "Latest completed transactions", "POS")}
            ${app.parts.metric("Tax rate", app.fmt.percent(app.setup.taxRate * 100), "Applied after discounts", "Tax")}
            ${app.parts.metric("Active promos", app.fmt.number(app.promos.getActivePromotions().length), "Eligible discount programs", "Best")}
            ${app.parts.metric("Stocked SKUs", app.fmt.number(app.help.unique(app.data.get("inventory").map((i) => i.SKU)).length), "Available in inventory", "Stock")}
          </section>
          <section class="grid grid-2">
            <article class="panel">
              <h2 class="section-title">Create Bill</h2>
              <p class="section-copy">Add products to the cart, apply discounts and tax, then complete the bill.</p>
              <form data-add-cart class="form-grid" style="margin-top:16px">
                <label class="form-field"><span>Product</span><select class="select" name="sku">${app.products.getProducts().filter((p) => p.IsActive).map((product) => `<option value="${app.help.escapeHtml(product.SKU)}">${app.help.escapeHtml(product.SKU)} - ${app.help.escapeHtml(product.Name)}</option>`).join("")}</select></label>
                <label class="form-field"><span>Quantity</span><input class="input" name="quantity" type="number" min="1" step="1" value="1"></label>
                <div class="form-actions" style="grid-column:1 / -1"><button class="btn btn-primary" type="submit">Add to Cart</button></div>
              </form>
              <div data-cart-table style="margin-top:16px"></div>
            </article>
            <article class="panel">
              <h2 class="section-title">Bill Preview</h2>
              <div data-bill-preview class="summary-list" style="margin-top:14px"></div>
              <form data-complete-bill class="form-grid" style="margin-top:16px">
                <label class="form-field"><span>Manual discount type</span><select class="select" name="manualDiscountType">
                  <option value="None">No manual discount</option>
                  <option value="Percentage">Percentage</option>
                  <option value="FlatAmount">Flat amount</option>
                </select></label>
                <label class="form-field"><span>Manual discount value</span><input class="input" name="manualDiscountValue" type="number" min="0" step="0.01" value="0" disabled></label>
                <div class="field-help" data-discount-help style="grid-column:1 / -1">No manual discount applied.</div>
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
      const discountTypeInput = root.querySelector("[name=manualDiscountType]");
      const discountValueInput = root.querySelector("[name=manualDiscountValue]");
      const discountHelp = root.querySelector("[data-discount-help]");

      function resetPaymentSuggestion() {
        paidInput.value = "";
        suggestedPaidAmount = "";
      }

      function normalizeQuantity(value) {
        const quantity = Number(value);
        if (!Number.isFinite(quantity)) {
          return null;
        }
        return Math.max(0, Math.trunc(quantity));
      }

      function sanitizeCart() {
        const grouped = app.help.groupBy(
          cart
            .map((item) => ({
              SKU: app.check.normalizeSku(item.SKU),
              Quantity: normalizeQuantity(item.Quantity)
            }))
            .filter((item) => item.SKU && item.Quantity > 0),
          (item) => item.SKU
        );

        cart = Object.keys(grouped).map((sku) => ({
          SKU: sku,
          Quantity: app.help.sum(grouped[sku], (item) => item.Quantity)
        }));
      }

      function cartWithoutSku(sku) {
        const normalizedSku = app.check.normalizeSku(sku);
        return cart.filter((item) => app.check.normalizeSku(item.SKU) !== normalizedSku);
      }

      function setCartQuantity(sku, value) {
        const normalizedSku = app.check.normalizeSku(sku);
        const quantity = normalizeQuantity(value);
        if (quantity === null) {
          renderCart();
          return;
        }

        if (Number(value) < 0) {
          app.toast.warning("Quantity cannot be negative.");
        }

        if (quantity <= 0) {
          cart = cartWithoutSku(normalizedSku);
          resetPaymentSuggestion();
          renderCart();
          return;
        }

        const remainingCart = cartWithoutSku(normalizedSku);
        const availability = app.bills.validateCartItemAvailability(remainingCart, normalizedSku, quantity);
        if (!availability.Success) {
          app.toast.error(availability.Message === "Item is out of stock" ? "Item is out of stock" : availability.Message);
          renderCart();
          return;
        }

        cart = [...remainingCart, { SKU: normalizedSku, Quantity: quantity }];
        resetPaymentSuggestion();
        renderCart();
      }

      function getManualDiscount() {
        if (discountTypeInput.value === "None") {
          return { Type: "None", Value: 0 };
        }
        return {
          Type: discountTypeInput.value,
          Value: Number(discountValueInput.value || 0)
        };
      }

      function refreshDiscountState() {
        const isEnabled = discountTypeInput.value !== "None";
        discountValueInput.disabled = !isEnabled;
        if (!isEnabled) {
          discountValueInput.value = "0";
          discountHelp.textContent = "No manual discount applied.";
        } else {
          discountHelp.textContent = discountTypeInput.value === "Percentage"
            ? "Enter a percentage from 0 to 100."
            : "Enter a flat amount that does not exceed the discounted subtotal.";
        }
      }

      function setSuggestedPaidAmount(totalAmount) {
        const nextValue = Number(totalAmount).toFixed(2);
        if (!paidInput.value || paidInput.value === suggestedPaidAmount) {
          paidInput.value = nextValue;
        }
        suggestedPaidAmount = nextValue;
      }

      function renderCart() {
        sanitizeCart();
        const cartPreview = app.bills.previewBill(cart);
        const preview = app.bills.previewBill(cart, getManualDiscount());
        const items = cartPreview.Order?.Items || [];

        cartTarget.innerHTML = items.length
          ? `
            <div class="table-wrap">
              <table class="data-table cart-table" style="min-width:560px">
                <thead><tr><th>SKU</th><th>Item</th><th>Count</th><th>Discount</th><th>Line</th><th></th></tr></thead>
                <tbody>
                  ${items.map((item) => `
                    <tr>
                      <td>${app.help.escapeHtml(item.SKU)}</td>
                      <td>${app.help.escapeHtml(item.ProductName)}</td>
                      <td>
                        <div class="quantity-control">
                          <button class="icon-btn quantity-step" type="button" data-decrease-cart="${app.help.escapeHtml(item.SKU)}" aria-label="Decrease ${app.help.escapeHtml(item.SKU)} quantity">-</button>
                          <input class="input quantity-input" type="number" min="0" step="1" value="${app.help.escapeHtml(item.Quantity)}" data-cart-quantity="${app.help.escapeHtml(item.SKU)}" aria-label="Quantity for ${app.help.escapeHtml(item.SKU)}">
                          <button class="icon-btn quantity-step" type="button" data-increase-cart="${app.help.escapeHtml(item.SKU)}" aria-label="Increase ${app.help.escapeHtml(item.SKU)} quantity">+</button>
                        </div>
                      </td>
                      <td>${app.fmt.currency(item.DiscountAmount)}</td>
                      <td>${app.fmt.currency(item.LineTotal)}</td>
                      <td><button class="btn btn-secondary" type="button" data-remove-cart="${app.help.escapeHtml(item.SKU)}">Remove</button></td>
                    </tr>
                  `).join("")}
                </tbody>
              </table>
            </div>
          `
          : `<div class="empty-state"><div><strong>Cart is empty</strong><span>Add SKU quantities to preview discounts and tax.</span></div></div>`;

        if (!preview.Success) {
          previewTarget.innerHTML = `<div class="alert-item"><div><strong>Preview unavailable</strong><span class="section-copy">${app.help.escapeHtml(preview.Message)}</span></div>${app.help.renderBadge("Blocked", "red")}</div>`;
        } else {
          previewTarget.innerHTML = `
            <div class="summary-row"><span>Subtotal</span><strong>${app.fmt.currency(preview.Order.Subtotal)}</strong></div>
            <div class="summary-row"><span>Promotion discount</span><strong>${app.fmt.currency(preview.Order.PromotionDiscountTotal)}</strong></div>
            <div class="summary-row"><span>Manual discount</span><strong>${app.fmt.currency(preview.Order.ManualDiscountAmount)}</strong></div>
            <div class="summary-row"><span>Total discount</span><strong>${app.fmt.currency(preview.Order.DiscountTotal)}</strong></div>
            <div class="summary-row"><span>Tax</span><strong>${app.fmt.currency(preview.Order.TaxAmount)}</strong></div>
            <div class="summary-row"><span>Total</span><strong>${app.fmt.currency(preview.Order.TotalAmount)}</strong></div>
          `;
          setSuggestedPaidAmount(preview.Order.TotalAmount);
        }

        root.querySelectorAll("[data-remove-cart]").forEach((button) => {
          button.addEventListener("click", () => {
            cart = cart.filter((item) => app.check.normalizeSku(item.SKU) !== app.check.normalizeSku(button.dataset.removeCart));
            resetPaymentSuggestion();
            renderCart();
          });
        });

        root.querySelectorAll("[data-decrease-cart]").forEach((button) => {
          button.addEventListener("click", () => {
            const current = cart.find((item) => app.check.normalizeSku(item.SKU) === app.check.normalizeSku(button.dataset.decreaseCart));
            setCartQuantity(button.dataset.decreaseCart, Number(current?.Quantity || 0) - 1);
          });
        });

        root.querySelectorAll("[data-increase-cart]").forEach((button) => {
          button.addEventListener("click", () => {
            const current = cart.find((item) => app.check.normalizeSku(item.SKU) === app.check.normalizeSku(button.dataset.increaseCart));
            setCartQuantity(button.dataset.increaseCart, Number(current?.Quantity || 0) + 1);
          });
        });

        root.querySelectorAll("[data-cart-quantity]").forEach((input) => {
          input.addEventListener("input", () => {
            if (input.value !== "") {
              const current = cart.find((item) => app.check.normalizeSku(item.SKU) === app.check.normalizeSku(input.dataset.cartQuantity));
              const quantity = normalizeQuantity(input.value);
              if (quantity !== null && quantity === Number(current?.Quantity || 0)) {
                return;
              }
              setCartQuantity(input.dataset.cartQuantity, input.value);
            }
          });
          input.addEventListener("change", () => {
            if (input.value === "") {
              renderCart();
              return;
            }
            setCartQuantity(input.dataset.cartQuantity, input.value);
          });
        });
      }

      root.querySelector("[data-add-cart]").addEventListener("submit", (event) => {
        event.preventDefault();
        const data = new FormData(event.target);
        const sku = data.get("sku");
        const rawQuantity = Number(data.get("quantity") || 1);
        const quantity = Number.isFinite(rawQuantity) && rawQuantity > 0 ? Math.trunc(rawQuantity) : 0;

        if (quantity <= 0) {
          app.toast.error("Quantity must be greater than zero.");
          return;
        }

        const availability = app.bills.validateCartItemAvailability(cart, sku, quantity);

        if (!availability.Success) {
          app.toast.error(availability.Message === "Item is out of stock" ? "Item is out of stock" : availability.Message);
          return;
        }

        const existing = cart.find((item) => app.check.normalizeSku(item.SKU) === app.check.normalizeSku(sku));
        if (existing) {
          cart = cart.map((item) => app.check.normalizeSku(item.SKU) === app.check.normalizeSku(sku)
            ? { ...item, Quantity: Number(item.Quantity) + quantity }
            : item);
        } else {
          cart = [...cart, { SKU: app.check.normalizeSku(sku), Quantity: quantity }];
        }
        event.target.quantity.value = 1;
        resetPaymentSuggestion();
        renderCart();
      });

      discountTypeInput.addEventListener("change", () => {
        refreshDiscountState();
        resetPaymentSuggestion();
        renderCart();
      });

      discountValueInput.addEventListener("input", app.help.debounce(() => {
        resetPaymentSuggestion();
        renderCart();
      }, 80));

      root.querySelector("[data-clear-cart]").addEventListener("click", () => {
        cart = [];
        resetPaymentSuggestion();
        discountTypeInput.value = "None";
        refreshDiscountState();
        renderCart();
      });

      root.querySelector("[data-complete-bill]").addEventListener("submit", (event) => {
        event.preventDefault();
        const user = app.data.getUser();
        const data = new FormData(event.target);
        const result = app.bills.createBill(
          cart,
          user.UserId,
          user.Username,
          data.get("customerName"),
          Number(data.get("paidAmount")),
          getManualDiscount()
        );

        if (!result.Success) {
          app.toast.error(result.Message);
          return;
        }

        app.toast.success(`${result.Message} Change due: ${app.fmt.currency(result.Order.ChangeDue)}.`);
        cart = [];
        this.render(root);
      });

      root.querySelector("[data-recent-orders]").appendChild(app.tables.create({
        title: "Recent Orders",
        exportName: "orders",
        data: recentOrders,
        searchKeys: ["OrderId", "CustomerName", "CashierName", "Status"],
        columns: [
          { key: "OrderId", label: "Order" },
          { key: "CreatedAt", label: "Date", render: (row) => app.fmt.dateTime(row.CreatedAt) },
          { key: "CustomerName", label: "Customer" },
          { key: "CashierName", label: "Cashier" },
          { key: "Subtotal", label: "Subtotal", render: (row) => app.fmt.currency(row.Subtotal) },
          { key: "DiscountTotal", label: "Discount", render: (row) => app.fmt.currency(row.DiscountTotal) },
          { key: "TaxAmount", label: "Tax", render: (row) => app.fmt.currency(row.TaxAmount) },
          { key: "TotalAmount", label: "Total", render: (row) => app.fmt.currency(row.TotalAmount) }
        ],
        actions: [
          {
            label: "View",
            handler: (row) => {
              app.popup.open({
                title: row.OrderId,
                size: "large",
                content: `
                  <div class="summary-list">
                    ${row.Items.map((item) => `
                      <div class="summary-row">
                        <span>${app.help.escapeHtml(item.SKU)} x ${item.Quantity} - ${app.help.escapeHtml(item.ProductName)}</span>
                        <strong>${app.fmt.currency(item.LineTotal)}</strong>
                      </div>
                    `).join("")}
                    <div class="summary-row"><span>Subtotal</span><strong>${app.fmt.currency(row.Subtotal)}</strong></div>
                    <div class="summary-row"><span>Promotion discount</span><strong>${app.fmt.currency(row.PromotionDiscountTotal ?? row.DiscountTotal)}</strong></div>
                    <div class="summary-row"><span>Manual discount</span><strong>${app.fmt.currency(row.ManualDiscountAmount || 0)}</strong></div>
                    <div class="summary-row"><span>Discount note</span><strong>${app.help.escapeHtml(discountLabel(row))}</strong></div>
                    <div class="summary-row"><span>Total</span><strong>${app.fmt.currency(row.TotalAmount)}</strong></div>
                    <div class="summary-row"><span>Paid</span><strong>${app.fmt.currency(row.PaidAmount)}</strong></div>
                    <div class="summary-row"><span>Change due</span><strong>${app.fmt.currency(row.ChangeDue)}</strong></div>
                  </div>
                `
              });
            }
          }
        ]
      }));

      refreshDiscountState();
      renderCart();
    }
  };
}


