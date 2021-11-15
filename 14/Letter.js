import { MarchingCubesGeometry } from "../third_party/MarchingCubesGeometry.js";

class Letter {
  constructor(fontFamily = "serif") {
    this.fontFamily = fontFamily;
    this.canvas = document.createElement("canvas");
    this.ctx = this.canvas.getContext("2d");

    // document.body.append(this.canvas);
    this.canvas.style.position = "fixed";
    this.canvas.width = 64;
    this.canvas.height = 64;

    this.mc = new MarchingCubesGeometry(64, false, false);
  }

  generate(letter) {
    this.ctx.fillStyle = "black";
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.save();
    this.ctx.fillStyle = "white";
    const size = 30;
    this.ctx.shadowColor = "white";
    this.ctx.shadowBlur = 5;
    this.ctx.font = `${size}px ${this.fontFamily}`;
    this.ctx.textBaseline = "middle";
    this.ctx.textAlign = "center";
    this.ctx.translate(0.5 * this.canvas.width, 0.5 * this.canvas.height);
    this.ctx.fillText(letter, 0, 0);
    this.ctx.restore();

    const data = this.ctx.getImageData(
      0,
      0,
      this.canvas.width,
      this.canvas.height
    );

    const mc = this.mc;

    mc.reset();
    const w = mc.resolution / 2;
    const h = 10;
    for (let z = 0; z < mc.resolution; z++) {
      for (let y = 0; y < mc.resolution; y++) {
        const cy = Math.floor((y * this.canvas.height) / mc.resolution);
        for (let x = 0; x < mc.resolution; x++) {
          const cx = Math.floor((x * this.canvas.width) / mc.resolution);
          const ptr = (cy * this.canvas.width + cx) * 4;
          const v = z > w - h && z < w + h ? (data.data[ptr] * 1) / 255 : 0;
          mc.setCell(x, mc.resolution - y, z, 2 * v - 1);
        }
      }
    }
    for (let i = 0; i < 4; i++) {
      mc.blur(1);
    }
    mc.invalidated = true;
    mc.build();
  }
}

export { Letter };
