// FILE: frontend/engine/coreEngine.js
'use strict';

// ================================================================
// === CONSTANTS & GRID ===
// ================================================================
var GRID_SIZE      = 7;
var ARENA_MIN      = 3;
var ARENA_MAX      = 5;
var SPAWN          = { col: 7, row: 4 };
var EXIT           = { col: 7, row: 7 };
var FIXED_WALLS    = [ { col: 6, row: 5 }, { col: 7, row: 5 } ];
var TRAP_CHANCE    = 0.3;
var STEP_INTERVAL  = 600;
var TRAP_DAMAGE    = 1;
var BOARD_LEFT_X   = -10;
var BOARD_RIGHT_X  = 10;
var FADE_DURATION  = 400;
var FRUSTUM_HALF   = 10;

// ================================================================
// === MODULE-LEVEL STATE ===
// ================================================================
var coreScene    = null;
var coreRenderer = null;
var camera       = null;

var gameStatePhase    = 'maze';
var mazeWinner        = null;
var agentsDone        = 0;
var lastTimestamp      = -1;
var gameLoopRunning   = true;
var isPaused          = false;

var aegis  = null;
var velo   = null;
var agents = [];

var mazeData    = {};
var boardMeshes = { left: [], right: [] };
var fadeQueue   = [];

// Transition variables
var transitionTimer     = 0;
var transitionStarted   = false;
var arenaMeshesBuilt    = false;
var cameraSwapped       = false;
var transitionFinalized = false;
var step1Logged         = false;
var arenaMeshes         = [];
var arenaLight          = null;
var battleCamTarget     = null;
var battleCamLookAt     = null;

// Battle phase state
var battleTurnNumber      = 0;
var currentTurnAgent      = null;
var otherAgent            = null;
var battleActionTimer     = 0;
var battleTurnInProgress  = false;
var beamAnimations        = [];
var healthPickupMesh      = null;
var healthPickupLight     = null;
var victoryLight          = null;
var victoryLightStartTime = 0;
var victoryWinnerMesh     = null;
var endScreenShown        = false;
var battleWinnerName      = null;
var healthPickupPos       = null;
var healthPickupActive    = false;
var healthPickupSpawned   = false;
var endScreenInterval     = null;

// Human player mode
var humanModeEnabled  = false;
var humanAgentName    = null;   // 'aegis' | 'velo'
var pendingHumanAction = null;  // set when human submits an action
var waitingForHuman   = false;  // true when it's human's turn

// Battle constants
var BATTLE_TURN_DELAY        = 900;
var PULSE_STRIKE_DMG         = 5;
var PULSE_STRIKE_DEF_DMG     = 2;
var LOGIC_BURST_DMG          = 10;
var LOGIC_BURST_DEF_DMG      = 6;
var ELEMENTAL_BEAM_DMG       = 25;
var ELEMENTAL_BEAM_DEF_DMG   = 18;
var HEALTH_PICKUP_HEAL       = 40;
var MOVE_COOLDOWN_TURNS      = 3;
var DEFEND_COOLDOWN_TURNS    = 1;
var LOGIC_BURST_CHARGE_REQ   = 3;
var MINIMAX_DEPTH            = 4;

// ================================================================
// === GRID HELPERS ===
// ================================================================
function gridToWorld(col, row, boardOffsetX) {
    return new THREE.Vector3(
        (col - 4) + (boardOffsetX || 0),
        0,
        (row - 4)
    );
}

function isArena(col, row) {
    return col >= ARENA_MIN && col <= ARENA_MAX &&
           row >= ARENA_MIN && row <= ARENA_MAX;
}

function isFixedWall(col, row) {
    return FIXED_WALLS.some(function (w) { return w.col === col && w.row === row; });
}

function isInBounds(col, row) {
    return col >= 1 && col <= GRID_SIZE && row >= 1 && row <= GRID_SIZE;
}

function tileIsPassable(col, row) {
    if (!isInBounds(col, row)) return false;
    var t = mazeData[col][row].type;
    return t !== 'wall' && t !== 'arena';
}

// ================================================================
// === MAZE GENERATION ===
// ================================================================
function generateMaze() {
    for (var col = 1; col <= GRID_SIZE; col++) {
        mazeData[col] = {};
        for (var row = 1; row <= GRID_SIZE; row++) {
            if (isArena(col, row)) {
                mazeData[col][row] = { type: 'arena' };
            } else if (isFixedWall(col, row)) {
                mazeData[col][row] = { type: 'wall' };
            } else if (col === SPAWN.col && row === SPAWN.row) {
                mazeData[col][row] = { type: 'spawn' };
            } else if (col === EXIT.col && row === EXIT.row) {
                mazeData[col][row] = { type: 'exit' };
            } else {
                mazeData[col][row] = { type: Math.random() < TRAP_CHANCE ? 'trap' : 'floor' };
            }
        }
    }

    if (!verifyPath()) {
        for (var c = 1; c <= GRID_SIZE; c++)
            for (var r = 1; r <= GRID_SIZE; r++)
                if (mazeData[c][r].type === 'trap') mazeData[c][r].type = 'floor';
    }

    var trapCount = 0, wallCount = 0;
    for (var c = 1; c <= GRID_SIZE; c++)
        for (var r = 1; r <= GRID_SIZE; r++) {
            if (mazeData[c][r].type === 'trap') trapCount++;
            if (mazeData[c][r].type === 'wall') wallCount++;
        }
    console.log('[INIT] Maze generated. Traps: ' + trapCount + ', Walls: ' + wallCount);
}

function verifyPath() {
    var visited = {};
    var queue   = [ { col: SPAWN.col, row: SPAWN.row } ];
    visited[SPAWN.col + ',' + SPAWN.row] = true;
    var dirs = [ {dc:0,dr:1}, {dc:0,dr:-1}, {dc:1,dr:0}, {dc:-1,dr:0} ];

    while (queue.length > 0) {
        var cur = queue.shift();
        if (cur.col === EXIT.col && cur.row === EXIT.row) return true;
        for (var i = 0; i < dirs.length; i++) {
            var nc = cur.col + dirs[i].dc;
            var nr = cur.row + dirs[i].dr;
            var key = nc + ',' + nr;
            if (isInBounds(nc, nr) && !visited[key]) {
                var t = mazeData[nc][nr].type;
                if (t !== 'wall' && t !== 'arena') {
                    visited[key] = true;
                    queue.push({ col: nc, row: nr });
                }
            }
        }
    }
    return false;
}

// ================================================================
// === DUAL BOARD RENDERING ===
// ================================================================
function buildBoard(boardOffsetX, sideKey) {
    var meshes = [];

    for (var col = 1; col <= GRID_SIZE; col++) {
        for (var row = 1; row <= GRID_SIZE; row++) {
            var tile = mazeData[col][row];
            if (tile.type === 'arena') continue;

            var pos = gridToWorld(col, row, boardOffsetX);

            var floorColor    = 0x444455;
            var floorEmissive = 0x000000;

            if (tile.type === 'trap')  { floorColor = 0x882200; floorEmissive = 0x440000; }
            if (tile.type === 'exit')  { floorColor = 0x22AA44; floorEmissive = 0x114422; }
            if (tile.type === 'spawn') { floorColor = 0x666688; floorEmissive = 0x222244; }

            var floorMat = new THREE.MeshStandardMaterial({
                color: floorColor, emissive: floorEmissive,
                transparent: true, opacity: 1.0
            });
            var floor = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.1, 0.95), floorMat);
            floor.position.set(pos.x, 0.05, pos.z);
            coreScene.add(floor);
            meshes.push(floor);

            if (tile.type === 'wall') {
                var wallMat = new THREE.MeshStandardMaterial({
                    color: 0x222233, transparent: true, opacity: 1.0
                });
                var wall = new THREE.Mesh(new THREE.BoxGeometry(1, 1.5, 1), wallMat);
                wall.position.set(pos.x, 0.75, pos.z);
                coreScene.add(wall);
                meshes.push(wall);
            }

            if (tile.type === 'trap') {
                var spikeGeo = new THREE.ConeGeometry(0.08, 0.4, 4);
                var spikeOffsets = [
                    { x: -0.2, z: -0.2 }, { x:  0.2, z: -0.2 },
                    { x: -0.2, z:  0.2 }, { x:  0.2, z:  0.2 }
                ];
                for (var s = 0; s < spikeOffsets.length; s++) {
                    var spikeMat = new THREE.MeshStandardMaterial({
                        color: 0xCC4400, emissive: 0x441100,
                        transparent: true, opacity: 1.0
                    });
                    var spike = new THREE.Mesh(spikeGeo, spikeMat);
                    spike.position.set(
                        pos.x + spikeOffsets[s].x,
                        0.3,
                        pos.z + spikeOffsets[s].z
                    );
                    coreScene.add(spike);
                    meshes.push(spike);
                }
            }
        }
    }
    boardMeshes[sideKey] = meshes;
}

