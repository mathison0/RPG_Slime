const BaseJob = require('./BaseJob');
const { getJobInfo } = require('../../../shared/JobClasses');

/**
 * 서버용 마법사 직업 클래스
 */
class MageJob extends BaseJob {
    constructor(player) {
        super(player);
        this.jobInfo = getJobInfo('mage');
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
            case 'ward':
                return this.useWard(options);
            case 'ice_field':
                return this.useIceField(options);
            case 'magic_missile':
                return this.useMagicMissile(options);
            default:
                console.log('MageJob: 알 수 없는 스킬 타입:', skillType);
                return { success: false, reason: 'Unknown skill type' };
        }
    }

    /**
     * 와드 설치 스킬 (서버에서 처리)
     * @param {Object} options - 스킬 옵션
     * @returns {Object} - 스킬 사용 결과
     */
    useWard(options = {}) {
        // 쿨타임 체크
        if (!this.isSkillAvailable('ward')) {
            return { 
                success: false, 
                reason: 'cooldown'
            };
        }

        // 죽은 상태면 스킬 사용 불가
        if (this.player.isDead) {
            return { success: false, reason: 'dead' };
        }

        const skillInfo = this.getSkillInfo('ward');
        if (!skillInfo) {
            return { success: false, reason: 'skill not found' };
        }

        // 쿨타임 설정
        this.setSkillCooldown('ward');

        // 와드 위치 계산 (마우스 커서 위치 또는 플레이어 위치)
        const wardX = options.targetX || this.player.x;
        const wardY = options.targetY || this.player.y;

        console.log(`마법사 와드 설치! 위치: (${wardX}, ${wardY}), 지속시간: ${skillInfo.duration}ms`);

        return {
            success: true,
            skillType: 'ward',
            wardX: wardX,
            wardY: wardY,
            range: skillInfo.range,
            duration: skillInfo.duration,
            caster: {
                id: this.player.id,
                x: this.player.x,
                y: this.player.y
            }
        };
    }

    /**
     * 얼음 장판 스킬 (서버에서 처리)
     * @param {Object} options - 스킬 옵션
     * @returns {Object} - 스킬 사용 결과
     */
    useIceField(options = {}) {
        // 쿨타임 체크
        if (!this.isSkillAvailable('ice_field')) {
            return { 
                success: false, 
                reason: 'cooldown'
            };
        }

        // 죽은 상태면 스킬 사용 불가
        if (this.player.isDead) {
            return { success: false, reason: 'dead' };
        }

        const skillInfo = this.getSkillInfo('ice_field');
        if (!skillInfo) {
            return { success: false, reason: 'skill not found' };
        }

        // 쿨타임 설정
        this.setSkillCooldown('ice_field');

        // 얼음 장판 범위 내 적들에게 속도 감소 효과 적용
        const range = skillInfo.range;
        const affectedTargets = [];

        if (options.gameStateManager) {
            const otherPlayers = options.gameStateManager.getAllPlayers();
            
            otherPlayers.forEach(targetPlayer => {
                if (targetPlayer.id !== this.player.id && 
                    targetPlayer.team !== this.player.team && 
                    !targetPlayer.isDead) {
                    
                    const distance = this.calculateDistance(
                        this.player.x, this.player.y,
                        targetPlayer.x, targetPlayer.y
                    );
                    
                    if (distance <= range) {
                        affectedTargets.push({
                            playerId: targetPlayer.id,
                            effect: 'slow'
                        });
                        
                        // 속도 감소 효과 적용
                        targetPlayer.activeEffects.add('slow');
                        
                        // 지속시간 후 효과 해제
                        setTimeout(() => {
                            targetPlayer.activeEffects.delete('slow');
                        }, skillInfo.duration);
                    }
                }
            });
        }

        console.log(`마법사 얼음 장판 발동! 범위: ${range}, 지속시간: ${skillInfo.duration}ms, 적중: ${affectedTargets.length}명`);

        return {
            success: true,
            skillType: 'ice_field',
            range: range,
            duration: skillInfo.duration,
            effect: skillInfo.effect,
            affectedTargets: affectedTargets,
            caster: {
                id: this.player.id,
                x: this.player.x,
                y: this.player.y
            }
        };
    }

    /**
     * 마법 투사체 스킬 (서버에서 처리)
     * @param {Object} options - 스킬 옵션 (targetX, targetY 포함)
     * @returns {Object} - 스킬 사용 결과
     */
    useMagicMissile(options = {}) {
        // 쿨타임 체크
        if (!this.isSkillAvailable('magic_missile')) {
            return { 
                success: false, 
                reason: 'cooldown'
            };
        }

        // 죽은 상태면 스킬 사용 불가
        if (this.player.isDead) {
            return { success: false, reason: 'dead' };
        }

        const skillInfo = this.getSkillInfo('magic_missile');
        if (!skillInfo) {
            return { success: false, reason: 'skill not found' };
        }

        // 쿨타임 설정
        this.setSkillCooldown('magic_missile');

        // 투사체 정보 계산
        const targetX = options.targetX || this.player.x;
        const targetY = options.targetY || this.player.y - 100;
        const angle = Math.atan2(targetY - this.player.y, targetX - this.player.x);
        const maxDistance = skillInfo.range;
        const finalX = this.player.x + Math.cos(angle) * maxDistance;
        const finalY = this.player.y + Math.sin(angle) * maxDistance;
        
        const damage = this.calculateDamage(skillInfo.damage);

        console.log(`마법사 마법 투사체 발동! 데미지: ${damage}, 각도: ${angle}`);

        return {
            success: true,
            skillType: 'magic_missile',
            damage: damage,
            projectile: {
                startX: this.player.x,
                startY: this.player.y,
                endX: finalX,
                endY: finalY,
                angle: angle,
                speed: 300
            },
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

        // 투사체 정보 계산
        const angle = Math.atan2(targetY - this.player.y, targetX - this.player.x);
        const maxDistance = 350; // 마법사의 사정거리
        const finalX = this.player.x + Math.cos(angle) * maxDistance;
        const finalY = this.player.y + Math.sin(angle) * maxDistance;
        
        const damage = this.player.attack;

        console.log(`마법사 기본 공격 발동! 데미지: ${damage}, 각도: ${angle}`);

        return {
            success: true,
            attackType: 'basic',
            damage: damage,
            projectile: {
                startX: this.player.x,
                startY: this.player.y,
                endX: finalX,
                endY: finalY,
                angle: angle,
                speed: 250
            },
            caster: {
                id: this.player.id,
                x: this.player.x,
                y: this.player.y
            }
        };
    }
}

module.exports = MageJob; 