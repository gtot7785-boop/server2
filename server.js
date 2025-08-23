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
const GAME_HEIGHT = 600;
const EVENT_CHANCE = 0.8;
const EVENT_INTERVAL = 45 * 1000;

// --- Level Definitions ---
const LEVELS = [
    { level: 1, name: "Тренувальний полігон", theme: 'default', deliveries: 1, asteroids: 3, turrets: 1, pirates: 0, mines: 0, dreadnoughts: 0 },
    { level: 2, name: "Перший контракт", theme: 'default', deliveries: 2, asteroids: 5, turrets: 2, pirates: 1, mines: 0, dreadnoughts: 0 },
    { level: 3, name: "Крижаний пояс", theme: 'iceField', deliveries: 2, asteroids: 10, turrets: 1, pirates: 2, mines: 3, dreadnoughts: 0 },
    { level: 4, name: "Замерзла небезпека", theme: 'iceField', deliveries: 3, asteroids: 12, turrets: 3, pirates: 3, mines: 5, dreadnoughts: 0 },
    { level: 5, name: "Сектор червоного гіганта", theme: 'redGiant', deliveries: 2, asteroids: 5, turrets: 4, pirates: 4, mines: 5, dreadnoughts: 0 },
    { level: 6, name: "Гніздо піратів", theme: 'redGiant', deliveries: 3, asteroids: 7, turrets: 3, pirates: 5, mines: 7, dreadnoughts: 1 },
    { level: 7, name: "Зоряна туманність", theme: 'nebula', deliveries: 3, asteroids: 10, turrets: 5, pirates: 3, mines: 10, dreadnoughts: 0 },
    { level: 8, name: "Прихована загроза", theme: 'nebula', deliveries: 3, asteroids: 8, turrets: 4, pirates: 5, mines: 12, dreadnoughts: 1 },
    { level: 9, name: "Останній рубіж", theme: 'default', deliveries: 4, asteroids: 12, turrets: 5, pirates: 6, mines: 10, dreadnoughts: 2 },
    { level: 10, name: "Кур'єрська слава", theme: 'iceField', deliveries: 5, asteroids: 15, turrets: 6, pirates: 8, mines: 15, dreadnoughts: 2 }
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
        ship: { x: GAME_WIDTH / 2, y: GAME_HEIGHT - 50, angle: -Math.PI / 2, health: 100, shields: 100, hasPackage: false, weaponCooldown: 0, invincible: 0 },
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
    gameState.pickupZone.x = Math.random() * (GAME_WIDTH - 100) + 50;
    gameState.pickupZone.y = Math.random() * (GAME_HEIGHT / 2 - 100) + 50;
    gameState.deliveryZone.x = Math.random() * (GAME_WIDTH - 100) + 50;
    gameState.deliveryZone.y = Math.random() * (GAME_HEIGHT / 2 - 100) + 50;

    for (let i = 0; i < config.asteroids; i++) gameState.asteroids.push({ x: Math.random() * GAME_WIDTH, y: Math.random() * GAME_HEIGHT, size: Math.random() * 20 + 15, dx: Math.random() * 2 - 1, dy: Math.random() * 2 - 1 });
    for (let i = 0; i < config.turrets; i++) gameState.turrets.push({ x: Math.random() * GAME_WIDTH, y: Math.random() * GAME_HEIGHT, cooldown: 120, health: 50 });
    for (let i = 0; i < config.pirates; i++) gameState.pirates.push({ x: Math.random() * GAME_WIDTH, y: 50, cooldown: 180, health: 100, speed: 1.5, type: 'normal' });
    for (let i = 0; i < config.dreadnoughts; i++) gameState.pirates.push({ x: Math.random() * GAME_WIDTH, y: 50, cooldown: 240, health: 250, speed: 1, type: 'dreadnought' });
    for (let i = 0; i < config.mines; i++) gameState.mines.push({ x: Math.random() * GAME_WIDTH, y: Math.random() * GAME_HEIGHT });
}

function handleDamage(damage) {
    if (gameState.ship.invincible > 0) return;
    gameState.ship.invincible = 30; // 0.5s invincibility
    if (gameState.ship.shields > 0) {
        gameState.ship.shields -= damage;
        if (gameState.ship.shields < 0) { gameState.ship.health += gameState.ship.shields; gameState.ship.shields = 0; }
    } else {
        gameState.ship.health -= damage;
    }
}

function triggerRandomEvent() {
    if (Math.random() < EVENT_CHANCE) {
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
                    gameState.asteroids.push({ x: Math.random() * GAME_WIDTH, y: -20, size: Math.random() * 10 + 5, dx: Math.random() * 2 - 1, dy: Math.random() * 4 + 2, isEvent: true });
                }
                break;
            case 'empField':
                gameState.event.duration = 20 * 60; // 20 seconds
                gameState.event.x = Math.random() * (GAME_WIDTH - 300) + 150;
                gameState.event.y = Math.random() * (GAME_HEIGHT - 300) + 150;
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

function gameLoop() {
    if (gameState.status !== 'playing') return;
    updateEvents();
    // ... (весь інший код gameLoop для руху, зіткнень, AI, логіки рівнів і т.д.)
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
        gameInterval = null;
        broadcast({ type: 'playerDisconnect' });
    });
});

const PORT = 3001;
const HOST = '31.42.190.29';
server.listen(PORT, HOST, () => {
    console.log(`Server is running on http://${HOST}:${PORT}`);
});