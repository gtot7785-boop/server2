// server.js
const express = require('express');
const http = require('http');
const WebSocket = require('ws');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(express.static('public'));

// --- Game Constants ---
const GAME_WIDTH = 800;
const WORLD_HEIGHT = 5000; // Високий світ для вертикальної подорожі
const SHIP_BASE_SPEED = 2.5; // Базова швидкість авто-прокрутки
const EVENT_CHANCE = 0.8;
const EVENT_INTERVAL = 45 * 1000; // 45 секунд

// --- Level Definitions ---
const LEVELS = [
    { level: 1, name: "Тренувальний полігон", theme: 'default', deliveries: 1, asteroids: 15, turrets: 3, pirates: 0, mines: 0, dreadnoughts: 0 },
    { level: 2, name: "Перший контракт", theme: 'default', deliveries: 2, asteroids: 20, turrets: 5, pirates: 2, mines: 0, dreadnoughts: 0 },
    { level: 3, name: "Крижаний пояс", theme: 'iceField', deliveries: 2, asteroids: 30, turrets: 3, pirates: 4, mines: 10, dreadnoughts: 0 },
    { level: 4, name: "Замерзла небезпека", theme: 'iceField', deliveries: 3, asteroids: 35, turrets: 5, pirates: 5, mines: 15, dreadnoughts: 0 },
    { level: 5, name: "Сектор червоного гіганта", theme: 'redGiant', deliveries: 2, asteroids: 20, turrets: 7, pirates: 6, mines: 15, dreadnoughts: 0 },
    { level: 6, name: "Гніздо піратів", theme: 'redGiant', deliveries: 3, asteroids: 25, turrets: 5, pirates: 7, mines: 20, dreadnoughts: 1 },
    { level: 7, name: "Зоряна туманність", theme: 'nebula', deliveries: 3, asteroids: 30, turrets: 8, pirates: 5, mines: 25, dreadnoughts: 0 },
    { level: 8, name: "Прихована загроза", theme: 'nebula', deliveries: 3, asteroids: 25, turrets: 6, pirates: 7, mines: 30, dreadnoughts: 1 },
    { level: 9, name: "Останній рубіж", theme: 'default', deliveries: 4, asteroids: 35, turrets: 7, pirates: 8, mines: 25, dreadnoughts: 2 },
    { level: 10, name: "Кур'єрська слава", theme: 'iceField', deliveries: 5, asteroids: 40, turrets: 8, pirates: 10, mines: 30, dreadnoughts: 2 }
];
const ALL_EVENTS = ['solarFlare', 'asteroidShower', 'empField'];

let players = { pilot: null, engineer: null };
let gameInterval = null;
let eventInterval = null;
let playerInput = {};
let gameState = {};

function broadcast(data) {
    const message = JSON.stringify(data);
    if (players.pilot) players.pilot.ws.send(message);
    if (players.engineer) players.engineer.ws.send(message);
}

function resetGame(level = 0) {
    console.log(`--- Starting Level ${level + 1} ---`);
    if (gameInterval) clearInterval(gameInterval);
    if (eventInterval) clearInterval(eventInterval);

    playerInput = { pilot: { keys: {}, mouse: { x: 400, y: 300, down: false } } };
    const levelConfig = LEVELS[level % LEVELS.length];

    gameState = {
        status: 'playing',
        currentLevel: level + 1,
        levelName: levelConfig.name,
        theme: levelConfig.theme,
        levelGoal: levelConfig.deliveries,
        deliveriesMade: 0,
        event: { type: 'none', duration: 0, x: 0, y: 0, radius: 150 },
        ship: { x: GAME_WIDTH / 2, y: WORLD_HEIGHT - 300, angle: -Math.PI / 2, health: 100, shields: 100, hasPackage: false, weaponCooldown: 0, invincible: 0 },
        power: { shields: 34, engines: 33, weapons: 33 },
        projectiles: [], turretProjectiles: [], pirateProjectiles: [],
        asteroids: [], turrets: [], pirates: [], mines: [], explosions: [],
        pickupZone: { active: true }, deliveryZone: { active: false },
        score: gameState.score || 0
    };

    spawnEntities(levelConfig);
    gameInterval = setInterval(gameLoop, 1000 / 60);
    eventInterval = setInterval(triggerRandomEvent, EVENT_INTERVAL);
}

