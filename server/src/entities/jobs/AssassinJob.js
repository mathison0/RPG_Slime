const BaseJob = require('./BaseJob');
const { getJobInfo } = require('../../../shared/JobClasses');

/**
 * 서버용 어쌔신 직업 클래스
 */
class AssassinJob extends BaseJob {
    constructor(player) {
        super(player);
        this.jobInfo = getJobInfo('assassin');
        this.basicAttackCooldown = this.jobInfo.basicAttackCooldown;
        this.lastBasicAttackTime = 0;
    }

    /**
     * 스킬 사용 (서버에서 처리)
     * @param {string} skillType - 스킬 타입
     * @param {Object} options - 추가 옵션
     * @returns {Object} - 스킬 사용 결과
     */
    useSkill(skillType, options = {}) {
        switch (skillType) {
            case 'stealth':
                return this.useStealth(options);
            case 'blade_dance':
                return this.useBladeDance(options);
            case 'backstab':
                return this.useBackstab(options);
            default:
                console.log('AssassinJob: 알 수 없는 스킬 타입:', skillType);
                return { success: false, reason: 'Unknown skill type' };
        }
    }

    /**
     * 은신 스킬 (서버에서 처리)
     * @param {Object} options - 스킬 옵션
     * @returns {Object} - 스킬 사용 결과
     */
    useStealth(options = {}) {
        // 쿨타임 체크
        if (!this.isSkillAvailable('stealth')) {
            return { 
                success: false, 
                reason: 'cooldown'
            };
        }

        // 죽은 상태면 스킬 사용 불가
        if (this.player.isDead) {
            return { success: false, reason: 'dead' };
        }

        // 이미 은신 중이면 사용 불가
        if (this.player.isStealth) {
            return { success: false, reason: 'already stealth' };
        }

        const skillInfo = this.getSkillInfo('stealth');
        if (!skillInfo) {
            return { success: false, reason: 'skill not found' };
        }

        // 쿨타임 설정
        this.setSkillCooldown('stealth');

        // 은신 상태 활성화
        this.player.isStealth = true;
        this.player.stealthStartTime = Date.now();
        this.player.stealthDuration = skillInfo.duration;
        this.player.stealthEndTime = this.player.stealthStartTime + skillInfo.duration;
        
        // 다른 팀에게는 보이지 않도록 설정
        this.player.visibleToEnemies = false;

        // 스킬 정보에서 배율 가져오기
        const stealthSkillInfo = this.getSkillInfo('stealth');
        const speedMultiplier = stealthSkillInfo?.speedMultiplier || 1.2;
        const visionMultiplier = stealthSkillInfo?.visionMultiplier || 1.3;

        // 은신 중 이동속도 증가
        this.player.originalSpeed = this.player.speed || 1;
        this.player.speed = this.player.originalSpeed * speedMultiplier;

        // 은신 중 시야 범위 증가
        this.player.originalVisionRange = this.player.visionRange || 1;
        this.player.visionRange = this.player.originalVisionRange * visionMultiplier;

        console.log(`어쌔신 은신 발동! 지속시간: ${skillInfo.duration}ms, 종료시간: ${this.player.stealthEndTime}`);

        return {
            success: true,
            skillType: 'stealth',
            duration: skillInfo.duration,
            startTime: this.player.stealthStartTime,
            endTime: this.player.stealthEndTime,
            bonusDamage: skillInfo.damage,
            speedMultiplier: speedMultiplier,
            visionMultiplier: visionMultiplier,
            caster: {
                id: this.player.id,
                x: this.player.x,
                y: this.player.y
            }
        };
    }

