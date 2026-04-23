const GAME_WIDTH = 1200;
const GAME_HEIGHT = 700;
const WORLD_WIDTH = 5200;
const KILLS_TO_WIN = 10;
const GROUND_Y = 620;

class GhostNinjaScene extends Phaser.Scene {
  constructor() {
    super("GhostNinjaScene");
    this.phase = "combat";
    this.killCount = 0;
    this.coins = 0;
    this.attackInProgress = false;
    this.isJumping = false;
    this.enemySpawnTimer = 0;
    this.totalSpawned = 0;
  }

  preload() {
    this.load.image("bgSpace", "assets/background/space.png");
    this.preloadNinjaFrames();

    this.load.spritesheet("pumpkinKnight", "assets/enemies/pumpkinknight.png", {
      frameWidth: 166,
      frameHeight: 166,
    });

    this.load.image("pumpkin", "assets/halloween/decorations/png@1x/skull.png");
    this.load.image("tree_big.png", "assets/halloween/tree_big.png");
    this.load.image("tree_medium.png", "assets/halloween/tree_medium.png");
    this.load.image("tree_small.png", "assets/halloween/tree_small.png");
  }

  create() {
    this.createParticleTextures();
    this.createAnimations();
    this.physics.world.setBounds(0, 0, WORLD_WIDTH, GROUND_Y);
    this.createBackground();
    this.createWorld();
    this.createNinja();
    this.enemies = this.physics.add.group();
    this.createControls();
    this.createUI();
    this.createAudio();
    this.setupCamera();
  }

  update() {
    if (this.phase === "combat") {
      this.updateCombat();
    }
  }

  updateCombat() {
    this.background.tilePositionX = this.cameras.main.scrollX * 0.12;
    this.updateBubbles();
    this.handleMovement();
    this.syncSword();
    this.checkEnemySpawn();
    this.updateEnemies();
    this.autoAttack();

    // Reset Jump State
    if (this.ninja.body.blocked.down || this.ninja.body.touching.down) {
      if (this.isJumping) {
        this.isJumping = false;
        if (!this.attackInProgress) this.ninja.anims.play("ninja-idle", true);
      }
    }
  }

  createNinja() {
    this.ninja = this.physics.add.sprite(130, GROUND_Y - 50, "ninja-idle-1");
    this.ninja.setScale(0.7);
    this.ninja.setCollideWorldBounds(true);
    this.ninja.body.setSize(40, 80);
    this.ninja.body.setOffset(10, 4);
    this.ninja.speed = 300;
    this.ninja.setDepth(5);

    this.ninjaSword = this.add.rectangle(0, 0, 50, 8, 0xe8f4ff, 0.9).setOrigin(0.1, 0.5).setDepth(6);
    this.ninjaSword.setStrokeStyle(2, 0x72d0ff);
  }

  handleMovement() {
    if (!this.cursors || !this.keys) return;
    const left = this.cursors.left.isDown || this.keys.a.isDown;
    const right = this.cursors.right.isDown || this.keys.d.isDown;
    const jump = Phaser.Input.Keyboard.JustDown(this.cursors.up) || Phaser.Input.Keyboard.JustDown(this.keys.w);

    if (left) {
      this.ninja.setVelocityX(-this.ninja.speed);
      this.ninja.setFlipX(true);
      if (!this.isJumping && !this.attackInProgress) this.ninja.anims.play("ninja-run", true);
    } else if (right) {
      this.ninja.setVelocityX(this.ninja.speed);
      this.ninja.setFlipX(false);
      if (!this.isJumping && !this.attackInProgress) this.ninja.anims.play("ninja-run", true);
    } else {
      this.ninja.setVelocityX(0);
      if (!this.isJumping && !this.attackInProgress) this.ninja.anims.play("ninja-idle", true);
    }

    if (jump && (this.ninja.body.blocked.down || this.ninja.body.touching.down)) {
      this.ninja.setVelocityY(-680);
      this.isJumping = true;
      this.playSfx("jump");
      this.ninja.anims.play("ninja-jump", true);
    }
  }

  updateEnemies() {
    this.enemies.children.iterate((enemy) => {
      if (!enemy || !enemy.active) return;
      const dist = enemy.x - this.ninja.x;
      const dir = dist > 0 ? -1 : 1;

      if (!enemy.getData("isAttacking")) {
        enemy.x += dir * 2;
        enemy.setFlipX(dir < 0);
        enemy.y = GROUND_Y - 50;
      }

      if (Math.abs(dist) < 60 && !enemy.getData("isAttacking") && this.time.now > enemy.getData("cooldown")) {
        this.enemyAttack(enemy);
      }
    });
  }

