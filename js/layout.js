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
            <div class="user-role">${app.help.escapeHtml(user.StoreId || "")}</div>
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
      window.location.href = "login.html";
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