function spawnEntities(config) {
    gameState.pickupZone.x = Math.random() * (GAME_WIDTH - 200) + 100;
    gameState.pickupZone.y = WORLD_HEIGHT - 1000 - (Math.random() * 500);
    gameState.deliveryZone.x = Math.random() * (GAME_WIDTH - 200) + 100;
    gameState.deliveryZone.y = WORLD_HEIGHT - 2500 - (Math.random() * 500);

    for (let i = 0; i < config.asteroids; i++) gameState.asteroids.push({ x: Math.random() * GAME_WIDTH, y: Math.random() * (WORLD_HEIGHT - 200), size: Math.random() * 20 + 15, dx: Math.random() * 2 - 1, dy: Math.random() * 2 - 1 });
    for (let i = 0; i < config.turrets; i++) gameState.turrets.push({ x: Math.random() * GAME_WIDTH, y: Math.random() * (WORLD_HEIGHT - 400), cooldown: 120, health: 50 });
    for (let i = 0; i < config.pirates; i++) gameState.pirates.push({ x: Math.random() * GAME_WIDTH, y: Math.random() * (WORLD_HEIGHT - 600), cooldown: 180, health: 100, speed: 1.5, type: 'normal' });
    for (let i = 0; i < config.dreadnoughts; i++) gameState.pirates.push({ x: Math.random() * GAME_WIDTH, y: Math.random() * (WORLD_HEIGHT - 800), cooldown: 240, health: 250, speed: 1, type: 'dreadnought' });
    for (let i = 0; i < config.mines; i++) gameState.mines.push({ x: Math.random() * GAME_WIDTH, y: Math.random() * (WORLD_HEIGHT - 200) });
}

function handleDamage(damage) {
    if (gameState.ship.invincible > 0) return;
    gameState.ship.invincible = 30;
    if (gameState.ship.shields > 0) {
        gameState.ship.shields -= damage;
        if (gameState.ship.shields < 0) { gameState.ship.health += gameState.ship.shields; gameState.ship.shields = 0; }
    } else {
        gameState.ship.health -= damage;
    }
}

function triggerRandomEvent() {
    if (Math.random() < EVENT_CHANCE && gameState.status === 'playing') {
        const eventType = ALL_EVENTS[Math.floor(Math.random() * ALL_EVENTS.length)];
        gameState.event.type = eventType;
        console.log(`EVENT TRIGGERED: ${eventType}`);

        switch (eventType) {
            case 'solarFlare':
                gameState.event.duration = 10 * 60; // 10 seconds in frames
                break;
            case 'asteroidShower':
                gameState.event.duration = 15 * 60; // 15 seconds
                for (let i = 0; i < 15; i++) {
                    gameState.asteroids.push({ x: Math.random() * GAME_WIDTH, y: gameState.ship.y - GAME_HEIGHT / 2 - 50, size: Math.random() * 10 + 5, dx: Math.random() * 2 - 1, dy: Math.random() * 4 + 2, isEvent: true });
                }
                break;
            case 'empField':
                gameState.event.duration = 20 * 60; // 20 seconds
                gameState.event.x = Math.random() * (GAME_WIDTH - 300) + 150;
                gameState.event.y = gameState.ship.y - GAME_HEIGHT / 2;
                break;
        }
        broadcast({type: 'eventStart', event: gameState.event });
    }
}

function updateEvents() {
    if (gameState.event.type !== 'none') {
        gameState.event.duration--;
        if (gameState.event.duration <= 0) {
            console.log(`EVENT ENDED: ${gameState.event.type}`);
            if (gameState.event.type === 'asteroidShower') {
                gameState.asteroids = gameState.asteroids.filter(a => !a.isEvent);
            }
            gameState.event.type = 'none';
            broadcast({type: 'eventEnd'});
        }
    }
}

function isColliding(obj1, obj2, radius) {
    const dx = obj1.x - obj2.x;
    const dy = obj1.y - obj2.y;
    return Math.sqrt(dx * dx + dy * dy) < radius;
}

