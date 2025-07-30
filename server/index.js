const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const cors = require('cors');

// 매니저들과 유틸리티 import
const gameConfig = require('./src/config/GameConfig');
const GameStateManager = require('./src/managers/GameStateManager');
const SocketEventManager = require('./src/managers/SocketEventManager');
const EnemyManager = require('./src/managers/EnemyManager');
const SkillManager = require('./src/managers/SkillManager');
const ProjectileManager = require('./src/managers/ProjectileManager');
const ServerUtils = require('./src/utils/ServerUtils');
const { generateMap } = require('./generateMap');

/**
 * RPG Slime 멀티플레이어 서버
 */
class GameServer {
  constructor() {
    this.app = express();
    this.server = http.createServer(this.app);
    
    // Socket.IO 설정 최적화
    this.io = socketIo(this.server, {
      cors: {
        origin: "*",
        methods: ["GET", "POST"]
      },
      // 연결 최적화 옵션
      pingTimeout: 60000,        // 60초 타임아웃
      pingInterval: 25000,       // 25초마다 핑 체크
      upgradeTimeout: 30000,     // 업그레이드 타임아웃 30초
      allowUpgrades: true,       // 업그레이드 허용
      transports: ['websocket', 'polling'], // WebSocket 우선
      // 압축 설정
      compression: true,
      // 연결 제한
      maxHttpBufferSize: 1e6     // 1MB 버퍼 크기
    });
    
    this.port = process.env.PORT || gameConfig.SERVER.DEFAULT_PORT;
    
    // 매니저들 초기화
    this.gameStateManager = new GameStateManager(this.io);
    this.projectileManager = new ProjectileManager(this.gameStateManager);
    this.skillManager = new SkillManager(this.gameStateManager, this.projectileManager);
    this.gameStateManager.skillManager = this.skillManager; // skillManager 참조 추가
    this.enemyManager = new EnemyManager(this.io, this.gameStateManager);
    this.socketEventManager = new SocketEventManager(this.io, this.gameStateManager, this.enemyManager, this.skillManager, this.projectileManager);
    
    // global.io 설정 - ServerPlayer의 stunned 이벤트 발송을 위해 필요
    global.io = this.io;
    
    // 게임 루프 타이머
    this.gameLoopInterval = null;
    
    // 종료 플래그
    this.isShuttingDown = false;
    
    this.initialize();
  }

  /**
   * 서버 초기화
   */
  initialize() {
    console.log('🎮 RPG Slime 서버 초기화 시작...');
    
    // Express 미들웨어 설정
    this.setupMiddleware();
    
    // 라우팅 설정
    this.setupRoutes();
    
    // 맵 생성
    this.generateGameMap();
    
    // 소켓 이벤트 설정
    this.socketEventManager.setupSocketEvents();
    
    // 적 매니저 초기화
    this.enemyManager.initialize();
    
    // 게임 루프 시작
    this.startGameLoop();
    
    console.log('✅ 서버 초기화 완료');
  }

  /**
   * Express 미들웨어 설정
   */
  setupMiddleware() {
    this.app.use(cors());
    this.app.use(express.json());
    
    // 프로덕션 환경에서만 정적 파일 서빙
    if (process.env.NODE_ENV === 'production') {
      this.app.use(express.static(path.join(__dirname, '../dist')));
    }
  }

  /**
   * 라우팅 설정
   */
  setupRoutes() {
    // API 라우트
    this.app.get('/api/status', (req, res) => {
      res.json({
        server: 'RPG Slime Multiplayer Server',
        status: 'running',
        uptime: process.uptime(),
        players: this.gameStateManager.players.size,
        enemies: this.gameStateManager.enemies.size,
        memory: ServerUtils.getMemoryUsage(),
        timestamp: Date.now()
      });
    });

    this.app.get('/api/stats', (req, res) => {
      res.json(this.gameStateManager.getStats());
    });

    this.app.get('/api/config', (req, res) => {
      res.json({
        mapSize: {
          width: gameConfig.MAP_WIDTH,
          height: gameConfig.MAP_HEIGHT,
          widthTiles: gameConfig.MAP_WIDTH_TILES,
          heightTiles: gameConfig.MAP_HEIGHT_TILES
        },
        tileSize: gameConfig.TILE_SIZE,
        spawnWidth: gameConfig.SPAWN_WIDTH,
        plazaSize: gameConfig.PLAZA_SIZE,
        spawnWidthTiles: gameConfig.SPAWN_WIDTH_TILES,
        plazaSizeTiles: gameConfig.PLAZA_SIZE_TILES
      });
    });

    // 프로덕션/개발 환경 라우팅
    if (process.env.NODE_ENV === 'production') {
      this.app.get('*', (req, res) => {
        res.sendFile(path.join(__dirname, '../dist/index.html'));
      });
    } else {
      this.app.get('/', (req, res) => {
        res.json({ 
          message: '개발 모드입니다. 클라이언트는 http://localhost:5173에서 실행하세요.',
          server: 'RPG Slime Multiplayer Server',
          status: 'running',
          endpoints: {
            status: '/api/status',
            stats: '/api/stats',
            config: '/api/config'
          }
        });
      });
    }
  }