// ================================================================
// === AGENT CLASS ===
// ================================================================
function Agent(name, color, lerpSpeed, boardOffsetX, boardSide) {
    this.name          = name;
    this.logicalPos    = { col: SPAWN.col, row: SPAWN.row };
    this.hp            = 100;
    this.maxHP         = 100;
    this.lerpSpeed     = lerpSpeed;
    this.originalColor = color;
    this.boardOffsetX  = boardOffsetX;
    this.boardSide     = boardSide;

    this.material = new THREE.MeshStandardMaterial({
        color: color, transparent: true, opacity: 1.0
    });
    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(0.4, 16, 16), this.material);

    var spawn = gridToWorld(SPAWN.col, SPAWN.row, boardOffsetX);
    this.mesh.position.set(spawn.x, 0.5, spawn.z);
    coreScene.add(this.mesh);

    this.targetWorldPos = new THREE.Vector3(spawn.x, 0.5, spawn.z);
    this.path      = [];
    this.pathIndex  = 0;
    this.stepTimer  = 0;
    this.done       = false;

    // Battle properties (Phase 2/3)
    this.moveCooldown      = 0;
    this.defendCooldown    = 0;
    this.isDefending       = false;
    this.logicBurstCharge  = 0;
    this.elementalBeamUsed = false;
}

// ================================================================
// === PATHFINDING ===
// ================================================================
var DIRS = [ {dc:0,dr:1}, {dc:0,dr:-1}, {dc:1,dr:0}, {dc:-1,dr:0} ];

function getNeighbors(col, row) {
    var result = [];
    for (var i = 0; i < DIRS.length; i++) {
        var nc = col + DIRS[i].dc;
        var nr = row + DIRS[i].dr;
        if (tileIsPassable(nc, nr)) result.push({ col: nc, row: nr });
    }
    return result;
}

function manhattan(c1, r1, c2, r2) {
    return Math.abs(c1 - c2) + Math.abs(r1 - r2);
}

function findPathAStar(startCol, startRow, goalCol, goalRow) {
    var openSet  = [ { col: startCol, row: startRow } ];
    var cameFrom = {};
    var gScore   = {};
    var fScore   = {};
    var closed   = {};

    var sk = startCol + ',' + startRow;
    gScore[sk] = 0;
    fScore[sk] = manhattan(startCol, startRow, goalCol, goalRow);

    while (openSet.length > 0) {
        var bestIdx = 0;
        for (var i = 1; i < openSet.length; i++) {
            var fi = fScore[openSet[i].col + ',' + openSet[i].row];
            var fb = fScore[openSet[bestIdx].col + ',' + openSet[bestIdx].row];
            if (fi < fb) bestIdx = i;
        }
        var current = openSet.splice(bestIdx, 1)[0];
        var ck = current.col + ',' + current.row;

        if (current.col === goalCol && current.row === goalRow) {
            var path = [];
            var k = ck;
            while (k !== undefined) {
                var parts = k.split(',');
                path.unshift({ col: parseInt(parts[0]), row: parseInt(parts[1]) });
                k = cameFrom[k];
            }
            return path;
        }

        closed[ck] = true;
        var neighbors = getNeighbors(current.col, current.row);

        for (var n = 0; n < neighbors.length; n++) {
            var nb = neighbors[n];
            var nk = nb.col + ',' + nb.row;
            if (closed[nk]) continue;

            var trapCost = mazeData[nb.col][nb.row].type === 'trap' ? 50 : 0;
            var tentG    = gScore[ck] + 1 + trapCost;

            if (gScore[nk] === undefined || tentG < gScore[nk]) {
                cameFrom[nk] = ck;
                gScore[nk]   = tentG;
                fScore[nk]   = tentG + manhattan(nb.col, nb.row, goalCol, goalRow);
                var inOpen = false;
                for (var j = 0; j < openSet.length; j++) {
                    if (openSet[j].col === nb.col && openSet[j].row === nb.row) { inOpen = true; break; }
                }
                if (!inOpen) openSet.push({ col: nb.col, row: nb.row });
            }
        }
    }
    return [];
}

function findPathGreedy(startCol, startRow, goalCol, goalRow) {
    var openSet = [ { col: startCol, row: startRow, h: manhattan(startCol, startRow, goalCol, goalRow) } ];
    var cameFrom = {};
    var visited  = {};
    visited[startCol + ',' + startRow] = true;

    while (openSet.length > 0) {
        var bestIdx = 0;
        for (var i = 1; i < openSet.length; i++) {
            if (openSet[i].h < openSet[bestIdx].h) bestIdx = i;
        }
        var current = openSet.splice(bestIdx, 1)[0];
        var ck = current.col + ',' + current.row;

        if (current.col === goalCol && current.row === goalRow) {
            var path = [];
            var k = ck;
            while (k !== undefined) {
                var parts = k.split(',');
                path.unshift({ col: parseInt(parts[0]), row: parseInt(parts[1]) });
                k = cameFrom[k];
            }
            return path;
        }

        var neighbors = getNeighbors(current.col, current.row);
        for (var n = 0; n < neighbors.length; n++) {
            var nb = neighbors[n];
            var nk = nb.col + ',' + nb.row;
            if (visited[nk]) continue;
            visited[nk] = true;
            cameFrom[nk] = ck;
            openSet.push({ col: nb.col, row: nb.row, h: manhattan(nb.col, nb.row, goalCol, goalRow) });
        }
    }
    return [];
}

function computePath(agent) {
    if (agent.name === 'AEGIS') {
        return findPathAStar(agent.logicalPos.col, agent.logicalPos.row, EXIT.col, EXIT.row);
    }
    return findPathGreedy(agent.logicalPos.col, agent.logicalPos.row, EXIT.col, EXIT.row);
}

// ================================================================
// === MAZE PHASE LOGIC ===
// ================================================================
function flashRed(agent) {
    agent.material.color.set(0xFF0000);
    var mat = agent.material;
    var orig = agent.originalColor;
    setTimeout(function () { mat.color.set(orig); }, 300);
}

function updateMazePhase(delta) {
    if (gameStatePhase !== 'maze') return;

    stepAgent(aegis, delta);
    stepAgent(velo, delta);

    if (aegis.done && velo.done) {
        console.log("MAZE PHASE COMPLETE \u2014 awaiting next phase");
        gameStatePhase = 'maze_complete';
        showBanner('Both agents ready \u2014 entering arena...');
    }
}

