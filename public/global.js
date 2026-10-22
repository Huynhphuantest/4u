document.fonts.load('16px "Material Symbols Outlined"').then(() => {
  document.documentElement.classList.add('fonts-loaded');
});

const buttons = document.querySelectorAll(".button-group button");

buttons.forEach(button => {
  button.addEventListener("click", () => {
    const wasActive = button.classList.contains("active");

    buttons.forEach(btn => btn.classList.remove("active"));

    if (!wasActive) {
      button.classList.add("active");
    }

    button.parentElement.dispatchEvent(new CustomEvent("change", {
      bubbles: true,
    }));
  });
});