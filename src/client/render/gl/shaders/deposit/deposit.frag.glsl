#version 300 es
precision highp float;

in vec2 vLocal;
flat in float vType;
out vec4 fragColor;

void main() {
  float d = length(vLocal);
  float a = smoothstep(0.5, 0.2, d);
  vec3 color = vType < 1.5 ? vec3(1.0, 0.8, 0.15) : vec3(0.2, 0.8, 0.9);
  fragColor = vec4(color, a * 0.85);
}
