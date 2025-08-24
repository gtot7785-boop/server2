// server.js
const express = require("express");
const http = require("http");
const socketIo = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const PORT = 3001; // твой порт
const HOST = "31.42.190.29"; // твой айпи

app.use(express.static("public"));

let players = {};
let roundInProgress = false;

// Когда клиент подключается
io.on("connection", (socket) => {
  console.log(`Новый игрок: ${socket.id}`);
  players[socket.id] = { id: socket.id, program: [], x: 0, y: 0, color: getRandomColor(), alive: true };

  socket.emit("init", { id: socket.id, players });

  socket.on("setProgram", (program) => {
    if (!roundInProgress) {
      players[socket.id].program = program;
      console.log(`Игрок ${socket.id} загрузил программу:`, program);
    }
  });

  socket.on("disconnect", () => {
    console.log(`Игрок вышел: ${socket.id}`);
    delete players[socket.id];
  });
});

// Простая логика запуска боя
function startRound() {
  if (roundInProgress) return;
  roundInProgress = true;

  // Позиции по центру карты
  Object.values(players).forEach((p, i) => {
    p.x = 100 + i * 50;
    p.y = 100 + i * 50;
    p.alive = true;
  });

  let tick = 0;
  const interval = setInterval(() => {
    tick++;
    for (const p of Object.values(players)) {
      if (!p.alive) continue;
      const action = p.program[tick % p.program.length];
      if (action === "UP") p.y -= 10;
      if (action === "DOWN") p.y += 10;
      if (action === "LEFT") p.x -= 10;
      if (action === "RIGHT") p.x += 10;
      if (action === "ATTACK") {
        // простая атака — убивает ближайшего на расстоянии < 20
        for (const q of Object.values(players)) {
          if (q.id !== p.id && q.alive) {
            const dx = q.x - p.x;
            const dy = q.y - p.y;
            if (Math.sqrt(dx * dx + dy * dy) < 20) {
              q.alive = false;
              console.log(`${p.id} атаковал ${q.id}`);
            }
          }
        }
      }
    }

    io.emit("state", players);

    if (tick > 50) {
      clearInterval(interval);
      roundInProgress = false;
      io.emit("roundOver", players);
    }
  }, 500);
}

setInterval(() => {
  if (!roundInProgress && Object.keys(players).length > 1) {
    startRound();
  }
}, 5000);

function getRandomColor() {
  const colors = ["red", "blue", "green", "orange", "purple"];
  return colors[Math.floor(Math.random() * colors.length)];
}

server.listen(PORT, HOST, () => {
  console.log(`Сервер запущен на http://${HOST}:${PORT}`);
});
