const ServerUtils = require('../utils/ServerUtils');
const SkillManager = require('./SkillManager');

/**
 * 소켓 이벤트 관리 매니저
 */
class SocketEventManager {
  constructor(io, gameStateManager, enemyManager, skillManager = null, projectileManager = null) {
    this.io = io;
    this.gameStateManager = gameStateManager;
    this.enemyManager = enemyManager;
    this.playerSockets = new Map(); // 플레이어 ID -> 소켓 매핑
    this.skillManager = skillManager || new SkillManager(gameStateManager);
    this.projectileManager = projectileManager;
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
      this.setupWardDetectionHandler(socket); // 와드 감지 핸들러 추가
      this.setupPlayerLevelUpHandler(socket); // 레벨업 요청 핸들러 추가
      this.setupPlayerSuicideHandler(socket); // 자살 치트 요청 핸들러 추가
      this.setupPlayerInvincibleHandler(socket); // 무적 상태 토글 치트 요청 핸들러 추가
      this.setupPlayerPingHandler(socket);
      this.setupEnemyHitHandler(socket);
      this.setupProjectileWallCollisionHandler(socket);
      this.setupGameSyncHandler(socket);
      this.setupPlayerRespawnHandler(socket);
      this.setupPingTestHandler(socket); // 핑 테스트 핸들러 추가
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
      
      // 플레이어에게 소켓 참조 설정
      player.socket = socket;
      
              // JobClasses를 사용한 올바른 초기 스탯 설정
        player.initializeStatsFromJobClass();
        
        // JobClasses에서 쿨타임 정보 가져오기
        const { getJobInfo } = require('../../shared/JobClasses.js');
        const jobCooldowns = {};
        
        // 모든 직업의 스킬 쿨타임 정보 수집
        const jobClasses = ['slime', 'ninja', 'archer', 'mage', 'assassin', 'warrior', 'supporter', 'mechanic'];
        jobClasses.forEach(jobClass => {
            const jobInfo = getJobInfo(jobClass);
            jobCooldowns[jobClass] = {
                basicAttackCooldown: jobInfo.basicAttackCooldown,
                skill1: { cooldown: jobInfo.skills[0]?.cooldown || 3000 },
                skill2: { cooldown: jobInfo.skills[1]?.cooldown || 3000 },
                skill3: { cooldown: jobInfo.skills[2]?.cooldown || 3000 }
            };
        });
        
        // 게임 참가 응답
        const gameJoinedData = {
            playerId: playerId,
            playerData: player.getState(),
            players: this.gameStateManager.getPlayersState(),
            enemies: this.gameStateManager.getEnemiesState(),
            mapData: this.gameStateManager.mapData,
            serverConfig: this.gameConfig, // 서버 설정 추가
            jobCooldowns: jobCooldowns // 쿨타임 정보 추가
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
      
      // 기절 상태에서는 이동 업데이트 무시
      if (player.isStunned) {
        console.log(`플레이어 ${socket.id}가 기절 상태에서 이동 시도 - 무시됨`);
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
      
      if (!actualSkillType) {
        socket.emit('skill-error', { 
          error: 'Invalid skill type',
          skillType: data.skillType 
        });
        return;
      }

      // 서버에서 스킬 사용 검증 및 처리 (모든 조건 체크는 SkillManager에서 수행)
      const skillOptions = { 
        direction: data.direction, // 클라이언트에서 받은 방향 정보 전달
        rotationDirection: data.rotationDirection // 회전 방향 정보 추가
      };
      console.log(`스킬 사용 옵션:`, skillOptions);

      const skillResult = this.skillManager.useSkill(
        player,
        actualSkillType, 
        data.targetX, 
        data.targetY,
        skillOptions
      );

      if (!skillResult.success) {
        socket.emit('skill-error', { 
          error: skillResult.error,
          skillType: data.skillType 
        });
        return;
      }

      // 스킬 실행 방식에 따른 처리
      const processedResult = this.processSkillExecution(socket, player, skillResult);
      
      console.log(`Player ${socket.id} used skill: ${skillResult.skillType}`);
    });
  }

