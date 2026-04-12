// FILE: frontend/main.js
'use strict';

// ================================================================
// === SELECTED GAME MODE ===
// ================================================================
var selectedMode = null; // 'ai-vs-ai' | 'human-vs-aegis' | 'human-vs-velo'

// ================================================================
// === START SCREEN LOGIC ===
// ================================================================
function initStartScreen() {
    // Animate bot canvases
    animateBotCanvas('aegis-canvas', '#4488ff', '#2255cc');
    animateBotCanvas('velo-canvas',  '#ff4444', '#cc1122');

    // Mode selection
    document.querySelectorAll('.mode-btn').forEach(function(btn) {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.mode-btn').forEach(function(b) { b.classList.remove('selected'); });
            btn.classList.add('selected');
            selectedMode = btn.getAttribute('data-mode');
            document.getElementById('start-play-btn').disabled = false;
            var noteEl = document.getElementById('start-mode-note');
            var notes = {
                'ai-vs-ai':        'Watch AEGIS (Minimax) vs VELO (Greedy) battle it out',
                'human-vs-aegis':  'You play as VELO against the Minimax AI (AEGIS)',
                'human-vs-velo':   'You play as AEGIS against the Greedy AI (VELO)'
            };
            noteEl.textContent = notes[selectedMode] || '';
        });
    });

    // Play button
    document.getElementById('start-play-btn').addEventListener('click', function() {
        if (!selectedMode) return;
        launchGame(selectedMode);
    });
}

