/**
 * 转盘导演
 * ---------------------------------------------------------------
 * 负责一次完整的「转一转」：
 *   回拉起手 → 飞转 → 稳稳停住 → 光柱落下 → 盘子升起 → 镜头推近 → 交还 UI。
 *
 * 相机是直接改 stage.camera 与 controls.target 的：
 * 飞行期间关掉控制器，落地后恢复，所以用户随时还能自己接着转视角。
 */

import * as THREE from 'three';
import {
  spinTarget,
  createSpinCurve,
  normalizeAngle,
  podWorldAngle,
  easeInOutCubic,
  lerp,
  clamp,
  FRONT_ANGLE,
} from './wheel-math.js';

const HOME_POSITION = new THREE.Vector3(0, 3.5, 8.4);
const HOME_TARGET = new THREE.Vector3(0, 0.55, 0);

export function createSpinDirector({ stage, ring, effects, callbacks = {} }) {
  const { camera, controls } = stage;
  const { onTick, onLand, onSettled, onStateChange } = callbacks;

  /** @type {'idle'|'spinning'|'revealing'} */
  let state = 'idle';
  let elapsed = 0;
  let revealElapsed = 0;
  let curve = null;
  let spinStartY = 0;
  let tickStep = Math.PI / 2;
  let tickFloor = 0;
  let winnerIndex = -1;
  let winnerDish = null;

  /** 相机飞行状态 */
  let fly = null;

  function setState(next) {
    if (state === next) return;
    state = next;
    onStateChange?.(next);
  }

  /* ---------------- 相机 ---------------- */

  function startFly(position, target, duration, ease = easeInOutCubic) {
    fly = {
      t: 0,
      duration: Math.max(0.05, duration),
      fromPos: camera.position.clone(),
      toPos: position.clone(),
      fromTarget: controls.target.clone(),
      toTarget: target.clone(),
      ease,
    };
    controls.enabled = false;
  }

  function updateFly(dt) {
    if (!fly) return;
    fly.t += dt;
    const u = clamp(fly.t / fly.duration, 0, 1);
    const k = fly.ease(u);
    camera.position.lerpVectors(fly.fromPos, fly.toPos, k);
    controls.target.lerpVectors(fly.fromTarget, fly.toTarget, k);
    camera.lookAt(controls.target);
    if (u >= 1) {
      fly = null;
      controls.enabled = true;
      controls.update();
    }
  }

  /** 站在当前视角方向上，向目标盘子推近 */
  function focusOnPod(pod, duration = 0.95) {
    const world = new THREE.Vector3();
    pod.root.getWorldPosition(world);

    // 保持用户当前的方位角，只缩短距离并稍微抬高
    const dir = new THREE.Vector3(camera.position.x - world.x, 0, camera.position.z - world.z);
    if (dir.lengthSq() < 1e-4) dir.set(0, 0, 1);
    dir.normalize();

    const distance = 2.6 + pod.modelHeight * 0.7;
    startFly(
      new THREE.Vector3(
        world.x + dir.x * distance,
        1.5 + pod.modelHeight * 0.5,
        world.z + dir.z * distance,
      ),
      new THREE.Vector3(world.x, world.y + 0.42 + pod.modelHeight * 0.22, world.z),
      duration,
    );
  }

  function flyHome(duration = 0.85) {
    startFly(HOME_POSITION, HOME_TARGET, duration);
  }

  /* ---------------- 主流程 ---------------- */

  /**
   * @param {number} index 可见盘子里的序号
   * @param {number} count 可见盘子总数
   * @param {object} dish  胜出的菜
   * @param {{timeScale?:number}} [opts] 低帧率设备上压缩旋转时长，别让用户干等
   */
  function start(index, count, dish, { timeScale = 1 } = {}) {
    if (state !== 'idle') return false;

    const currentY = ring.group.rotation.y;
    const turns = count > 12 ? 5 : 4;
    const targetY = spinTarget({ currentY, index, count, turns });
    const s = Math.max(0.35, Math.min(1, timeScale));

    curve = createSpinCurve({
      distance: targetY - currentY,
      total: (3.1 + turns * 0.12) * s,
      windup: 0.3 * s,
      accel: 0.55 * s,
      decel: Math.max(0.45, 1.7 * s),
    });

    spinStartY = currentY;
    elapsed = 0;
    tickStep = (Math.PI * 2) / Math.max(1, count);
    tickFloor = Math.floor(currentY / tickStep);
    winnerIndex = index;
    winnerDish = dish;

    ring.setSelected(-1);
    ring.setHover(null);
    effects.beam.hide();
    setState('spinning');
    return true;
  }

  function land() {
    const pod = ring.podAt(winnerIndex);
    ring.setSelected(winnerIndex);
    ring.group.rotation.y = normalizeAngle(ring.group.rotation.y);

    if (pod) {
      const world = new THREE.Vector3();
      pod.root.getWorldPosition(world);
      effects.beam.placeAt(world.x, world.z);
      effects.beam.show(pod.dish.accent, { pulse: true });
      effects.shockRing.trigger(world.x, world.z, pod.dish.accent);
      effects.burst.trigger(world.x, 0.55, world.z, pod.dish.accent);
      focusOnPod(pod);
    }

    onLand?.(winnerDish, winnerIndex);
    revealElapsed = 0;
    setState('revealing');
  }

  function finish() {
    setState('idle');
    onSettled?.(winnerDish, winnerIndex);
  }

  /** 取消（比如用户切了分类 / 重置了视角） */
  function cancel() {
    if (state === 'idle') return;
    curve = null;
    fly = null;
    controls.enabled = true;
    effects.beam.hide();
    setState('idle');
  }

  function update(dt, { onSpinSpeed } = {}) {
    updateFly(dt);

    if (state === 'spinning' && curve) {
      elapsed += dt;
      const y = spinStartY + curve.at(elapsed);

      // 每越过一个盘子发一次「咔哒」
      const floorNow = Math.floor(y / tickStep);
      if (floorNow !== tickFloor) {
        const delta = Math.abs(floorNow - tickFloor);
        tickFloor = floorNow;
        const speed = Math.max(0, curve.speedAt(elapsed));
        onTick?.(speed, Math.min(4, delta));
      }

      ring.group.rotation.y = y;
      onSpinSpeed?.(clamp(curve.speedAt(elapsed) / Math.max(1e-3, curve.omega), 0, 1));

      if (elapsed >= curve.duration) {
        ring.group.rotation.y = spinStartY + curve.distance;
        // 浮点误差兜底：确保赢家正好停在正前方
        const world = podWorldAngle(ring.group.rotation.y, winnerIndex, Math.max(1, ring.pods.length));
        ring.group.rotation.y += normalizeAngle(FRONT_ANGLE - world);
        curve = null;
        land();
      }
    } else if (state === 'revealing') {
      onSpinSpeed?.(0);
      revealElapsed += dt;
      if (revealElapsed > 0.8) finish();
    } else {
      onSpinSpeed?.(0);
    }
  }

  /** 已经点出来、但还没被消费的赢家（用于 UI 展示结果卡片） */
  function currentWinner() {
    return { dish: winnerDish, index: winnerIndex };
  }

  return {
    start,
    cancel,
    update,
    flyHome,
    focusOnPod,
    currentWinner,
    get state() {
      return state;
    },
    get spinning() {
      return state === 'spinning';
    },
    get busy() {
      return state !== 'idle';
    },
    HOME_POSITION,
    HOME_TARGET,
  };
}
