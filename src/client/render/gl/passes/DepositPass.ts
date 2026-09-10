/**
 * DepositPass — renders resource deposit markers (oil derricks / ore) as
 * small glowing discs over the terrain. Static data: set once at game
 * start via setDepositData(); deposits never change during a match.
 *
 * One instanced draw call. Oil = amber, Ore = cyan.
 */

import { createProgram, shaderSrc } from "../utils/GlUtils";

import fragSrc from "../shaders/deposit/deposit.frag.glsl?raw";
import vertSrc from "../shaders/deposit/deposit.vert.glsl?raw";

// Per-instance: x, y, type (1 = oil, 2 = ore)
const FLOATS_PER_INSTANCE = 3;

export class DepositPass {
  private gl: WebGL2RenderingContext;
  private program: WebGLProgram;
  private vao: WebGLVertexArrayObject;
  private instanceBuf: WebGLBuffer;

  private uCamera: WebGLUniformLocation;
  private instanceCount = 0;

  constructor(
    gl: WebGL2RenderingContext,
    private mapW: number,
  ) {
    this.gl = gl;
    this.program = createProgram(gl, vertSrc, shaderSrc(fragSrc, {}));
    this.uCamera = gl.getUniformLocation(this.program, "uCamera")!;

    this.vao = gl.createVertexArray()!;
    gl.bindVertexArray(this.vao);

    // Unit quad [-0.5, 0.5]
    const quadBuf = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([
        -0.5, -0.5, 0.5, -0.5, -0.5, 0.5, 0.5, -0.5, 0.5, 0.5, -0.5, 0.5,
      ]),
      gl.STATIC_DRAW,
    );
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    this.instanceBuf = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.instanceBuf);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(
      1,
      FLOATS_PER_INSTANCE,
      gl.FLOAT,
      false,
      FLOATS_PER_INSTANCE * 4,
      0,
    );
    gl.vertexAttribDivisor(1, 1);
    gl.bindVertexArray(null);
  }

  /** Deposit buffer: per-tile 0/1/2. Called once at game start. */
  setDepositData(deposits: Uint8Array): void {
    const verts: number[] = [];
    for (let i = 0; i < deposits.length; i++) {
      const t = deposits[i];
      if (t === 0) continue;
      const x = i % this.mapW;
      const y = (i - x) / this.mapW;
      verts.push(x, y, t);
    }
    this.instanceCount = verts.length / FLOATS_PER_INSTANCE;
    const gl = this.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.instanceBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(verts), gl.STATIC_DRAW);
  }

  draw(cameraMatrix: Float32Array, zoom: number): void {
    if (this.instanceCount === 0) return;
    const gl = this.gl;
    gl.useProgram(this.program);
    gl.uniformMatrix3fv(this.uCamera, false, cameraMatrix);
    gl.bindVertexArray(this.vao);
    gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, this.instanceCount);
  }

  dispose(): void {
    const gl = this.gl;
    gl.deleteProgram(this.program);
    gl.deleteVertexArray(this.vao);
    gl.deleteBuffer(this.instanceBuf);
  }
}
