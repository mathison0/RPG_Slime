import { getJobInfo } from '../../shared/JobClasses.js';

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
     * 모든 스킬의 쿨타임 정보 반환 (UI용)
     * @returns {Object} - 스킬별 쿨타임 정보
     */
    getSkillCooldowns() {
        const cooldowns = {};
        
        // 기본 스킬들 확인 (1: 기본 스킬, 2: 추가 스킬, 3: 추가 스킬)
        for (let i = 1; i <= 3; i++) {
            const remaining = this.getRemainingCooldown(`skill${i}`);
            if (remaining > 0 || this.skillCooldowns.has(`skill${i}`)) {
                cooldowns[i] = {
                    remaining: remaining,
                    max: this.getSkillMaxCooldown(i)
                };
            }
        }
        
        return cooldowns;
    }

    /**
     * 스킬의 최대 쿨타임 반환
     * @param {number} skillNumber - 스킬 번호
     * @returns {number} - 최대 쿨타임 (ms)
     */
    getSkillMaxCooldown(skillNumber) {
        const jobInfo = getJobInfo(this.player.jobClass);
        const skillIndex = skillNumber - 1; // 배열 인덱스는 0부터 시작
        
        if (jobInfo.skills && jobInfo.skills[skillIndex]) {
            return jobInfo.skills[skillIndex].cooldown;
        }
        
        // 기본값
        return 3000;
    }

    /**
     * 쿨타임 메시지 표시
     */
    showCooldownMessage(message = '쿨타임 대기 중!') {
        if (this.player.cooldownMessageActive) return;
        
        this.player.cooldownMessageActive = true;
        
        const cooldownText = this.scene.add.text(
            this.player.x, 
            this.player.y - 80, 
            message, 
            {
                fontSize: '14px',
                fill: '#ffff00',
                stroke: '#000000',
                strokeThickness: 2
            }
        ).setOrigin(0.5);
        
        this.scene.time.delayedCall(1500, () => {
            if (cooldownText.active) {
                cooldownText.destroy();
            }
            this.player.cooldownMessageActive = false;
        });
    }

    /**
     * 점프 기능 (모든 직업 공통)
     */
    useJump() {
        // 이미 점프 중이거나 다른 플레이어면 실행하지 않음
        if (this.player.isJumping || this.player.isOtherPlayer) {
            return;
        }
        
        const originalY = this.player.y;
        const originalNameY = this.player.nameText ? this.player.nameText.y : null;
        
        this.player.setVelocity(0);
        this.player.isJumping = true;
        
        // 플레이어와 이름표를 함께 애니메이션
        const targets = [this.player];
        if (this.player.nameText) {
            targets.push(this.player.nameText);
        }
        
        this.scene.tweens.add({
            targets: targets,
            y: originalY - 50,
            duration: 200,
            yoyo: true,
            ease: 'Power2',
            onComplete: () => {
                // 점프 완료 후 정확한 위치로 복원
                this.player.y = originalY;
                if (this.player.nameText && originalNameY !== null) {
                    this.player.nameText.y = originalNameY;
                }
                this.player.isJumping = false;
                
                // 점프 완료 후 서버에 위치 동기화
                if (this.player.networkManager) {
                    this.player.networkManager.updatePlayerPosition(
                        this.player.x, 
                        this.player.y, 
                        this.player.direction, 
                        false
                    );
                }
            }
        });

        // 네트워크 동기화
        if (this.player.networkManager && !this.player.isOtherPlayer) {
            this.player.networkManager.useSkill('jump');
        }
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
                    return this.parseFormula(damageFormula, attack);
                } catch (e) {
                    console.warn('데미지 공식 파싱 실패:', damageFormula);
                    return attack;
                }
            }
        }
        
        return 0;
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