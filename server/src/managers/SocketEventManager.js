const ServerUtils = require('../utils/ServerUtils');

/**
 * 소켓 이벤트 관리 매니저
 */
class SocketEventManager {
  constructor(io, gameStateManager, enemyManager) {
    this.io = io;
    this.gameStateManager = gameStateManager;
    this.enemyManager = enemyManager;
  }

  /**
   * 소켓 이벤트 리스너 설정
   */
  setupSocketEvents() {
    this.io.on('connection', (socket) => {
      console.log(`\n=== 새로운 소켓 연결: ${socket.id} ===`);
      console.log(`현재 연결된 플레이어 수: ${this.gameStateManager.players.size}`);

      // 각 이벤트 핸들러 등록
      this.setupJoinGameHandler(socket);
      this.setupPlayerUpdateHandler(socket);
      this.setupPlayerJobChangeHandler(socket);
      this.setupPlayerSkillHandler(socket);
      this.setupPlayerPingHandler(socket);
      this.setupEnemyHitHandler(socket);
      this.setupGameSyncHandler(socket);
      this.setupDisconnectHandler(socket);
    });
  }

  /**
   * 게임 입장 이벤트 핸들러
   */
  setupJoinGameHandler(socket) {
    socket.on('join-game', (data) => {
      const timestamp = Date.now();
      console.log(`\n[${timestamp}] [${socket.id}] join-game 요청 받음:`, data);
      const playerId = socket.id;
      
      // 기존 플레이어 체크
      if (this.gameStateManager.players.has(playerId)) {
        console.log(`[${timestamp}] [${playerId}] 이미 게임에 입장함, 중복 요청 무시`);
        const existingPlayer = this.gameStateManager.getPlayer(playerId);
        socket.emit('game-joined', {
          playerId: playerId,
          playerData: existingPlayer.getState(),
          players: this.gameStateManager.getPlayersState(),
          enemies: this.gameStateManager.getEnemiesState(),
          mapData: this.gameStateManager.mapData
        });
        return;
      }
      
      console.log(`[${timestamp}] [${playerId}] 새 플레이어 생성 시작`);
      
      // 팀 결정 및 스폰 지점 계산
      const team = this.gameStateManager.getBalancedTeam();
      const spawnPoint = ServerUtils.getSpawnPoint(team);
      const nickname = data.nickname || `Player${Math.floor(Math.random() * 1000)}`;
      
      // 플레이어 생성
      const player = this.gameStateManager.addPlayer(playerId, spawnPoint.x, spawnPoint.y, team, nickname);
      
      // 게임 참가 응답
      const gameJoinedData = {
        playerId: playerId,
        playerData: player.getState(),
        players: this.gameStateManager.getPlayersState(),
        enemies: this.gameStateManager.getEnemiesState(),
        mapData: this.gameStateManager.mapData
      };
      
      socket.emit('game-joined', gameJoinedData);
      socket.broadcast.emit('player-joined', player.getState());

      console.log(`[${timestamp}] [${playerId}] 게임 입장 처리 완료`);
      console.log(`[${timestamp}] 총 플레이어 수: ${this.gameStateManager.players.size}`);
    });
  }

