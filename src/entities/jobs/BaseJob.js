import EffectManager from '../../effects/EffectManager.js';

/**
 * 모든 직업의 기본 클래스
 */
export default class BaseJob {
    constructor(player) {
        this.player = player;
        this.scene = player.scene;
        this.effectManager = new EffectManager(player.scene);
        
        this.skillCooldowns = new Map();
        this.effects = new Map();
    }

    /**
     * 직업별 스킬 사용 메서드
     * @param {number} skillNumber - 스킬 번호 (1, 2, 3)
     * @param {Object} options - 스킬 사용 옵션
     */
    useSkill(skillNumber, options = {}) {
        console.log(`BaseJob: 스킬 ${skillNumber} 사용됨`);
        // 각 직업에서 오버라이드해야 함
    }

    /**
     * 기본 공격 이펙트
     */
    showBasicAttackEffect(targetX, targetY) {
        console.log('BaseJob: 기본 공격 이펙트');
        // 각 직업에서 오버라이드해야 함
    }

    /**
     * 기본 공격 (투사체 발사)
     * @param {number} targetX - 목표 X 좌표
     * @param {number} targetY - 목표 Y 좌표
     */
    useBasicAttack(targetX, targetY) {
        // 클라이언트 사이드 쿨다운 체크
        if (this.player.isSkillOnCooldown('basic_attack')) {
            return; // 서버에 요청을 보내지 않음
        }
        
        // 기본 공격 쿨타임 설정
        this.setBasicAttackCooldown();
        
        // 근접 공격 직업들 (서버에서 처리)
        const meleeJobs = ['warrior', 'supporter', 'mechanic', 'assassin'];
        
        if (meleeJobs.includes(this.player.jobClass)) {
            // 근접 공격은 서버에 이벤트 전송
            if (this.player.networkManager) {
                console.log('근접 공격 이벤트 전송:', { targetX, targetY });
                this.player.networkManager.socket.emit('use-basic-attack', {
                    targetX: targetX,
                    targetY: targetY
                });
            } else {
                console.warn('networkManager가 없음');
            }
        } else {
            // 원거리 공격은 투사체 발사
            if (this.player.networkManager) {
                this.player.networkManager.socket.emit('fire-projectile', {
                    targetX: targetX,
                    targetY: targetY
                });
            } else {
                console.warn('networkManager가 없음');
            }
        }
    }

    /**
     * 기본 공격 쿨타임 확인
     * @returns {boolean} - 쿨다운 중인지 여부
     */
    isBasicAttackOnCooldown() {
        const now = this.scene.time.now;
        const lastUsed = this.lastBasicAttackTime || 0;
        
        // 서버에서 받은 쿨타임 정보 사용
        const jobClass = this.player.jobClass;
        let cooldown = 600; // 기본값
        
        if (this.scene.jobCooldowns && this.scene.jobCooldowns[jobClass]) {
            cooldown = this.scene.jobCooldowns[jobClass].basicAttackCooldown;
        }
        
        return (now - lastUsed) < cooldown;
    }

    /**
     * 기본 공격 쿨타임 설정
     */
    setBasicAttackCooldown() {
        this.lastBasicAttackTime = this.scene.time.now;
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
        const cooldownEnd = Date.now() + duration;
        this.skillCooldowns.set(skillKey, cooldownEnd);
    }

    /**
     * 스킬 쿨타임 남은 시간 계산
     * @param {string} skillKey - 스킬 키
     * @returns {number} - 남은 시간 (ms)
     */
    getRemainingCooldown(skillKey) {
        const now = Date.now();
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
     * 스킬의 최대 쿨타임을 반환 (정확한 값은 서버 설정을 따라감)
     */
    getSkillMaxCooldown(skillNumber) {
        const jobType = this.player.job || 'slime';
        
        // 기본값들 (서버와 동기화 필요)
        const defaultCooldowns = {
            slime: { 1: 2000 },
            warrior: { 1: 3000, 2: 5000, 3: 7000 },
            archer: { 1: 2000, 2: 4000, 3: 6000 },
            mage: { 1: 2500, 2: 4500, 3: 8000 },
            assassin: { 1: 1500, 2: 3500, 3: 9000 },
            supporter: { 1: 3000, 2: 4000, 3: 6000 },
            mechanic: { 1: 2000, 2: 5000, 3: 7500 },
            ninja: { 1: 1800, 2: 3000, 3: 5000 }
        };
        
        return defaultCooldowns[jobType]?.[skillNumber] || 1000;
    }


    /**
     * 점프 기능 (모든 직업 공통) - 서버에 요청만 전송
     */
    useJump() {
        // 이미 점프 중이거나 다른 플레이어면 실행하지 않음
        if (this.player.isJumping || this.player.isOtherPlayer) {
            return;
        }
        
        // 클라이언트 사이드 점프 가능 여부 체크
        if (this.player.isSkillOnCooldown('jump')) {
            return; // 서버에 요청을 보내지 않음
        }
        
        // 네트워크 동기화 (서버에 점프 요청만 전송)
        if (this.player.networkManager && !this.player.isOtherPlayer) {
            // 임시로 jumpEndTime 설정 (서버 응답 대기 중 연속 요청 방지)
            const tempJumpDuration = 400; // 기본 점프 지속시간
            this.player.jumpEndTime = Date.now() + tempJumpDuration;
            console.log(`임시 점프 endTime 설정: ${this.player.jumpEndTime}`);
            
            this.player.networkManager.useSkill('jump');
        }

        console.log('점프 사용 요청 전송!');
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
     * 스킬 이펙트 정리 (사망 시 호출)
     */
    clearSkillEffects() {
        console.log('BaseJob: 스킬 효과 정리');
        // 각 직업에서 필요에 따라 오버라이드
    }

    /**
     * 스킬 이펙트 표시
     */
    showSkillEffect(skillType, data = null) {
        console.log('BaseJob: 스킬 이펙트 표시', skillType, data);
        // 각 직업에서 오버라이드해야 함
    }

    /**
     * 스킬 번호로 스킬명을 반환
     */
    getSkillName(skillNumber) {
        switch (skillNumber) {
            case 1: return 'skill1';
            case 2: return 'skill2';
            case 3: return 'skill3';
            default: return 'unknown';
        }
    }

    /**
     * 정리 작업
     */
    destroy() {
        this.skillCooldowns.clear();
        this.effects.clear();
    }
} 