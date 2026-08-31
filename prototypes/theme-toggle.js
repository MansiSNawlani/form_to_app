// Mockup-only. In the real app the theme is a KERN-themed token switch with a
// stored user preference; here it just proves both token sets in theme.css hold up.
(function () {
  var root = document.documentElement;
  var stored = localStorage.getItem("ffs-prototype-theme");
  if (stored) {
    root.setAttribute("data-theme", stored);
  }

  function label(btn) {
    var dark = root.getAttribute("data-theme") === "dark";
    btn.textContent = dark ? "Helles Design" : "Dunkles Design";
    btn.setAttribute("aria-pressed", String(dark));
  }

  document.querySelectorAll("[data-theme-toggle]").forEach(function (btn) {
    label(btn);
    btn.addEventListener("click", function () {
      var next = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
      root.setAttribute("data-theme", next);
      localStorage.setItem("ffs-prototype-theme", next);
      document.querySelectorAll("[data-theme-toggle]").forEach(label);
    });
  });
})();
