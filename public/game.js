// game.js
const myRole = new URLSearchParams(window.location.search).get('role');
const ws = new WebSocket(`ws://31.42.190.29:3001`);

// --- UI Elements ---
const pilotView = document.getElementById('pilot-view');
const engineerView = document.getElementById('engineer-view');
const notificationBanner = document.getElementById('event-notification');
const solarFlareEffect = document.getElementById('solar-flare-effect');
const gameContainer = document.getElementById('game-container');
const uiScreens = {
    pilotLobby: document.getElementById('pilot-lobby'),
    engineerLobby: document.getElementById('engineer-lobby'),
    waiting: document.getElementById('waiting-screen'),
    countdown: document.getElementById('countdown-screen'),
    levelComplete: document.getElementById('level-complete-screen'),
    gameOver: document.getElementById('game-over-screen'),
    pilotHud: document.getElementById('pilot-hud')
};

let localGameState = {};
let currentTheme = '';

// --- WebSocket Message Handling ---
ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    switch (data.type) {
        case 'roleAssign':
            initializeRole(data.role);
            break;
        case 'gameStateUpdate':
            localGameState = data.state;
            if (localGameState.theme && localGameState.theme !== currentTheme) {
                document.body.className = `theme-${localGameState.theme}`;
                currentTheme = localGameState.theme;
            }
            handleGameStateUpdate(data.state);
            break;
        case 'countdown':
            showScreen(uiScreens.countdown);
            uiScreens.countdown.textContent = data.count > 0 ? data.count : "GO!";
            break;
        case 'eventStart':
            showNotification(`УВАГА: ${getEventName(data.event.type)}!`);
            if (myRole === 'engineer' && data.event.type === 'solarFlare') {
                solarFlareEffect.style.display = 'block';
            }
            break;
        case 'eventEnd':
            showNotification("Нормальні умови відновлено.");
            if (myRole === 'engineer') {
                solarFlareEffect.style.display = 'none';
            }
            break;
        case 'playerDisconnect':
            showScreen(uiScreens.waiting);
            break;
        case 'shipHit':
            if (myRole === 'pilot') {
                gameContainer.classList.add('shake');
                setTimeout(() => gameContainer.classList.remove('shake'), 500);
            }
            break;
    }
};

function getEventName(type) {
    if (type === 'solarFlare') return 'СОНЯЧНИЙ СПАЛАХ';
    if (type === 'asteroidShower') return 'АСТЕРОЇДНИЙ ДОЩ';
    if (type === 'empField') return 'ЕМІ-ПОЛЕ АКТИВНЕ';
    return 'НЕВІДОМА АНОМАЛІЯ';
}

let notificationTimeout;
function showNotification(message) {
    notificationBanner.textContent = message;
    notificationBanner.classList.add('visible');
    clearTimeout(notificationTimeout);
    notificationTimeout = setTimeout(() => {
        notificationBanner.classList.remove('visible');
    }, 5000);
}

// --- UI State Management ---
function showScreen(screen) {
    Object.values(uiScreens).forEach(s => s.style.display = 'none');
    pilotView.style.display = 'none';
    engineerView.style.display = 'none';
    if (screen) screen.style.display = 'flex';
}

function handleGameStateUpdate(state) {
    switch (state.status) {
        case 'lobby':
            showScreen(myRole === 'pilot' ? uiScreens.pilotLobby : uiScreens.engineerLobby);
            document.querySelectorAll('.ready-btn').forEach(btn => {
                btn.disabled = false;
                btn.textContent = "ГОТОВИЙ";
            });
            if (state.score !== undefined) {
                const lobby = myRole === 'pilot' ? uiScreens.pilotLobby : uiScreens.engineerLobby;
                let scoreRecap = lobby.querySelector('.score-recap');
                if (!scoreRecap) {
                    scoreRecap = document.createElement('p');
                    scoreRecap.className = 'score-recap';
                    lobby.appendChild(scoreRecap);
                }
                scoreRecap.textContent = `Останній рахунок: ${state.score}`;
            }
            break;
        case 'playing':
            showScreen(null);
            if (myRole === 'pilot') {
                pilotView.style.display = 'block';
                uiScreens.pilotHud.style.display = 'block';
                updatePilotHud(state);
            } else {
                engineerView.style.display = 'flex';
                updateEngineerUI(state);
            }
            break;
        case 'levelComplete':
            showScreen(uiScreens.levelComplete);
            uiScreens.levelComplete.textContent = `РІВЕНЬ ${state.currentLevel - 1} ПРОЙДЕНО!`;
            break;
        case 'gameOver':
            showScreen(uiScreens.gameOver);
            break;
    }
}