    /**
     * 칼춤 스킬 (서버에서 처리)
     * @param {Object} options - 스킬 옵션
     * @returns {Object} - 스킬 사용 결과
     */
    useBladeDance(options = {}) {
        // 쿨타임 체크
        if (!this.isSkillAvailable('blade_dance')) {
            return { 
                success: false, 
                reason: 'cooldown'
            };
        }

        // 죽은 상태면 스킬 사용 불가
        if (this.player.isDead) {
            return { success: false, reason: 'dead' };
        }

        const skillInfo = this.getSkillInfo('blade_dance');
        if (!skillInfo) {
            return { success: false, reason: 'skill not found' };
        }

        // 쿨타임 설정
        this.setSkillCooldown('blade_dance');

        // 스킬 정보에서 배율 가져오기
        const attackPowerMultiplier = skillInfo?.attackPowerMultiplier || 2.5;
        
        // 새로운 버프 시스템 사용
        const bladeDanceEffect = {
            attackPowerMultiplier: attackPowerMultiplier
        };
        this.player.applyBuff('attack_power_boost', skillInfo.duration, bladeDanceEffect);

        // 칼춤 스킬 종료 시간 계산
        const endTime = Date.now() + skillInfo.duration;

        console.log(`어쌔신 칼춤 발동! 지속시간: ${skillInfo.duration}ms, 종료시간: ${endTime}`);

        return {
            success: true,
            skillType: 'blade_dance',
            duration: skillInfo.duration,
            endTime: endTime,
            effect: skillInfo.effect,
            skillInfo: skillInfo,
            attackPowerMultiplier: attackPowerMultiplier,
            caster: {
                id: this.player.id,
                x: this.player.x,
                y: this.player.y
            }
        };
    }

    /**
     * 목긋기 스킬 (서버에서 처리)
     * @param {Object} options - 스킬 옵션 (targetId, targetX, targetY 포함)
     * @returns {Object} - 스킬 사용 결과
     */
    useBackstab(options = {}) {
        // 쿨타임 체크
        if (!this.isSkillAvailable('backstab')) {
            return { 
                success: false, 
                reason: 'cooldown'
            };
        }

        // 죽은 상태면 스킬 사용 불가
        if (this.player.isDead) {
            return { success: false, reason: 'dead' };
        }

        const skillInfo = this.getSkillInfo('backstab');
        if (!skillInfo) {
            return { success: false, reason: 'skill not found' };
        }

        // 대상 정보 확인
        const { targetId, targetX, targetY } = options;
        if (!targetId || targetX === undefined || targetY === undefined) {
            return { success: false, reason: 'invalid target' };
        }

                     // 대상 찾기 (플레이어 또는 몬스터)
             let target = this.player.gameState?.players?.get(targetId);
             let isMonster = false;
             
             if (!target) {
                 // 플레이어에서 찾지 못했으면 몬스터에서 찾기
                 target = this.player.gameState?.monsters?.get(targetId);
                 if (target) {
                     isMonster = true;
                 }
             }
             
             if (!target) {
                 return { success: false, reason: 'target not found' };
             }
             
             // 플레이어인 경우 같은 팀인지 확인 (목긋기는 상대팀에게만 사용 가능)
             if (!isMonster && target.team === this.player.team) {
                 return { success: false, reason: 'same team' };
             }

        // 거리 확인
        const distance = Math.sqrt(
            Math.pow(this.player.x - targetX, 2) + 
            Math.pow(this.player.y - targetY, 2)
        );
        
        if (distance > skillInfo.range) {
            return { success: false, reason: 'out of range' };
        }

        // 쿨타임 설정
        this.setSkillCooldown('backstab');

        // 대상의 뒤쪽 위치 계산
        const angleToTarget = Math.atan2(targetY - this.player.y, targetX - this.player.x);
        const teleportDistance = skillInfo.teleportDistance || 50;
        const newX = targetX - Math.cos(angleToTarget) * teleportDistance;
        const newY = targetY - Math.sin(angleToTarget) * teleportDistance;

        // 플레이어 위치 이동
        this.player.x = newX;
        this.player.y = newY;

        // 데미지 계산
        let damage = this.player.attack * 3.0; // 기본 3배 데미지
        
        // 은신 중이면 보너스 데미지 추가 (은신 상태 유지)
        if (this.player.isStealth) {
            const stealthSkillInfo = this.getSkillInfo('stealth');
            if (stealthSkillInfo) {
                damage += this.player.attack * 5.0; // 은신 보너스 데미지 추가
            }
        }

                     // 대상에게 데미지 적용
             target.takeDamage(damage, this.player.id);
       
             console.log(`어쌔신 목긋기 발동! 대상: ${targetId} (${isMonster ? '몬스터' : '플레이어'}), 데미지: ${damage}, 새 위치: (${newX}, ${newY})`);

        return {
            success: true,
            skillType: 'backstab',
            damage: damage,
            targetId: targetId,
            targetX: targetX,
            targetY: targetY,
            newX: newX,
            newY: newY,
            wasStealthAttack: this.player.isStealth,
            caster: {
                id: this.player.id,
                x: this.player.x,
                y: this.player.y
            }
        };
    }

