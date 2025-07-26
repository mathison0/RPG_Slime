/**
 * 기본 직업 클래스
 * 모든 직업 클래스의 기본이 되는 클래스
 */
export default class BaseJob {
    constructor(player) {
        this.player = player;
        this.scene = player.scene;
        this.skillCooldowns = new Map();
        this.effects = new Map();
    }

    /**
     * 스킬 사용
     * @param {number} skillNumber - 스킬 번호 (1, 2, 3)
     * @param {Object} options - 추가 옵션
     */
    useSkill(skillNumber, options = {}) {
        // 기본 구현 - 각 직업에서 오버라이드
        console.log(`BaseJob: 스킬 ${skillNumber} 사용`);
    }

    /**
     * 스킬 쿨타임 확인
     * @param {string} skillKey - 스킬 키
     * @returns {boolean} - 사용 가능 여부
     */
    isSkillAvailable(skillKey) {
        const now = this.scene.time.now;
        const cooldownEnd = this.skillCooldowns.get(skillKey) || 0;
        return now >= cooldownEnd;
    }

    /**
     * 스킬 쿨타임 설정
     * @param {string} skillKey - 스킬 키
     * @param {number} duration - 쿨타임 지속시간 (ms)
     */
    setSkillCooldown(skillKey, duration) {
        const cooldownEnd = this.scene.time.now + duration;
        this.skillCooldowns.set(skillKey, cooldownEnd);
    }

    /**
     * 스킬 쿨타임 남은 시간 계산
     * @param {string} skillKey - 스킬 키
     * @returns {number} - 남은 시간 (ms)
     */
    getRemainingCooldown(skillKey) {
        const now = this.scene.time.now;
        const cooldownEnd = this.skillCooldowns.get(skillKey) || 0;
        return Math.max(0, cooldownEnd - now);
    }

    /**
     * 쿨타임 메시지 표시
     */
    showCooldownMessage() {
        if (this.player.cooldownMessageActive) return;
        
        this.player.cooldownMessageActive = true;
        
        const cooldownText = this.scene.add.text(
            this.player.x, 
            this.player.y - 60, 
            '쿨타임 대기 중!', 
            {
                fontSize: '16px',
                fill: '#ffffff'
            }
        ).setOrigin(0.5);
        
        this.scene.time.delayedCall(500, () => {
            if (cooldownText.active) {
                cooldownText.destroy();
            }
            this.player.cooldownMessageActive = false;
        });
        
        const positionTimer = this.scene.time.addEvent({
            delay: 16,
            callback: () => {
                if (cooldownText.active) {
                    cooldownText.setPosition(this.player.x, this.player.y - 60);
                }
            },
            loop: true
        });
        
        this.scene.time.delayedCall(500, () => {
            if (positionTimer) {
                positionTimer.destroy();
            }
        });
    }

    /**
     * 범위 내 적 탐색
     * @param {number} range - 탐색 범위
     * @returns {Array} - 범위 내 적 배열
     */
    getEnemiesInRange(range) {
        const enemies = [];
        this.scene.enemies.getChildren().forEach(enemy => {
            if (!enemy.isDead) {
                const distance = Phaser.Math.Distance.Between(
                    this.player.x, this.player.y, 
                    enemy.x, enemy.y
                );
                if (distance <= range) {
                    enemies.push(enemy);
                }
            }
        });
        return enemies;
    }

    /**
     * 데미지 계산
     * @param {string|number} damageFormula - 데미지 공식 또는 값
     * @returns {number} - 계산된 데미지
     */
    calculateDamage(damageFormula) {
        if (typeof damageFormula === 'number') {
            return damageFormula;
        }
        
        if (typeof damageFormula === 'string') {
            // 간단한 공식 파싱 (예: 'attack', 'attack * 1.5')
            const attack = this.player.attack;
            
            if (damageFormula === 'attack') {
                return attack;
            }
            
            if (damageFormula.includes('attack')) {
                try {
                    return eval(damageFormula.replace('attack', attack));
                } catch (e) {
                    console.warn('데미지 공식 파싱 실패:', damageFormula);
                    return attack;
                }
            }
        }
        
        return 0;
    }

    /**
     * 업데이트 (매 프레임 호출)
     * @param {number} delta - 델타 타임
     */
    update(delta) {
        // 기본 업데이트 로직
        // 각 직업에서 필요시 오버라이드
    }

    /**
     * 정리 작업
     */
    destroy() {
        this.skillCooldowns.clear();
        this.effects.clear();
    }
} 