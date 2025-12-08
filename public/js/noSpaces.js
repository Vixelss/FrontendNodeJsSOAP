// public/js/noSpaces.js
document.addEventListener("DOMContentLoaded", () => {
  const inputsSinEspacios = document.querySelectorAll("input.no-space");

  inputsSinEspacios.forEach((input) => {
    // Quita cualquier espacio pegado (por copy/paste)
    const limpiar = () => {
      const original = input.value;
      const limpio = original.replace(/\s+/g, ""); // borra todos los espacios
      if (original !== limpio) {
        input.value = limpio;
      }
    };

    // Bloquear la tecla espacio
    input.addEventListener("keydown", (e) => {
      if (e.key === " ") {
        e.preventDefault();
      }
    });

    // Por si pegan texto con espacios
    input.addEventListener("input", limpiar);
  });
});
