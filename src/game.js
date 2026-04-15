/* GhostNinja - Fixed Version
 * All bugs fixed:
 * - Ninja no longer freezes when enemies spawn
 * - Coin counter increases correctly on kill
 * - Bridge phase triggers and displays properly
 * - Win screen works
 * - Bridge start marker hidden during combat
 */

const GAME_WIDTH = 1200;
const GAME_HEIGHT = 700;
const GROUND_Y = 620;
const KILLS_TO_BRIDGE = 20;
const WORLD_WIDTH = 5200;
const COMBAT_FLOOR_Y = GROUND_Y - 18;
const NINJA_GROUND_Y = COMBAT_FLOOR_Y - 47;

class GhostNinjaScene extends Phaser.Scene {
  constructor() {
    super("GhostNinjaScene");
    this.phase = "combat";
    this.killCount = 0;
    this.coins = 0;
    this.attackInProgress = false;
    this.bridgeRecovering = false;
    this.isJumping = false;
    this.jumpVelocity = 0;
    this.bridgeStartX = 120;
    this.bridgeGoalX = 1080;
    this.enemySpawnTriggered = false;
    this.enemySpawnTimer = null;
  }

  preload() {
    this.load.image("bgSpace", "assets/background/space.png");
    this.preloadNinjaFrames();

    this.load.spritesheet("pumpkinKnight", "assets/enemies/pumpkinknight (2).png", {
      frameWidth: 409,
      frameHeight: 682,
    });

    this.load.image("pumpkin", "assets/halloween/decorations/png@1x/skull.png");
    this.load.image("tree_big.png", "assets/halloween/tree_big.png");
    this.load.image("tree_medium.png", "assets/halloween/tree_medium.png");
    this.load.image("tree_small.png", "assets/halloween/tree_small.png");
  }

  create() {
    this.createParticleTextures();
    this.createAnimations();
    this.createBackground();
    this.createWorld();
    this.createNinja();
    this.createControls();
    this.createUI();
    this.createGroups();
    this.createMobileControls();
    this.createAudio();
    this.setupCamera();
  }

  update() {
    if (this.phase === "combat") {
      this.updateCombat();
    } else if (this.phase === "bridge") {
      this.updateBridge();
    }
  }

  // ----------------------
  // Setup helpers
  // ----------------------
  createParticleTextures() {
    const makeRect = (key, w, h, color) => {
      const g = this.add.graphics();
      g.fillStyle(color, 1);
      g.fillRoundedRect(0, 0, w, h, 4);
      g.generateTexture(key, w, h);
      g.destroy();
    };
    makeRect("fireParticle", 6, 6, 0xff7a00);
    makeRect("coinParticle", 6, 6, 0xffd447);
    makeRect("confettiParticle", 4, 8, 0x66ffcc);
  }

  createAnimations() {
    const makeAnim = (key, frameKeys, frameRate, repeat = -1) => {
      this.anims.create({
        key,
        frames: frameKeys.map((k) => ({ key: k })),
        frameRate,
        repeat,
      });
    };

    makeAnim("ninja-idle", this.ninjaIdleFrames, 8);
    makeAnim("ninja-run", this.ninjaRunFrames, 12);
    makeAnim("ninja-jump", this.ninjaJumpFrames, 12);
    makeAnim("ninja-attack", this.ninjaAttackFrames, 14, 0);
    makeAnim("ninja-dead", this.ninjaDeadFrames, 10, 0);

    if (this.textures.exists("pumpkinKnight")) {
      this.anims.create({
        key: "knight-run",
        frames: this.anims.generateFrameNumbers("pumpkinKnight", { start: 0, end: 4 }),
        frameRate: 10,
        repeat: -1,
      });
      this.anims.create({
        key: "knight-attack",
        frames: this.anims.generateFrameNumbers("pumpkinKnight", { start: 5, end: 9 }),
        frameRate: 12,
        repeat: 0,
      });
      this.anims.create({
        key: "knight-death",
        frames: this.anims.generateFrameNumbers("pumpkinKnight", { start: 10, end: 14 }),
        frameRate: 10,
        repeat: 0,
      });
    }
  }

  createBackground() {
    this.background = this.add
      .tileSprite(0, 0, GAME_WIDTH, GAME_HEIGHT, "bgSpace")
      .setOrigin(0, 0)
      .setScrollFactor(0);
    this.createTwinklingStars();
    this.createFloatingBubbles();
  }

