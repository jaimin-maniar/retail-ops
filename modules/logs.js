(function (app) {
  app.pages = app.pages || {};
  app.pages.logs = {
    render(root) {
      const logs = app.auditService.getRecent(200);
      const actions = app.helpers.groupBy(logs, (log) => log.Action);
      const actionChart = Object.entries(actions)
        .map(([label, rows]) => ({ label, value: rows.length, displayValue: app.format.number(rows.length) }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 8);

      root.innerHTML = `
        <div class="page-stack">
          <section class="grid grid-4">
            ${app.shared.metric("Audit events", app.format.number(logs.length), "Recent browser-local events", "Trace")}
            ${app.shared.metric("Users", app.format.number(app.helpers.unique(logs.map((log) => log.Username)).length), "Actors in log history", "Access")}
            ${app.shared.metric("Entities", app.format.number(app.helpers.unique(logs.map((log) => log.EntityName)).length), "Touched business objects", "Audit")}
            ${app.shared.metric("Latest event", logs[0] ? app.format.date(logs[0].CreatedAt) : "-", "Most recent activity", "Now")}
          </section>
          <section class="panel chart-card">
            <h2 class="section-title">Activity by Action</h2>
            ${app.charts.bar(actionChart, { label: "Activity by action" })}
          </section>
          <div data-logs-table></div>
        </div>
      `;

      root.querySelector("[data-logs-table]").appendChild(app.table.create({
        title: "Activity Log",
        exportName: "activity-log",
        data: logs,
        searchKeys: ["AuditLogId", "Username", "Action", "EntityName", "EntityId", "Details"],
        columns: [
          { key: "CreatedAt", label: "Time", render: (row) => app.format.dateTime(row.CreatedAt) },
          { key: "Username", label: "User" },
          { key: "Action", label: "Action" },
          { key: "EntityName", label: "Entity" },
          { key: "EntityId", label: "Entity ID" },
          { key: "Details", label: "Details" }
        ]
      }));
    }
  };
})(window.RetailOps = window.RetailOps || {});
