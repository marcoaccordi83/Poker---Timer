const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

let gameState = {
    timer: 1200, // 20 min iniziali
    isRunning: false,
    currentLevel: 1,
    players: [],
    rebuys: 0,
    addons: 0,
    buyIn: 5,
    isPause: false,
    // Impostazioni Premi
    numPremiati: 3,
    percentuali: [60, 30, 10]
};

function getBlinds(level) {
    const blinds = [
        "25/50", "50/100", "75/150", "100/200", "150/300", // 1-5
        "PAUSA", // 6
        "200/400", "300/600", "400/800", "600/1200", "1000/2000", "1500/3000"
    ];
    return blinds[level - 1] || "ALTI";
}

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
    if (gameState.currentLevel === 6) { 
        gameState.timer = 600; // 10 min pausa
        gameState.isPause = true;
    } else {
        // 20 min fino al 7, poi 15 min dall'8 in poi
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
        if (action === 'resetLevel') {
            gameState.timer = (gameState.currentLevel === 6) ? 600 : (gameState.currentLevel >= 8 ? 900 : 1200);
            gameState.isRunning = false;
        }
        if (action === 'resetAll') {
            gameState.currentLevel = 1;
            gameState.timer = 1200;
            gameState.isRunning = false;
            gameState.rebuys = 0;
            gameState.addons = 0;
            gameState.isPause = false;
            gameState.players = gameState.players.map(p => ({...p, chips: 10000}));
        }
        io.emit('updateState', gameState);
    });

    socket.on('updateRewards', (data) => {
        gameState.numPremiati = data.num;
        gameState.percentuali = data.per;
        io.emit('updateState', gameState);
    });

    socket.on('updatePlayer', (updatedPlayer) => {
        const idx = gameState.players.findIndex(p => p.id === updatedPlayer.id);
        if (idx !== -1) {
            gameState.players[idx] = updatedPlayer;
        } else {
            gameState.players.push(updatedPlayer);
        }
        gameState.players.sort((a, b) => b.chips - a.chips);
        io.emit('updateState', gameState);
    });

    socket.on('addExtra', (type) => {
        if (gameState.currentLevel <= 6) {
            if (type === 'rebuy') gameState.rebuys++;
            if (type === 'addon') gameState.addons++;
            io.emit('updateState', gameState);
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
