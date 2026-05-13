/* Activity log helpers. */

// activity log code
{
app.logs = {
    log(user, action, entityName, entityId, details) {
      app.data.update("activityLogs", (logs) => {
        const next = logs || [];
        next.push({
          AuditLogId: app.help.nextId(next, "AuditLogId", "AUD", 5),
          UserId: user?.UserId || "",
          Username: user?.Username || "System",
          Action: action,
          EntityName: entityName,
          EntityId: entityId,
          Details: details,
          CreatedAt: app.help.nowIso()
        });
        return next;
      });
    },

    getRecent(count) {
      return app.data.get("activityLogs")
        .sort((a, b) => new Date(b.CreatedAt) - new Date(a.CreatedAt))
        .slice(0, count || 50);
    }
  };
}



