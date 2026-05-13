/* Signup page form handling. */

{
  const form = document.getElementById("signupForm");
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
      const user = window.RetailOpsAuth.signup({
        fullName: document.getElementById("fullName").value,
        email: document.getElementById("email").value,
        password: document.getElementById("password").value,
        confirmPassword: document.getElementById("confirmPassword").value,
        storeId: document.getElementById("storeId").value,
        otp: document.getElementById("otp").value
      });

      showMessage(`Account created for ${user.StoreId}. Opening your dashboard...`, true);
      window.setTimeout(() => {
        window.location.href = "dashboard.html";
      }, 700);
    } catch (error) {
      showMessage(error.message, false);
    }
  });
}
