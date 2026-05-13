/* Replenishment recommendations, approvals, and page. */

// replenishment code
{
function generateResult(inventory, product) {
    const lowStock = Number(inventory.QuantityAvailable) <= Number(product.ReorderThreshold);
    const suggestedQuantity = Math.max(
      0,
      Number(product.ReorderThreshold) + Number(inventory.SafetyStock) - Number(inventory.QuantityAvailable)
    );

    return {
      ProductId: product.ProductId,
      SKU: product.SKU,
      ProductName: product.Name,
      WarehouseId: inventory.WarehouseId,
      CurrentStock: Number(inventory.QuantityAvailable),
      ReorderThreshold: Number(product.ReorderThreshold),
      SafetyStock: Number(inventory.SafetyStock),
      SuggestedQuantity: suggestedQuantity,
      IsLowStock: lowStock,
      LastUpdatedAt: inventory.LastUpdatedAt,
      SupplierId: product.SupplierId
    };
  }

  function setRequestStatus(replenishmentId, status) {
    const user = app.data.getUser();
    const now = app.help.nowIso();
    let updatedRecord = null;
    const approved = status === "Approved";
    const rejected = status === "Rejected";
    const records = app.data.get("replenishment").map((record) => {
      if (record.ReplenishmentId !== replenishmentId) {
        return record;
      }

      updatedRecord = {
        ...record,
        ApprovedQuantity: approved && Number(record.ApprovedQuantity) <= 0
          ? Number(record.SuggestedQuantity || 0)
          : Number(record.ApprovedQuantity || 0),
        Status: status,
        UpdatedAt: now,
        UpdatedBy: user?.Username || "System",
        ApprovedAt: approved ? now : record.ApprovedAt || null,
        ApprovedBy: approved ? user?.Username || "System" : record.ApprovedBy || "",
        RejectedAt: rejected ? now : record.RejectedAt || null,
        RejectedBy: rejected ? user?.Username || "System" : record.RejectedBy || ""
      };
      return updatedRecord;
    });

    if (!updatedRecord) {
      return null;
    }

    app.data.set("replenishment", records);
    app.logs.log(
      user,
      approved ? "ApproveReplenishment" : "RejectReplenishment",
      "Replenishment",
      replenishmentId,
      `${status} replenishment for ${updatedRecord.SKU}.`
    );
    return updatedRecord;
  }

  app.restock = {
    generateReplenishmentReport() {
      const products = app.data.get("products");
      return app.data.get("inventory")
        .map((inventory) => {
          const product = products.find((item) =>
            item.ProductId === inventory.ProductId ||
            item.SKU.toUpperCase() === String(inventory.SKU).toUpperCase()
          );
          return product ? generateResult(inventory, product) : null;
        })
        .filter(Boolean)
        .sort((a, b) => Number(b.IsLowStock) - Number(a.IsLowStock) || app.help.compareValues(a.SKU, b.SKU));
    },

    createRequest(row, approvedQuantity) {
      const records = app.data.get("replenishment");
      const user = app.data.getUser();
      const created = {
        ReplenishmentId: app.help.nextId(records, "ReplenishmentId", "REP", 3),
        SKU: row.SKU,
        ProductId: row.ProductId,
        WarehouseId: row.WarehouseId,
        SuggestedQuantity: Number(row.SuggestedQuantity),
        ApprovedQuantity: Number(approvedQuantity || row.SuggestedQuantity),
        Status: Number(approvedQuantity || row.SuggestedQuantity) > 0 ? "Approved" : "Pending",
        CreatedAt: app.help.nowIso(),
        CreatedBy: user?.Username || "System",
        SupplierId: row.SupplierId
      };

      app.data.set("replenishment", [...records, created]);
      app.logs.log(user, "CreateReplenishment", "Replenishment", created.ReplenishmentId, `Created replenishment for ${created.SKU}.`);
      return created;
    },

    approveRequest(replenishmentId) {
      return setRequestStatus(replenishmentId, "Approved");
    },

    rejectRequest(replenishmentId) {
      return setRequestStatus(replenishmentId, "Rejected");
    }
  };
}


