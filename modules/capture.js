import { timewarp } from "../ccapture2/timewarp.js";
import { CCapture } from "../ccapture2/ccapture.js";

const capturer = new CCapture({
  format: "webm",
  quality: 1,
  timewarp: window.timewarp,
  timeLimit: 30,
});

async function start() {
  await capturer.start();
  return capturer;
}

async function capture(canvas) {
  await capturer.capture(canvas);
  capturer.step();
}

window.capturer = capturer;

export { start, capture };
