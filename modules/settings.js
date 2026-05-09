(function (app) {
  app.pages = app.pages || {};
  app.pages.settings = {
    render(root) {
      const settings = app.settingsService.getSettings();
      const collectionStats = Object.keys(app.config.dataFiles).map((name) => {
        const value = app.store.get(name);
        return {
          Collection: name,
          Records: Array.isArray(value) ? value.length : 1,
          StorageKey: `${app.config.storagePrefix}.${name}`
        };
      });

      root.innerHTML = `
        <div class="page-stack">
          <section class="grid grid-4">
            ${app.shared.metric("Company", app.helpers.escapeHtml(settings.CompanyName || "RetailOps"), "Displayed throughout the workspace", "Local")}
            ${app.shared.metric("Currency", app.helpers.escapeHtml(settings.Currency || "INR"), "Formatting locale en-IN", "Finance")}
            ${app.shared.metric("Tax rate", app.format.percent(Number(settings.TaxRate || app.config.taxRate) * 100), "Billing tax calculation", "C#")}
            ${app.shared.metric("Default WH", app.helpers.escapeHtml(settings.DefaultWarehouseId || "MAIN"), "Inventory creation default", "Ops")}
          </section>
          <section class="grid grid-2">
            <article class="panel">
              <h2 class="section-title">Simulation Settings</h2>
              <div data-settings-form style="margin-top:16px"></div>
            </article>
            <article class="panel">
              <h2 class="section-title">Local Data Controls</h2>
              <p class="section-copy">Changes are saved in browser localStorage. Reset reloads the JSON seed mirror generated from the local data files.</p>
              <div class="summary-list" style="margin-top:16px">
                <div class="summary-row"><span>Persistence</span><strong>localStorage</strong></div>
                <div class="summary-row"><span>Source files</span><strong>Data/*.json</strong></div>
                <div class="summary-row"><span>Runtime</span><strong>Browser only</strong></div>
              </div>
              <div class="form-actions">
                <button class="btn btn-danger" type="button" data-reset-data>Reset Local Data</button>
              </div>
            </article>
          </section>
          <div data-collections-table></div>
        </div>
      `;

      const form = app.form.create([
        { name: "CompanyName", label: "Company name", required: true },
        { name: "Currency", label: "Currency", required: true },
        { name: "TaxRate", label: "Tax rate", type: "number", min: 0, step: 0.01, required: true },
        { name: "DefaultWarehouseId", label: "Default warehouse", type: "select", options: app.shared.warehouseOptions() },
        { name: "LowStockAlertWindowDays", label: "Low stock alert window", type: "number", min: 1, step: 1 },
        { name: "ForecastHorizonDays", label: "Forecast horizon days", type: "number", min: 1, step: 1 },
        {
          name: "ThemeDensity",
          label: "Theme density",
          type: "select",
          options: [
            { value: "Comfortable", label: "Comfortable" },
            { value: "Compact", label: "Compact" }
          ]
        },
        { name: "RequireManagerApproval", label: "Require manager approval", type: "checkbox" }
      ], settings, (payload) => {
        app.settingsService.updateSettings(payload);
        app.toast.success("Settings updated.");
        this.render(root);
      }, { submitLabel: "Save settings", cancelLabel: "Revert", onCancel: () => this.render(root) });
      root.querySelector("[data-settings-form]").appendChild(form);

      root.querySelector("[data-reset-data]").addEventListener("click", async () => {
        const ok = await app.modal.confirm({
          title: "Reset local data",
          message: "This clears localStorage changes and reloads the bundled JSON seed data.",
          danger: true,
          confirmLabel: "Reset"
        });
        if (ok) {
          app.store.resetLocalData();
          app.auditService.log(app.store.getUser(), "ResetData", "Settings", "LOCAL", "Reset browser-local data to JSON seed.");
          app.toast.success("Local data reset.");
          this.render(root);
        }
      });

      root.querySelector("[data-collections-table]").appendChild(app.table.create({
        title: "Local Collections",
        exportName: "collections",
        data: collectionStats,
        pageSize: 12,
        searchKeys: ["Collection", "StorageKey"],
        columns: [
          { key: "Collection", label: "Collection" },
          { key: "Records", label: "Records" },
          { key: "StorageKey", label: "Storage key" }
        ]
      }));
    }
  };
})(window.RetailOps = window.RetailOps || {});