  /**
   * 스킬 실행 방식에 따른 처리
   */
  processSkillExecution(socket, player, skillResult) {
    const { skillType, skillInfo } = skillResult;
    
    // 스킬 타입별 실행 방식 결정
    const executionType = this.determineSkillExecutionType(skillType, skillInfo);
    
    switch (executionType) {
      case 'IMMEDIATE':
        return this.handleImmediateSkill(socket, player, skillResult);
      
      case 'PROJECTILE':
        return this.handleProjectileSkill(socket, player, skillResult);
      
      case 'DELAYED':
        return this.handleDelayedSkill(socket, player, skillResult);
      
      case 'CHANNELED':
        return this.handleChanneledSkill(socket, player, skillResult);
      
      default:
        console.warn(`Unknown skill execution type: ${executionType} for skill: ${skillType}`);
        return this.handleImmediateSkill(socket, player, skillResult);
    }
  }

  /**
   * 스킬 실행 타입 결정
   */
  determineSkillExecutionType(skillType, skillInfo) {
    // 투사체 스킬들 (클라이언트에서 투사체 처리, 충돌 시 서버에서 데미지)
    const projectileSkills = ['magic_missile', 'basic_attack'];
    if (projectileSkills.includes(skillType)) {
      return 'PROJECTILE';
    }
    
    // 시전시간이 있는 지연 스킬들 (시전시간 후 데미지)
    if (skillInfo.delay > 0) {
      return 'DELAYED';
    }
    
    // 지속시간이 있는 채널링 스킬들 (지속 효과)
    const channeledSkills = ['ice_field', 'shield', 'buff_field', 'heal_field'];
    if (channeledSkills.includes(skillType) || skillInfo.duration > 0) {
      return 'CHANNELED';
    }
    
    // 즉시 실행 스킬들 (즉시 효과 적용)
    return 'IMMEDIATE';
  }


  /**
   * 즉시 실행 스킬 처리 (즉시 데미지/효과 적용)
   */
  handleImmediateSkill(socket, player, skillResult) {
    // 즉시 데미지/효과 적용
    const damageResult = this.skillManager.applySkillDamage(
      player, 
      skillResult.skillType, 
      skillResult.skillInfo, 
      skillResult.x, 
      skillResult.y, 
      skillResult.targetX, 
      skillResult.targetY
    );

    // 클라이언트에 브로드캐스트
    this.broadcastSkillUsed(socket, player, skillResult, damageResult);
    
    return { executionType: 'IMMEDIATE', damageResult };
  }

  /**
   * 투사체 스킬 처리 (클라이언트에서 투사체 관리, 충돌 시 서버 처리)
   */
  handleProjectileSkill(socket, player, skillResult) {
    // 투사체는 클라이언트에서 관리, 충돌 시 서버에서 데미지 처리
    // 여기서는 데미지 적용하지 않음
    const damageResult = { affectedEnemies: [], affectedPlayers: [], totalDamage: 0 };

    // 클라이언트에 브로드캐스트
    this.broadcastSkillUsed(socket, player, skillResult, damageResult);
    
    return { executionType: 'PROJECTILE', damageResult };
  }

  /**
   * 지연 스킬 처리 (시전시간 후 데미지 적용)
   */
  handleDelayedSkill(socket, player, skillResult) {
    const damageResult = this.skillManager.applySkillDamage(
      player, 
      skillResult.skillType, 
      skillResult.skillInfo, 
      skillResult.x, 
      skillResult.y, 
      skillResult.targetX, 
      skillResult.targetY
    );

    // 클라이언트에 브로드캐스트 (시전 시작 알림)
    this.broadcastSkillUsed(socket, player, skillResult, damageResult);
    
    return { executionType: 'DELAYED', damageResult };
  }