function stepAgent(agent, delta) {
    if (agent.done) return;

    agent.stepTimer += delta;

    var dist = agent.mesh.position.distanceTo(agent.targetWorldPos);
    if (dist > 0.05) return;

    if (agent.stepTimer < STEP_INTERVAL) return;
    agent.stepTimer = 0;

    if (agent.pathIndex >= agent.path.length) return;

    var next = agent.path[agent.pathIndex];

    if (!tileIsPassable(next.col, next.row)) {
        agent.path = computePath(agent);
        agent.pathIndex = 1;
        if (agent.path.length <= 1) return;
        return;
    }

    agent.logicalPos = { col: next.col, row: next.row };
    agent.pathIndex++;

    var wp = gridToWorld(next.col, next.row, agent.boardOffsetX);
    agent.targetWorldPos.set(wp.x, 0.5, wp.z);

    console.log('[STEP] ' + agent.name + ' moved to (' + next.col + ',' + next.row + ')');

    if (mazeData[next.col][next.row].type === 'trap') {
        agent.hp -= TRAP_DAMAGE;
        flashRed(agent);
        console.log('[TRAP] ' + agent.name + ' stepped on trap at (' + next.col + ',' + next.row + '). HP: ' + agent.hp);
    }

    if (next.col === EXIT.col && next.row === EXIT.row) {
        agent.done = true;
        agentsDone++;
        if (mazeWinner === null) mazeWinner = agent.name;

        console.log('[MAZE] ' + agent.name + ' reached (7,7). Maze winner: ' + mazeWinner);

        var tileMeshes = boardMeshes[agent.boardSide];
        fadeQueue.push({
            meshes:   tileMeshes.concat([ agent.mesh ]),
            elapsed:  0,
            duration: FADE_DURATION,
            done:     false
        });

        showBanner(agent.name + ' reached the battle arena');
    }
}

// ================================================================
// === TRANSITION PHASE ===
// ================================================================
function updateTransition(delta) {
    transitionTimer += delta;

    // Step 1 (0-500ms): Fade remaining maze meshes
    if (transitionTimer <= 500) {
        if (!step1Logged) {
            console.log('[TRANSITION] Step 1: fading maze meshes');
            step1Logged = true;
        }
        var progress1 = Math.min(transitionTimer / 500, 1.0);
        var allMeshes = boardMeshes.left.concat(boardMeshes.right);
        for (var i = 0; i < allMeshes.length; i++) {
            if (allMeshes[i].parent) {
                if (allMeshes[i].material) {
                    allMeshes[i].material.opacity = 1.0 - progress1;
                }
                if (progress1 >= 1.0) {
                    coreScene.remove(allMeshes[i]);
                }
            }
        }
    }

    // Step 2 (500-1000ms): Build arena + fade in
    if (transitionTimer > 500 && transitionTimer <= 1000) {
        if (!arenaMeshesBuilt) {
            console.log('[TRANSITION] Step 2: building arena');
            for (var col = ARENA_MIN; col <= ARENA_MAX; col++) {
                for (var row = ARENA_MIN; row <= ARENA_MAX; row++) {
                    var pos = gridToWorld(col, row, 0);

                    var tileMat = new THREE.MeshStandardMaterial({
                        color: 0xCCDD88,
                        emissive: 0x445500,
                        emissiveIntensity: 0.4,
                        transparent: true,
                        opacity: 0
                    });
                    var tile = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.1, 0.95), tileMat);
                    tile.position.set(pos.x, 0.05, pos.z);
                    coreScene.add(tile);
                    arenaMeshes.push(tile);

                    var edgeGeo = new THREE.EdgesGeometry(new THREE.BoxGeometry(0.95, 0.1, 0.95));
                    var lineMat = new THREE.LineBasicMaterial({
                        color: 0x88AA44,
                        transparent: true,
                        opacity: 0
                    });
                    var lines = new THREE.LineSegments(edgeGeo, lineMat);
                    lines.position.set(pos.x, 0.05, pos.z);
                    coreScene.add(lines);
                    arenaMeshes.push(lines);
                }
            }

            arenaLight = new THREE.PointLight(0xffffff, 1.2, 8);
            arenaLight.position.set(0, 3, 0);
            coreScene.add(arenaLight);

            arenaMeshesBuilt = true;
        }

        var progress2 = Math.min((transitionTimer - 500) / 500, 1.0);
        for (var i = 0; i < arenaMeshes.length; i++) {
            if (arenaMeshes[i].material) {
                arenaMeshes[i].material.opacity = progress2;
            }
        }
    }

    // Step 3 (1000-1500ms): Move camera
    if (transitionTimer > 1000 && transitionTimer <= 1500) {
        if (!cameraSwapped) {
            console.log('[TRANSITION] Step 3: moving camera');
            var a = window.innerWidth / window.innerHeight;
            camera = new THREE.PerspectiveCamera(60, a, 0.1, 100);
            camera.position.set(0, 12, 6);
            camera.lookAt(0, 0, 0);
            battleCamTarget = new THREE.Vector3(0, 8, 4);
            battleCamLookAt = new THREE.Vector3(0, 0, 0);
            cameraSwapped = true;
        }

        var progress3 = Math.min((transitionTimer - 1000) / 500, 1.0);
        camera.position.lerp(battleCamTarget, progress3 * 0.08);
        camera.lookAt(battleCamLookAt);
    }

    // Step 4 (>= 1500ms): Finalize — runs once
    if (transitionTimer >= 1500 && !transitionFinalized) {
        console.log('[TRANSITION] Step 4: placing battle agents');

        for (var i = 0; i < agents.length; i++) {
            var ag = agents[i];
            coreScene.remove(ag.mesh);
            ag.material = new THREE.MeshStandardMaterial({
                color: ag.originalColor,
                transparent: true,
                opacity: 1.0
            });
            ag.mesh = new THREE.Mesh(new THREE.SphereGeometry(0.4, 16, 16), ag.material);
        }

        var aegisSpawn = gridToWorld(4, 3, 0);
        aegis.logicalPos = { col: 4, row: 3 };
        aegis.mesh.position.set(aegisSpawn.x, 0.5, aegisSpawn.z);
        aegis.targetWorldPos = new THREE.Vector3(aegisSpawn.x, 0.5, aegisSpawn.z);
        coreScene.add(aegis.mesh);

        var veloSpawn = gridToWorld(4, 5, 0);
        velo.logicalPos = { col: 4, row: 5 };
        velo.mesh.position.set(veloSpawn.x, 0.5, veloSpawn.z);
        velo.targetWorldPos = new THREE.Vector3(veloSpawn.x, 0.5, veloSpawn.z);
        coreScene.add(velo.mesh);

        gameStatePhase = 'battle';
        transitionFinalized = true;
        console.log('BATTLE PHASE READY');
        showBanner('Battle Phase \u2014 Combat Begin!');
    }
}

// ================================================================
// === BATTLE HELPERS ===
// ================================================================
function chebyshev(c1, r1, c2, r2) {
    return Math.max(Math.abs(c1 - c2), Math.abs(r1 - r2));
}

function isArenaCell(col, row) {
    return col >= ARENA_MIN && col <= ARENA_MAX &&
           row >= ARENA_MIN && row <= ARENA_MAX;
}

var DIRS8 = [
    {dc:-1,dr:-1},{dc:0,dr:-1},{dc:1,dr:-1},
    {dc:-1,dr:0},              {dc:1,dr:0},
    {dc:-1,dr:1}, {dc:0,dr:1}, {dc:1,dr:1}
];

function getArenaMoves(agent, allAgents) {
    var moves = [];
    for (var i = 0; i < DIRS8.length; i++) {
        var nc = agent.logicalPos.col + DIRS8[i].dc;
        var nr = agent.logicalPos.row + DIRS8[i].dr;
        if (!isArenaCell(nc, nr)) continue;
        var blocked = false;
        for (var a = 0; a < allAgents.length; a++) {
            if (allAgents[a] !== agent &&
                allAgents[a].logicalPos.col === nc &&
                allAgents[a].logicalPos.row === nr) {
                blocked = true; break;
            }
        }
        if (!blocked) moves.push({ col: nc, row: nr });
    }
    return moves;
}

function getLegalActions(agent, enemy) {
    var actions = [];
    var dist = chebyshev(agent.logicalPos.col, agent.logicalPos.row,
                         enemy.logicalPos.col, enemy.logicalPos.row);

    if (agent.moveCooldown <= 0) {
        var moves = getArenaMoves(agent, [agent, enemy]);
        for (var i = 0; i < moves.length; i++) {
            actions.push({ type: 'move', target: moves[i] });
        }
    }
    if (dist <= 1) actions.push({ type: 'standard_attack' });
    if (agent.logicBurstCharge >= LOGIC_BURST_CHARGE_REQ && dist <= 1)
        actions.push({ type: 'logic_burst' });
    if (!agent.elementalBeamUsed && dist <= 1)
        actions.push({ type: 'elemental_beam' });
    if (agent.defendCooldown <= 0) actions.push({ type: 'defend' });
    // Always allow passing / waiting as fallback
    actions.push({ type: 'pass' });
    return actions;
}

