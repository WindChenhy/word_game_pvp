// === 主入口：引导 + 场景路由 + 主循环 ===

import { Arena } from './game/three/arena.js?v=11';
import { WordProjectileSystem } from './game/three/wordProjectile.js?v=11';
import { HUD } from './game/ui/hud.js?v=11';
import { MenuScene } from './game/scenes/menu.js?v=11';
import { TrainingScene } from './game/scenes/training.js?v=11';
import { PveScene } from './game/scenes/pve.js?v=11';
import { PvpScene } from './game/scenes/pvp.js?v=11';

class App {
  constructor() {
    this.canvas = document.getElementById('stage');
    this.arena = new Arena(this.canvas);
    this.projectiles = new WordProjectileSystem(this.arena.scene, this.arena);
    this.hud = new HUD();

    this.menu = new MenuScene({ onStart: (mode) => this._startMode(mode) });
    this.training = new TrainingScene({
      arena: this.arena,
      projectiles: this.projectiles,
      hud: this.hud,
      menu: this.menu,
    });
    this.pve = new PveScene({
      arena: this.arena,
      projectiles: this.projectiles,
      hud: this.hud,
      menu: this.menu,
    });
    this.pvp = new PvpScene({
      arena: this.arena,
      projectiles: this.projectiles,
      hud: this.hud,
      menu: this.menu,
    });

    this.currentScene = null;
    this._lastTime = 0;
    this._running = true;

    this._setupInput();
    this.menu.render();
    this._loop(0);
  }

  _startMode(mode) {
    // 先退出当前场景（清理 HUD、projectile、背景图、magazine 等）
    if (this.currentScene && typeof this.currentScene.exit === 'function') {
      this.currentScene.exit();
    }
    if (mode === 'training') {
      this.currentScene = this.training;
      this.training.enter();
    } else if (mode === 'pve') {
      this.currentScene = this.pve;
      this.pve.enter(0);
    } else if (mode === 'pvp') {
      this.currentScene = this.pvp;
      this.pvp.enter();
    }
  }

  _setupInput() {
    const input = document.getElementById('word-input');
    const submit = document.getElementById('submit-btn');

    const handleSubmit = () => {
      const val = input.value;
      if (!val) return;
      if (this.currentScene && typeof this.currentScene.onSubmit === 'function') {
        this.currentScene.onSubmit(val);
      }
    };

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleSubmit();
      }
    });

    submit.addEventListener('click', handleSubmit);

    input.addEventListener('blur', () => {
      setTimeout(() => {
        if (this.currentScene) input.focus();
      }, 50);
    });
  }

  _loop(now) {
    if (!this._running) return;
    const dt = Math.min(0.05, (now - this._lastTime) / 1000);  // 秒
    this._lastTime = now;

    if (this.currentScene && typeof this.currentScene.tick === 'function') {
      this.currentScene.tick(dt, now);
    }

    this.hud.tick(now);
    this.projectiles.update(dt, now);
    this.arena.update(dt, now);

    requestAnimationFrame((t) => this._loop(t));
  }
}

window.addEventListener('DOMContentLoaded', () => {
  window.__app = new App();
});

document.addEventListener('gesturestart', (e) => e.preventDefault());