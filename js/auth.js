/* Login and logout logic. */

// login code
{
app.auth = {
    login(username, password) {
      const normalized = String(username || "").trim().toLowerCase();
      const user = app.data.get("users").find((item) =>
        String(item.Username).toLowerCase() === normalized &&
        item.Password === password &&
        item.IsActive
      );

      if (!user) {
        throw new Error("Invalid credentials or inactive user.");
      }

      app.data.setUser(user);
      app.logs.log(user, "Login", "User", user.UserId, "User signed in.");
      return user;
    },

    logout() {
      app.data.setUser(null);
      app.screens.renderLogin();
    }
  };
}


