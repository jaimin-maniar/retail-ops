(function (app) {
  function getCellValue(row, column) {
    if (typeof column.value === "function") {
      return column.value(row);
    }
    return row[column.key];
  }

  app.table = {
    create(options) {
      const config = options || {};
      const container = document.createElement("section");
      container.className = "table-shell";

      let rows = config.data || [];
      let query = "";
      let page = 1;
      let sortKey = config.defaultSort || null;
      let sortDirection = "asc";
      const pageSize = config.pageSize || 8;

      function filteredRows() {
        const normalized = app.helpers.normalizeText(query);
        let result = rows.filter((row) => {
          if (!normalized) {
            return true;
          }
          const keys = config.searchKeys || config.columns.map((column) => column.key);
          return keys.some((key) => app.helpers.normalizeText(row[key]).includes(normalized));
        });

        if (sortKey) {
          const column = config.columns.find((item) => item.key === sortKey);
          result = result.slice().sort((a, b) => {
            const compared = app.helpers.compareValues(getCellValue(a, column), getCellValue(b, column));
            return sortDirection === "asc" ? compared : compared * -1;
          });
        }

        return result;
      }

      function render() {
        const all = filteredRows();
        const pageCount = Math.max(1, Math.ceil(all.length / pageSize));
        page = Math.min(page, pageCount);
        const visible = all.slice((page - 1) * pageSize, page * pageSize);
        const title = config.title ? `<strong>${app.helpers.escapeHtml(config.title)}</strong>` : "<span></span>";

        container.innerHTML = `
          <div class="table-toolbar">
            <div class="table-tools">${title}</div>
            <div class="table-tools">
              <input class="input" type="search" data-table-search placeholder="${app.helpers.escapeHtml(config.searchPlaceholder || "Search")}">
              <button class="btn btn-secondary" type="button" data-export>Export CSV</button>
            </div>
          </div>
          <div class="table-wrap">
            <table class="data-table">
              <thead>
                <tr>
                  ${config.columns.map((column) => `
                    <th class="${column.sortable === false ? "" : "sortable"}" data-sort="${column.key}">
                      ${app.helpers.escapeHtml(column.label)}
                    </th>
                  `).join("")}
                  ${config.actions ? "<th>Actions</th>" : ""}
                </tr>
              </thead>
              <tbody></tbody>
            </table>
          </div>
          <div class="table-footer">
            <span>${app.helpers.escapeHtml(String(all.length))} records</span>
            <div class="pagination">
              <button class="btn btn-secondary" type="button" data-prev>Previous</button>
              <span>Page ${page} of ${pageCount}</span>
              <button class="btn btn-secondary" type="button" data-next>Next</button>
            </div>
          </div>
        `;

        const search = container.querySelector("[data-table-search]");
        search.value = query;
        search.addEventListener("input", app.helpers.debounce((event) => {
          query = event.target.value;
          page = 1;
          render();
        }, 120));

        const tbody = container.querySelector("tbody");
        if (visible.length === 0) {
          const colspan = config.columns.length + (config.actions ? 1 : 0);
          tbody.innerHTML = `
            <tr>
              <td colspan="${colspan}">
                <div class="empty-state">
                  <div><strong>No records found</strong><span>${app.helpers.escapeHtml(config.emptyMessage || "Try adjusting the current filters.")}</span></div>
                </div>
              </td>
            </tr>
          `;
        } else {
          tbody.innerHTML = visible.map((row, index) => `
            <tr>
              ${config.columns.map((column) => {
                const value = getCellValue(row, column);
                const html = column.render ? column.render(row, value) : app.helpers.escapeHtml(value);
                return `<td>${html}</td>`;
              }).join("")}
              ${config.actions ? `<td><div class="toolbar-left">${config.actions.map((action, actionIndex) => `
                <button class="btn btn-secondary" type="button" data-action="${actionIndex}" data-index="${index}">${app.helpers.escapeHtml(action.label)}</button>
              `).join("")}</div></td>` : ""}
            </tr>
          `).join("");
        }

        container.querySelectorAll("[data-sort]").forEach((header) => {
          header.addEventListener("click", () => {
            const column = config.columns.find((item) => item.key === header.dataset.sort);
            if (column && column.sortable === false) {
              return;
            }
            if (sortKey === header.dataset.sort) {
              sortDirection = sortDirection === "asc" ? "desc" : "asc";
            } else {
              sortKey = header.dataset.sort;
              sortDirection = "asc";
            }
            render();
          });
        });

        if (config.actions) {
          container.querySelectorAll("[data-action]").forEach((button) => {
            button.addEventListener("click", () => {
              const row = visible[Number(button.dataset.index)];
              config.actions[Number(button.dataset.action)].handler(row);
            });
          });
        }

        container.querySelector("[data-prev]").disabled = page <= 1;
        container.querySelector("[data-next]").disabled = page >= pageCount;
        container.querySelector("[data-prev]").addEventListener("click", () => {
          page -= 1;
          render();
        });
        container.querySelector("[data-next]").addEventListener("click", () => {
          page += 1;
          render();
        });
        container.querySelector("[data-export]").addEventListener("click", () => {
          const csv = app.helpers.toCsv(all, config.columns);
          app.helpers.downloadFile(`${config.exportName || "retailops-export"}.csv`, csv, "text/csv;charset=utf-8");
        });
      }

      render();
      return container;
    }
  };
})(window.RetailOps = window.RetailOps || {});