  /**
   * 게임 맵 생성
   */
  generateGameMap() {
    console.log('🗺️  게임 맵 생성 중...');
    const mapData = generateMap(gameConfig);
    this.gameStateManager.setMapData(mapData);
    console.log('✅ 게임 맵 생성 완료');
  }

  /**
   * 게임 루프 시작
   */
  startGameLoop() {
    console.log('🔄 게임 루프 시작...');
    
    this.gameLoopInterval = setInterval(() => {
      this.gameLoop();
    }, gameConfig.SERVER.GAME_LOOP_INTERVAL);
    
    console.log(`✅ 게임 루프 시작됨 (${gameConfig.SERVER.GAME_LOOP_INTERVAL}ms 간격)`);
  }

  /**
   * 게임 루프 중지
   */
  stopGameLoop() {
    if (this.gameLoopInterval) {
      clearInterval(this.gameLoopInterval);
      this.gameLoopInterval = null;
      console.log('🛑 게임 루프 중지됨');
    }
  }

  /**
   * 메인 게임 루프
   */
  gameLoop() {
    try {
      const deltaTime = gameConfig.SERVER.GAME_LOOP_INTERVAL;
      
      // 연결 해제된 플레이어들 정리
      const disconnectedPlayers = this.gameStateManager.cleanupDisconnectedPlayers();
      disconnectedPlayers.forEach(playerId => {
        this.io.emit('player-left', { playerId });
      });
      
      // 몬스터 AI 업데이트
      this.enemyManager.updateMonsters(deltaTime);
      
      // 투사체 업데이트
      this.projectileManager.updateProjectiles(deltaTime);
      
      // 스폰 배리어 데미지 체크
      const damagedPlayers = this.gameStateManager.checkSpawnBarrierDamage();
      if (damagedPlayers.length > 0) {
        damagedPlayers.forEach(damageInfo => {
          this.io.emit('spawn-barrier-damage', damageInfo);
        });
      }
      
      // 플레이어 상태 업데이트 및 사망 처리
      this.updatePlayerStates();
      
      this.syncPlayerStatus();
      
      // 투사체 정보 브로드캐스트
      this.syncProjectiles();
      
    } catch (error) {
      ServerUtils.errorLog('게임 루프 오류', { error: error.message, stack: error.stack });
    }
  }

  /**
   * 플레이어 상태 업데이트 및 사망 처리
   */
  updatePlayerStates() {
    const allPlayers = this.gameStateManager.getAllPlayers();
    
    allPlayers.forEach(player => {
      // HP가 0 이하이고 아직 사망 처리되지 않은 플레이어 처리
      if (player.hp <= 0 && !player.isDead) {
        // HP를 정확히 0으로 설정
        player.hp = 0;
        
        // 사망 플래그 설정
        player.isDead = true;
        
        // 시전 중인 스킬 모두 취소
        this.skillManager.cancelAllCasting(player);
        
        // 사망 원인 판단 (간단한 로직)
        let deathCause = 'unknown';
        let killerId = null;
        let killerType = 'unknown';
        
        // 최근 데미지 소스 추적
        if (player.lastDamageSource) {
          if (player.lastDamageSource.type === 'monster') {
            deathCause = 'monster';
            killerId = player.lastDamageSource.id;
            killerType = 'monster';
          } else if (player.lastDamageSource.type === 'spawn-barrier') {
            deathCause = 'spawn-barrier';
            killerType = 'environment';
          } else if (player.lastDamageSource.type === 'suicide') {
            deathCause = 'suicide';
            killerType = 'cheat';
          }
        }
        
        // 사망 이벤트 전송 (통합된 이벤트 사용)
        this.io.emit('player-died', {
          playerId: player.id,
          cause: deathCause,
          killerId: killerId,
          killerType: killerType
        });
        
        console.log(`플레이어 사망 처리: ${player.id} (원인: ${deathCause})`);
      }
    });
  }

  /**
   * 투사체 정보 동기화
   */
  syncProjectiles() {
    const allProjectiles = this.projectileManager.getAllProjectiles();
    if (allProjectiles.length > 0) {
      this.io.emit('projectiles-update', {
        projectiles: allProjectiles,
        timestamp: Date.now()
      });
    }
  }