function initializeRole(role) {
    if (role === 'pilot') setupPilotControls();
    if (role === 'engineer') setupEngineerControls();

    document.querySelectorAll('.ready-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            ws.send(JSON.stringify({ type: 'playerReady' }));
            e.target.disabled = true;
            e.target.textContent = "ОЧІКУВАННЯ...";
        });
    });
}

// --- ENGINEER LOGIC ---
function setupEngineerControls() {
    const sliders = {
        shields: document.getElementById('shields-slider'),
        engines: document.getElementById('engines-slider'),
        weapons: document.getElementById('weapons-slider'),
    };
    const values = {
        shields: document.getElementById('shields-value'),
        engines: document.getElementById('engines-value'),
        weapons: document.getElementById('weapons-value'),
    };
    let powerState = { shields: 34, engines: 33, weapons: 33 };

    function updateUIAndSend() {
        Object.keys(powerState).forEach(key => {
            sliders[key].value = powerState[key];
            values[key].textContent = `${powerState[key]}%`;
        });
        ws.send(JSON.stringify({ type: 'engineerUpdate', power: powerState }));
    }

    function balancePower(changedSliderId, newValue) {
        newValue = parseInt(newValue);
        let otherKeys = Object.keys(powerState).filter(k => k !== changedSliderId);
        let oldValue = powerState[changedSliderId];
        let delta = newValue - oldValue;

        powerState[changedSliderId] = newValue;

        let otherTotal = powerState[otherKeys[0]] + powerState[otherKeys[1]];
        if (otherTotal > 0) {
            let ratio0 = powerState[otherKeys[0]] / otherTotal;
            let ratio1 = powerState[otherKeys[1]] / otherTotal;
            powerState[otherKeys[0]] -= Math.round(delta * ratio0);
            powerState[otherKeys[1]] -= Math.round(delta * ratio1);
        } else {
            powerState[otherKeys[0]] -= Math.floor(delta / 2);
            powerState[otherKeys[1]] -= Math.ceil(delta / 2);
        }

        Object.keys(powerState).forEach(key => {
            if (powerState[key] < 0) {
                let overflow = -powerState[key];
                powerState[key] = 0;
                let otherKey = Object.keys(powerState).find(k => k !== key && k !== changedSliderId);
                if (otherKey && powerState[otherKey] >= overflow) {
                    powerState[otherKey] -= overflow;
                } else if(otherKey) {
                    let remainingOverflow = overflow - powerState[otherKey];
                    powerState[otherKey] = 0;
                    let lastKey = Object.keys(powerState).find(k => k !== key && k !== otherKey);
                    powerState[lastKey] -= remainingOverflow;
                }
            }
            if (powerState[key] > 100) powerState[key] = 100;
        });
        
        let finalTotal = Object.values(powerState).reduce((a, b) => a + b, 0);
        let correction = 100 - finalTotal;
        powerState[changedSliderId] += correction;
        
        Object.keys(powerState).forEach(key => {
            if (powerState[key] < 0) powerState[key] = 0;
            if (powerState[key] > 100) powerState[key] = 100;
        });

        updateUIAndSend();
    }

    Object.keys(sliders).forEach(key => {
        sliders[key].addEventListener('input', (e) => {
            balancePower(key, e.target.value);
        });
    });
}

function updateEngineerUI(state) {
    if (!state.ship) return;
    document.getElementById('health-value').textContent = `${Math.round(state.ship.health)}/100`;
    document.getElementById('shield-value').textContent = `${Math.round(state.ship.shields)}/100`;
    document.getElementById('health-bar').value = state.ship.health;
    document.getElementById('shield-bar').value = state.ship.shields;
    document.getElementById('engineer-score').textContent = state.score;
    document.getElementById('engineer-level').textContent = state.currentLevel;
    document.getElementById('engineer-level-name').textContent = state.levelName;
    document.getElementById('engineer-status').textContent = state.ship.hasPackage ? `Доставка (${state.deliveriesMade}/${state.levelGoal})` : `Пошук вантажу (${state.deliveriesMade}/${state.levelGoal})`;
    drawMiniMap(state);
}

