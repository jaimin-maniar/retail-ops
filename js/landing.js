/* Small landing page behavior. */

{
  const user = window.RetailOpsAuth.getLoggedInUser();
  const loginButtons = document.querySelectorAll('a[href="login.html"]');

  if (user) {
    loginButtons.forEach((button) => {
      button.textContent = "Open Dashboard";
      button.href = "dashboard.html";
    });
  }
}
