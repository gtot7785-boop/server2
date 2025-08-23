// server.js
const express = require('express');
const http = require('http');
const WebSocket = require('ws');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// "Роздаємо" статичні файли з папки 'public'
app.use(express.static('public'));

let players = {}; // Зберігаємо гравців та їх ролі

wss.on('connection', (ws) => {
    let role = null;

    // Призначаємо роль: перший, хто підключився - Оперативник, другий - Хакер
    if (!players.operative) {
        role = 'operative';
        players.operative = ws;
    } else if (!players.hacker) {
        role = 'hacker';
        players.hacker = ws;
    } else {
        // Якщо обидві ролі зайняті
        ws.send(JSON.stringify({ type: 'error', message: 'All player slots are taken.' }));
        ws.close();
        return;
    }
    
    console.log(`Player connected as ${role}`);
    ws.send(JSON.stringify({ type: 'roleAssign', role: role }));

    // Обробка повідомлень від клієнтів
    ws.on('message', (message) => {
        const data = JSON.parse(message);

        // Пересилаємо повідомлення іншому гравцю
        if (role === 'operative' && players.hacker) {
            players.hacker.send(JSON.stringify(data));
        } else if (role === 'hacker' && players.operative) {
            players.operative.send(JSON.stringify(data));
        }
    });

    // Обробка відключення
    ws.on('close', () => {
        console.log(`Player ${role} disconnected`);
        if (role) {
            players[role] = null; // Звільняємо слот
        }
    });
});

const PORT = 3000;
server.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
    console.log('Open this page on your PC and phone (connected to the same Wi-Fi).');
});