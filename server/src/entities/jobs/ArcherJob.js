const BaseJob = require('./BaseJob');
const { getJobInfo } = require('../../../shared/JobClasses');

/**
 * 서버용 궁수 직업 클래스
 */
class ArcherJob extends BaseJob {
    constructor(player) {
        super(player);
        this.jobInfo = getJobInfo('archer');
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
        console.log(`ArcherJob useSkill 호출: skillType=${skillType}, options=`, options);
        switch (skillType) {
            case 'roll':
                console.log('ArcherJob: roll 스킬 실행');
                return this.useRoll(options);
            case 'focus':
                console.log('ArcherJob: focus 스킬 실행');
                return this.useFocus(options);
            default:
                console.log('ArcherJob: 알 수 없는 스킬 타입:', skillType);
                return { success: false, reason: 'Unknown skill type' };
        }
    }

    /**
     * 구르기 스킬 (서버에서 처리)
     * @param {Object} options - 스킬 옵션
     * @returns {Object} - 스킬 사용 결과
     */
    useRoll(options = {}) {
        // 쿨타임 체크
        if (!this.isSkillAvailable('roll')) {
            return { 
                success: false, 
                reason: 'cooldown'
            };
        }

        // 죽은 상태면 스킬 사용 불가
        if (this.player.isDead) {
            return { success: false, reason: 'dead' };
        }

        const skillInfo = this.getSkillInfo('roll');
        if (!skillInfo) {
            return { success: false, reason: 'skill not found' };
        }

        // 쿨타임 설정
        this.setSkillCooldown('roll');

        // 구르기 거리 및 방향 계산
        const rollDistance = skillInfo.range || 300; // 기본값을 300으로 변경
        // 클라이언트에서 전송한 방향 정보 사용, 없으면 현재 플레이어 방향 사용
        const direction = options.direction || this.player.direction || 'front';
        
        console.log(`궁수 구르기 스킬 정보: range=${skillInfo.range}, rollDistance=${rollDistance}, direction=${direction}, options=`, options);
        console.log(`플레이어 현재 위치: x=${this.player.x}, y=${this.player.y}`);
        console.log(`플레이어 객체:`, this.player);
        console.log(`플레이어 ID: ${this.player.id}`);
        console.log(`플레이어 타입: ${typeof this.player}`);
        console.log(`플레이어 x 타입: ${typeof this.player.x}, y 타입: ${typeof this.player.y}`);
        console.log(`플레이어 x 값: ${this.player.x}, y 값: ${this.player.y}`);
        
        // 현재 위치 저장
        const startX = this.player.x;
        const startY = this.player.y;
        
        let targetX = startX;
        let targetY = startY;
        
        switch (direction) {
            case 'front':
                targetY += rollDistance;
                break;
            case 'back':
                targetY -= rollDistance;
                break;
            case 'left':
                targetX -= rollDistance;
                break;
            case 'right':
                targetX += rollDistance;
                break;
            case 'back-left':
                targetX -= rollDistance * 0.707; // cos(45°) = 0.707
                targetY -= rollDistance * 0.707;
                break;
            case 'back-right':
                targetX += rollDistance * 0.707;
                targetY -= rollDistance * 0.707;
                break;
            case 'front-left':
                targetX -= rollDistance * 0.707;
                targetY += rollDistance * 0.707;
                break;
            case 'front-right':
                targetX += rollDistance * 0.707;
                targetY += rollDistance * 0.707;
                break;
        }

        // 플레이어 위치 업데이트
        this.player.x = targetX;
        this.player.y = targetY;

        // 구르기 지속시간 계산 (400ms)
        const rollDuration = 400;
        const endTime = Date.now() + rollDuration;

        console.log(`궁수 구르기 발동! 이동: (${startX}, ${startY}) -> (${targetX}, ${targetY}), 이동거리: ${rollDistance}px, 지속시간: ${rollDuration}ms`);

        return {
            success: true,
            skillType: 'roll',
            startX: startX,
            startY: startY,
            endX: targetX,
            endY: targetY,
            direction: direction,
            rotationDirection: options.rotationDirection, // 회전 방향 정보 추가
            duration: rollDuration,
            endTime: endTime,
            skillInfo: {
                ...skillInfo,
                duration: rollDuration
            },
            caster: {
                id: this.player.id,
                x: targetX,
                y: targetY
            }
        };
    }

    /**
     * 궁사의 집중 스킬 (서버에서 처리)
     * @param {Object} options - 스킬 옵션
     * @returns {Object} - 스킬 사용 결과
     */
    useFocus(options = {}) {
        // 쿨타임 체크
        if (!this.isSkillAvailable('focus')) {
            return { 
                success: false, 
                reason: 'cooldown'
            };
        }

        // 죽은 상태면 스킬 사용 불가
        if (this.player.isDead) {
            return { success: false, reason: 'dead' };
        }

        const skillInfo = this.getSkillInfo('focus');
        if (!skillInfo) {
            return { success: false, reason: 'skill not found' };
        }

        // 쿨타임 설정
        this.setSkillCooldown('focus');

        // 공격 속도 버프 적용 (서버에서 관리)
        this.player.activeEffects.add('attack_speed_boost');
        
        // 지속시간 후 효과 해제 예약
        setTimeout(() => {
            this.player.activeEffects.delete('attack_speed_boost');
            console.log('궁사의 집중 효과 종료');
        }, skillInfo.duration);

        // 집중 스킬 종료 시간 계산
        const endTime = Date.now() + skillInfo.duration;

        console.log(`궁사의 집중 발동! 지속시간: ${skillInfo.duration}ms, 종료시간: ${endTime}`);

        return {
            success: true,
            skillType: 'focus',
            duration: skillInfo.duration,
            endTime: endTime,
            effect: skillInfo.effect,
            skillInfo: skillInfo,
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
        let cooldown = this.basicAttackCooldown;
        
        // 궁사의 집중 효과 중이면 공격 속도 증가
        if (this.player.activeEffects.has('attack_speed_boost')) {
            cooldown = cooldown * 0.6; // 40% 빨라짐
        }
        
        return now - this.lastBasicAttackTime >= cooldown;
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
        const maxDistance = 300; // 궁수의 사정거리
        const finalX = this.player.x + Math.cos(angle) * maxDistance;
        const finalY = this.player.y + Math.sin(angle) * maxDistance;
        
        const damage = this.player.attack;

        console.log(`궁수 기본 공격 발동! 데미지: ${damage}, 각도: ${angle}`);

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
                speed: 400
            },
            caster: {
                id: this.player.id,
                x: this.player.x,
                y: this.player.y
            }
        };
    }
}

module.exports = ArcherJob; 