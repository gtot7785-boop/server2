const socket = io();

let myId = null;
let program = [];
let players = {};

function addCommand(cmd) {
  program.push(cmd);
  document.getElementById("program").innerText = program.join(" → ");
}

function sendProgram() {
  socket.emit("setProgram", program);
}

socket.on("init", (data) => {
  myId = data.id;
  players = data.players;
});

socket.on("state", (data) => {
  players = data;
  draw();
});

socket.on("roundOver", (data) => {
  players = data;
  alert("Раунд завершён!");
});

function draw() {
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  for (const p of Object.values(players)) {
    ctx.fillStyle = p.alive ? p.color : "gray";
    ctx.fillRect(p.x, p.y, 20, 20);
    ctx.fillStyle = "black";
    ctx.fillText(p.id.substring(0, 4), p.x, p.y - 5);
  }
}
