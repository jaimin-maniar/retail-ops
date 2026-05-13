/* Reusable table UI with search, sort, paging, and export. */

// table maker
{
function getCellValue(row, column) {
    if (typeof column.value === "function") {
      return column.value(row);
    }
    return row[column.key];
  }

  function getSearchValue(row, key, columns) {
    if (typeof key === "function") {
      return key(row);
    }
    const column = columns.find((item) => item.key === key);
    if (column && typeof column.value === "function") {
      return column.value(row);
    }
    return row[key];
  }

  function actionLabel(action, row) {
    return typeof action.label === "function" ? action.label(row) : action.label;
  }

  function actionVisible(action, row) {
    return typeof action.visible === "function" ? action.visible(row) : action.visible !== false;
  }

  app.tables = {
    create(options) {
      const config = options || {};
      const container = document.createElement("section");
      container.className = "table-shell";

      let rows = config.data || [];
      let query = String(config.initialQuery || "");
      let page = 1;
      let sortKey = config.defaultSort || null;
      let sortDirection = "asc";
      const pageSize = config.pageSize || 8;
      const columns = config.columns || [];

      function filteredRows() {
        const normalized = app.help.normalizeText(query);
        let result = rows.filter((row) => {
          if (!normalized) {
            return true;
          }
          const configuredKeys = config.searchKeys || [];
          const keys = Array.from(new Set([...configuredKeys, ...columns.map((column) => column.key)]));
          return keys.some((key) => app.help.normalizeText(getSearchValue(row, key, columns)).includes(normalized));
        });

        if (sortKey) {
          const column = columns.find((item) => item.key === sortKey);
          if (column) {
            result = result.slice().sort((a, b) => {
              const compared = app.help.compareValues(getCellValue(a, column), getCellValue(b, column));
              return sortDirection === "asc" ? compared : compared * -1;
            });
          }
        }

        return result;
      }

      container.innerHTML = `
        <div class="table-toolbar">
          <div class="table-tools" data-table-title></div>
          <div class="table-tools table-tools-search">
            <div data-table-search-slot></div>
            <button class="btn btn-secondary" type="button" data-export>Export CSV</button>
          </div>
        </div>
        <div class="table-wrap">
          <table class="data-table">
            <thead>
              <tr>
                ${columns.map((column) => `
                  <th class="${column.sortable === false ? "" : "sortable"}" data-sort="${app.help.escapeHtml(column.key)}" scope="col">
                    ${app.help.escapeHtml(column.label)}
                  </th>
                `).join("")}
                ${config.actions ? "<th scope=\"col\">Actions</th>" : ""}
              </tr>
            </thead>
            <tbody></tbody>
          </table>
        </div>
        <div class="table-footer">
          <span data-record-count>0 records</span>
          <div class="pagination">
            <button class="btn btn-secondary" type="button" data-prev>Previous</button>
            <span data-page-status>Page 1 of 1</span>
            <button class="btn btn-secondary" type="button" data-next>Next</button>
          </div>
        </div>
      `;

      const title = container.querySelector("[data-table-title]");
      title.innerHTML = config.title ? `<strong>${app.help.escapeHtml(config.title)}</strong>` : "<span></span>";

      const tbody = container.querySelector("tbody");
      const recordCount = container.querySelector("[data-record-count]");
      const pageStatus = container.querySelector("[data-page-status]");
      const previous = container.querySelector("[data-prev]");
      const next = container.querySelector("[data-next]");
      const exportButton = container.querySelector("[data-export]");
      const searchSlot = container.querySelector("[data-table-search-slot]");

      const search = app.searchBox.create({
        label: `${config.title || "Table"} search`,
        placeholder: config.searchPlaceholder || "Search records",
        value: query,
        debounceMs: config.searchDebounceMs ?? 80,
        onChange(value) {
          query = value;
          page = 1;
          renderRows();
        }
      });
      searchSlot.appendChild(search.element);

      function renderHeaders() {
        container.querySelectorAll("[data-sort]").forEach((header) => {
          const active = sortKey === header.dataset.sort;
          header.classList.toggle("sorted", active);
          header.dataset.direction = active ? sortDirection : "";
          header.setAttribute("aria-sort", active ? (sortDirection === "asc" ? "ascending" : "descending") : "none");
        });
      }

      function renderRows() {
        const all = filteredRows();
        const pageCount = Math.max(1, Math.ceil(all.length / pageSize));
        page = Math.min(page, pageCount);
        const visible = all.slice((page - 1) * pageSize, page * pageSize);

        if (visible.length === 0) {
          const colspan = columns.length + (config.actions ? 1 : 0);
          tbody.innerHTML = `
            <tr>
              <td colspan="${colspan}">
                <div class="empty-state">
                  <div><strong>No records found</strong><span>${app.help.escapeHtml(config.emptyMessage || "Try adjusting the current filters.")}</span></div>
                </div>
              </td>
            </tr>
          `;
        } else {
          tbody.innerHTML = visible.map((row, index) => `
            <tr>
              ${columns.map((column) => {
                const value = getCellValue(row, column);
                const html = column.render ? column.render(row, value) : app.help.escapeHtml(value);
                return `<td>${html}</td>`;
              }).join("")}
              ${config.actions ? `<td><div class="toolbar-left">${config.actions.map((action, actionIndex) => ({ action, actionIndex }))
                .filter(({ action }) => actionVisible(action, row))
                .map(({ action, actionIndex }) => `
                <button class="${app.help.escapeHtml(action.className || "btn btn-secondary")}" type="button" data-action="${actionIndex}" data-index="${index}">${app.help.escapeHtml(actionLabel(action, row))}</button>
              `).join("") || `<span class="table-muted">-</span>`}</div></td>` : ""}
            </tr>
          `).join("");
        }

        if (config.actions) {
          tbody.querySelectorAll("[data-action]").forEach((button) => {
            button.addEventListener("click", () => {
              const row = visible[Number(button.dataset.index)];
              config.actions[Number(button.dataset.action)].handler(row);
            });
          });
        }

        recordCount.textContent = `${all.length} records`;
        pageStatus.textContent = `Page ${page} of ${pageCount}`;
        previous.disabled = page <= 1;
        next.disabled = page >= pageCount;
        renderHeaders();
      }

      container.querySelectorAll("[data-sort]").forEach((header) => {
        header.addEventListener("click", () => {
          const column = columns.find((item) => item.key === header.dataset.sort);
          if (column && column.sortable === false) {
            return;
          }
          if (sortKey === header.dataset.sort) {
            sortDirection = sortDirection === "asc" ? "desc" : "asc";
          } else {
            sortKey = header.dataset.sort;
            sortDirection = "asc";
          }
          page = 1;
          renderRows();
        });
      });

      previous.addEventListener("click", () => {
        page -= 1;
        renderRows();
      });

      next.addEventListener("click", () => {
        page += 1;
        renderRows();
      });

      exportButton.addEventListener("click", () => {
        const csv = app.help.toCsv(filteredRows(), columns);
        app.help.downloadFile(`${config.exportName || "retailops-export"}.csv`, csv, "text/csv;charset=utf-8");
      });

      renderRows();
      return container;
    }
  };
}