  enemyAttack(enemy) {
    enemy.setData("isAttacking", true);
    enemy.anims.play("knight-attack", true);
    enemy.setData("cooldown", this.time.now + 2000);
    enemy.once("animationcomplete", () => {
      if (enemy.active) {
        enemy.setData("isAttacking", false);
        enemy.anims.play("knight-run", true);
      }
    });
  }

  performAttack() {
    if (this.attackInProgress) return;
    this.attackInProgress = true;
    this.ninja.anims.play("ninja-attack", true);
    this.playSfx("attack");
    this.swingSword();

    const reach = this.ninja.flipX ? -75 : 75;
    const hitZone = new Phaser.Geom.Circle(this.ninja.x + reach, this.ninja.y, 65);

    this.enemies.children.iterate((enemy) => {
      if (enemy && enemy.active && Phaser.Geom.Circle.Contains(hitZone, enemy.x, enemy.y)) {
        this.damageEnemy(enemy);
      }
    });

    this.ninja.once("animationcomplete", () => {
      this.attackInProgress = false;
    });
  }

  damageEnemy(enemy) {
    enemy.hp -= 1;
    this.spawnFireBurst(enemy.x, enemy.y);
    this.playSfx("hit");
    this.showDamageNumber(enemy.x, enemy.y - 50, 1);

    if (enemy.hp <= 0) {
      this.killCount++;
      this.coins += 10;
      this.killText.setText(`Kills: ${this.killCount} / ${KILLS_TO_WIN}`);
      this.updatePowerBar();
      this.updateCoinUI();
      enemy.active = false;
      enemy.anims.play("knight-death", true);
      enemy.once("animationcomplete", () => enemy.destroy());
      if (this.killCount >= KILLS_TO_WIN) this.showWinScreen();
    }
  }

  // Visuals & UI (Restored from your original)
  createWorld() {
    this.add.rectangle(WORLD_WIDTH / 2, GROUND_Y + 40, WORLD_WIDTH, 120, 0x171329);
    this.add.rectangle(WORLD_WIDTH / 2, GROUND_Y - 2, WORLD_WIDTH, 6, 0x5a4ea0);

    const ground = this.physics.add.staticRectangle(WORLD_WIDTH / 2, GROUND_Y, WORLD_WIDTH, 20);
    this.physics.add.collider(this.ninja, ground);

    this.createCombatEnvironment();
  }

  syncSword() {
    const side = this.ninja.flipX ? -1 : 1;
    this.ninjaSword.setPosition(this.ninja.x + (side * 22), this.ninja.y);
    this.ninjaSword.scaleX = side;
    this.ninjaSword.setVisible(this.phase === "combat");
  }

  swingSword() {
    this.tweens.add({
      targets: this.ninjaSword,
      angle: this.ninja.flipX ? -95 : 95,
      duration: 100,
      yoyo: true
    });
  }

  checkEnemySpawn() {
    if (this.totalSpawned >= 10) return;
    if (this.time.now > this.enemySpawnTimer) {
      console.log(`Spawning enemy ${this.totalSpawned + 1}`);
      const minSpawnDistance = 400;
      const spawnX = this.ninja.x + minSpawnDistance + Phaser.Math.Between(0, 300);
      this.spawnKnight(spawnX);
      this.totalSpawned++;
      this.enemySpawnTimer = this.time.now + 3000; // Simple 3 second delay
    }
  }

  spawnKnight(x) {
    const enemy = this.physics.add.sprite(x, GROUND_Y - 50, "pumpkinKnight");
    enemy.setScale(0.8).setDepth(2);
    enemy.hp = 3;
    enemy.setData("cooldown", 0);
    enemy.setData("isAttacking", false);
    enemy.body.setAllowGravity(false);
    enemy.anims.play("knight-run");
    this.enemies.add(enemy);
  }

  // --- Utility Methods (Particle, UI, Audio) ---
  createBackground() {
    this.background = this.add.tileSprite(0, 0, GAME_WIDTH, GAME_HEIGHT, "bgSpace").setOrigin(0, 0).setScrollFactor(0);
    this.createTwinklingStars();
    this.createFloatingBubbles();
  }

