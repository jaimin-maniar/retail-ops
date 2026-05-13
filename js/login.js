/* Login page form handling. */

{
  const form = document.getElementById("loginForm");
  const message = document.getElementById("message");

  function showMessage(text, success) {
    message.textContent = text;
    message.className = success ? "message success" : "message";
  }

  if (!window.RetailOpsAuth) {
    showMessage("Authentication file did not load. Please refresh the page.", false);
  } else if (window.RetailOpsAuth.getLoggedInUser()) {
    window.location.href = "dashboard.html";
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();

    if (!window.RetailOpsAuth) {
      showMessage("Authentication file did not load. Please refresh the page.", false);
      return;
    }

    try {
      const user = window.RetailOpsAuth.login(
        document.getElementById("email").value,
        document.getElementById("password").value,
        document.getElementById("storeId").value,
        document.getElementById("otp").value
      );

      showMessage(`Welcome ${user.FullName}. Opening your store dashboard...`, true);
      window.setTimeout(() => {
        window.location.href = "dashboard.html";
      }, 500);
    } catch (error) {
      showMessage(error.message, false);
    }
  });
}
