#version 300 es
precision highp float;

uniform mat3 uCamera;

layout(location = 0) in vec2 aLocal;
layout(location = 1) in vec3 aInstance; // x, y, type (1=oil, 2=ore)

out vec2 vLocal;
flat out float vType;

void main() {
  vLocal = aLocal;
  vType = aInstance.z;
  // 3-tile-wide marker
  vec2 world = aInstance.xy + 0.5 + aLocal * 3.0;
  vec3 clip = uCamera * vec3(world, 1.0);
  gl_Position = vec4(clip.xy, 0.0, 1.0);
}
