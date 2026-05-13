/* Forecast calculations and forecast page. */

// forecast code
{
app.forecast = {
    getForecastRows() {
      const products = app.data.get("products");
      const suppliers = app.data.get("suppliers");
      const forecast = app.data.get("forecast");

      return forecast.map((item) => {
        const product = products.find((p) => p.ProductId === item.ProductId || p.SKU === item.SKU);
        const supplier = suppliers.find((s) => s.SupplierId === product?.SupplierId);
        const stock = app.stock.totalStockBySku(item.SKU);
        const averageWeeklyDemand = app.help.avg(item.WeeklyDemand || [], (value) => value);
        const effectiveDailyDemand = (averageWeeklyDemand / 7) * Number(item.SeasonalityIndex || 1) * Number(item.PromoLift || 1);
        const projectedDemand = Math.round(effectiveDailyDemand * Number(item.HorizonDays || 21));
        const daysOfCover = effectiveDailyDemand > 0 ? stock / effectiveDailyDemand : 999;
        const stockoutDate = daysOfCover >= 999 ? null : app.help.addDays(app.help.todayDateOnly(), Math.floor(daysOfCover));
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
      }).sort((a, b) => app.help.compareValues(a.Risk, b.Risk) || app.help.compareValues(a.SKU, b.SKU));
    }
  };
}


// forecast page
{
function riskTone(risk) {
    if (risk === "Out of stock" || risk === "Critical") {
      return "red";
    }
    if (risk === "Watch") {
      return "amber";
    }
    return "green";
  }

  app.pages = app.pages || {};
  app.pages.forecast = {
    render(root) {
      const rows = app.forecast.getForecastRows();
      const riskRows = rows.filter((row) => row.Risk !== "Stable");
      const projected = app.help.sum(rows, (row) => row.ProjectedDemand);
      const demandChart = rows
        .slice()
        .sort((a, b) => b.ProjectedDemand - a.ProjectedDemand)
        .slice(0, 8)
        .map((row) => ({ label: row.SKU, value: row.ProjectedDemand, displayValue: app.fmt.number(row.ProjectedDemand) }));
      const selected = rows[0];

      root.innerHTML = `
        <div class="page-stack">
          <section class="grid grid-4">
            ${app.parts.metric("Forecast SKUs", app.fmt.number(rows.length), "Forecast records loaded", "Rows")}
            ${app.parts.metric("Projected demand", app.fmt.number(projected), "Units in configured horizons", "Demand")}
            ${app.parts.metric("At-risk SKUs", app.fmt.number(riskRows.length), "Critical, watch, or out of stock", "Risk")}
            ${app.parts.metric("Avg confidence", app.fmt.percent(app.help.avg(rows, (row) => row.Confidence)), "Forecast confidence score", "Score")}
          </section>
          <section class="grid grid-2">
            <article class="panel chart-card">
              <h2 class="section-title">Projected Demand</h2>
              <p class="section-copy">Average weekly demand / 7 x horizon x seasonality x promo lift.</p>
              ${app.chart.bar(demandChart, { label: "Projected demand by SKU" })}
            </article>
            <article class="panel chart-card">
              <h2 class="section-title">Demand Trend</h2>
              <p class="section-copy">${selected ? app.help.escapeHtml(selected.SKU) : "No forecast"} weekly movement from the JSON forecast dataset.</p>
              ${selected ? app.chart.sparkline(selected.WeeklyDemand, { label: `${selected.SKU} weekly trend` }) : ""}
            </article>
          </section>
          <div data-forecast-table></div>
        </div>
      `;

      root.querySelector("[data-forecast-table]").appendChild(app.tables.create({
        title: "Forecast Workbench",
        exportName: "forecast",
        data: rows,
        searchKeys: ["SKU", "ProductName", "Category", "Risk"],
        columns: [
          { key: "SKU", label: "SKU" },
          { key: "ProductName", label: "Product" },
          { key: "Category", label: "Category" },
          { key: "StockOnHand", label: "Stock" },
          { key: "AverageWeeklyDemand", label: "Avg Week", render: (row) => row.AverageWeeklyDemand.toFixed(1) },
          { key: "ProjectedDemand", label: "Projected" },
          { key: "DaysOfCover", label: "Cover Days", render: (row) => Number(row.DaysOfCover).toFixed(1) },
          { key: "StockoutDate", label: "Stockout", render: (row) => row.StockoutDate ? app.fmt.date(row.StockoutDate) : "-" },
          { key: "LeadTimeDays", label: "Lead" },
          { key: "Risk", label: "Risk", render: (row) => app.help.renderBadge(row.Risk, riskTone(row.Risk)) },
          { key: "Confidence", label: "Confidence", render: (row) => app.fmt.percent(row.Confidence) }
        ],
        actions: [
          {
            label: "Trend",
            handler: (row) => {
              app.popup.open({
                title: `${row.SKU} weekly demand`,
                content: `
                  <div class="panel chart-card" style="box-shadow:none">
                    ${app.chart.sparkline(row.WeeklyDemand, { label: `${row.SKU} weekly demand` })}
                    <div class="summary-list">
                      <div class="summary-row"><span>Seasonality index</span><strong>${row.SeasonalityIndex}</strong></div>
                      <div class="summary-row"><span>Promo lift</span><strong>${row.PromoLift}</strong></div>
                      <div class="summary-row"><span>Effective daily demand</span><strong>${row.EffectiveDailyDemand.toFixed(2)}</strong></div>
                    </div>
                  </div>
                `
              });
            }
          }
        ]
      }));
    }
  };
}


