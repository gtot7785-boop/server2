// public/game.js
const urlParams = new URLSearchParams(window.location.search);
const myRole = urlParams.get('role');

// Напряму вказуємо адресу сервера, до якого підключатись
const ws = new WebSocket(`ws://31.42.190.29:3001`);

// Елементи інтерфейсу
const operativeView = document.getElementById('operative-view');
const hackerView = document.getElementById('hacker-view');
const hackerLog = document.getElementById('hacker-log');
const unlockBtn = document.getElementById('unlock-door-btn');

let player, door, doorIsLocked;

ws.onmessage = (event) => {
    const data = JSON.parse(event.data);

    if (myRole === 'operative') {
        // Оперативник отримує команди від Хакера
        if (data.type === 'unlockDoor' && data.doorId === 'A7') {
            doorIsLocked = false;
            console.log("Hacker unlocked the door!");
        }
    }

    if (myRole === 'hacker') {
        // Хакер отримує статус від Оперативника
        if (data.type === 'operativeStatus' && data.atDoor === 'A7') {
            hackerLog.textContent = "!!! Оперативник біля дверей A7. Можна зламувати.";
            unlockBtn.disabled = false;
        }
    }
};

if (myRole === 'operative') {
    // --- ЛОГІКА ОПЕРАТИВНИКА ---
    operativeView.style.display = 'block';
    const ctx = operativeView.getContext('2d');
    operativeView.width = 800;
    operativeView.height = 600;

    player = { x: 50, y: 300, width: 40, height: 40 };
    door = { x: 700, y: 250, width: 20, height: 100 };
    doorIsLocked = true;
    const keys = {};

    document.addEventListener('keydown', (e) => keys[e.key] = true);
    document.addEventListener('keyup', (e) => keys[e.key] = false);

    function gameLoop() {
        // Рух
        if (keys['w'] || keys['W'] || keys['ц'] || keys['Ц']) player.y -= 3;
        if (keys['s'] || keys['S'] || keys['і'] || keys['І']) player.y += 3;
        if (keys['a'] || keys['A'] || keys['ф'] || keys['Ф']) player.x -= 3;
        if (keys['d'] || keys['D'] || keys['в'] || keys['В']) player.x += 3;

        // Перевірка зіткнення з дверима
        const doorCheckZone = { x: door.x - 20, y: door.y - 20, width: door.width + 40, height: door.height + 40 };
        if (player.x < doorCheckZone.x + doorCheckZone.width && player.x + player.width > doorCheckZone.x &&
            player.y < doorCheckZone.y + doorCheckZone.height && player.y + player.height > doorCheckZone.y) {
            ws.send(JSON.stringify({ type: 'operativeStatus', atDoor: 'A7' }));
        }

        // Малювання
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(0, 0, operativeView.width, operativeView.height);

        ctx.fillStyle = 'cyan';
        ctx.fillRect(player.x, player.y, player.width, player.height);
        
        ctx.fillStyle = doorIsLocked ? 'red' : 'lime';
        ctx.fillRect(door.x, door.y, door.width, door.height);

        requestAnimationFrame(gameLoop);
    }
    gameLoop();
} else if (myRole === 'hacker') {
    // --- ЛОГІКА ХАКЕРА ---
    hackerView.style.display = 'block';
    unlockBtn.addEventListener('click', () => {
        ws.send(JSON.stringify({ type: 'unlockDoor', doorId: 'A7' }));
        hackerLog.textContent = "Сигнал на злам дверей [A7] надіслано.";
        unlockBtn.disabled = true;
    });
}