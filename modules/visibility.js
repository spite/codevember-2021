let hidden, visibilityChange;
if (typeof document.hidden !== "undefined") {
  // Opera 12.10 and Firefox 18 and later support
  hidden = "hidden";
  visibilityChange = "visibilitychange";
} else if (typeof document.msHidden !== "undefined") {
  hidden = "msHidden";
  visibilityChange = "msvisibilitychange";
} else if (typeof document.webkitHidden !== "undefined") {
  hidden = "webkitHidden";
  visibilityChange = "webkitvisibilitychange";
}

const callbacks = [];

function handleVisibilityChange() {
  for (const cb of callbacks) {
    cb(document[hidden]);
  }
}

let setup = false;
function setupListener() {
  if (setup) {
    return;
  }
  setup = true;
  document.addEventListener(visibilityChange, handleVisibilityChange, false);
}

function onVisibilityChange(fn) {
  callbacks.push(fn);
  setupListener();
}
export { onVisibilityChange };
