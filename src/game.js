/* GhostNinja
 * Beginner-friendly Phaser 3 game with two phases:
 * 1) Combat phase (kill 20 enemies)
 * 2) Bridge phase (dodge moving barriers)
 * Then a win celebration screen.
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
    this.combatStarted = false;
    this.bridgeStartX = 120;
    this.bridgeGoalX = 1080;
  }

  preload() {
    // Real game assets.
    this.load.image("bgSpace", "assets/background/space.png");
    this.preloadNinjaFrames();

    this.load.image("ghost", "assets/halloween/ghost_small.png");
    this.load.spritesheet("pumpkinSheet", "assets/halloween/sprite_sheets/png@1x/objects.png", {
      frameWidth: 128,
      frameHeight: 128,
    });
    this.load.image("pumpkin", "assets/halloween/decorations/png@1x/skull.png");
    this.load.image("bat", "assets/halloween/bat.png");
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
    this.createCombatSpawners();
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
    const makeRectTexture = (key, width, height, color) => {
      const g = this.add.graphics();
      g.fillStyle(color, 1);
      g.fillRoundedRect(0, 0, width, height, 10);
      g.generateTexture(key, width, height);
      g.destroy();
    };

    makeRectTexture("fireParticle", 6, 6, 0xff7a00);
    makeRectTexture("coinParticle", 6, 6, 0xffd447);
    makeRectTexture("confettiParticle", 4, 8, 0x66ffcc);
  }

  createAnimations() {
    const makeAnim = (key, frameKeys, frameRate, repeat = -1) => {
      this.anims.create({
        key,
        frames: frameKeys.map((frameKey) => ({ key: frameKey })),
        frameRate,
        repeat,
      });
    };

    makeAnim("ninja-idle", this.ninjaIdleFrames, 8, -1);
    makeAnim("ninja-run", this.ninjaRunFrames, 12, -1);
    makeAnim("ninja-jump", this.ninjaJumpFrames, 12, -1);
    makeAnim("ninja-attack", this.ninjaAttackFrames, 14, 0);
    makeAnim("ninja-dead", this.ninjaDeadFrames, 10, 0);

    if (this.textures.exists("pumpkinSheet")) {
      this.anims.create({
        key: "pumpkin-portal",
        frames: this.anims.generateFrameNumbers("pumpkinSheet", { start: 0, end: 7 }),
        frameRate: 10,
        repeat: -1,
      });
      this.anims.create({
        key: "pumpkin-burst",
        frames: this.anims.generateFrameNumbers("pumpkinSheet", { start: 8, end: 15 }),
        frameRate: 14,
        repeat: 0,
      });
    }

  }

  createBackground() {
    this.background = this.add.tileSprite(0, 0, GAME_WIDTH, GAME_HEIGHT, "bgSpace").setOrigin(0, 0).setScrollFactor(0);
    this.background.setTint(0xa98cff);

    this.createTwinklingStars();
    this.createFloatingBubbles();
  }

  createWorld() {
    // Ground strip for combat (world is wider than the screen).
    this.ground = this.add.rectangle(WORLD_WIDTH / 2, GROUND_Y + 40, WORLD_WIDTH, 120, 0x171329, 0.95);
    this.groundStroke = this.add.rectangle(WORLD_WIDTH / 2, GROUND_Y - 18, WORLD_WIDTH, 8, 0x5a4ea0, 0.65);

    // Solid floor for jump physics.
    this.floor = this.add.rectangle(WORLD_WIDTH / 2, GROUND_Y + 10, WORLD_WIDTH, 20, 0xffffff, 0);
    this.physics.add.existing(this.floor, true);

    // Pumpkins will be created later - give ninja running distance first
    this.pumpkins = [];
    this.pumpkinSpawnTriggered = false;

    this.createCombatEnvironment();
  }

  createNinja() {
    this.ninja = this.physics.add.sprite(130, NINJA_GROUND_Y, this.ninjaIdleFrames[0]);
    this.ninja.setCollideWorldBounds(true);
    this.ninja.setSize(44, 84);
    this.ninja.setOffset(8, 4);
    this.ninja.speed = 280;
    this.ninja.setMaxVelocity(400, 920);
    this.ninja.body.allowGravity = false;
    this.ninja.setDepth(5);
    this.ninja.anims.play("ninja-idle");

    // Sword sprite used for visible swing motion during attack.
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
      if (this.phase === "combat") {
        this.performAttack();
      }
    });
  }

  createUI() {
    // Top bar
    this.topBar = this.add.rectangle(GAME_WIDTH / 2, 26, GAME_WIDTH, 52, 0x0b0b18, 0.72).setScrollFactor(0);

    this.killText = this.add.text(16, 11, "Kills: 0 / 20", {
      fontSize: "22px",
      color: "#f4f2ff",
      fontStyle: "bold",
    }).setScrollFactor(0);

    this.phaseText = this.add.text(GAME_WIDTH / 2 - 85, 11, "PHASE: COMBAT", {
      fontSize: "22px",
      color: "#f39cff",
      fontStyle: "bold",
    }).setScrollFactor(0);

    // Arsenal/power progress bar
    this.arsenalTitle = this.add.text(GAME_WIDTH - 390, 11, "Arsenal Power", {
      fontSize: "18px",
      color: "#ffc9ff",
    }).setScrollFactor(0);
    this.powerBarBg = this.add.rectangle(GAME_WIDTH - 170, 24, 260, 16, 0x2a1b3a).setOrigin(0.5).setScrollFactor(0);
    this.powerBarFill = this.add.rectangle(GAME_WIDTH - 300, 24, 0, 12, 0xff58ce).setOrigin(0, 0.5).setScrollFactor(0);
    this.arsenalLevelText = this.add
      .text(GAME_WIDTH - 390, 33, "Blade Lv. 1", {
        fontSize: "14px",
        color: "#b9ffde",
      })
      .setScrollFactor(0);

    // Coin counter with visual icon
    this.coinIcon = this.add.circle(GAME_WIDTH / 2 - 85, 24, 12, 0xffd447).setScrollFactor(0);
    this.coinIcon.setStrokeStyle(2, 0xff9500, 0.8);
    this.coinText = this.add
      .text(GAME_WIDTH / 2 - 65, 16, "0", {
        fontSize: "20px",
        color: "#fff4c2",
        fontStyle: "bold",
      })
      .setScrollFactor(0);

    this.layoutHud(this.scale.width, this.scale.height);
  }

  createGroups() {
    this.enemies = this.physics.add.group();
    this.barriers = this.physics.add.group();
  }

  createCombatSpawners() {
    // Pumpkins will be spawned dynamically based on player progress
    // No automatic enemy spawning timer needed
  }

  // ----------------------
  // Visual effects
  // ----------------------
  createTwinklingStars() {
    this.stars = [];
    for (let i = 0; i < 80; i += 1) {
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
    for (let i = 0; i < 24; i += 1) {
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

  spawnFireBurst(x, y) {
    const particles = this.add.particles(x, y, "fireParticle", {
      speed: { min: 70, max: 210 },
      angle: { min: 180, max: 360 },
      scale: { start: 1.2, end: 0.1 },
      alpha: { start: 1, end: 0 },
      lifespan: 340,
      quantity: 26,
      emitting: false,
    });
    particles.explode(26, x, y);
    this.time.delayedCall(400, () => particles.destroy());
  }

  showDamageNumber(x, y, amount = 1) {
    const txt = this.add.text(x, y, `-${amount}`, {
      fontSize: "22px",
      color: "#ffd766",
      fontStyle: "bold",
      stroke: "#4b2100",
      strokeThickness: 4,
    });
    this.tweens.add({
      targets: txt,
      y: y - 40,
      alpha: 0,
      duration: 500,
      onComplete: () => txt.destroy(),
    });
  }

  launchWinParticles() {
    // Golden coins
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

    // Colorful confetti
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
    this.syncBodyToSpritePosition();
    this.syncSwordToNinja();
    this.checkPumpkinSpawn();
    this.handlePumpkinProximity();
    this.optimizeEnemyCount();

    this.enemies.children.iterate((enemy) => {
      if (!enemy || !enemy.active) return;
      
      // Only update enemy movement every other frame to reduce lag
      if (this.time.now % 2 === 0) {
        this.physics.moveToObject(enemy, this.ninja, enemy.moveSpeed);
      }

      // Keep enemy movement horizontal for clear beginner visuals.
      enemy.body.velocity.y = 0;
      enemy.y = COMBAT_FLOOR_Y - 44;
    });
  }


  performAttack() {
    if (this.attackInProgress || this.phase !== "combat") return;
    this.attackInProgress = true;
    this.playSfx("attack");

    this.ninja.anims.play("ninja-attack", true);
    this.swingSword();

    // A short sword reach area in front of the ninja.
    const reach = this.ninja.flipX ? -70 : 70;
    const hitX = this.ninja.x + reach;
    const hitY = this.ninja.y;
    const hitZone = new Phaser.Geom.Circle(hitX, hitY, 62);

    this.enemies.children.iterate((enemy) => {
      if (!enemy || !enemy.active) return;
      if (Phaser.Geom.Circle.Contains(hitZone, enemy.x, enemy.y)) {
        enemy.hp -= 1;
        this.playSfx("hit");
        this.spawnFireBurst(enemy.x, enemy.y);
        this.showDamageNumber(enemy.x, enemy.y - 14, 1);

        if (enemy.hp <= 0) {
          enemy.destroy();
          this.killCount += 1;
          this.coins += 10;
          this.playSfx("kill");
          this.playSfx("coin");
          this.updatePowerBar();
          this.updateCoinUI();
          this.killText.setText(`Kills: ${this.killCount} / ${KILLS_TO_BRIDGE}`);
        }
      }
    });

    this.ninja.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
      this.attackInProgress = false;
      this.ninja.anims.play("ninja-idle", true);
    });

    if (this.killCount >= KILLS_TO_BRIDGE) {
      this.startBridgePhase();
    }
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

    const arsenalLevel = 1 + Math.floor(progress * 4);
    this.arsenalLevelText.setText(`Blade Lv. ${arsenalLevel}`);
  }

  // ----------------------
  // Bridge phase
  // ----------------------
  startBridgePhase() {
    if (this.phase !== "combat") return;
    this.phase = "bridge";

    this.phaseText.setText("PHASE: BRIDGE RUN").setColor("#8dffcb");
    this.enemies.clear(true, true);
    this.isJumping = false;
    this.jumpVelocity = 0;
    this.ninja.body.setVelocity(0, 0);
    // No enemy timer to remove anymore

    // Redraw a bridge lane.
    this.ground.fillColor = 0x1f1a2f;
    this.groundStroke.fillColor = 0x8a6cff;

    this.bridgeTrack = this.add.rectangle(
      GAME_WIDTH / 2,
      GROUND_Y - 64,
      GAME_WIDTH - 120,
      160,
      0x2a2047,
      0.85
    );
    this.bridgeTrack.setDepth(-1);

    this.bridgeStartMark = this.add.rectangle(this.bridgeStartX - 18, GROUND_Y - 64, 8, 140, 0x5eff99, 0.8);
    this.bridgeGoalMark = this.add.rectangle(this.bridgeGoalX + 18, GROUND_Y - 64, 8, 140, 0xffd654, 0.8);

    this.ninja.setPosition(this.bridgeStartX, GROUND_Y - 64);
    this.ninja.anims.play("ninja-run", true);

    // Create moving barriers that slide left/right.
    const laneYs = [GROUND_Y - 110, GROUND_Y - 64, GROUND_Y - 18];
    for (let i = 0; i < 8; i += 1) {
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
    this.syncBodyToSpritePosition();
    this.syncSwordToNinja();

    // Keep ninja within bridge lane.
    this.ninja.y = Phaser.Math.Clamp(this.ninja.y, GROUND_Y - 118, GROUND_Y - 10);

    this.barriers.children.iterate((barrier) => {
      if (!barrier || !barrier.active) return;
      barrier.x += barrier.direction * barrier.slideSpeed * (1 / 60);
      if (barrier.x < this.bridgeStartX + 80 || barrier.x > this.bridgeGoalX - 30) {
        barrier.direction *= -1;
      }
    });

    if (this.ninja.x >= this.bridgeGoalX) {
      this.showWinScreen();
    }
  }

  onBridgeBarrierHit() {
    if (this.bridgeRecovering || this.phase !== "bridge") return;
    this.bridgeRecovering = true;

    // Send player back to bridge start.
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
  // Win phase
  // ----------------------
  showWinScreen() {
    if (this.phase === "win") return;
    this.phase = "win";
    this.playSfx("win");
    this.phaseText.setText("PHASE: VICTORY!").setColor("#ffe070");
    this.barriers.clear(true, true);

    const overlay = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x05030c, 0.65);
    overlay.setDepth(20);

    const title = this.add
      .text(GAME_WIDTH / 2, 200, "GHOSTNINJA WINS!", {
        fontSize: "72px",
        color: "#ffe9a8",
        fontStyle: "bold",
        stroke: "#2c1450",
        strokeThickness: 8,
      })
      .setOrigin(0.5)
      .setDepth(21);

    const prize = this.add
      .text(GAME_WIDTH / 2, 300, "Cash Prize Unlocked: $999,999", {
        fontSize: "42px",
        color: "#8dffb0",
        fontStyle: "bold",
        stroke: "#143a22",
        strokeThickness: 6,
      })
      .setOrigin(0.5)
      .setDepth(21);

    const tip = this.add
      .text(GAME_WIDTH / 2, 380, "Refresh page to play again", {
        fontSize: "26px",
        color: "#d8ccff",
      })
      .setOrigin(0.5)
      .setDepth(21);

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
  // Shared helpers
  // ----------------------
  updateBubbles() {
    for (const bubble of this.bubbles) {
      bubble.y -= bubble.speed;
      bubble.x += bubble.drift;

      if (bubble.y < -30) {
        bubble.y = GAME_HEIGHT + Phaser.Math.Between(10, 60);
        bubble.x = Phaser.Math.Between(0, GAME_WIDTH);
      }
      if (bubble.x < -20) bubble.x = GAME_WIDTH + 10;
      if (bubble.x > GAME_WIDTH + 20) bubble.x = -10;
    }
  }

  handleMovement(allowVertical = false) {
    if (this.bridgeRecovering) return;

    const mobile = this.mobileInput || { left: false, right: false, up: false, jumpPressed: false };
    const left = this.cursors.left.isDown || this.keys.a.isDown || mobile.left;
    const right = this.cursors.right.isDown || this.keys.d.isDown || mobile.right;
    const up = this.cursors.up.isDown || this.keys.w.isDown || mobile.up;
    const down = this.cursors.down.isDown || this.keys.s.isDown;
    const movingVertical = allowVertical && (up || down);
    const jumpPressed =
      Phaser.Input.Keyboard.JustDown(this.cursors.up) ||
      Phaser.Input.Keyboard.JustDown(this.keys.w) ||
      mobile.jumpPressed;
    const dt = this.game.loop.delta / 1000;
    const moveStep = this.ninja.speed * dt;

    // Allow movement during attack - just don't change animation
    if (left) {
      this.ninja.x -= moveStep;
      this.ninja.setFlipX(true);
      if (!this.attackInProgress) this.ninja.anims.play("ninja-run", true);
    } else if (right) {
      this.ninja.x += moveStep;
      this.ninja.setFlipX(false);
      if (!this.attackInProgress) this.ninja.anims.play("ninja-run", true);
    } else if (!this.attackInProgress && !movingVertical) {
      this.ninja.anims.play("ninja-idle", true);
    }

    if (allowVertical) {
      if (up) this.ninja.y -= this.ninja.speed * 0.6 * dt;
      if (down) this.ninja.y += this.ninja.speed * 0.6 * dt;
      if (movingVertical && !this.attackInProgress) {
        this.ninja.anims.play("ninja-jump", true);
      }
    }

    if (this.phase === "combat") {
      if (jumpPressed && !this.isJumping) {
        this.jumpVelocity = -620;
        this.isJumping = true;
        this.playSfx("jump");
        if (!this.attackInProgress) this.ninja.anims.play("ninja-jump", true);
      }
      // Keep physics body synced with the manually-controlled jump Y.
      this.ninja.body.y = this.ninja.y - this.ninja.displayHeight * this.ninja.originY;
      mobile.jumpPressed = false;
    }

    const maxX = this.phase === "combat" ? WORLD_WIDTH - 30 : GAME_WIDTH - 30;
    this.ninja.x = Phaser.Math.Clamp(this.ninja.x, 30, maxX);
  }

  preloadNinjaFrames() {
    this.ninjaIdleFrames = [
      "ninja-idle-1",
      "ninja-idle-2",
      "ninja-idle-3",
      "ninja-idle-4",
      "ninja-idle-5",
      "ninja-idle-6",
      "ninja-idle-7",
      "ninja-idle-8",
      "ninja-idle-9",
    ];
    this.ninjaRunFrames = [
      "ninja-run-1",
      "ninja-run-2",
      "ninja-run-3",
      "ninja-run-4",
      "ninja-run-5",
      "ninja-run-6",
      "ninja-run-7",
      "ninja-run-8",
      "ninja-run-9",
    ];
    this.ninjaAttackFrames = [
      "ninja-attack-1",
      "ninja-attack-2",
      "ninja-attack-3",
      "ninja-attack-4",
      "ninja-attack-5",
      "ninja-attack-6",
      "ninja-attack-7",
      "ninja-attack-8",
      "ninja-attack-9",
    ];
    this.ninjaJumpFrames = [
      "ninja-jump-1",
      "ninja-jump-2",
      "ninja-jump-3",
      "ninja-jump-4",
      "ninja-jump-5",
      "ninja-jump-6",
      "ninja-jump-7",
      "ninja-jump-8",
      "ninja-jump-9",
    ];
    this.ninjaDeadFrames = [
      "ninja-dead-1",
      "ninja-dead-2",
      "ninja-dead-3",
      "ninja-dead-4",
      "ninja-dead-5",
      "ninja-dead-6",
      "ninja-dead-7",
      "ninja-dead-8",
      "ninja-dead-9",
    ];

    const idlePaths = [
      "assets/ninja/idle/NEWNJIDLE.png",
      "assets/ninja/idle/NEWNJIDLE2.png",
      "assets/ninja/idle/NEWNJIDLE3.png",
      "assets/ninja/idle/NEWNJIDLE4.png",
      "assets/ninja/idle/NEWNJIDLE5.png",
      "assets/ninja/idle/NEWNJIDLE6.png",
      "assets/ninja/idle/NEWNJIDLE7.png",
      "assets/ninja/idle/NEWNJIDLE8.png",
      "assets/ninja/idle/NEWNJIDLE9.png",
    ];
    idlePaths.forEach((path, i) => this.load.image(this.ninjaIdleFrames[i], path));

    for (let i = 1; i <= 9; i += 1) {
      this.load.image(`ninja-run-${i}`, `assets/ninja/NEWrun/${i}.png`);
      this.load.image(`ninja-attack-${i}`, `assets/ninja/attack/${i}.png`);
      this.load.image(`ninja-jump-${i}`, `assets/ninja/jump/${i}.png`);
      this.load.image(`ninja-dead-${i}`, `assets/ninja/dead/${i}.png`);
    }
  }

  createCombatEnvironment() {
    // Sprinkle environment props through the long combat world.
    const treeKeys = ["tree_big.png", "tree_medium.png", "tree_small.png"];
    for (let x = 220; x < WORLD_WIDTH - 120; x += Phaser.Math.Between(240, 420)) {
      const key = Phaser.Utils.Array.GetRandom(treeKeys);
      if (!this.textures.exists(key)) continue;
      this.add.image(x, GROUND_Y - 100, key).setScale(0.5).setAlpha(0.4).setDepth(1);
    }
  }

  setupCamera() {
    this.physics.world.setBounds(0, 0, WORLD_WIDTH, GAME_HEIGHT);
    this.cameras.main.setBounds(0, 0, WORLD_WIDTH, GAME_HEIGHT);
    this.cameras.main.startFollow(this.ninja, true, 0.1, 0);
    this.cameras.main.setDeadzone(230, 120);
    this.scale.on("resize", this.onResize, this);
    this.onResize({ width: this.scale.width, height: this.scale.height });
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

  updateManualJump() {
    if (!this.isJumping) {
      this.ninja.y = NINJA_GROUND_Y;
      this.ninja.body.y = this.ninja.y - this.ninja.displayHeight * this.ninja.originY;
      return;
    }

    // Manual jump arc: only moves when player triggers jump.
    this.jumpVelocity += 1400 * (1 / 60);
    this.ninja.y += this.jumpVelocity * (1 / 60);

    if (this.ninja.y >= NINJA_GROUND_Y) {
      this.ninja.y = NINJA_GROUND_Y;
      this.isJumping = false;
      this.jumpVelocity = 0;
      this.ninja.body.y = this.ninja.y - this.ninja.displayHeight * this.ninja.originY;
      if (!this.attackInProgress && !this.cursors.left.isDown && !this.cursors.right.isDown && !this.keys.a.isDown && !this.keys.d.isDown) {
        this.ninja.anims.play("ninja-idle", true);
      }
    }
  }

  syncBodyToSpritePosition() {
    if (!this.ninja || !this.ninja.body) return;
    this.ninja.body.reset(this.ninja.x, this.ninja.y);
  }

  createMobileControls() {
    this.mobileInput = {
      left: false,
      right: false,
      up: false,
      jumpPressed: false,
      attack: false,
    };

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

    // Bottom layout for comfortable two-thumb control.
    this.mobileButtons = {
      left: makeBtn(80, this.scale.height - 80, "<"),
      right: makeBtn(170, this.scale.height - 80, ">"),
      jump: makeBtn(this.scale.width - 170, this.scale.height - 80, "^"),
      attack: makeBtn(this.scale.width - 80, this.scale.height - 80, "A"),
    };

    const bindHold = (key, stateKey) => {
      const ref = this.mobileButtons[key].btn;
      ref.on("pointerdown", () => {
        this.mobileInput[stateKey] = true;
        ref.setFillStyle(0x2d3b70, 0.75);
      });
      ref.on("pointerup", () => {
        this.mobileInput[stateKey] = false;
        ref.setFillStyle(0x11172e, 0.55);
      });
      ref.on("pointerout", () => {
        this.mobileInput[stateKey] = false;
        ref.setFillStyle(0x11172e, 0.55);
      });
    };

    bindHold("left", "left");
    bindHold("right", "right");

    this.mobileButtons.jump.btn.on("pointerdown", () => {
      this.mobileInput.up = true;
      this.mobileInput.jumpPressed = true;
      this.mobileButtons.jump.btn.setFillStyle(0x2d3b70, 0.75);
    });
    this.mobileButtons.jump.btn.on("pointerup", () => {
      this.mobileInput.up = false;
      this.mobileButtons.jump.btn.setFillStyle(0x11172e, 0.55);
    });
    this.mobileButtons.jump.btn.on("pointerout", () => {
      this.mobileInput.up = false;
      this.mobileButtons.jump.btn.setFillStyle(0x11172e, 0.55);
    });

    this.mobileButtons.attack.btn.on("pointerdown", () => {
      this.mobileButtons.attack.btn.setFillStyle(0x2d3b70, 0.75);
      if (this.phase === "combat") this.performAttack();
    });
    this.mobileButtons.attack.btn.on("pointerup", () => {
      this.mobileButtons.attack.btn.setFillStyle(0x11172e, 0.55);
    });
    this.mobileButtons.attack.btn.on("pointerout", () => {
      this.mobileButtons.attack.btn.setFillStyle(0x11172e, 0.55);
    });
  }

  onResize(gameSize) {
    const width = gameSize.width || this.scale.width;
    const height = gameSize.height || this.scale.height;
    this.cameras.resize(width, height);
    this.layoutHud(width, height);
    this.layoutMobileControls(width, height);
    if (this.background) {
      this.background.setSize(width, height);
    }
  }

  layoutHud(width, _height) {
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
    const setPos = (obj, x, y) => {
      obj.btn.setPosition(x, y);
      obj.txt.setPosition(x, y);
    };
    // Keep controls near lower corners; scale size with screen.
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

  createPumpkinPortal(x, y, scale = 1) {
    if (this.anims.exists("pumpkin-portal")) {
      const sprite = this.add.sprite(x, y, "pumpkinSheet", 0).setScale(scale).setAlpha(0.98);
      sprite.setTint(0xff9a2e);
      sprite.play("pumpkin-portal");
      return sprite;
    }
    return this.add.image(x, y, "pumpkin").setScale(scale).setAlpha(0.98).setTint(0xff8d2b);
  }

  checkPumpkinSpawn() {
    // Spawn pumpkins when ninja reaches certain distance to give running room
    if (!this.pumpkinSpawnTriggered && this.ninja.x > 600) {
      this.pumpkinSpawnTriggered = true;
      // Create pumpkins ahead of the player
      for (let x = Math.max(800, this.ninja.x + 200); x <= WORLD_WIDTH - 220; x += 420) {
        this.pumpkins.push(this.createPumpkinPortal(x, GROUND_Y - 20, 1.05));
      }
    }
  }

  optimizeEnemyCount() {
    const maxEnemies = 8;
    const cullDistance = 800;
    
    // Remove enemies that are too far away from the ninja
    this.enemies.children.iterate((enemy) => {
      if (!enemy || !enemy.active) return;
      
      const distance = Math.abs(enemy.x - this.ninja.x);
      if (distance > cullDistance) {
        enemy.destroy();
      }
    });
    
    // If we still have too many enemies, remove the oldest ones
    const activeEnemies = this.enemies.getChildren().filter(e => e && e.active);
    if (activeEnemies.length > maxEnemies) {
      const enemiesToRemove = activeEnemies.length - maxEnemies;
      for (let i = 0; i < enemiesToRemove; i++) {
        activeEnemies[i].destroy();
      }
    }
  }

  handlePumpkinProximity() {
    if (this.phase !== "combat") return;
    
    // Only check proximity every few frames to reduce lag
    if (this.time.now % 3 !== 0) return;
    
    for (const pumpkin of this.pumpkins) {
      if (!pumpkin || !pumpkin.visible) continue;
      
      // Only spawn enemies when ninja gets close to pumpkin
      const distance = Math.abs(this.ninja.x - pumpkin.x);
      if (distance < 120) {
        this.spawnEnemyFromPumpkinAt(pumpkin);
      }
    }
  }

  spawnEnemyFromPumpkinAt(pumpkin) {
    if (!pumpkin) return;
    if (pumpkin.nextSpawnAt && this.time.now < pumpkin.nextSpawnAt) return;
    
    // Increase spawn cooldown to reduce frequent spawning
    pumpkin.nextSpawnAt = this.time.now + 4000;

    if (pumpkin.anims) {
      pumpkin.play("pumpkin-burst", true);
      pumpkin.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => pumpkin.play("pumpkin-portal", true));
    }

    const isGhost = Phaser.Math.Between(0, 100) < 60;
    const key = isGhost ? "ghost" : "bat";
    
    // Create enemy completely independent from pumpkin
    const enemy = this.enemies.create(pumpkin.x, pumpkin.y - 30, key);
    enemy.setScale(isGhost ? 0.9 : 0.8);
    enemy.setData("type", isGhost ? "ghost" : "bat");
    enemy.moveSpeed = Phaser.Math.Between(50, 110);
    enemy.hp = isGhost ? 2 : 1;
    enemy.setDepth(2);
    enemy.body.allowGravity = false;
    enemy.body.setSize(enemy.width * 0.65, enemy.height * 0.7);
    
    // Enemy is now completely separate from pumpkin
    return enemy;
  }

  updateCoinUI() {
    this.coinText.setText(String(this.coins));
    // Add a little bounce effect when coins are earned
    if (this.coins > 0 && this.coins % 10 === 0) {
      this.tweens.add({
        targets: [this.coinIcon, this.coinText],
        scaleX: 1.3,
        scaleY: 1.3,
        duration: 150,
        yoyo: true,
        ease: "Back.easeOut"
      });
    }
  }

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
    arcade: {
      debug: false,
    },
  },
  scene: [GhostNinjaScene],
};

new Phaser.Game(config);
