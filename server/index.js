const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const { generateMap, isWallPosition } = require('./generateMap');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3000;

// --- 중앙 집중식 게임 설정 ---
const gameConfig = {
  MAP_WIDTH: 6000,
  MAP_HEIGHT: 6000,
  TILE_SIZE: 50,
  SPAWN_WIDTH: 300,
  PLAZA_SIZE: 1500,
  get PLAZA_X() { return (this.MAP_WIDTH - this.PLAZA_SIZE) / 2 },
  get PLAZA_Y() { return (this.MAP_HEIGHT - this.PLAZA_SIZE) / 2 },
  WALL_REMOVAL_RATIO: 0.5
};

// 미들웨어
app.use(cors());
app.use(express.json());

// 프로덕션 환경에서만 정적 파일 서빙
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../dist')));
}

// 게임 상태 관리
const gameState = {
  players: new Map(),
  enemies: new Map(),
  rooms: new Map(),
  mapData: null
};

// ... (ServerPlayer, ServerEnemy 클래스 및 기타 소켓 핸들러는 이전과 동일)
// 플레이어 클래스
class ServerPlayer {
  constructor(id, x, y, team) {
    this.id = id;
    this.x = x;
    this.y = y;
    this.team = team;
    this.level = 1;
    this.exp = 0;
    this.expToNext = 100;
    this.maxHp = 100;
    this.hp = this.maxHp;
    this.speed = 200;
    this.attack = 20;
    this.defense = 10;
    this.jobClass = 'slime';
    this.direction = 'front';
    this.isJumping = false;
    this.size = 64;
    this.visionRange = 300;
    this.lastUpdate = Date.now();
  }

  update(data) {
    this.x = data.x;
    this.y = data.y;
    this.direction = data.direction;
    this.isJumping = data.isJumping;
    this.lastUpdate = Date.now();
  }

  getState() {
    return {
      id: this.id,
      x: this.x,
      y: this.y,
      team: this.team,
      level: this.level,
      hp: this.hp,
      maxHp: this.maxHp,
      jobClass: this.jobClass,
      direction: this.direction,
      isJumping: this.isJumping,
      size: this.size,
      attack: this.attack,
      defense: this.defense,
      speed: this.speed,
      nickname: this.nickname || 'Player'
    };
  }
}

// 적 클래스
class ServerEnemy {
  constructor(id, x, y, type) {
    this.id = id;
    this.x = x;
    this.y = y;
    this.type = type;
    this.hp = 50;
    this.maxHp = 50;
    this.attack = 15;
    this.speed = 50;
    this.lastUpdate = Date.now();
    
    // AI 관련
    this.target = null;
    this.aggroRange = 200;
    this.attackRange = 60;
    this.lastAttack = 0;
    this.attackCooldown = 1500;
    
    // 이동 관련
    this.vx = 0;
    this.vy = 0;
    this.wanderDirection = Math.random() * Math.PI * 2;
    this.wanderChangeTime = Date.now() + Math.random() * 3000 + 2000;
  }
  
  update(players, delta) {
    const now = Date.now();
    this.lastUpdate = now;
    
    this.findTarget(players);
    
    if (this.target) {
      this.chaseTarget(delta);
    } else {
      this.wander(delta, now);
    }
    
    this.x += this.vx * delta / 1000;
    this.y += this.vy * delta / 1000;
    
    this.checkBounds();
  }
  
  findTarget(players) {
    let closestPlayer = null;
    let closestDistance = this.aggroRange;
    
    for (const player of players.values()) {
      const dx = player.x - this.x;
      const dy = player.y - this.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance < closestDistance) {
        closestPlayer = player;
        closestDistance = distance;
      }
    }
    
    this.target = closestPlayer;
  }
  
  chaseTarget(delta) {
    if (!this.target) return;
    
    const dx = this.target.x - this.x;
    const dy = this.target.y - this.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance > this.aggroRange) {
      this.target = null;
      this.vx = 0;
      this.vy = 0;
      return;
    }
    
    if (distance > this.attackRange) {
      this.vx = (dx / distance) * this.speed;
      this.vy = (dy / distance) * this.speed;
    } else {
      this.vx = 0;
      this.vy = 0;
      this.tryAttack();
    }
  }
  
  wander(delta, now) {
    if (now > this.wanderChangeTime) {
      this.wanderDirection = Math.random() * Math.PI * 2;
      this.wanderChangeTime = now + Math.random() * 3000 + 2000;
    }
    
    const wanderSpeed = this.speed * 0.3;
    this.vx = Math.cos(this.wanderDirection) * wanderSpeed;
    this.vy = Math.sin(this.wanderDirection) * wanderSpeed;
  }
  
  tryAttack() {
    const now = Date.now();
    if (now - this.lastAttack > this.attackCooldown && this.target) {
      this.lastAttack = now;
      this.isAttacking = true;
      return true;
    }
    return false;
  }
  
  checkBounds() {
    if (this.x < 50) {
      this.x = 50;
      this.vx = Math.abs(this.vx);
    }
    if (this.x > gameConfig.MAP_WIDTH - 50) {
      this.x = gameConfig.MAP_WIDTH - 50;
      this.vx = -Math.abs(this.vx);
    }
    if (this.y < 50) {
      this.y = 50;
      this.vy = Math.abs(this.vy);
    }
    if (this.y > gameConfig.MAP_HEIGHT - 50) {
      this.y = gameConfig.MAP_HEIGHT - 50;
      this.vy = -Math.abs(this.vy);
    }
  }

  getState() {
    const state = {
      id: this.id,
      x: this.x,
      y: this.y,
      type: this.type,
      hp: this.hp,
      maxHp: this.maxHp,
      vx: this.vx,
      vy: this.vy
    };
    
    if (this.isAttacking) {
      state.isAttacking = true;
      this.isAttacking = false;
    }
    
    return state;
  }
}

