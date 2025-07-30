const gameConfig = require('../config/GameConfig');
const { getSkillInfo, calculateStats } = require('../../shared/JobClasses');

// 직업별 클래스 import
const SlimeJob = require('./jobs/SlimeJob');
const MageJob = require('./jobs/MageJob');
const AssassinJob = require('./jobs/AssassinJob');
const NinjaJob = require('./jobs/NinjaJob');
const WarriorJob = require('./jobs/WarriorJob');
const MechanicJob = require('./jobs/MechanicJob');
const ArcherJob = require('./jobs/ArcherJob');
const SupporterJob = require('./jobs/SupporterJob');


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
    this.maxHp = 100;
    this.hp = this.maxHp;
    this.speed = 200;
    this.attack = 20;
    this.jobClass = 'slime';
    this.job = null; // 직업 클래스 인스턴스
    this.direction = 'front';
    this.isJumping = false;
    this.size = 32;
    this.visionRange = 300;
    this.lastUpdate = Date.now();
    this.nickname = 'Player';
    this.isDead = false; // 사망 상태
    this.lastDamageSource = null; // 마지막 데미지 소스 추적
    
    // 스킬 관련
    this.skillCooldowns = {}; // 스킬별 마지막 사용 시간
    this.activeEffects = new Set(); // 활성 효과들
    
    // 버프 시스템
    this.buffs = new Map(); // buffType -> { startTime, duration, endTime, effect }
    this.originalStats = {}; // 원본 스탯 저장

    // 액션 상태 추가
    this.currentActions = {
      jump: null,      // { startTime, duration, endTime }
      skills: new Map() // skillType -> { startTime, duration, endTime, skillInfo }
    };

    // 지연된 액션들 (setTimeout ID 저장)
    this.delayedActions = new Map(); // actionId -> timeoutId
    
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
    
    // 초기 직업 인스턴스 생성
    this.initializeJob();
  }

  /**
   * 직업 인스턴스 초기화
   */
  initializeJob() {
    try {
      switch (this.jobClass) {
        case 'slime':
          this.job = new SlimeJob(this);
          break;
        case 'mage':
          this.job = new MageJob(this);
          break;
        case 'assassin':
          this.job = new AssassinJob(this);
          break;
        case 'ninja':
          this.job = new NinjaJob(this);
          break;
        case 'warrior':
          this.job = new WarriorJob(this);
          break;
        case 'mechanic':
          this.job = new MechanicJob(this);
          break;
        case 'archer':
          this.job = new ArcherJob(this);
          break;
        case 'supporter':
          this.job = new SupporterJob(this);
          break;
        default:
          console.log(`알 수 없는 직업: ${this.jobClass}, 기본값 slime으로 설정`);
          this.jobClass = 'slime';
          this.job = new SlimeJob(this);
          break;
      }
      console.log(`플레이어 ${this.id} 직업 인스턴스 생성 완료: ${this.jobClass}`);
    } catch (error) {
      console.error(`플레이어 ${this.id} 직업 인스턴스 생성 실패:`, error);
      this.job = null;
    }
  }

  /**
   * 직업 클래스에 따른 초기 스탯 설정
   */
  initializeStatsFromJobClass() {
    const stats = calculateStats(this.jobClass, this.level);
    
    this.maxHp = stats.hp;
    this.hp = this.maxHp; // 초기에는 풀피로 시작
    this.attack = stats.attack;
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
   * 서버 스킬 타입을 클라이언트 스킬 키로 역매핑
   */
  getSkillKeyFromType(skillType) {
    const skillMappings = {
      slime: {
        spread: 'skill1'
      },
      assassin: {
        stealth: 'skill1'
      },
      ninja: {
        stealth: 'skill1'
      },
      warrior: {
        roar: 'skill1',
        sweep: 'skill2',
        thrust: 'skill3'
      },
      mage: {
        ice_field: 'skill1',
        magic_missile: 'skill2',
        shield: 'skill3'
      },
      mechanic: {
        repair: 'skill1'
      },
      archer: {
        roll: 'skill1',
        focus: 'skill2'
      },
      supporter: {
        ward: 'skill1',
        buff_field: 'skill2',
        heal_field: 'skill3'
      }
    };
    
    const jobSkills = skillMappings[this.jobClass];
    if (!jobSkills) return null;
    
    return jobSkills[skillType] || null;
  }

  /**
   * 클라이언트용 스킬 쿨타임 정보 생성 (endTime 기반)
   */
  getClientSkillCooldowns() {
    const now = Date.now();
    const clientCooldowns = {};
    
    // 서버의 스킬 쿨타임을 클라이언트 스킬 키로 변환 (endTime 기반)
    for (const [serverSkillType, endTime] of Object.entries(this.skillCooldowns)) {
      const clientSkillKey = this.getSkillKeyFromType(serverSkillType);
      if (clientSkillKey) {
        clientCooldowns[clientSkillKey] = {
          nextAvailableTime: endTime
        };
      }
    }
    
    // 기본 공격 쿨다운 추가 (항상 포함)
    const basicAttackEndTime = this.skillCooldowns['basic_attack'] || 0;
    clientCooldowns['basic_attack'] = {
      nextAvailableTime: basicAttackEndTime
    };

    return clientCooldowns;
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
          endTime: jumpAction.endTime
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
          endTime: skillAction.endTime,
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
      exp: this.exp,
      expToNext: this.expToNext,
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
      activeActions: activeActions,  // 액션 상태 정보 추가
      skillCooldowns: this.getClientSkillCooldowns(), // 클라이언트용 스킬 쿨타임 정보 추가
      buffs: this.getBuffState() // 버프 상태 정보 추가
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
    // exp는 GameStateManager.giveExperience()에서 초과분 이월 처리하므로 여기서 0으로 초기화하지 않음
    this.expToNext = this.level * gameConfig.PLAYER.EXP.BASE_REQUIRED * gameConfig.PLAYER.EXP.MULTIPLIER;
    
    // JobClasses를 사용한 올바른 스탯 계산
    const oldMaxHp = this.maxHp;
    const newStats = calculateStats(this.jobClass, this.level);
    this.maxHp = newStats.hp;
    
    // 최대체력이 증가한 만큼만 현재 체력에 추가 (예: 70/100 -> 90/120)
    const hpIncrease = this.maxHp - oldMaxHp;
    this.hp = Math.min(this.maxHp, this.hp + hpIncrease);
    
    this.attack = newStats.attack;
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
    this.isDead = false;
    this.hp = this.maxHp;
    // 데미지 소스 추적 정보 리셋
    this.lastDamageSource = null;
    
    // 스킬 관련 상태 초기화
    this.currentActions.skills.clear();
    this.isStunned = false;
    this.isStealth = false;
    
    // 스킬 쿨타임 초기화
    this.skillCooldowns = {};
    
    // 지연된 액션들 정리
    for (const [actionId, timeoutId] of this.delayedActions) {
      clearTimeout(timeoutId);
    }
    this.delayedActions.clear();
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
    
    // 직업 변경 시 새로운 job 인스턴스 생성
    this.initializeJob();
    
    // 직업 변경 시 즉시 스탯 업데이트
    this.initializeStatsFromJobClass();

    console.log(`플레이어 ${this.id} 직업 변경: ${newJobClass}, 새로운 스탯 적용 완료`);
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
      console.log("startStun", duration);
      global.io.emit('player-stunned', {
        playerId: this.id,
        isStunned: true
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
        isStunned: false
      });
    }
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
   * 크기 변경
   */
  setSize(newSize) {
    this.size = Math.max(16, Math.min(256, newSize));
  }

  /**
   * 버프 적용
   */
  applyBuff(buffType, duration, effect) {
    const now = Date.now();
    const endTime = now + duration;
    
    this.buffs.set(buffType, {
      startTime: now,
      duration: duration,
      endTime: endTime,
      effect: effect
    });

    // 원본 스탯 저장 (첫 번째 버프 적용 시)
    if (!this.originalStats[buffType]) {
      this.originalStats[buffType] = {
        attackSpeed: this.basicAttackCooldown,
        speed: this.speed,
        attack: this.attack
      };
    }

    // 버프 효과 적용
    this.applyBuffEffect(buffType, effect);
    
    console.log(`버프 적용: ${buffType}, 지속시간: ${duration}ms, 효과:`, effect);
  }

  /**
   * 버프 효과 적용
   */
  applyBuffEffect(buffType, effect) {
    switch (buffType) {
      case 'attack_speed_boost':
        if (effect.attackSpeedMultiplier) {
          this.basicAttackCooldown = Math.floor(this.originalStats[buffType].attackSpeed / effect.attackSpeedMultiplier);
        }
        break;
      case 'speed_attack_boost':
        if (effect.speedMultiplier) {
          this.speed = Math.floor(this.originalStats[buffType].speed * effect.speedMultiplier);
        }
        if (effect.attackSpeedMultiplier) {
          this.basicAttackCooldown = Math.floor(this.originalStats[buffType].attackSpeed / effect.attackSpeedMultiplier);
        }
        break;
    }
  }

  /**
   * 버프 제거
   */
  removeBuff(buffType) {
    if (this.buffs.has(buffType)) {
      const buff = this.buffs.get(buffType);
      
      // 원본 스탯으로 복원
      if (this.originalStats[buffType]) {
        switch (buffType) {
          case 'attack_speed_boost':
            this.basicAttackCooldown = this.originalStats[buffType].attackSpeed;
            break;
          case 'speed_attack_boost':
            this.speed = this.originalStats[buffType].speed;
            this.basicAttackCooldown = this.originalStats[buffType].attackSpeed;
            break;
        }
      }
      
      this.buffs.delete(buffType);
      console.log(`버프 제거: ${buffType}`);
    }
  }

  /**
   * 만료된 버프 정리
   */
  cleanupExpiredBuffs() {
    const now = Date.now();
    const expiredBuffs = [];
    
    for (const [buffType, buff] of this.buffs) {
      if (now >= buff.endTime) {
        expiredBuffs.push(buffType);
      }
    }
    
    expiredBuffs.forEach(buffType => {
      this.removeBuff(buffType);
    });
  }

  /**
   * 버프 상태 가져오기
   */
  getBuffState() {
    const now = Date.now();
    const activeBuffs = {};
    
    for (const [buffType, buff] of this.buffs) {
      if (now < buff.endTime) {
        activeBuffs[buffType] = {
          remainingTime: buff.endTime - now,
          effect: buff.effect
        };
      }
    }
    
    return activeBuffs;
  }

  /**
   * 버프가 활성화되어 있는지 확인
   */
  hasBuff(buffType) {
    if (!this.buffs.has(buffType)) return false;
    
    const buff = this.buffs.get(buffType);
    return Date.now() < buff.endTime;
  }
}

module.exports = ServerPlayer; 