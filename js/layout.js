/* Login screen and app shell layout. */

// login and page layout
{
let detachShellEvents = null;

  function allowedRoutes(user) {
    return app.setup.routes.filter((route) =>
      app.nav.hasAccess(route, user),
    );
  }

  function sidebar(user, currentRoute) {
    const groups = app.help.groupBy(
      allowedRoutes(user),
      (route) => route.section,
    );
    return `
      <aside class="sidebar" id="primary-sidebar" data-sidebar>
        <div class="brand">
          <div class="logo-box">R</div>
          <div>
            <span class="brand-title">RetailOps</span>
            <span class="brand-subtitle">Store project</span>
          </div>
        </div>
        <nav class="nav" aria-label="Primary navigation">
          ${Object.entries(groups)
            .map(
              ([section, routes]) => `
            <div class="nav-section-label">${app.help.escapeHtml(section)}</div>
            ${routes
              .map(
                (route) => `
              <a class="nav-link ${route.id === currentRoute.id ? "active" : ""}" href="${route.path}" title="${app.help.escapeHtml(route.title)}" data-nav-link>
                <span class="nav-icon">${app.help.escapeHtml(route.icon)}</span>
                <span>${app.help.escapeHtml(route.title)}</span>
              </a>
            `,
              )
              .join("")}
          `,
            )
            .join("")}
        </nav>
        <div class="sidebar-footer">
          <div class="user-card">
            <div class="user-name">${app.help.escapeHtml(user.Username)}</div>
            <div class="user-role">${app.help.escapeHtml(user.Role)}</div>
          </div>
        </div>
      </aside>
    `;
  }

  function attachShellEvents() {
    if (detachShellEvents) {
      detachShellEvents();
    }

    const subscriptions = [];
    const listen = (target, event, handler) => {
      if (!target) {
        return;
      }
      target.addEventListener(event, handler);
      subscriptions.push(() => target.removeEventListener(event, handler));
    };

    const logout = document.querySelector("[data-logout]");
    if (logout) {
      listen(logout, "click", () => {
        app.auth.logout();
        app.toast.success("Signed out successfully.");
      });
    }

    detachShellEvents = () => {
      subscriptions.forEach((unsubscribe) => unsubscribe());
      detachShellEvents = null;
    };
  }

  app.screens = {
    renderLogin() {
      document.getElementById("app").innerHTML = `
        <main class="login-page">
          <section class="login-visual">
            <div>
              <p class="hero-eyebrow">Retail inventory project</p>
              <h1>Simple stock, billing, promotion, and report screens in one browser app.</h1>
            </div>
            <p>This version keeps the same calculations and saved data, but the code is kept in plain HTML, CSS, and JavaScript for the training assignment.</p>
            <div class="login-pattern" aria-hidden="true">
              ${Array.from({ length: 12 })
                .map(
                  (_, index) =>
                    `<div class="pattern-cell" style="opacity:${0.55 + (index % 4) * 0.1}"></div>`,
                )
                .join("")}
            </div>
          </section>
          <section class="login-panel">
            <div class="auth-card">
              <div class="logo-box big-logo">R</div>
              <h2>Sign in</h2>
              <p>Use one of the sample users to open the app.</p>
              <form data-login-form class="app-form">
                <div class="field">
                  <label for="username">Username</label>
                  <input class="input" id="username" name="username" autocomplete="username" required>
                </div>
                <div class="field" style="margin-top:12px">
                  <label for="password">Password</label>
                  <input class="input" id="password" name="password" type="password" autocomplete="current-password" required>
                </div>
                <button class="btn btn-primary" type="submit" style="width:100%; margin-top:16px">Sign in</button>
              </form>
              <div class="demo-users">
                ${app.data
                  .get("users")
                  .map(
                    (user) => `
                  <button class="demo-user" type="button" data-demo-user="${app.help.escapeHtml(user.Username)}" data-demo-password="${app.help.escapeHtml(user.Password)}">
                    <span>${app.help.escapeHtml(user.Username)} / ${app.help.escapeHtml(user.Password)}</span>
                    <span>${app.help.escapeHtml(user.Role)}</span>
                  </button>
                `,
                  )
                  .join("")}
              </div>
            </div>
          </section>
        </main>
      `;

      const form = document.querySelector("[data-login-form]");
      form.addEventListener("submit", (event) => {
        event.preventDefault();
        const data = new FormData(form);
        try {
          app.auth.login(data.get("username"), data.get("password"));
          app.toast.success(`Welcome ${app.data.getUser().Username}.`);
          window.location.hash = "#/dashboard";
        } catch (error) {
          app.toast.error(error.message);
        }
      });

      document.querySelectorAll("[data-demo-user]").forEach((button) => {
        button.addEventListener("click", () => {
          form.username.value = button.dataset.demoUser;
          form.password.value = button.dataset.demoPassword;
          form.requestSubmit();
        });
      });
    },

    renderShell(route) {
      const user = app.data.getUser();
      const reportsRoute = app.setup.routes.find((item) => item.id === "reports");
      const canViewReports = reportsRoute && app.nav.hasAccess(reportsRoute, user);
      document.getElementById("app").innerHTML = `
        <div class="app-shell">
          ${sidebar(user, route)}
          <main class="main">
            <header class="topbar">
              <div>
                <div>
                  <h1 class="topbar-title">${app.help.escapeHtml(route.title)}</h1>
                  <div class="topbar-subtitle">${app.help.escapeHtml(route.subtitle)}</div>
                </div>
              </div>
              <div class="topbar-actions">
                ${canViewReports ? `<a class="btn btn-secondary" href="#/reports">Reports</a>` : ""}
                <button class="btn btn-ghost" type="button" data-logout>Logout</button>
              </div>
            </header>
            <section class="content">
              <div data-route-outlet></div>
            </section>
          </main>
        </div>
      `;
      attachShellEvents();
    },
  };
}



