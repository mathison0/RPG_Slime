const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3000;

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
  rooms: new Map(), // 나중에 방 시스템 확장 가능
  mapData: null // 공통 맵 데이터
};

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
      size: this.size
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
  }

  getState() {
    return {
      id: this.id,
      x: this.x,
      y: this.y,
      type: this.type,
      hp: this.hp,
      maxHp: this.maxHp
    };
  }
}

// 소켓 연결 처리
io.on('connection', (socket) => {
  console.log(`플레이어 연결: ${socket.id}`);

  // 플레이어 입장
  socket.on('join-game', (data) => {
    const playerId = socket.id;
    const team = getPlayerTeam();
    const spawnPoint = getSpawnPoint(team);
    
    const player = new ServerPlayer(playerId, spawnPoint.x, spawnPoint.y, team);
    gameState.players.set(playerId, player);

    // 본인에게 게임 상태 전송 (맵 데이터 포함)
    socket.emit('game-joined', {
      playerId: playerId,
      playerData: player.getState(),
      players: Array.from(gameState.players.values()).map(p => p.getState()),
      enemies: Array.from(gameState.enemies.values()).map(e => e.getState()),
      mapData: gameState.mapData // 맵 데이터 추가
    });

    // 다른 플레이어들에게 새 플레이어 알림
    socket.broadcast.emit('player-joined', player.getState());

    console.log(`플레이어 ${playerId} 게임 입장 (팀: ${team})`);
  });

  // 플레이어 위치 업데이트
  socket.on('player-update', (data) => {
    const player = gameState.players.get(socket.id);
    if (player) {
      player.update(data);
      
      // 다른 플레이어들에게 위치 업데이트 브로드캐스트
      socket.broadcast.emit('player-moved', {
        id: socket.id,
        x: player.x,
        y: player.y,
        direction: player.direction,
        isJumping: player.isJumping
      });
    }
  });

  // 플레이어 스킬 사용
  socket.on('player-skill', (data) => {
    const player = gameState.players.get(socket.id);
    if (player) {
      // 스킬 효과를 모든 플레이어에게 브로드캐스트
      io.emit('player-skill-used', {
        playerId: socket.id,
        skillType: data.skillType,
        x: player.x,
        y: player.y
      });
    }
  });

  // 적과의 충돌
  socket.on('enemy-hit', (data) => {
    const enemy = gameState.enemies.get(data.enemyId);
    const player = gameState.players.get(socket.id);
    
    if (enemy && player) {
      enemy.hp -= player.attack;
      
      if (enemy.hp <= 0) {
        gameState.enemies.delete(data.enemyId);
        player.exp += 25;
        
        // 경험치 업데이트
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
        
        // 적 제거
        io.emit('enemy-destroyed', { enemyId: data.enemyId });
        
        // 새 적 스폰
        setTimeout(() => spawnEnemy(), 2000);
      } else {
        // 적 HP 업데이트
        io.emit('enemy-damaged', {
          enemyId: data.enemyId,
          hp: enemy.hp,
          maxHp: enemy.maxHp
        });
      }
    }
  });

  // 플레이어 연결 해제
  socket.on('disconnect', () => {
    console.log(`플레이어 연결 해제: ${socket.id}`);
    
    gameState.players.delete(socket.id);
    
    // 다른 플레이어들에게 플레이어 퇴장 알림
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
  const MAP_WIDTH = 3000;
  const MAP_HEIGHT = 3000;
  const SPAWN_WIDTH = 300;
  const TILE_SIZE = 50;
  
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
  const enemyTypes = ['basic', 'fast', 'tank', 'ranged'];
  const type = enemyTypes[Math.floor(Math.random() * enemyTypes.length)];
  const enemyId = uuidv4();
  
  const MAP_WIDTH = 3000;
  const MAP_HEIGHT = 3000;
  const SPAWN_WIDTH = 300;
  
  let x, y;
  let attempts = 0;
  do {
    x = Math.random() * (MAP_WIDTH - SPAWN_WIDTH * 2) + SPAWN_WIDTH;
    y = Math.random() * MAP_HEIGHT;
    attempts++;
  } while (attempts < 10 && isWallPosition(x, y)); // 벽 위치 체크
  
  const enemy = new ServerEnemy(enemyId, x, y, type);
  gameState.enemies.set(enemyId, enemy);
  
  io.emit('enemy-spawned', enemy.getState());
}

// 초기 적 스폰
function initializeEnemies() {
  for (let i = 0; i < 10; i++) {
    spawnEnemy();
  }
}

// 게임 루프 (필요시)
function gameLoop() {
  // 비활성 플레이어 정리 (5분 이상 업데이트 없음)
  const now = Date.now();
  for (const [id, player] of gameState.players) {
    if (now - player.lastUpdate > 300000) { // 5분
      gameState.players.delete(id);
      io.emit('player-left', { playerId: id });
    }
  }
}

// 맵 생성 함수
function generateMap() {
  const MAP_WIDTH = 3000;
  const MAP_HEIGHT = 3000;
  const TILE_SIZE = 50;
  const SPAWN_WIDTH = 300;
  const PLAZA_SIZE = 1000;
  const PLAZA_X = (MAP_WIDTH - PLAZA_SIZE) / 2;
  const PLAZA_Y = (MAP_HEIGHT - PLAZA_SIZE) / 2;

  console.log('서버에서 맵 생성 중...');

  // 맵 기본 정보
  const mapData = {
    MAP_WIDTH,
    MAP_HEIGHT,
    TILE_SIZE,
    SPAWN_WIDTH,
    PLAZA_SIZE,
    PLAZA_X,
    PLAZA_Y,
    walls: [],
    redSpawnRect: { x: 0, y: 0, width: SPAWN_WIDTH, height: MAP_HEIGHT },
    blueSpawnRect: { x: MAP_WIDTH - SPAWN_WIDTH, y: 0, width: SPAWN_WIDTH, height: MAP_HEIGHT },
    plazaRect: { x: PLAZA_X, y: PLAZA_Y, width: PLAZA_SIZE, height: PLAZA_SIZE }
  };

  // 외벽 생성
  for (let x = 0; x < MAP_WIDTH; x += TILE_SIZE) {
    mapData.walls.push({ x: x + TILE_SIZE / 2, y: TILE_SIZE / 2 });
    mapData.walls.push({ x: x + TILE_SIZE / 2, y: MAP_HEIGHT - TILE_SIZE / 2 });
  }
  for (let y = TILE_SIZE; y < MAP_HEIGHT - TILE_SIZE; y += TILE_SIZE) {
    mapData.walls.push({ x: TILE_SIZE / 2, y: y + TILE_SIZE / 2 });
    mapData.walls.push({ x: MAP_WIDTH - TILE_SIZE / 2, y: y + TILE_SIZE / 2 });
  }

  // 광장 테두리 벽 생성
  const borderPositions = [];
  for (let x = PLAZA_X; x < PLAZA_X + PLAZA_SIZE; x += TILE_SIZE) {
    borderPositions.push({ x: x + TILE_SIZE / 2, y: PLAZA_Y - TILE_SIZE / 2 });
    borderPositions.push({ x: x + TILE_SIZE / 2, y: PLAZA_Y + PLAZA_SIZE + TILE_SIZE / 2 });
  }
  for (let y = PLAZA_Y; y < PLAZA_Y + PLAZA_SIZE; y += TILE_SIZE) {
    borderPositions.push({ x: PLAZA_X - TILE_SIZE / 2, y: y + TILE_SIZE / 2 });
    borderPositions.push({ x: PLAZA_X + PLAZA_SIZE + TILE_SIZE / 2, y: y + TILE_SIZE / 2 });
  }

  // 랜덤 오프닝 생성 (고정 시드 사용)
  const openings = new Set();
  const openingCount = 10;
  for (let i = 0; i < openingCount; i++) {
    const randomIndex = Math.floor(Math.random() * borderPositions.length);
    const pos = borderPositions[randomIndex];
    openings.add(`${pos.x}_${pos.y}`);
  }

  borderPositions.forEach(pos => {
    if (!openings.has(`${pos.x}_${pos.y}`)) {
      mapData.walls.push(pos);
    }
  });

  // 미로 생성 (고정 시드 사용)
  const borderSet = new Set(borderPositions.map(p => `${p.x}_${p.y}`));
  for (let x = SPAWN_WIDTH; x < MAP_WIDTH - SPAWN_WIDTH; x += TILE_SIZE) {
    for (let y = 0; y < MAP_HEIGHT; y += TILE_SIZE) {
      const centerX = x + TILE_SIZE / 2;
      const centerY = y + TILE_SIZE / 2;
      
      // 광장이나 테두리 위치가 아닌 곳에만 벽 생성
      if (!isInPlaza(centerX, centerY, PLAZA_X, PLAZA_Y, PLAZA_SIZE) && 
          !borderSet.has(`${centerX}_${centerY}`)) {
        
        // 고정된 패턴으로 벽 생성 (완전 랜덤 대신)
        const wallProbability = 0.3;
        const hash = simpleHash(x + y * MAP_WIDTH); // 위치 기반 해시
        if ((hash % 100) / 100 < wallProbability) {
          mapData.walls.push({ x: centerX, y: centerY });
        }
      }
    }
  }

  console.log(`맵 생성 완료: 벽 ${mapData.walls.length}개`);
  return mapData;
}

// 간단한 해시 함수 (결정적 랜덤)
function simpleHash(num) {
  num = ((num >> 16) ^ num) * 0x45d9f3b;
  num = ((num >> 16) ^ num) * 0x45d9f3b;
  num = (num >> 16) ^ num;
  return Math.abs(num);
}

// 광장 내부인지 확인
function isInPlaza(x, y, plazaX, plazaY, plazaSize) {
  return x >= plazaX && x < plazaX + plazaSize && 
         y >= plazaY && y < plazaY + plazaSize;
}

// 벽 위치인지 확인
function isWallPosition(x, y) {
  if (!gameState.mapData) return false;
  
  const TILE_SIZE = gameState.mapData.TILE_SIZE;
  return gameState.mapData.walls.some(wall => {
    const dx = Math.abs(wall.x - x);
    const dy = Math.abs(wall.y - y);
    return dx < TILE_SIZE && dy < TILE_SIZE;
  });
}

// 서버 시작
server.listen(PORT, () => {
  console.log(`서버가 포트 ${PORT}에서 실행 중입니다.`);
  
  // 맵 생성 (서버 시작시 한 번만)
  gameState.mapData = generateMap();
  
  // 적 초기화
  initializeEnemies();
  
  // 게임 루프 시작 (30초마다)
  setInterval(gameLoop, 30000);
});

// 프로덕션에서 클라이언트 서빙
if (process.env.NODE_ENV === 'production') {
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../dist/index.html'));
  });
} else {
  // 개발 환경에서는 기본 응답
  app.get('/', (req, res) => {
    res.json({ 
      message: '개발 모드입니다. 클라이언트는 http://localhost:5173에서 실행하세요.',
      server: 'RPG Slime Multiplayer Server',
      status: 'running'
    });
  });
} 