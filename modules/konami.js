const sequence = [
  "ArrowUp",
  "ArrowUp",
  "ArrowDown",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "ArrowLeft",
  "ArrowRight",
  "KeyB",
  "KeyA",
];

let ptr = 0;

window.addEventListener("keydown", (e) => {
  if (e.code === sequence[ptr]) {
    ptr++;
    if (ptr === sequence.length) {
      const ev = new CustomEvent("konami-code");
      window.dispatchEvent(ev);
    }
  } else {
    ptr = 0;
  }
});