// ================================================================
// === BATTLE PHASE LOGIC ===
// ================================================================
function updateBattle(delta) {
    if (gameStatePhase !== 'battle') return;
    if (battleTurnInProgress) return;

    battleActionTimer += delta;
    if (battleActionTimer < BATTLE_TURN_DELAY) return;
    battleActionTimer -= BATTLE_TURN_DELAY;

    battleTurnInProgress = true;
    executeBattleTurn();
    battleTurnInProgress = false;
}

function executeBattleTurn() {
    battleTurnNumber++;

    if (battleTurnNumber % 2 === 1) {
        currentTurnAgent = (mazeWinner === 'AEGIS') ? aegis : velo;
    } else {
        currentTurnAgent = (mazeWinner === 'AEGIS') ? velo : aegis;
    }
    otherAgent = (currentTurnAgent === aegis) ? velo : aegis;

    currentTurnAgent.isDefending = false;

    if (currentTurnAgent.moveCooldown > 0) currentTurnAgent.moveCooldown--;
    if (currentTurnAgent.defendCooldown > 0) currentTurnAgent.defendCooldown--;

    console.log('[Turn ' + battleTurnNumber + '] Active: ' + currentTurnAgent.name + ' | Phase: battle');
    console.log('[AEGIS] pos:(' + aegis.logicalPos.col + ',' + aegis.logicalPos.row +
        ') HP:' + aegis.hp + ' moveCooldown:' + aegis.moveCooldown +
        ' defendCooldown:' + aegis.defendCooldown + ' isDefending:' + aegis.isDefending +
        ' burstCharge:' + aegis.logicBurstCharge + ' beamUsed:' + aegis.elementalBeamUsed);
    console.log('[VELO]  pos:(' + velo.logicalPos.col + ',' + velo.logicalPos.row +
        ') HP:' + velo.hp + ' moveCooldown:' + velo.moveCooldown +
        ' defendCooldown:' + velo.defendCooldown + ' isDefending:' + velo.isDefending +
        ' burstCharge:' + velo.logicBurstCharge + ' beamUsed:' + velo.elementalBeamUsed);

    if (healthPickupActive && healthPickupPos &&
        currentTurnAgent.logicalPos.col === healthPickupPos.col &&
        currentTurnAgent.logicalPos.row === healthPickupPos.row) {
        collectHealthPickup(currentTurnAgent);
    }

    if (!healthPickupSpawned && (aegis.hp <= 20 || velo.hp <= 20)) {
        spawnHealthPickup();
    }

    var action;
    var currentAgentName = (currentTurnAgent === aegis) ? 'aegis' : 'velo';

    if (humanModeEnabled && currentAgentName === humanAgentName) {
        // Human's turn — wait for input
        if (pendingHumanAction === null) {
            // Signal UI that human must act
            waitingForHuman = true;
            battleTurnInProgress = false;
            if (typeof CoreEngine._instance !== 'undefined' && CoreEngine._instance && CoreEngine._instance.onHumanTurn) {
                CoreEngine._instance.onHumanTurn();
            }
            return; // Don't advance turn yet
        }
        // Human has submitted an action
        action = pendingHumanAction;
        pendingHumanAction = null;
        waitingForHuman = false;
    } else if (currentTurnAgent === aegis) {
        action = aegisAI(currentTurnAgent, otherAgent);
    } else {
        action = veloAI(currentTurnAgent, otherAgent);
    }

    if (!action) action = { type: 'pass' };

    console.log('[ACTION] ' + currentTurnAgent.name + ': ' +
        action.type + (action.target ? ' (' + action.target.col + ',' + action.target.row + ')' : ''));

    executeAction(action, currentTurnAgent, otherAgent);

    if (otherAgent.hp <= 0) {
        otherAgent.hp = 0;
        endGame(currentTurnAgent);
    }
}

// ================================================================
// === ACTION EXECUTION ===
// ================================================================
function executeAction(action, agent, enemy) {
    switch (action.type) {
        case 'move':
            agent.logicalPos = { col: action.target.col, row: action.target.row };
            var wp = gridToWorld(action.target.col, action.target.row, 0);
            agent.targetWorldPos.set(wp.x, 0.5, wp.z);
            agent.moveCooldown = MOVE_COOLDOWN_TURNS;
            break;

        case 'standard_attack': {
            var dmg = enemy.isDefending ? PULSE_STRIKE_DEF_DMG : PULSE_STRIKE_DMG;
            enemy.hp = Math.max(0, enemy.hp - dmg);
            agent.logicBurstCharge++;
            flashRed(enemy);
            animateBeam(agent, enemy, agent.originalColor, 200);
            var psMsg = agent.name + ': Pulse Strike → ' + enemy.name + ' [' + dmg + ' dmg] | HP: ' + enemy.hp;
            console.log('[ATTACK] ' + psMsg);
            showBanner(psMsg);
            break;
        }
        case 'logic_burst': {
            var dmg = enemy.isDefending ? LOGIC_BURST_DEF_DMG : LOGIC_BURST_DMG;
            enemy.hp = Math.max(0, enemy.hp - dmg);
            agent.logicBurstCharge = 0;
            flashRed(enemy);
            animateBeam(agent, enemy, 0xFFFF00, 400);
            console.log('[BURST] ' + agent.name + ' Logic Burst -> ' + enemy.name +
                ' for ' + dmg + ' dmg. ' + enemy.name + ' HP: ' + enemy.hp);
            showBanner(agent.name + ' Logic Burst! ' + dmg + ' damage');
            break;
        }
        case 'elemental_beam': {
            var dmg = enemy.isDefending ? ELEMENTAL_BEAM_DEF_DMG : ELEMENTAL_BEAM_DMG;
            enemy.hp = Math.max(0, enemy.hp - dmg);
            agent.elementalBeamUsed = true;
            agent.logicBurstCharge = 0;
            flashRed(enemy);
            animateBeam(agent, enemy, 0xFF00FF, 600);
            console.log('[BEAM] ' + agent.name + ' Elemental Beam -> ' + enemy.name +
                ' for ' + dmg + ' dmg. ' + enemy.name + ' HP: ' + enemy.hp);
            showBanner(agent.name + ' Elemental Beam! ' + dmg + ' damage');
            break;
        }
        case 'defend':
            agent.isDefending = true;
            agent.defendCooldown = DEFEND_COOLDOWN_TURNS;
            console.log('[DEFEND] ' + agent.name + ' is defending');
            break;

        case 'pass':
            console.log('[PASS] ' + agent.name + ' passes');
            break;
    }
}

// ================================================================
// === BEAM ANIMATION ===
// ================================================================
function animateBeam(attacker, target, color, duration) {
    var start = attacker.mesh.position.clone();
    var end   = target.mesh.position.clone();

    var mid = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);

    var curve   = new THREE.LineCurve3(start, end);
    var beamGeo = new THREE.TubeGeometry(curve, 8, 0.04, 6, false);
    var beamMat = new THREE.MeshBasicMaterial({
        color: color, transparent: true, opacity: 0.9
    });
    var beamMesh = new THREE.Mesh(beamGeo, beamMat);
    coreScene.add(beamMesh);

    var beamLight = new THREE.PointLight(color, 1.5, 3);
    beamLight.position.copy(mid);
    coreScene.add(beamLight);

    beamAnimations.push({
        mesh: beamMesh, light: beamLight,
        elapsed: 0, duration: duration, done: false
    });
}