function animateBotCanvas(canvasId, colorPrimary, colorSecondary) {
    var canvas = document.getElementById(canvasId);
    if (!canvas) return;
    var ctx = canvas.getContext('2d');
    var W = canvas.width, H = canvas.height;
    var t = 0;

    function draw() {
        ctx.clearRect(0, 0, W, H);

        // Body
        var cx = W / 2, cy = H / 2 + 10;
        var pulse = Math.sin(t * 0.04) * 3;

        // Outer glow
        var grd = ctx.createRadialGradient(cx, cy, 20, cx, cy, 60 + pulse);
        grd.addColorStop(0, colorPrimary + '44');
        grd.addColorStop(1, 'transparent');
        ctx.fillStyle = grd;
        ctx.beginPath();
        ctx.arc(cx, cy, 60 + pulse, 0, Math.PI * 2);
        ctx.fill();

        // Core sphere
        ctx.beginPath();
        ctx.arc(cx, cy, 32 + pulse * 0.3, 0, Math.PI * 2);
        var bodyGrd = ctx.createRadialGradient(cx - 8, cy - 8, 4, cx, cy, 34);
        bodyGrd.addColorStop(0, colorPrimary + 'ff');
        bodyGrd.addColorStop(0.6, colorSecondary + 'dd');
        bodyGrd.addColorStop(1, '#000000cc');
        ctx.fillStyle = bodyGrd;
        ctx.fill();

        // Ring
        ctx.beginPath();
        ctx.arc(cx, cy, 38 + pulse * 0.2, 0, Math.PI * 2);
        ctx.strokeStyle = colorPrimary + '66';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Rotating orbit dots
        for (var i = 0; i < 3; i++) {
            var angle = t * 0.03 + (i * Math.PI * 2 / 3);
            var ox = cx + Math.cos(angle) * 50;
            var oy = cy + Math.sin(angle) * 18;
            ctx.beginPath();
            ctx.arc(ox, oy, 3, 0, Math.PI * 2);
            ctx.fillStyle = colorPrimary + 'cc';
            ctx.fill();
        }

        // Eye glints
        ctx.beginPath();
        ctx.arc(cx - 10, cy - 4, 5, 0, Math.PI * 2);
        ctx.arc(cx + 10, cy - 4, 5, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff44';
        ctx.fill();

        ctx.beginPath();
        ctx.arc(cx - 9, cy - 5, 2.5, 0, Math.PI * 2);
        ctx.arc(cx + 11, cy - 5, 2.5, 0, Math.PI * 2);
        ctx.fillStyle = colorPrimary + 'ff';
        ctx.fill();

        t++;
        requestAnimationFrame(draw);
    }
    draw();
}

// ================================================================
// === GAME LAUNCH ===
// ================================================================
function launchGame(mode) {
    // Fade out start screen
    var ss = document.getElementById('start-screen');
    ss.classList.add('fade-out');
    setTimeout(function() {
        ss.style.display = 'none';
        document.getElementById('game-screen').style.display = 'block';
        startGameWithMode(mode);
    }, 500);
}

// ================================================================
// === GAME CONTROLLER ===
// ================================================================
var engine         = null;
var sceneSetup     = null;
var isRunning      = false;
var uiInterval     = null;
var humanMode      = false;  // true when a human player is involved
var humanAgent     = null;   // 'aegis' | 'velo' — which agent human controls
var humanTurnReady = false;  // true when it's the human's turn to act

function startGameWithMode(mode) {
    humanMode  = (mode !== 'ai-vs-ai');
    humanAgent = (mode === 'human-vs-velo') ? 'aegis' : (mode === 'human-vs-aegis') ? 'velo' : null;

    var container = document.getElementById('game-container');
    if (!container) { console.error('game-container not found'); return; }

    if (!sceneSetup) {
        sceneSetup = new SceneSetup(container);
    }

    isRunning = true;
    document.getElementById('pause-btn').disabled = false;

    engine = new CoreEngine();
    engine.setHumanMode(humanMode, humanAgent);
    engine.onHumanTurn = onHumanTurnStart;
    engine.init(sceneSetup);

    uiInterval = setInterval(updateGameUI, 200);

    // Show human controls if needed
    if (humanMode) {
        document.getElementById('human-controls').style.display = 'flex';
        setupHumanControls();
    }
}

function setupHumanControls() {
    document.getElementById('btn-move-up').onclick    = function() { humanAction({ type: 'move_dir', dir: 'up' }); };
    document.getElementById('btn-move-down').onclick  = function() { humanAction({ type: 'move_dir', dir: 'down' }); };
    document.getElementById('btn-move-left').onclick  = function() { humanAction({ type: 'move_dir', dir: 'left' }); };
    document.getElementById('btn-move-right').onclick = function() { humanAction({ type: 'move_dir', dir: 'right' }); };
    document.getElementById('btn-pass').onclick       = function() { humanAction({ type: 'pass' }); };
    document.getElementById('btn-pulse').onclick      = function() { humanAction({ type: 'standard_attack' }); };
    document.getElementById('btn-burst').onclick      = function() { humanAction({ type: 'logic_burst' }); };
    document.getElementById('btn-beam').onclick       = function() { humanAction({ type: 'elemental_beam' }); };
    document.getElementById('btn-defend').onclick     = function() { humanAction({ type: 'defend' }); };
}

function onHumanTurnStart() {
    humanTurnReady = true;
    setHumanControlsEnabled(true);
    updateActionLog('YOUR TURN — choose an action');
}

function humanAction(action) {
    if (!humanTurnReady) return;
    humanTurnReady = false;
    setHumanControlsEnabled(false);
    if (engine) engine.submitHumanAction(action);
}

function setHumanControlsEnabled(enabled) {
    var ctrl = document.getElementById('human-controls');
    if (!ctrl) return;
    ctrl.querySelectorAll('button').forEach(function(b) { b.disabled = !enabled; });
}

// ================================================================
// === UI UPDATE ===
// ================================================================
function updateGameUI() {
    if (!engine) return;

    var phase = engine.getPhase();
    var phaseLabels = {
        maze: 'Maze Navigation', maze_complete: 'Entering Arena',
        transition: 'Transition', battle: 'Combat Arena', finished: 'Game Over'
    };

    var phaseEl = document.getElementById('hud-phase');
    if (phaseEl) phaseEl.textContent = phaseLabels[phase] || phase;

    var turnEl = document.getElementById('hud-turn');
    if (turnEl) turnEl.textContent = engine.getTurnCount();

    var ah = Math.max(0, engine.getAegisHP());
    var vh = Math.max(0, engine.getVeloHP());

    // HUD bottom bars
    var ab = document.getElementById('hud-bar-aegis');
    var vb = document.getElementById('hud-bar-velo');
    if (ab) ab.style.width = ah + '%';
    if (vb) vb.style.width = vh + '%';

    var at = document.getElementById('hud-hp-aegis');
    var vt = document.getElementById('hud-hp-velo');
    if (at) at.textContent = ah + '/100';
    if (vt) vt.textContent = vh + '/100';
}

function updateActionLog(text) {
    var el = document.getElementById('action-log-text');
    if (!el) return;
    el.style.opacity = '0';
    setTimeout(function() {
        el.textContent = text;
        el.style.opacity = '1';
    }, 100);
}

// Expose for coreEngine to call
window.updateActionLog = updateActionLog;
window.resetToStartScreen = resetToStartScreen;

// ================================================================
// === PAUSE / RESET BUTTONS ===
// ================================================================
function setupGameButtons() {
    document.getElementById('pause-btn').addEventListener('click', function() {
        if (!engine) return;
        if (engine.isPaused_) {
            engine.resume();
            this.textContent = 'PAUSE';
        } else {
            engine.pause();
            this.textContent = 'RESUME';
        }
    });

    document.getElementById('reset-btn').addEventListener('click', function() {
        resetToStartScreen();
    });
}

function resetToStartScreen() {
    // Stop engine
    if (engine) { engine.stop(); engine = null; }
    if (uiInterval) { clearInterval(uiInterval); uiInterval = null; }

    isRunning      = false;
    humanMode      = false;
    humanAgent     = null;
    humanTurnReady = false;

    // Reset button states
    var pauseBtn = document.getElementById('pause-btn');
    if (pauseBtn) { pauseBtn.disabled = true; pauseBtn.textContent = 'PAUSE'; }

    // Remove end screen
    var es = document.getElementById('end-screen');
    if (es) es.remove();

    // Clear banner
    var banner = document.getElementById('banner');
    if (banner) banner.innerHTML = '';

    // Clear action log
    var al = document.getElementById('action-log-text');
    if (al) al.textContent = '—';

    // Hide human controls
    var hc = document.getElementById('human-controls');
    if (hc) hc.style.display = 'none';

    // Hide game screen, show start screen
    document.getElementById('game-screen').style.display = 'none';
    var ss = document.getElementById('start-screen');
    ss.style.display = 'flex';
    ss.style.opacity = '1';
    ss.classList.remove('fade-out');

    // Reset mode selection
    document.querySelectorAll('.mode-btn').forEach(function(b) { b.classList.remove('selected'); });
    document.getElementById('start-play-btn').disabled = true;
    document.getElementById('start-mode-note').textContent = 'Select a mode above to begin';
    selectedMode = null;
}

// ================================================================
// === BOOTSTRAP ===
// ================================================================
document.addEventListener('DOMContentLoaded', function() {
    initStartScreen();
    setupGameButtons();
});