  /**
   * 채널링 스킬 처리 (지속 효과)
   */
  handleChanneledSkill(socket, player, skillResult) {
    // 채널링 스킬은 즉시 효과를 적용하거나 상태를 설정
    let damageResult = { affectedEnemies: [], affectedPlayers: [], totalDamage: 0 };
    
    // 일부 채널링 스킬은 즉시 효과 적용 (예: ice_field)
    if (['ice_field', 'ward', 'buff_field', 'heal_field'].includes(skillResult.skillType)) {
      damageResult = this.skillManager.applySkillDamage(
        player, 
        skillResult.skillType, 
        skillResult.skillInfo, 
        skillResult.x, 
        skillResult.y, 
        skillResult.targetX, 
        skillResult.targetY
      );
    }

    // 클라이언트에 브로드캐스트
    this.broadcastSkillUsed(socket, player, skillResult, damageResult);
    
    return { executionType: 'CHANNELED', damageResult };
  }

  /**
   * 스킬 사용 브로드캐스트
   */
  broadcastSkillUsed(socket, player, skillResult, damageResult) {
    const broadcastData = {
      playerId: socket.id,
      skillType: skillResult.skillType,
      endTime: skillResult.endTime,
      x: player.x,
      y: player.y,
      team: player.team,
      skillInfo: skillResult.skillInfo,
      damageResult: damageResult,
      cooldownInfo: {
        totalCooldown: skillResult.skillInfo.cooldown || 0,
        cooldownEndTime: player.skillCooldowns[skillResult.skillType] || 0
      }
    };

    // 특수 스킬별 추가 정보 처리
    this.addSpecialSkillInfo(broadcastData, skillResult, player);

    // 모든 클라이언트에게 스킬 사용 알림
    this.io.emit('player-skill-used', broadcastData);
  }

  /**
   * 특수 스킬별 추가 정보 설정
   */
  addSpecialSkillInfo(broadcastData, skillResult, player) {
    const { skillType } = skillResult;
    const damageResult = broadcastData.damageResult || {};
    
    // 얼음 장판 스킬 정보
    if (skillType === 'ice_field') {
      broadcastData.x = skillResult.x || damageResult.x || player.x;
      broadcastData.y = skillResult.y || damageResult.y || player.y;
    }

    // 구르기 스킬의 경우 시작 위치와 최종 위치 정보 추가
    if (skillType === 'roll') {
      broadcastData.startX = skillResult.startX;
      broadcastData.startY = skillResult.startY;
      broadcastData.endX = skillResult.endX;
      broadcastData.endY = skillResult.endY;
      broadcastData.direction = skillResult.direction;
      broadcastData.rotationDirection = skillResult.rotationDirection;
      console.log(`구르기 위치 정보 추가: 시작(${skillResult.startX}, ${skillResult.startY}) -> 끝(${skillResult.endX}, ${skillResult.endY})`);
    }

    // 와드 스킬의 경우 크기 정보 추가 (서포터만)
    if (skillType === 'ward') {
      broadcastData.wardScale = 0.2; // 와드 크기 정보
      broadcastData.wardBodySize = 125; // 와드 물리 바디 크기
      broadcastData.playerId = player.id; // 와드 설치자 ID 추가
      broadcastData.playerTeam = player.team; // 와드 설치자 팀 정보 추가
      // 와드 설치 위치 정보 추가 (플레이어 위치와 별도로)
      broadcastData.wardX = skillResult.targetX || player.x;
      broadcastData.wardY = skillResult.targetY || player.y;
      // 와드 ID 추가
      broadcastData.wardId = skillResult.wardId;
      
      // 와드가 제거된 경우 제거 이벤트도 브로드캐스트
      if (skillResult.removedWard) {
        this.io.emit('ward-destroyed', {
          playerId: player.id,
          wardId: skillResult.removedWard.id,
          reason: 'replaced'
        });
      }
    }
    
    // 힐 장판 스킬의 경우 위치 정보 추가
    if (skillType === 'heal_field') {
      broadcastData.x = skillResult.x || damageResult.x || player.x;
      broadcastData.y = skillResult.y || damageResult.y || player.y;
    }
    
    // 버프 장판 스킬의 경우 위치 정보 추가
    if (skillType === 'buff_field') {
      broadcastData.x = skillResult.x || damageResult.x || player.x;
      broadcastData.y = skillResult.y || damageResult.y || player.y;
    }

    // 타겟 위치 정보
    if (skillResult.targetX !== null && skillResult.targetY !== null) {
      broadcastData.targetX = skillResult.targetX;
      broadcastData.targetY = skillResult.targetY;
    }

    // 은신 스킬 정보
    if (skillType === 'stealth') {
      broadcastData.stealthData = skillResult.stealthData;
      broadcastData.startTime = skillResult.startTime;
      broadcastData.endTime = skillResult.endTime;
      broadcastData.duration = skillResult.duration;
      broadcastData.speedMultiplier = skillResult.speedMultiplier;
      broadcastData.visionMultiplier = skillResult.visionMultiplier;
    }

    // 칼춤 스킬 정보
    if (skillType === 'blade_dance') {
      broadcastData.bladeDanceData = damageResult.bladeDanceData;
      broadcastData.endTime = skillResult.endTime;
      broadcastData.duration = skillResult.duration;
      broadcastData.attackPowerMultiplier = skillResult.attackPowerMultiplier;
    }

    // 집중 스킬 정보 (궁수)
    if (skillType === 'focus') {
      broadcastData.focusData = damageResult.focusData;
      broadcastData.endTime = skillResult.endTime;
      broadcastData.duration = skillResult.duration;
      broadcastData.attackSpeedMultiplier = skillResult.attackSpeedMultiplier;
    }
  }