  createTwinklingStars() {
    for (let i = 0; i < 80; i++) {
      const star = this.add.circle(Phaser.Math.Between(0, GAME_WIDTH), Phaser.Math.Between(0, GAME_HEIGHT), Phaser.Math.Between(1, 2), 0xffffff, 0.5).setScrollFactor(0);
      this.tweens.add({ targets: star, alpha: 0.2, duration: Phaser.Math.Between(1000, 2000), repeat: -1, yoyo: true });
    }
  }

  createFloatingBubbles() {
    this.bubbles = [];
    for (let i = 0; i < 20; i++) {
      const b = this.add.circle(Phaser.Math.Between(0, GAME_WIDTH), Phaser.Math.Between(0, GAME_HEIGHT), Phaser.Math.Between(5, 15), 0x7fe5ff, 0.1).setScrollFactor(0);
      b.speed = Phaser.Math.FloatBetween(0.2, 0.8);
      this.bubbles.push(b);
    }
  }

  updateBubbles() {
    this.bubbles.forEach(b => {
      b.y -= b.speed;
      if (b.y < -20) b.y = GAME_HEIGHT + 20;
    });
  }

  createUI() {
    this.topBar = this.add.rectangle(GAME_WIDTH / 2, 26, GAME_WIDTH, 52, 0x0b0b18, 0.7).setScrollFactor(0);
    this.killText = this.add.text(20, 11, `Kills: 0 / ${KILLS_TO_WIN}`, { fontSize: "22px", color: "#fff", fontStyle: "bold" }).setScrollFactor(0);
    this.coinText = this.add.text(GAME_WIDTH / 2, 11, "0", { fontSize: "22px", color: "#ffd447", fontStyle: "bold" }).setScrollFactor(0);

    this.powerBarBg = this.add.rectangle(GAME_WIDTH - 150, 26, 200, 15, 0x2a1b3a).setScrollFactor(0);
    this.powerBarFill = this.add.rectangle(GAME_WIDTH - 250, 26, 0, 11, 0xff58ce).setOrigin(0, 0.5).setScrollFactor(0);
  }

  updateCoinUI() { this.coinText.setText(this.coins); }

  updatePowerBar() {
    const progress = this.killCount / KILLS_TO_WIN;
    this.powerBarFill.width = 200 * progress;
  }

  createAnimations() {
    const anims = [
      { key: "ninja-idle", frames: this.ninjaIdleFrames, rate: 8 },
      { key: "ninja-run", frames: this.ninjaRunFrames, rate: 12 },
      { key: "ninja-jump", frames: this.ninjaJumpFrames, rate: 10 },
      { key: "ninja-attack", frames: this.ninjaAttackFrames, rate: 15, repeat: 0 }
    ];
    anims.forEach(a => this.anims.create({ key: a.key, frames: a.frames.map(f => ({ key: f })), frameRate: a.rate, repeat: a.repeat ?? -1 }));

    this.anims.create({
      key: "knight-run",
      frames: this.anims.generateFrameNumbers("pumpkinKnight", { start: 0, end: 2 }),
      frameRate: 10, repeat: -1
    });
    this.anims.create({
      key: "knight-attack",
      frames: this.anims.generateFrameNumbers("pumpkinKnight", { start: 3, end: 5 }),
      frameRate: 12, repeat: 0
    });
    this.anims.create({
      key: "knight-death",
      frames: this.anims.generateFrameNumbers("pumpkinKnight", { start: 6, end: 8 }),
      frameRate: 10, repeat: 0
    });
  }

  setupCamera() {
    this.cameras.main.setBounds(0, 0, WORLD_WIDTH, GAME_HEIGHT);
    this.cameras.main.startFollow(this.ninja, true, 0.1, 0.1);
  }

  createControls() {
    this.cursors = this.input.keyboard.createCursorKeys();
    this.keys = this.input.keyboard.addKeys({
      w: Phaser.Input.Keyboard.KeyCodes.W,
      a: Phaser.Input.Keyboard.KeyCodes.A,
      s: Phaser.Input.Keyboard.KeyCodes.S,
      d: Phaser.Input.Keyboard.KeyCodes.D,
      space: Phaser.Input.Keyboard.KeyCodes.SPACE,
    });
    this.input.keyboard.on("keydown-SPACE", () => this.performAttack());
  }

