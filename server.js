const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

let gameState = {
    timer: 1200, // 20 min in secondi
    isRunning: false,
    currentLevel: 1,
    players: [],
    rebuys: 0,
    addons: 0,
    buyIn: 5,
    isPause: false
};

// Funzione per calcolare i bui in base al livello
function getBlinds(level) {
    const blinds = [
        "25/50", "50/100", "75/150", "100/200", "150/300", // Livelli 1-5
        "PAUSA", // Livello 6 (Pausa)
        "200/400", "300/600", "400/800", "600/1200", "800/1600" // Livelli successivi
    ];
    return blinds[level - 1] || "2000/4000";
}

// Logica del Timer
setInterval(() => {
    if (gameState.isRunning && gameState.timer > 0) {
        gameState.timer--;
        io.emit('tick', gameState);
    } else if (gameState.timer === 0 && gameState.isRunning) {
        nextLevel();
    }
}, 1000);

function nextLevel() {
    gameState.currentLevel++;
    if (gameState.currentLevel === 6) { // Pausa dopo il livello 5
        gameState.timer = 600; // 10 min
        gameState.isPause = true;
    } else {
        gameState.timer = gameState.currentLevel >= 8 ? 900 : 1200;
        gameState.isPause = false;
    }
    io.emit('updateState', gameState);
}

io.on('connection', (socket) => {
    socket.emit('updateState', gameState);

    socket.on('adminControl', (action) => {
        if (action === 'start') gameState.isRunning = true;
        if (action === 'pause') gameState.isRunning = false;
        if (action === 'skip') nextLevel();
        io.emit('updateState', gameState);
    });

    socket.on('updatePlayer', (updatedPlayer) => {
        const idx = gameState.players.findIndex(p => p.id === updatedPlayer.id);
        if (idx !== -1) {
            gameState.players[idx] = updatedPlayer;
            // Ordinamento automatico per chip count
            gameState.players.sort((a, b) => b.chips - a.chips);
        } else {
            gameState.players.push(updatedPlayer);
        }
        io.emit('updateState', gameState);
    });

    socket.on('addExtra', (type) => {
        if (gameState.currentLevel <= 6) { // Solo fino alla fine della pausa
            if (type === 'rebuy') gameState.rebuys++;
            if (type === 'addon') gameState.addons++;
            io.emit('updateState', gameState);
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server attivo su porta ${PORT}`));