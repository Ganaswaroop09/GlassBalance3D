/**
 * Glass Balance 3D - Glass Bridge Course & Movement System
 * Input-driven movement system with exact zero-drift and safe touch release
 */

(function () {
  'use strict';

  // --- AUDIO SYNTHESIZER ---
  class SoundManager {
    constructor() {
      this.ctx = null;
      this.initOnFirstTouch = false;
    }

    init() {
      if (this.ctx) return;
      try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AudioCtx();
      } catch (e) {}
    }

    playRoll() {
      // Subtle roll click
    }

    playCheckpoint() {
      if (!this.ctx) return;
      try {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(587.33, this.ctx.currentTime); // D5
        osc.frequency.exponentialRampToValueAtTime(880, this.ctx.currentTime + 0.25); // A5
        gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.3);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.3);
      } catch (e) {}
    }

    playFall() {
      if (!this.ctx) return;
      try {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(320, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(60, this.ctx.currentTime + 0.45);
        gain.gain.setValueAtTime(0.25, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.5);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.5);
      } catch (e) {}
    }

    playVictory() {
      if (!this.ctx) return;
      try {
        [523.25, 659.25, 783.99, 1046.5].forEach((freq, idx) => {
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.value = freq;
          const start = this.ctx.currentTime + idx * 0.1;
          gain.gain.setValueAtTime(0.2, start);
          gain.gain.exponentialRampToValueAtTime(0.001, start + 0.45);
          osc.connect(gain);
          gain.connect(this.ctx.destination);
          osc.start(start);
          osc.stop(start + 0.45);
        });
      } catch (e) {}
    }
  }

  // --- PROCEDURAL CURVE GENERATOR UTILITIES ---
  // Precise trigonometric functions with C1 continuity for turns, 90-degree corners, zigzags, S-curves, and spirals
  const curveUtils = {
    // Single smooth turn of given angle in degrees over distance L starting at s0
    turn: (s, s0, L, degrees) => {
      if (s >= s0 && s <= s0 + L) {
        const rad = (degrees * Math.PI) / 180;
        const amp = (rad * Math.PI) / (2 * 0.15 * L);
        return amp * Math.sin(((s - s0) / L) * Math.PI);
      }
      return 0;
    },

    // Zigzag section with N alternating swings (LEFT -> RIGHT -> LEFT -> RIGHT)
    zigzag: (s, s0, count, swingLen, degrees) => {
      const totalLen = count * swingLen;
      if (s >= s0 && s <= s0 + totalLen) {
        const rad = (degrees * Math.PI) / 180;
        const amp = (rad * Math.PI) / (2 * 0.15 * swingLen);
        return amp * Math.sin(((s - s0) / swingLen) * Math.PI);
      }
      return 0;
    },

    // S-shaped section: smooth Left curve followed immediately by Right curve
    sCurve: (s, s0, halfLen, degrees) => {
      const totalLen = 2 * halfLen;
      if (s >= s0 && s <= s0 + totalLen) {
        const rad = (degrees * Math.PI) / 180;
        const amp = (rad * Math.PI) / (2 * 0.15 * halfLen);
        return amp * Math.sin(((s - s0) / halfLen) * Math.PI);
      }
      return 0;
    },

    // Grand Spiral / Helix: continuous progressive curvature sweeping through totalDegrees
    spiral: (s, s0, length, totalDegrees) => {
      if (s >= s0 && s <= s0 + length) {
        const rad = (totalDegrees * Math.PI) / 180;
        const amp = (2 * rad) / (0.15 * length);
        const u = ((s - s0) / length) * Math.PI;
        return amp * Math.sin(u) * Math.sin(u);
      }
      return 0;
    }
  };

  // --- COURSE / LEVEL TRACK DEFINITIONS (8 DISTINCT LEVELS WITH DISTANCE PROGRESSION) ---
  const COURSES = [
    {
      id: 1,
      name: 'Crystal Highway',
      speed: 7.2,
      totalLength: 140, // Shortest
      width: 4.2,
      checkpoints: [42, 88],
      gaps: [
        { sStart: 52, sEnd: 60, laneStart: -2.1, laneEnd: 0.525 }, // Left side gap (62.5% width)
        { sStart: 104, sEnd: 112, laneStart: -0.525, laneEnd: 2.1 } // Right side gap (62.5% width)
      ],
      curveAt: (s) => {
        let k = 0;
        k += curveUtils.sCurve(s, 20, 10, 35);        // Gentle introductory S-curve
        k += curveUtils.turn(s, 62, 16, 58);          // Sharp right turn (> 45 degrees)
        k += curveUtils.turn(s, 94, 14, -50);         // Compensating left turn
        k += curveUtils.turn(s, 116, 14, 25);         // Approach curve
        return k;
      }
    },
    {
      id: 2,
      name: 'Emerald Overpass',
      speed: 7.6,
      totalLength: 200, // Longer
      width: 4.0,
      checkpoints: [46, 102, 154],
      gaps: [
        { sStart: 72, sEnd: 80, laneStart: -2.0, laneEnd: 0.5 },     // Left gap (62.5%)
        { sStart: 118, sEnd: 126, laneStart: -0.5, laneEnd: 2.0 },   // Right gap (62.5%)
        { sStart: 168, sEnd: 176, laneStart: -1.25, laneEnd: 1.25 }  // Center gap (62.5%)
      ],
      curveAt: (s) => {
        let k = 0;
        k += curveUtils.zigzag(s, 24, 4, 11, 55);     // Strong zigzag section: 4 alternating swings (LEFT -> RIGHT -> LEFT -> RIGHT)
        k += curveUtils.turn(s, 84, 16, 65);          // Sharp 65° right turn
        k += curveUtils.sCurve(s, 128, 12, 50);       // Smooth S-curve
        k += curveUtils.turn(s, 178, 14, -55);        // Sharp 55° left turn
        return k;
      }
    },
    {
      id: 3,
      name: 'Sapphire Skyline',
      speed: 8.0,
      totalLength: 270, // Longer
      width: 3.8,
      checkpoints: [48, 106, 166, 222],
      gaps: [
        { sStart: 66, sEnd: 74, laneStart: -0.475, laneEnd: 1.9 },     // Right gap (62.5%)
        { sStart: 124, sEnd: 132, laneStart: -1.9, laneEnd: 0.475 },   // Left gap (62.5%)
        { sStart: 184, sEnd: 192, laneStart: -1.1875, laneEnd: 1.1875 },// Center gap (62.5%)
        { sStart: 236, sEnd: 244, laneStart: -1.9, laneEnd: 0.475 }    // Left gap (62.5%)
      ],
      curveAt: (s) => {
        let k = 0;
        k += curveUtils.zigzag(s, 20, 3, 12, 58);     // Fast opening zigzag (3 swings)
        k += curveUtils.sCurve(s, 76, 20, 65);        // Wide S-shaped curve
        k += curveUtils.zigzag(s, 134, 4, 10, 55);    // Second rapid zigzag (4 swings)
        k += curveUtils.turn(s, 194, 16, 70);         // Sharp right turn (70°)
        k += curveUtils.turn(s, 224, 16, -68);        // Sharp left turn (68°)
        k += curveUtils.turn(s, 248, 12, 40);         // Straightening curve
        return k;
      }
    },
    {
      id: 4,
      name: 'Ruby Labyrinth',
      speed: 8.3,
      totalLength: 350, // Significantly longer
      width: 3.6,
      checkpoints: [48, 108, 172, 234, 298],
      gaps: [
        { sStart: 50, sEnd: 58, laneStart: -1.8, laneEnd: 0.45 },     // Left gap (62.5%)
        { sStart: 110, sEnd: 118, laneStart: -1.125, laneEnd: 1.125 }, // Center gap (62.5%)
        { sStart: 174, sEnd: 182, laneStart: -0.45, laneEnd: 1.8 },   // Right gap (62.5%)
        { sStart: 236, sEnd: 244, laneStart: -1.8, laneEnd: 0.45 },   // Left gap (62.5%)
        { sStart: 310, sEnd: 318, laneStart: -1.125, laneEnd: 1.125 }  // Center gap (62.5%)
      ],
      curveAt: (s) => {
        let k = 0;
        k += curveUtils.turn(s, 32, 14, 90);          // FIRST GENUINE 90° RIGHT TURN!
        k += curveUtils.sCurve(s, 60, 18, 60);        // S-shaped section
        k += curveUtils.turn(s, 118, 16, -75);        // Sharp 75° left turn
        k += curveUtils.zigzag(s, 136, 4, 9, 62);     // 4-Stage intense zigzag
        k += curveUtils.turn(s, 198, 14, -90);        // SECOND GENUINE 90° LEFT TURN!
        k += curveUtils.sCurve(s, 246, 18, 58);       // Smooth S-curve
        k += curveUtils.turn(s, 284, 16, 65);         // Sharp approach turn
        k += curveUtils.turn(s, 320, 18, -40);        // Level-off curve
        return k;
      }
    },
    {
      id: 5,
      name: 'Obsidian Ridge',
      speed: 8.6,
      totalLength: 440, // Very long
      width: 3.4,
      checkpoints: [52, 116, 180, 246, 316, 380],
      gaps: [
        { sStart: 54, sEnd: 62, laneStart: -1.0625, laneEnd: 1.0625 }, // Center gap (62.5%)
        { sStart: 120, sEnd: 128, laneStart: -1.7, laneEnd: 0.425 },   // Left gap (62.5%)
        { sStart: 184, sEnd: 192, laneStart: -0.425, laneEnd: 1.7 },   // Right gap (62.5%)
        { sStart: 250, sEnd: 258, laneStart: -1.0625, laneEnd: 1.0625 },// Center gap (62.5%)
        { sStart: 320, sEnd: 328, laneStart: -1.7, laneEnd: 0.425 },   // Left gap (62.5%)
        { sStart: 384, sEnd: 392, laneStart: -0.425, laneEnd: 1.7 }    // Right gap (62.5%)
      ],
      curveAt: (s) => {
        let k = 0;
        k += curveUtils.turn(s, 34, 14, -90);         // 90° LEFT TURN
        k += curveUtils.zigzag(s, 66, 5, 9, 60);      // Extended zigzag (5 swings)
        k += curveUtils.turn(s, 130, 14, 90);         // 90° RIGHT TURN
        k += curveUtils.sCurve(s, 146, 18, 65);       // S-shaped section 1
        k += curveUtils.turn(s, 194, 16, -80);        // Sharp 80° turn
        k += curveUtils.turn(s, 214, 28, 75);         // Long curving bend
        k += curveUtils.turn(s, 260, 14, 90);         // 90° RIGHT TURN
        k += curveUtils.sCurve(s, 280, 17, -60);      // S-shaped section 2
        k += curveUtils.zigzag(s, 330, 5, 9, 58);     // Winding slalom zigzag
        k += curveUtils.turn(s, 394, 28, -65);        // Sweeping finish curve
        return k;
      }
    },
    {
      id: 6,
      name: 'Vortex Skyway',
      speed: 8.8,
      totalLength: 530, // Extremely long
      width: 3.3,
      checkpoints: [50, 112, 172, 252, 320, 390, 460],
      gaps: [
        { sStart: 70, sEnd: 78, laneStart: -0.4125, laneEnd: 1.65 },  // Right gap (62.5%)
        { sStart: 114, sEnd: 122, laneStart: -1.65, laneEnd: 0.4125 },// Left gap (62.5%)
        { sStart: 162, sEnd: 170, laneStart: -1.03125, laneEnd: 1.03125 }, // Center gap (62.5%)
        { sStart: 274, sEnd: 282, laneStart: -0.4125, laneEnd: 1.65 },// Right gap (62.5%)
        { sStart: 334, sEnd: 342, laneStart: -1.65, laneEnd: 0.4125 },// Left gap (62.5%)
        { sStart: 394, sEnd: 402, laneStart: -1.03125, laneEnd: 1.03125 }, // Center gap (62.5%)
        { sStart: 472, sEnd: 480, laneStart: -1.65, laneEnd: 0.4125 } // Left gap (62.5%)
      ],
      curveAt: (s) => {
        let k = 0;
        k += curveUtils.sCurve(s, 26, 19, 62);        // Opening S-curve
        k += curveUtils.turn(s, 80, 14, 90);          // 90° RIGHT TURN
        k += curveUtils.zigzag(s, 124, 4, 9, 65);     // Fast zigzag (4 swings)
        k += curveUtils.spiral(s, 176, 70, 270);      // 270° GRAND SKY SPIRAL LOOP!
        k += curveUtils.turn(s, 258, 14, -90);        // 90° LEFT TURN exiting spiral
        k += curveUtils.sCurve(s, 284, 20, 65);       // S-shaped section 1
        k += curveUtils.sCurve(s, 344, 20, -65);      // S-shaped section 2
        k += curveUtils.zigzag(s, 406, 5, 9, 68);     // Rapid alternating zigzags
        k += curveUtils.turn(s, 482, 18, 80);         // Sharp 80° turn
        k += curveUtils.turn(s, 504, 16, -60);        // Approach turn
        return k;
      }
    },
    {
      id: 7,
      name: 'Celestial Spiral',
      speed: 9.0,
      totalLength: 620, // Very long and complex
      width: 3.2,
      checkpoints: [52, 114, 172, 238, 310, 380, 452, 530],
      gaps: [
        { sStart: 54, sEnd: 62, laneStart: -1.0, laneEnd: 1.0 },    // Center gap (62.5%)
        { sStart: 116, sEnd: 124, laneStart: -1.6, laneEnd: 0.4 },  // Left gap (62.5%)
        { sStart: 162, sEnd: 170, laneStart: -0.4, laneEnd: 1.6 },  // Right gap (62.5%)
        { sStart: 242, sEnd: 250, laneStart: -1.0, laneEnd: 1.0 },  // Center gap (62.5%)
        { sStart: 346, sEnd: 354, laneStart: -1.6, laneEnd: 0.4 },  // Left gap (62.5%)
        { sStart: 384, sEnd: 392, laneStart: -0.4, laneEnd: 1.6 },  // Right gap (62.5%)
        { sStart: 456, sEnd: 464, laneStart: -1.0, laneEnd: 1.0 },  // Center gap (62.5%)
        { sStart: 544, sEnd: 552, laneStart: -1.6, laneEnd: 0.4 }   // Left gap (62.5%)
      ],
      curveAt: (s) => {
        let k = 0;
        k += curveUtils.turn(s, 34, 14, -90);         // 90° LEFT TURN
        k += curveUtils.zigzag(s, 64, 4, 10, 65);     // Zigzag 1
        k += curveUtils.turn(s, 106, 14, 90);         // 90° RIGHT TURN
        k += curveUtils.sCurve(s, 126, 17, 60);       // S-shaped section 1
        k += curveUtils.spiral(s, 174, 50, 180);      // SPIRAL 1 (180° Sky Arc)
        k += curveUtils.zigzag(s, 226, 3, 10, 68);    // Zigzag 2
        k += curveUtils.spiral(s, 260, 65, 360);      // SPIRAL 2 (Grand 360° Complete Loop)
        k += curveUtils.turn(s, 330, 14, -90);        // 90° LEFT TURN
        k += curveUtils.sCurve(s, 356, 20, 68);       // S-shaped section 2
        k += curveUtils.turn(s, 402, 16, 75);         // Sharp turn right 75°
        k += curveUtils.turn(s, 428, 16, -75);        // Sharp turn left 75°
        k += curveUtils.zigzag(s, 466, 5, 9, 65);     // Zigzag 3
        k += curveUtils.turn(s, 514, 14, 90);         // 90° RIGHT TURN
        k += curveUtils.sCurve(s, 554, 25, -70);      // Climax winding curves
        return k;
      }
    },
    {
      id: 8,
      name: 'The Glass Apex',
      speed: 9.2,
      totalLength: 720, // Longest course, hardest level
      width: 3.0,
      checkpoints: [50, 114, 180, 246, 318, 396, 472, 546, 626],
      gaps: [
        { sStart: 52, sEnd: 60, laneStart: -0.9375, laneEnd: 0.9375 }, // Center gap (62.5%)
        { sStart: 116, sEnd: 124, laneStart: -1.5, laneEnd: 0.375 },   // Left gap (62.5%)
        { sStart: 182, sEnd: 190, laneStart: -0.375, laneEnd: 1.5 },   // Right gap (62.5%)
        { sStart: 236, sEnd: 244, laneStart: -0.9375, laneEnd: 0.9375 },// Center gap (62.5%)
        { sStart: 320, sEnd: 328, laneStart: -1.5, laneEnd: 0.375 },   // Left gap (62.5%)
        { sStart: 398, sEnd: 406, laneStart: -0.375, laneEnd: 1.5 },   // Right gap (62.5%)
        { sStart: 474, sEnd: 482, laneStart: -0.9375, laneEnd: 0.9375 },// Center gap (62.5%)
        { sStart: 548, sEnd: 556, laneStart: -1.5, laneEnd: 0.375 },   // Left gap (62.5%)
        { sStart: 628, sEnd: 636, laneStart: -0.375, laneEnd: 1.5 }    // Right gap (62.5%)
      ],
      curveAt: (s) => {
        let k = 0;
        k += curveUtils.turn(s, 34, 14, 90);          // 90° RIGHT TURN 1
        k += curveUtils.zigzag(s, 62, 5, 9, 65);      // Complex Zigzag 1
        k += curveUtils.turn(s, 118, 14, -90);        // 90° LEFT TURN 2
        k += curveUtils.sCurve(s, 136, 20, 68);       // S-shaped section 1
        k += curveUtils.zigzag(s, 184, 4, 10, 72);    // Zigzag 2 (72° swings)
        k += curveUtils.spiral(s, 248, 66, 360);      // GRAND 360° SKY SPIRAL LOOP
        k += curveUtils.turn(s, 322, 14, 90);         // 90° RIGHT TURN 3
        k += curveUtils.sCurve(s, 340, 20, -68);      // S-shaped section 2
        k += curveUtils.zigzag(s, 408, 5, 9, 70);     // Zigzag 3
        k += curveUtils.spiral(s, 456, 66, -270);     // DESCENDING 270° HELIX SPIRAL
        k += curveUtils.turn(s, 526, 14, -90);        // 90° LEFT TURN 4
        k += curveUtils.sCurve(s, 558, 20, 70);       // S-shaped section 3
        k += curveUtils.turn(s, 602, 12, -75);        // Sharp slalom left
        k += curveUtils.turn(s, 616, 12, 75);         // Sharp slalom right
        k += curveUtils.zigzag(s, 638, 4, 10, 75);    // Final intense zigzag 4
        k += curveUtils.turn(s, 684, 24, -45);        // Victory grand approach
        return k;
      }
    }
  ];

  // --- GAME WORLD CLASS ---
  class GameWorld {
    constructor() {
      this.sound = new SoundManager();
      this.container = document.getElementById('canvas-container');

      this.currentLevelIndex = 0;
      this.course = COURSES[this.currentLevelIndex];
      this.trackCache = [];
      this.precomputeTrack();

      // Input Controls Set - tracks active pressed directions: 'up', 'down', 'left', 'right'
      this.controls = new Set();

      this.isPaused = false;
      this.levelStartGraceTimer = 0;

      // State initialized safely
      this.state = this.createState();

      // Active checkpoint for respawning
      this.lastCheckpointS = 0;

      // Three.js instances
      this.scene = null;
      this.camera = null;
      this.renderer = null;

      // 3D Meshes
      this.ballMesh = null;
      this.ballRadius = 0.5;
      this.bridgeGroup = null;
      this.checkpointMarkers = [];

      // --- 360-DEGREE THIRD-PERSON ORBIT CAMERA SYSTEM ---
      // Completely independent from ball movement direction.
      // yaw: horizontal rotation angle around ball in radians (free 360-degree rotation)
      // pitch: vertical elevation angle in radians (clamped to prevent flipping)
      // distance: camera distance from ball
      this.camYaw = 0.0;
      this.camPitch = 0.35; // gentle downward angle viewing ball & track
      this.camDistance = 7.5;
      this.camTargetYaw = 0.0;
      this.camTargetPitch = 0.35;

      // Pointer drag tracking for camera rotation
      this.isCamDragging = false;
      this.activeCamPointerId = null;
      this.camLastPointerX = 0;
      this.camLastPointerY = 0;

      this.initThree();
      this.initCourse3D();
      this.initDOM();
      this.initInputListeners();

      this.startLevel(0);
    }

    createState() {
      return {
        x: 0,
        z: 0,
        s: 0,
        vx: 0,
        vz: 0,
        hintIdx: 0,
        isFalling: false,
        fallVelocity: 0,
        fallY: 0,
        score: 0,
        completed: false,
        activeCheckpoints: new Set()
      };
    }

    // --- THREE.JS INITIALIZATION ---
    initThree() {
      const width = window.innerWidth;
      const height = window.innerHeight;

      this.scene = new THREE.Scene();
      // Bright sky background and atmospheric horizon haze
      this.scene.background = new THREE.Color(0xBAE6FD);
      this.scene.fog = new THREE.FogExp2(0xCBE8FA, 0.0055);

      this.camera = new THREE.PerspectiveCamera(52, width / height, 0.1, 400);
      this.camera.position.set(0, 5, -8);

      let renderer = null;
      try {
        renderer = new THREE.WebGLRenderer({
          antialias: true,
          alpha: false,
          powerPreference: 'default',
          precision: 'mediump',
          stencil: false,
          failIfMajorPerformanceCaveat: false
        });
      } catch (err1) {
        console.warn('Initial WebGLRenderer failed, trying fallback without antialias:', err1);
        try {
          renderer = new THREE.WebGLRenderer({
            antialias: false,
            alpha: false,
            powerPreference: 'default',
            precision: 'mediump',
            stencil: false,
            failIfMajorPerformanceCaveat: false
          });
        } catch (err2) {
          console.error('WebGLRenderer fallback also failed:', err2);
        }
      }
      this.renderer = renderer;

      if (this.renderer) {
        this.renderer.setSize(width, height);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFShadowMap;
        this.container.appendChild(this.renderer.domElement);

        this.renderer.domElement.addEventListener('webglcontextlost', (e) => {
          e.preventDefault();
          console.warn('WebGL context lost');
        }, false);
        this.renderer.domElement.addEventListener('webglcontextrestored', () => {
          console.info('WebGL context restored');
          this.initCourse3D();
        }, false);
      }

      // Natural Sky Hemisphere Light (bright blue sky above, soft cloud bounce from below)
      const hemiLight = new THREE.HemisphereLight(0x60A5FA, 0xFFFFFF, 0.95);
      this.scene.add(hemiLight);

      // Strong Natural Sunlight illuminating the glass platforms and ball with soft shadows
      const sunLight = new THREE.DirectionalLight(0xFFFBF0, 1.6);
      sunLight.position.set(32, 50, 28);
      sunLight.castShadow = true;
      sunLight.shadow.mapSize.width = 1024;
      sunLight.shadow.mapSize.height = 1024;
      sunLight.shadow.camera.near = 0.5;
      sunLight.shadow.camera.far = 110;
      sunLight.shadow.camera.left = -20;
      sunLight.shadow.camera.right = 20;
      sunLight.shadow.camera.top = 20;
      sunLight.shadow.camera.bottom = -20;
      sunLight.shadow.bias = -0.0003;
      this.scene.add(sunLight);
      this.scene.add(sunLight.target);
      this.sunLight = sunLight;

      // Gentle ambient fill
      const ambientLight = new THREE.AmbientLight(0xBAE6FD, 0.40);
      this.scene.add(ambientLight);

      // 3D Procedural Sky Dome and Floating Clouds Environment
      this.createSkyAndClouds();

      // Glass Ball creation
      this.createGlassBall();

      // Ambient Dust Particles (sunlit air motes)
      this.createAmbientDust();
    }

    createSkyAndClouds() {
      // 1. PROCEDURAL 3D HIGH-RESOLUTION SKY DOME (VIVID HIGH-ALTITUDE GRADIENT)
      const skyCanvas = document.createElement('canvas');
      skyCanvas.width = 1024;
      skyCanvas.height = 1024;
      const skyCtx = skyCanvas.getContext('2d');

      // Radiant high-altitude sky: royal/sapphire zenith down to horizon mist
      const grad = skyCtx.createLinearGradient(0, 0, 0, 1024);
      grad.addColorStop(0.00, '#0F47AF'); // Deep vibrant sapphire blue at zenith
      grad.addColorStop(0.18, '#1D6FE5'); // Brilliant royal sky blue
      grad.addColorStop(0.42, '#0284C7'); // Rich azure blue
      grad.addColorStop(0.65, '#38BDF8'); // Bright cerulean sky
      grad.addColorStop(0.82, '#7DD3FC'); // Crisp sky blue
      grad.addColorStop(0.92, '#BAE6FD'); // Soft atmospheric horizon blue
      grad.addColorStop(0.97, '#E0F2FE'); // Atmospheric white-cyan horizon haze
      grad.addColorStop(1.00, '#F0F9FF'); // Gentle mist base
      skyCtx.fillStyle = grad;
      skyCtx.fillRect(0, 0, 1024, 1024);

      // Radiant solar disc painted into the sky dome
      const sunGrad = skyCtx.createRadialGradient(740, 220, 0, 740, 220, 160);
      sunGrad.addColorStop(0.00, 'rgba(255, 255, 255, 1.0)');
      sunGrad.addColorStop(0.15, 'rgba(255, 255, 245, 0.98)');
      sunGrad.addColorStop(0.35, 'rgba(254, 243, 199, 0.75)');
      sunGrad.addColorStop(0.65, 'rgba(253, 230, 138, 0.30)');
      sunGrad.addColorStop(1.00, 'rgba(253, 230, 138, 0.0)');
      skyCtx.fillStyle = sunGrad;
      skyCtx.beginPath();
      skyCtx.arc(740, 220, 160, 0, Math.PI * 2);
      skyCtx.fill();

      const skyTexture = new THREE.CanvasTexture(skyCanvas);
      skyTexture.mapping = THREE.EquirectangularReflectionMapping;

      const skyGeo = new THREE.SphereGeometry(320, 48, 32);
      const skyMat = new THREE.MeshBasicMaterial({
        map: skyTexture,
        side: THREE.BackSide,
        depthWrite: false
      });
      this.skyDome = new THREE.Mesh(skyGeo, skyMat);
      this.scene.add(this.skyDome);

      // Generate PBR Environment Map for realistic glossy reflections on the ball & glass
      if (this.renderer && typeof this.renderer.compile === 'function' && typeof THREE.PMREMGenerator === 'function') {
        try {
          const pmrem = new THREE.PMREMGenerator(this.renderer);
          pmrem.compileEquirectangularShader();
          const envMap = pmrem.fromEquirectangular(skyTexture).texture;
          this.scene.environment = envMap;
          pmrem.dispose();
        } catch (e) {
          console.warn('PMREM environment generation error:', e);
        }
      }

      // 2. VOLUMETRIC PROCEDURAL SOFT CLOUD SPRITE TEXTURE (256x256)
      const cloudCanvas = document.createElement('canvas');
      cloudCanvas.width = 256;
      cloudCanvas.height = 256;
      const cloudCtx = cloudCanvas.getContext('2d');

      // Overlapping soft feathery radial puffs creating realistic billowy volume with subtle sunlit shading
      const drawPuff = (cx, cy, r, alpha, shade = 1.0) => {
        const pGrad = cloudCtx.createRadialGradient(cx, cy, 0, cx, cy, r);
        const rVal = Math.round(255 * shade);
        const gVal = Math.round(255 * shade);
        const bVal = Math.round(255 * (0.95 + 0.05 * shade));
        pGrad.addColorStop(0.00, `rgba(${rVal}, ${gVal}, ${bVal}, ${alpha})`);
        pGrad.addColorStop(0.40, `rgba(${rVal}, ${gVal}, ${bVal}, ${alpha * 0.75})`);
        pGrad.addColorStop(0.75, `rgba(${rVal - 10}, ${gVal - 5}, ${bVal}, ${alpha * 0.28})`);
        pGrad.addColorStop(1.00, `rgba(${rVal - 15}, ${gVal - 10}, ${bVal}, 0.0)`);
        cloudCtx.fillStyle = pGrad;
        cloudCtx.beginPath();
        cloudCtx.arc(cx, cy, r, 0, Math.PI * 2);
        cloudCtx.fill();
      };

      // Shaded puffy base for 3D depth
      drawPuff(128, 148, 95, 0.70, 0.92);
      drawPuff(90, 138, 75, 0.75, 0.94);
      drawPuff(166, 142, 80, 0.75, 0.94);
      // Bright sunlit upper puffs
      drawPuff(128, 118, 105, 0.92, 1.00);
      drawPuff(85, 110, 80, 0.88, 1.00);
      drawPuff(170, 115, 82, 0.88, 1.00);
      drawPuff(105, 85, 68, 0.85, 1.00);
      drawPuff(150, 88, 68, 0.85, 1.00);

      this.cloudTexture = new THREE.CanvasTexture(cloudCanvas);

      // Shared cloud materials
      this.cloudMaterial = new THREE.SpriteMaterial({
        map: this.cloudTexture,
        color: 0xFFFFFF,
        transparent: true,
        opacity: 0.86,
        depthWrite: false,
        depthTest: true
      });

      this.cloudDeckMaterial = new THREE.SpriteMaterial({
        map: this.cloudTexture,
        color: 0xF8FAFC,
        transparent: true,
        opacity: 0.92,
        depthWrite: false,
        depthTest: true
      });

      this.cloudObjects = [];

      // A) MASSIVE SEA OF CLOUDS (Deck floating far below the bridge at Y = -22 to -16)
      // Creates an immense high-altitude atmosphere where the bridge feels suspended high in the sky
      const deckCount = 85;
      for (let i = 0; i < deckCount; i++) {
        const sprite = new THREE.Sprite(this.cloudDeckMaterial);
        sprite.renderOrder = -10;
        const x = (Math.random() - 0.5) * 360;
        const y = -22 + Math.random() * 5.5;
        const z = -60 + Math.random() * 740;
        const scale = 36 + Math.random() * 32;

        sprite.position.set(x, y, z);
        sprite.scale.set(scale, scale * 0.62, 1);
        this.scene.add(sprite);

        this.cloudObjects.push({
          sprite: sprite,
          vx: 0.20 + Math.random() * 0.20,
          vz: 0.10 + Math.random() * 0.15,
          baseY: y,
          phase: Math.random() * Math.PI * 2,
          isDeck: true
        });
      }

      // B) SOFT FLUFFY FLOATING CLOUD FORMATIONS IN DISTANT HORIZON
      const cloudClustersCount = 42;
      for (let i = 0; i < cloudClustersCount; i++) {
        const clusterGroup = new THREE.Group();
        clusterGroup.renderOrder = -10;
        const lateralSide = Math.random() < 0.5 ? -1 : 1;
        const lateralDist = lateralSide * (48 + Math.random() * 85); // Generous lateral distance
        const heightLevel = -8 + Math.random() * 32; // Distant background altitude clouds
        const zPos = -50 + Math.random() * 740;

        // Group 3 to 5 overlapping billowy puffs to form each distinct 3D cloud
        const puffsInCluster = 3 + Math.floor(Math.random() * 3);
        const baseScale = 22 + Math.random() * 26;

        for (let p = 0; p < puffsInCluster; p++) {
          const pSprite = new THREE.Sprite(this.cloudMaterial);
          pSprite.renderOrder = -10;
          const offsetX = (Math.random() - 0.5) * baseScale * 0.5;
          const offsetY = (Math.random() - 0.5) * baseScale * 0.25;
          const offsetZ = (Math.random() - 0.5) * baseScale * 0.4;
          const puffScale = baseScale * (0.75 + Math.random() * 0.45);

          pSprite.position.set(offsetX, offsetY, offsetZ);
          pSprite.scale.set(puffScale, puffScale * 0.68, 1);
          clusterGroup.add(pSprite);
        }

        clusterGroup.position.set(lateralDist, heightLevel, zPos);
        this.scene.add(clusterGroup);

        this.cloudObjects.push({
          sprite: clusterGroup,
          vx: 0.28 + Math.random() * 0.25,
          vz: 0.12 + Math.random() * 0.20,
          baseY: heightLevel,
          phase: Math.random() * Math.PI * 2,
          isDeck: false,
          baseScale: baseScale
        });
      }

      // 3. SUBTLE OPTICAL SUN-FLARE EFFECT
      this.createSunFlare();
    }

    createSunFlare() {
      this.sunOffset = new THREE.Vector3(75, 125, 80);
      this.sunFlareGroup = new THREE.Group();
      this.scene.add(this.sunFlareGroup);

      // A) Primary Sun Glow Disc Canvas
      const discCanvas = document.createElement('canvas');
      discCanvas.width = 128;
      discCanvas.height = 128;
      const discCtx = discCanvas.getContext('2d');
      const discGrad = discCtx.createRadialGradient(64, 64, 0, 64, 64, 64);
      discGrad.addColorStop(0.0, 'rgba(255, 255, 252, 1.0)');
      discGrad.addColorStop(0.2, 'rgba(254, 240, 138, 0.7)');
      discGrad.addColorStop(0.5, 'rgba(251, 191, 36, 0.22)');
      discGrad.addColorStop(1.0, 'rgba(251, 191, 36, 0.0)');
      discCtx.fillStyle = discGrad;
      discCtx.fillRect(0, 0, 128, 128);
      const discTexture = new THREE.CanvasTexture(discCanvas);

      // B) Anamorphic Horizontal Sunlight Streak Canvas
      const streakCanvas = document.createElement('canvas');
      streakCanvas.width = 256;
      streakCanvas.height = 64;
      const streakCtx = streakCanvas.getContext('2d');
      const streakGrad = streakCtx.createRadialGradient(128, 32, 0, 128, 32, 120);
      streakGrad.addColorStop(0.0, 'rgba(255, 250, 220, 0.6)');
      streakGrad.addColorStop(0.3, 'rgba(254, 243, 199, 0.3)');
      streakGrad.addColorStop(0.7, 'rgba(186, 230, 253, 0.1)');
      streakGrad.addColorStop(1.0, 'rgba(186, 230, 253, 0.0)');
      streakCtx.fillStyle = streakGrad;
      streakCtx.fillRect(0, 0, 256, 64);
      const streakTexture = new THREE.CanvasTexture(streakCanvas);

      // C) Subtle Aperture Halo Ring Canvas
      const ringCanvas = document.createElement('canvas');
      ringCanvas.width = 128;
      ringCanvas.height = 128;
      const ringCtx = ringCanvas.getContext('2d');
      const ringGrad = ringCtx.createRadialGradient(64, 64, 40, 64, 64, 62);
      ringGrad.addColorStop(0.0, 'rgba(251, 191, 36, 0.0)');
      ringGrad.addColorStop(0.5, 'rgba(254, 243, 199, 0.25)');
      ringGrad.addColorStop(0.8, 'rgba(56, 189, 248, 0.12)');
      ringGrad.addColorStop(1.0, 'rgba(56, 189, 248, 0.0)');
      ringCtx.fillStyle = ringGrad;
      ringCtx.fillRect(0, 0, 128, 128);
      const ringTexture = new THREE.CanvasTexture(ringCanvas);

      // D) Soft Bokeh Ghost Disc Canvas
      const ghostCanvas = document.createElement('canvas');
      ghostCanvas.width = 64;
      ghostCanvas.height = 64;
      const ghostCtx = ghostCanvas.getContext('2d');
      const ghostGrad = ghostCtx.createRadialGradient(32, 32, 0, 32, 32, 32);
      ghostGrad.addColorStop(0.0, 'rgba(254, 243, 199, 0.32)');
      ghostGrad.addColorStop(0.6, 'rgba(56, 189, 248, 0.15)');
      ghostGrad.addColorStop(1.0, 'rgba(56, 189, 248, 0.0)');
      ghostCtx.fillStyle = ghostGrad;
      ghostCtx.fillRect(0, 0, 64, 64);
      const ghostTexture = new THREE.CanvasTexture(ghostCanvas);

      // Main Sun Corona Flare
      this.sunMainMat = new THREE.SpriteMaterial({
        map: discTexture,
        blending: THREE.AdditiveBlending,
        transparent: true,
        opacity: 0.65,
        depthWrite: false,
        depthTest: false
      });
      this.sunMainSprite = new THREE.Sprite(this.sunMainMat);
      this.sunMainSprite.scale.set(48, 48, 1);
      this.sunFlareGroup.add(this.sunMainSprite);

      // Horizontal Sunbeam Streak
      this.sunStreakMat = new THREE.SpriteMaterial({
        map: streakTexture,
        blending: THREE.AdditiveBlending,
        transparent: true,
        opacity: 0.38,
        depthWrite: false,
        depthTest: false
      });
      this.sunStreakSprite = new THREE.Sprite(this.sunStreakMat);
      this.sunStreakSprite.scale.set(88, 14, 1);
      this.sunFlareGroup.add(this.sunStreakSprite);

      // Ghost Elements along optical axis
      this.ghostElements = [];
      const ghostConfigs = [
        { tex: ringTexture, scale: 22, factor: 0.35, baseAlpha: 0.22 },
        { tex: ghostTexture, scale: 12, factor: 0.65, baseAlpha: 0.18 },
        { tex: ghostTexture, scale: 18, factor: 0.95, baseAlpha: 0.14 },
        { tex: ringTexture, scale: 30, factor: 1.35, baseAlpha: 0.15 }
      ];

      ghostConfigs.forEach(cfg => {
        const mat = new THREE.SpriteMaterial({
          map: cfg.tex,
          blending: THREE.AdditiveBlending,
          transparent: true,
          opacity: 0.0,
          depthWrite: false,
          depthTest: false
        });
        const sprite = new THREE.Sprite(mat);
        sprite.scale.set(cfg.scale, cfg.scale, 1);
        this.scene.add(sprite);
        this.ghostElements.push({
          sprite: sprite,
          mat: mat,
          factor: cfg.factor,
          baseAlpha: cfg.baseAlpha
        });
      });

      this.sunFlareCurrentOpacity = 0.65;
    }

    updateSunFlare(dt) {
      if (!this.sunFlareGroup || !this.camera) return;

      // Position main sun flare in direction of sunlight relative to camera
      const sunWorldPos = this.camera.position.clone().add(this.sunOffset);
      this.sunFlareGroup.position.copy(sunWorldPos);

      // Project sun position to Normalized Device Coordinates (NDC: -1 to 1)
      const proj = sunWorldPos.clone().project(this.camera);

      // Check if sun is in front of the camera
      const inFront = proj.z < 1.0;
      const distFromCenter = Math.sqrt(proj.x * proj.x + proj.y * proj.y);

      // Flare visibility: strongest when facing near the sun, soft fade at perimeter
      let targetOpacity = 0.0;
      if (inFront && distFromCenter < 2.5) {
        targetOpacity = Math.max(0.0, (1.0 - distFromCenter / 2.5) * 0.75);
      }

      this.sunFlareCurrentOpacity += (targetOpacity - this.sunFlareCurrentOpacity) * Math.min(1.0, dt * 5.0);

      this.sunMainMat.opacity = this.sunFlareCurrentOpacity;
      this.sunStreakMat.opacity = this.sunFlareCurrentOpacity * 0.65;

      // Update secondary ghost flare elements along optical axis from sun through camera center
      const camDir = new THREE.Vector3();
      this.camera.getWorldDirection(camDir);
      const camTarget = this.camera.position.clone().add(camDir.multiplyScalar(this.sunOffset.length()));

      for (let i = 0; i < this.ghostElements.length; i++) {
        const g = this.ghostElements[i];
        const ghostPos = new THREE.Vector3().lerpVectors(sunWorldPos, camTarget, g.factor);
        g.sprite.position.copy(ghostPos);
        g.mat.opacity = this.sunFlareCurrentOpacity * (g.baseAlpha / 0.75);
      }
    }

    updateSkyAndClouds(dt, time) {
      if (!this.skyDome) return;

      // Keep Sky Dome centered around camera horizontally for infinite horizon depth
      this.skyDome.position.x = this.camera.position.x;
      this.skyDome.position.z = this.camera.position.z;

      const ballPos = this.ballMesh ? this.ballMesh.position : new THREE.Vector3(0, 0, 0);

      // Smooth, slow drift of all cloud formations strictly in the distant background
      for (let i = 0; i < this.cloudObjects.length; i++) {
        const c = this.cloudObjects[i];

        c.sprite.position.x += c.vx * dt;
        c.sprite.position.z += c.vz * dt;
        c.sprite.position.y = c.baseY + Math.sin(time * 0.35 + c.phase) * 0.2;

        // Seamless wrapping relative to player progression along the course
        const relZ = c.sprite.position.z - ballPos.z;
        if (relZ < -70) {
          c.sprite.position.z += 320;
          const wrapSide = Math.random() < 0.5 ? -1 : 1;
          c.sprite.position.x = ballPos.x + wrapSide * (c.isDeck ? (28 + Math.random() * 80) : (40 + Math.random() * 85));
        } else if (relZ > 250) {
          c.sprite.position.z -= 320;
        }

        // Horizontal lateral wrapping with safe distance preservation
        const relX = c.sprite.position.x - ballPos.x;
        if (relX > 130) c.sprite.position.x -= 260;
        else if (relX < -130) c.sprite.position.x += 260;

        // SAFE CLEARANCE CHECK: If non-deck cloud drifts too close to the playable bridge,
        // automatically push it to a safe lateral background buffer distance
        if (!c.isDeck && this.course && this.getTrackSample) {
          const trackSample = this.getTrackSample(this.state ? this.state.s : 0);
          const dx = c.sprite.position.x - trackSample.pos.x;
          const dz = c.sprite.position.z - trackSample.pos.z;
          const distXZ = Math.sqrt(dx * dx + dz * dz);
          const safeMinDist = 28 + (c.baseScale ? c.baseScale * 0.5 : 8);

          if (distXZ < safeMinDist && c.sprite.position.y > -8) {
            const side = dx >= 0 ? 1 : -1;
            c.sprite.position.x = trackSample.pos.x + side * (safeMinDist + 15);
          }
        }
      }

      // Update Sun Flare
      this.updateSunFlare(dt);
    }

    createAmbientDust() {
      const particleCount = 280;
      const positions = new Float32Array(particleCount * 3);
      this.dustVelocities = [];

      // Generate a soft circular glow sprite
      const canvas = document.createElement('canvas');
      canvas.width = 32;
      canvas.height = 32;
      const ctx = canvas.getContext('2d');
      const gradient = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
      gradient.addColorStop(0, 'rgba(224, 242, 254, 0.95)');
      gradient.addColorStop(0.35, 'rgba(56, 189, 248, 0.5)');
      gradient.addColorStop(1, 'rgba(56, 189, 248, 0.0)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 32, 32);

      const particleTexture = new THREE.CanvasTexture(canvas);

      for (let i = 0; i < particleCount; i++) {
        positions[i * 3] = (Math.random() - 0.5) * 55;
        positions[i * 3 + 1] = Math.random() * 18 - 3;
        positions[i * 3 + 2] = (Math.random() - 0.5) * 70;

        this.dustVelocities.push({
          vx: (Math.random() - 0.5) * 0.15,
          vy: 0.07 + Math.random() * 0.14,
          vz: (Math.random() - 0.5) * 0.15,
          phase: Math.random() * Math.PI * 2,
          swaySpeed: 0.6 + Math.random() * 0.9
        });
      }

      const dustGeo = new THREE.BufferGeometry();
      dustGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

      const dustMat = new THREE.PointsMaterial({
        size: 0.38,
        map: particleTexture,
        transparent: true,
        opacity: 0.35,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      });

      this.dustParticles = new THREE.Points(dustGeo, dustMat);
      this.scene.add(this.dustParticles);
    }

    updateAmbientDust(dt, time) {
      if (!this.dustParticles) return;

      const positions = this.dustParticles.geometry.attributes.position.array;
      const ballPos = this.ballMesh ? this.ballMesh.position : new THREE.Vector3(0, 0, 0);

      const radiusX = 28;
      const radiusZ = 35;
      const minY = -3;
      const maxY = 15;

      for (let i = 0; i < this.dustVelocities.length; i++) {
        const vel = this.dustVelocities[i];
        const idx = i * 3;

        // Subtle gentle drift and sway
        positions[idx] += (vel.vx + Math.sin(time * vel.swaySpeed + vel.phase) * 0.06) * dt;
        positions[idx + 1] += vel.vy * dt;
        positions[idx + 2] += (vel.vz + Math.cos(time * vel.swaySpeed + vel.phase) * 0.06) * dt;

        // Wrap vertically
        if (positions[idx + 1] > maxY) {
          positions[idx + 1] = minY;
        }

        // Keep smoothly surrounding the player along the bridge
        const dx = positions[idx] - ballPos.x;
        const dz = positions[idx + 2] - ballPos.z;

        if (dx > radiusX) positions[idx] -= radiusX * 2;
        else if (dx < -radiusX) positions[idx] += radiusX * 2;

        if (dz > radiusZ) positions[idx + 2] -= radiusZ * 2;
        else if (dz < -radiusZ) positions[idx + 2] += radiusZ * 2;
      }

      this.dustParticles.geometry.attributes.position.needsUpdate = true;
    }

    createGlassBall() {
      const ballGroup = new THREE.Group();

      // Deep Black Polished Obsidian Sphere (64 x 64 segments for perfectly smooth rounded silhouette)
      const glassGeo = new THREE.SphereGeometry(this.ballRadius, 64, 64);
      const glassMat = new THREE.MeshPhysicalMaterial({
        color: 0x060709,             // Deep obsidian black
        emissive: 0x000000,
        roughness: 0.025,            // Mirror-smooth polished finish
        metalness: 0.08,             // Non-metallic obsidian stone/glass body
        ior: 1.62,                   // High optical index for realistic obsidian reflections
        reflectivity: 0.98,          // Crisp specular highlights of sky and sun
        clearcoat: 1.0,              // High-gloss outer glass clearcoat
        clearcoatRoughness: 0.02,
        envMapIntensity: 1.35,
        depthWrite: true,
        depthTest: true
      });
      const outerBall = new THREE.Mesh(glassGeo, glassMat);
      outerBall.castShadow = true;
      ballGroup.add(outerBall);

      // Inner Solid Pitch Black Core (guarantees solid black depth from every angle)
      const coreGeo = new THREE.SphereGeometry(this.ballRadius * 0.92, 32, 32);
      const coreMat = new THREE.MeshBasicMaterial({
        color: 0x010102
      });
      const innerCore = new THREE.Mesh(coreGeo, coreMat);
      ballGroup.add(innerCore);

      this.ballMesh = ballGroup;
      this.scene.add(this.ballMesh);

      // Ground Contact Shadow Decal directly under the ball on the bridge surface
      const shadowCanvas = document.createElement('canvas');
      shadowCanvas.width = 128;
      shadowCanvas.height = 128;
      const sCtx = shadowCanvas.getContext('2d');
      const sGrad = sCtx.createRadialGradient(64, 64, 0, 64, 64, 64);
      sGrad.addColorStop(0.00, 'rgba(15, 0, 0, 0.85)');
      sGrad.addColorStop(0.35, 'rgba(25, 2, 5, 0.55)');
      sGrad.addColorStop(0.70, 'rgba(25, 2, 5, 0.18)');
      sGrad.addColorStop(1.00, 'rgba(0, 0, 0, 0.0)');
      sCtx.fillStyle = sGrad;
      sCtx.fillRect(0, 0, 128, 128);

      const shadowTex = new THREE.CanvasTexture(shadowCanvas);
      const shadowGeo = new THREE.PlaneGeometry(this.ballRadius * 2.4, this.ballRadius * 2.4);
      const shadowMat = new THREE.MeshBasicMaterial({
        map: shadowTex,
        transparent: true,
        opacity: 0.85,
        depthWrite: false,
        depthTest: true
      });
      this.contactShadow = new THREE.Mesh(shadowGeo, shadowMat);
      this.contactShadow.rotation.x = -Math.PI / 2;
      this.scene.add(this.contactShadow);

      // Ground Contact Glass Reflection Decal directly below the ball on the red glass
      const reflCanvas = document.createElement('canvas');
      reflCanvas.width = 128;
      reflCanvas.height = 128;
      const rCtx = reflCanvas.getContext('2d');
      const rGrad = rCtx.createRadialGradient(64, 64, 0, 64, 64, 64);
      rGrad.addColorStop(0.00, 'rgba(8, 2, 4, 0.72)');
      rGrad.addColorStop(0.45, 'rgba(90, 8, 15, 0.35)');
      rGrad.addColorStop(0.80, 'rgba(190, 20, 30, 0.12)');
      rGrad.addColorStop(1.00, 'rgba(0, 0, 0, 0.0)');
      rCtx.fillStyle = rGrad;
      rCtx.fillRect(0, 0, 128, 128);

      const reflTex = new THREE.CanvasTexture(reflCanvas);
      const reflGeo = new THREE.PlaneGeometry(this.ballRadius * 2.2, this.ballRadius * 2.2);
      const reflMat = new THREE.MeshBasicMaterial({
        map: reflTex,
        transparent: true,
        opacity: 0.65,
        depthWrite: false,
        depthTest: true
      });
      this.contactReflection = new THREE.Mesh(reflGeo, reflMat);
      this.contactReflection.rotation.x = -Math.PI / 2;
      this.scene.add(this.contactReflection);
    }

    // --- PROCEDURAL 3D GLASS BRIDGE GENERATION ---
    precomputeTrack() {
      this.trackStep = 0.25;
      const totalLen = this.course.totalLength;
      const count = Math.ceil(totalLen / this.trackStep) + 2;
      this.trackCache = [];

      let x = 0;
      let z = 0;
      let yaw = 0;
      const normal = new THREE.Vector3(0, 1, 0);

      for (let i = 0; i < count; i++) {
        const s = i * this.trackStep;
        if (i > 0) {
          const midS = (i - 0.5) * this.trackStep;
          const kappa = this.course.curveAt(midS);
          yaw += kappa * this.trackStep * 0.15;
          x += Math.sin(yaw) * this.trackStep;
          z += Math.cos(yaw) * this.trackStep;
        }

        const tangent = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw)).normalize();
        const binormal = new THREE.Vector3().crossVectors(tangent, normal).normalize();

        let width = this.course.width;
        if (s <= 8) {
          width = 7.5;
        } else if (s < 12) {
          const t = (s - 8) / 4;
          width = 7.5 + (this.course.width - 7.5) * t;
        } else if (s >= totalLen - 10) {
          const t = Math.min(1, (s - (totalLen - 10)) / 4);
          width = this.course.width + (7.5 - this.course.width) * t;
        }

        this.trackCache.push({
          s: s,
          pos: new THREE.Vector3(x, 0, z),
          tangent: tangent,
          binormal: binormal,
          yaw: yaw,
          width: width
        });
      }
    }

    checkBridgeSurface(px, pz, hintIdx = 0) {
      if (!this.trackCache || this.trackCache.length < 2) return null;

      // Start platform backward boundary: foundation extends behind z=0 down to z=-2.2
      if (pz < -2.2) {
        return { onBridge: false, s: 0, lane: 0, dist: Math.abs(pz), inGap: false };
      }
      if (pz >= -2.2 && pz <= 0) {
        const halfStartWidth = 7.5 / 2;
        if (Math.abs(px) <= halfStartWidth) {
          return { i: 0, s: 0, lane: -px, width: 7.5, dist: 0, onBridge: true, inGap: false };
        } else {
          return { onBridge: false, s: 0, lane: -px, dist: Math.abs(px) - halfStartWidth, inGap: false };
        }
      }

      const cache = this.trackCache;
      const count = cache.length;

      const evaluateSegment = (i) => {
        const p0 = cache[i];
        const p1 = cache[i + 1];
        const dx = p1.pos.x - p0.pos.x;
        const dz = p1.pos.z - p0.pos.z;
        const lenSq = dx * dx + dz * dz;
        if (lenSq < 1e-6) return null;

        const unclampedT = ((px - p0.pos.x) * dx + (pz - p0.pos.z) * dz) / lenSq;
        if (unclampedT < -0.15 || unclampedT > 1.15) return null;

        const t = Math.max(0, Math.min(1, unclampedT));
        const cx = p0.pos.x + t * dx;
        const cz = p0.pos.z + t * dz;
        const distSq = (px - cx) * (px - cx) + (pz - cz) * (pz - cz);

        const s = p0.s + t * this.trackStep;
        const bx = p0.binormal.x + t * (p1.binormal.x - p0.binormal.x);
        const bz = p0.binormal.z + t * (p1.binormal.z - p0.binormal.z);
        const bLen = Math.sqrt(bx * bx + bz * bz) || 1;
        const nbx = bx / bLen;
        const nbz = bz / bLen;

        const lane = (px - cx) * nbx + (pz - cz) * nbz;
        const width = p0.width + t * (p1.width - p0.width);

        let inGap = false;
        if (s >= 14 && s <= this.course.totalLength - 10) {
          const gaps = this.course.gaps || [];
          for (let g = 0; g < gaps.length; g++) {
            const gap = gaps[g];
            if (s >= gap.sStart && s <= gap.sEnd && lane >= gap.laneStart && lane <= gap.laneEnd) {
              inGap = true;
              break;
            }
          }
        }

        const onBridge = !inGap && (Math.abs(lane) <= width * 0.5);
        return { i, s, lane, width, distSq, dist: Math.sqrt(distSq), onBridge, inGap };
      };

      // 1. Check local hint window (approx 40 segments, ~0.002ms)
      const minI = Math.max(0, hintIdx - 40);
      const maxI = Math.min(count - 2, hintIdx + 40);
      let bestLocal = null;
      let bestLocalDistSq = Infinity;

      for (let i = minI; i <= maxI; i++) {
        const res = evaluateSegment(i);
        if (res && res.distSq < bestLocalDistSq) {
          bestLocalDistSq = res.distSq;
          bestLocal = res;
        }
      }

      if (bestLocal && bestLocal.onBridge) {
        return bestLocal;
      }

      // 2. Global search if not found in local window
      let bestGlobal = null;
      let bestGlobalDistSq = Infinity;
      for (let i = 0; i < count - 1; i++) {
        const res = evaluateSegment(i);
        if (res && res.distSq < bestGlobalDistSq) {
          bestGlobalDistSq = res.distSq;
          bestGlobal = res;
        }
      }

      return bestGlobal || { onBridge: false, s: 0, lane: 0, dist: 999, inGap: false };
    }

    getTrackSample(s) {
      if (!this.trackCache || this.trackCache.length === 0) {
        this.precomputeTrack();
      }
      const clampedS = Math.max(0, Math.min(this.course.totalLength, s));
      const idx = clampedS / this.trackStep;
      const i0 = Math.floor(idx);
      const i1 = Math.min(this.trackCache.length - 1, i0 + 1);
      const frac = idx - i0;

      const p0 = this.trackCache[i0];
      const p1 = this.trackCache[i1];

      const pos = new THREE.Vector3().lerpVectors(p0.pos, p1.pos, frac);
      const yaw = p0.yaw + (p1.yaw - p0.yaw) * frac;
      const tangent = new THREE.Vector3().lerpVectors(p0.tangent, p1.tangent, frac).normalize();
      const binormal = new THREE.Vector3().crossVectors(tangent, new THREE.Vector3(0, 1, 0)).normalize();

      const isStartPlatform = clampedS < 12;
      const isFinishPlatform = clampedS > this.course.totalLength - 10;

      // Smooth gradual width taper for seamless transitions into and out of platforms
      let width = this.course.width;
      if (clampedS <= 8) {
        width = 7.5;
      } else if (clampedS < 12) {
        const t = (clampedS - 8) / 4;
        width = 7.5 + (this.course.width - 7.5) * t;
      } else if (clampedS >= this.course.totalLength - 10) {
        const t = Math.min(1, (clampedS - (this.course.totalLength - 10)) / 4);
        width = this.course.width + (7.5 - this.course.width) * t;
      }

      return {
        pos: pos,
        tangent: tangent,
        normal: new THREE.Vector3(0, 1, 0),
        binormal: binormal,
        yaw: yaw,
        width: width,
        isStartPlatform: isStartPlatform,
        isFinishPlatform: isFinishPlatform
      };
    }

    checkIsGap(s, lane) {
      // Start and Finish platforms NEVER have gaps
      if (s < 14 || s > this.course.totalLength - 10) return false;

      for (let i = 0; i < this.course.gaps.length; i++) {
        const gap = this.course.gaps[i];
        if (s >= gap.sStart && s <= gap.sEnd) {
          if (lane >= gap.laneStart && lane <= gap.laneEnd) {
            return true;
          }
        }
      }
      return false;
    }

    initCourse3D() {
      if (this.bridgeGroup) {
        this.scene.remove(this.bridgeGroup);
      }
      this.bridgeGroup = new THREE.Group();
      this.checkpointMarkers = [];

      const totalLen = this.course.totalLength;

      // Procedural Ruby Crystal Glass Texture with panel seams, internal crystal depth, and bevels
      const glassCanvas = document.createElement('canvas');
      glassCanvas.width = 512;
      glassCanvas.height = 512;
      const gCtx = glassCanvas.getContext('2d');

      // Lateral ruby-crimson gradient
      const gGrad = gCtx.createLinearGradient(0, 0, 512, 0);
      // Neutral luminance gradient: the map multiplies the material colour, so a white
      // centre lets the true #FF0000 show while the grey edges keep the bevel shading.
      gGrad.addColorStop(0.00, '#A0A0A0'); // Shaded lateral bevel edge
      gGrad.addColorStop(0.06, '#E6E6E6');
      gGrad.addColorStop(0.50, '#FFFFFF'); // Full-strength pure red centre
      gGrad.addColorStop(0.94, '#E6E6E6');
      gGrad.addColorStop(1.00, '#A0A0A0'); // Shaded lateral bevel edge
      gCtx.fillStyle = gGrad;
      gCtx.fillRect(0, 0, 512, 512);

      // Subtle crystal internal caustics & variations
      for (let p = 0; p < 12; p++) {
        const cx = (p * 47) % 512;
        const cy = (p * 83) % 512;
        const r = 45 + (p % 4) * 20;
        const cGrad = gCtx.createRadialGradient(cx, cy, 0, cx, cy, r);
        cGrad.addColorStop(0.0, 'rgba(254, 205, 211, 0.08)');
        cGrad.addColorStop(1.0, 'rgba(254, 205, 211, 0.0)');
        gCtx.fillStyle = cGrad;
        gCtx.beginPath();
        gCtx.arc(cx, cy, r, 0, Math.PI * 2);
        gCtx.fill();
      }

      // Transverse Panel Seams: fine panel joint grooves every 4 meters
      gCtx.fillStyle = 'rgba(50, 4, 8, 0.65)'; // 2px dark joint groove
      gCtx.fillRect(0, 0, 512, 3);
      gCtx.fillRect(0, 254, 512, 3);

      gCtx.fillStyle = 'rgba(255, 210, 220, 0.85)'; // 1px razor-sharp specular reflection line
      gCtx.fillRect(0, 3, 512, 2);
      gCtx.fillRect(0, 257, 512, 2);

      // Lateral border accent lines
      gCtx.fillStyle = 'rgba(255, 120, 140, 0.45)';
      gCtx.fillRect(0, 0, 2, 512);
      gCtx.fillRect(510, 0, 2, 512);

      const glassTexture = new THREE.CanvasTexture(glassCanvas);
      glassTexture.wrapS = THREE.ClampToEdgeWrapping;
      glassTexture.wrapT = THREE.RepeatWrapping;

      // Pure Red Glass Platform Material
      const glassMat = new THREE.MeshPhysicalMaterial({
        color: 0xFF0000,             // Pure Red ("#FF0000", RGB 255, 0, 0)
        emissive: 0xFF0000,          // Keeps the glass reading as true red through sky reflections
        emissiveIntensity: 0.9,
        map: glassTexture,           // Shows crystal depth and panel seams
        emissiveMap: glassTexture,   // Keeps seams/bevels visible in the emissive red too
        transmission: 0.0,           // Transmission samples the white sky and bleaches the deck pink
        transparent: true,
        opacity: 0.88,
        roughness: 0.05,             // Glossy crystal surface
        metalness: 0.0,
        ior: 1.5,
        specularIntensity: 0.35,     // Fresnel at the low camera angle otherwise mirrors the sky to white
        specularColor: 0xFF6060,
        clearcoat: 0.35,             // Gloss kept, but no longer a full white sky mirror
        clearcoatRoughness: 0.05,
        envMapIntensity: 0.3,        // Sky reflections subdued so red stays dominant at grazing angles
        depthWrite: true,
        depthTest: true
      });

      // Brighter luminous red edge runners framing the platform shape
      const railMat = new THREE.MeshStandardMaterial({
        color: 0xFF0000,             // Pure red edge highlight
        emissive: 0xFF0000,          // Radiant red border illumination
        emissiveIntensity: 1.25,
        roughness: 0.06,
        metalness: 0.85,
        depthWrite: true,
        depthTest: true
      });

      // Starting platform foundation base underneath launch zone
      const startMat = new THREE.MeshStandardMaterial({
        color: 0x2A0E13,
        roughness: 0.35,
        metalness: 0.75,
        depthWrite: true,
        depthTest: true
      });

      // Helper class to accumulate indexed vertices, normals, and UVs for a single continuous BufferGeometry
      class ContinuousBufferBuilder {
        constructor() {
          this.positions = [];
          this.normals = [];
          this.uvs = [];
          this.indices = [];
        }

        addVertex(x, y, z, nx, ny, nz, u, v) {
          const idx = this.positions.length / 3;
          this.positions.push(x, y, z);
          this.normals.push(nx, ny, nz);
          this.uvs.push(u, v);
          return idx;
        }

        addQuad(v0, v1, v2, v3) {
          this.indices.push(v0, v1, v2, v0, v2, v3);
        }

        toGeometry() {
          const geom = new THREE.BufferGeometry();
          geom.setAttribute('position', new THREE.Float32BufferAttribute(this.positions, 3));
          geom.setAttribute('normal', new THREE.Float32BufferAttribute(this.normals, 3));
          geom.setAttribute('uv', new THREE.Float32BufferAttribute(this.uvs, 2));
          geom.setIndex(this.indices);
          return geom;
        }
      }

      const glassBuilder = new ContinuousBufferBuilder();
      const leftRailBuilder = new ContinuousBufferBuilder();
      const rightRailBuilder = new ContinuousBufferBuilder();

      // Step 1: Divide the track into continuous sections using sorted gap boundaries
      const gaps = (this.course.gaps || []).slice().sort((a, b) => a.sStart - b.sStart);
      const splitPoints = [0];
      gaps.forEach(g => {
        if (g.sStart > 0 && g.sStart < totalLen) splitPoints.push(g.sStart);
        if (g.sEnd > 0 && g.sEnd < totalLen) splitPoints.push(g.sEnd);
      });
      splitPoints.push(totalLen);
      const uniqueSplits = Array.from(new Set(splitPoints)).sort((a, b) => a - b);

      // Loft a continuous 3D slab ribbon between sStart and sEnd with lateral functions uMin(s), uMax(s)
      const loftRibbon = (sStart, sEnd, uMinFn, uMaxFn, builder, isRail = false) => {
        const segLen = sEnd - sStart;
        if (segLen <= 0.001) return;
        const stepSize = 0.25;
        const steps = Math.max(1, Math.ceil(segLen / stepSize));
        const H = isRail ? 0.08 : 0.30; // 30cm thick polished crystal glass slab

        // Compute cross sections along the ribbon
        const slices = [];
        for (let i = 0; i <= steps; i++) {
          const s = sStart + (i / steps) * segLen;
          const sample = this.getTrackSample(s);
          const u0 = uMinFn(s, sample);
          const u1 = uMaxFn(s, sample);
          const yTop = isRail ? 0.05 : 0.0;
          const yBot = isRail ? 0.0 : -H;

          // Points in world space
          const pTL = sample.pos.clone().addScaledVector(sample.binormal, u0); pTL.y += yTop;
          const pTR = sample.pos.clone().addScaledVector(sample.binormal, u1); pTR.y += yTop;
          const pBL = sample.pos.clone().addScaledVector(sample.binormal, u0); pBL.y += yBot;
          const pBR = sample.pos.clone().addScaledVector(sample.binormal, u1); pBR.y += yBot;

          slices.push({
            s: s,
            sample: sample,
            TL: pTL,
            TR: pTR,
            BL: pBL,
            BR: pBR,
            binormal: sample.binormal,
            tangent: sample.tangent
          });
        }

        // Generate seamless faces along the ribbon
        // 1. Top Surface (normal up)
        const topTL = [];
        const topTR = [];
        for (let i = 0; i <= steps; i++) {
          const sl = slices[i];
          topTL.push(builder.addVertex(sl.TL.x, sl.TL.y, sl.TL.z, 0, 1, 0, 0, sl.s * 0.25));
          topTR.push(builder.addVertex(sl.TR.x, sl.TR.y, sl.TR.z, 0, 1, 0, 1, sl.s * 0.25));
        }
        for (let i = 0; i < steps; i++) {
          builder.addQuad(topTL[i], topTL[i + 1], topTR[i + 1], topTR[i]);
        }

        // 2. Bottom Surface (normal down)
        const botBL = [];
        const botBR = [];
        for (let i = 0; i <= steps; i++) {
          const sl = slices[i];
          botBL.push(builder.addVertex(sl.BL.x, sl.BL.y, sl.BL.z, 0, -1, 0, 0, sl.s * 0.25));
          botBR.push(builder.addVertex(sl.BR.x, sl.BR.y, sl.BR.z, 0, -1, 0, 1, sl.s * 0.25));
        }
        for (let i = 0; i < steps; i++) {
          builder.addQuad(botBL[i], botBR[i], botBR[i + 1], botBL[i + 1]);
        }

        // 3. Left Wall (normal pointing left: -binormal)
        const leftTL = [];
        const leftBL = [];
        for (let i = 0; i <= steps; i++) {
          const sl = slices[i];
          const n = sl.binormal.clone().negate();
          leftTL.push(builder.addVertex(sl.TL.x, sl.TL.y, sl.TL.z, n.x, 0, n.z, 0, sl.s * 0.25));
          leftBL.push(builder.addVertex(sl.BL.x, sl.BL.y, sl.BL.z, n.x, 0, n.z, 1, sl.s * 0.25));
        }
        for (let i = 0; i < steps; i++) {
          builder.addQuad(leftTL[i], leftTL[i + 1], leftBL[i + 1], leftBL[i]);
        }

        // 4. Right Wall (normal pointing right: +binormal)
        const rightTR = [];
        const rightBR = [];
        for (let i = 0; i <= steps; i++) {
          const sl = slices[i];
          const n = sl.binormal;
          rightTR.push(builder.addVertex(sl.TR.x, sl.TR.y, sl.TR.z, n.x, 0, n.z, 0, sl.s * 0.25));
          rightBR.push(builder.addVertex(sl.BR.x, sl.BR.y, sl.BR.z, n.x, 0, n.z, 1, sl.s * 0.25));
        }
        for (let i = 0; i < steps; i++) {
          builder.addQuad(rightTR[i], rightBR[i], rightBR[i + 1], rightTR[i + 1]);
        }
      };

      // Add a clean vertical end cap across a lateral interval [u0, u1] at track distance s
      const addEndCap = (s, u0, u1, isForward, builder) => {
        const sample = this.getTrackSample(s);
        const H = 0.30;
        const pTL = sample.pos.clone().addScaledVector(sample.binormal, u0);
        const pTR = sample.pos.clone().addScaledVector(sample.binormal, u1);
        const pBL = pTL.clone(); pBL.y -= H;
        const pBR = pTR.clone(); pBR.y -= H;

        const n = isForward ? sample.tangent : sample.tangent.clone().negate();
        const vTL = builder.addVertex(pTL.x, pTL.y, pTL.z, n.x, 0, n.z, 0, 0);
        const vTR = builder.addVertex(pTR.x, pTR.y, pTR.z, n.x, 0, n.z, 1, 0);
        const vBR = builder.addVertex(pBR.x, pBR.y, pBR.z, n.x, 0, n.z, 1, 1);
        const vBL = builder.addVertex(pBL.x, pBL.y, pBL.z, n.x, 0, n.z, 0, 1);

        if (isForward) {
          builder.addQuad(vTL, vTR, vBR, vBL);
        } else {
          builder.addQuad(vTL, vBL, vBR, vTR);
        }
      };

      // Step 2: Build continuous glass bridge ribbons and precise openings
      for (let k = 0; k < uniqueSplits.length - 1; k++) {
        const sA = uniqueSplits[k];
        const sB = uniqueSplits[k + 1];
        const sMid = (sA + sB) * 0.5;
        const activeGap = gaps.find(g => sMid >= g.sStart && sMid <= g.sEnd);

        if (!activeGap) {
          // Solid full width bridge section
          loftRibbon(
            sA, sB,
            (s, smp) => -smp.width * 0.5,
            (s, smp) => smp.width * 0.5,
            glassBuilder
          );
        } else {
          // Intentional gap section: exactly 62.5% opening with smooth continuous flanking runner(s)
          const smpA = this.getTrackSample(sMid);
          const leftBound = -smpA.width * 0.5;
          const rightBound = smpA.width * 0.5;

          const hasLeftRunner = activeGap.laneStart > leftBound + 0.1;
          const hasRightRunner = activeGap.laneEnd < rightBound - 0.1;

          if (hasLeftRunner) {
            loftRibbon(
              sA, sB,
              (s, smp) => -smp.width * 0.5,
              () => activeGap.laneStart,
              glassBuilder
            );
          }
          if (hasRightRunner) {
            loftRibbon(
              sA, sB,
              () => activeGap.laneEnd,
              (s, smp) => smp.width * 0.5,
              glassBuilder
            );
          }

          // Gap openings: add clean vertical cut caps at the hole entrance and exit
          addEndCap(sA, activeGap.laneStart, activeGap.laneEnd, true, glassBuilder);
          addEndCap(sB, activeGap.laneStart, activeGap.laneEnd, false, glassBuilder);
        }
      }

      // Course start and end terminal caps
      addEndCap(0, -this.getTrackSample(0).width * 0.5, this.getTrackSample(0).width * 0.5, false, glassBuilder);
      addEndCap(totalLen, -this.getTrackSample(totalLen).width * 0.5, this.getTrackSample(totalLen).width * 0.5, true, glassBuilder);

      // Step 3: Build continuous glowing edge rails from s = 0 to s = totalLen
      const railWidth = 0.14;
      loftRibbon(
        0, totalLen,
        (s, smp) => -smp.width * 0.5 - railWidth * 0.5,
        (s, smp) => -smp.width * 0.5 + railWidth * 0.5,
        leftRailBuilder,
        true
      );
      loftRibbon(
        0, totalLen,
        (s, smp) => smp.width * 0.5 - railWidth * 0.5,
        (s, smp) => smp.width * 0.5 + railWidth * 0.5,
        rightRailBuilder,
        true
      );

      // Create the single continuous glass bridge mesh
      const continuousGlassGeo = glassBuilder.toGeometry();
      const continuousGlassMesh = new THREE.Mesh(continuousGlassGeo, glassMat);
      continuousGlassMesh.castShadow = true;
      continuousGlassMesh.receiveShadow = true;
      this.bridgeGroup.add(continuousGlassMesh);

      // Create the continuous left and right glowing rails
      const leftRailMesh = new THREE.Mesh(leftRailBuilder.toGeometry(), railMat);
      this.bridgeGroup.add(leftRailMesh);

      const rightRailMesh = new THREE.Mesh(rightRailBuilder.toGeometry(), railMat);
      this.bridgeGroup.add(rightRailMesh);

      // Foundation base pedestal under start pad
      const startP0 = this.getTrackSample(0);
      const startP8 = this.getTrackSample(8);
      const startCenter = new THREE.Vector3().addVectors(startP0.pos, startP8.pos).multiplyScalar(0.5);
      const startBaseGeo = new THREE.BoxGeometry(8.0, 0.4, 8.5);
      const startBaseMesh = new THREE.Mesh(startBaseGeo, startMat);
      startBaseMesh.position.copy(startCenter);
      startBaseMesh.position.y -= 0.45;
      startBaseMesh.rotation.y = startP0.yaw;
      this.bridgeGroup.add(startBaseMesh);

      // Support pillars every 16 meters under the center of the bridge
      for (let s = 16; s <= totalLen - 16; s += 16) {
        const p = this.getTrackSample(s);
        const pillarGeo = new THREE.CylinderGeometry(0.5, 0.7, 18, 16);
        const pillarMat = new THREE.MeshStandardMaterial({ color: 0x2A151C, roughness: 0.5, metalness: 0.5 });
        const pillar = new THREE.Mesh(pillarGeo, pillarMat);
        pillar.position.copy(p.pos);
        pillar.position.y -= 9.1;
        this.bridgeGroup.add(pillar);
      }

      // Checkpoint Arches
      this.course.checkpoints.forEach((cpS, cpIndex) => {
        const cpSample = this.getTrackSample(cpS);
        const archGeo = new THREE.TorusGeometry(cpSample.width * 0.55, 0.16, 16, 32, Math.PI);
        const archMat = new THREE.MeshStandardMaterial({
          color: 0xF59E0B,
          emissive: 0xD97706,
          emissiveIntensity: 0.6,
          roughness: 0.2
        });
        const archMesh = new THREE.Mesh(archGeo, archMat);
        archMesh.position.copy(cpSample.pos);
        archMesh.position.y += 0.1;
        archMesh.rotation.y = cpSample.yaw;
        this.bridgeGroup.add(archMesh);

        this.checkpointMarkers.push({
          s: cpS,
          index: cpIndex + 1,
          mesh: archMesh
        });
      });

      // Finish Portal at totalLength
      const finishSample = this.getTrackSample(totalLen);
      const finishGeo = new THREE.TorusGeometry(finishSample.width * 0.6, 0.25, 16, 32, Math.PI);
      const finishMat = new THREE.MeshStandardMaterial({
        color: 0x10B981,
        emissive: 0x059669,
        emissiveIntensity: 0.8,
        roughness: 0.15
      });
      const finishMesh = new THREE.Mesh(finishGeo, finishMat);
      finishMesh.position.copy(finishSample.pos);
      finishMesh.rotation.y = finishSample.yaw;
      this.bridgeGroup.add(finishMesh);

      // Playable bridge course is drawn in front of background environment
      this.bridgeGroup.renderOrder = 1;
      this.scene.add(this.bridgeGroup);
    }

    // --- LEVEL MANAGEMENT & RESETS ---
    startLevel(index, fromCheckpoint = false) {
      this.currentLevelIndex = index;
      this.course = COURSES[index];
      this.precomputeTrack();

      // CRITICAL RESET SAFETY: Clear all movement controls and reset speeds to 0
      this.controls.clear();
      this.isPaused = false;
      this.levelStartGraceTimer = 0.25;

      this.state = this.createState();
      this.state.vx = 0;
      this.state.vz = 0;

      if (fromCheckpoint && this.lastCheckpointS > 0) {
        const cpSample = this.getTrackSample(this.lastCheckpointS);
        this.state.x = cpSample.pos.x;
        this.state.z = cpSample.pos.z;
        this.state.s = this.lastCheckpointS;
        this.state.hintIdx = Math.floor(this.lastCheckpointS / this.trackStep);
        this.resetCameraToDefault(cpSample.yaw);
        this.showBanner(`Respawned at Checkpoint (${Math.round(this.lastCheckpointS)}m)`);
      } else {
        this.lastCheckpointS = 0;
        this.state.x = 0;
        this.state.z = 0;
        this.state.s = 0;
        this.state.hintIdx = 0;
        this.initCourse3D();
        const startSample = this.getTrackSample(0);
        this.resetCameraToDefault(startSample.yaw);
        this.showBanner(`${this.course.name} - Ready!`);
      }

      this.state.isFalling = false;
      this.state.fallVelocity = 0;
      this.state.fallY = 0;
      this.state.completed = false;

      this.lastBallPos = null;
      if (this.ballMesh) {
        this.ballMesh.quaternion.identity();
      }
      this.fallTumbleAxis = null;
      this.fallTumbleSpeed = 0;

      this.updateBall3DPosition(0.016);
      this.updateCameraImmediate();
      this.updateHUD();
      this.closeAllModals();
    }

    restartLevel() {
      this.startLevel(this.currentLevelIndex, false);
    }

    respawnAtCheckpoint() {
      this.startLevel(this.currentLevelIndex, true);
    }

    // --- CORE MOVEMENT LOOP (100% MANUAL BUTTON CONTROL) ---
    updateMovement(dt) {
      // 0. SAFETY: Do NOT move the ball if the game is paused or completed
      if (this.isPaused || this.state.completed) return;

      // Grace period at level start so ball does not move automatically
      if (this.levelStartGraceTimer > 0) {
        this.levelStartGraceTimer -= dt;
        return;
      }

      const state = this.state;
      const input = this.controls;

      // Natural gravity free-fall trajectory when unsupported by bridge
      if (state.isFalling) {
        state.fallVelocity += 22.0 * dt;
        state.fallY -= state.fallVelocity * dt;

        state.x += state.vx * dt;
        state.z += state.vz * dt;
        state.vx *= Math.max(0, 1 - 0.75 * dt);
        state.vz *= Math.max(0, 1 - 0.75 * dt);

        this.updateBall3DPosition(dt);
        if (state.fallY < -24.0) {
          this.onFallComplete();
        }
        return;
      }

      // --- CAMERA-RELATIVE MANUAL BALL CONTROLS ---
      // 1. Calculate camera's current horizontal viewing direction projected onto the horizontal movement plane (XZ):
      let camForwardX = 0;
      let camForwardZ = 1;

      if (this.camera && this.ballMesh) {
        const cdx = this.ballMesh.position.x - this.camera.position.x;
        const cdz = this.ballMesh.position.z - this.camera.position.z;
        const distHoriz = Math.hypot(cdx, cdz);
        if (distHoriz > 0.001) {
          camForwardX = cdx / distHoriz;
          camForwardZ = cdz / distHoriz;
        } else {
          camForwardX = -Math.sin(this.camYaw);
          camForwardZ = -Math.cos(this.camYaw);
        }
      } else {
        camForwardX = -Math.sin(this.camYaw);
        camForwardZ = -Math.cos(this.camYaw);
      }

      // 2. Relative horizontal right direction (+R is screen right in camera view):
      const camRightX = -camForwardZ;
      const camRightZ = camForwardX;

      // 3. Camera-Relative Directional Button Inputs:
      // - FRONT / FORWARD ('up'): Move forward in camera viewing direction (+camForward)
      // - BACK / BACKWARD ('down'): Move backward in opposite direction (-camForward)
      // - LEFT ('left'): Move to the left side relative to camera (-camRight)
      // - RIGHT ('right'): Move to the right side relative to camera (+camRight)
      const forwardInput = Number(input.has('up')) - Number(input.has('down'));
      const sideInput = Number(input.has('right')) - Number(input.has('left'));
      const inputMag = Math.hypot(forwardInput, sideInput);

      const maxSpeed = this.course.speed;
      const accel = 18.0;
      const friction = 10.0;

      if (inputMag < 0.001) {
        // Rotating the camera alone NEVER moves the ball.
        // When buttons are released, stop applying movement and let friction bring ball to a halt:
        state.vx += (-state.vx * friction) * dt;
        state.vz += (-state.vz * friction) * dt;
        if (Math.hypot(state.vx, state.vz) < 0.04) {
          state.vx = 0;
          state.vz = 0;
        }
      } else {
        // Calculate target unit direction vector relative to camera's horizontal heading:
        const factor = 1.0 / inputMag;
        const targetDirX = (forwardInput * camForwardX + sideInput * camRightX) * factor;
        const targetDirZ = (forwardInput * camForwardZ + sideInput * camRightZ) * factor;

        // Apply directional acceleration along the camera-relative vector
        state.vx += (targetDirX * accel - state.vx * 2.5) * dt;
        state.vz += (targetDirZ * accel - state.vz * 2.5) * dt;

        // Clamp total horizontal speed to maxSpeed
        const currentSpeed = Math.hypot(state.vx, state.vz);
        if (currentSpeed > maxSpeed) {
          state.vx = (state.vx / currentSpeed) * maxSpeed;
          state.vz = (state.vz / currentSpeed) * maxSpeed;
        }
      }

      state.x += state.vx * dt;
      state.z += state.vz * dt;

      // Realistic Edge Detection: check if ball is supported by the walkable bridge surface
      const surface = this.checkBridgeSurface(state.x, state.z, state.hintIdx);

      if (surface && surface.onBridge) {
        state.hintIdx = surface.i;
        state.s = Math.max(state.s, surface.s);

        // Checkpoints
        this.course.checkpoints.forEach((cpS, cpIndex) => {
          if (surface.s >= cpS && !state.activeCheckpoints.has(cpIndex)) {
            state.activeCheckpoints.add(cpIndex);
            this.lastCheckpointS = cpS;
            state.score += 250;
            this.sound.playCheckpoint();
            this.showBanner(`Checkpoint ${cpIndex + 1} Reached!`);
            const cpBadge = document.getElementById('checkpoint-txt');
            if (cpBadge) cpBadge.innerText = `Checkpoint ${cpIndex + 1}`;
          }
        });

        // Finish line victory check
        if (surface.s >= this.course.totalLength - 1.0) {
          this.triggerVictory();
          return;
        }
      } else {
        // Ball is no longer supported by the bridge (fell off edge, past corner, or into gap)
        state.isFalling = true;
        this.sound.playFall();
        return;
      }

      // 3D position and realistic rolling animation
      this.updateBall3DPosition(dt);
      this.updateCameraFollow(dt);

      // Score calculation
      state.score = Math.max(state.score, Math.floor(state.s * 10) + state.activeCheckpoints.size * 250);
      this.updateHUD();
    }

    updateBall3DPosition(dt = 0.016) {
      // Direct world-space positioning
      const surfaceY = this.ballRadius + this.state.fallY;
      const worldPos = new THREE.Vector3(this.state.x, surfaceY, this.state.z);

      this.ballMesh.position.copy(worldPos);

      // Position ground contact shadow and glass reflection on the bridge surface
      if (this.contactShadow) {
        const bridgeTopY = 0.003;
        this.contactShadow.position.set(worldPos.x, bridgeTopY, worldPos.z);
        this.contactShadow.rotation.x = -Math.PI / 2;

        if (this.contactReflection) {
          this.contactReflection.position.set(worldPos.x, bridgeTopY + 0.001, worldPos.z);
          this.contactReflection.rotation.x = -Math.PI / 2;
        }

        if (this.state.isFalling) {
          const fallDist = Math.abs(this.state.fallY);
          const fade = Math.max(0, 1.0 - fallDist / 4.5);
          this.contactShadow.material.opacity = 0.85 * fade;
          const sScale = Math.max(0.1, 1.0 - fallDist * 0.18);
          this.contactShadow.scale.set(sScale, sScale, 1);
          if (this.contactReflection) {
            this.contactReflection.material.opacity = 0.65 * fade;
            this.contactReflection.scale.set(sScale, sScale, 1);
          }
        } else {
          this.contactShadow.material.opacity = 0.85;
          this.contactShadow.scale.set(1, 1, 1);
          if (this.contactReflection) {
            this.contactReflection.material.opacity = 0.65;
            this.contactReflection.scale.set(1, 1, 1);
          }
        }
      }

      // Realistic Ball Rolling Animation using Quaternions:
      if (!this.state.isFalling) {
        if (this.lastBallPos) {
          const dx = worldPos.x - this.lastBallPos.x;
          const dz = worldPos.z - this.lastBallPos.z;
          const dist = Math.sqrt(dx * dx + dz * dz);

          if (dist > 0.00008) {
            const rollAngle = dist / this.ballRadius;
            // Rolling axis strictly perpendicular to horizontal travel direction:
            const rollAxis = new THREE.Vector3(-dz / dist, 0, dx / dist);
            const deltaQ = new THREE.Quaternion().setFromAxisAngle(rollAxis, rollAngle);
            this.ballMesh.quaternion.premultiply(deltaQ);

            // Store momentum tumble axis for realistic rotation if ball falls
            this.fallTumbleAxis = rollAxis.clone();
            this.fallTumbleSpeed = Math.min(14.0, (dist / Math.max(0.001, dt)) / this.ballRadius);
          }
        }
        this.lastBallPos = worldPos.clone();
      } else {
        // Natural tumbling rotation during free fall
        const tumbleAxis = this.fallTumbleAxis || new THREE.Vector3(1, 0.25, 0.45).normalize();
        const tumbleSpeed = (this.fallTumbleSpeed || 3.5) + this.state.fallVelocity * 0.35;
        const deltaQ = new THREE.Quaternion().setFromAxisAngle(tumbleAxis, tumbleSpeed * dt);
        this.ballMesh.quaternion.premultiply(deltaQ);
        this.lastBallPos = null;
      }

      // Dynamic sunlight coverage tracking player
      if (this.sunLight) {
        this.sunLight.target.position.set(worldPos.x, 0, worldPos.z);
        this.sunLight.position.set(worldPos.x + 32, 50, worldPos.z + 28);
      }
    }

    resetCameraToDefault(trackYaw = 0) {
      // Default view: placed directly behind ball along the track's yaw orientation
      // yaw angle corresponds to the azimuth from which camera looks at the ball
      this.camTargetYaw = trackYaw + Math.PI; // Positioned behind ball (+180 deg relative to track heading)
      this.camTargetPitch = 0.35; // ~20 degrees elevation angle
      this.camYaw = this.camTargetYaw;
      this.camPitch = this.camTargetPitch;
      this.camDistance = 7.5;
    }

    calculateCameraPosition(yaw, pitch, distance, ballPos) {
      // Spherical coordinate offset around the ball position:
      // pitch: elevation angle above horizon (0 to ~1.3 radians)
      // yaw: horizontal azimuth (0 to 2*PI, fully continuous 360 degrees)
      const cosPitch = Math.cos(pitch);
      const sinPitch = Math.sin(pitch);
      const sinYaw = Math.sin(yaw);
      const cosYaw = Math.cos(yaw);

      const offsetX = distance * cosPitch * sinYaw;
      const offsetY = distance * sinPitch;
      const offsetZ = distance * cosPitch * cosYaw;

      return new THREE.Vector3(
        ballPos.x + offsetX,
        ballPos.y + offsetY,
        ballPos.z + offsetZ
      );
    }

    updateCameraImmediate() {
      const ballPos = this.ballMesh.position;
      const targetLook = ballPos.clone().add(new THREE.Vector3(0, 0.4, 0));

      this.camYaw = this.camTargetYaw;
      this.camPitch = this.camTargetPitch;

      const camPos = this.calculateCameraPosition(this.camYaw, this.camPitch, this.camDistance, targetLook);
      this.camera.position.copy(camPos);
      this.camera.lookAt(targetLook);
    }

    updateCameraFollow(dt) {
      const ballPos = this.ballMesh.position;
      // Target point camera focuses on (slightly raised to look cleanly at center of ball)
      const targetLook = ballPos.clone().add(new THREE.Vector3(0, 0.4, 0));

      // Smooth interpolation for camera yaw and pitch
      // Handle shortest-angular-distance interpolation for continuous 360 rotation
      let diffYaw = this.camTargetYaw - this.camYaw;
      while (diffYaw < -Math.PI) diffYaw += Math.PI * 2;
      while (diffYaw > Math.PI) diffYaw -= Math.PI * 2;

      const smoothFactor = this.isCamDragging ? Math.min(1.0, dt * 28.0) : Math.min(1.0, dt * 14.0);
      this.camYaw += diffYaw * smoothFactor;
      this.camPitch += (this.camTargetPitch - this.camPitch) * smoothFactor;

      const targetCamPos = this.calculateCameraPosition(this.camYaw, this.camPitch, this.camDistance, targetLook);

      // Smooth camera position follow
      this.camera.position.lerp(targetCamPos, Math.min(1.0, dt * 12.0));
      this.camera.lookAt(targetLook);
    }

    onFallComplete() {
      const failReason = document.getElementById('txt-fail-reason');
      if (failReason) {
        failReason.innerText = "The ball fell off the edge of the glass bridge!";
      }
      document.getElementById('res-progress').innerText = `${Math.min(100, Math.round((this.state.s / this.course.totalLength) * 100))}%`;
      document.getElementById('res-score').innerText = `${this.state.score}`;
      this.openModal('modal-gameover');
    }

    triggerVictory() {
      this.state.completed = true;
      this.sound.playVictory();
      document.getElementById('vic-score').innerText = `${this.state.score + 1000}`;
      document.getElementById('vic-checkpoints').innerText = `${this.state.activeCheckpoints.size}/${this.course.checkpoints.length}`;
      this.openModal('modal-victory');
    }

    updateHUD() {
      const progress = Math.min(100, Math.round((this.state.s / this.course.totalLength) * 100));
      document.getElementById('bar-progress').style.width = `${progress}%`;
      document.getElementById('txt-progress-pct').innerText = `${progress}%`;
      document.getElementById('txt-score').innerText = `${this.state.score}`;
      document.getElementById('txt-level').innerText = `Level ${this.course.id}`;
    }

    showBanner(msg) {
      const banner = document.getElementById('banner-container');
      banner.innerHTML = `<div class="banner-msg">${msg}</div>`;
      setTimeout(() => {
        banner.innerHTML = '';
      }, 2400);
    }

    openModal(id) {
      this.closeAllModals();
      const el = document.getElementById(id);
      if (el) el.classList.add('active');
      this.isPaused = true;
    }

    closeAllModals() {
      document.querySelectorAll('.modal-overlay').forEach(el => el.classList.remove('active'));
      this.isPaused = false;
    }

    // --- INPUT EVENT LISTENERS (EXACT SPECIFICATION) ---
    initInputListeners() {
      // 1. TOUCH & DIRECTION BUTTONS WITH SAFE RELEASES
      const dirButtons = document.querySelectorAll('.dpad-btn');
      dirButtons.forEach(btn => {
        const dir = btn.getAttribute('data-dir');
        if (!dir) return;

        const onStart = (e) => {
          e.preventDefault();
          try {
            if (e.pointerId !== undefined && typeof btn.setPointerCapture === 'function') {
              btn.setPointerCapture(e.pointerId);
            }
          } catch (_) {}
          this.sound.init();
          this.controls.add(dir);
          btn.classList.add('active');
          if (window.AndroidBridge && typeof window.AndroidBridge.vibrate === 'function') {
            try { window.AndroidBridge.vibrate('tap'); } catch (_) {}
          }
        };

        const onEnd = (e) => {
          e.preventDefault();
          try {
            if (e.pointerId !== undefined && typeof btn.releasePointerCapture === 'function') {
              btn.releasePointerCapture(e.pointerId);
            }
          } catch (_) {}
          this.controls.delete(dir);
          btn.classList.remove('active');
        };

        btn.addEventListener('pointerdown', onStart);
        btn.addEventListener('pointerup', onEnd);
        btn.addEventListener('pointercancel', onEnd);
        btn.addEventListener('pointerleave', onEnd);
      });

      // 2. 360-DEGREE CAMERA TOUCH SWIPE & DRAG CONTROLS
      // Works on mobile touchscreens and desktop mouse drag.
      // Rotating the camera does NOT alter the ball's movement direction.
      const onCameraPointerDown = (e) => {
        // Only start camera rotation if not clicking on an interactive UI element
        // (e.g. movement D-pad, buttons, modals)
        if (e.target.closest('.interactive') || e.target.closest('.modal-overlay') || e.target.closest('button')) {
          return;
        }

        // We accept mouse left button (0) or touch/pen pointer
        if (e.pointerType === 'mouse' && e.button !== 0) return;

        this.sound.init();
        this.isCamDragging = true;
        this.activeCamPointerId = e.pointerId;
        this.camLastPointerX = e.clientX;
        this.camLastPointerY = e.clientY;
      };

      const onCameraPointerMove = (e) => {
        if (!this.isCamDragging || e.pointerId !== this.activeCamPointerId) return;

        const deltaX = e.clientX - this.camLastPointerX;
        const deltaY = e.clientY - this.camLastPointerY;

        this.camLastPointerX = e.clientX;
        this.camLastPointerY = e.clientY;

        // Sensitivity factors
        const rotSpeedX = 0.0065;
        const rotSpeedY = 0.0055;

        // Horizontal swipe rotates camera yaw around ball (full 360 degrees)
        // Drag LEFT (deltaX < 0) -> camera rotates RIGHT (yaw increases)
        // Drag RIGHT (deltaX > 0) -> camera rotates LEFT (yaw decreases)
        this.camTargetYaw += deltaX * rotSpeedX;

        // Vertical swipe adjusts camera pitch (elevation angle) - DO NOT CHANGE:
        // Drag screen UP (deltaY < 0) -> camera looks UP (pitch decreases / eye lowers relative to target)
        // Drag screen DOWN (deltaY > 0) -> camera looks DOWN (pitch increases / eye raises looking downward)
        this.camTargetPitch += deltaY * rotSpeedY;

        // Clamp camera pitch to prevent flipping upside-down or clipping underground
        // Min: ~0.05 rad (~3 deg elevation), Max: ~1.28 rad (~73 deg steep high-angle)
        this.camTargetPitch = Math.max(0.05, Math.min(1.28, this.camTargetPitch));
      };

      const onCameraPointerUp = (e) => {
        if (this.isCamDragging && (e.pointerId === undefined || e.pointerId === this.activeCamPointerId)) {
          this.isCamDragging = false;
          this.activeCamPointerId = null;
        }
      };

      window.addEventListener('pointerdown', onCameraPointerDown, { passive: true });
      window.addEventListener('pointermove', onCameraPointerMove, { passive: true });
      window.addEventListener('pointerup', onCameraPointerUp, { passive: true });
      window.addEventListener('pointercancel', onCameraPointerUp, { passive: true });

      // 3. GLOBAL POINTERUP & POINTERCANCEL SAFETY HANDLERS FOR MOVEMENT
      const releaseControls = () => {
        for (const direction of ['up', 'down', 'left', 'right']) {
          this.controls.delete(direction);
        }
        dirButtons.forEach(b => b.classList.remove('active'));
      };

      window.addEventListener('pointerup', releaseControls);
      window.addEventListener('pointercancel', releaseControls);
      window.addEventListener('blur', () => {
        releaseControls();
        this.isCamDragging = false;
        this.activeCamPointerId = null;
      });

      // 4. KEYBOARD LISTENERS (Arrow Keys & WASD)
      window.addEventListener('keydown', (e) => {
        this.sound.init();
        if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
          this.controls.add('up');
          document.getElementById('dpad-up')?.classList.add('active');
        } else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
          this.controls.add('down');
          document.getElementById('dpad-down')?.classList.add('active');
        } else if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
          this.controls.add('left');
          document.getElementById('dpad-left')?.classList.add('active');
        } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
          this.controls.add('right');
          document.getElementById('dpad-right')?.classList.add('active');
        }
      });

      window.addEventListener('keyup', (e) => {
        if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
          this.controls.delete('up');
          document.getElementById('dpad-up')?.classList.remove('active');
        } else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
          this.controls.delete('down');
          document.getElementById('dpad-down')?.classList.remove('active');
        } else if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
          this.controls.delete('left');
          document.getElementById('dpad-left')?.classList.remove('active');
        } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
          this.controls.delete('right');
          document.getElementById('dpad-right')?.classList.remove('active');
        }
      });

      // Window resize and orientation change handlers
      const handleResize = () => {
        const w = window.innerWidth;
        const h = window.innerHeight;
        if (this.camera && this.renderer) {
          this.camera.aspect = w / h;
          this.camera.updateProjectionMatrix();
          this.renderer.setSize(w, h);
        }
      };

      window.addEventListener('resize', handleResize);
      window.addEventListener('orientationchange', () => {
        handleResize();
        setTimeout(handleResize, 100);
        setTimeout(handleResize, 300);
      });

      // Main Animation Loop
      let lastTime = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
      const animate = (time) => {
        window.requestAnimationFrame(animate);
        const now = time || ((typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now());
        const dt = Math.min(0.1, (now - lastTime) / 1000);
        lastTime = now;

        this.updateMovement(dt);
        this.updateAmbientDust(dt, now * 0.001);
        this.updateSkyAndClouds(dt, now * 0.001);
        if (this.renderer && this.scene && this.camera) {
          this.renderer.render(this.scene, this.camera);
        }
      };
      window.requestAnimationFrame(animate);
    }

    // --- UI BUTTONS & MODALS ---
    initDOM() {
      // Camera Reset button (Top Bar)
      document.getElementById('btn-cam-reset')?.addEventListener('click', () => {
        this.sound.init();
        const track = this.getTrackSample(this.state ? this.state.s : 0);
        this.resetCameraToDefault(track.yaw);
        this.showBanner('Camera View Reset Behind Ball');
      });

      // Camera Reset button (Pause Modal)
      document.getElementById('btn-pause-cam-reset')?.addEventListener('click', () => {
        const track = this.getTrackSample(this.state ? this.state.s : 0);
        this.resetCameraToDefault(track.yaw);
        this.closeAllModals();
        this.showBanner('Camera View Reset Behind Ball');
      });

      // Pause button
      document.getElementById('btn-pause').addEventListener('click', () => {
        this.sound.init();
        this.openModal('modal-pause');
      });

      document.getElementById('btn-resume').addEventListener('click', () => {
        this.closeAllModals();
      });

      document.getElementById('btn-pause-close')?.addEventListener('click', () => {
        this.closeAllModals();
      });

      document.getElementById('btn-pause-restart').addEventListener('click', () => {
        this.restartLevel();
      });

      document.getElementById('btn-pause-checkpoint').addEventListener('click', () => {
        this.respawnAtCheckpoint();
      });

      // Level select
      document.getElementById('level-display').addEventListener('click', () => {
        this.populateLevelGrid();
        this.openModal('modal-levels');
      });

      document.getElementById('btn-levels').addEventListener('click', () => {
        this.populateLevelGrid();
        this.openModal('modal-levels');
      });

      document.getElementById('btn-close-levels').addEventListener('click', () => {
        this.closeAllModals();
      });

      // Restart button
      document.getElementById('btn-restart').addEventListener('click', () => {
        this.sound.init();
        this.restartLevel();
      });

      // Game Over buttons
      document.getElementById('btn-checkpoint-respawn').addEventListener('click', () => {
        this.sound.init();
        this.respawnAtCheckpoint();
      });

      document.getElementById('btn-retry').addEventListener('click', () => {
        this.sound.init();
        this.restartLevel();
      });

      // Victory buttons
      document.getElementById('btn-next-level').addEventListener('click', () => {
        this.sound.init();
        const nextIdx = (this.currentLevelIndex + 1) % COURSES.length;
        this.startLevel(nextIdx, false);
      });

      document.getElementById('btn-menu-from-vic').addEventListener('click', () => {
        this.populateLevelGrid();
        this.openModal('modal-levels');
      });
    }

    populateLevelGrid() {
      const grid = document.getElementById('level-list');
      grid.innerHTML = '';
      COURSES.forEach((course, idx) => {
        const tile = document.createElement('div');
        tile.className = `level-tile ${idx === this.currentLevelIndex ? 'active' : ''}`;
        tile.innerHTML = `
          <div class="level-number">${course.id}</div>
          <div style="font-size: 10px; color: #94A3B8; text-align: center; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 60px;">${course.name}</div>
          <div class="level-stars">★★★</div>
        `;
        tile.addEventListener('click', () => {
          this.startLevel(idx, false);
        });
        grid.appendChild(tile);
      });
    }
  }

  window.GameWorld = GameWorld;

  // Launch when DOM is ready
  window.addEventListener('DOMContentLoaded', () => {
    window.game = new GameWorld();
  });
})();
