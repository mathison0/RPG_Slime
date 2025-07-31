const { getJobInfo, getSkillInfo } = require('../../shared/JobClasses.js');
const gameConfig = require('../config/GameConfig');
const MonsterConfig = require('../../shared/MonsterConfig');

/**
 * 스킬 관리 매니저
 * 모든 스킬의 데미지 계산과 효과를 중앙에서 관리
 */
class SkillManager {
  constructor(gameStateManager, projectileManager = null) {
    this.gameStateManager = gameStateManager;
    this.projectileManager = projectileManager;
    this.delayedDamageCallbacks = new Map(); // 지연된 데미지 콜백 저장
    this.socketEventManager = null;
    this.activeFields = []; // 활성화된 장판들을 추적
    this.fieldTickInterval = null; // 장판 데미지 처리 인터벌
    this.startFieldTick(); // 장판 틱 시작
  }

  /**
   * 지연된 데미지 콜백 등록
   */
  setDelayedDamageCallback(playerId, skillType, callback) {
    const key = `${playerId}_${skillType}`;
    this.delayedDamageCallbacks.set(key, callback);
  }

  /**
   * 지연된 데미지 콜백 호출
   */
  callDelayedDamageCallback(playerId, skillType, damageResult) {
    const key = `${playerId}_${skillType}`;
    const callback = this.delayedDamageCallbacks.get(key);
    if (callback) {
      callback(damageResult);
      this.delayedDamageCallbacks.delete(key);
    }
  }

  /**
   * 스킬 사용 시도
   */
  useSkill(player, skillType, targetX = null, targetY = null, options = {}) {
    console.log(`SkillManager useSkill 호출: player=${player.id}, skillType=${skillType}, targetX=${targetX}, targetY=${targetY}, options=`, options);
    // 죽은 플레이어는 스킬 사용 불가
    if (player.isDead) {
      return { success: false, error: 'Cannot use skills while dead' };
    }

    // 기절 상태에서는 스킬 사용 불가 (보호막 제외)
    if (player.isStunned && skillType !== 'shield') {
      return { success: false, error: 'Cannot use skills while stunned' };
    }

    // 기본 공격 처리 (별도 처리)
    if (skillType === 'basic_attack') {
      const basicAttackResult = this.handleBasicAttack(player, targetX, targetY);
      
      if (basicAttackResult.success) {
        // 기본 공격 데미지 처리
        const damageResult = this.applyBasicAttackDamage(player, basicAttackResult.skillInfo, player.x, player.y, targetX, targetY);
        basicAttackResult.damageResult = damageResult;
      }
      
      return basicAttackResult;
    }

    const skillInfo = getSkillInfo(player.jobClass, skillType);
    if (!skillInfo) {
      return { success: false, error: 'Invalid skill type' };
    }

    // 쿨타임 체크 (endTime 기반)
    const now = Date.now();
    const skillEndTime = player.skillCooldowns[skillType] || 0;
    if (now < skillEndTime) {
      return { success: false, error: 'Skill on cooldown' };
    }

    // 점프 중인 경우 스킬 사용 불가
    if (player.isJumping) {
      return { success: false, error: 'Cannot use skill while jumping' };
    }

    // 시전시간이 있는 스킬 사용 중인지 체크 (delay 속성이 있는 스킬들)
    const castingSkills = this.getCastingSkills(player);
    if (castingSkills.length > 0) {
      return { success: false, error: 'Cannot use skill while casting another skill' };
    }

    // 후딜레이 중인지 체크 (전체 스킬 완료까지)
    const inAfterDelay = this.isInAfterDelay(player);
    if (inAfterDelay) {
      return { success: false, error: 'Cannot use skill while in after delay' };
    }

    // 스킬 사용 처리 (endTime 저장) - 목긋기는 나중에 설정
    if (skillType !== 'backstab') {
      player.skillCooldowns[skillType] = now + skillInfo.cooldown;
    }
    
    // 액션 상태 업데이트 (버프/장판 스킬은 액션 상태 설정하지 않음)
    const duration = skillInfo.duration || 0;
    const delay = skillInfo.delay || 0;
    const afterDelay = skillInfo.afterDelay || 0;
    
    // 전체 스킬 완료 시간 = 시전시간 + 지속시간 + 후딜레이
    const totalSkillTime = Math.max(duration, delay) + afterDelay;
    
    // 버프/장판 스킬이 아닌 경우에만 액션 상태 설정
    const isBuffOrFieldSkill = this.isBuffOrFieldSkill(skillType);
    if (!isBuffOrFieldSkill && (duration > 0 || delay > 0 || afterDelay > 0)) {
      player.currentActions.skills.set(skillType, {
        startTime: now,
        duration: duration,
        delay: delay, // 시전시간 정보 추가
        afterDelay: afterDelay, // 후딜레이 시간 추가
        endTime: now + totalSkillTime, // 후딜레이까지 포함한 전체 완료 시간
        skillInfo: {
          range: this.calculateSkillRange(player, skillType, skillInfo.range),
          damage: this.calculateSkillDamage(player, skillType, skillInfo.damage),
          duration: duration,
          delay: delay,
          afterDelay: afterDelay,
          heal: skillInfo.heal || 0
        }
      });
    }
    
    // 서버에서 모든 스킬 정보를 클라이언트에 전송 (확장성 고려)
    const completeSkillInfo = {
      // 기본 정보
      range: this.calculateSkillRange(player, skillType, skillInfo.range),
      damage: this.calculateSkillDamage(player, skillType, skillInfo.damage),
      duration: duration,
      delay: delay, // 시전시간 정보 추가
      afterDelay: afterDelay, // 후딜레이 시간 추가
      heal: skillInfo.heal || 0,
      cooldown: skillInfo.cooldown || 0,
      
      // 확장 정보 (스킬별로 다를 수 있는 정보들)
      ...(skillInfo.angleOffset !== undefined && { angleOffset: skillInfo.angleOffset }),
      ...(skillInfo.delay !== undefined && { delay: skillInfo.delay }),
      ...(skillInfo.stunDuration !== undefined && { stunDuration: skillInfo.stunDuration }),
      ...(skillInfo.width !== undefined && { width: skillInfo.width }),
      ...(skillInfo.radius !== undefined && { radius: skillInfo.radius }),
      ...(skillInfo.speed !== undefined && { speed: skillInfo.speed }),
      ...(skillInfo.projectileCount !== undefined && { projectileCount: skillInfo.projectileCount }),
      ...(skillInfo.spreadAngle !== undefined && { spreadAngle: skillInfo.spreadAngle }),
      ...(skillInfo.piercing !== undefined && { piercing: skillInfo.piercing }),
      ...(skillInfo.bounces !== undefined && { bounces: skillInfo.bounces }),
      ...(skillInfo.chargeTime !== undefined && { chargeTime: skillInfo.chargeTime }),
      ...(skillInfo.chargeDistance !== undefined && { chargeDistance: skillInfo.chargeDistance }),
      
      // 원본 스킬 정보도 포함 (추가 확장을 위해)
      originalSkillInfo: skillInfo
    };

    const result = {
      success: true,
      skillType,
      endTime: now + totalSkillTime, // 스킬 완료 시간 (후딜레이 포함)
      playerId: player.id,
      x: player.x,
      y: player.y,
      targetX,
      targetY,
      skillInfo: completeSkillInfo,
      options: options // options 객체 추가
    };
    
    // 와드 스킬의 경우 추가 정보 설정 (서포터만)
    if (skillType === 'ward') {
      // 와드 개수 제한 체크 (최대 2개)
      if (!player.wardList) {
        player.wardList = [];
      }
      
      // 기존 와드가 2개 이상이면 가장 오래된 와드 제거
      if (player.wardList.length >= 2) {
        const oldestWard = player.wardList.shift();
        console.log(`기존 와드 제거: ${oldestWard.id}`);
      }
      
      // 새 와드 정보 생성
      let wardX, wardY;
      
      if (targetX !== null && targetY !== null) {
        // 마우스 위치가 지정된 경우 사정거리 체크 및 클램핑
        const castRange = skillInfo.castRange || 300; // 기본 사정거리 300
        const deltaX = targetX - player.x;
        const deltaY = targetY - player.y;
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        
        if (distance > castRange) {
          // 사정거리 초과 시 방향은 유지하되 최대 거리로 클램핑
          const ratio = castRange / distance;
          wardX = player.x + deltaX * ratio;
          wardY = player.y + deltaY * ratio;
          console.log(`와드 사정거리 클램핑: 요청 거리=${Math.round(distance)}, 최대 거리=${castRange}, 클램핑된 위치=(${Math.round(wardX)}, ${Math.round(wardY)})`);
        } else {
          // 사정거리 내에 있으면 마우스 위치에 설치
          wardX = targetX;
          wardY = targetY;
        }
      } else {
        // 마우스 위치가 지정되지 않은 경우 플레이어 위치에 설치
        wardX = player.x;
        wardY = player.y;
      }
      
      const newWard = {
        id: Date.now() + Math.random(), // 고유 ID
        x: wardX,
        y: wardY,
        range: completeSkillInfo.range,
        duration: completeSkillInfo.duration,
        createdAt: Date.now(),
        playerId: player.id,
        team: player.team
      };
      
      // 와드 리스트에 추가
      player.wardList.push(newWard);
      
    }
    
    // 직업별 스킬 사용 로직 호출 (구르기, 집중 등)
    console.log(`플레이어 job 확인: job=${player.job}, jobClass=${player.jobClass}`);
    if (player.job && player.job.useSkill) {
      console.log(`직업별 스킬 사용 로직 호출: ${skillType}`);
      // targetX, targetY를 options에 포함시켜서 전달
      const extendedOptions = {
        ...options,
        targetX: targetX,
        targetY: targetY
      };
      const jobResult = player.job.useSkill(skillType, extendedOptions);
      if (jobResult && jobResult.success) {
        // 직업별 결과와 기본 결과 병합
        Object.assign(result, jobResult);
      }
    } else {
      console.log(`직업별 스킬 사용 로직 호출 실패: job=${player.job}, useSkill=${player.job ? player.job.useSkill : 'undefined'}`);
    }
    
    return result;
  }

