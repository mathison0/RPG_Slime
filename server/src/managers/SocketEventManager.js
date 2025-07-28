const ServerUtils = require('../utils/ServerUtils');
const SkillManager = require('./SkillManager');

/**
 * 소켓 이벤트 관리 매니저
 */
class SocketEventManager {
  constructor(io, gameStateManager, enemyManager) {
    this.io = io;
    this.gameStateManager = gameStateManager;
    this.enemyManager = enemyManager;
    this.playerSockets = new Map(); // 플레이어 ID -> 소켓 매핑
    this.skillManager = new SkillManager(gameStateManager);
  }

  /**
   * 소켓 이벤트 리스너 설정
   */
  setupSocketEvents() {
    this.io.on('connection', (socket) => {
      console.log(`\n=== 새로운 소켓 연결: ${socket.id} ===`);
      console.log(`현재 연결된 플레이어 수: ${this.gameStateManager.players.size}`);

      // 소켓을 맵에 저장
      this.playerSockets.set(socket.id, socket);

      // 각 이벤트 핸들러 등록
      this.setupJoinGameHandler(socket);
      this.setupPlayerUpdateHandler(socket);
      this.setupPlayerJobChangeHandler(socket);
      this.setupPlayerSkillHandler(socket);
      this.setupPlayerPingHandler(socket);
      this.setupEnemyHitHandler(socket);
      this.setupGameSyncHandler(socket);
      this.setupPlayerRespawnHandler(socket);
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
          mapData: this.gameStateManager.mapData,
          serverConfig: this.gameConfig // 서버 설정 추가
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
        mapData: this.gameStateManager.mapData,
        serverConfig: this.gameConfig // 서버 설정 추가
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
      if (player && !player.isDead) { // 죽은 플레이어의 업데이트는 무시
        player.update(data);
        
        // 크기 정보가 있으면 업데이트
        if (data.size !== undefined) {
          player.setSize(data.size);
        }
        
        socket.broadcast.emit('player-moved', {
          id: socket.id,
          x: player.x,
          y: player.y,
          direction: player.direction,
          isJumping: player.isJumping,
          jobClass: player.jobClass,
          level: player.level,
          size: player.size,
          isDead: player.isDead // 사망 상태도 전송
          hp: player.hp,
          maxHp: player.maxHp
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
      if (!player) {
        socket.emit('skill-error', { error: 'Player not found' });
        return;
      }

      // 점프는 기본 능력이므로 별도 처리
      if (data.skillType === 'jump') {
        this.handleJumpAction(socket, player);
        return;
      }

      // 서버에서 스킬 사용 검증 및 처리
      const skillResult = this.skillManager.useSkill(
        player,
        data.skillType, 
        data.targetX, 
        data.targetY
      );

      if (!skillResult.success) {
        // 스킬 사용 실패 시 요청한 클라이언트에게만 에러 전송
        socket.emit('skill-error', { 
          error: skillResult.error,
          skillType: data.skillType 
        });
        return;
      }

      // 서버에서 데미지 계산 및 적용
      const damageResult = this.skillManager.applySkillDamage(
        player, 
        skillResult.skillType, 
        skillResult.skillInfo, 
        skillResult.x, 
        skillResult.y, 
        skillResult.targetX, 
        skillResult.targetY
      );

      // 스킬 사용 성공 시 모든 클라이언트에게 브로드캐스트
      const broadcastData = {
        playerId: socket.id,
        skillType: skillResult.skillType,
        timestamp: skillResult.timestamp,
        x: skillResult.x,
        y: skillResult.y,
        team: player.team,
        skillInfo: skillResult.skillInfo,
        damageResult: damageResult // 데미지 결과 추가
      };

      // 타겟 위치가 있는 경우 추가
      if (skillResult.targetX !== null) {
        broadcastData.targetX = skillResult.targetX;
        broadcastData.targetY = skillResult.targetY;
      }

      // 모든 클라이언트에게 스킬 사용 알림
      this.io.emit('player-skill-used', broadcastData);
      
      console.log(`Player ${socket.id} used skill: ${skillResult.skillType}`);
    });
  }

  /**
   * 점프 액션 처리
   */
  handleJumpAction(socket, player) {
    // 점프 시작 처리
    const jumpDuration = 400;
    if (!player.startJump(jumpDuration)) {
      return; // 이미 점프 중이면 무시
    }

    // 모든 클라이언트에게 점프 알림
    this.io.emit('player-skill-used', {
      playerId: socket.id,
      skillType: 'jump',
      timestamp: Date.now(),
      x: player.x,
      y: player.y,
      team: player.team,
      skillInfo: {
        range: 0,
        damage: 0,
        duration: jumpDuration
      }
    });

    // 점프 완료 후 상태 복원
    setTimeout(() => {
      if (player) {
        player.endJump();
      }
    }, jumpDuration);

    console.log(`Player ${socket.id} used jump`);
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
      this.playerSockets.delete(socket.id); // 소켓 맵에서 제거
      socket.broadcast.emit('player-left', { playerId: socket.id });
    });
  }

  /**
   * 개별 플레이어에게 이벤트 전송
   */
  emitToPlayer(playerId, event, data) {
    const socket = this.playerSockets.get(playerId);
    if (socket) {
      socket.emit(event, data);
      return true;
    } else {
      console.warn(`플레이어 소켓을 찾을 수 없음: ${playerId}`);
      return false;
    }
  }

  /**
   * 여러 플레이어에게 이벤트 전송
   */
  emitToPlayers(playerIds, event, data) {
    let successCount = 0;
    playerIds.forEach(playerId => {
      if (this.emitToPlayer(playerId, event, data)) {
        successCount++;
      }
    });
    return successCount;
  }

  /**
   * 서버 통계 정보 브로드캐스트
   */
  broadcastServerStats() {
    const stats = this.gameStateManager.getStats();
    this.io.emit('server-stats', stats);
  }

  /**
   * 플레이어 리스폰 이벤트 핸들러
   */
  setupPlayerRespawnHandler(socket) {
    socket.on('player-respawned', (data) => {
      const player = this.gameStateManager.getPlayer(socket.id);
      if (player) {
        // 플레이어 위치 업데이트
        player.x = data.x;
        player.y = data.y;
        
        // 사망 상태 해제 및 HP 회복
        player.respawn();
        
        // 플레이어가 활성 상태인지 확인
        player.lastUpdateTime = Date.now();
        
        console.log(`플레이어 ${socket.id} 리스폰: (${data.x}, ${data.y}), HP: ${player.hp}/${player.maxHp}`);
        
        // 다른 플레이어들에게 리스폰 알림
        socket.broadcast.emit('player-respawned', {
          playerId: socket.id,
          x: data.x,
          y: data.y,
          hp: player.hp,
          maxHp: player.maxHp
        });
        
        // 리스폰 후 즉시 플레이어 상태 동기화
        const playerState = player.getState();
        socket.emit('player-state-sync', {
          playerId: socket.id,
          playerData: playerState
        });
      }
    });
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