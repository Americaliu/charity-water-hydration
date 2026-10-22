
const gameMap = document.getElementById("game-map");
const player = document.getElementById("player");
const scoreDisplay = document.getElementById("score");
const timerDisplay = document.getElementById("timer");
const feedback = document.getElementById("feedback");
const progress = document.getElementById("purify-progress");
const progressFill = document.getElementById("purify-fill");
const startButton = document.getElementById("start");
const resetButton = document.getElementById("reset");
const endScreen = document.getElementById("end-screen");

// Game settings
const GOAL = 500;
const TIME_LIMIT = 180; // Game time 3 minutes
const NORMAL_POINTS = 100;
const RISKY_POINTS = 300;
const FAILURE_PENALTY = 50;
const RISKY_SUCCESS_RATE = 0.35; // Purifier Lv.1: 35%
const PURIFY_TIME = 1500; // milliseconds
const INTERACTION_DISTANCE = 55; // pixels

// Six normal ponds guarantee that Level 1 can be completed.
// Two risky ponds offer an optional high-risk, high-reward shortcut.
const SOURCE_LAYOUT = [
  { x: 16, y: 20, risky: false },
  { x: 36, y: 27, risky: true },
  { x: 71, y: 20, risky: false },
  { x: 85, y: 43, risky: false },
  { x: 16, y: 70, risky: false },
  { x: 37, y: 82, risky: false },
  { x: 68, y: 76, risky: true },
  { x: 85, y: 85, risky: false }
];

// Game state
let sources = [];
let playerX = 50;
let playerY = 40;
let score = 0;
let timeLeft = TIME_LIMIT;
let started = false;
let gameOver = false;
let purifying = false;
let timerId = null;
let purificationId = null;

// Update player position and nearby pond highlighting
function updatePlayer() {
  player.style.left = `${playerX}%`;
  player.style.top = `${playerY}%`;

  const near = getNearbySource();

  sources.forEach(source => {
    source.element.classList.toggle(
      "nearby",
      source === near
    );
  });
}

// Update score display
function showScore() {
  scoreDisplay.textContent = score;
}