  createWorld() {
    this.ground = this.add.rectangle(WORLD_WIDTH / 2, GROUND_Y + 40, WORLD_WIDTH, 120, 0x171329);
    this.groundStroke = this.add.rectangle(WORLD_WIDTH / 2, GROUND_Y - 18, WORLD_WIDTH, 8, 0x5a4ea0);
    this.createCombatEnvironment();
  }

  createNinja() {
    // KEY FIX: ninja uses setVelocity for movement, gravity OFF, no physics collider with enemies
    this.ninja = this.physics.add.sprite(130, NINJA_GROUND_Y, this.ninjaIdleFrames[0]);
    this.ninja.setCollideWorldBounds(true);
    this.ninja.setSize(44, 84);
    this.ninja.setOffset(8, 4);
    this.ninja.speed = 280;
    this.ninja.body.allowGravity = false;
    this.ninja.setDepth(5);
    this.ninja.anims.play("ninja-idle");

    this.ninjaSword = this.add.rectangle(this.ninja.x + 24, this.ninja.y - 6, 48, 7, 0xe8f4ff, 0.95);
    this.ninjaSword.setStrokeStyle(2, 0x72d0ff, 0.8);
    this.ninjaSword.setOrigin(0.15, 0.5);
    this.ninjaSword.setDepth(6);
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

    this.input.keyboard.on("keydown-SPACE", () => {
      if (this.phase === "combat") this.performAttack();
    });
  }

  createUI() {
    this.topBar = this.add
      .rectangle(GAME_WIDTH / 2, 26, GAME_WIDTH, 52, 0x0b0b18, 0.72)
      .setScrollFactor(0);

    this.killText = this.add
      .text(16, 11, "Kills: 0 / 20", { fontSize: "22px", color: "#f4f2ff", fontStyle: "bold" })
      .setScrollFactor(0);

    this.phaseText = this.add
      .text(GAME_WIDTH / 2 - 85, 11, "PHASE: COMBAT", { fontSize: "22px", color: "#f39cff", fontStyle: "bold" })
      .setScrollFactor(0);

    this.arsenalTitle = this.add
      .text(GAME_WIDTH - 390, 11, "Arsenal Power", { fontSize: "18px", color: "#ffc9ff" })
      .setScrollFactor(0);

    this.powerBarBg = this.add
      .rectangle(GAME_WIDTH - 170, 24, 260, 16, 0x2a1b3a)
      .setOrigin(0.5)
      .setScrollFactor(0);

    this.powerBarFill = this.add
      .rectangle(GAME_WIDTH - 300, 24, 0, 12, 0xff58ce)
      .setOrigin(0, 0.5)
      .setScrollFactor(0);

    this.arsenalLevelText = this.add
      .text(GAME_WIDTH - 390, 33, "Blade Lv. 1", { fontSize: "14px", color: "#b9ffde" })
      .setScrollFactor(0);

    // Coin counter
    this.coinIcon = this.add.circle(GAME_WIDTH / 2 - 85, 24, 12, 0xffd447).setScrollFactor(0);
    this.coinIcon.setStrokeStyle(2, 0xff9500, 0.8);
    this.coinText = this.add
      .text(GAME_WIDTH / 2 - 65, 16, "0", { fontSize: "20px", color: "#fff4c2", fontStyle: "bold" })
      .setScrollFactor(0);
  }

  createGroups() {
    // KEY FIX: enemies group with NO collider against ninja — only overlap (pass-through)
    this.enemies = this.physics.add.group();
    this.barriers = this.physics.add.group();

    // Use overlap NOT collider — overlap lets ninja pass through enemies freely
    // Combat damage is handled manually in performAttack() via hit zone geometry
    // NO this.physics.add.collider(this.ninja, this.enemies) anywhere!
  }

  // ----------------------
  // Visual effects
  // ----------------------
  createTwinklingStars() {
    this.stars = [];
    for (let i = 0; i < 80; i++) {
      const star = this.add.circle(
        Phaser.Math.Between(0, GAME_WIDTH),
        Phaser.Math.Between(0, GAME_HEIGHT),
        Phaser.Math.Between(1, 2),
        0xffffff,
        Phaser.Math.FloatBetween(0.2, 0.8)
      );
      star.setScrollFactor(0);
      this.stars.push(star);
      this.tweens.add({
        targets: star,
        alpha: { from: star.alpha, to: Phaser.Math.FloatBetween(0.15, 1) },
        duration: Phaser.Math.Between(900, 2500),
        repeat: -1,
        yoyo: true,
      });
    }
  }