  preloadNinjaFrames() {
    this.ninjaIdleFrames = Array.from({ length: 9 }, (_, i) => `ninja-idle-${i + 1}`);
    this.ninjaRunFrames = Array.from({ length: 9 }, (_, i) => `ninja-run-${i + 1}`);
    this.ninjaAttackFrames = Array.from({ length: 9 }, (_, i) => `ninja-attack-${i + 1}`);
    this.ninjaJumpFrames = Array.from({ length: 9 }, (_, i) => `ninja-jump-${i + 1}`);

    this.ninjaIdleFrames.forEach((f, i) => this.load.image(f, i === 0 ? "assets/ninja/idle/NEWNJIDLE.png" : `assets/ninja/idle/NEWNJIDLE${i + 1}.png`));
    for (let i = 1; i <= 9; i++) {
      this.load.image(`ninja-run-${i}`, `assets/ninja/NEWrun/${i}.png`);
      this.load.image(`ninja-attack-${i}`, `assets/ninja/attack/${i}.png`);
      this.load.image(`ninja-jump-${i}`, `assets/ninja/jump/${i}.png`);
    }
  }

  createParticleTextures() {
    const g = this.add.graphics();
    g.fillStyle(0xff7a00).fillRoundedRect(0, 0, 6, 6, 2).generateTexture("fireParticle", 6, 6);
    g.clear().fillStyle(0xffd447).fillCircle(4, 4, 4).generateTexture("coinParticle", 8, 8);
    g.destroy();
  }

  spawnFireBurst(x, y) {
    const p = this.add.particles(x, y, "fireParticle", { speed: 150, lifespan: 300, quantity: 20, emitting: false });
    p.explode();
    this.time.delayedCall(400, () => p.destroy());
  }

  showDamageNumber(x, y, amount) {
    const t = this.add.text(x, y, `+${amount}`, { fontSize: "20px", color: "#ffd766" });
    this.tweens.add({ targets: t, y: y - 40, alpha: 0, duration: 600, onComplete: () => t.destroy() });
  }

  createAudio() {
    this.input.once("pointerdown", () => {
      this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    });
  }

  playSfx(type) {
    if (!this.audioCtx) return;
    const presets = {
      attack: { f: 300, d: 0.1, w: "square" },
      jump: { f: 400, d: 0.1, w: "sine" },
      hit: { f: 150, d: 0.1, w: "sawtooth" }
    };
    const p = presets[type] || presets.attack;
    const osc = this.audioCtx.createOscillator();
    const g = this.audioCtx.createGain();
    osc.type = p.w;
    osc.frequency.setValueAtTime(p.f, this.audioCtx.currentTime);
    g.gain.setValueAtTime(0.05, this.audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + p.d);
    osc.connect(g).connect(this.audioCtx.destination);
    osc.start(); osc.stop(this.audioCtx.currentTime + p.d);
  }

  showWinScreen() {
    this.phase = "win";
    this.add.rectangle(GAME_WIDTH/2, GAME_HEIGHT/2, GAME_WIDTH, GAME_HEIGHT, 0x000, 0.8).setScrollFactor(0).setDepth(200);
    this.add.text(GAME_WIDTH/2, GAME_HEIGHT/2, "VICTORY!", { fontSize: "64px", color: "#fff" }).setOrigin(0.5).setScrollFactor(0).setDepth(201);
    const btn = this.add.text(GAME_WIDTH/2, GAME_HEIGHT/2 + 100, "PLAY AGAIN", { fontSize: "32px", color: "#0f0" }).setOrigin(0.5).setScrollFactor(0).setDepth(201).setInteractive();
    btn.on("pointerdown", () => location.reload());
  }

  createCombatEnvironment() {
    const treeKeys = ["tree_big.png", "tree_medium.png", "tree_small.png"];
    for (let x = 200; x < WORLD_WIDTH; x += 300) {
      const k = Phaser.Utils.Array.GetRandom(treeKeys);
      this.add.image(x, GROUND_Y - 80, k).setScale(0.5).setAlpha(0.3).setDepth(1);
    }
  }

  autoAttack() {
    if (this.enemies.children.countActive() > 0) {
      const closestEnemy = this.enemies.children.getClosestTo(this.ninja);
      const dist = closestEnemy.x - this.ninja.x;
      if (Math.abs(dist) < 60) {
        this.performAttack();
      }
    }
  }
}

const config = {
  type: Phaser.AUTO,
  parent: "game-container",
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: "#060816",
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  physics: { default: "arcade", arcade: { gravity: { y: 1500 }, debug: false } },
  scene: [GhostNinjaScene],
};

new Phaser.Game(config);