// Update timer display
function showTime() {
  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;

  timerDisplay.textContent =
    `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

// Create normal and contaminated ponds
function createSources() {
  document.querySelectorAll(".water-source").forEach(node => {
    node.remove();
  });

  sources = SOURCE_LAYOUT.map((pond, index) => {
    const element = document.createElement("div");

    element.className =
      `water-source${pond.risky ? " risky" : ""}`;

    element.style.left = `${pond.x}%`;
    element.style.top = `${pond.y}%`;

    element.textContent = pond.risky ? "⚠" : "💧";

    element.title = pond.risky
      ? "Contaminated Tier 1 pond"
      : "Normal Tier 1 pond";

    element.setAttribute("aria-label", element.title);

    gameMap.appendChild(element);

    return {
      ...pond,
      id: index,
      used: false,
      element
    };
  });
}

// Find the nearest unused pond
function getNearbySource() {
  const width = gameMap.clientWidth;
  const height = gameMap.clientHeight;

  let nearest = null;
  let nearestDistance = INTERACTION_DISTANCE;

  for (const source of sources) {
    if (source.used) continue;

    const dx = (playerX - source.x) * width / 100;
    const dy = (playerY - source.y) * height / 100;
    const distance = Math.hypot(dx, dy);

    if (distance <= nearestDistance) {
      nearest = source;
      nearestDistance = distance;
    }
  }

  return nearest;
}

// Player movement with WASD
function movePlayer(key) {
  if (!started || gameOver) return;

  if (purifying) {
    feedback.textContent = "Stay still while purifying!";
    return;
  }

  const step = 2;

  if (key === "w") playerY -= step;
  if (key === "s") playerY += step;
  if (key === "a") playerX -= step;
  if (key === "d") playerX += step;

  // Keep player inside the game map
  playerX = Math.max(3, Math.min(97, playerX));
  playerY = Math.max(4, Math.min(96, playerY));

  updatePlayer();
}

// Purification system
function purifyNearby() {
  if (!started || gameOver || purifying) return;

  const source = getNearbySource();

  if (!source) {
    feedback.textContent =
      "Move closer to a pond, then press E.";
    return;
  }

  purifying = true;

  feedback.textContent = source.risky
    ? "Purifying contaminated pond... (35% success chance)"
    : "Purifying normal pond...";

  // Show purification progress bar
  progress.style.display = "block";
  progressFill.style.transition = "none";
  progressFill.style.width = "0%";

  // Force the initial state to render
  void progressFill.offsetWidth;

  progressFill.style.transition =
    `width ${PURIFY_TIME}ms linear`;

  progressFill.style.width = "100%";

  purificationId = setTimeout(() => {
    purificationId = null;
    purifying = false;
    progress.style.display = "none";

    // Every pond can only be attempted once
    source.used = true;
    source.element.classList.add("used");

    // Normal pond: guaranteed points
    if (!source.risky) {
      score += NORMAL_POINTS;

      feedback.textContent =
        `Purification successful! +${NORMAL_POINTS} Water Points`;

    // Contaminated pond: random success check
    } else if (Math.random() < RISKY_SUCCESS_RATE) {
      score += RISKY_POINTS;

      feedback.textContent =
        `Risk paid off! +${RISKY_POINTS} Water Points`;

    // Contaminated pond: failed purification
    } else {
      score = Math.max(0, score - FAILURE_PENALTY);

      feedback.textContent =
        `Contamination too severe! -${FAILURE_PENALTY} Water Points`;
    }

    showScore();
    updatePlayer();

    // Check for victory or exhausted water sources
    if (score >= GOAL) {
      finishGame(true);
    } else if (sources.every(pond => pond.used)) {
      finishGame(false);
    }

  }, PURIFY_TIME);
}

// Victory celebration
function addConfetti() {
  const colors = ["#ffc629", "#ffffff", "#58bad6"];

  for (let i = 0; i < 35; i++) {
    const piece = document.createElement("span");

    piece.className = "confetti";
    piece.style.left = `${Math.random() * 100}%`;
    piece.style.background = colors[i % colors.length];
    piece.style.animationDelay =
      `${Math.random() * 0.6}s`;

    endScreen.appendChild(piece);
  }
}

// End the game
function finishGame(won) {
  started = false;
  gameOver = true;
  purifying = false;

  clearInterval(timerId);
  clearTimeout(purificationId);

  timerId = null;
  purificationId = null;

  progress.style.display = "none";

  document.getElementById("end-title").textContent =
    won ? "🎉 Level Complete!" : "Time's Up!";

  document.getElementById("end-detail").textContent =
    `Final score: ${score} / ${GOAL}`;

  endScreen.classList.add("visible");

  if (won) {
    addConfetti();
  }
}

// Start the timer and gameplay
function startGame() {
  if (started || gameOver) return;

  started = true;
  startButton.disabled = true;

  feedback.textContent =
    "Find a pond! Press E when its outline turns yellow.";

  timerId = setInterval(() => {
    if (!started) return;

    timeLeft = Math.max(0, timeLeft - 1);
    showTime();

    if (timeLeft === 0) {
      finishGame(false);
    }
  }, 1000);
}

// Reset all game data
function resetGame() {
  clearInterval(timerId);
  clearTimeout(purificationId);

  document.querySelectorAll(".confetti").forEach(node => {
    node.remove();
  });

  timerId = null;
  purificationId = null;

  started = false;
  gameOver = false;
  purifying = false;

  playerX = 50;
  playerY = 40;
  score = 0;
  timeLeft = TIME_LIMIT;

  startButton.disabled = false;
  endScreen.classList.remove("visible");

  progress.style.display = "none";
  progressFill.style.width = "0%";

  feedback.textContent =
    "Press Start Game to begin.";

  createSources();
  updatePlayer();
  showScore();
  showTime();
}

// Keyboard controls
document.addEventListener("keydown", event => {
  const key = event.key.toLowerCase();

  if (["w", "a", "s", "d", "e"].includes(key)) {
    event.preventDefault();
  }

  if (["w", "a", "s", "d"].includes(key)) {
    movePlayer(key);
  }

  if (key === "e" && !event.repeat) {
    purifyNearby();
  }
});

// Game buttons
startButton.addEventListener("click", startGame);
resetButton.addEventListener("click", resetGame);

document.getElementById("play-again")
  .addEventListener("click", resetGame);

document.getElementById("touch-purify")
  .addEventListener("click", purifyNearby);

// Basic mobile controls
document.querySelectorAll("[data-move]").forEach(button => {
  button.addEventListener("click", () => {
    movePlayer(button.dataset.move);
  });
});

// Responsive position highlighting
window.addEventListener("resize", updatePlayer);

// Initialize game
resetGame();