    /**
     * 기본 공격 사용 가능 여부 확인
     * @returns {boolean} - 사용 가능 여부
     */
    canUseBasicAttack() {
        const now = Date.now();
        return now - this.lastBasicAttackTime >= this.basicAttackCooldown;
    }

    /**
     * 기본 공격 (서버에서 처리)
     * @param {number} targetX - 목표 X 좌표
     * @param {number} targetY - 목표 Y 좌표
     * @param {Object} options - 추가 옵션
     * @returns {Object} - 공격 결과
     */
    useBasicAttack(targetX, targetY, options = {}) {
        if (!this.canUseBasicAttack()) {
            return { 
                success: false, 
                reason: 'cooldown'
            };
        }

        if (this.player.isDead) {
            return { success: false, reason: 'dead' };
        }

        this.lastBasicAttackTime = Date.now();

        // 어쌔신은 쌍단검으로 각각 0.5배 데미지의 두 번 공격
        let damage = this.player.attack; // 기본 데미지 (0.5 + 0.5 = 1.0)
        let wasStealthAttack = false;
        
        // 은신 중이면 보너스 데미지 추가 적용
        if (this.player.isStealth) {
            const skillInfo = this.getSkillInfo('stealth');
            if (skillInfo) {
                damage += skillInfo.damage; // 은신 보너스 데미지 추가
            }
            wasStealthAttack = true;
        }

        console.log(`어쌔신 쌍단검 공격 발동! 데미지: ${damage} (각 0.5배씩), 은신 공격: ${wasStealthAttack}`);

        return {
            success: true,
            attackType: 'basic',
            damage: damage,
            wasStealthAttack: wasStealthAttack,
            caster: {
                id: this.player.id,
                x: this.player.x,
                y: this.player.y
            }
        };
    }

    /**
     * 업데이트 (은신 상태 체크)
     * @param {number} delta - 델타 타임
     */
    update(delta) {
        super.update(delta);
        
        // 은신 지속시간 체크
        if (this.player.isStealth) {
            const now = Date.now();
            if (now >= this.player.stealthEndTime) {
                this.endStealth();
            }
        }
    }

    /**
     * 은신 상태 종료
     */
    endStealth() {
        console.log('어쌔신 은신 자동 해제');
        
        this.player.isStealth = false;
        this.player.stealthStartTime = 0;
        this.player.stealthDuration = 0;
        this.player.stealthEndTime = 0;
        
        // 이동속도 복원
        if (this.player.originalSpeed !== undefined) {
            this.player.speed = this.player.originalSpeed;
            // originalSpeed를 undefined로 설정하지 않음 (클라이언트 동기화를 위해)
        }
        
        // 시야 범위 복원
        if (this.player.originalVisionRange !== undefined) {
            this.player.visionRange = this.player.originalVisionRange;
            // originalVisionRange를 undefined로 설정하지 않음 (클라이언트 동기화를 위해)
        }
        
        // 다시 모든 팀에게 보이도록 설정
        this.player.visibleToEnemies = true;

        // 모든 클라이언트에게 은신 종료 이벤트 브로드캐스트
        if (this.player.socket && this.player.socket.server) {
            this.player.socket.server.emit('stealth-ended', {
                playerId: this.player.id,
                endTime: Date.now(),
                originalVisionRange: this.player.originalVisionRange // 원본 시야 범위 포함
            });
        }
    }
}

module.exports = AssassinJob; 