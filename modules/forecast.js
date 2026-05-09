(function (app) {
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
      const rows = app.forecastService.getForecastRows();
      const riskRows = rows.filter((row) => row.Risk !== "Stable");
      const projected = app.helpers.sum(rows, (row) => row.ProjectedDemand);
      const demandChart = rows
        .slice()
        .sort((a, b) => b.ProjectedDemand - a.ProjectedDemand)
        .slice(0, 8)
        .map((row) => ({ label: row.SKU, value: row.ProjectedDemand, displayValue: app.format.number(row.ProjectedDemand) }));
      const selected = rows[0];

      root.innerHTML = `
        <div class="page-stack">
          <section class="grid grid-4">
            ${app.shared.metric("Forecast SKUs", app.format.number(rows.length), "Forecast records loaded", "Model")}
            ${app.shared.metric("Projected demand", app.format.number(projected), "Units in configured horizons", "Demand")}
            ${app.shared.metric("At-risk SKUs", app.format.number(riskRows.length), "Critical, watch, or out of stock", "Risk")}
            ${app.shared.metric("Avg confidence", app.format.percent(app.helpers.avg(rows, (row) => row.Confidence)), "Forecast confidence score", "Quality")}
          </section>
          <section class="grid grid-2">
            <article class="panel chart-card">
              <h2 class="section-title">Projected Demand</h2>
              <p class="section-copy">Average weekly demand / 7 x horizon x seasonality x promo lift.</p>
              ${app.charts.bar(demandChart, { label: "Projected demand by SKU" })}
            </article>
            <article class="panel chart-card">
              <h2 class="section-title">Demand Trend</h2>
              <p class="section-copy">${selected ? app.helpers.escapeHtml(selected.SKU) : "No forecast"} weekly movement from the JSON forecast dataset.</p>
              ${selected ? app.charts.sparkline(selected.WeeklyDemand, { label: `${selected.SKU} weekly trend` }) : ""}
            </article>
          </section>
          <div data-forecast-table></div>
        </div>
      `;

      root.querySelector("[data-forecast-table]").appendChild(app.table.create({
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
          { key: "StockoutDate", label: "Stockout", render: (row) => row.StockoutDate ? app.format.date(row.StockoutDate) : "-" },
          { key: "LeadTimeDays", label: "Lead" },
          { key: "Risk", label: "Risk", render: (row) => app.helpers.renderBadge(row.Risk, riskTone(row.Risk)) },
          { key: "Confidence", label: "Confidence", render: (row) => app.format.percent(row.Confidence) }
        ],
        actions: [
          {
            label: "Trend",
            handler: (row) => {
              app.modal.open({
                title: `${row.SKU} weekly demand`,
                content: `
                  <div class="panel chart-card" style="box-shadow:none">
                    ${app.charts.sparkline(row.WeeklyDemand, { label: `${row.SKU} weekly demand` })}
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
})(window.RetailOps = window.RetailOps || {});
