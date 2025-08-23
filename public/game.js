// public/game.js
const urlParams = new URLSearchParams(window.location.search);
const myRole = urlParams.get('role');

// -- ЗМІНИ ТУТ --
// Напряму вказуємо IP-адресу та порт сервера
const ws = new WebSocket(`ws://31.42.190.29:3001`);

const pilotView = document.getElementById('pilot-view');
const engineerView = document.getElementById('engineer-view');

let localGameState = {};

ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.type === 'roleAssign') {
        initializeUI(data.role);
    } else if (data.type === 'gameStateUpdate') {
        localGameState = data.state;
        if (myRole === 'engineer') {
            updateEngineerUI();
        }
    }
};

function initializeUI(assignedRole) {
    if (assignedRole === 'pilot') {
        pilotView.style.display = 'block';
        setupPilotControls();
    } else if (assignedRole === 'engineer') {
        engineerView.style.display = 'flex';
        setupEngineerControls();
    }
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

    function balancePower() {
        const total = 100;
        let currentTotal = parseInt(sliders.shields.value) + parseInt(sliders.engines.value) + parseInt(sliders.weapons.value);
        if (currentTotal == 0) return;

        let power = {
            shields: Math.round((sliders.shields.value / currentTotal) * total),
            engines: Math.round((sliders.engines.value / currentTotal) * total),
            weapons: 0
        };
        power.weapons = total - power.shields - power.engines;
        
        sliders.shields.value = power.shields;
        sliders.engines.value = power.engines;
        sliders.weapons.value = power.weapons;

        values.shields.textContent = `${power.shields}%`;
        values.engines.textContent = `${power.engines}%`;
        values.weapons.textContent = `${power.weapons}%`;

        ws.send(JSON.stringify({ type: 'engineerUpdate', power: power }));
    }

    Object.values(sliders).forEach(slider => slider.addEventListener('input', balancePower));
}

function updateEngineerUI() {
    if (!localGameState.ship) return;
    document.getElementById('health-bar').value = localGameState.ship.health;
    document.getElementById('shield-bar').value = localGameState.ship.shields;
}

// --- PILOT LOGIC ---
function setupPilotControls() {
    const canvas = pilotView;
    const ctx = canvas.getContext('2d');
    canvas.width = 800;
    canvas.height = 600;

    const keys = {};
    const mouse = { x: 0, y: 0 };
    let playerShip = { x: 400, y: 300, angle: 0, speed: 3 };

    document.addEventListener('keydown', e => keys[e.key.toLowerCase()] = true);
    document.addEventListener('keyup', e => keys[e.key.toLowerCase()] = false);
    canvas.addEventListener('mousemove', e => {
        const rect = canvas.getBoundingClientRect();
        mouse.x = e.clientX - rect.left;
        mouse.y = e.clientY - rect.top;
    });

    function pilotUpdateLoop() {
        if (keys['w']) {
            playerShip.x += Math.cos(playerShip.angle) * playerShip.speed;
            playerShip.y += Math.sin(playerShip.angle) * playerShip.speed;
        }
        if (keys['s']) {
            playerShip.x -= Math.cos(playerShip.angle) * (playerShip.speed / 2);
            playerShip.y -= Math.sin(playerShip.angle) * (playerShip.speed / 2);
        }
        if (keys['a']) playerShip.angle -= 0.05;
        if (keys['d']) playerShip.angle += 0.05;

        const dx = mouse.x - playerShip.x;
        const dy = mouse.y - playerShip.y;
        playerShip.angle = Math.atan2(dy, dx);
        
        ws.send(JSON.stringify({
            type: 'pilotUpdate',
            x: playerShip.x,
            y: playerShip.y,
            angle: playerShip.angle
        }));

        setTimeout(pilotUpdateLoop, 1000 / 30);
    }

    function draw() {
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        if (localGameState.ship) {
            const ship = localGameState.ship;
            
            ctx.save();
            ctx.translate(ship.x, ship.y);
            ctx.rotate(ship.angle);
            ctx.fillStyle = '#0ff';
            ctx.beginPath();
            ctx.moveTo(15, 0);
            ctx.lineTo(-10, -10);
            ctx.lineTo(-10, 10);
            ctx.closePath();
            ctx.fill();
            ctx.restore();
        }
        requestAnimationFrame(draw);
    }
    
    pilotUpdateLoop();
    draw();
}