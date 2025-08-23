// server.js
const express = require('express');
const http = require('http');
const WebSocket = require('ws');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(express.static('public'));

let players = {};

wss.on('connection', (ws) => {
    let role = null;

    if (!players.operative) {
        role = 'operative';
        players.operative = ws;
    } else if (!players.hacker) {
        role = 'hacker';
        players.hacker = ws;
    } else {
        ws.send(JSON.stringify({ type: 'error', message: 'All player slots are taken.' }));
        ws.close();
        return;
    }
    
    console.log(`Player connected as ${role}`);
    ws.send(JSON.stringify({ type: 'roleAssign', role: role }));

    ws.on('message', (message) => {
        const data = JSON.parse(message);
        if (role === 'operative' && players.hacker) {
            players.hacker.send(JSON.stringify(data));
        } else if (role === 'hacker' && players.operative) {
            players.operative.send(JSON.stringify(data));
        }
    });

    ws.on('close', () => {
        console.log(`Player ${role} disconnected`);
        if (role) {
            players[role] = null;
        }
    });
});

// -- ОСНОВНІ ЗМІНИ ТУТ --
const PORT = 3001; // Новий порт, щоб не заважати іншому процесу
const HOST = '31.42.190.29'; // Ваша IP-адреса

server.listen(PORT, HOST, () => {
    console.log(`Server is running on http://${HOST}:${PORT}`);
});