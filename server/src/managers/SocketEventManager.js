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
    
    // global.io 설정 (기절 상태 알림용)
    global.io = io;
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
      this.setupPlayerLevelUpHandler(socket); // 레벨업 요청 핸들러 추가
      this.setupPlayerSuicideHandler(socket); // 자살 치트 요청 핸들러 추가
      this.setupPlayerInvincibleHandler(socket); // 무적 상태 토글 치트 요청 핸들러 추가
      this.setupPlayerPingHandler(socket);
      this.setupEnemyHitHandler(socket);
      this.setupProjectileWallCollisionHandler(socket);
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
      
      // JobClasses를 사용한 올바른 초기 스탯 설정
      player.initializeStatsFromJobClass();
      
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
   * 플레이어 업데이트 이벤트 핸들러 (클라이언트에서 위치 전송)
   */
  setupPlayerUpdateHandler(socket) {
    socket.on('player-update', (data) => {
      const player = this.gameStateManager.getPlayer(socket.id);
      
      // 플레이어가 존재하지 않는 경우 에러 리턴
      if (!player) {
        console.log(`[서버] 플레이어를 찾을 수 없음: ${socket.id}`);
        socket.emit('player-update-error', { error: 'Player not found' });
        return;
      }
      
      // 죽은 플레이어의 업데이트는 무시
      if (player.isDead) {
        return;
      }
      
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
        isStunned: player.isStunned, // 기절 상태 추가
        jobClass: player.jobClass,
        level: player.level,
        size: player.size,
        isDead: player.isDead,
        hp: player.hp,
        maxHp: player.maxHp
      });
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
      console.log(`스킬 요청 받음: ${data.skillType}, 플레이어: ${socket.id}`);
      
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

      // 스킬 타입을 직업별 스킬로 매핑
      const actualSkillType = this.mapSkillType(player.jobClass, data.skillType);
      console.log(`스킬 매핑: ${data.skillType} -> ${actualSkillType}, 직업: ${player.jobClass}`);
      
      if (!actualSkillType) {
        socket.emit('skill-error', { 
          error: 'Invalid skill type',
          skillType: data.skillType 
        });
        return;
      }

      // 서버에서 스킬 사용 검증 및 처리
      const skillResult = this.skillManager.useSkill(
        player,
        actualSkillType, 
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
   * 스킬 타입을 직업별 실제 스킬로 매핑
   */
  mapSkillType(jobClass, skillType) {
    const skillMappings = {
      slime: {
        skill1: 'spread'
      },
      assassin: {
        skill1: 'stealth'
      },
      ninja: {
        skill1: 'stealth'
      },
      warrior: {
        skill1: 'roar',
        skill2: 'sweep',
        skill3: 'thrust'
      },
      mage: {
        skill1: 'ward',
        skill2: 'ice_field',
        skill3: 'magic_missile'
      },
      mechanic: {
        skill1: 'repair'
      },
      archer: {
        skill1: 'roll',
        skill2: 'focus'
      },
      supporter: {
        skill1: 'ward',
        skill2: 'buff_field',
        skill3: 'heal_field'
      }
    };
    
    const jobSkills = skillMappings[jobClass];
    const mappedSkill = jobSkills ? jobSkills[skillType] : null;
    if (skillType === 'basic_attack') {
      return 'basic_attack';
    }
    
    return mappedSkill;
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
                attack: player.attack
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
   * 투사체 벽 충돌 이벤트 핸들러
   */
  setupProjectileWallCollisionHandler(socket) {
    socket.on('projectile-wall-collision', (data) => {
      const player = this.gameStateManager.getPlayer(data.playerId);
      if (!player || player.isDead) {
        return;
      }

      // 마법사의 경우 벽 충돌 시 범위 공격 실행
      if (data.jobClass === 'mage') {
        const explosionRadius = 60;
        const explosionX = data.x;
        const explosionY = data.y;
        
        const enemies = this.gameStateManager.enemies;
        const players = this.gameStateManager.players;
        
        // 범위 내 모든 적들에게 데미지 적용
        enemies.forEach(enemy => {
          if (enemy.isDead) return;
          
          const distance = Math.sqrt((enemy.x - explosionX) ** 2 + (enemy.y - explosionY) ** 2);
          if (distance <= explosionRadius) {
            const damage = player.attack;
            enemy.takeDamage(damage);
            
            // 모든 클라이언트에게 적 데미지 알림
            this.io.emit('enemy-damaged', {
              enemyId: enemy.id,
              damage: damage,
              currentHp: enemy.hp,
              maxHp: enemy.maxHp,
              isDead: enemy.isDead
            });

            // 적이 죽었으면 제거
            if (enemy.isDead) {
              this.gameStateManager.removeEnemy(enemy.id);
              this.io.emit('enemy-destroyed', { enemyId: enemy.id });
            }
          }
        });
        
        // 범위 내 모든 다른 플레이어들에게 데미지 적용 (적팀만)
        players.forEach(targetPlayer => {
          if (targetPlayer.id === player.id || targetPlayer.team === player.team) return;
          
          const distance = Math.sqrt((targetPlayer.x - explosionX) ** 2 + (targetPlayer.y - explosionY) ** 2);
          if (distance <= explosionRadius) {
            const damage = player.attack;
            targetPlayer.takeDamage(damage);
            
            // 모든 클라이언트에게 플레이어 데미지 알림
            this.io.emit('player-damaged', {
              playerId: targetPlayer.id,
              damage: damage,
              currentHp: targetPlayer.hp,
              maxHp: targetPlayer.maxHp,
              isDead: targetPlayer.isDead
            });
          }
        });
        
        console.log(`마법사 ${player.id} 투사체 벽 충돌 범위 공격 실행 at (${explosionX}, ${explosionY})`);
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
   * 플레이어 리스폰 요청 이벤트 핸들러
   */
  setupPlayerRespawnHandler(socket) {
    socket.on('player-respawn-request', (data) => {
      const player = this.gameStateManager.getPlayer(socket.id);
      if (!player) {
        socket.emit('respawn-error', { error: 'Player not found' });
        return;
      }

      // 플레이어가 죽은 상태인지 확인
      if (!player.isDead) {
        socket.emit('respawn-error', { error: 'Player is not dead' });
        return;
      }

      console.log(`플레이어 ${socket.id} 리스폰 요청 받음`);

      // 서버에서 스폰 위치 계산
      const spawnPoint = ServerUtils.getSpawnPoint(player.team);
      
      // 플레이어 위치 업데이트 및 리스폰 처리
      player.x = spawnPoint.x;
      player.y = spawnPoint.y;
      player.respawn();
      player.lastUpdateTime = Date.now();
      
      console.log(`플레이어 ${socket.id} 리스폰 처리 완료: (${spawnPoint.x}, ${spawnPoint.y}), HP: ${player.hp}/${player.maxHp}`);
      
      // 모든 클라이언트에게 리스폰 완료 브로드캐스트 (요청한 클라이언트 포함)
      this.io.emit('player-respawned', {
        playerId: socket.id,
        x: spawnPoint.x,
        y: spawnPoint.y,
        hp: player.hp,
        maxHp: player.maxHp,
        team: player.team,
        jobClass: player.jobClass,
        level: player.level,
        nickname: player.nickname,
        isDead: player.isDead
      });
    });
  }

  /**
   * 플레이어 레벨업 요청 이벤트 핸들러
   */
  setupPlayerLevelUpHandler(socket) {
    socket.on('player-level-up-request', (data) => {
      const player = this.gameStateManager.getPlayer(socket.id);
      if (!player) {
        socket.emit('level-up-error', { error: 'Player not found' });
        return;
      }

      try {
        // 서버에서 레벨업 처리
        const levelUpResult = player.levelUp();
        
        // 클라이언트에게 레벨업 결과 전송
        socket.emit('player-level-up', {
          playerId: socket.id,
          ...levelUpResult
        });

        // 다른 플레이어들에게 레벨업 알림 (레벨 정보만)
        socket.broadcast.emit('player-level-up', {
          playerId: socket.id,
          level: levelUpResult.level
        });

        console.log(`플레이어 ${socket.id} 레벨업 요청 처리 완료: 레벨 ${levelUpResult.level}`);
      } catch (error) {
        console.error('레벨업 처리 중 오류:', error);
        socket.emit('level-up-error', { error: 'Level up failed' });
      }
    });
  }

  /**
   * 플레이어 전직 이벤트 핸들러
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
   * 플레이어 자살 치트 요청 이벤트 핸들러
   */
  setupPlayerSuicideHandler(socket) {
    socket.on('player-suicide-request', (data) => {
      const player = this.gameStateManager.getPlayer(socket.id);
      if (!player) {
        socket.emit('suicide-error', { error: 'Player not found' });
        return;
      }

      // 이미 죽은 상태인지 확인
      if (player.isDead) {
        socket.emit('suicide-error', { error: 'Player is already dead' });
        return;
      }

      console.log(`플레이어 ${socket.id} 자살 치트 요청 받음`);

      // 플레이어 HP를 0으로 설정하고 사망 원인 설정
      player.hp = 0;
      player.lastDamageSource = {
        type: 'suicide',
        timestamp: Date.now()
      };
    });
  }

  /**
   * 플레이어 무적 상태 토글 치트 요청 이벤트 핸들러
   */
  setupPlayerInvincibleHandler(socket) {
    socket.on('player-invincible-request', (data) => {
      const player = this.gameStateManager.getPlayer(socket.id);
      if (!player) {
        socket.emit('invincible-error', { error: 'Player not found' });
        return;
      }

      console.log(`플레이어 ${socket.id} 무적 상태 토글 치트 요청 받음`);

      // 무적 상태 토글
      const newInvincibleState = player.toggleInvincible();

      // 요청한 클라이언트에게 결과 전송
      socket.emit('player-invincible-changed', {
        playerId: socket.id,
        isInvincible: newInvincibleState
      });

      console.log(`플레이어 ${socket.id} 무적 상태 토글 완료: ${newInvincibleState}`);
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