  /**
   * 점프 시작 처리
   */
  startJump(player, duration = gameConfig.PLAYER.SKILLS.JUMP_DURATION) {
    if (player.isJumping) {
      return false;
    }
    
    const now = Date.now();
    player.isJumping = true;
    player.currentActions.jump = {
      startTime: now,
      duration: duration,
      endTime: now + duration
    };
    
    return true;
  }

  /**
   * 점프 종료 처리
   */
  endJump(player) {
    player.isJumping = false;
    player.currentActions.jump = null;
  }

  /**
   * 액션 상태 정리 (만료된 액션들 제거)
   */
  cleanupExpiredActions(player) {
    const now = Date.now();
    
    // 점프 상태 확인
    if (player.currentActions.jump && now >= player.currentActions.jump.endTime) {
      this.endJump(player);
    }
    
    // 스킬 상태 확인
    for (const [skillType, skillAction] of player.currentActions.skills) {
      if (now >= skillAction.endTime) {
        player.currentActions.skills.delete(skillType);
      }
    }
  }

  /**
   * 현재 시전 중인 스킬들 반환 (delay 속성이 있는 스킬들만)
   */
  getCastingSkills(player) {
    const now = Date.now();
    const castingSkills = [];
    
    // 만료된 액션들 먼저 정리
    this.cleanupExpiredActions(player);
    
    for (const [skillType, skillAction] of player.currentActions.skills) {
      // delay 속성이 있고 아직 시전시간이 끝나지 않은 스킬들
      if (skillAction.delay > 0 && now < skillAction.startTime + skillAction.delay) {
        castingSkills.push({
          skillType,
          endTime: skillAction.startTime + skillAction.delay
        });
      }
    }
    
    return castingSkills;
  }

