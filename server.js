// server.js
const express = require('express');
const http = require('http');
const WebSocket = require('ws');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(express.static('public'));

let players = {};
let gameInterval = null;

let gameState = {
    ship: { x: 400, y: 500, angle: 0, health: 100, shields: 100 },
    power: { shields: 34, engines: 33, weapons: 33 },
    projectiles: [],
    asteroids: []
};

function resetGameState() {
    players = {};
    gameState = {
        ship: { x: 400, y: 500, angle: 0, health: 100, shields: 100 },
        power: { shields: 34, engines: 33, weapons: 33 },
        projectiles: [],
        asteroids: []
    };
    if (gameInterval) {
        clearInterval(gameInterval);
        gameInterval = null;
    }
}

function gameLoop() {
    const stateMessage = JSON.stringify({ type: 'gameStateUpdate', state: gameState });
    if (players.pilot) players.pilot.send(stateMessage);
    if (players.engineer) players.engineer.send(stateMessage);
}

wss.on('connection', (ws) => {
    let role = null;
    if (!players.pilot) {
        role = 'pilot';
        players.pilot = ws;
    } else if (!players.engineer) {
        role = 'engineer';
        players.engineer = ws;
    } else {
        ws.close();
        return;
    }
    console.log(`Player connected as ${role}`);
    ws.send(JSON.stringify({ type: 'roleAssign', role: role }));

    if (players.pilot && players.engineer && !gameInterval) {
        console.log('Both players connected. Starting game loop.');
        gameInterval = setInterval(gameLoop, 1000 / 60);
    }

    ws.on('message', (message) => {
        const data = JSON.parse(message);
        
        if (data.type === 'pilotUpdate') {
            gameState.ship.x = data.x;
            gameState.ship.y = data.y;
            gameState.ship.angle = data.angle;
        } else if (data.type === 'engineerUpdate') {
            gameState.power = data.power;
        }
    });

    ws.on('close', () => {
        console.log(`Player ${role} disconnected. Resetting game.`);
        resetGameState();
    });
});

// -- ЗМІНИ ТУТ --
const PORT = 3001; // Встановлюємо новий порт
const HOST = '31.42.190.29'; // Встановлюємо вашу IP-адресу

server.listen(PORT, HOST, () => {
    console.log(`Cosmic Courier server is running on http://${HOST}:${PORT}`);
});