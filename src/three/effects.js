/**
 * 特效
 * ---------------------------------------------------------------
 * 环境浮尘 / 中心能量核 / 抽中光柱 / 蒸汽 / 中奖粒子爆发。
 * 粒子用一套极简的 ShaderMaterial（带逐粒子尺寸与透明度），
 * 加色混合，吃 Bloom。
 */

import * as THREE from 'three';
import { glowTexture, haloTexture } from './textures.js';
import { accentGlow } from './materials.js';
import { mesh, group, mulberry32 } from './geometry.js';

/* ------------------------------------------------------------------ */
/* 通用粒子材质                                                         */
/* ------------------------------------------------------------------ */

function createParticleMaterial(color, map = glowTexture()) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(color) },
      uMap: { value: map },
      uScale: { value: 320 },
    },
    vertexShader: /* glsl */ `
      attribute float aSize;
      attribute float aAlpha;
      varying float vAlpha;
      uniform float uScale;
      void main() {
        vAlpha = aAlpha;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = aSize * (uScale / max(0.001, -mv.z));
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform sampler2D uMap;
      varying float vAlpha;
      void main() {
        vec4 tex = texture2D(uMap, gl_PointCoord);
        gl_FragColor = vec4(uColor, 1.0) * tex * vAlpha;
        if (gl_FragColor.a < 0.002) discard;
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
}

/* ------------------------------------------------------------------ */
/* 环境浮尘                                                             */
/* ------------------------------------------------------------------ */

/**
 * 空气中缓慢上浮的暖色尘埃，给场景加一层「热气」。
 * @param {{count?:number, inner?:number, outer?:number, height?:number}} opts
 */
export function createAmbientMotes({ count = 320, inner = 2.2, outer = 6.4, height = 5.2 } = {}) {
  const rnd = mulberry32(1337);
  const positions = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const alphas = new Float32Array(count);
  const speeds = new Float32Array(count);
  const phases = new Float32Array(count);

  for (let i = 0; i < count; i += 1) {
    const a = rnd() * Math.PI * 2;
    const r = inner + rnd() * (outer - inner);
    positions[i * 3] = Math.cos(a) * r;
    positions[i * 3 + 1] = rnd() * height - 0.4;
    positions[i * 3 + 2] = Math.sin(a) * r;
    sizes[i] = 0.014 + rnd() * 0.075;
    alphas[i] = 0.1 + rnd() * 0.5;
    speeds[i] = 0.05 + rnd() * 0.16;
    phases[i] = rnd() * Math.PI * 2;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
  geo.setAttribute('aAlpha', new THREE.BufferAttribute(alphas, 1));

  const mat = createParticleMaterial(0xffb066);
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  points.name = 'ambient-motes';

  let t = 0;
  function update(dt) {
    t += dt;
    const pos = geo.attributes.position.array;
    const alpha = geo.attributes.aAlpha.array;
    for (let i = 0; i < count; i += 1) {
      const iy = i * 3 + 1;
      pos[iy] += speeds[i] * dt;
      if (pos[iy] > height - 0.4) pos[iy] = -0.4;
      const ix = i * 3;
      const iz = i * 3 + 2;
      pos[ix] += Math.sin(t * 0.5 + phases[i]) * dt * 0.06;
      pos[iz] += Math.cos(t * 0.42 + phases[i] * 1.3) * dt * 0.06;
      // 缓慢呼吸
      alpha[i] = 0.09 + 0.26 * (0.5 + 0.5 * Math.sin(t * 0.9 + phases[i]));
    }
    geo.attributes.position.needsUpdate = true;
    geo.attributes.aAlpha.needsUpdate = true;
  }

  return { points, update };
}

/* ------------------------------------------------------------------ */
/* 中心能量核                                                           */
/* ------------------------------------------------------------------ */

export function createCore() {
  const root = new THREE.Group();
  root.position.set(0, 1.06, 0);

  // 内核
  const inner = mesh(new THREE.OctahedronGeometry(0.2, 0), accentGlow(0xffb347, 0.95), {
    cast: false,
  });
  inner.name = 'core-inner';

  // 外层线框
  const shellMat = new THREE.MeshBasicMaterial({
    color: 0xffc978,
    wireframe: true,
    transparent: true,
    opacity: 0.22,
    depthWrite: false,
  });
  const shell = mesh(new THREE.IcosahedronGeometry(0.34, 1), shellMat, { cast: false, name: 'core-shell' });

  // 辉光精灵（保持暖橙色，别叠成纯白）
  const glowMat = new THREE.SpriteMaterial({
    map: glowTexture(0.2),
    color: 0xff8a2e,
    blending: THREE.AdditiveBlending,
    transparent: true,
    opacity: 0.17,
    depthWrite: false,
  });
  const glow = new THREE.Sprite(glowMat);
  glow.scale.setScalar(2.2);

  // 两道细环
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0xffb347,
    transparent: true,
    opacity: 0.2,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const ringA = mesh(new THREE.TorusGeometry(0.62, 0.006, 6, 96), ringMat, {
    rx: Math.PI / 2.4,
    cast: false,
  });
  const ringB = mesh(new THREE.TorusGeometry(0.5, 0.005, 6, 96), ringMat, {
    rx: Math.PI / 1.7,
    ry: 0.5,
    cast: false,
  });

  // 台面光斑
  const halo = mesh(
    new THREE.PlaneGeometry(3.2, 3.2),
    new THREE.MeshBasicMaterial({
      map: haloTexture(),
      color: 0xff8a3a,
      transparent: true,
      opacity: 0.24,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
    { rx: -Math.PI / 2, y: -1.05, cast: false },
  );

  root.add(glow, halo, inner, shell, ringA, ringB);

  let t = 0;
  let spinBoost = 0;

  function update(dt, { boost = 0 } = {}) {
    t += dt;
    spinBoost += (boost - spinBoost) * Math.min(1, dt * 4);
    const s = 1 + spinBoost * 5;
    inner.rotation.y += dt * (0.34 + s * 0.2);
    inner.rotation.x += dt * 0.16;
    shell.rotation.y -= dt * (0.24 + s * 0.26);
    shell.rotation.z += dt * 0.1;
    ringA.rotation.z += dt * (0.4 + s * 0.5);
    ringB.rotation.x += dt * (0.32 + s * 0.44);

    const pulse = 1 + Math.sin(t * 2.1) * 0.06 + spinBoost * 0.18;
    inner.scale.setScalar(pulse);
    shell.scale.setScalar(1 + Math.sin(t * 1.7) * 0.04 + spinBoost * 0.2);
    glow.scale.setScalar(2.2 * (1 + Math.sin(t * 1.5) * 0.06 + spinBoost * 0.35));
    glowMat.opacity = 0.15 + Math.sin(t * 2.1) * 0.04 + spinBoost * 0.16;
    halo.scale.setScalar(1 + Math.sin(t * 1.3) * 0.04 + spinBoost * 0.22);
  }

  return { group: root, inner, shell, update };
}

/* ------------------------------------------------------------------ */
/* 抽中光柱                                                             */
/* ------------------------------------------------------------------ */

export function createBeam() {
  const root = new THREE.Group();
  root.visible = false;

  const coneMat = new THREE.MeshBasicMaterial({
    color: 0xffb347,
    transparent: true,
    opacity: 0,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    fog: false,
  });
  const cone = new THREE.Mesh(new THREE.ConeGeometry(0.62, 4.6, 40, 1, true), coneMat);
  cone.position.y = 2.3;

  const shaftMat = new THREE.MeshBasicMaterial({
    color: 0xffd9a0,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    fog: false,
  });
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 2.6, 12, 1, true), shaftMat);
  shaft.position.y = 1.3;

  const ringMat = new THREE.MeshBasicMaterial({
    color: 0xffc978,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    fog: false,
  });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.014, 8, 96), ringMat);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.03;

  const discMat = new THREE.MeshBasicMaterial({
    map: haloTexture(),
    color: 0xff9a3c,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    fog: false,
  });
  const disc = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.6), discMat);
  disc.rotation.x = -Math.PI / 2;
  disc.position.y = 0.02;

  root.add(cone, shaft, ring, disc);

  let t = 0;
  let level = 0;
  let target = 0;
  let pulseT = 0;

  function setColor(color) {
    const c = new THREE.Color(color);
    for (const m of [coneMat, shaftMat, ringMat, discMat]) m.color.copy(c);
    shaftMat.color.lerp(new THREE.Color(0xffffff), 0.3);
  }

  function show(color, { pulse = false } = {}) {
    setColor(color);
    root.visible = true;
    target = 1;
    pulseT = pulse ? 0.9 : 0;
  }

  function hide() {
    target = 0;
  }

  function update(dt) {
    t += dt;
    pulseT = Math.max(0, pulseT - dt);
    level += (target - level) * Math.min(1, dt * (target > level ? 7 : 3.4));
    if (level < 0.003 && target === 0) {
      root.visible = false;
      level = 0;
      return;
    }
    const breathe = 1 + Math.sin(t * 6) * 0.03 + pulseT * 0.12;
    coneMat.opacity = level * 0.11 * breathe;
    shaftMat.opacity = level * 0.28 * breathe;
    ringMat.opacity = level * 0.5 * breathe;
    discMat.opacity = level * 0.3 * breathe;
    const s = 1 + (1 - level) * 0.5;
    ring.scale.setScalar(s);
    disc.scale.setScalar(s + Math.sin(t * 2) * 0.02);
    cone.scale.set(1 / Math.max(0.2, level) ** 0.25, 1, 1 / Math.max(0.2, level) ** 0.25);
    root.rotation.y += dt * 0.35;
  }

  return {
    group: root,
    show,
    hide,
    update,
    setColor,
    /** 光柱落点（世界坐标） */
    placeAt(x, z) {
      root.position.set(x, 0, z);
    },
  };
}

/* ------------------------------------------------------------------ */
/* 蒸汽                                                                 */
/* ------------------------------------------------------------------ */

export function createSteam({ count = 30, spread = 0.3, rise = 0.75 } = {}) {
  const rnd = mulberry32(555);
  const positions = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const alphas = new Float32Array(count);
  const seeds = new Float32Array(count);

  for (let i = 0; i < count; i += 1) {
    const a = rnd() * Math.PI * 2;
    const r = rnd() * spread;
    positions[i * 3] = Math.cos(a) * r;
    positions[i * 3 + 1] = rnd() * rise;
    positions[i * 3 + 2] = Math.sin(a) * r;
    sizes[i] = 0.09 + rnd() * 0.13;
    alphas[i] = 0;
    seeds[i] = rnd();
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
  geo.setAttribute('aAlpha', new THREE.BufferAttribute(alphas, 1));

  const mat = createParticleMaterial(0xfff0dc);
  mat.uniforms.uScale.value = 200;
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  points.renderOrder = 3;

  let t = 0;
  function update(dt) {
    t += dt;
    const pos = geo.attributes.position.array;
    const alpha = geo.attributes.aAlpha.array;
    for (let i = 0; i < count; i += 1) {
      const iy = i * 3 + 1;
      pos[iy] += dt * (0.16 + seeds[i] * 0.2);
      if (pos[iy] > rise) {
        pos[iy] -= rise;
        pos[i * 3] = (seeds[i] - 0.5) * spread;
        pos[i * 3 + 2] = (seeds[(i + 7) % count] - 0.5) * spread;
      }
      const life = pos[iy] / rise;
      alpha[i] = Math.sin(Math.min(1, life) * Math.PI) * 0.34;
      pos[i * 3] += Math.sin(t * 1.6 + seeds[i] * 9) * dt * 0.05;
    }
    geo.attributes.position.needsUpdate = true;
    geo.attributes.aAlpha.needsUpdate = true;
  }

  return { points, update };
}

/* ------------------------------------------------------------------ */
/* 中奖爆发                                                             */
/* ------------------------------------------------------------------ */

export function createBurst({ count = 130 } = {}) {
  const rnd = mulberry32(8888);
  const positions = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const alphas = new Float32Array(count);
  const vel = new Float32Array(count * 3);
  const life = new Float32Array(count);

  for (let i = 0; i < count; i += 1) sizes[i] = 0.05 + rnd() * 0.11;

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
  geo.setAttribute('aAlpha', new THREE.BufferAttribute(alphas, 1));

  const mat = createParticleMaterial(0xffd08a);
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  points.visible = false;
  points.renderOrder = 4;

  let active = false;
  let elapsed = 0;

  function trigger(x, y, z, color = 0xffc978) {
    mat.uniforms.uColor.value.set(color);
    for (let i = 0; i < count; i += 1) {
      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;
      const a = rnd() * Math.PI * 2;
      const up = 0.35 + rnd() * 1.5;
      const out = 0.5 + rnd() * 2.0;
      vel[i * 3] = Math.cos(a) * out;
      vel[i * 3 + 1] = up;
      vel[i * 3 + 2] = Math.sin(a) * out;
      life[i] = 0.7 + rnd() * 0.7;
      alphas[i] = 1;
    }
    active = true;
    elapsed = 0;
    points.visible = true;
    geo.attributes.position.needsUpdate = true;
    geo.attributes.aAlpha.needsUpdate = true;
  }

  function update(dt) {
    if (!active) return;
    elapsed += dt;
    let any = false;
    for (let i = 0; i < count; i += 1) {
      const l = life[i];
      if (elapsed > l) {
        alphas[i] = 0;
        continue;
      }
      any = true;
      const k = elapsed / l;
      vel[i * 3 + 1] -= dt * 2.6;
      positions[i * 3] += vel[i * 3] * dt;
      positions[i * 3 + 1] += vel[i * 3 + 1] * dt;
      positions[i * 3 + 2] += vel[i * 3 + 2] * dt;
      alphas[i] = (1 - k) * (1 - k) * 0.68;
    }
    geo.attributes.position.needsUpdate = true;
    geo.attributes.aAlpha.needsUpdate = true;
    if (!any) {
      active = false;
      points.visible = false;
    }
  }

  return { points, trigger, update };
}

/* ------------------------------------------------------------------ */
/* 脉冲环（抽中瞬间扩散出去的一圈光）                                    */
/* ------------------------------------------------------------------ */

export function createShockRing() {
  const mat = new THREE.MeshBasicMaterial({
    color: 0xffc978,
    transparent: true,
    opacity: 0,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    fog: false,
  });
  const ring = mesh(new THREE.RingGeometry(0.5, 0.62, 96), mat, {
    rx: -Math.PI / 2,
    cast: false,
    name: 'shock-ring',
  });
  ring.visible = false;

  let t = 1;
  const dur = 0.9;

  function trigger(x, z, color = 0xffc978) {
    mat.color.set(color);
    ring.position.set(x, 0.02, z);
    t = 0;
    ring.visible = true;
  }

  function update(dt) {
    if (t >= 1) {
      ring.visible = false;
      return;
    }
    t = Math.min(1, t + dt / dur);
    const e = 1 - Math.pow(1 - t, 3);
    const s = 0.5 + e * 7;
    ring.scale.setScalar(s);
    mat.opacity = (1 - t) * 0.4;
  }

  return { ring, trigger, update };
}