// ================================================================
// === HEALTH PICKUP SYSTEM ===
// ================================================================
function spawnHealthPickup() {
    var emptyCells = [];
    for (var c = ARENA_MIN; c <= ARENA_MAX; c++) {
        for (var r = ARENA_MIN; r <= ARENA_MAX; r++) {
            var occupied = false;
            if (aegis.logicalPos.col === c && aegis.logicalPos.row === r) occupied = true;
            if (velo.logicalPos.col === c && velo.logicalPos.row === r) occupied = true;
            if (!occupied) emptyCells.push({ col: c, row: r });
        }
    }
    if (emptyCells.length === 0) return;

    var bestCell = null;
    var bestDiff = Infinity;
    var bestCenterDist = Infinity;
    for (var i = 0; i < emptyCells.length; i++) {
        var cell = emptyCells[i];
        var da = chebyshev(cell.col, cell.row, aegis.logicalPos.col, aegis.logicalPos.row);
        var dv = chebyshev(cell.col, cell.row, velo.logicalPos.col, velo.logicalPos.row);
        var diff = Math.abs(da - dv);
        var centerDist = chebyshev(cell.col, cell.row, 4, 4);
        if (diff < bestDiff || (diff === bestDiff && centerDist < bestCenterDist)) {
            bestDiff = diff;
            bestCenterDist = centerDist;
            bestCell = cell;
        }
    }

    if (!bestCell) return;

    healthPickupPos     = bestCell;
    healthPickupActive  = true;
    healthPickupSpawned = true;

    var pickupGeo = new THREE.SphereGeometry(0.2, 12, 12);
    var pickupMat = new THREE.MeshStandardMaterial({
        color: 0x00FF88, emissive: 0x00AA44, transparent: true, opacity: 0.8
    });
    healthPickupMesh = new THREE.Mesh(pickupGeo, pickupMat);
    var wp = gridToWorld(bestCell.col, bestCell.row, 0);
    healthPickupMesh.position.set(wp.x, 0.4, wp.z);
    coreScene.add(healthPickupMesh);

    healthPickupLight = new THREE.PointLight(0x00FF88, 0.5, 3);
    healthPickupLight.position.set(wp.x, 0.8, wp.z);
    coreScene.add(healthPickupLight);

    var daLog = chebyshev(bestCell.col, bestCell.row, aegis.logicalPos.col, aegis.logicalPos.row);
    var dvLog = chebyshev(bestCell.col, bestCell.row, velo.logicalPos.col, velo.logicalPos.row);
    console.log('[PICKUP] Spawned at (' + bestCell.col + ',' + bestCell.row +
        ') \u2014 AEGIS dist:' + daLog + ' VELO dist:' + dvLog);
    showBanner('Health pickup appeared!');
}

function collectHealthPickup(agent) {
    var heal = Math.min(HEALTH_PICKUP_HEAL, agent.maxHP - agent.hp);
    agent.hp += heal;
    healthPickupActive = false;
    healthPickupPos    = null;

    if (healthPickupMesh) {
        coreScene.remove(healthPickupMesh);
        healthPickupMesh.geometry.dispose();
        healthPickupMesh.material.dispose();
        healthPickupMesh = null;
    }
    if (healthPickupLight) {
        coreScene.remove(healthPickupLight);
        healthPickupLight.dispose();
        healthPickupLight = null;
    }

    console.log('[PICKUP] ' + agent.name + ' collected health pickup. Healed ' + heal + '. HP: ' + agent.hp);
    showBanner(agent.name + ' healed +' + heal + ' HP');
}

// ================================================================
// === AI: AEGIS — MINIMAX WITH ALPHA-BETA PRUNING ===
// ================================================================
function aegisAI(agent, enemy) {
    var actions   = getLegalActions(agent, enemy);
    var bestScore = -Infinity;
    var bestAction = actions[0];

    for (var i = 0; i < actions.length; i++) {
        var sim   = simulateAction(actions[i], agent, enemy);
        var score = minimax(sim, agent, enemy, MINIMAX_DEPTH - 1, -Infinity, Infinity, false);
        if (score > bestScore) {
            bestScore  = score;
            bestAction = actions[i];
        }
    }
    return bestAction;
}

function minimax(sim, origAgent, origEnemy, depth, alpha, beta, isMaximizing) {
    if (sim.enemyHP <= 0) return  1000 + depth;
    if (sim.agentHP <= 0) return -1000 - depth;
    if (depth <= 0)       return evaluateState(sim);

    if (isMaximizing) {
        var simAgent = makeSimAgent(origAgent, sim.agentPos, sim.agentHP,
            sim.moveCooldown, sim.defendCooldown, false, sim.burstCharge, sim.beamUsed);
        var simEnemy = makeSimAgent(origEnemy, sim.enemyPos, sim.enemyHP,
            origEnemy.moveCooldown, origEnemy.defendCooldown, origEnemy.isDefending,
            origEnemy.logicBurstCharge, origEnemy.elementalBeamUsed);
        var acts = getLegalActionsForSim(simAgent, simEnemy);
        var maxEval = -Infinity;
        for (var i = 0; i < acts.length; i++) {
            var childSim = simulateActionSim(acts[i], simAgent, simEnemy);
            var ev = minimax(childSim, origAgent, origEnemy, depth - 1, alpha, beta, false);
            maxEval = Math.max(maxEval, ev);
            alpha   = Math.max(alpha, ev);
            if (beta <= alpha) break;
        }
        return maxEval;
    } else {
        var simEnemy2 = makeSimAgent(origEnemy, sim.enemyPos, sim.enemyHP,
            origEnemy.moveCooldown, origEnemy.defendCooldown, false,
            origEnemy.logicBurstCharge, origEnemy.elementalBeamUsed);
        var simAgent2 = makeSimAgent(origAgent, sim.agentPos, sim.agentHP,
            sim.moveCooldown, sim.defendCooldown, sim.isDefending,
            sim.burstCharge, sim.beamUsed);
        var acts2 = getLegalActionsForSim(simEnemy2, simAgent2);
        var minEval = Infinity;
        for (var j = 0; j < acts2.length; j++) {
            var childSim2 = simulateActionSim(acts2[j], simEnemy2, simAgent2);
            // Flip perspective: what was enemy's state becomes "agent" for next maximizing call
            var flipped = {
                agentPos:      childSim2.enemyPos,    agentHP:       childSim2.enemyHP,
                enemyPos:      childSim2.agentPos,    enemyHP:       childSim2.agentHP,
                moveCooldown:  simAgent2.moveCooldown, defendCooldown: simAgent2.defendCooldown,
                isDefending:   simAgent2.isDefending,  burstCharge:   simAgent2.logicBurstCharge,
                beamUsed:      simAgent2.elementalBeamUsed
            };
            var ev2 = minimax(flipped, origAgent, origEnemy, depth - 1, alpha, beta, true);
            minEval = Math.min(minEval, ev2);
            beta    = Math.min(beta, ev2);
            if (beta <= alpha) break;
        }
        return minEval;
    }
}

function makeSimAgent(agent, pos, hp, moveCd, defCd, isDef, burst, beamUsed) {
    return {
        name: agent.name,
        logicalPos: { col: pos.col, row: pos.row },
        hp: hp, maxHP: agent.maxHP,
        moveCooldown: moveCd, defendCooldown: defCd,
        isDefending: isDef, logicBurstCharge: burst,
        elementalBeamUsed: beamUsed
    };
}

function simulateAction(action, agent, enemy) {
    var result = {
        agentPos:      { col: agent.logicalPos.col, row: agent.logicalPos.row },
        agentHP:       agent.hp,
        enemyPos:      { col: enemy.logicalPos.col, row: enemy.logicalPos.row },
        enemyHP:       enemy.hp,
        moveCooldown:  Math.max(0, agent.moveCooldown - 1),
        defendCooldown:Math.max(0, agent.defendCooldown - 1),
        isDefending:   false,
        burstCharge:   agent.logicBurstCharge,
        beamUsed:      agent.elementalBeamUsed
    };
    applyActionToSim(action, result, enemy.isDefending);
    return result;
}

function simulateActionSim(action, simAgent, simEnemy) {
    var result = {
        agentPos:      { col: simAgent.logicalPos.col, row: simAgent.logicalPos.row },
        agentHP:       simAgent.hp,
        enemyPos:      { col: simEnemy.logicalPos.col, row: simEnemy.logicalPos.row },
        enemyHP:       simEnemy.hp,
        moveCooldown:  Math.max(0, simAgent.moveCooldown - 1),
        defendCooldown:Math.max(0, simAgent.defendCooldown - 1),
        isDefending:   false,
        burstCharge:   simAgent.logicBurstCharge,
        beamUsed:      simAgent.elementalBeamUsed
    };
    applyActionToSim(action, result, simEnemy.isDefending);
    return result;
}