// replenishment page
{
function replenishmentStatusTone(status) {
    if (status === "Approved") {
      return "green";
    }
    if (status === "Rejected") {
      return "red";
    }
    return "amber";
  }

  app.pages = app.pages || {};
  app.pages.replenishment = {
    render(root) {
      const recommendations = app.restock.generateReplenishmentReport();
      const low = recommendations.filter((item) => item.IsLowStock);
      const suggestedUnits = app.help.sum(recommendations, (item) => item.SuggestedQuantity);
      const pending = app.data.get("replenishment").filter((item) => item.Status === "Pending").length;
      const replenishmentRoute = app.setup.routes.find((route) => route.id === "replenishment");
      const canManageRequests = app.nav.hasAccess(replenishmentRoute, app.data.getUser());

      root.innerHTML = `
        <div class="page-stack">
          <section class="grid grid-4">
            ${app.parts.metric("Recommendations", app.fmt.number(recommendations.length), "Inventory rows analyzed", "Engine")}
            ${app.parts.metric("Low stock", app.fmt.number(low.length), "Rows requiring action", "Threshold")}
            ${app.parts.metric("Suggested units", app.fmt.number(suggestedUnits), "Threshold + safety - stock", "Formula")}
            ${app.parts.metric("Pending approvals", app.fmt.number(pending), "Saved replenishment records", "Workflow")}
          </section>
          <section class="grid grid-2">
            <article class="panel chart-card">
              <div><h2 class="section-title">Suggested Quantity by SKU</h2><p class="section-copy">Uses the same threshold plus safety stock formula.</p></div>
              ${app.chart.bar(low.slice(0, 8).map((item) => ({ label: item.SKU, value: item.SuggestedQuantity, displayValue: app.fmt.number(item.SuggestedQuantity) })), { label: "Suggested reorder quantities" })}
            </article>
            <article class="panel">
              <h2 class="section-title">Calculation Rule</h2>
              <div class="summary-list" style="margin-top:14px">
                <div class="summary-row"><span>Low stock</span><strong>QuantityAvailable <= ReorderThreshold</strong></div>
                <div class="summary-row"><span>Suggested quantity</span><strong>max(0, Threshold + SafetyStock - Stock)</strong></div>
                <div class="summary-row"><span>Product match</span><strong>ProductId or SKU</strong></div>
                <div class="summary-row"><span>Ordering</span><strong>Low stock first, then SKU</strong></div>
              </div>
            </article>
          </section>
          <div data-replenishment-table></div>
          <div data-replenishment-history></div>
        </div>
      `;

      root.querySelector("[data-replenishment-table]").appendChild(app.tables.create({
        title: "Replenishment Recommendations",
        exportName: "replenishment-recommendations",
        data: recommendations,
        searchKeys: ["SKU", "ProductName", "WarehouseId"],
        columns: [
          { key: "SKU", label: "SKU" },
          { key: "ProductName", label: "Product" },
          { key: "WarehouseId", label: "Warehouse" },
          { key: "CurrentStock", label: "Stock" },
          { key: "ReorderThreshold", label: "Threshold" },
          { key: "SafetyStock", label: "Safety" },
          { key: "SuggestedQuantity", label: "Suggest" },
          { key: "IsLowStock", label: "Status", render: (row) => app.parts.stockBadge(row.CurrentStock, row.ReorderThreshold) }
        ],
        actions: [
          {
            label: "Create",
            handler: (row) => {
              app.parts.openFormModal("Create replenishment", [
                { name: "ApprovedQuantity", label: "Approved quantity", type: "number", min: 0, step: 1, required: true }
              ], { ApprovedQuantity: row.SuggestedQuantity }, "Create request", (payload) => {
                app.restock.createRequest(row, payload.ApprovedQuantity);
                app.toast.success("Replenishment request created.");
                this.render(root);
              });
            }
          }
        ]
      }));

      root.querySelector("[data-replenishment-history]").appendChild(app.tables.create({
        title: "Replenishment History",
        exportName: "replenishment-history",
        data: app.data.get("replenishment"),
        pageSize: 5,
        searchKeys: ["ReplenishmentId", "SKU", "WarehouseId", "Status"],
        columns: [
          { key: "ReplenishmentId", label: "ID" },
          { key: "SKU", label: "SKU" },
          { key: "WarehouseId", label: "Warehouse" },
          { key: "SuggestedQuantity", label: "Suggested" },
          { key: "ApprovedQuantity", label: "Approved" },
          { key: "Status", label: "Status", render: (row) => app.help.renderBadge(row.Status, replenishmentStatusTone(row.Status)) },
          { key: "CreatedBy", label: "Created by" },
          { key: "CreatedAt", label: "Created", render: (row) => app.fmt.dateTime(row.CreatedAt) },
          { key: "UpdatedAt", label: "Updated", value: (row) => row.ApprovedAt || row.RejectedAt || row.UpdatedAt || "", render: (row) => row.ApprovedAt || row.RejectedAt || row.UpdatedAt ? app.fmt.dateTime(row.ApprovedAt || row.RejectedAt || row.UpdatedAt) : "-" }
        ],
        actions: [
          {
            label: "Approve",
            visible: (row) => canManageRequests && row.Status === "Pending",
            handler: async (row) => {
              const ok = await app.popup.confirm({ title: "Approve replenishment", message: `Approve replenishment request ${row.ReplenishmentId}?`, confirmLabel: "Approve" });
              if (ok && app.restock.approveRequest(row.ReplenishmentId)) {
                app.toast.success("Replenishment request approved.");
                this.render(root);
              }
            }
          },
          {
            label: "Reject",
            className: "btn btn-secondary",
            visible: (row) => canManageRequests && row.Status === "Pending",
            handler: async (row) => {
              const ok = await app.popup.confirm({ title: "Reject replenishment", message: `Reject replenishment request ${row.ReplenishmentId}?`, confirmLabel: "Reject", danger: true });
              if (ok && app.restock.rejectRequest(row.ReplenishmentId)) {
                app.toast.success("Replenishment request rejected.");
                this.render(root);
              }
            }
          }
        ]
      }));
    }
  };
}