// 소켓 연결 처리
io.on('connection', (socket) => {
    // ... (내용은 이전과 동일하므로 생략)
    console.log(`\n=== 새로운 소켓 연결: ${socket.id} ===`);
    console.log(`현재 연결된 플레이어 수: ${gameState.players.size}`);
  
    // 플레이어 입장
    socket.on('join-game', (data) => {
      const timestamp = Date.now();
      console.log(`\n[${timestamp}] [${socket.id}] join-game 요청 받음:`, data);
      const playerId = socket.id;
      
      if (gameState.players.has(playerId)) {
        console.log(`[${timestamp}] [${playerId}] 이미 게임에 입장함, 중복 요청 무시`);
        const existingPlayer = gameState.players.get(playerId);
        socket.emit('game-joined', {
          playerId: playerId,
          playerData: existingPlayer.getState(),
          players: Array.from(gameState.players.values()).map(p => p.getState()),
          enemies: Array.from(gameState.enemies.values()).map(e => e.getState()),
          mapData: gameState.mapData
        });
        return;
      }
      
      console.log(`[${timestamp}] [${playerId}] 새 플레이어 생성 시작`);
      const team = getPlayerTeam();
      const spawnPoint = getSpawnPoint(team);
      const nickname = data.nickname || `Player${Math.floor(Math.random() * 1000)}`;
      
      const player = new ServerPlayer(playerId, spawnPoint.x, spawnPoint.y, team);
      player.nickname = nickname;
      
      if (gameState.players.has(playerId)) {
        console.log(`[${timestamp}] [${playerId}] 경고: 플레이어 생성 중 중복 발견, 처리 중단`);
        return;
      }
      
      gameState.players.set(playerId, player);
  
      const gameJoinedData = {
        playerId: playerId,
        playerData: player.getState(),
        players: Array.from(gameState.players.values()).map(p => p.getState()),
        enemies: Array.from(gameState.enemies.values()).map(e => e.getState()),
        mapData: gameState.mapData
      };
      
      socket.emit('game-joined', gameJoinedData);
  
      socket.broadcast.emit('player-joined', player.getState());
  
      console.log(`[${timestamp}] [${playerId}] 게임 입장 처리 완료`);
      console.log(`[${timestamp}] 총 플레이어 수: ${gameState.players.size}`);
    });
  
    socket.on('player-update', (data) => {
      const player = gameState.players.get(socket.id);
      if (player) {
        player.update(data);
        socket.broadcast.emit('player-moved', {
          id: socket.id,
          x: player.x,
          y: player.y,
          direction: player.direction,
          isJumping: player.isJumping,
          jobClass: player.jobClass,
          level: player.level,
          size: player.size
        });
      }
    });
  
    socket.on('player-job-change', (data) => {
      const player = gameState.players.get(socket.id);
      if (player) {
        player.jobClass = data.jobClass;
        io.emit('player-job-changed', {
          id: socket.id,
          jobClass: data.jobClass
        });
      }
    });
  
    socket.on('player-skill', (data) => {
      const player = gameState.players.get(socket.id);
      if (player) {
        io.emit('player-skill-used', {
          playerId: socket.id,
          skillType: data.skillType,
          x: player.x,
          y: player.y
        });
      }
    });
  
    socket.on('enemy-hit', (data) => {
      const enemy = gameState.enemies.get(data.enemyId);
      const player = gameState.players.get(socket.id);
      
      if (enemy && player) {
        enemy.hp -= player.attack;
        
        if (enemy.hp <= 0) {
          gameState.enemies.delete(data.enemyId);
          player.exp += 25;
          
          if (player.exp >= player.expToNext) {
            player.level++;
            player.exp -= player.expToNext;
            player.expToNext = Math.floor(player.expToNext * 1.2);
            player.maxHp += 20;
            player.hp = player.maxHp;
            player.attack += 5;
            player.defense += 2;
            player.speed += 10;
            
            io.emit('player-level-up', {
              playerId: socket.id,
              level: player.level
            });
          }
          
          io.emit('enemy-destroyed', { enemyId: data.enemyId });
          setTimeout(() => spawnEnemy(), 2000);
        } else {
          io.emit('enemy-damaged', {
            enemyId: data.enemyId,
            hp: enemy.hp,
            maxHp: enemy.maxHp
          });
        }
      }
    });
  
    // 치트: 리스폰 (자살)
    socket.on('cheat-respawn', () => {
      const player = gameState.players.get(socket.id);
      if (player) {
        console.log(`치트 리스폰: ${socket.id}`);
        
        // 새로운 스폰 지점 계산
        const spawnPoint = getSpawnPoint(player.team);
        player.x = spawnPoint.x;
        player.y = spawnPoint.y;
        player.hp = player.maxHp; // 체력 완전 회복
        
        // 클라이언트에게 리스폰 알림
        socket.emit('game-joined', {
          playerId: socket.id,
          playerData: player.getState(),
          players: Array.from(gameState.players.values()).map(p => p.getState()),
          enemies: Array.from(gameState.enemies.values()).map(e => e.getState()),
          mapData: gameState.mapData
        });
        
        // 다른 플레이어들에게 위치 업데이트 전송
        socket.broadcast.emit('player-moved', {
          id: socket.id,
          x: player.x,
          y: player.y,
          direction: player.direction,
          isJumping: player.isJumping,
          jobClass: player.jobClass,
          level: player.level,
          size: player.size
        });
      }
    });

    // 게임 상태 동기화 요청 (탭 포커스 복원 시)
    socket.on('request-game-sync', () => {
      const player = gameState.players.get(socket.id);
      if (player) {
        console.log(`게임 상태 동기화 요청: ${socket.id}`);
        
        // 현재 게임 상태를 클라이언트에게 전송
        socket.emit('game-synced', {
          players: Array.from(gameState.players.values()).map(p => p.getState()),
          enemies: Array.from(gameState.enemies.values()).map(e => e.getState()),
          timestamp: Date.now()
        });
      }
    });

    socket.on('disconnect', () => {
      console.log(`플레이어 연결 해제: ${socket.id}`);
      gameState.players.delete(socket.id);
      socket.broadcast.emit('player-left', { playerId: socket.id });
    });
});

