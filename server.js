# ===== package.json =====
{
"name": "bitva-botov",
"version": "1.0.0",
"description": "Мини-игра на 4 игроков: программируемые боты. Node.js + Socket.IO",
"main": "server.js",
"type": "module",
"scripts": {
"start": "node server.js",
"dev": "NODE_ENV=development node server.js"
},
"dependencies": {
"express": "^4.19.2",
"socket.io": "^4.7.5"
}
}


# ===== server.js =====
import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });


app.use(express.static(path.join(__dirname, 'public')));


// --- Простая игра на одну комнату с максимум 4 игроками ---
const MAX_PLAYERS = 4;
const TICK_MS = 200;
const ROUND_TICKS = 120; // ~24 сек при 200мс


const ARENA_W = 24;
const ARENA_H = 16;


const COLORS = ['#e74c3c', '#3498db', '#2ecc71', '#f1c40f'];


const COMMANDS = {
FORWARD: 'FORWARD',
LEFT: 'LEFT',
RIGHT: 'RIGHT',
ATTACK: 'ATTACK',
EVADE: 'EVADE',
IF_ENEMY_AHEAD: 'IF_ENEMY_AHEAD' // формат: {type: IF_ENEMY_AHEAD, then: 'ATTACK', else: 'FORWARD'}
};


function randomSpawn(i) {
// 4 стартовые точки по углам
const spawns = [
{ x: 1, y: 1, dir: 1 },
{ x: ARENA_W - 2, y: 1, dir: 2 },
{ x: 1, y: ARENA_H - 2, dir: 1 },
{ x: ARENA_W - 2, y: ARENA_H - 2, dir: 2 }
];
return spawns[i] || { x: 2, y: 2, dir: 0 };
}


const state = {
phase: 'lobby', // lobby | programming | running | gameover
players: {}, // socketId -> {id, name, colorIndex, ready, commands: [], score}
order: [], // socketIds
tick: 0,
bots: {}, // socketId -> {x,y,dir,hp,alive,owner}
walls: [] // можно добавить препятствия позже
};


function broadcastLobby() {
const lobby = state.order.map((id, idx) => {
const p = state.players[id];
return p ? { id, idx, name: p.name, color: COLORS[p.colorIndex], ready: !!p.ready } : null;
}).filter(Boolean);
io.emit('lobby', { lobby, phase: state.phase });
}


function resetRound() {
state.tick = 0;
state.bots = {};
state.phase = 'programming';
// спавним ботов
state.order.forEach((id, i) => {
</html>