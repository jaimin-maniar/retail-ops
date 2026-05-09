(function (app) {
  app.forecastService = {
    getForecastRows() {
      const products = app.store.get("products");
      const suppliers = app.store.get("suppliers");
      const forecast = app.store.get("forecast");

      return forecast.map((item) => {
        const product = products.find((p) => p.ProductId === item.ProductId || p.SKU === item.SKU);
        const supplier = suppliers.find((s) => s.SupplierId === product?.SupplierId);
        const stock = app.inventoryService.totalStockBySku(item.SKU);
        const averageWeeklyDemand = app.helpers.avg(item.WeeklyDemand || [], (value) => value);
        const effectiveDailyDemand = (averageWeeklyDemand / 7) * Number(item.SeasonalityIndex || 1) * Number(item.PromoLift || 1);
        const projectedDemand = Math.round(effectiveDailyDemand * Number(item.HorizonDays || 21));
        const daysOfCover = effectiveDailyDemand > 0 ? stock / effectiveDailyDemand : 999;
        const stockoutDate = daysOfCover >= 999 ? null : app.helpers.addDays(app.helpers.todayDateOnly(), Math.floor(daysOfCover));
        const leadTime = Number(supplier?.LeadTimeDays || 0);
        const risk = stock === 0 ? "Out of stock" : daysOfCover <= leadTime ? "Critical" : daysOfCover <= leadTime + 5 ? "Watch" : "Stable";

        return {
          ...item,
          ProductName: product?.Name || "Unknown",
          Category: product?.Category || "",
          SupplierName: supplier?.Name || "",
          StockOnHand: stock,
          AverageWeeklyDemand: averageWeeklyDemand,
          EffectiveDailyDemand: effectiveDailyDemand,
          ProjectedDemand: projectedDemand,
          DaysOfCover: daysOfCover,
          StockoutDate: stockoutDate,
          LeadTimeDays: leadTime,
          Risk: risk
        };
      }).sort((a, b) => app.helpers.compareValues(a.Risk, b.Risk) || app.helpers.compareValues(a.SKU, b.SKU));
    }
  };
})(window.RetailOps = window.RetailOps || {});