  createFloatingBubbles() {
    this.bubbles = [];
    for (let i = 0; i < 24; i++) {
      const bubble = this.add.circle(
        Phaser.Math.Between(0, GAME_WIDTH),
        Phaser.Math.Between(0, GAME_HEIGHT),
        Phaser.Math.Between(6, 20),
        0x7fe5ff,
        Phaser.Math.FloatBetween(0.08, 0.22)
      );
      bubble.setScrollFactor(0);
      bubble.speed = Phaser.Math.FloatBetween(0.25, 0.9);
      bubble.drift = Phaser.Math.FloatBetween(-0.3, 0.3);
      this.bubbles.push(bubble);
    }
  }

  updateBubbles() {
    for (const b of this.bubbles) {
      b.y -= b.speed;
      b.x += b.drift;
      if (b.y < -30) {
        b.y = GAME_HEIGHT + Phaser.Math.Between(10, 60);
        b.x = Phaser.Math.Between(0, GAME_WIDTH);
      }
      if (b.x < -20) b.x = GAME_WIDTH + 10;
      if (b.x > GAME_WIDTH + 20) b.x = -10;
    }
  }

  spawnFireBurst(x, y) {
    const p = this.add.particles(x, y, "fireParticle", {
      speed: { min: 70, max: 210 },
      angle: { min: 180, max: 360 },
      scale: { start: 1.2, end: 0.1 },
      alpha: { start: 1, end: 0 },
      lifespan: 340,
      quantity: 26,
      emitting: false,
    });
    p.explode(26, x, y);
    this.time.delayedCall(400, () => p.destroy());
  }

  showDamageNumber(x, y, amount) {
    const label = amount === 0 ? "BLOCKED!" : `+${amount}`;
    const color = amount === 0 ? "#ff4444" : "#ffd766";
    const txt = this.add.text(x, y, label, {
      fontSize: "22px",
      color,
      fontStyle: "bold",
      stroke: "#4b2100",
      strokeThickness: 4,
    });
    this.tweens.add({
      targets: txt,
      y: y - 50,
      alpha: 0,
      duration: 600,
      onComplete: () => txt.destroy(),
    });
  }

  launchWinParticles() {
    const coinFx = this.add.particles(GAME_WIDTH / 2, -40, "coinParticle", {
      x: { min: 60, max: GAME_WIDTH - 60 },
      y: -20,
      speedY: { min: 120, max: 260 },
      speedX: { min: -30, max: 30 },
      gravityY: 220,
      quantity: 8,
      lifespan: 2800,
      scale: { start: 1.4, end: 0.4 },
      rotate: { min: 0, max: 360 },
    });
    const confettiFx = this.add.particles(GAME_WIDTH / 2, -30, "confettiParticle", {
      x: { min: 0, max: GAME_WIDTH },
      y: -20,
      speedY: { min: 100, max: 230 },
      speedX: { min: -120, max: 120 },
      gravityY: 210,
      quantity: 16,
      lifespan: 3000,
      scale: { start: 1, end: 0.5 },
      rotate: { min: 0, max: 300 },
      tint: [0xff6585, 0xffd447, 0x4dffb8, 0x8ec5ff, 0xc58eff],
    });
    this.time.delayedCall(3800, () => {
      coinFx.destroy();
      confettiFx.destroy();
    });
  }