  /**
   * 와드 감지 정보 처리
   */
  setupWardDetectionHandler(socket) {
    socket.on('ward-detection', (data) => {
      const player = this.gameStateManager.getPlayer(socket.id);
      if (!player) return;

      // 같은 팀 플레이어들에게만 브로드캐스트
      const teamPlayers = this.gameStateManager.getPlayersByTeam(player.team);
      const teamPlayerIds = teamPlayers.map(p => p.id);
      
      this.emitToPlayers(teamPlayerIds, 'ward-detection-update', {
        wardOwnerId: socket.id,
        wardOwnerTeam: player.team,
        ...data
      });
      
      console.log(`Ward detection: ${data.type} ${data.targetId} ${data.detected ? 'detected' : 'undetected'} by ${socket.id}`);
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
        skill1: 'stealth',
        skill2: 'blade_dance'
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
        skill1: 'ice_field',
        skill2: 'magic_missile',
        skill3: 'shield'
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

    if (skillType === 'basic_attack') {
      return 'basic_attack';
    }
    
    const jobSkills = skillMappings[jobClass];
    
    const mappedSkill = jobSkills ? jobSkills[skillType] : null;
    
    return mappedSkill;
  }

  /**
   * 점프 액션 처리
   */
  handleJumpAction(socket, player) {
    // 죽은 플레이어는 점프 불가
    if (player.isDead) {
      socket.emit('skill-error', { error: 'Cannot jump while dead' });
      return;
    }

    // 기절 상태에서는 점프 불가
    if (player.isStunned) {
      socket.emit('skill-error', { error: 'Cannot jump while stunned' });
      return;
    }

    // 시전시간이 있는 스킬 사용 중인지 체크
    const castingSkills = this.skillManager.getCastingSkills(player);
    if (castingSkills.length > 0) {
      socket.emit('skill-error', { error: 'Cannot jump while casting a skill' });
      return;
    }

    // 후딜레이 중인지 체크
    const inAfterDelay = this.skillManager.isInAfterDelay(player);
    if (inAfterDelay) {
      socket.emit('skill-error', { error: 'Cannot jump while in after delay' });
      return;
    }

    // 점프 시작 처리
    const now = Date.now();
    const jumpDuration = 400;
    if (!this.skillManager.startJump(player, jumpDuration)) {
      return; // 이미 점프 중이면 무시
    }

    // 모든 클라이언트에게 점프 알림
    this.io.emit('player-skill-used', {
      playerId: socket.id,
      skillType: 'jump',
      endTime: now + jumpDuration,
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
        this.skillManager.endJump(player);
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
        const result = this.gameStateManager.takeDamage(player, enemy, player.attack);
        
        if (result.success) {
          // 몬스터가 죽었으면 새로운 적 스폰
          if (enemy.hp <= 0) {
            // 새로운 적 스폰
            this.enemyManager.spawnEnemy();
          }
          // 데미지 이벤트와 경험치 지급은 통합 함수에서 이미 처리됨
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
        // JobClasses에서 마법 투사체 스킬 정보 가져오기
        const { getSkillInfo } = require('../../shared/JobClasses.js');
        const skillInfo = getSkillInfo('mage', 'magic_missile');
        
        const explosionRadius = skillInfo.explosionRadius || 60;
        const explosionX = data.x;
        const explosionY = data.y;
        
        const enemies = this.gameStateManager.enemies;
        const players = this.gameStateManager.players;
        
        // 범위 내 모든 적들에게 데미지 적용
        enemies.forEach(enemy => {
          if (enemy.isDead) return;
          
          const distance = Math.sqrt((enemy.x - explosionX) ** 2 + (enemy.y - explosionY) ** 2);
          if (distance <= explosionRadius) {
            // JobClasses에서 정의된 데미지 공식 사용
            const damage = this.skillManager.calculateSkillDamage(player, 'magic_missile', skillInfo.damage);
            const result = this.gameStateManager.takeDamage(player, enemy, damage);
            
            if (result.success) {
              // 적이 죽었으면 제거
              if (enemy.hp <= 0) {
                this.gameStateManager.removeEnemy(enemy.id);
                this.io.emit('enemy-destroyed', { enemyId: enemy.id });
              }
              // 데미지 이벤트는 통합 함수에서 이미 처리됨
            }
          }
        });
        
        // 범위 내 모든 다른 플레이어들에게 데미지 적용 (적팀만)
        players.forEach(targetPlayer => {
          if (targetPlayer.id === player.id || targetPlayer.team === player.team) return;
          
          const distance = Math.sqrt((targetPlayer.x - explosionX) ** 2 + (targetPlayer.y - explosionY) ** 2);
          if (distance <= explosionRadius) {
            // JobClasses에서 정의된 데미지 공식 사용 (몬스터와 동일)
            const damage = this.skillManager.calculateSkillDamage(player, 'magic_missile', skillInfo.damage);
            const result = this.gameStateManager.takeDamage(player, targetPlayer, damage);
            
            // 데미지 이벤트는 통합 함수에서 이미 처리됨
          }
        });
        
        console.log(`마법사 ${player.id} 투사체 벽 충돌 범위 공격 실행 at (${explosionX}, ${explosionY}), 범위: ${explosionRadius}`);
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
   * 핑 테스트 핸들러 설정
   */
  setupPingTestHandler(socket) {
    socket.on('ping-test', (clientTimestamp) => {
      // 즉시 응답 (서버 처리 시간 최소화)
      socket.emit('ping-response', clientTimestamp);
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

  /**
   * 마법 투사체 충돌 핸들러 설정
   */


  /**
   * 핑 테스트 핸들러 설정
   */
  setupPingTestHandler(socket) {
    socket.on('ping-test', (clientTimestamp) => {
      // 즉시 응답 (서버 처리 시간 최소화)
      socket.emit('ping-response', clientTimestamp);
    });
  }
}

module.exports = SocketEventManager; 