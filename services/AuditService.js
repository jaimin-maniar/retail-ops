(function (app) {
  app.auditService = {
    log(user, action, entityName, entityId, details) {
      app.store.update("activityLogs", (logs) => {
        const next = logs || [];
        next.push({
          AuditLogId: app.helpers.nextId(next, "AuditLogId", "AUD", 5),
          UserId: user?.UserId || "",
          Username: user?.Username || "System",
          Action: action,
          EntityName: entityName,
          EntityId: entityId,
          Details: details,
          CreatedAt: app.helpers.nowIso()
        });
        return next;
      });
    },

    getRecent(count) {
      return app.store.get("activityLogs")
        .sort((a, b) => new Date(b.CreatedAt) - new Date(a.CreatedAt))
        .slice(0, count || 50);
    }
  };
})(window.RetailOps = window.RetailOps || {});
