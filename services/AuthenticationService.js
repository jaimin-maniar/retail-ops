(function (app) {
  app.auth = {
    login(username, password) {
      const normalized = String(username || "").trim().toLowerCase();
      const user = app.store.get("users").find((item) =>
        String(item.Username).toLowerCase() === normalized &&
        item.Password === password &&
        item.IsActive
      );

      if (!user) {
        throw new Error("Invalid credentials or inactive user.");
      }

      app.store.setUser(user);
      app.auditService.log(user, "Login", "User", user.UserId, "User signed in.");
      return user;
    },

    logout() {
      app.store.setUser(null);
      app.layout.renderLogin();
    }
  };
})(window.RetailOps = window.RetailOps || {});
