import { Vector2, Vector3 } from "../third_party/three.module.js";
import { clamp } from "../modules/Maf.js";
import { SpringSystem } from "./SpringSystem.js";

const canvas = document.createElement("canvas");
document.body.append(canvas);

const ctx = canvas.getContext("2d");

const springSystem = new SpringSystem();

function init() {
  const width = 10;
  const height = 10;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      springSystem.addNode((x - 0.5 * width) * 50, (y - 0.5 * height) * 50);
    }
  }
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (y < height - 1) {
        springSystem.connect(
          springSystem.nodes[y * width + x],
          springSystem.nodes[(y + 1) * width + x],
          1
        );
      }
      if (x < width - 1) {
        springSystem.connect(
          springSystem.nodes[y * width + x],
          springSystem.nodes[y * width + x + 1],
          1
        );
      }

      if (y < height - 1 && x < width - 1) {
        springSystem.connect(
          springSystem.nodes[y * width + x],
          springSystem.nodes[(y + 1) * width + x + 1],
          1
        );
        springSystem.connect(
          springSystem.nodes[y * width + x + 1],
          springSystem.nodes[(y + 1) * width + x],
          1
        );
      }
    }
  }
}

const position = { x: 0, y: 0 };
window.addEventListener("pointermove", (e) => {
  const x = e.pageX - 0.5 * canvas.width;
  const y = e.pageY - 0.5 * canvas.height;
  position.x = x;
  position.y = y;

  if (dragging) {
    selectedNode.position.x = position.x;
    selectedNode.position.y = position.y;
  } else {
    onMove();
  }
});

let dragging = false;
window.addEventListener("pointerdown", (e) => {
  if (selectedNode) {
    dragging = true;
  }
});

window.addEventListener("pointerup", (e) => {
  dragging = false;
});

window.addEventListener("click", (e) => {
  if (!selectedNode) {
    const x = e.pageX - 0.5 * canvas.width;
    const y = e.pageY - 0.5 * canvas.height;
    for (const node of springSystem.nodes) {
      node.addImpulse(x, y, 0);
    }
  }
});

let selectedNode = null;
function onMove() {
  if (selectedNode) {
    selectedNode.selected = false;
  }
  selectedNode = null;
  for (const node of springSystem.nodes) {
    if (node.hitTest(position.x, position.y)) {
      selectedNode = node;
      selectedNode.selected = true;
    }
  }
}

init();

function render() {
  springSystem.update(10 / 60);

  ctx.fillStyle = "white";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.translate(0.5 * canvas.width, 0.5 * canvas.height);

  ctx.strokeStyle = "green";
  ctx.lineWidth = 4;
  for (let spring of springSystem.springs) {
    ctx.beginPath();
    ctx.moveTo(spring.a.position.x, spring.a.position.y);
    ctx.lineTo(spring.b.position.x, spring.b.position.y);
    ctx.stroke();
  }

  for (let node of springSystem.nodes) {
    ctx.fillStyle = node.selected ? "red" : "green";
    ctx.beginPath();
    ctx.arc(node.position.x, node.position.y, 8, 0, 2 * Math.PI);
    ctx.fill();
  }
  ctx.restore();
  requestAnimationFrame(render);
}

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}

window.addEventListener("resize", resize);

resize();
render();