  /**
   * 플레이어 업데이트 이벤트 핸들러
   */
  setupPlayerUpdateHandler(socket) {
    socket.on('player-update', (data) => {
      const player = this.gameStateManager.getPlayer(socket.id);
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
  }

  /**
   * 플레이어 직업 변경 이벤트 핸들러
   */
  setupPlayerJobChangeHandler(socket) {
    socket.on('player-job-change', (data) => {
      const player = this.gameStateManager.getPlayer(socket.id);
      if (player) {
        player.changeJob(data.jobClass);
        this.io.emit('player-job-changed', {
          id: socket.id,
          jobClass: data.jobClass
        });
      }
    });
  }

  /**
   * 플레이어 스킬 사용 이벤트 핸들러
   */
  setupPlayerSkillHandler(socket) {
    socket.on('player-skill', (data) => {
      const player = this.gameStateManager.getPlayer(socket.id);
      if (player) {
        const broadcastData = {
          playerId: socket.id,
          skillType: data.skillType,
          x: player.x,
          y: player.y,
          team: player.team
        };

        // 추가 데이터 포함 (미사일 궤적 정보 등)
        if (data.startX !== undefined) broadcastData.startX = data.startX;
        if (data.startY !== undefined) broadcastData.startY = data.startY;
        if (data.targetX !== undefined) broadcastData.targetX = data.targetX;
        if (data.targetY !== undefined) broadcastData.targetY = data.targetY;
        if (data.maxRange !== undefined) broadcastData.maxRange = data.maxRange;

        this.io.emit('player-skill-used', broadcastData);
      }
    });
  }

  /**
   * 플레이어 핑 이벤트 핸들러
   */
  setupPlayerPingHandler(socket) {
    socket.on('player-ping', (data) => {
      const player = this.gameStateManager.getPlayer(socket.id);
      if (player) {
        const pingData = {
          playerId: socket.id,
          team: player.team,
          x: data.x,
          y: data.y
        };

        // 같은 팀의 플레이어들에게만 브로드캐스트
        socket.broadcast.emit('player-ping', pingData);
      }
    });
  }

  /**
   * 적 피격 이벤트 핸들러
   */
  setupEnemyHitHandler(socket) {
    socket.on('enemy-hit', (data) => {
      const enemy = this.gameStateManager.getEnemy(data.enemyId);
      const player = this.gameStateManager.getPlayer(socket.id);

      if (enemy && player) {
        const isDead = enemy.takeDamage(player.attack);
        
        if (isDead) {
          // 적 제거 및 경험치 지급
          this.gameStateManager.removeEnemy(data.enemyId);
          const leveledUp = player.gainExp(25); // 적 처치 시 25 경험치
          
          this.io.emit('enemy-destroyed', { enemyId: data.enemyId });
          
          if (leveledUp) {
            this.io.emit('player-level-up', {
              playerId: socket.id,
              level: player.level,
              stats: {
                hp: player.hp,
                maxHp: player.maxHp,
                attack: player.attack,
                defense: player.defense
              }
            });
          }
          
          // 새로운 적 스폰
          this.enemyManager.spawnEnemy();
        } else {
          // 적 데미지 알림
          this.io.emit('enemy-damaged', {
            enemyId: data.enemyId,
            hp: enemy.hp,
            maxHp: enemy.maxHp
          });
        }
      }
    });
  }

  /**
   * 게임 동기화 이벤트 핸들러
   */
  setupGameSyncHandler(socket) {
    socket.on('request-game-sync', () => {
      const player = this.gameStateManager.getPlayer(socket.id);
      if (player) {
        console.log(`게임 상태 동기화 요청: ${socket.id}`);
        
        socket.emit('game-synced', {
          players: this.gameStateManager.getPlayersState(),
          enemies: this.gameStateManager.getEnemiesState(),
          timestamp: Date.now()
        });
      }
    });
  }

  /**
   * 연결 해제 이벤트 핸들러
   */
  setupDisconnectHandler(socket) {
    socket.on('disconnect', () => {
      console.log(`플레이어 연결 해제: ${socket.id}`);
      this.gameStateManager.removePlayer(socket.id);
      socket.broadcast.emit('player-left', { playerId: socket.id });
    });
  }

  /**
   * 서버 통계 정보 브로드캐스트
   */
  broadcastServerStats() {
    const stats = this.gameStateManager.getStats();
    this.io.emit('server-stats', stats);
  }

  /**
   * 특정 팀에게만 메시지 전송
   */
  broadcastToTeam(team, event, data) {
    const teamPlayers = this.gameStateManager.getAllPlayers().filter(p => p.team === team);
    teamPlayers.forEach(player => {
      const socket = this.io.sockets.sockets.get(player.id);
      if (socket) {
        socket.emit(event, data);
      }
    });
  }
}

module.exports = SocketEventManager; 