function applyActionToSim(action, r, enemyDefending) {
    switch (action.type) {
        case 'move':
            r.agentPos = { col: action.target.col, row: action.target.row };
            r.moveCooldown = MOVE_COOLDOWN_TURNS;
            break;
        case 'standard_attack': {
            var dmg = enemyDefending ? PULSE_STRIKE_DEF_DMG : PULSE_STRIKE_DMG;
            r.enemyHP = Math.max(0, r.enemyHP - dmg);
            r.burstCharge++;
            break;
        }
        case 'logic_burst': {
            var dmg2 = enemyDefending ? LOGIC_BURST_DEF_DMG : LOGIC_BURST_DMG;
            r.enemyHP = Math.max(0, r.enemyHP - dmg2);
            r.burstCharge = 0;
            break;
        }
        case 'elemental_beam': {
            var dmg3 = enemyDefending ? ELEMENTAL_BEAM_DEF_DMG : ELEMENTAL_BEAM_DMG;
            r.enemyHP = Math.max(0, r.enemyHP - dmg3);
            r.beamUsed = true;
            r.burstCharge = 0;
            break;
        }
        case 'defend':
            r.isDefending = true;
            r.defendCooldown = DEFEND_COOLDOWN_TURNS;
            break;
    }
}

function evaluateState(sim) {
    var score = 0;

    // HP difference is the primary driver — heavily weighted
    score += (sim.agentHP - sim.enemyHP) * 10;

    // Prefer being close to the enemy for attack opportunity
    var dist = chebyshev(sim.agentPos.col, sim.agentPos.row,
                         sim.enemyPos.col, sim.enemyPos.row);
    if (dist === 0) {
        score += 20;  // same cell (shouldn't happen but big bonus)
    } else if (dist === 1) {
        score += 15;  // adjacent — can attack
    } else {
        score -= dist * 5;  // penalise distance
    }

    // Logic burst charge is valuable — worth roughly half a pulse strike per charge
    score += sim.burstCharge * 3;

    // Being low HP is bad (extra urgency)
    if (sim.agentHP < 30) score -= 20;
    if (sim.enemyHP < 30) score += 20;  // enemy near death is good

    // Elemental beam: only bonus if we can actually use it this turn (adjacent or close)
    if (!sim.beamUsed && dist <= 2) score += 8;

    // Health pickup: seek it if hurt
    if (healthPickupActive && healthPickupPos) {
        var pickupDist = chebyshev(sim.agentPos.col, sim.agentPos.row,
                                   healthPickupPos.col, healthPickupPos.row);
        if (sim.agentHP < 40) score -= pickupDist * 6;
        else if (sim.agentHP < 60) score -= pickupDist * 2;
    }
    return score;
}

function getLegalActionsForSim(simAgent, simEnemy) {
    var actions = [];
    var dist = chebyshev(simAgent.logicalPos.col, simAgent.logicalPos.row,
                         simEnemy.logicalPos.col, simEnemy.logicalPos.row);

    if (simAgent.moveCooldown <= 0) {
        for (var i = 0; i < DIRS8.length; i++) {
            var nc = simAgent.logicalPos.col + DIRS8[i].dc;
            var nr = simAgent.logicalPos.row + DIRS8[i].dr;
            if (!isArenaCell(nc, nr)) continue;
            if (simEnemy.logicalPos.col === nc && simEnemy.logicalPos.row === nr) continue;
            actions.push({ type: 'move', target: { col: nc, row: nr } });
        }
    }
    if (dist <= 1) actions.push({ type: 'standard_attack' });
    if (simAgent.logicBurstCharge >= LOGIC_BURST_CHARGE_REQ && dist <= 1)
        actions.push({ type: 'logic_burst' });
    if (!simAgent.elementalBeamUsed && dist <= 1)
        actions.push({ type: 'elemental_beam' });
    if (simAgent.defendCooldown <= 0) actions.push({ type: 'defend' });
    // Pass always available so tree never has empty action list
    actions.push({ type: 'pass' });
    return actions;
}

// ================================================================
// === AI: VELO — GREEDY 10-PRIORITY HEURISTIC ===
// ================================================================
function veloAI(agent, enemy) {
    var actions = getLegalActions(agent, enemy);
    var dist = chebyshev(agent.logicalPos.col, agent.logicalPos.row,
                         enemy.logicalPos.col, enemy.logicalPos.row);

    // P1: Elemental beam — only when adjacent (dist<=1) to make fight fair
    if (!agent.elementalBeamUsed && dist <= 1) {
        var a = findAction(actions, 'elemental_beam');
        if (a) return a;
    }
    // P2: Logic burst if charged and adjacent
    if (agent.logicBurstCharge >= LOGIC_BURST_CHARGE_REQ && dist <= 1) {
        var a2 = findAction(actions, 'logic_burst');
        if (a2) return a2;
    }
    // P3: Collect health pickup if adjacent and HP < 60%
    if (healthPickupActive && healthPickupPos &&
        agent.hp < agent.maxHP * 0.6 && agent.moveCooldown <= 0) {
        var pd = chebyshev(agent.logicalPos.col, agent.logicalPos.row,
                           healthPickupPos.col, healthPickupPos.row);
        if (pd <= 1) {
            var m = findMoveAction(actions,
                healthPickupPos.col, healthPickupPos.row);
            if (m) return m;
        }
    }
    // P4: Pulse Strike if adjacent
    if (dist <= 1) {
        var a3 = findAction(actions, 'standard_attack');
        if (a3) return a3;
    }
    // P5: Move toward enemy
    if (dist > 1 && agent.moveCooldown <= 0) {
        var best = closestMoveToward(actions, enemy.logicalPos);
        if (best) return best;
    }
    // P6: Move toward health pickup
    if (healthPickupActive && healthPickupPos && agent.moveCooldown <= 0) {
        var best2 = closestMoveToward(actions, healthPickupPos);
        if (best2) return best2;
    }
    // P7: Defend
    var d = findAction(actions, 'defend');
    if (d) return d;
    // P8: Random move
    var moveActs = [];
    for (var i = 0; i < actions.length; i++)
        if (actions[i].type === 'move') moveActs.push(actions[i]);
    if (moveActs.length > 0)
        return moveActs[Math.floor(Math.random() * moveActs.length)];
    // P9: Pulse Strike (fallback)
    var s = findAction(actions, 'standard_attack');
    if (s) return s;
    // P10: Pass
    return { type: 'pass' };
}

function findAction(acts, type) {
    for (var i = 0; i < acts.length; i++)
        if (acts[i].type === type) return acts[i];
    return null;
}

function findMoveAction(acts, col, row) {
    for (var i = 0; i < acts.length; i++)
        if (acts[i].type === 'move' &&
            acts[i].target.col === col && acts[i].target.row === row)
            return acts[i];
    return null;
}

function closestMoveToward(acts, goal) {
    var best = null, bestDist = Infinity;
    for (var i = 0; i < acts.length; i++) {
        if (acts[i].type !== 'move') continue;
        var d = chebyshev(acts[i].target.col, acts[i].target.row, goal.col, goal.row);
        if (d < bestDist) { bestDist = d; best = acts[i]; }
    }
    return best;
}

// ================================================================
// === END GAME ===
// ================================================================
function endGame(winner) {
    gameStatePhase = 'finished';
    battleWinnerName = winner.name;

    console.log('[GAME OVER] Battle winner: ' + winner.name);
    console.log('[GAME OVER] Maze winner: ' + mazeWinner);
    console.log('[GAME OVER] Final HP \u2014 AEGIS: ' + Math.max(0, aegis.hp) + ' | VELO: ' + Math.max(0, velo.hp));
    showBanner(winner.name + ' WINS THE BATTLE!');
}

