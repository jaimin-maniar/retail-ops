(function (app) {
  app.charts = {
    bar(items, options) {
      const config = options || {};
      const max = Math.max(1, ...items.map((item) => Number(item.value || 0)));
      return `
        <div class="bar-chart" role="img" aria-label="${app.helpers.escapeHtml(config.label || "Bar chart")}">
          ${items.map((item) => {
            const value = Number(item.value || 0);
            const width = Math.max(3, (value / max) * 100);
            return `
              <div class="bar-row">
                <span class="bar-label">${app.helpers.escapeHtml(item.label)}</span>
                <span class="bar-track"><span class="bar-fill" style="width:${width}%"></span></span>
                <span class="bar-value">${app.helpers.escapeHtml(item.displayValue ?? value)}</span>
              </div>
            `;
          }).join("")}
        </div>
      `;
    },

    donut(value, label) {
      const safeValue = Math.max(0, Math.min(100, Number(value || 0)));
      return `
        <div class="donut" style="--value:${safeValue}">
          <strong>${Math.round(safeValue)}%</strong>
        </div>
        <div class="section-copy">${app.helpers.escapeHtml(label || "")}</div>
      `;
    },

    sparkline(values, options) {
      const config = options || {};
      const nums = (values || []).map(Number);
      const width = 520;
      const height = 100;
      const max = Math.max(1, ...nums);
      const min = Math.min(...nums, 0);
      const range = Math.max(1, max - min);
      const points = nums.map((value, index) => {
        const x = nums.length <= 1 ? 0 : (index / (nums.length - 1)) * width;
        const y = height - ((value - min) / range) * (height - 14) - 7;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      }).join(" ");

      return `
        <svg class="sparkline" viewBox="0 0 ${width} ${height}" role="img" aria-label="${app.helpers.escapeHtml(config.label || "Trend chart")}">
          <polyline fill="none" stroke="#0f62fe" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" points="${points}"></polyline>
          ${nums.map((value, index) => {
            const x = nums.length <= 1 ? 0 : (index / (nums.length - 1)) * width;
            const y = height - ((value - min) / range) * (height - 14) - 7;
            return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="4" fill="#0f62fe"></circle>`;
          }).join("")}
        </svg>
      `;
    }
  };
})(window.RetailOps = window.RetailOps || {});