  // ----------------------
  // Combat phase
  // ----------------------
  updateCombat() {
    this.cameras.main.scrollY = 0;
    this.background.tilePositionX = this.cameras.main.scrollX * 0.12;
    this.updateBubbles();
    this.handleMovement(false);
    this.updateManualJump();
    this.syncSwordToNinja();
    this.checkEnemySpawn();

    // KEY FIX: enemies use direct position manipulation, NOT physics velocity
    // This prevents physics bodies from blocking the ninja
    this.enemies.children.iterate((enemy) => {
      if (!enemy || !enemy.active) return;

      // Move enemy horizontally toward ninja by direct position
      const dir = this.ninja.x < enemy.x ? -1 : 1;
      enemy.setFlipX(dir < 0);

      // Only move if not currently attacking
      if (!enemy.getData("isAttacking")) {
        const dt = this.game.loop.delta / 1000;
        enemy.x += dir * enemy.moveSpeed * dt;
      }

      // Lock to ground
      enemy.y = COMBAT_FLOOR_Y - 44;
      // Disable physics body to prevent blocking
      if (enemy.body) {
        enemy.body.enable = false;
      }

      // Attack when close
      const dist = Math.abs(enemy.x - this.ninja.x);
      const cooldown = enemy.getData("attackCooldown") || 0;
      if (dist < 80 && !enemy.getData("isAttacking") && this.time.now > cooldown) {
        enemy.setData("isAttacking", true);
        enemy.setData("attackCooldown", this.time.now + 2000);
        enemy.anims.play("knight-attack", true);
        enemy.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
          if (enemy.active) {
            enemy.setData("isAttacking", false);
            enemy.anims.play("knight-run", true);
          }
        });
      }

      // Cull enemies too far away
      if (Math.abs(enemy.x - this.ninja.x) > 1000) {
        enemy.destroy();
      }
    });
  }

  performAttack() {
    if (this.attackInProgress || this.phase !== "combat") return;
    this.attackInProgress = true;
    this.playSfx("attack");
    this.ninja.anims.play("ninja-attack", true);
    this.swingSword();

    const reach = this.ninja.flipX ? -70 : 70;
    const hitZone = new Phaser.Geom.Circle(this.ninja.x + reach, this.ninja.y, 62);

    this.enemies.children.iterate((enemy) => {
      if (!enemy || !enemy.active) return;
      if (!Phaser.Geom.Circle.Contains(hitZone, enemy.x, enemy.y)) return;

      enemy.hp -= 1;
      this.playSfx("hit");
      this.spawnFireBurst(enemy.x, enemy.y);
      this.showDamageNumber(enemy.x, enemy.y - 14, 1);

      if (enemy.hp <= 0) {
        // KEY FIX: increment kills and coins BEFORE destroying
        this.killCount += 1;
        this.coins += 10;
        this.playSfx("kill");
        this.playSfx("coin");
        this.updatePowerBar();
        this.updateCoinUI();
        this.killText.setText(`Kills: ${this.killCount} / ${KILLS_TO_BRIDGE}`);

        // Play death animation then destroy
        enemy.anims.play("knight-death", true);
        enemy.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
          if (enemy.active) enemy.destroy();
        });

        // KEY FIX: check bridge trigger AFTER kill counted
        if (this.killCount >= KILLS_TO_BRIDGE) {
          this.time.delayedCall(600, () => this.startBridgePhase());
        }
      }
    });

    this.ninja.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
      this.attackInProgress = false;
      if (!this.cursors.left.isDown && !this.cursors.right.isDown && !this.keys.a.isDown && !this.keys.d.isDown) {
        this.ninja.anims.play("ninja-idle", true);
      }
    });
  }

  checkEnemySpawn() {
    if (!this.enemySpawnTriggered && this.ninja.x > 800) {
      this.enemySpawnTriggered = true;
      this.enemySpawnTimer = this.time.addEvent({
        delay: 3500,
        loop: true,
        callback: () => {
          if (this.phase !== "combat") return;
          const active = this.enemies.getChildren().filter((e) => e && e.active);
          if (active.length >= 6) return; // Max 6 enemies at once
          this.spawnKnight();
        },
      });
      // Spawn first enemy immediately
      this.spawnKnight();
    }
  }

  spawnKnight() {
    const spawnX = this.ninja.x + Phaser.Math.Between(400, 700);
    const knight = this.enemies.create(spawnX, COMBAT_FLOOR_Y - 44, "pumpkinKnight");
    knight.setScale(0.4);
    knight.setData("type", "pumpkinKnight");
    knight.setData("isAttacking", false);
    knight.setData("attackCooldown", 0);
    knight.moveSpeed = Phaser.Math.Between(70, 120);
    knight.hp = 3;
    knight.setDepth(2);
    // KEY FIX: completely disable physics body to prevent blocking
    knight.body.allowGravity = false;
    knight.body.enable = false;
    knight.anims.play("knight-run", true);
    return knight;
  }

  updatePowerBar() {
    const progress = Phaser.Math.Clamp(this.killCount / KILLS_TO_BRIDGE, 0, 1);
    this.powerBarFill.width = 256 * progress;
    this.powerBarFill.fillColor = Phaser.Display.Color.Interpolate.ColorWithColor(
      { r: 255, g: 88, b: 206 },
      { r: 87, g: 255, b: 170 },
      100,
      Math.floor(progress * 100)
    ).color;
    const level = 1 + Math.floor(progress * 4);
    this.arsenalLevelText.setText(`Blade Lv. ${level}`);
  }

  updateCoinUI() {
    this.coinText.setText(String(this.coins));
    this.tweens.add({
      targets: [this.coinIcon, this.coinText],
      scaleX: 1.3,
      scaleY: 1.3,
      duration: 150,
      yoyo: true,
      ease: "Back.easeOut",
    });
  }

  // ----------------------
  // Bridge phase
  // ----------------------
  startBridgePhase() {
    if (this.phase !== "combat") return;
    this.phase = "bridge";

    if (this.enemySpawnTimer) this.enemySpawnTimer.remove(false);
    this.enemies.clear(true, true);

    this.phaseText.setText("PHASE: BRIDGE RUN").setColor("#8dffcb");
    this.isJumping = false;
    this.jumpVelocity = 0;
    this.ninja.setVelocity(0, 0);

    // Redraw ground for bridge
    this.ground.fillColor = 0x1f1a2f;
    this.groundStroke.fillColor = 0x8a6cff;

    // Bridge track
    this.bridgeTrack = this.add
      .rectangle(GAME_WIDTH / 2, GROUND_Y - 64, GAME_WIDTH - 120, 160, 0x2a2047, 0.85)
      .setDepth(-1);

    // KEY FIX: bridge markers created here (NOT during combat) so they only show now
    this.bridgeStartMark = this.add.rectangle(this.bridgeStartX - 18, GROUND_Y - 64, 8, 140, 0x5eff99, 0.8);
    this.bridgeGoalMark = this.add.rectangle(this.bridgeGoalX + 18, GROUND_Y - 64, 8, 140, 0xffd654, 0.8);

    // Move ninja to bridge start
    this.ninja.setPosition(this.bridgeStartX, GROUND_Y - 64);
    this.ninja.anims.play("ninja-run", true);

    // Moving barriers
    const laneYs = [GROUND_Y - 110, GROUND_Y - 64, GROUND_Y - 18];
    for (let i = 0; i < 8; i++) {
      const barrier = this.physics.add.sprite(
        Phaser.Math.Between(this.bridgeStartX + 120, this.bridgeGoalX - 90),
        laneYs[i % laneYs.length],
        "pumpkin"
      );
      barrier.setScale(0.75);
      barrier.body.allowGravity = false;
      barrier.setImmovable(true);
      barrier.direction = Phaser.Math.Between(0, 1) ? 1 : -1;
      barrier.slideSpeed = Phaser.Math.Between(85, 145);
      this.barriers.add(barrier);
    }

    this.physics.add.overlap(this.ninja, this.barriers, this.onBridgeBarrierHit, null, this);
  }

  updateBridge() {
    this.cameras.main.scrollY = 0;
    this.background.tilePositionX = this.cameras.main.scrollX * 0.2;
    this.updateBubbles();
    this.handleMovement(true);
    this.syncSwordToNinja();

    // Clamp ninja within bridge lane
    this.ninja.y = Phaser.Math.Clamp(this.ninja.y, GROUND_Y - 118, GROUND_Y - 10);

    // Move barriers
    this.barriers.children.iterate((barrier) => {
      if (!barrier || !barrier.active) return;
      barrier.x += barrier.direction * barrier.slideSpeed * (1 / 60);
      if (barrier.x < this.bridgeStartX + 80 || barrier.x > this.bridgeGoalX - 30) {
        barrier.direction *= -1;
      }
    });

    // Win condition
    if (this.ninja.x >= this.bridgeGoalX) {
      this.showWinScreen();
    }
  }

  onBridgeBarrierHit() {
    if (this.bridgeRecovering || this.phase !== "bridge") return;
    this.bridgeRecovering = true;
    this.cameras.main.shake(180, 0.004);
    this.showDamageNumber(this.ninja.x + 20, this.ninja.y - 50, 0);
    this.ninja.anims.play("ninja-dead", true);
    this.playSfx("hit");

    this.time.delayedCall(420, () => {
      this.ninja.setPosition(this.bridgeStartX, GROUND_Y - 64);
      this.ninja.anims.play("ninja-run", true);
      this.bridgeRecovering = false;
    });
  }

  // ----------------------
  // Win screen
  // ----------------------
  showWinScreen() {
    if (this.phase === "win") return;
    this.phase = "win";
    this.playSfx("win");
    this.barriers.clear(true, true);
    this.phaseText.setText("PHASE: VICTORY!").setColor("#ffe070");

    const overlay = this.add
      .rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x05030c, 0.75)
      .setDepth(20)
      .setScrollFactor(0);

    const title = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 160, "GHOSTNINJA WINS!", {
        fontSize: "72px",
        color: "#ffe9a8",
        fontStyle: "bold",
        stroke: "#2c1450",
        strokeThickness: 8,
      })
      .setOrigin(0.5)
      .setDepth(21)
      .setScrollFactor(0);

    const prize = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 60, "💰 Cash Prize Unlocked: $999,999", {
        fontSize: "38px",
        color: "#8dffb0",
        fontStyle: "bold",
        stroke: "#143a22",
        strokeThickness: 6,
      })
      .setOrigin(0.5)
      .setDepth(21)
      .setScrollFactor(0);

    const coinsEarned = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 10, `Coins Collected: ${this.coins}`, {
        fontSize: "28px",
        color: "#ffd447",
      })
      .setOrigin(0.5)
      .setDepth(21)
      .setScrollFactor(0);

    const tip = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 70, "Refresh page to play again", {
        fontSize: "22px",
        color: "#d8ccff",
      })
      .setOrigin(0.5)
      .setDepth(21)
      .setScrollFactor(0);

    this.tweens.add({
      targets: [title, prize],
      scale: { from: 0.95, to: 1.04 },
      duration: 700,
      yoyo: true,
      repeat: -1,
    });

    this.launchWinParticles();
  }

  // ----------------------
  // Movement
  // ----------------------
  handleMovement(allowVertical = false) {
    if (this.bridgeRecovering) return;

    const mobile = this.mobileInput || { left: false, right: false, up: false, jumpPressed: false };
    const left = this.cursors.left.isDown || this.keys.a.isDown || mobile.left;
    const right = this.cursors.right.isDown || this.keys.d.isDown || mobile.right;
    const up = this.cursors.up.isDown || this.keys.w.isDown || mobile.up;
    const down = this.cursors.down.isDown || this.keys.s.isDown;
    const jumpPressed =
      Phaser.Input.Keyboard.JustDown(this.cursors.up) ||
      Phaser.Input.Keyboard.JustDown(this.keys.w) ||
      mobile.jumpPressed;

    // Reset X velocity only - let updateManualJump handle Y velocity
    this.ninja.setVelocityX(0);

    if (left) {
      this.ninja.setVelocityX(-this.ninja.speed);
      this.ninja.setFlipX(true);
      if (!this.attackInProgress) this.ninja.anims.play("ninja-run", true);
    } else if (right) {
      this.ninja.setVelocityX(this.ninja.speed);
      this.ninja.setFlipX(false);
      if (!this.attackInProgress) this.ninja.anims.play("ninja-run", true);
    } else {
      if (!this.attackInProgress && !this.isJumping) this.ninja.anims.play("ninja-idle", true);
    }

    if (allowVertical) {
      if (up) this.ninja.setVelocityY(-this.ninja.speed * 0.6);
      if (down) this.ninja.setVelocityY(this.ninja.speed * 0.6);
    }

    // Jump (combat phase only)
    if (this.phase === "combat" && jumpPressed && !this.isJumping) {
      this.jumpVelocity = -620;
      this.isJumping = true;
      this.playSfx("jump");
      if (!this.attackInProgress) this.ninja.anims.play("ninja-jump", true);
    }

    mobile.jumpPressed = false;
  }

  updateManualJump() {
    // If not jumping, ensure ninja stays at ground level using physics only
    if (!this.isJumping) {
      if (this.ninja.y > NINJA_GROUND_Y) {
        // Only snap to ground if we've fallen below it
        this.ninja.y = NINJA_GROUND_Y;
        this.ninja.setVelocityY(0);
      } else if (this.ninja.y < NINJA_GROUND_Y) {
        // Push down gently to ground using physics
        this.ninja.setVelocityY(200);
      } else {
        // At ground level - zero out Y velocity
        this.ninja.setVelocityY(0);
      }
      return;
    }

    // Apply gravity to jump velocity
    this.jumpVelocity += 1400 * (1 / 60);

    // Use physics velocity for jump movement (not manual position)
    this.ninja.setVelocityY(this.jumpVelocity);

    // Check if landed
    if (this.ninja.y >= NINJA_GROUND_Y) {
      this.ninja.y = NINJA_GROUND_Y;
      this.ninja.setVelocityY(0);
      this.isJumping = false;
      this.jumpVelocity = 0;
      if (!this.attackInProgress) this.ninja.anims.play("ninja-idle", true);
    }
  }

  syncSwordToNinja() {
    if (!this.ninjaSword) return;
    const side = this.ninja.flipX ? -1 : 1;
    this.ninjaSword.x = this.ninja.x + side * 24;
    this.ninjaSword.y = this.ninja.y - 6;
    this.ninjaSword.scaleX = side;
    if (!this.attackInProgress) this.ninjaSword.rotation = side > 0 ? 0.05 : -0.05;
    this.ninjaSword.setVisible(this.phase !== "win");
  }

  swingSword() {
    const side = this.ninja.flipX ? -1 : 1;
    this.ninjaSword.rotation = side > 0 ? -0.9 : 0.9;
    this.tweens.add({
      targets: this.ninjaSword,
      rotation: side > 0 ? 0.5 : -0.5,
      duration: 130,
      yoyo: true,
      ease: "Sine.easeOut",
    });
  }

  // ----------------------
  // Camera & resize
  // ----------------------
  setupCamera() {
    this.physics.world.setBounds(0, 0, WORLD_WIDTH, GAME_HEIGHT);
    this.cameras.main.setBounds(0, 0, WORLD_WIDTH, GAME_HEIGHT);
    // Camera follows ninja with slight smoothing but no vertical follow in combat
    this.cameras.main.startFollow(this.ninja, true, 0.12, 0.12);
    this.cameras.main.setDeadzone(230, 120);
    this.scale.on("resize", this.onResize, this);
    this.onResize({ width: this.scale.width, height: this.scale.height });
  }

  onResize(gameSize) {
    const width = gameSize.width || this.scale.width;
    const height = gameSize.height || this.scale.height;
    this.cameras.resize(width, height);
    if (this.background) this.background.setSize(width, height);
    this.layoutHud(width, height);
    this.layoutMobileControls(width, height);
  }

  layoutHud(width) {
    if (!this.topBar) return;
    this.topBar.setPosition(width / 2, 26).setSize(width, 52);
    this.killText.setPosition(16, 11);
    this.phaseText.setPosition(GAME_WIDTH / 2 - 85, 11);
    this.arsenalTitle.setPosition(width - 390, 11);
    this.powerBarBg.setPosition(width - 170, 24);
    this.powerBarFill.setPosition(width - 300, 24);
    this.arsenalLevelText.setPosition(width - 390, 33);
    if (this.coinIcon) this.coinIcon.setPosition(width / 2 - 85, 24);
    if (this.coinText) this.coinText.setPosition(width / 2 - 65, 16);
  }

  layoutMobileControls(width, height) {
    if (!this.mobileButtons) return;
    const setPos = (obj, x, y) => { obj.btn.setPosition(x, y); obj.txt.setPosition(x, y); };
    const margin = Math.max(56, Math.floor(Math.min(width, height) * 0.08));
    const radius = Math.max(28, Math.floor(Math.min(width, height) * 0.045));
    this.mobileButtons.jump.btn.setRadius(radius);
    this.mobileButtons.attack.btn.setRadius(radius);
    this.mobileButtons.left.btn.setRadius(radius);
    this.mobileButtons.right.btn.setRadius(radius);
    setPos(this.mobileButtons.left, margin, height - margin);
    setPos(this.mobileButtons.right, margin + radius * 2.5, height - margin);
    setPos(this.mobileButtons.jump, width - (margin + radius * 2.5), height - margin);
    setPos(this.mobileButtons.attack, width - margin, height - margin);
  }

  // ----------------------
  // Environment
  // ----------------------
  createCombatEnvironment() {
    const treeKeys = ["tree_big.png", "tree_medium.png", "tree_small.png"];
    for (let x = 220; x < WORLD_WIDTH - 120; x += Phaser.Math.Between(240, 420)) {
      const key = Phaser.Utils.Array.GetRandom(treeKeys);
      if (!this.textures.exists(key)) continue;
      this.add.image(x, GROUND_Y - 100, key).setScale(0.5).setAlpha(0.4).setDepth(1);
    }
  }

  // ----------------------
  // Ninja frame preload
  // ----------------------
  preloadNinjaFrames() {
    this.ninjaIdleFrames = Array.from({ length: 9 }, (_, i) => `ninja-idle-${i + 1}`);
    this.ninjaRunFrames = Array.from({ length: 9 }, (_, i) => `ninja-run-${i + 1}`);
    this.ninjaAttackFrames = Array.from({ length: 9 }, (_, i) => `ninja-attack-${i + 1}`);
    this.ninjaJumpFrames = Array.from({ length: 9 }, (_, i) => `ninja-jump-${i + 1}`);
    this.ninjaDeadFrames = Array.from({ length: 9 }, (_, i) => `ninja-dead-${i + 1}`);

    const idlePaths = Array.from({ length: 9 }, (_, i) =>
      i === 0 ? "assets/ninja/idle/NEWNJIDLE.png" : `assets/ninja/idle/NEWNJIDLE${i + 1}.png`
    );
    idlePaths.forEach((path, i) => this.load.image(this.ninjaIdleFrames[i], path));

    for (let i = 1; i <= 9; i++) {
      this.load.image(`ninja-run-${i}`, `assets/ninja/NEWrun/${i}.png`);
      this.load.image(`ninja-attack-${i}`, `assets/ninja/attack/${i}.png`);
      this.load.image(`ninja-jump-${i}`, `assets/ninja/jump/${i}.png`);
      this.load.image(`ninja-dead-${i}`, `assets/ninja/dead/${i}.png`);
    }
  }

  // ----------------------
  // Mobile controls
  // ----------------------
  createMobileControls() {
    this.mobileInput = { left: false, right: false, up: false, jumpPressed: false };

    const makeBtn = (x, y, label) => {
      const btn = this.add.circle(x, y, 34, 0x11172e, 0.55).setScrollFactor(0).setDepth(50);
      btn.setStrokeStyle(2, 0xb5c6ff, 0.65);
      const txt = this.add
        .text(x, y, label, { fontSize: "22px", color: "#ffffff", fontStyle: "bold" })
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(51);
      btn.setInteractive({ useHandCursor: true });
      return { btn, txt };
    };

    this.mobileButtons = {
      left: makeBtn(80, this.scale.height - 80, "<"),
      right: makeBtn(170, this.scale.height - 80, ">"),
      jump: makeBtn(this.scale.width - 170, this.scale.height - 80, "^"),
      attack: makeBtn(this.scale.width - 80, this.scale.height - 80, "A"),
    };

    const bindHold = (key, stateKey) => {
      const ref = this.mobileButtons[key].btn;
      ref.on("pointerdown", () => { this.mobileInput[stateKey] = true; ref.setFillStyle(0x2d3b70, 0.75); });
      ref.on("pointerup", () => { this.mobileInput[stateKey] = false; ref.setFillStyle(0x11172e, 0.55); });
      ref.on("pointerout", () => { this.mobileInput[stateKey] = false; ref.setFillStyle(0x11172e, 0.55); });
    };

    bindHold("left", "left");
    bindHold("right", "right");

    this.mobileButtons.jump.btn.on("pointerdown", () => {
      this.mobileInput.up = true;
      this.mobileInput.jumpPressed = true;
      this.mobileButtons.jump.btn.setFillStyle(0x2d3b70, 0.75);
    });
    this.mobileButtons.jump.btn.on("pointerup", () => { this.mobileInput.up = false; this.mobileButtons.jump.btn.setFillStyle(0x11172e, 0.55); });
    this.mobileButtons.jump.btn.on("pointerout", () => { this.mobileInput.up = false; this.mobileButtons.jump.btn.setFillStyle(0x11172e, 0.55); });

    this.mobileButtons.attack.btn.on("pointerdown", () => {
      this.mobileButtons.attack.btn.setFillStyle(0x2d3b70, 0.75);
      if (this.phase === "combat") this.performAttack();
    });
    this.mobileButtons.attack.btn.on("pointerup", () => { this.mobileButtons.attack.btn.setFillStyle(0x11172e, 0.55); });
    this.mobileButtons.attack.btn.on("pointerout", () => { this.mobileButtons.attack.btn.setFillStyle(0x11172e, 0.55); });
  }

  // ----------------------
  // Audio
  // ----------------------
  createAudio() {
    this.audioCtx = null;
    this.input.once("pointerdown", () => {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      this.audioCtx = new AudioCtx();
    });
  }

  playSfx(type) {
    if (!this.audioCtx) return;
    const presets = {
      attack: { f1: 320, f2: 200, d: 0.08, v: 0.05, wave: "square" },
      hit: { f1: 180, f2: 120, d: 0.09, v: 0.06, wave: "sawtooth" },
      kill: { f1: 440, f2: 620, d: 0.12, v: 0.06, wave: "triangle" },
      coin: { f1: 760, f2: 980, d: 0.08, v: 0.05, wave: "sine" },
      jump: { f1: 260, f2: 380, d: 0.1, v: 0.05, wave: "sine" },
      win: { f1: 520, f2: 760, d: 0.22, v: 0.08, wave: "triangle" },
    };
    const p = presets[type] || presets.attack;
    const now = this.audioCtx.currentTime;
    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();
    osc.type = p.wave;
    osc.frequency.setValueAtTime(p.f1, now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(40, p.f2), now + p.d);
    gain.gain.setValueAtTime(p.v, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + p.d);
    osc.connect(gain);
    gain.connect(this.audioCtx.destination);
    osc.start(now);
    osc.stop(now + p.d);
  }
}

const config = {
  type: Phaser.AUTO,
  parent: "game-container",
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: "#060816",
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  physics: {
    default: "arcade",
    arcade: { debug: false },
  },
  scene: [GhostNinjaScene],
};

new Phaser.Game(config);