  /**
   * 플레이어가 현재 캐스팅 중인지 확인 (이동 및 다른 스킬 사용 불가 상태)
   * 시전중, 발동중(버프/장판 제외), 후딜레이중일 때 true 반환
   */
  isCasting(player) {
    const now = Date.now();
    
    // 만료된 액션들 먼저 정리
    this.cleanupExpiredActions(player);
    
    for (const [skillType, skillAction] of player.currentActions.skills) {
      // 버프기나 장판기는 캐스팅 상태로 간주하지 않음
      const isBuffOrFieldSkill = this.isBuffOrFieldSkill(skillType);
      if (isBuffOrFieldSkill) {
        continue; // 버프/장판 스킬은 캐스팅 체크에서 제외
      }
      
      // 1. 시전시간 중 (delay > 0이고 아직 시전시간이 끝나지 않음)
      if (skillAction.delay > 0 && now < skillAction.startTime + skillAction.delay) {
        return true;
      }
      
      // 2. 발동 중인 스킬들 (버프/장판 제외)
      if (skillAction.duration > 0 && 
          now >= skillAction.startTime + skillAction.delay && 
          now < skillAction.startTime + skillAction.delay + skillAction.duration) {
        return true;
      }
      
      // 3. 후딜레이 중 (전체 스킬 완료까지)
      if (skillAction.afterDelay > 0 && now < skillAction.endTime) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * 버프기나 장판기인지 확인
   * 이런 스킬들은 지속시간이 있어도 플레이어가 자유롭게 이동할 수 있어야 함
   */
  isBuffOrFieldSkill(skillType) {
    const buffOrFieldSkills = [
      'stealth',      // 은신 (어쌔신, 닌자)
      'shield',       // 보호막 (마법사)
      'focus',        // 집중 (궁수)
      'blade_dance',  // 칼춤 (어쌔신) - 공격력 버프
      'ward',         // 와드 (서포터)
      'buff_field',   // 버프 장판 (서포터)
      'heal_field',   // 힐 장판 (서포터)
      'ice_field',    // 얼음 장판 (마법사)
      'roar'          // 전사 포효 (버프 효과)
    ];
    
    return buffOrFieldSkills.includes(skillType);
  }

  /**
   * 후딜레이 중인지 확인 (전체 스킬 완료까지)
   */
  isInAfterDelay(player) {
    const now = Date.now();
    
    // 만료된 액션들 먼저 정리
    this.cleanupExpiredActions(player);
    
    for (const [skillType, skillAction] of player.currentActions.skills) {
      // 버프기나 장판기는 후딜레이 체크에서 제외
      const isBuffOrFieldSkill = this.isBuffOrFieldSkill(skillType);
      if (isBuffOrFieldSkill) {
        continue;
      }
      
      // 스킬이 아직 완전히 끝나지 않았다면 (후딜레이 포함)
      if (now < skillAction.endTime) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * 플레이어의 모든 스킬 시전을 취소
   */
  cancelAllCasting(player) {
    const cancelledSkills = [];
    
    // 현재 시전 중인 스킬들을 기록
    for (const [skillType, skillAction] of player.currentActions.skills) {
      if (skillAction.delay > 0) {
        cancelledSkills.push(skillType);
      }
    }
    
    // 모든 스킬 액션 정리
    player.currentActions.skills.clear();
    
    // 지연된 액션들 모두 취소
    const cancelledDelayedActions = [];
    for (const [actionId, timeoutId] of player.delayedActions) {
      clearTimeout(timeoutId);
      cancelledDelayedActions.push(actionId);
    }
    player.delayedActions.clear();
    
    console.log(`플레이어 ${player.id}의 스킬 시전 취소: ${cancelledSkills.join(', ')}`);
    if (cancelledDelayedActions.length > 0) {
      console.log(`플레이어 ${player.id}의 지연된 액션 취소: ${cancelledDelayedActions.join(', ')}`);
    }
    
    return cancelledSkills;
  }

  /**
   * 스킬 범위 계산 (슬라임은 크기에 비례)
   */
  calculateSkillRange(player, skillType, baseRange) {
    if (player.jobClass === 'slime' && skillType === 'spread') {
      // 슬라임 퍼지기는 크기에 비례 (기본 크기는 Config에서 가져옴)
      return Math.round(baseRange * (player.size / gameConfig.PLAYER.SKILLS.BASE_RANGE_REFERENCE));
    }
    return baseRange;
  }

  /**
   * 스킬 데미지 계산
   */
  calculateSkillDamage(player, skillType, baseDamage) {
    if (typeof baseDamage === 'string') {
      // 문자열 수식 처리 (예: 'attack', 'attack * 1.5')
      if (baseDamage === 'attack') {
        baseDamage = player.attack;
      } else if (baseDamage.includes('attack')) {
        // 간단한 수식 계산 (attack * 1.5 등)
        baseDamage = this.parseFormula(baseDamage, player.attack);
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
   * 기본 공격 데미지 적용
   */
  applyBasicAttackDamage(player, skillInfo, x, y, targetX, targetY) {
    const damageResult = {
      affectedEnemies: [],
      affectedPlayers: [],
      totalDamage: 0
    };

    const enemies = this.gameStateManager.enemies;
    const players = this.gameStateManager.players;
    let baseDamage = skillInfo.damage;

    // 어쌔신 은신 보너스 적용
    if (player.jobClass === 'assassin' && player.isStealth) {
      baseDamage = Math.floor(baseDamage * 2.5); // 은신 중 2.5배 데미지
    }

    // 직업별 기본 공격 처리
    switch (player.jobClass) {
      case 'slime':
      case 'ninja':
      case 'archer':
      case 'mage':
        // 원거리 투사체 공격
        return this.applyRangedBasicAttack(player, baseDamage, x, y, targetX, targetY);
        
      case 'assassin':
        // 어쌔신 근접 공격 (연속 공격)
        const result = this.applyAssassinBasicAttack(player, baseDamage, x, y, targetX, targetY);
        
        // 기본 공격 사용 시 은신 해제
        if (player.isStealth) {
          console.log(`어쌔신 ${player.id} 기본 공격으로 은신 해제`);
          
          // 스킬 정보에서 배율 가져오기
          const stealthSkillInfo = getSkillInfo(player.jobClass, 'stealth');
          const visionMultiplier = stealthSkillInfo?.visionMultiplier || 1.3;
          
          // 원본 시야 범위 저장
          const originalVisionRange = player.originalVisionRange || Math.round(player.visionRange / visionMultiplier);
          
          // 서버 플레이어의 은신 상태 및 스탯 복원
          player.job.endStealth(); 
          
          // 다시 모든 팀에게 보이도록 설정
          player.visibleToEnemies = true;
          
          // 클라이언트에게 은신 해제 이벤트 전송
          if (this.gameStateManager.io) {
            this.gameStateManager.io.emit('stealth-ended', {
              playerId: player.id,
              endTime: Date.now(),
              originalVisionRange: originalVisionRange
            });
          } else {
            console.log('gameStateManager.io가 null입니다');
          }
        }
        
        return result;
        
      case 'warrior':
      case 'supporter':
      case 'mechanic':
        // 근접 부채꼴 공격
        return this.applyMeleeBasicAttack(player, baseDamage, x, y, targetX, targetY);
        
      default:
        return damageResult;
    }
  }

  /**
   * 원거리 기본 공격 (투사체)
   */
  applyRangedBasicAttack(player, damage, x, y, targetX, targetY) {
    const damageResult = {
      affectedEnemies: [],
      affectedPlayers: [],
      totalDamage: 0
    };

    if (this.projectileManager) {
      // JobClasses에서 투사체 설정 가져오기
      const { getJobInfo } = require('../../shared/JobClasses.js');
      const jobInfo = getJobInfo(player.jobClass);
      const projectileSettings = jobInfo.projectile;
      
      if (!projectileSettings) {
        console.warn(`${player.jobClass}는 투사체 공격을 사용할 수 없습니다.`);
        return damageResult;
      }
      
      const projectileConfig = {
        playerId: player.id,
        x: x,
        y: y,
        targetX: targetX,
        targetY: targetY,
        damage: damage,
        speed: projectileSettings.speed,
        size: projectileSettings.size,
        jobClass: player.jobClass,
        attackType: 'basic'
      };
      
      const projectile = this.projectileManager.createProjectile(projectileConfig);
      
      if (projectile) {
        console.log(`원거리 기본 공격 투사체 생성: ${player.jobClass}, 데미지: ${damage}, 속도: ${projectileSettings.speed}, 크기: ${projectileSettings.size}`);
        damageResult.projectileCreated = true;
      }
    }

    return damageResult;
  }

  /**
   * 근접 기본 공격 (부채꼴)
   */
  applyMeleeBasicAttack(player, damage, x, y, targetX, targetY) {
    const damageResult = {
      affectedEnemies: [],
      affectedPlayers: [],
      totalDamage: 0
    };

    const range = 80; // 근접 공격 범위
    const angleOffset = Math.PI / 3; // 60도 부채꼴

    // 적 대상
    const enemies = this.gameStateManager.enemies;
    const enemyArray = Array.isArray(enemies) ? enemies : Array.from(enemies.values());
    
    enemyArray.forEach(enemy => {
      if (enemy.isDead) return;

      // 캐릭터 크기를 고려한 충돌 검사
      const effectiveRange = range + (enemy.size || 32) / 2;
      if (this.isInMeleeSweepRange(x, y, enemy.x, enemy.y, targetX, targetY, effectiveRange, angleOffset)) {
        const result = this.gameStateManager.takeDamage(player, enemy, damage);
        
        if (result.success) {
          damageResult.affectedEnemies.push({
            id: enemy.id,
            damage: damage,
            actualDamage: result.actualDamage,
            x: enemy.x,
            y: enemy.y
          });
          damageResult.totalDamage += result.actualDamage;
        }
      }
    });

    // 다른 플레이어 대상
    const players = this.gameStateManager.players;
    const playerArray = Array.isArray(players) ? players : Array.from(players.values());
    
    playerArray.forEach(targetPlayer => {
      if (targetPlayer.isDead || targetPlayer.team === player.team || targetPlayer.id === player.id) return;

      // 캐릭터 크기를 고려한 충돌 검사
      const effectiveRange = range + (targetPlayer.size || 32) / 2;
      if (this.isInMeleeSweepRange(x, y, targetPlayer.x, targetPlayer.y, targetX, targetY, effectiveRange, angleOffset)) {
        const result = this.gameStateManager.takeDamage(player, targetPlayer, damage);
        
        if (result.success) {
          damageResult.affectedPlayers.push({
            id: targetPlayer.id,
            damage: damage,
            actualDamage: result.actualDamage,
            x: targetPlayer.x,
            y: targetPlayer.y
          });
          damageResult.totalDamage += result.actualDamage;
        }
      }
    });

    return damageResult;
  }

  /**
   * 어쌔신 기본 공격 (직사각형 범위)
   */
  applyAssassinBasicAttack(player, damage, x, y, targetX, targetY) {
    const damageResult = {
      affectedEnemies: [],
      affectedPlayers: [],
      totalDamage: 0
    };

    const width = 40; // 직사각형 너비 (클라이언트 이펙트와 맞춤)
    const height = 60; // 직사각형 높이 (클라이언트 이펙트와 맞춤)

    // 적 대상
    const enemies = this.gameStateManager.enemies;
    const enemyArray = Array.isArray(enemies) ? enemies : Array.from(enemies.values());
    
    enemyArray.forEach(enemy => {
      if (enemy.isDead) return;

      // 캐릭터 크기를 고려한 충돌 검사
      const effectiveWidth = width + (enemy.size || 32);
      const effectiveHeight = height + (enemy.size || 32);
      
      if (this.isInRectangleRange(x, y, enemy.x, enemy.y, targetX, targetY, effectiveWidth, effectiveHeight)) {
        const result = this.gameStateManager.takeDamage(player, enemy, damage);
        
        if (result.success) {
          damageResult.affectedEnemies.push({
            id: enemy.id,
            damage: damage,
            actualDamage: result.actualDamage,
            x: enemy.x,
            y: enemy.y
          });
          damageResult.totalDamage += result.actualDamage;
        }
      }
    });

    // 다른 플레이어 대상
    const players = this.gameStateManager.players;
    const playerArray = Array.isArray(players) ? players : Array.from(players.values());
    
    playerArray.forEach(targetPlayer => {
      if (targetPlayer.isDead || targetPlayer.team === player.team || targetPlayer.id === player.id) return;

      // 캐릭터 크기를 고려한 충돌 검사
      const effectiveWidth = width + (targetPlayer.size || 32);
      const effectiveHeight = height + (targetPlayer.size || 32);
      
      if (this.isInRectangleRange(x, y, targetPlayer.x, targetPlayer.y, targetX, targetY, effectiveWidth, effectiveHeight)) {
        const result = this.gameStateManager.takeDamage(player, targetPlayer, damage);
        
        if (result.success) {
          damageResult.affectedPlayers.push({
            id: targetPlayer.id,
            damage: damage,
            actualDamage: result.actualDamage,
            x: targetPlayer.x,
            y: targetPlayer.y
          });
          damageResult.totalDamage += result.actualDamage;
        }
      }
    });

    return damageResult;
  }

  /**
   * 마법 미사일 데미지 적용
   */
  applyMagicMissileDamage(player, x, y, targetX, targetY, damage, damageResult) {
    if (this.projectileManager) {
      const { getJobInfo } = require('../../shared/JobClasses.js');
      const jobInfo = getJobInfo(player.jobClass);
      const magicMissileSkill = jobInfo.skills.find(skill => skill.type === 'magic_missile');
      const projectileSettings = magicMissileSkill?.projectile || jobInfo.projectile;
      
      if (!projectileSettings) {
        console.warn(`${player.jobClass}의 마법 미사일 투사체 설정을 찾을 수 없습니다.`);
        return;
      }
      
      const projectileConfig = {
        playerId: player.id,
        x: x,
        y: y,
        targetX: targetX,
        targetY: targetY,
        damage: damage,
        speed: projectileSettings.speed,
        size: projectileSettings.size,
        jobClass: player.jobClass,
        attackType: 'magic_missile',
        explosionRadius: magicMissileSkill?.explosionRadius || 90
      };
      
      const projectile = this.projectileManager.createProjectile(projectileConfig);
      
      if (projectile) {
        console.log(`마법 미사일 투사체 생성: 데미지: ${damage}, 속도: ${projectileSettings.speed}, 크기: ${projectileSettings.size}, 폭발반경: ${projectileConfig.explosionRadius}`);
        damageResult.projectileCreated = true;
      }
    }
  }

  /**
   * 근접 부채꼴 범위 체크
   */
  isInMeleeSweepRange(centerX, centerY, targetX, targetY, mouseX, mouseY, range, angleOffset) {
    const distance = Math.sqrt((targetX - centerX) ** 2 + (targetY - centerY) ** 2);
    if (distance > range) return false;

    const angleToMouse = Math.atan2(mouseY - centerY, mouseX - centerX);
    const angleToTarget = Math.atan2(targetY - centerY, targetX - centerX);
    
    let angleDiff = Math.abs(angleToMouse - angleToTarget);
    if (angleDiff > Math.PI) {
      angleDiff = 2 * Math.PI - angleDiff;
    }
    
    return angleDiff <= angleOffset;
  }

  /**
   * 기본 공격 처리
   */
  handleBasicAttack(player, targetX, targetY) {
    const now = Date.now();

    // 기본 공격 쿨다운 체크 (endTime 기반)
    const { getJobInfo } = require('../../shared/JobClasses.js');
    const jobInfo = getJobInfo(player.jobClass);
    let cooldown = jobInfo.basicAttackCooldown;
    const basicAttackEndTime = player.skillCooldowns['basic_attack'] || 0;
    
    // 버프 효과 적용 (서버에서도 적용)
    if (player.hasBuff('attack_speed_boost')) {
      const buff = player.buffs.get('attack_speed_boost');
      if (buff && buff.effect && buff.effect.attackSpeedMultiplier) {
        const originalCooldown = cooldown;
        cooldown = Math.floor(cooldown / buff.effect.attackSpeedMultiplier);
      }
    }
    
    // 서포터 버프 장판 효과 적용
    if (player.hasBuff('speed_attack_boost')) {
      const buff = player.buffs.get('speed_attack_boost');
      if (buff && buff.effect && buff.effect.attackSpeedMultiplier) {
        const originalCooldown = cooldown;
        cooldown = Math.floor(cooldown / buff.effect.attackSpeedMultiplier);
      }
    }
    if (now < basicAttackEndTime) {
      const remainingTime = basicAttackEndTime - now;
      return { success: false, error: 'Basic attack on cooldown' };
    }

    // 기본 공격 쿨다운 설정 (endTime 저장)
    player.skillCooldowns['basic_attack'] = now + cooldown;
    
    return {
      success: true,
      skillType: 'basic_attack',
      timestamp: now,
      playerId: player.id,
      x: player.x,
      y: player.y,
      targetX,
      targetY,
      skillInfo: {
        range: 0, // 기본 공격은 범위가 없음
        damage: player.attack,
        duration: 0,
        heal: 0
      }
    };
  }

  /**
   * 스킬 데미지 계산 및 적용
   */
  applySkillDamage(player, skillType, skillInfo, x, y, targetX = null, targetY = null, options = {}) {
    const damageResult = {
      affectedEnemies: [],
      affectedPlayers: [],
      totalDamage: 0
    };

    // 기본 공격 처리
    if (skillType === 'basic_attack') {
      return this.applyBasicAttackDamage(player, skillInfo, x, y, targetX, targetY);
    }

    // 직업별 스킬 처리
    switch (player.jobClass) {
      case 'warrior':
        return this.applyWarriorSkill(player, skillType, skillInfo, x, y, targetX, targetY);
      case 'slime':
        return this.applySlimeSkill(player, skillType, skillInfo, x, y);
      case 'assassin':
        return this.applyAssassinSkill(player, skillType, skillInfo, x, y, targetX, targetY, options);
      case 'ninja':
        return this.applyNinjaSkill(player, skillType, skillInfo, x, y, targetX, targetY);
      case 'mage':
        return this.applyMageSkill(player, skillType, skillInfo, x, y, targetX, targetY);
      case 'archer':
        return this.applyArcherSkill(player, skillType, skillInfo, x, y, targetX, targetY);
      case 'supporter':
        return this.applySupporterSkill(player, skillType, skillInfo, x, y, targetX, targetY);
      case 'mechanic':
        return this.applyMechanicSkill(player, skillType, skillInfo, x, y, targetX, targetY);
      default:
        console.log(`Unknown job class for skill: ${player.jobClass}`);
        return damageResult;
    }
  }

  /**
   * 마법사 스킬 처리
   */
  applyMageSkill(player, skillType, skillInfo, x, y, targetX, targetY) {
    const damageResult = {
      affectedEnemies: [],
      affectedPlayers: [],
      totalDamage: 0
    };

    // JobClasses에서 마법사 정보 가져오기
    const { getJobInfo } = require('../../shared/JobClasses.js');
    const mageInfo = getJobInfo('mage');

    switch (skillType) {
      case 'ice_field':
        // 얼음 장판 사거리 클램핑 (JobClasses에서 maxCastRange 사용)
        const iceFieldSkill = mageInfo.skills.find(skill => skill.type === 'ice_field');
        const maxCastRange = iceFieldSkill?.maxCastRange || 300;
        
        let clampedTargetX = targetX;
        let clampedTargetY = targetY;
        
        if (targetX !== null && targetY !== null) {
          const deltaX = targetX - x;
          const deltaY = targetY - y;
          const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
          
          if (distance > maxCastRange) {
            // 사거리 초과 시 방향은 유지하되 최대 거리로 클램핑
            const ratio = maxCastRange / distance;
            clampedTargetX = x + deltaX * ratio;
            clampedTargetY = y + deltaY * ratio;
            console.log(`서버 얼음 장판 사거리 클램핑: 요청 거리=${Math.round(distance)}, 최대 거리=${maxCastRange}, 클램핑된 위치=(${Math.round(clampedTargetX)}, ${Math.round(clampedTargetY)})`);
          }
        }
        
        console.log(`얼음 장판 스킬 발사! 플레이어: ${player.id}, 위치: (${clampedTargetX}, ${clampedTargetY}), 범위: ${skillInfo.range}`);
        // 장판 시스템에 등록 (클램핑된 좌표 사용)
        this.addField('ice_field', player.id, clampedTargetX, clampedTargetY, skillInfo.range, skillInfo.duration, skillInfo.damage);
        // 초기 데미지는 없음 (0.5초 후부터 적용)
        break;
      case 'magic_missile':
        // 마법 미사일 사거리 클램핑 (JobClasses에서 range 사용) 
        const magicMissileSkill = mageInfo.skills.find(skill => skill.type === 'magic_missile');
        const magicMissileRange = magicMissileSkill?.range || 400;
        
        let clampedMissileX = targetX;
        let clampedMissileY = targetY;
        
        if (targetX !== null && targetY !== null) {
          const deltaX = targetX - x;
          const deltaY = targetY - y;
          const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
          
          if (distance > magicMissileRange) {
            // 사거리 초과 시 방향은 유지하되 최대 거리로 클램핑
            const ratio = magicMissileRange / distance;
            clampedMissileX = x + deltaX * ratio;
            clampedMissileY = y + deltaY * ratio;
            console.log(`서버 마법 미사일 사거리 클램핑: 요청 거리=${Math.round(distance)}, 최대 거리=${magicMissileRange}, 클램핑된 위치=(${Math.round(clampedMissileX)}, ${Math.round(clampedMissileY)})`);
          }
        }
        
        this.applyMagicMissileDamage(player, x, y, clampedMissileX, clampedMissileY, skillInfo.damage, damageResult);
        break;
      case 'shield':
        // 보호막은 데미지 없음, 방어 효과만
        break;
    }

    return damageResult;
  }

  /**
   * 서포터 스킬 처리
   */
  applySupporterSkill(player, skillType, skillInfo, x, y, targetX, targetY) {
    const damageResult = {
      affectedEnemies: [],
      affectedPlayers: [],
      totalDamage: 0
    };

    // JobClasses에서 서포터 정보 가져오기
    const { getJobInfo } = require('../../shared/JobClasses.js');
    const supporterInfo = getJobInfo('supporter');

    switch (skillType) {
      case 'ward':
        // 와드는 데미지 없음, 시야 효과만
        break;
      case 'buff_field':
        // 버프 장판 사거리 클램핑 (JobClasses에서 castRange 사용)
        const buffFieldSkill = supporterInfo.skills.find(skill => skill.type === 'buff_field');
        const buffMaxCastRange = buffFieldSkill?.castRange || 200;
        
        let clampedBuffX = targetX;
        let clampedBuffY = targetY;
        
        if (targetX !== null && targetY !== null) {
          const deltaX = targetX - x;
          const deltaY = targetY - y;
          const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
          
          if (distance > buffMaxCastRange) {
            // 사거리 초과 시 방향은 유지하되 최대 거리로 클램핑
            const ratio = buffMaxCastRange / distance;
            clampedBuffX = x + deltaX * ratio;
            clampedBuffY = y + deltaY * ratio;
            console.log(`서버 버프 장판 사거리 클램핑: 요청 거리=${Math.round(distance)}, 최대 거리=${buffMaxCastRange}, 클램핑된 위치=(${Math.round(clampedBuffX)}, ${Math.round(clampedBuffY)})`);
          }
        } else {
          // targetX, targetY가 null인 경우 플레이어 위치 사용
          clampedBuffX = x;
          clampedBuffY = y;
        }
        
        console.log(`버프 장판 스킬 발사! 플레이어: ${player.id}, 위치: (${clampedBuffX}, ${clampedBuffY}), 범위: ${skillInfo.range}`);
        // 장판 시스템에 등록 (클램핑된 좌표 사용)
        this.addField('buff_field', player.id, clampedBuffX, clampedBuffY, skillInfo.range, skillInfo.duration);
        
        // 위치 정보를 결과에 포함
        damageResult.x = clampedBuffX;
        damageResult.y = clampedBuffY;
        break;
      case 'heal_field':
        // 힐 장판 사거리 클램핑 (JobClasses에서 castRange 사용)
        const healFieldSkill = supporterInfo.skills.find(skill => skill.type === 'heal_field');
        const healMaxCastRange = healFieldSkill?.castRange || 250;
        
        let clampedHealX = targetX;
        let clampedHealY = targetY;
        
        if (targetX !== null && targetY !== null) {
          const deltaX = targetX - x;
          const deltaY = targetY - y;
          const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
          
          if (distance > healMaxCastRange) {
            // 사거리 초과 시 방향은 유지하되 최대 거리로 클램핑
            const ratio = healMaxCastRange / distance;
            clampedHealX = x + deltaX * ratio;
            clampedHealY = y + deltaY * ratio;
            console.log(`서버 힐 장판 사거리 클램핑: 요청 거리=${Math.round(distance)}, 최대 거리=${healMaxCastRange}, 클램핑된 위치=(${Math.round(clampedHealX)}, ${Math.round(clampedHealY)})`);
          }
        } else {
          // targetX, targetY가 null인 경우 플레이어 위치 사용
          clampedHealX = x;
          clampedHealY = y;
        }
        
        console.log(`힐 장판 스킬 발사! 플레이어: ${player.id}, 위치: (${clampedHealX}, ${clampedHealY}), 범위: ${skillInfo.range}`);
        // 장판 시스템에 등록 (클램핑된 좌표 사용)
        const healAmount = skillInfo.heal || 20;
        this.addField('heal_field', player.id, clampedHealX, clampedHealY, skillInfo.range, skillInfo.duration, 0, healAmount);
        
        // 위치 정보를 결과에 포함
        damageResult.x = clampedHealX;
        damageResult.y = clampedHealY;
        break;
    }

    return damageResult;
  }

  /**
   * 슬라임 스킬 처리
   */
  applySlimeSkill(player, skillType, skillInfo, x, y) {
    const damageResult = {
      affectedEnemies: [],
      affectedPlayers: [],
      totalDamage: 0
    };

    if (skillType === 'spread') {
      this.applySpreadDamage(player, x, y, skillInfo.range, skillInfo.damage, damageResult, skillInfo);
    }

    return damageResult;
  }

  /**
   * 전사 스킬 처리
   */
  applyWarriorSkill(player, skillType, skillInfo, x, y, targetX, targetY) {
    const damageResult = {
      affectedEnemies: [],
      affectedPlayers: [],
      totalDamage: 0
    };

    const enemies = this.gameStateManager.enemies;
    const players = this.gameStateManager.players;
    const range = skillInfo.range;
    const damage = skillInfo.damage;

    switch (skillType) {
      case 'roar':
        break;

      case 'sweep':
        // 휩쓸기는 지연 데미지 처리
        const sweepDelay = skillInfo.delay || 1000;
        
        setTimeout(() => {
          if (player.isDead) {
            console.log(`휩쓸기 스킬 취소: 플레이어 ${player.id}가 사망함`);
            return;
          }
          
          const actualDamageResult = {
            affectedEnemies: [],
            affectedPlayers: [],
            totalDamage: 0
          };
          
          this.applySweepDamage(player, enemies, players, x, y, targetX, targetY, range, damage, actualDamageResult, skillInfo);
          this.callDelayedDamageCallback(player.id, 'sweep', actualDamageResult);
        }, sweepDelay);
        break;

      case 'thrust':
        // 찌르기는 지연 데미지 처리
        const thrustDelay = skillInfo.delay || 1500;
        
        setTimeout(() => {
          if (player.isDead) {
            console.log(`찌르기 스킬 취소: 플레이어 ${player.id}가 사망함`);
            return;
          }
          
          const actualDamageResult = {
            affectedEnemies: [],
            affectedPlayers: [],
            totalDamage: 0
          };
          
          this.applyThrustDamage(player, enemies, players, x, y, targetX, targetY, range, damage, actualDamageResult, skillInfo);
          this.callDelayedDamageCallback(player.id, 'thrust', actualDamageResult);
        }, thrustDelay);
        break;
    }

    return damageResult;
  }

  /**
   * 어쌔신 스킬 처리
   */
  applyAssassinSkill(player, skillType, skillInfo, x, y, targetX, targetY, options = {}) {
    const damageResult = {
      affectedEnemies: [],
      affectedPlayers: [],
      totalDamage: 0
    };

    switch (skillType) {
      case 'stealth':
        // 은신 스킬 처리 - 직접 구현
        if (player.isStealth) {
          console.log('이미 은신 중입니다.');
          return damageResult;
        }
        
        // 은신 상태 활성화
        player.isStealth = true;
        player.stealthStartTime = Date.now();
        player.stealthDuration = skillInfo.duration;
        player.stealthEndTime = player.stealthStartTime + skillInfo.duration;
        
        // 다른 팀에게는 보이지 않도록 설정
        player.visibleToEnemies = false;

        // 스킬 정보에서 배율 가져오기
        const speedMultiplier = skillInfo?.speedMultiplier || 1.2;
        const visionMultiplier = skillInfo?.visionMultiplier || 1.3;

        // 은신 중 이동속도 증가
        player.originalSpeed = player.speed || 1;
        player.speed = player.originalSpeed * speedMultiplier;

        // 은신 중 시야 범위 증가
        player.originalVisionRange = player.visionRange || 1;
        player.visionRange = player.originalVisionRange * visionMultiplier;

        console.log(`어쌔신 은신 발동! 지속시간: ${skillInfo.duration}ms, 종료시간: ${player.stealthEndTime}`);

        // 은신 상태 정보를 damageResult에 포함
        damageResult.stealthData = {
          startTime: player.stealthStartTime,
          endTime: player.stealthEndTime,
          duration: skillInfo.duration,
          speedMultiplier: speedMultiplier,
          visionMultiplier: visionMultiplier
        };
        break;
        
      case 'blade_dance':
        // 칼춤 스킬 처리 - 직접 구현
        const attackPowerMultiplier = skillInfo?.attackPowerMultiplier || 2.5;
        
        // 새로운 버프 시스템 사용
        const bladeDanceEffect = {
          attackPowerMultiplier: attackPowerMultiplier
        };
        player.applyBuff('attack_power_boost', skillInfo.duration, bladeDanceEffect);

        // 칼춤 스킬 종료 시간 계산
        const endTime = Date.now() + skillInfo.duration;

        console.log(`어쌔신 칼춤 발동! 지속시간: ${skillInfo.duration}ms, 종료시간: ${endTime}`);

        // 공격력 증가 버프 정보를 damageResult에 포함
        damageResult.bladeDanceData = {
          endTime: endTime,
          duration: skillInfo.duration,
          attackPowerMultiplier: attackPowerMultiplier
        };
        break;
        
      case 'backstab':
        // 목긋기 스킬 처리 - 서버에서 마우스 위치로 대상 찾기 및 위치 계산
        console.log('목긋기 스킬 options 확인:', options);
        
        try {
          const { mouseX, mouseY } = options;
          if (mouseX === undefined || mouseY === undefined) {
            console.log('목긋기: 마우스 위치 정보가 없습니다.');
            console.log('options 객체 내용:', options);
            return damageResult;
          }

        // 마우스 위치에서 대상 찾기 (플레이어 또는 몬스터)
        let target = null;
        let isMonster = false;
        const backstabRange = skillInfo.range || 200;
        const cursorRange = 30; // 커서 기준 범위 (픽셀 단위)

        // 플레이어들 중에서 찾기
        console.log(`목긋기: 플레이어 검색 시작 - 총 ${this.gameStateManager.players.size}명의 플레이어`);
        for (const [playerId, otherPlayer] of this.gameStateManager.players) {
          console.log(`목긋기: 플레이어 ${playerId} 검사 - 팀: ${otherPlayer.team}, 내 팀: ${player.team}, 사망: ${otherPlayer.isDead}`);
          
          if (playerId === player.id) {
            console.log(`목긋기: 자신 제외`);
            continue; // 자신 제외
          }
          if (otherPlayer.isDead) {
            console.log(`목긋기: 사망한 플레이어 제외`);
            continue; // 사망한 플레이어 제외
          }
          if (otherPlayer.team === player.team) {
            console.log(`목긋기: 같은 팀 제외`);
            continue; // 같은 팀 제외
          }

          // 마우스 커서와 플레이어 사이의 거리 확인
          const cursorDistance = Math.sqrt(
            Math.pow(mouseX - otherPlayer.x, 2) + 
            Math.pow(mouseY - otherPlayer.y, 2)
          );
          
          console.log(`목긋기: 플레이어 ${playerId} - 커서 거리: ${cursorDistance}, 커서 범위: ${cursorRange}`);
          
          if (cursorDistance <= cursorRange) {
            // 목긋기 사거리 확인
            const playerDistance = Math.sqrt(
              Math.pow(player.x - otherPlayer.x, 2) + 
              Math.pow(player.y - otherPlayer.y, 2)
            );
            
            console.log(`목긋기: 플레이어 ${playerId} - 사거리: ${playerDistance}, 목긋기 범위: ${backstabRange}`);
            
                    if (playerDistance <= backstabRange) {
          target = otherPlayer;
          console.log(`목긋기: 플레이어 ${playerId}를 대상으로 선택!`);
          console.log(`목긋기: 대상 객체 타입:`, typeof target);
          console.log(`목긋기: 대상 객체 메서드들:`, Object.getOwnPropertyNames(target));
          console.log(`목긋기: takeDamage 메서드 존재:`, typeof target.takeDamage);
          break;
        } else {
          console.log(`목긋기: 플레이어 ${playerId} - 사거리 밖`);
        }
          } else {
            console.log(`목긋기: 플레이어 ${playerId} - 커서 범위 밖`);
          }
        }

        // 플레이어에서 찾지 못했으면 몬스터에서 찾기
        if (!target) {
          for (const [enemyId, enemy] of this.gameStateManager.enemies) {
            if (enemy.isDead) continue; // 사망한 몬스터 제외

            // 마우스 커서와 몬스터 사이의 거리 확인
            const cursorDistance = Math.sqrt(
              Math.pow(mouseX - enemy.x, 2) + 
              Math.pow(mouseY - enemy.y, 2)
            );
            
            if (cursorDistance <= cursorRange) {
              // 목긋기 사거리 확인
              const playerDistance = Math.sqrt(
                Math.pow(player.x - enemy.x, 2) + 
                Math.pow(player.y - enemy.y, 2)
              );
              
              if (playerDistance <= backstabRange) {
                target = enemy;
                isMonster = true;
                break;
              }
            }
          }
        }

        if (!target) {
          console.log('목긋기: 마우스 위치에서 유효한 대상을 찾을 수 없습니다.');
          return { success: false, error: 'No valid target found' };
        }

        console.log(`목긋기 대상 탐지 성공!`);
        console.log(`- 대상 ID: ${target.id}`);
        console.log(`- 대상 타입: ${isMonster ? '몬스터' : '플레이어'}`);
        console.log(`- 대상 위치: (${target.x}, ${target.y})`);
        console.log(`- 플레이어 현재 위치: (${player.x}, ${player.y})`);
        console.log(`- 마우스 위치: (${mouseX}, ${mouseY})`);

        // 대상의 뒤쪽 위치 계산 (대상의 반대쪽으로 이동)
        const angleToTarget = Math.atan2(target.y - player.y, target.x - player.x);
        const teleportDistance = skillInfo.teleportDistance || 50;
        // 대상의 뒤쪽 = 대상 위치에서 플레이어 방향의 반대쪽
        const newX = target.x + Math.cos(angleToTarget) * teleportDistance;
        const newY = target.y + Math.sin(angleToTarget) * teleportDistance;

        console.log(`- 계산된 이동 좌표: (${newX}, ${newY})`);
        console.log(`- 각도: ${angleToTarget} (라디안)`);
        console.log(`- 텔레포트 거리: ${teleportDistance}`);

        // 플레이어 위치 이동
        player.x = newX;
        player.y = newY;

        // 데미지 계산
        let damage = player.attack * 3.0; // 기본 3배 데미지
        
        // 은신 중이면 보너스 데미지 추가 (은신 상태 유지)
        if (player.isStealth) {
          damage += player.attack * 5.0; // 은신 보너스 데미지 추가
        }

        // 대상에게 데미지 적용 (몬스터와 플레이어 구분)
        if (isMonster) {
          // 몬스터에게 데미지 적용
          if (this.gameStateManager.enemyManager) {
            this.gameStateManager.enemyManager.damageEnemy(target.id, damage, player.id);
          }
        } else {
          // 플레이어에게 데미지 적용
          const result = this.gameStateManager.takeDamage(player, target, damage);
          console.log(`목긋기: 플레이어 데미지 적용 결과:`, result);
        }
   
        console.log(`어쌔신 목긋기 발동! 대상: ${target.id} (${isMonster ? '몬스터' : '플레이어'}), 데미지: ${damage}, 새 위치: (${newX}, ${newY})`);

        // 목긋기 성공 시 쿨타임 설정
        player.skillCooldowns[skillType] = Date.now() + skillInfo.cooldown;
        
        // 목긋기 결과 정보를 damageResult에 포함 (모든 클라이언트에게 전송될 정보)
        damageResult.backstabData = {
          targetId: target.id,
          targetX: target.x,
          targetY: target.y,
          newX: newX,
          newY: newY,
          damage: damage,
          wasStealthAttack: player.isStealth,
          endTime: Date.now() + 500 // 0.5초 후 이동 완료
        };
        break;
      } catch (error) {
        console.error('목긋기 스킬 처리 중 에러 발생:', error);
        return damageResult;
      }
    }

    return damageResult;
  }

  /**
   * 닌자 스킬 처리
   */
  applyNinjaSkill(player, skillType, skillInfo, x, y, targetX, targetY) {
    const damageResult = {
      affectedEnemies: [],
      affectedPlayers: [],
      totalDamage: 0
    };

    switch (skillType) {
      case 'stealth':
        // 은신은 데미지 없음, 상태 효과만
        break;
    }

    return damageResult;
  }

  /**
   * 궁수 스킬 처리
   */
  applyArcherSkill(player, skillType, skillInfo, x, y, targetX, targetY) {
    const damageResult = {
      affectedEnemies: [],
      affectedPlayers: [],
      totalDamage: 0
    };

    switch (skillType) {
      case 'roll':
        // 구르기는 데미지 없음, 이동 효과만
        break;
      case 'focus':
        // 스킬 정보에서 배율 가져오기
        const attackSpeedMultiplier = skillInfo?.attackSpeedMultiplier || 2.0;
        
        // 집중 스킬 - 공격속도 증가 버프 적용
        // JobClasses에서 버프 효과 가져오기
        const { getJobInfo } = require('../../shared/JobClasses.js');
        const archerInfo = getJobInfo('archer');
        const focusSkill = archerInfo.skills.find(skill => skill.type === 'focus');
        
        const focusEffect = {
          attackSpeedMultiplier: focusSkill?.attackSpeedMultiplier || 2.0 // 공격속도 증가
        };
        player.applyBuff('attack_speed_boost', skillInfo.duration, focusEffect);
        
        // 클라이언트에게 버프 이벤트 전송 (버프 효과 정보 포함)
        if (this.gameStateManager.io) {
          this.gameStateManager.io.emit('player-buffed', {
            playerId: player.id,
            buffType: 'attack_speed_boost',
            duration: skillInfo.duration,
            effect: focusEffect // 버프 효과 정보 추가
          });
        }
        
        // 버프 만료 시 자동 제거를 위한 타이머 설정
        setTimeout(() => {
          if (player.hasBuff('attack_speed_boost')) {
            player.removeBuff('attack_speed_boost');
            
            // 클라이언트에게 버프 해제 이벤트 전송
            if (this.gameStateManager.io) {
              this.gameStateManager.io.emit('player-buff-removed', {
                playerId: player.id,
                buffType: 'attack_speed_boost'
              });
            }
          }
        }, skillInfo.duration);
        
        // 집중 스킬 정보를 damageResult에 포함
        damageResult.focusData = {
          endTime: Date.now() + skillInfo.duration,
          duration: skillInfo.duration,
          attackSpeedMultiplier: focusSkill?.attackSpeedMultiplier || 2.0
        };
        
        console.log(`궁수 ${player.id} 집중 스킬 사용 - 공격속도 증가 버프 적용`);
        break;
    }

    return damageResult;
  }

  /**
   * 메카닉 스킬 처리
   */
  applyMechanicSkill(player, skillType, skillInfo, x, y, targetX, targetY) {
    const damageResult = {
      affectedEnemies: [],
      affectedPlayers: [],
      totalDamage: 0
    };

    switch (skillType) {
      case 'repair':
        // 수리는 자가 회복만
        break;
    }

    return damageResult;
  }

  /**
   * 휩쓸기 데미지 적용
   */
  applySweepDamage(player, enemies, players, x, y, targetX, targetY, range, damage, damageResult, skillInfo = null) {
    const stunDuration = skillInfo?.stunDuration || 0;
    const enemyArray = Array.isArray(enemies) ? enemies : Array.from(enemies.values());
    const playerArray = Array.isArray(players) ? players : Array.from(players.values());

    // 적들 대상
    enemyArray.forEach(enemy => {
      if (enemy.isDead) return;
      
      // 캐릭터 크기를 고려한 충돌 검사
      const effectiveRange = range + (enemy.size || 32) / 2;
      const angleOffset = skillInfo?.angleOffset || Math.PI / 4; // 기본 45도
      const inRange = this.isInMeleeSweepRange(x, y, enemy.x, enemy.y, targetX, targetY, effectiveRange, angleOffset);
      
      if (inRange) {
        const result = this.gameStateManager.takeDamage(player, enemy, damage);
        
        if (result.success) {
          const enemyData = {
            id: enemy.id,
            damage: damage,
            actualDamage: result.actualDamage,
            x: enemy.x,
            y: enemy.y
          };
          
          if (stunDuration > 0) {
            enemy.startStun(stunDuration);
            enemyData.isStunned = true;
            enemyData.stunDuration = stunDuration;
          }
          
          damageResult.affectedEnemies.push(enemyData);
          damageResult.totalDamage += result.actualDamage;
        }
      }
    });

    // 다른 팀 플레이어들 대상
    playerArray.forEach(targetPlayer => {
      if (targetPlayer.isDead || targetPlayer.team === player.team || targetPlayer.id === player.id) return;
      
      // 캐릭터 크기를 고려한 충돌 검사
      const effectiveRange = range + (targetPlayer.size || 32) / 2;
      const angleOffset = skillInfo?.angleOffset || Math.PI / 4; // 기본 45도
      const inRange = this.isInMeleeSweepRange(x, y, targetPlayer.x, targetPlayer.y, targetX, targetY, effectiveRange, angleOffset);

      if (inRange) {
        const result = this.gameStateManager.takeDamage(player, targetPlayer, damage);
        
        if (result.success) {
          const playerData = {
            id: targetPlayer.id,
            damage: damage,
            actualDamage: result.actualDamage,
            x: targetPlayer.x,
            y: targetPlayer.y
          };
          
          if (stunDuration > 0) {
            targetPlayer.startStun(stunDuration);
            playerData.isStunned = true;
            playerData.stunDuration = stunDuration;
          }
          
          damageResult.affectedPlayers.push(playerData);
          damageResult.totalDamage += result.actualDamage;
        }
      }
    });
  }

  /**
   * 찌르기 데미지 적용
   */
  applyThrustDamage(player, enemies, players, x, y, targetX, targetY, range, damage, damageResult, skillInfo = null) {
    const stunDuration = skillInfo?.stunDuration || 0;
    const enemyArray = Array.isArray(enemies) ? enemies : Array.from(enemies.values());
    const playerArray = Array.isArray(players) ? players : Array.from(players.values());
    
    // 적들 대상
    enemyArray.forEach(enemy => {
      if (enemy.isDead) return;
      
      // 캐릭터 크기를 고려한 충돌 검사
      const effectiveRange = range + (enemy.size || 32) / 2;
      if (this.isInThrustRange(x, y, enemy.x, enemy.y, targetX, targetY, effectiveRange)) {
        const result = this.gameStateManager.takeDamage(player, enemy, damage);
        
        if (result.success) {
          const enemyData = {
            id: enemy.id,
            damage: damage,
            actualDamage: result.actualDamage,
            x: enemy.x,
            y: enemy.y
          };
          
          if (stunDuration > 0) {
            enemy.startStun(stunDuration);
            enemyData.isStunned = true;
            enemyData.stunDuration = stunDuration;
          }
          
          damageResult.affectedEnemies.push(enemyData);
          damageResult.totalDamage += result.actualDamage;
        }
      }
    });

    // 다른 팀 플레이어들 대상
    playerArray.forEach(targetPlayer => {
      if (targetPlayer.isDead || targetPlayer.team === player.team || targetPlayer.id === player.id) return;
      
      // 캐릭터 크기를 고려한 충돌 검사
      const effectiveRange = range + (targetPlayer.size || 32) / 2;
      if (this.isInThrustRange(x, y, targetPlayer.x, targetPlayer.y, targetX, targetY, effectiveRange)) {
        const result = this.gameStateManager.takeDamage(player, targetPlayer, damage);
        
        if (result.success) {
          const playerData = {
            id: targetPlayer.id,
            damage: damage,
            actualDamage: result.actualDamage,
            x: targetPlayer.x,
            y: targetPlayer.y
          };
          
          if (stunDuration > 0) {
            targetPlayer.startStun(stunDuration);
            playerData.isStunned = true;
            playerData.stunDuration = stunDuration;
          }
          
          damageResult.affectedPlayers.push(playerData);
          damageResult.totalDamage += result.actualDamage;
        }
      }
    });
  }

  /**
   * 퍼지기 데미지 적용
   */
  applySpreadDamage(player, x, y, range, damage, damageResult, skillInfo = null) {
    const stunDuration = skillInfo?.stunDuration || 0;
    const enemies = this.gameStateManager.enemies;
    const players = this.gameStateManager.players;

    // 적들 대상
    enemies.forEach(enemy => {
      if (enemy.isDead) return;
      
      const distance = Math.sqrt((enemy.x - x) ** 2 + (enemy.y - y) ** 2);
      // 캐릭터 크기를 고려한 충돌 검사
      const effectiveRange = range + (enemy.size || 32) / 2;
      
      if (distance <= effectiveRange) {
        const result = this.gameStateManager.takeDamage(player, enemy, damage);
        
        if (result.success) {
          const enemyData = {
            id: enemy.id,
            damage: damage,
            actualDamage: result.actualDamage,
            x: enemy.x,
            y: enemy.y
          };
          
          if (stunDuration > 0) {
            enemy.startStun(stunDuration);
            enemyData.isStunned = true;
            enemyData.stunDuration = stunDuration;
          }
          
          damageResult.affectedEnemies.push(enemyData);
          damageResult.totalDamage += result.actualDamage;
        }
      }
    });

    // 다른 팀 플레이어들 대상
    players.forEach(targetPlayer => {
      if (targetPlayer.id === player.id || targetPlayer.team === player.team || targetPlayer.hp <= 0) return;
      
      const distance = Math.sqrt((targetPlayer.x - x) ** 2 + (targetPlayer.y - y) ** 2);
      // 캐릭터 크기를 고려한 충돌 검사
      const effectiveRange = range + (targetPlayer.size || 32) / 2;
      
      if (distance <= effectiveRange) {
        const result = this.gameStateManager.takeDamage(player, targetPlayer, damage);
        
        if (result.success) {
          const playerData = {
            id: targetPlayer.id,
            damage: damage,
            actualDamage: result.actualDamage,
            x: targetPlayer.x,
            y: targetPlayer.y,
            team: targetPlayer.team
          };
          
          if (stunDuration > 0) {
            targetPlayer.startStun(stunDuration);
            playerData.isStunned = true;
            playerData.stunDuration = stunDuration;
          }
          
          damageResult.affectedPlayers.push(playerData);
          damageResult.totalDamage += result.actualDamage;
        }
      }
    });
  }

  /**
   * 장판 틱 시작 (0.5초마다)
   */
  startFieldTick() {
    this.fieldTickInterval = setInterval(() => {
      this.processActiveFields();
    }, 500); // 0.5초마다 처리
    }
    
  /**
   * 활성 장판들 처리
   */
  processActiveFields() {
    const now = Date.now();
    
    // 만료된 장판 제거
    this.activeFields = this.activeFields.filter(field => {
      if (now > field.endTime) {
        console.log(`장판 만료: ${field.type}, 위치: (${field.x}, ${field.y})`);
        return false;
      }
      return true;
    });

    // 각 장판에 대해 효과 처리
    this.activeFields.forEach(field => {
      switch (field.type) {
        case 'ice_field':
          this.processIceField(field);
          break;
        case 'heal_field':
          this.processHealField(field);
          break;
        case 'buff_field':
          this.processBuffField(field);
          break;
      }
    });
  }

  /**
   * 얼음 장판 처리 (0.5초마다 데미지 + 슬로우)
   */
  processIceField(field) {
    const enemies = this.gameStateManager.enemies;
    const players = this.gameStateManager.players;
    const attacker = this.gameStateManager.getPlayer(field.playerId);
    
    if (!attacker) return;
    
    // 적에게 데미지 및 슬로우 효과 적용
    const enemyArray = Array.isArray(enemies) ? enemies : Array.from(enemies.values());
    
    enemyArray.forEach(enemy => {
      if (enemy.isDead) return;

      const distance = Math.sqrt(
        Math.pow(enemy.x - field.x, 2) + Math.pow(enemy.y - field.y, 2)
      );
      
      // 캐릭터 크기를 고려한 충돌 검사
      const effectiveRange = field.range + (enemy.size || 32) / 2;
      
      if (distance <= effectiveRange) {
        // 데미지 적용 (0.5초마다)
        if (field.damage > 0) {
          const result = this.gameStateManager.takeDamage(attacker, enemy, field.damage);
          if (result.success) {
            console.log(`얼음 장판 지속 데미지: ${enemy.id}에게 ${result.actualDamage} 데미지`);
          }
        }
        
        // 슬로우 효과 유지/적용
        const wasSlowed = enemy.isSlowed;
        enemy.isSlowed = true;
        enemy.slowedUntil = Date.now() + 600; // 0.6초 후 해제 (다음 틱 전까지 유지)
        enemy.slowAmount = 0.5; // 50% 감소
        
        // 새로 슬로우가 걸린 경우에만 이벤트 전송
        if (!wasSlowed && this.gameStateManager.io) {
          this.gameStateManager.io.emit('enemy-slowed', {
          enemyId: enemy.id,
            isSlowed: true,
            duration: 600,
            speedReduction: 0.5
          });
        }
      } else {
        // 범위를 벗어난 경우 슬로우 해제 체크
        if (enemy.isSlowed && (!enemy.slowedUntil || Date.now() > enemy.slowedUntil)) {
          enemy.isSlowed = false;
          enemy.slowAmount = 1;
          
          // 슬로우 해제 이벤트 전송
          if (this.gameStateManager.io) {
        this.gameStateManager.io.emit('enemy-slowed', {
          enemyId: enemy.id,
              isSlowed: false
        });
          }
        }
      }
    });

    // 다른 플레이어에게도 데미지 적용 (PvP가 활성화된 경우)
    const playerArray = Array.from(players.values());
    playerArray.forEach(targetPlayer => {
      if (targetPlayer.id === field.playerId || targetPlayer.isDead) return;

      const distance = Math.sqrt(
        Math.pow(targetPlayer.x - field.x, 2) + Math.pow(targetPlayer.y - field.y, 2)
      );
      
      // 캐릭터 크기를 고려한 충돌 검사
      const effectiveRange = field.range + (targetPlayer.size || 32) / 2;
      
      if (distance <= effectiveRange) {
        // 데미지 적용
        if (field.damage > 0) {
          const result = this.gameStateManager.takeDamage(attacker, targetPlayer, field.damage);
          if (result.success) {
            console.log(`얼음 장판 지속 데미지: 플레이어 ${targetPlayer.id}에게 ${result.actualDamage} 데미지`);
          }
        }
        
        // 슬로우 효과 유지/적용
        const wasSlowed = targetPlayer.isSlowed;
        targetPlayer.isSlowed = true;
        targetPlayer.slowedUntil = Date.now() + 600;
        targetPlayer.slowAmount = 0.5;
        
        // 새로 슬로우가 걸린 경우에만 이벤트 전송
        if (!wasSlowed && this.gameStateManager.io) {
          this.gameStateManager.io.emit('player-slowed', {
            playerId: targetPlayer.id,
            effectId: `ice_field_${field.playerId}_${Date.now()}`,
            speedReduction: 0.5,
            duration: 600
          });
        }
      } else {
        // 범위를 벗어난 경우 슬로우 해제 체크
        if (targetPlayer.isSlowed && (!targetPlayer.slowedUntil || Date.now() > targetPlayer.slowedUntil)) {
          targetPlayer.isSlowed = false;
          targetPlayer.slowAmount = 1;
        
          // 슬로우 해제 이벤트 전송
          if (this.gameStateManager.io) {
        this.gameStateManager.io.emit('player-slowed', {
          playerId: targetPlayer.id,
              effectId: '',
              speedReduction: 1,
              duration: 0
        });
          }
        }
      }
    });
  }

  /**
   * 힐 장판 처리 (0.5초마다 힐)
   */
  processHealField(field) {
    const players = this.gameStateManager.players;
    const caster = players.get(field.playerId);
    
    // 시전자가 없으면 처리하지 않음
    if (!caster) return;
    
    const playerArray = Array.from(players.values());
    playerArray.forEach(player => {
      if (player.isDead) return;
      
      // 같은 팀만 치유
      if (player.team !== caster.team) return;

      const distance = Math.sqrt(
        Math.pow(player.x - field.x, 2) + Math.pow(player.y - field.y, 2)
      );
      
      // 캐릭터 크기를 고려한 충돌 검사
      const effectiveRange = field.range + (player.size || 32) / 2;
      
      if (distance <= effectiveRange && player.hp < player.maxHp) {
        // 정상적인 힐 시스템 사용 (JobClasses에서 힐량 가져오기)
        const { getJobInfo } = require('../../shared/JobClasses.js');
        const supporterInfo = getJobInfo('supporter');
        const healSkill = supporterInfo.skills.find(skill => skill.type === 'heal_field');
        
        // parseFormula를 사용하여 힐량 계산
        let healAmount = 20; // 기본값
        if (healSkill?.heal) {
          healAmount = this.parseFormula(healSkill.heal, caster.attack);
        } else if (field.heal) {
          healAmount = field.heal;
        }
        
        const healResult = this.gameStateManager.heal(caster, player, healAmount);
        
        if (healResult.success) {
          console.log(`힐 장판 효과: ${player.id}에게 ${healResult.actualHeal} 힐, 현재 HP: ${player.hp}/${player.maxHp} (힐 공식: ${healSkill?.heal}, caster attack: ${caster.attack})`);
        }
      }
    });
  }

  /**
   * 버프 장판 처리 (지속적인 버프 효과) - 얼음 장판과 동일한 로직
   */
  processBuffField(field) {
    console.log(`[processBuffField] 호출됨 - 위치: (${field.x}, ${field.y}), 범위: ${field.range}`);
    
    const players = this.gameStateManager.players;
    const caster = players.get(field.playerId);
    
    // 시전자가 없으면 처리하지 않음
    if (!caster) {
      console.log(`[processBuffField] 시전자 없음: ${field.playerId}`);
      return;
    }
    
    const playerArray = Array.from(players.values());
    console.log(`[processBuffField] 처리할 플레이어 수: ${playerArray.length}`);
    
    playerArray.forEach(player => {
      if (player.isDead) return;
      
      // 같은 팀만 버프
      if (player.team !== caster.team) return;

      const distance = Math.sqrt(
        Math.pow(player.x - field.x, 2) + Math.pow(player.y - field.y, 2)
      );
      
      // 캐릭터 크기를 고려한 충돌 검사
      const effectiveRange = field.range + (player.size || 32) / 2;
      
      console.log(`[processBuffField] 플레이어 ${player.id}: 거리=${Math.round(distance)}, 유효범위=${effectiveRange}, 범위내=${distance <= effectiveRange}`);
        
      if (distance <= effectiveRange) {
        // 버프 효과 유지/적용 (얼음 장판의 슬로우와 동일한 방식)
        const wasBuffed = player.isBuffed;
        player.isBuffed = true;
        player.buffedUntil = Date.now() + 600; // 0.6초 후 해제 (다음 틱 전까지 유지)
        
        console.log(`[processBuffField] 플레이어 ${player.id} 버프 적용: wasBuffed=${wasBuffed}`);
        
        // 실제 버프 효과 적용 (스탯 변경)
        if (!wasBuffed) {
          // JobClasses에서 버프 효과 가져오기
          const { getJobInfo } = require('../../shared/JobClasses.js');
          const supporterInfo = getJobInfo('supporter');
          const buffSkill = supporterInfo.skills.find(skill => skill.type === 'buff_field');
          
          // 버프 효과를 플레이어 속성에 직접 적용
          player.buffSpeedMultiplier = buffSkill?.speedMultiplier || 1.5;
          player.buffAttackSpeedMultiplier = buffSkill?.attackSpeedMultiplier || 1.5;
          
          // 실제 스탯 적용
          const originalSpeed = player.originalSpeed || player.speed;
          const originalAttackCooldown = player.originalBasicAttackCooldown || player.basicAttackCooldown;
          
          player.originalSpeed = originalSpeed;
          player.originalBasicAttackCooldown = originalAttackCooldown;
          
          player.speed = Math.floor(originalSpeed * player.buffSpeedMultiplier);
          player.basicAttackCooldown = Math.floor(originalAttackCooldown / player.buffAttackSpeedMultiplier);
          
          console.log(`[processBuffField] 플레이어 ${player.id} 스탯 변경: 속도 ${originalSpeed}→${player.speed}, 공격속도 ${originalAttackCooldown}→${player.basicAttackCooldown}`);
        }
        
        // 새로 버프가 걸린 경우에만 이벤트 전송 (얼음 장판과 동일한 방식)
        if (!wasBuffed && this.gameStateManager.io) {
          console.log(`[processBuffField] 플레이어 ${player.id}에게 버프 이벤트 전송`);
          this.gameStateManager.io.emit('player-buffed', {
            playerId: player.id,
            effectId: `buff_field_${field.playerId}_${Date.now()}`,
            speedMultiplier: player.buffSpeedMultiplier,
            attackSpeedMultiplier: player.buffAttackSpeedMultiplier,
            duration: 600
          });
        }
      } else {
        // 범위를 벗어난 경우 버프 해제 체크 (얼음 장판과 동일한 방식)
        if (player.isBuffed && (!player.buffedUntil || Date.now() > player.buffedUntil)) {
          console.log(`[processBuffField] 플레이어 ${player.id} 버프 해제 (범위 벗어남 또는 시간 만료)`);
          
          player.isBuffed = false;
          
          // 실제 버프 효과 해제 (스탯 복원)
          if (player.originalSpeed !== undefined) {
            player.speed = player.originalSpeed;
            player.originalSpeed = undefined;
          }
          if (player.originalBasicAttackCooldown !== undefined) {
            player.basicAttackCooldown = player.originalBasicAttackCooldown;
            player.originalBasicAttackCooldown = undefined;
          }
          
          // 버프 배율 정리
          player.buffSpeedMultiplier = undefined;
          player.buffAttackSpeedMultiplier = undefined;
        
          // 버프 해제 이벤트 전송 (얼음 장판과 동일한 방식)
          if (this.gameStateManager.io) {
            console.log(`[processBuffField] 플레이어 ${player.id}에게 버프 해제 이벤트 전송`);
            this.gameStateManager.io.emit('player-buffed', {
              playerId: player.id,
              effectId: '',
              speedMultiplier: 1,
              attackSpeedMultiplier: 1,
              duration: 0
            });
          }
        }
      }
    });
  }

  /**
   * 장판 추가
   */
  addField(type, playerId, x, y, range, duration, damage = 0, heal = 0) {
    const field = {
      type,
      playerId,
      x,
      y,
      range,
      damage,
      heal,
      startTime: Date.now(),
      endTime: Date.now() + duration
    };
    
    this.activeFields.push(field);
    console.log(`장판 추가: ${type}, 위치: (${x}, ${y}), 지속시간: ${duration}ms`);
  }

  /**
   * 소멸자 - 인터벌 정리
   */
  destroy() {
    if (this.fieldTickInterval) {
      clearInterval(this.fieldTickInterval);
      this.fieldTickInterval = null;
    }
  }

  /**
   * 직사각형 범위 체크 (어쌔신용)
   */
  isInRectangleRange(centerX, centerY, targetX, targetY, mouseX, mouseY, width, height) {
    // 마우스 방향으로의 각도 계산
    const angleToMouse = Math.atan2(mouseY - centerY, mouseX - centerX);
    
    // 직사각형의 중심점을 마우스 방향으로 이동
    const halfWidth = width / 2;
    const halfHeight = height / 2;
    
    // 직사각형의 중심점 계산 (플레이어 위치에서 마우스 방향으로)
    const rectCenterX = centerX + Math.cos(angleToMouse) * halfHeight;
    const rectCenterY = centerY + Math.sin(angleToMouse) * halfHeight;
    
    // 목표점을 직사각형 중심 기준으로 변환
    const relativeX = targetX - rectCenterX;
    const relativeY = targetY - rectCenterY;
    
    // 직사각형을 마우스 방향으로 회전
    const cos = Math.cos(-angleToMouse);
    const sin = Math.sin(-angleToMouse);
    
    // 회전된 좌표 계산
    const rotatedX = relativeX * cos - relativeY * sin;
    const rotatedY = relativeX * sin + relativeY * cos;
    
    // 직사각형 범위 내에 있는지 확인
    return Math.abs(rotatedX) <= halfWidth && Math.abs(rotatedY) <= halfHeight;
  }

  /**
   * 찌르기 범위 체크
   */
  isInThrustRange(centerX, centerY, targetX, targetY, mouseX, mouseY, range) {
    const distance = Math.sqrt((targetX - centerX) ** 2 + (targetY - centerY) ** 2);
    if (distance > range) return false;

    const angleToMouse = Math.atan2(mouseY - centerY, mouseX - centerX);
    const angleToTarget = Math.atan2(targetY - centerY, targetX - centerX);
    
    let angleDiff = Math.abs(angleToMouse - angleToTarget);
    if (angleDiff > Math.PI) {
      angleDiff = 2 * Math.PI - angleDiff;
    }
    
    const angleTolerance = Math.PI / 6; // 30도
    return angleDiff <= angleTolerance;
  }
}

module.exports = SkillManager; 