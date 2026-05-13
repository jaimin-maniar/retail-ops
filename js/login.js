/* Login page form handling. */

{
  const form = document.getElementById("loginForm");
  const message = document.getElementById("message");

  if (window.RetailOpsAuth.getLoggedInUser()) {
    window.location.href = "dashboard.html";
  }

  function showMessage(text, success) {
    message.textContent = text;
    message.className = success ? "message success" : "message";
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();

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