// 유틸리티 함수들
function getPlayerTeam() {
  const players = Array.from(gameState.players.values());
  const redCount = players.filter(p => p.team === 'red').length;
  const blueCount = players.filter(p => p.team === 'blue').length;
  return redCount <= blueCount ? 'red' : 'blue';
}

function getSpawnPoint(team) {
  const { MAP_WIDTH, MAP_HEIGHT, SPAWN_WIDTH, TILE_SIZE } = gameConfig;
  if (team === 'red') {
    return {
      x: Math.random() * (SPAWN_WIDTH - TILE_SIZE * 2) + TILE_SIZE,
      y: Math.random() * (MAP_HEIGHT - TILE_SIZE * 2) + TILE_SIZE
    };
  } else {
    return {
      x: MAP_WIDTH - Math.random() * (SPAWN_WIDTH - TILE_SIZE * 2) - TILE_SIZE,
      y: Math.random() * (MAP_HEIGHT - TILE_SIZE * 2) + TILE_SIZE
    };
  }
}

function spawnEnemy() {
  const { MAP_WIDTH, MAP_HEIGHT, SPAWN_WIDTH } = gameConfig;
  const enemyTypes = ['basic', 'fast', 'tank', 'ranged'];
  const type = enemyTypes[Math.floor(Math.random() * enemyTypes.length)];
  const enemyId = uuidv4();
  
  let x, y;
  let attempts = 0;
  do {
    x = Math.random() * (MAP_WIDTH - SPAWN_WIDTH * 2) + SPAWN_WIDTH;
    y = Math.random() * MAP_HEIGHT;
    attempts++;
  } while (attempts < 10 && isWallPosition(x, y, gameState.mapData));
  
  const enemy = new ServerEnemy(enemyId, x, y, type);
  gameState.enemies.set(enemyId, enemy);
  
  io.emit('enemy-spawned', enemy.getState());
}

function initializeEnemies() {
  for (let i = 0; i < 10; i++) {
    spawnEnemy();
  }
}

function gameLoop() {
  const now = Date.now();
  const deltaTime = 50;
  
  for (const [id, player] of gameState.players) {
    if (now - player.lastUpdate > 300000) {
      gameState.players.delete(id);
      io.emit('player-left', { playerId: id });
    }
  }
  
  const enemyUpdates = [];
  for (const [id, enemy] of gameState.enemies) {
    enemy.update(gameState.players, deltaTime);
    enemyUpdates.push(enemy.getState());
  }
  
  if (enemyUpdates.length > 0) {
    io.emit('enemies-update', enemyUpdates);
  }
}

// 서버 시작
server.listen(PORT, () => {
  console.log(`서버가 포트 ${PORT}에서 실행 중입니다.`);
  
  gameState.mapData = generateMap(gameConfig);
  initializeEnemies();
  setInterval(gameLoop, 50);
});

// 프로덕션/개발 환경 라우팅
if (process.env.NODE_ENV === 'production') {
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../dist/index.html'));
  });
} else {
  app.get('/', (req, res) => {
    res.json({ 
      message: '개발 모드입니다. 클라이언트는 http://localhost:5173에서 실행하세요.',
      server: 'RPG Slime Multiplayer Server',
      status: 'running'
    });
  });
}