function drawMiniMap(state) {
    const canvas = document.getElementById('mini-map');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const ship = state.ship;

    const mapWidth = 1200;
    const mapHeight = 900;
    const scale = canvas.width / mapWidth;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.scale(scale, scale);
    ctx.translate(-ship.x, -ship.y);

    const drawDot = (obj, color, size) => {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(obj.x, obj.y, size / scale, 0, Math.PI * 2);
        ctx.fill();
    };
    
    if (state.pickupZone.active) drawDot(state.pickupZone, getCssVariable('--pickup-color'), 40);
    if (state.deliveryZone.active) drawDot(state.deliveryZone, getCssVariable('--delivery-color'), 40);
    state.asteroids.forEach(a => drawDot(a, getCssVariable('--asteroid-color'), a.size));
    state.pirates.forEach(p => drawDot(p, p.type === 'dreadnought' ? getCssVariable('--dreadnought-color') : getCssVariable('--pirate-color'), 20));
    state.turrets.forEach(t => drawDot(t, getCssVariable('--danger-color'), 15));
    state.mines.forEach(m => drawDot(m, getCssVariable('--mine-color'), 10));
    
    ctx.fillStyle = '#fff';
    ctx.save();
    ctx.translate(ship.x, ship.y);
    ctx.rotate(ship.angle);
    ctx.beginPath();
    ctx.moveTo(15 / scale, 0);
    ctx.lineTo(-10 / scale, -10 / scale);
    ctx.lineTo(-10 / scale, 10 / scale);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    
    ctx.restore();
}

