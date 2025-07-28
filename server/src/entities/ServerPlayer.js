const gameConfig = require('../config/GameConfig');
const { getSkillInfo } = require('../../../shared/JobClasses');

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
    this.expToNext = 100;
    this.maxHp = gameConfig.PLAYER.DEFAULT_HP;
    this.hp = this.maxHp;
    this.speed = gameConfig.PLAYER.DEFAULT_SPEED;
    this.attack = gameConfig.PLAYER.DEFAULT_ATTACK;
    this.defense = gameConfig.PLAYER.DEFAULT_DEFENSE;
    this.jobClass = 'slime';
    this.direction = 'front';
    this.isJumping = false;
    this.size = gameConfig.PLAYER.DEFAULT_SIZE;
    this.visionRange = gameConfig.PLAYER.VISION_RANGE;
    this.lastUpdate = Date.now();
    this.nickname = 'Player';
    
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
      defense: this.defense,
      speed: this.speed,
      nickname: this.nickname,
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
    this.expToNext = this.level * 100;
    
    // 스탯 증가
    this.maxHp += 20;
    this.hp = this.maxHp; // 풀피로 회복
    this.attack += 5;
    this.defense += 2;
    
    console.log(`플레이어 ${this.id} 레벨업! 레벨: ${this.level}`);
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
   * 데미지 처리
   */
  takeDamage(damage) {
    const actualDamage = Math.max(1, damage - this.defense);
    this.hp = Math.max(0, this.hp - actualDamage);
    return this.hp <= 0; // 사망 여부 반환
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
  startJump(duration = 400) {
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
      // 슬라임 퍼지기는 크기에 비례 (기본 크기 64를 기준으로)
      return Math.round(baseRange * (this.size / 64));
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
        baseDamage = eval(baseDamage.replace('attack', this.attack));
      }
    }
    
    // 기본 공격력과 레벨을 반영한 데미지 계산
    const levelBonus = (this.level - 1) * 5;
    return Math.round((baseDamage + levelBonus) * 0.8);
  }

  /**
   * 크기 변경
   */
  setSize(newSize) {
    this.size = Math.max(16, Math.min(256, newSize));
  }
}

module.exports = ServerPlayer; 