  /**
   * 플레이어 상태 동기화
   */
  syncPlayerStatus() {
    const players = this.gameStateManager.getAllPlayers();
    if (players.length > 0) {
      const playerStates = players.map(player => {
        // 스킬 캐스팅 중인지 확인 (시전중 + 발동중 + 후딜레이중)
        const isCasting = this.skillManager.isCasting(player);
        
        // 기본 상태 정보
        const state = {
          id: player.id,
          x: player.x,
          y: player.y,
          hp: player.hp,
          maxHp: player.maxHp,
          level: player.level,
          // 경험치 정보 추가
          exp: player.exp,
          expToNext: player.expToNext,
          jobClass: player.jobClass,
          team: player.team,
          size: player.size,
          // 전체 스탯 정보 추가
          stats: {
            attack: player.attack,
            speed: player.speed,
            visionRange: player.visionRange
          },
          // 직업 정보 추가
          jobInfo: {
            name: this.getJobName(player.jobClass)
          },
          // 스킬 쿨타임 정보 추가
          skillCooldowns: this.getPlayerSkillCooldowns(player),
          // 활성 효과들
          activeEffects: Array.from(player.activeEffects || []),
          // 은신 상태
          isStealth: player.isStealth || false,
          // 스킬 시전 중 여부 (시전시간이 있는 스킬들만)
          isCasting: isCasting,
          // 네트워크 핑 계산을 위한 타임스탬프 추가
          timestamp: Date.now()
        };
        
        return state;
      });
      
      this.io.emit('players-state-update', playerStates);
    }
  }

  /**
   * 직업명 조회
   */
  getJobName(jobClass) {
    const { getJobInfo } = require('./shared/JobClasses');
    const jobInfo = getJobInfo(jobClass);
    return jobInfo ? jobInfo.name : jobClass;
  }

  /**
   * 직업 설명 조회
   */
  getJobDescription(jobClass) {
    const { getJobInfo } = require('./shared/JobClasses');
    const jobInfo = getJobInfo(jobClass);
    return jobInfo ? jobInfo.description : '';
  }

  /**
   * 플레이어의 스킬 쿨타임 정보 조회
   */
  getPlayerSkillCooldowns(player) {
    // ServerPlayer의 getClientSkillCooldowns 메서드 사용
    return player.getClientSkillCooldowns();
  }

  /**
   * 서버 시작
   */
  start() {
    this.server.listen(this.port, '0.0.0.0', () => {
      console.log(`\n🚀 서버가 포트 ${this.port}에서 실행 중입니다.`);
      console.log(`📊 현재 설정:`);
      console.log(`   - 맵 크기: ${gameConfig.MAP_WIDTH_TILES}x${gameConfig.MAP_HEIGHT_TILES} 타일 (${gameConfig.MAP_WIDTH}x${gameConfig.MAP_HEIGHT} 픽셀)`);
      console.log(`   - 최대 적 수: ${gameConfig.ENEMY.MAX_COUNT}`);
      console.log(`   - 게임 루프: ${gameConfig.SERVER.GAME_LOOP_INTERVAL}ms`);
      console.log(`   - 환경: ${process.env.NODE_ENV || 'development'}`);
      
      if (process.env.NODE_ENV !== 'production') {
        console.log(`\n🌐 개발 모드 접속:`);
        console.log(`   - 클라이언트: http://192.168.0.225:5173`);
        console.log(`   - 서버 상태: http://192.168.0.225:${this.port}/api/status`);
        console.log(`   - 서버 통계: http://192.168.0.225:${this.port}/api/stats`);
      }
      
      console.log(`\n⚡ 서버 준비 완료! 플레이어 접속 대기 중...\n`);
    });
  }

  /**
   * 서버 종료 처리
   */
  shutdown() {
    console.log('\n🛑 서버 종료 중...');
    
    // 이미 종료 중인 경우 무시
    if (this.isShuttingDown) {
      console.log('⚠️  이미 종료 진행 중입니다.');
      return;
    }
    
    this.isShuttingDown = true;
    
    // 강제 종료 타이머 (10초 후 강제 종료)
    const forceExitTimer = setTimeout(() => {
      console.log('🚨 강제 종료 실행 (10초 타임아웃)');
      process.exit(1);
    }, 10000);
    
    try {
      // 게임 루프 중지
      this.stopGameLoop();
      
      // readline 인터페이스 정리 (개발 모드)
      if (process.env.NODE_ENV !== 'production' && global.adminReadline) {
        global.adminReadline.close();
      }
      
      // 모든 플레이어에게 서버 종료 알림
      this.io.emit('server-shutdown', { 
        message: '서버가 종료됩니다.',
        timestamp: Date.now()
      });
      
      // Socket.IO 서버 정리
      this.io.close((err) => {
        if (err) {
          console.error('Socket.IO 종료 오류:', err);
        } else {
          console.log('Socket.IO 서버 정리 완료');
        }
      });
      
      // 매니저들 정리
      if (this.enemyManager) {
        this.enemyManager.destroy();
      }
      
      if (this.gameStateManager) {
        this.gameStateManager.reset();
      }
      
      // 서버 종료
      this.server.close((err) => {
        if (err) {
          console.error('서버 종료 오류:', err);
        } else {
          console.log('✅ 서버 종료 완료');
        }
        
        // 강제 종료 타이머 취소
        clearTimeout(forceExitTimer);
        
        // 프로세스 종료
        setTimeout(() => {
          process.exit(0);
        }, 500); // 500ms 대기 후 종료
      });
      
    } catch (error) {
      console.error('종료 처리 중 오류:', error);
      clearTimeout(forceExitTimer);
      process.exit(1);
    }
  }

