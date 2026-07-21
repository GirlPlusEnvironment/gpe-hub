(function () {
  function cssEscape(value) {
    if (window.CSS && typeof window.CSS.escape === "function") return window.CSS.escape(value);
    return String(value).replace(/["\\]/g, "\\$&");
  }

  function controlsFor(input, root) {
    if (!input.name) return [input];
    const form = input.form || root;
    return Array.from(form.querySelectorAll('input[name="' + cssEscape(input.name) + '"]'));
  }

  function updateGroup(input, root) {
    controlsFor(input, root).forEach(function (control) {
      const label = control.closest("label");
      if (!label) return;
      label.classList.toggle("is-selected", control.checked);
      label.setAttribute("aria-checked", String(control.checked));
      if (control.type === "radio") label.setAttribute("role", "radio");
      if (control.type === "checkbox") label.setAttribute("role", "checkbox");
    });
  }

  function initializeChoiceControls(root) {
    const scope = root || document;
    scope.querySelectorAll('input[type="radio"], input[type="checkbox"]').forEach(function (input) {
      if (input.dataset.gpeChoiceInitialized === "true") return;
      input.dataset.gpeChoiceInitialized = "true";
      input.addEventListener("change", function () {
        updateGroup(input, scope);
      });
      updateGroup(input, scope);
    });
  }

  window.GPEChoiceControls = {
    initialize: initializeChoiceControls,
    update: updateGroup
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () { initializeChoiceControls(document); });
  } else {
    initializeChoiceControls(document);
  }
})();