// --- PILOT LOGIC ---
function setupPilotControls() {
    const canvas = pilotView;
    const ctx = canvas.getContext('2d');
    canvas.width = 800; canvas.height = 600;

    const navArrow = document.getElementById('nav-arrow');
    let input = { keys: {}, mouse: { x: 400, y: 300, down: false } };
    document.addEventListener('keydown', e => input.keys[e.key.toLowerCase()] = true);
    document.addEventListener('keyup', e => input.keys[e.key.toLowerCase()] = false);
    canvas.addEventListener('mousedown', () => input.mouse.down = true);
    canvas.addEventListener('mouseup', () => input.mouse.down = false);
    canvas.addEventListener('mousemove', e => {
        const rect = canvas.getBoundingClientRect();
        input.mouse.x = e.clientX - rect.left;
        input.mouse.y = e.clientY - rect.top;
    });

    setInterval(() => {
        if (localGameState.status === 'playing') {
            ws.send(JSON.stringify({ type: 'pilotUpdate', input }));
        }
    }, 1000 / 30);

    let cameraY = 0;

    function draw() {
        if (!localGameState.ship) { requestAnimationFrame(draw); return; }
        
        const state = localGameState;
        
        const targetCameraY = state.ship.y - canvas.height * 0.8;
        cameraY += (targetCameraY - cameraY) * 0.1;

        ctx.save();
        ctx.translate(0, -cameraY);

        ctx.fillStyle = getCssVariable('--bg-color');
        ctx.fillRect(0, cameraY, canvas.width, canvas.height);

        if (state.theme === 'nebula') {
            ctx.fillStyle = 'rgba(150, 100, 200, 0.15)';
            ctx.fillRect(0, 0, canvas.width, 5000);
        }

        if (state.pickupZone.active) drawZone(state.pickupZone, getCssVariable('--pickup-color'));
        if (state.deliveryZone.active) drawZone(state.deliveryZone, getCssVariable('--delivery-color'));
        if (state.event && state.event.type === 'empField') drawZone(state.event, getCssVariable('--emp-field-color'), true);

        state.asteroids.forEach(a => drawAsteroid(a));
        state.turrets.forEach(t => drawTurret(t));
        state.mines.forEach(m => drawMine(m));
        state.pirates.forEach(p => drawPirate(p));
        
        drawShip(state.ship);

        ctx.fillStyle = '#fff';
        state.projectiles.forEach(p => ctx.fillRect(p.x - 2, p.y - 2, 4, 4));
        ctx.fillStyle = getCssVariable('--danger-color');
        state.turretProjectiles.forEach(p => ctx.fillRect(p.x - 2, p.y - 2, 4, 4));
        state.pirateProjectiles.forEach(p => ctx.fillRect(p.x - 2, p.y - 2, 4, 4));

        ctx.restore();

        // Pilot HUD Bars
        const hudY = canvas.height - 30;
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(10, hudY, 200, 20);
        ctx.fillStyle = getCssVariable('--danger-color');
        ctx.fillRect(10, hudY, (state.ship.health / 100) * 200, 20);
        
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(canvas.width - 210, hudY, 200, 20);
        ctx.fillStyle = getCssVariable('--glow-color');
        ctx.fillRect(canvas.width - 210, hudY, (state.ship.shields / 100) * 200, 20);

        const ship = state.ship;
        let target = null;
        if (ship.hasPackage && state.deliveryZone.active) {
            target = state.deliveryZone;
        } else if (!ship.hasPackage && state.pickupZone.active) {
            target = state.pickupZone;
        }

        if (target) {
            const angleToTarget = Math.atan2(target.y - ship.y, target.x - ship.x);
            const shipScreenX = ship.x;
            const shipScreenY = ship.y - cameraY;
            const arrowDist = 60;
            navArrow.style.left = `${shipScreenX + Math.cos(angleToTarget) * arrowDist}px`;
            navArrow.style.top = `${shipScreenY + Math.sin(angleToTarget) * arrowDist}px`;
            navArrow.style.transform = `translate(-50%, -50%) rotate(${angleToTarget + Math.PI / 2}rad)`;
            navArrow.style.display = 'block';
        } else {
            navArrow.style.display = 'none';
        }

        requestAnimationFrame(draw);
    }
    
    function drawZone(zone, color, isFilled = false) { ctx.strokeStyle=color; ctx.lineWidth=3; ctx.beginPath(); ctx.arc(zone.x, zone.y, 40, 0, Math.PI*2); ctx.stroke(); if(isFilled){ctx.fillStyle=color.replace(')',', 0.2)').replace('rgb','rgba'); ctx.fill();} }
    function drawAsteroid(a) { ctx.fillStyle=getCssVariable('--asteroid-color'); ctx.beginPath(); ctx.arc(a.x, a.y, a.size, 0, Math.PI*2); ctx.fill(); }
    function drawTurret(t) { ctx.fillStyle=getCssVariable('--danger-color'); ctx.beginPath(); ctx.arc(t.x, t.y, 15, 0, Math.PI*2); ctx.fill(); }
    function drawMine(m) { ctx.fillStyle=getCssVariable('--mine-color'); ctx.beginPath(); ctx.arc(m.x, m.y, 8, 0, Math.PI*2); ctx.fill(); }
    function drawPirate(p) { ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(Math.atan2(localGameState.ship.y-p.y, localGameState.ship.x-p.x)+Math.PI/2); if (p.type==='dreadnought') { ctx.fillStyle=getCssVariable('--dreadnought-color'); ctx.beginPath(); ctx.moveTo(0,-20); ctx.lineTo(15,15); ctx.lineTo(-15,15); ctx.closePath(); ctx.fill(); } else { ctx.fillStyle=getCssVariable('--pirate-color'); ctx.beginPath(); ctx.moveTo(0,-12); ctx.lineTo(8,10); ctx.lineTo(-8,10); ctx.closePath(); ctx.fill(); } ctx.restore(); }
    function drawShip(ship) { ctx.save(); ctx.translate(ship.x, ship.y); ctx.rotate(ship.angle); ctx.fillStyle=ship.hasPackage?'#ff0':getCssVariable('--glow-color'); ctx.beginPath(); ctx.moveTo(15,0); ctx.lineTo(-10,-10); ctx.lineTo(-10,10); ctx.closePath(); ctx.fill(); ctx.restore(); if (ship.shields>0) { ctx.strokeStyle=`rgba(0, 255, 255, ${ship.shields/100})`; ctx.lineWidth=3; ctx.beginPath(); ctx.arc(ship.x, ship.y, 25, 0, Math.PI*2); ctx.stroke(); } }
    draw();
}

function updatePilotHud(state) {
    document.getElementById('pilot-level').textContent = state.currentLevel;
    document.getElementById('pilot-level-name').textContent = state.levelName;
    document.getElementById('pilot-score').textContent = state.score;
    document.getElementById('pilot-objective').textContent = `ДОСТАВКИ: ${state.deliveriesMade} / ${state.levelGoal}`;
}

function getCssVariable(varName) {
    return getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
}