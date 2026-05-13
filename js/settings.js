/* Settings logic and settings page. */

// settings code
{
app.settings = {
    getSettings() {
      return app.data.get("settings");
    },

    updateSettings(settings) {
      app.data.set("settings", {
        ...app.data.get("settings"),
        ...settings,
        TaxRate: Number(settings.TaxRate),
        LowStockAlertWindowDays: Number(settings.LowStockAlertWindowDays),
        ForecastHorizonDays: Number(settings.ForecastHorizonDays),
        RequireManagerApproval: Boolean(settings.RequireManagerApproval)
      });
      app.logs.log(app.data.getUser(), "UpdateSettings", "Settings", "LOCAL", "Updated local simulation settings.");
    }
  };
}


// settings page
{
app.pages = app.pages || {};
  app.pages.settings = {
    render(root) {
      const settings = app.settings.getSettings();
      const collectionStats = Object.keys(app.setup.dataFiles).map((name) => {
        const value = app.data.get(name);
        return {
          Collection: name,
          Records: Array.isArray(value) ? value.length : 1,
          StorageKey: `${app.setup.storagePrefix}.${name}`
        };
      });

      root.innerHTML = `
        <div class="page-stack">
          <section class="grid grid-4">
            ${app.parts.metric("Company", app.help.escapeHtml(settings.CompanyName || "RetailOps"), "Displayed throughout the workspace", "Local")}
            ${app.parts.metric("Currency", app.help.escapeHtml(settings.Currency || "INR"), "Formatting locale en-IN", "Finance")}
            ${app.parts.metric("Tax rate", app.fmt.percent(Number(settings.TaxRate || app.setup.taxRate) * 100), "Billing tax calculation", "Tax")}
            ${app.parts.metric("Default WH", app.help.escapeHtml(settings.DefaultWarehouseId || "MAIN"), "Inventory creation default", "Ops")}
          </section>
          <section class="grid grid-2">
            <article class="panel">
              <h2 class="section-title">Simulation Settings</h2>
              <div data-settings-form style="margin-top:16px"></div>
            </article>
            <article class="panel">
              <h2 class="section-title">Local Data Controls</h2>
              <p class="section-copy">Changes are saved in browser localStorage. Reset reloads the bundled sample data.</p>
              <div class="summary-list" style="margin-top:16px">
                <div class="summary-row"><span>Persistence</span><strong>localStorage</strong></div>
                <div class="summary-row"><span>Sample data</span><strong>js/data.js</strong></div>
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

      const form = app.forms.create([
        { name: "CompanyName", label: "Company name", required: true },
        { name: "Currency", label: "Currency", required: true },
        { name: "TaxRate", label: "Tax rate", type: "number", min: 0, step: 0.01, required: true },
        { name: "DefaultWarehouseId", label: "Default warehouse", type: "select", options: app.parts.warehouseOptions() },
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
        app.settings.updateSettings(payload);
        app.toast.success("Settings updated.");
        this.render(root);
      }, { submitLabel: "Save settings", cancelLabel: "Revert", onCancel: () => this.render(root) });
      root.querySelector("[data-settings-form]").appendChild(form);

      root.querySelector("[data-reset-data]").addEventListener("click", async () => {
        const ok = await app.popup.confirm({
          title: "Reset local data",
          message: "This clears localStorage changes and reloads the bundled sample data.",
          danger: true,
          confirmLabel: "Reset"
        });
        if (ok) {
          app.data.resetLocalData();
          app.logs.log(app.data.getUser(), "ResetData", "Settings", "LOCAL", "Reset browser-local data to sample data.");
          app.toast.success("Local data reset.");
          this.render(root);
        }
      });

      root.querySelector("[data-collections-table]").appendChild(app.tables.create({
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
}


