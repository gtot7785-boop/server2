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
            break;
        case 'playing':
            showScreen(null);
            if (myRole === 'pilot') {
                pilotView.style.display = 'block';
                uiScreens.pilotHud.style.display = 'flex';
                updatePilotHud(state);
            } else {
                engineerView.style.display = 'flex';
                updateEngineerUI(state);
            }
            break;
        case 'levelComplete':
            showScreen(uiScreens.levelComplete);
            uiScreens.levelComplete.textContent = `РІВЕНЬ ${state.currentLevel} ПРОЙДЕНО!`;
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
    // ... (code from previous response remains the same)
}
function updateEngineerUI(state) {
    if (!state.ship) return;
    document.getElementById('health-bar').value = state.ship.health;
    document.getElementById('shield-bar').value = state.ship.shields;
    document.getElementById('engineer-score').textContent = state.score;
    document.getElementById('engineer-level').textContent = state.currentLevel;
    document.getElementById('engineer-level-name').textContent = state.levelName;
    document.getElementById('engineer-status').textContent = state.ship.hasPackage ? `Доставка (${state.deliveriesMade}/${state.levelGoal})` : `Пошук вантажу (${state.deliveriesMade}/${state.levelGoal})`;
}

// --- PILOT LOGIC ---
function setupPilotControls() {
    const canvas = pilotView;
    const ctx = canvas.getContext('2d');
    canvas.width = 800; canvas.height = 600;

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

    function draw() {
        ctx.fillStyle = getCssVariable('--bg-color');
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        if (!localGameState.ship) { requestAnimationFrame(draw); return; }

        const state = localGameState;
        
        // Draw Zones
        if (state.pickupZone.active) drawZone(state.pickupZone, getCssVariable('--pickup-color'));
        if (state.deliveryZone.active) drawZone(state.deliveryZone, getCssVariable('--delivery-color'));

        // Draw Event Visuals
        if (state.event && state.event.type === 'empField') drawZone(state.event, getCssVariable('--emp-field-color'), true);

        // Draw Entities
        state.asteroids.forEach(a => drawAsteroid(a));
        state.turrets.forEach(t => drawTurret(t));
        state.mines.forEach(m => drawMine(m));
        state.pirates.forEach(p => drawPirate(p));
        
        // Draw Ship
        drawShip(state.ship);

        // Draw Projectiles
        ctx.fillStyle = '#fff';
        state.projectiles.forEach(p => ctx.fillRect(p.x - 2, p.y - 2, 4, 4));
        ctx.fillStyle = getCssVariable('--danger-color');
        state.turretProjectiles.forEach(p => ctx.fillRect(p.x - 2, p.y - 2, 4, 4));
        state.pirateProjectiles.forEach(p => ctx.fillRect(p.x - 2, p.y - 2, 4, 4));

        requestAnimationFrame(draw);
    }
    
    function drawZone(zone, color, isFilled = false) {
        ctx.strokeStyle = color;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(zone.x, zone.y, 40, 0, Math.PI * 2);
        ctx.stroke();
        if(isFilled){
            ctx.fillStyle = color.replace(')', ', 0.2)').replace('rgb', 'rgba');
            ctx.fill();
        }
    }
    function drawAsteroid(a) {
        ctx.fillStyle = getCssVariable('--asteroid-color');
        ctx.beginPath();
        ctx.arc(a.x, a.y, a.size, 0, Math.PI * 2);
        ctx.fill();
    }
    function drawTurret(t) {
        ctx.fillStyle = getCssVariable('--danger-color');
        ctx.beginPath();
        ctx.arc(t.x, t.y, 15, 0, Math.PI * 2);
        ctx.fill();
    }
    function drawMine(m) {
        ctx.fillStyle = getCssVariable('--mine-color');
        ctx.beginPath();
        ctx.arc(m.x, m.y, 8, 0, Math.PI * 2);
        ctx.fill();
    }
    function drawPirate(p) {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(Math.atan2(localGameState.ship.y - p.y, localGameState.ship.x - p.x));
        if (p.type === 'dreadnought') {
            ctx.fillStyle = getCssVariable('--dreadnought-color');
            ctx.beginPath(); ctx.moveTo(25, 0); ctx.lineTo(-15, -15); ctx.lineTo(-10, 0); ctx.lineTo(-15, 15); ctx.closePath(); ctx.fill();
        } else {
            ctx.fillStyle = getCssVariable('--pirate-color');
            ctx.beginPath(); ctx.moveTo(12, 0); ctx.lineTo(-8, -8); ctx.lineTo(-8, 8); ctx.closePath(); ctx.fill();
        }
        ctx.restore();
    }
    function drawShip(ship) {
        ctx.save();
        ctx.translate(ship.x, ship.y);
        ctx.rotate(ship.angle);
        ctx.fillStyle = ship.hasPackage ? '#ff0' : getCssVariable('--glow-color');
        ctx.beginPath(); ctx.moveTo(15, 0); ctx.lineTo(-10, -10); ctx.lineTo(-10, 10); ctx.closePath(); ctx.fill();
        ctx.restore();
        if (ship.shields > 0) {
            ctx.strokeStyle = `rgba(0, 255, 255, ${ship.shields / 100})`;
            ctx.lineWidth = 3;
            ctx.beginPath(); ctx.arc(ship.x, ship.y, 25, 0, Math.PI * 2); ctx.stroke();
        }
    }
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