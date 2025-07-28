const gameConfig = require('../config/GameConfig');
const { getSkillInfo, calculateStats } = require('../../shared/JobClasses');

/**
 * 서버측 플레이어 클래스
 */
class ServerPlayer {
  constructor(id, x, y, team) {
    this.id = id;
    this.x = x;
    this.y = y;
    this.team = team;
    this.level = 1;
    this.exp = 0;
    this.expToNext = gameConfig.PLAYER.EXP.BASE_REQUIRED;
    this.maxHp = gameConfig.PLAYER.DEFAULT_HP;
    this.hp = this.maxHp;
    this.speed = gameConfig.PLAYER.DEFAULT_SPEED;
    this.attack = gameConfig.PLAYER.DEFAULT_ATTACK;
    this.jobClass = 'slime';
    this.direction = 'front';
    this.isJumping = false;
    this.size = gameConfig.PLAYER.DEFAULT_SIZE;
    this.visionRange = gameConfig.PLAYER.VISION_RANGE;
    this.lastUpdate = Date.now();
    this.nickname = 'Player';
    this.isDead = false; // 사망 상태
    this.lastDamageSource = null; // 마지막 데미지 소스 추적
    
    // 스킬 관련
    this.skillCooldowns = {}; // 스킬별 마지막 사용 시간
    this.activeEffects = new Set(); // 활성 효과들
    
    // 액션 상태 추가
    this.currentActions = {
      jump: null,      // { startTime, duration, endTime }
      skills: new Map() // skillType -> { startTime, duration, endTime, skillInfo }
    };
    
    // 어쌔신 은신 상태
    this.isStealth = false;
    this.stealthStartTime = 0;
    this.stealthDuration = 0;
    
    // 무적 상태 (치트)
    this.isInvincible = false;
  }

  /**
   * 직업 클래스에 따른 초기 스탯 설정
   */
  initializeStatsFromJobClass() {
    const stats = calculateStats(this.jobClass, this.level);
    
    this.maxHp = stats.hp;
    this.hp = this.maxHp; // 초기에는 풀피로 시작
    this.attack = stats.attack;
    this.defense = stats.defense;
    this.speed = stats.speed;
    this.visionRange = stats.visionRange;
    
    // 크기 계산 (GameConfig에서 가져옴)
    const baseSize = gameConfig.PLAYER.SIZE.BASE_SIZE;
    const growthRate = gameConfig.PLAYER.SIZE.GROWTH_RATE;
    const maxSize = gameConfig.PLAYER.SIZE.MAX_SIZE;
    
    const targetSize = baseSize + (this.level - 1) * growthRate;
    this.size = Math.min(targetSize, maxSize);
    
    console.log(`플레이어 ${this.id} 스탯 초기화! 직업: ${this.jobClass}, 레벨: ${this.level}, HP: ${this.maxHp}, 공격력: ${this.attack}, 크기: ${this.size}`);
  }

  /**
   * 플레이어 상태 업데이트
   */
  update(data) {
    this.x = data.x;
    this.y = data.y;
    this.direction = data.direction;
    this.isJumping = data.isJumping;
    this.lastUpdate = Date.now();
  }