  /**
   * 관리자 명령어 처리
   */
  handleAdminCommand(command, args = []) {
    switch (command) {
      case 'stats':
        console.log('📊 서버 통계:', this.gameStateManager.getStats());
        break;
      case 'memory':
        console.log('💾 메모리 사용량:', ServerUtils.getMemoryUsage());
        break;
      case 'players':
        console.log('👥 플레이어 목록:', this.gameStateManager.getPlayersState());
        break;
      case 'monsters':
        console.log('👹 몬스터 통계:', this.enemyManager.getMonsterStats());
        break;
      case 'clear-monsters':
        this.enemyManager.clearAllMonsters();
        console.log('🧹 모든 몬스터 제거됨');
        break;
      case 'spawn-monster':
        const type = args[0] || 'basic';
        const x = parseInt(args[1]) || gameConfig.MAP_WIDTH_TILES * gameConfig.TILE_SIZE / 2;
        const y = parseInt(args[2]) || gameConfig.MAP_HEIGHT_TILES * gameConfig.TILE_SIZE / 2;
        const monster = this.enemyManager.spawnMonsterAt(type, x, y);
        console.log(`👹 몬스터 스폰: ${monster ? monster.type : '실패'}`);
        break;
      default:
        console.log('❓ 알 수 없는 명령어:', command);
        console.log('📋 사용 가능한 명령어: stats, memory, players, monsters, clear-monsters, spawn-monster');
    }
  }
}

// 서버 인스턴스 생성 및 시작
const gameServer = new GameServer();

// 우아한 종료 처리
let shutdownInProgress = false;
let sigintCount = 0;

process.on('SIGINT', () => {
  sigintCount++;
  console.log(`\n⚠️  SIGINT 신호 받음... (${sigintCount}번째)`);
  
  if (sigintCount === 1) {
    // 첫 번째 SIGINT: 우아한 종료 시도
    if (!shutdownInProgress) {
      shutdownInProgress = true;
      gameServer.shutdown();
    }
  } else if (sigintCount === 2) {
    // 두 번째 SIGINT: 경고
    console.log('⚠️  다시 Ctrl+C를 누르면 강제 종료됩니다.');
  } else {
    // 세 번째 이상 SIGINT: 강제 종료
    console.log('🚨 강제 종료 실행!');
    process.exit(1);
  }
});

process.on('SIGTERM', () => {
  console.log('\n⚠️  SIGTERM 신호 받음...');
  if (!shutdownInProgress) {
    shutdownInProgress = true;
    gameServer.shutdown();
  }
});

// 예외 처리
process.on('uncaughtException', (error) => {
  ServerUtils.errorLog('처리되지 않은 예외', { error: error.message, stack: error.stack });
  gameServer.shutdown();
});

process.on('unhandledRejection', (reason, promise) => {
  ServerUtils.errorLog('처리되지 않은 Promise 거부', { reason, promise });
});

// 서버 시작
gameServer.start();

// 개발 모드에서 관리자 명령어 지원
if (process.env.NODE_ENV !== 'production') {
  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  // 전역 변수로 저장하여 종료 시 정리할 수 있도록 함
  global.adminReadline = rl;

  console.log('💡 관리자 명령어를 입력하세요 (help 입력 시 도움말):');
  
  rl.on('line', (input) => {
    const [command, ...args] = input.trim().split(' ');
    
    if (command === 'help') {
      console.log('📋 사용 가능한 명령어:');
      console.log('  stats        - 서버 통계 조회');
      console.log('  memory       - 메모리 사용량 조회');
      console.log('  players      - 플레이어 목록 조회');
      console.log('  enemies      - 적 통계 조회');
      console.log('  clear-enemies - 모든 적 제거');
      console.log('  spawn-enemy [type] - 특정 타입 적 스폰');
      console.log('  exit         - 서버 종료');
    } else if (command === 'exit') {
      rl.close();
      gameServer.shutdown();
    } else if (command) {
      gameServer.handleAdminCommand(command, args);
    }
  });
}