function gameLoop() {
    if (gameState.status !== 'playing') return;
    updateEvents();

    const { ship, power, event } = gameState;
    const input = playerInput.pilot || { keys: {}, mouse: { x: ship.x, y: ship.y - 100 } };

    let engineModifier = 1;
    let weaponDisabled = false;
    const dx_event = ship.x - event.x;
    const dy_event = ship.y - event.y;
    const inEmpField = event.type === 'empField' && Math.sqrt(dx_event * dx_event + dy_event * dy_event) < event.radius;

    if (inEmpField) {
        engineModifier = 0.3;
        weaponDisabled = true;
    }
    
    // --- Ship Movement & Scrolling ---
    const enginePower = (1 + (power.engines / 50)) * engineModifier;
    ship.y -= SHIP_BASE_SPEED; // Constant upward scroll
    
    if (input.keys['w']) ship.y -= 1.5 * enginePower;
    if (input.keys['s']) ship.y += 1.5 * enginePower;
    if (input.keys['a']) ship.x -= 2 * enginePower;
    if (input.keys['d']) ship.x += 2 * enginePower;
    
    // --- Ship Boundaries ---
    ship.x = Math.max(15, Math.min(GAME_WIDTH - 15, ship.x));

    // --- Aiming ---
    let cameraY = ship.y - 480; // Approximate camera position for aiming
    ship.angle = Math.atan2(input.mouse.y - (ship.y - cameraY), input.mouse.x - ship.x);

    // --- Firing ---
    if (ship.weaponCooldown > 0) ship.weaponCooldown--;
    if (input.mouse.down && ship.weaponCooldown <= 0 && !weaponDisabled) {
        gameState.projectiles.push({ x: ship.x, y: ship.y, angle: ship.angle, speed: 8 });
        const weaponPowerFactor = 1 - (power.weapons / 150);
        ship.weaponCooldown = 10 * weaponPowerFactor;
    }
    
    // --- Projectile Movement ---
    gameState.projectiles.forEach(p => { p.x += Math.cos(p.angle) * p.speed; p.y += Math.sin(p.angle) * p.speed; });
    gameState.turretProjectiles.forEach(p => { p.x += Math.cos(p.angle) * p.speed; p.y += Math.sin(p.angle) * p.speed; });
    gameState.pirateProjectiles.forEach(p => { p.x += Math.cos(p.angle) * p.speed; p.y += Math.sin(p.angle) * p.speed; });

    // --- Entity AI and Logic ---
    gameState.asteroids.forEach(a => { a.x += a.dx; a.y += a.dy; if (a.x < 0 || a.x > GAME_WIDTH) a.dx *= -1; });
    gameState.turrets.forEach(t => { if(t.cooldown-- <= 0) { const angle = Math.atan2(ship.y-t.y, ship.x-t.x); gameState.turretProjectiles.push({x:t.x,y:t.y,angle:angle,speed:4}); t.cooldown = 120; } });
    gameState.pirates.forEach(p => { const angle = Math.atan2(ship.y - p.y, ship.x - p.x); p.x += Math.cos(angle) * p.speed; p.y += Math.sin(angle) * p.speed; if(p.cooldown-- <= 0) { gameState.pirateProjectiles.push({x: p.x,y: p.y,angle: angle,speed: 4}); p.cooldown = 180; } });
    
    // --- Collisions ---
    // (This section would contain all the collision checks between ship, projectiles, asteroids, etc.)

    // --- Objective Logic ---
    if (gameState.pickupZone.active && !ship.hasPackage && isColliding(ship, gameState.pickupZone, 40)) {
        ship.hasPackage = true;
        gameState.pickupZone.active = false;
        gameState.deliveryZone.active = true;
    }
    if (gameState.deliveryZone.active && ship.hasPackage && isColliding(ship, gameState.deliveryZone, 40)) {
        ship.hasPackage = false;
        gameState.score += 100;
        gameState.deliveriesMade++;
        gameState.pickupZone.active = true;
        gameState.deliveryZone.active = false;
        // Spawn new zones further up
        gameState.pickupZone.y -= 1500;
        gameState.deliveryZone.y = gameState.pickupZone.y - 1500;
    }
    
    // --- Level Completion & Game Over ---
    if (gameState.deliveriesMade >= gameState.levelGoal) {
        gameState.status = 'levelComplete';
        broadcast({ type: 'gameStateUpdate', state: gameState });
        clearInterval(gameInterval);
        setTimeout(() => resetGame(gameState.currentLevel), 5000);
        return;
    }
    if (ship.health <= 0) {
        gameState.status = 'gameOver';
        broadcast({ type: 'gameStateUpdate', state: gameState });
        clearInterval(gameInterval);
        setTimeout(() => {
            if (players.pilot) players.pilot.ready = false;
            if (players.engineer) players.engineer.ready = false;
            broadcast({ type: 'gameStateUpdate', state: { status: 'lobby', score: gameState.score } });
        }, 5000);
        return;
    }
    
    broadcast({ type: 'gameStateUpdate', state: gameState });
}

wss.on('connection', (ws) => {
    let role = null;
    if (!players.pilot) {
        role = 'pilot'; players.pilot = { ws, ready: false };
    } else if (!players.engineer) {
        role = 'engineer'; players.engineer = { ws, ready: false };
    } else { ws.close(); return; }

    console.log(`Player connected as ${role}`);
    ws.send(JSON.stringify({ type: 'roleAssign', role: role }));
    broadcast({type: 'gameStateUpdate', state: { status: 'lobby' }});

    ws.on('message', (message) => {
        const data = JSON.parse(message);
        if (data.type === 'playerReady') {
            players[role].ready = true;
            console.log(`${role} is ready.`);
            if (players.pilot && players.pilot.ready && players.engineer && players.engineer.ready) {
                let countdown = 3;
                broadcast({ type: 'countdown', count: countdown });
                const countdownInterval = setInterval(() => {
                    countdown--;
                    broadcast({ type: 'countdown', count: countdown });
                    if (countdown <= 0) {
                        clearInterval(countdownInterval);
                        resetGame(0);
                    }
                }, 1000);
            }
        } else if (role === 'pilot' && data.type === 'pilotUpdate') {
            playerInput.pilot = data.input;
        } else if (role === 'engineer' && data.type === 'engineerUpdate') {
            if(gameState.power) gameState.power = data.power;
        }
    });

    ws.on('close', () => {
        console.log(`Player ${role} disconnected.`);
        players[role] = null;
        if (gameInterval) clearInterval(gameInterval);
        if(eventInterval) clearInterval(eventInterval);
        gameInterval = null;
        eventInterval = null;
        broadcast({ type: 'playerDisconnect' });
    });
});

const PORT = 3001;
const HOST = '31.42.190.29';
server.listen(PORT, HOST, () => {
    console.log(`Server is running on http://${HOST}:${PORT}`);
});