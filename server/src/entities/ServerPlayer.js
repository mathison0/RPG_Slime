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
    
    // 기절 상태
    this.isStunned = false;
    this.stunStartTime = 0;
    this.stunDuration = 0;
    
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
      isStunned: this.isStunned, // 기절 상태 추가
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
  useSkill(skillType, targetX = null, targetY = null) {
    const skillInfo = getSkillInfo(this.jobClass, skillType);
    if (!skillInfo) {
      return { success: false, error: 'Invalid skill type' };
    }

    // 쿨타임 체크
    const now = Date.now();
    const lastUsed = this.skillCooldowns[skillType] || 0;
    if (now - lastUsed < skillInfo.cooldown) {
      return { success: false, error: 'Skill on cooldown' };
    }

    // 스킬별 특수 조건 체크
    if (this.isJumping && skillType !== 'stealth') {
      return { success: false, error: 'Cannot use skill while jumping' };
    }

    // 기절 상태에서는 스킬 사용 불가
    if (this.isStunned) {
      return { success: false, error: 'Cannot use skill while stunned' };
    }

    // 스킬 사용 처리
    this.skillCooldowns[skillType] = now;
    
    // 액션 상태 업데이트
    const duration = skillInfo.duration || 0;
    if (duration > 0) {
      this.currentActions.skills.set(skillType, {
        startTime: now,
        duration: duration,
        endTime: now + duration,
        skillInfo: {
          range: this.calculateSkillRange(skillType, skillInfo.range),
          damage: this.calculateSkillDamage(skillType, skillInfo.damage),
          duration: duration,
          heal: skillInfo.heal || 0
        }
      });
    }
    
    return {
      success: true,
      skillType,
      timestamp: now,
      playerId: this.id,
      x: this.x,
      y: this.y,
      targetX,
      targetY,
      skillInfo: {
        range: this.calculateSkillRange(skillType, skillInfo.range),
        damage: this.calculateSkillDamage(skillType, skillInfo.damage),
        duration: duration,
        heal: skillInfo.heal || 0
      }
    };
  }

  /**
   * 점프 시작 처리
   */
  startJump(duration = gameConfig.PLAYER.SKILLS.JUMP_DURATION) {
    if (this.isJumping) {
      return false;
    }
    
    const now = Date.now();
    this.isJumping = true;
    this.currentActions.jump = {
      startTime: now,
      duration: duration,
      endTime: now + duration
    };
    
    return true;
  }

  /**
   * 점프 종료 처리
   */
  endJump() {
    this.isJumping = false;
    this.currentActions.jump = null;
  }

  /**
   * 기절 상태 시작
   */
  startStun(duration) {
    this.isStunned = true;
    this.stunStartTime = Date.now();
    this.stunDuration = duration;
    
    // 기절 지속시간 후 자동 해제
    setTimeout(() => {
      if (this.isStunned) {
        this.endStun();
      }
    }, duration);
    
    
    // 기절 상태 변경을 모든 클라이언트에게 즉시 알림
    if (global.io) {
      global.io.emit('player-stunned', {
        playerId: this.id,
        isStunned: true,
        duration: duration
      });
    }
  }

  /**
   * 기절 상태 종료
   */
  endStun() {
    this.isStunned = false;
    this.stunStartTime = 0;
    this.stunDuration = 0;
    
    // 기절 상태 해제를 모든 클라이언트에게 즉시 알림
    if (global.io) {
      global.io.emit('player-stunned', {
        playerId: this.id,
        isStunned: false,
        duration: 0
      });
    }
  }

  /**
   * 액션 상태 정리 (만료된 액션들 제거)
   */
  cleanupExpiredActions() {
    const now = Date.now();
    
    // 점프 상태 확인
    if (this.currentActions.jump && now >= this.currentActions.jump.endTime) {
      this.endJump();
    }
    
    // 스킬 상태 확인
    for (const [skillType, skillAction] of this.currentActions.skills) {
      if (now >= skillAction.endTime) {
        this.currentActions.skills.delete(skillType);
      }
    }
  }

  /**
   * 스킬 범위 계산 (슬라임은 크기에 비례)
   */
  calculateSkillRange(skillType, baseRange) {
    if (this.jobClass === 'slime' && skillType === 'spread') {
      // 슬라임 퍼지기는 크기에 비례 (기본 크기는 Config에서 가져옴)
      return Math.round(baseRange * (this.size / gameConfig.PLAYER.SKILLS.BASE_RANGE_REFERENCE));
    }
    return baseRange;
  }

  /**
   * 스킬 데미지 계산
   */
  calculateSkillDamage(skillType, baseDamage) {
    if (typeof baseDamage === 'string') {
      // 문자열 수식 처리 (예: 'attack', 'attack * 1.5')
      if (baseDamage === 'attack') {
        baseDamage = this.attack;
      } else if (baseDamage.includes('attack')) {
        // 간단한 수식 계산 (attack * 1.5 등)
        baseDamage = this.parseFormula(baseDamage, this.attack);
      }
    }
    
    return Math.round(baseDamage);
  }

  /**
   * 안전한 수식 파싱 (eval 대신 사용)
   * 'attack * 1.5', 'attack + 10' 등의 간단한 수식을 파싱
   */
  parseFormula(formula, attackValue) {
    // 공백 제거
    const cleanFormula = formula.replace(/\s/g, '');
    
    // attack 값으로 치환
    const withValue = cleanFormula.replace(/attack/g, attackValue);
    
    // 간단한 수식 파싱 (*, +, -, / 지원)
    const match = withValue.match(/^(\d+(?:\.\d+)?)\s*([+\-*/])\s*(\d+(?:\.\d+)?)$/);
    if (match) {
      const [, left, operator, right] = match;
      const leftNum = parseFloat(left);
      const rightNum = parseFloat(right);
      
      switch (operator) {
        case '*': return Math.round(leftNum * rightNum);
        case '/': return Math.round(leftNum / rightNum);
        case '+': return Math.round(leftNum + rightNum);
        case '-': return Math.round(leftNum - rightNum);
        default: return attackValue;
      }
    }
    
    // 단순 숫자인 경우
    const numMatch = withValue.match(/^(\d+(?:\.\d+)?)$/);
    if (numMatch) {
      return Math.round(parseFloat(numMatch[1]));
    }
    
    return attackValue;
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