(function (app) {
  app.settingsService = {
    getSettings() {
      return app.store.get("settings");
    },

    updateSettings(settings) {
      app.store.set("settings", {
        ...app.store.get("settings"),
        ...settings,
        TaxRate: Number(settings.TaxRate),
        LowStockAlertWindowDays: Number(settings.LowStockAlertWindowDays),
        ForecastHorizonDays: Number(settings.ForecastHorizonDays),
        RequireManagerApproval: Boolean(settings.RequireManagerApproval)
      });
      app.auditService.log(app.store.getUser(), "UpdateSettings", "Settings", "LOCAL", "Updated local simulation settings.");
    }
  };
})(window.RetailOps = window.RetailOps || {});