  /**
   * 플레이어 상태 정보 반환
   */
  getState() {
    const now = Date.now();
    
    // 현재 진행 중인 액션들 정리
    const activeActions = {
      jump: null,
      skills: []
    };
    
    // 점프 상태 확인
    if (this.currentActions.jump) {
      const jumpAction = this.currentActions.jump;
      if (now < jumpAction.endTime) {
        activeActions.jump = {
          startTime: jumpAction.startTime,
          duration: jumpAction.duration,
          remainingTime: jumpAction.endTime - now
        };
      } else {
        // 점프 완료됨
        this.currentActions.jump = null;
        this.isJumping = false;
      }
    }
    
    // 스킬 상태 확인
    for (const [skillType, skillAction] of this.currentActions.skills) {
      if (now < skillAction.endTime) {
        activeActions.skills.push({
          skillType,
          startTime: skillAction.startTime,
          duration: skillAction.duration,
          remainingTime: skillAction.endTime - now,
          skillInfo: skillAction.skillInfo
        });
      } else {
        // 스킬 완료됨
        this.currentActions.skills.delete(skillType);
      }
    }
    
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
      speed: this.speed,
      nickname: this.nickname,
      isDead: this.isDead, // 사망 상태 추가
      isInvincible: this.isInvincible, // 무적 상태 추가
      activeActions: activeActions  // 액션 상태 정보 추가
    };
  }

  /**
   * 플레이어가 연결 해제되었는지 확인
   */
  isDisconnected() {
    const now = Date.now();
    return now - this.lastUpdate > gameConfig.PLAYER.DISCONNECT_TIMEOUT;
  }

  /**
   * 플레이어 레벨업
   */
  levelUp() {
    this.level++;
    this.exp = 0;
    this.expToNext = this.level * gameConfig.PLAYER.EXP.BASE_REQUIRED * gameConfig.PLAYER.EXP.MULTIPLIER;
    
    // JobClasses를 사용한 올바른 스탯 계산
    const newStats = calculateStats(this.jobClass, this.level);
    this.maxHp = newStats.hp;
    this.hp = this.maxHp; // 풀피로 회복
    this.attack = newStats.attack;
    this.defense = newStats.defense;
    this.speed = newStats.speed;
    this.visionRange = newStats.visionRange;
    
    // 크기 계산 (GameConfig에서 가져옴)
    const baseSize = gameConfig.PLAYER.SIZE.BASE_SIZE;
    const growthRate = gameConfig.PLAYER.SIZE.GROWTH_RATE;
    const maxSize = gameConfig.PLAYER.SIZE.MAX_SIZE;
    
    const targetSize = baseSize + (this.level - 1) * growthRate;
    this.size = Math.min(targetSize, maxSize);
    
    console.log(`플레이어 ${this.id} 레벨업! 레벨: ${this.level}, HP: ${this.maxHp}, 공격력: ${this.attack}, 크기: ${this.size}`);
    
    return {
      level: this.level,
      hp: this.hp,
      maxHp: this.maxHp,
      attack: this.attack,
      defense: this.defense,
      speed: this.speed,
      visionRange: this.visionRange,
      size: this.size  // size 정보 추가
    };
  }

  /**
   * 경험치 획득
   */
  gainExp(amount) {
    this.exp += amount;
    if (this.exp >= this.expToNext) {
      this.levelUp();
      return true; // 레벨업 발생
    }
    return false;
  }

  /**
   * 데미지 처리 (사망 판정은 서버 메인 루프에서만 처리)
   */
  takeDamage(damage) {
    if (this.isDead) {
      return 0; // 이미 죽은 상태면 데미지 처리 안함
    }
    
    // 무적 상태 체크
    if (this.isInvincible) {
      return 0; // 무적 상태면 데미지 없음
    }
    
    this.hp = Math.max(0, this.hp - damage);
    
    // 사망 판정은 메인 게임 루프에서만 처리하므로 여기서는 HP만 업데이트
    return damage;
  }

  /**
   * 무적 상태 토글
   */
  toggleInvincible() {
    this.isInvincible = !this.isInvincible;
    console.log(`플레이어 ${this.id} 무적 상태: ${this.isInvincible}`);
    return this.isInvincible;
  }

  /**
   * 플레이어 리스폰 (사망 상태 해제)
   */
  respawn() {
    console.log('플레이어 리스폰');
    this.isDead = false;
    this.hp = this.maxHp;
    // 데미지 소스 추적 정보 리셋
    this.lastDamageSource = null;
  }

  /**
   * 체력 회복
   */
  heal(amount) {
    this.hp = Math.min(this.maxHp, this.hp + amount);
  }

  /**
   * 직업 변경
   */
  changeJob(newJobClass) {
    this.jobClass = newJobClass;
    console.log(`플레이어 ${this.id} 직업 변경: ${newJobClass}`);
  }

  /**
   * 스킬 사용 시도
   */
  useSkill(skillType, targetX = null, targetY = null, skillManager = null) {
    if (!skillManager) {
      return { success: false, error: 'SkillManager not provided' };
    }
    
    return skillManager.useSkill(this, skillType, targetX, targetY);
  }

  /**
   * 점프 시작 처리
   */
  startJump(duration, skillManager = null) {
    if (!skillManager) {
      return false;
    }
    
    return skillManager.startJump(this, duration);
  }

  /**
   * 점프 종료 처리
   */
  endJump(skillManager = null) {
    if (!skillManager) {
      return;
    }
    
    skillManager.endJump(this);
  }

  /**
   * 액션 상태 정리 (만료된 액션들 제거)
   */
  cleanupExpiredActions(skillManager = null) {
    if (!skillManager) {
      return;
    }
    
    skillManager.cleanupExpiredActions(this);
  }



  /**
   * 콜라이더 크기 반환 (클라이언트와 동일한 로직)
   */
  getColliderSize() {
    return this.size * gameConfig.ENEMY.COLLIDER.SIZE_RATIO;
  }

  /**
   * 크기 변경
   */
  setSize(newSize) {
    this.size = Math.max(16, Math.min(256, newSize));
  }
}

module.exports = ServerPlayer; 