// ================================================================
// === END SCREEN ===
// ================================================================
function showEndScreen() {
    var winner = battleWinnerName === 'AEGIS' ? aegis : velo;
    victoryWinnerMesh = winner.mesh;

    victoryLight = new THREE.PointLight(0xFFDD00, 0, 4);
    coreScene.add(victoryLight);
    victoryLightStartTime = Date.now();

    function nameColor(name) {
        if (name === 'AEGIS') return '#4488ff';
        if (name === 'VELO')  return '#ff4444';
        return '#ffffff';
    }

    var endScreenEl = document.createElement('div');
    endScreenEl.id = 'end-screen';
    endScreenEl.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;' +
        'background:rgba(0,0,0,0.82);display:flex;align-items:center;justify-content:center;' +
        'z-index:1000;opacity:0;transition:opacity 0.5s ease-in;';

    var card = document.createElement('div');
    card.style.cssText = 'background:rgba(10,10,30,0.95);border:1px solid rgba(255,255,255,0.2);' +
        'border-radius:8px;padding:32px 40px;font-family:\'Courier New\',monospace;color:#ffffff;' +
        'min-width:400px;text-align:center;';

    card.innerHTML =
        '<div style="font-size:18px;margin-bottom:16px;letter-spacing:2px;">SIMULATION COMPLETE</div>' +
        '<hr style="border-color:rgba(255,255,255,0.2);margin:12px 0">' +
        '<div style="margin:10px 0">MAZE WINNER: <span style="color:' +
            nameColor(mazeWinner) + '">' + (mazeWinner || 'N/A') + '</span>' +
            '<div style="font-size:11px;color:#aaa;margin-top:4px">First to reach the battle arena</div></div>' +
        '<hr style="border-color:rgba(255,255,255,0.2);margin:12px 0">' +
        '<div style="margin:10px 0">BATTLE WINNER: <span style="color:' +
            nameColor(battleWinnerName) + '">' + (battleWinnerName || 'N/A') + '</span>' +
            '<div style="font-size:11px;color:#aaa;margin-top:4px">Reduced opponent HP to zero</div></div>' +
        '<hr style="border-color:rgba(255,255,255,0.2);margin:12px 0">' +
        '<div style="margin:10px 0">Final HP \u2014 AEGIS: <span style="color:#4488ff">' +
            Math.max(0, aegis.hp) + '</span> &nbsp;|&nbsp; VELO: <span style="color:#ff4444">' +
            Math.max(0, velo.hp) + '</span></div>' +
        '<hr style="border-color:rgba(255,255,255,0.2);margin:12px 0">' +
        '<div id="es-countdown" style="color:#ffdd00;font-size:14px">Closing in: 30s</div>';

    endScreenEl.appendChild(card);
    document.body.appendChild(endScreenEl);

    void endScreenEl.offsetWidth;
    endScreenEl.style.opacity = '1';

    // Play Again button
    var playAgainBtn = document.createElement('button');
    playAgainBtn.textContent = '▶  PLAY AGAIN';
    playAgainBtn.style.cssText = 'margin-top:20px;padding:12px 32px;background:transparent;' +
        'border:2px solid #00ff88;border-radius:4px;color:#00ff88;font-family:\'Courier New\',monospace;' +
        'font-size:13px;font-weight:bold;letter-spacing:3px;cursor:pointer;width:100%;' +
        'transition:background 0.2s;';
    playAgainBtn.onmouseover = function() { this.style.background = 'rgba(0,255,136,0.12)'; };
    playAgainBtn.onmouseout  = function() { this.style.background = 'transparent'; };
    playAgainBtn.onclick = function() {
        clearInterval(endScreenInterval);
        endScreenInterval = null;
        gameLoopRunning = false;
        var es = document.getElementById('end-screen');
        if (es) es.remove();
        // Return to start screen via main.js
        if (window.resetToStartScreen) window.resetToStartScreen();
    };
    card.appendChild(playAgainBtn);

    var endCountdown = 30;
    endScreenInterval = setInterval(function() {
        endCountdown--;
        var el = document.getElementById('es-countdown');
        if (el) el.textContent = 'Auto-closing in: ' + endCountdown + 's';
        if (endCountdown <= 0) {
            clearInterval(endScreenInterval);
            endScreenInterval = null;
            gameLoopRunning = false;
            console.log('[END] Screen frozen after 30s');
            if (window.resetToStartScreen) window.resetToStartScreen();
        }
    }, 1000);

    console.log('[END] Display timer started \u2014 30 seconds');
}

// ================================================================
// === ANIMATION UPDATER ===
// ================================================================
function updateAnimations(delta) {
    var lerpFactor;

    for (var i = 0; i < agents.length; i++) {
        var a = agents[i];
        if (a.mesh.parent) {
            lerpFactor = 1 - Math.pow(1 - a.lerpSpeed, delta / 16.67);
            a.mesh.position.lerp(a.targetWorldPos, lerpFactor);
        }
    }

    for (var f = 0; f < fadeQueue.length; f++) {
        var fade = fadeQueue[f];
        if (fade.done) continue;

        fade.elapsed += delta;
        var t = Math.min(fade.elapsed / fade.duration, 1.0);

        for (var m = 0; m < fade.meshes.length; m++) {
            var mesh = fade.meshes[m];
            if (mesh.material) mesh.material.opacity = 1.0 - t;
        }

        if (t >= 1.0) {
            fade.done = true;
            for (var m2 = 0; m2 < fade.meshes.length; m2++) {
                coreScene.remove(fade.meshes[m2]);
                if (fade.meshes[m2].geometry) fade.meshes[m2].geometry.dispose();
                if (fade.meshes[m2].material) fade.meshes[m2].material.dispose();
            }
        }
    }

    updateHPBars();

    // Process beam animations (fade out + remove mesh and light)
    for (var b = beamAnimations.length - 1; b >= 0; b--) {
        var beam = beamAnimations[b];
        if (beam.done) continue;
        beam.elapsed += delta;
        var bt = Math.min(beam.elapsed / beam.duration, 1.0);
        beam.mesh.material.opacity = 0.9 * (1.0 - bt);
        if (beam.light) beam.light.intensity = 1.5 * (1.0 - bt);
        if (bt >= 1.0) {
            beam.done = true;
            coreScene.remove(beam.mesh);
            beam.mesh.geometry.dispose();
            beam.mesh.material.dispose();
            if (beam.light) {
                coreScene.remove(beam.light);
                beam.light.dispose();
            }
            beamAnimations.splice(b, 1);
        }
    }

    // Health pickup bob & spin
    if (healthPickupMesh) {
        healthPickupMesh.rotation.y += delta * 0.003;
        healthPickupMesh.position.y = 0.4 + Math.sin(Date.now() * 0.004) * 0.1;
    }

    // Victory light animation (orbits winner, ramps intensity)
    if (victoryLight && victoryWinnerMesh) {
        var elapsed = Date.now() * 0.002;
        victoryLight.position.x = victoryWinnerMesh.position.x + Math.cos(elapsed) * 1.2;
        victoryLight.position.z = victoryWinnerMesh.position.z + Math.sin(elapsed) * 1.2;
        victoryLight.position.y = victoryWinnerMesh.position.y + 1.0;
        var vt = Math.min((Date.now() - victoryLightStartTime) / 1500, 1.0);
        victoryLight.intensity = vt < 0.6 ? vt * (4 / 0.6) : 4 - (vt - 0.6) * (2.5 / 0.4);
    }
}

// ================================================================
// === HP BARS ===
// ================================================================
var hpFillAegis = null;
var hpFillVelo  = null;

function updateHPBars() {
    if (!hpFillAegis) hpFillAegis = document.getElementById('hp-fill-aegis');
    if (!hpFillVelo)  hpFillVelo  = document.getElementById('hp-fill-velo');

    if (aegis && hpFillAegis) {
        hpFillAegis.style.width = Math.max(0, (aegis.hp / aegis.maxHP) * 100) + '%';
    }
    if (velo && hpFillVelo) {
        hpFillVelo.style.width = Math.max(0, (velo.hp / velo.maxHP) * 100) + '%';
    }
}

// ================================================================
// === BANNER ===
// ================================================================
var bannerEl = null;

