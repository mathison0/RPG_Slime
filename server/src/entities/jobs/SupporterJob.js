const BaseJob = require('./BaseJob');
const { getJobInfo } = require('../../../shared/JobClasses');

/**
 * 서버용 힐러 직업 클래스
 */
class SupporterJob extends BaseJob {
    constructor(player) {
        super(player);
        this.jobInfo = getJobInfo('supporter');
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
            case 'buff_field':
                return this.useBuffField(options);
            case 'heal_field':
                return this.useHealField(options);
            default:
                console.log('SupporterJob: 알 수 없는 스킬 타입:', skillType);
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

        // 와드 위치 계산
        const wardX = this.player.x;
        const wardY = this.player.y - 80;

        console.log(`힐러 와드 설치! 위치: (${wardX}, ${wardY}), 지속시간: ${skillInfo.duration}ms`);

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
     * 버프 장판 스킬 (서버에서 처리)
     * @param {Object} options - 스킬 옵션
     * @returns {Object} - 스킬 사용 결과
     */
    useBuffField(options = {}) {
        // 쿨타임 체크
        if (!this.isSkillAvailable('buff_field')) {
            return { 
                success: false, 
                reason: 'cooldown'
            };
        }

        // 죽은 상태면 스킬 사용 불가
        if (this.player.isDead) {
            return { success: false, reason: 'dead' };
        }

        const skillInfo = this.getSkillInfo('buff_field');
        if (!skillInfo) {
            return { success: false, reason: 'skill not found' };
        }

        // 쿨타임 설정
        this.setSkillCooldown('buff_field');

        // 목표 위치 계산 (마우스 위치 기준)
        const targetX = options.targetX || this.player.x;
        const targetY = options.targetY || this.player.y;
        
        console.log(`버프 장판 목표 위치: targetX=${targetX}, targetY=${targetY}, playerX=${this.player.x}, playerY=${this.player.y}`);
        
        // 최대 시전 사거리 적용 (JobClasses에서 설정)
        const maxCastRange = skillInfo.castRange || 200;
        const distance = Math.sqrt(
            Math.pow(targetX - this.player.x, 2) + 
            Math.pow(targetY - this.player.y, 2)
        );
        
        let finalX = targetX;
        let finalY = targetY;
        
        if (distance > maxCastRange) {
            const angle = Math.atan2(targetY - this.player.y, targetX - this.player.x);
            finalX = this.player.x + Math.cos(angle) * maxCastRange;
            finalY = this.player.y + Math.sin(angle) * maxCastRange;
            console.log(`버프 장판 최대 사거리 제한 적용: 거리=${distance}, 최대=${maxCastRange}, 최종 위치=(${finalX}, ${finalY})`);
        }

        console.log(`버프 장판 최종 시전 위치: finalX=${finalX}, finalY=${finalY}`);

        console.log(`힐러 버프 장판 스킬 발사! 플레이어: ${this.player.id}, 위치: (${finalX}, ${finalY}), 범위: ${skillInfo.range}`);

        return {
            success: true,
            skillType: 'buff_field',
            x: finalX,  // 실제 시전 위치
            y: finalY,  // 실제 시전 위치
            range: skillInfo.range,
            duration: skillInfo.duration,
            effect: skillInfo.effect,
            caster: {
                id: this.player.id,
                x: this.player.x,
                y: this.player.y
            }
        };
    }

    /**
     * 힐 장판 스킬 (서버에서 처리)
     * @param {Object} options - 스킬 옵션
     * @returns {Object} - 스킬 사용 결과
     */
    useHealField(options = {}) {
        // 쿨타임 체크
        if (!this.isSkillAvailable('heal_field')) {
            return { 
                success: false, 
                reason: 'cooldown'
            };
        }

        // 죽은 상태면 스킬 사용 불가
        if (this.player.isDead) {
            return { success: false, reason: 'dead' };
        }

        const skillInfo = this.getSkillInfo('heal_field');
        if (!skillInfo) {
            return { success: false, reason: 'skill not found' };
        }

        // 쿨타임 설정
        this.setSkillCooldown('heal_field');

        // 목표 위치 계산 (마우스 위치 기준)
        const targetX = options.targetX || this.player.x;
        const targetY = options.targetY || this.player.y;
        
        console.log(`힐 장판 목표 위치: targetX=${targetX}, targetY=${targetY}, playerX=${this.player.x}, playerY=${this.player.y}`);
        
        // 최대 시전 사거리 적용 (JobClasses에서 설정)
        const maxCastRange = skillInfo.castRange || 250;
        const distance = Math.sqrt(
            Math.pow(targetX - this.player.x, 2) + 
            Math.pow(targetY - this.player.y, 2)
        );
        
        let finalX = targetX;
        let finalY = targetY;
        
        if (distance > maxCastRange) {
            const angle = Math.atan2(targetY - this.player.y, targetX - this.player.x);
            finalX = this.player.x + Math.cos(angle) * maxCastRange;
            finalY = this.player.y + Math.sin(angle) * maxCastRange;
            console.log(`힐 장판 최대 사거리 제한 적용: 거리=${distance}, 최대=${maxCastRange}, 최종 위치=(${finalX}, ${finalY})`);
        }

        console.log(`힐 장판 최종 시전 위치: finalX=${finalX}, finalY=${finalY}`);

        console.log(`힐러 힐 장판 스킬 발사! 플레이어: ${this.player.id}, 위치: (${finalX}, ${finalY}), 범위: ${skillInfo.range}`);

        return {
            success: true,
            skillType: 'heal_field',
            x: finalX,  // 실제 시전 위치
            y: finalY,  // 실제 시전 위치
            range: skillInfo.range,
            duration: skillInfo.duration,
            healAmount: skillInfo.heal || 20,
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
        const maxDistance = 250; // 힐러의 사정거리
        const finalX = this.player.x + Math.cos(angle) * maxDistance;
        const finalY = this.player.y + Math.sin(angle) * maxDistance;
        
        const damage = this.player.attack;

        console.log(`힐러 기본 공격 발동! 데미지: ${damage}, 각도: ${angle}`);

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
                speed: 200
            },
            caster: {
                id: this.player.id,
                x: this.player.x,
                y: this.player.y
            }
        };
    }
}

module.exports = SupporterJob; 