function showBanner(text) {
    if (!bannerEl) bannerEl = document.getElementById('banner');
    if (!bannerEl) return;
    // Clear all previous messages — show only current action
    bannerEl.innerHTML = '';
    var div = document.createElement('div');
    div.className = 'msg';
    div.textContent = text;
    bannerEl.appendChild(div);
    void div.offsetWidth;
    div.classList.add('visible');
    // Also update the action log panel
    if (window.updateActionLog) window.updateActionLog(text);
}

// ================================================================
// === GAME LOOP ===
// ================================================================
function gameLoop(timestamp) {
    if (gameLoopRunning) {
        requestAnimationFrame(gameLoop);
    }

    if (isPaused) {
        coreRenderer.render(coreScene, camera);
        return;
    }

    if (lastTimestamp < 0) {
        lastTimestamp = timestamp;
        coreRenderer.render(coreScene, camera);
        return;
    }

    var delta = timestamp - lastTimestamp;
    lastTimestamp = timestamp;

    if (delta > 200) {
        coreRenderer.render(coreScene, camera);
        return;
    }

    updateMazePhase(delta);

    if (gameStatePhase === 'maze_complete' && !transitionStarted) {
        transitionStarted = true;
        gameStatePhase = 'transition';
        transitionTimer = 0;
        console.log('[PHASE] maze_complete \u2192 transition');
    }

    if (gameStatePhase === 'transition') {
        updateTransition(delta);
    }

    if (gameStatePhase === 'battle') {
        updateBattle(delta);
    }

    if (gameStatePhase === 'finished' && !endScreenShown) {
        endScreenShown = true;
        showEndScreen();
    }

    updateAnimations(delta);
    coreRenderer.render(coreScene, camera);
}

// ================================================================
// === WINDOW RESIZE ===
// ================================================================
window.addEventListener('resize', function() {
    var w = window.innerWidth, h = window.innerHeight;
    if (camera && camera.isPerspectiveCamera) {
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
    } else if (camera) {
        var a = w / h;
        camera.left   = -FRUSTUM_HALF * a;
        camera.right  =  FRUSTUM_HALF * a;
        camera.updateProjectionMatrix();
    }
    if (coreRenderer) coreRenderer.setSize(w, h);
});

// ================================================================
// === CoreEngine CLASS ===
// ================================================================
class CoreEngine {
    constructor() {
        CoreEngine._instance = this;
        this.onHumanTurn = null; // callback set by main.js
    }

    setHumanMode(enabled, agentName) {
        humanModeEnabled = enabled;
        humanAgentName   = agentName || null;
    }

    submitHumanAction(action) {
        // Convert directional move to grid move
        if (action.type === 'move_dir' && humanModeEnabled) {
            var agent = (humanAgentName === 'aegis') ? aegis : velo;
            if (!agent) { pendingHumanAction = { type: 'pass' }; battleTurnInProgress = false; return; }
            var dirMap = { up:{dc:0,dr:-1}, down:{dc:0,dr:1}, left:{dc:-1,dr:0}, right:{dc:1,dr:0} };
            var d = dirMap[action.dir];
            if (d) {
                var nc = agent.logicalPos.col + d.dc;
                var nr = agent.logicalPos.row + d.dr;
                if (isArenaCell(nc, nr)) {
                    var enemy = (humanAgentName === 'aegis') ? velo : aegis;
                    if (!(enemy.logicalPos.col === nc && enemy.logicalPos.row === nr)) {
                        pendingHumanAction = { type: 'move', target: { col: nc, row: nr } };
                    } else {
                        pendingHumanAction = { type: 'pass' };
                    }
                } else {
                    pendingHumanAction = { type: 'pass' };
                }
            } else {
                pendingHumanAction = { type: 'pass' };
            }
        } else {
            pendingHumanAction = action;
        }
        // Resume turn execution
        setTimeout(function() {
            if (gameStatePhase === 'battle' && !battleTurnInProgress) {
                battleTurnInProgress = true;
                executeBattleTurn();
                battleTurnInProgress = false;
            }
        }, 50);
    }

    init(sceneSetupInstance) {
        coreScene    = sceneSetupInstance.getScene();
        coreRenderer = sceneSetupInstance.getRenderer();

        coreScene.background = new THREE.Color(0x111118);
        coreScene.fog = null;

        // Clean up scene from any previous game
        for (var ci = coreScene.children.length - 1; ci >= 0; ci--) {
            var child = coreScene.children[ci];
            coreScene.remove(child);
            if (child.geometry) child.geometry.dispose();
            if (child.material && child.material.dispose) child.material.dispose();
            if (child.dispose) child.dispose();
        }
        // Re-add lighting (sceneSetup originals were removed)
        coreScene.add(new THREE.AmbientLight(0xffffff, 0.6));
        var dl = new THREE.DirectionalLight(0xffffff, 0.8);
        dl.position.set(5, 15, 5);
        coreScene.add(dl);
        var fl = new THREE.DirectionalLight(0x6eb5ff, 0.3);
        fl.position.set(-8, 10, -8);
        coreScene.add(fl);

        var a = window.innerWidth / window.innerHeight;
        camera = new THREE.OrthographicCamera(
            -FRUSTUM_HALF * a, FRUSTUM_HALF * a,
             FRUSTUM_HALF,    -FRUSTUM_HALF,
            0.1, 100
        );
        camera.position.set(0, 20, 0);
        camera.lookAt(0, 0, 0);

        // Reset all module-level state
        gameStatePhase      = 'maze';
        mazeWinner          = null;
        agentsDone          = 0;
        transitionStarted   = false;
        arenaMeshesBuilt    = false;
        cameraSwapped       = false;
        transitionFinalized = false;
        step1Logged         = false;
        transitionTimer     = 0;
        fadeQueue           = [];
        arenaMeshes         = [];
        arenaLight          = null;
        lastTimestamp       = -1;
        gameLoopRunning     = true;
        isPaused            = false;
        battleTurnNumber    = 0;
        currentTurnAgent    = null;
        otherAgent          = null;
        battleActionTimer   = 0;
        battleTurnInProgress = false;
        beamAnimations      = [];
        healthPickupMesh    = null;
        healthPickupLight   = null;
        victoryLight        = null;
        victoryLightStartTime = 0;
        victoryWinnerMesh   = null;
        endScreenShown      = false;
        battleWinnerName    = null;
        healthPickupPos     = null;
        healthPickupActive  = false;
        healthPickupSpawned = false;
        if (endScreenInterval) { clearInterval(endScreenInterval); endScreenInterval = null; }
        pendingHumanAction = null;
        waitingForHuman    = false;
        boardMeshes         = { left: [], right: [] };
        hpFillAegis         = null;
        hpFillVelo          = null;
        bannerEl            = null;

        generateMaze();
        buildBoard(BOARD_LEFT_X, 'left');
        buildBoard(BOARD_RIGHT_X, 'right');

        aegis  = new Agent('AEGIS', 0x2255FF, 0.08, BOARD_LEFT_X, 'left');
        velo   = new Agent('VELO',  0xFF2222, 0.13, BOARD_RIGHT_X, 'right');
        agents = [aegis, velo];

        aegis.path      = findPathAStar(SPAWN.col, SPAWN.row, EXIT.col, EXIT.row);
        aegis.pathIndex = 0;
        velo.path       = findPathGreedy(SPAWN.col, SPAWN.row, EXIT.col, EXIT.row);
        velo.pathIndex  = 0;

        console.log('[INIT] AEGIS path: ' + aegis.path.length + ' steps');
        console.log('[INIT] VELO path:  ' + velo.path.length + ' steps');

        requestAnimationFrame(gameLoop);
    }

    pause()  { isPaused = true; }
    resume() { isPaused = false; }
    stop() {
        gameLoopRunning = false;
        if (endScreenInterval) { clearInterval(endScreenInterval); endScreenInterval = null; }
        pendingHumanAction = null;
        waitingForHuman    = false;
    }

    get isPaused_() { return isPaused; }

    getPhase()      { return gameStatePhase; }
    getAegisHP()    { return aegis ? aegis.hp : 100; }
    getVeloHP()     { return velo  ? velo.hp  : 100; }
    getTurnCount()  { return battleTurnNumber; }
    getWinner()     { return battleWinnerName; }
    getMazeWinner() { return mazeWinner; }
}