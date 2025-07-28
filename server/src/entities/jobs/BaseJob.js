const { getJobInfo } = require('../../../shared/JobClasses');

/**
 * 서버측 기본 직업 클래스
 * 모든 직업 클래스의 기본이 되는 클래스
 */
class BaseJob {
    constructor(player) {
        this.player = player;
        this.skillCooldowns = new Map();
        this.effects = new Map();
    }

    /**
     * 스킬 사용 (서버에서 처리)
     * @param {string} skillType - 스킬 타입 (예: 'spread', 'roar', 'sweep')
     * @param {Object} options - 추가 옵션 (위치, 방향 등)
     * @returns {Object} - 스킬 사용 결과
     */
    useSkill(skillType, options = {}) {
        // 기본 구현 - 각 직업에서 오버라이드
        console.log(`BaseJob: 스킬 ${skillType} 사용`);
        return { success: false, reason: 'Not implemented' };
    }

    /**
     * 스킬 쿨타임 확인
     * @param {string} skillType - 스킬 타입
     * @returns {boolean} - 사용 가능 여부
     */
    isSkillAvailable(skillType) {
        const now = Date.now();
        const lastUsed = this.skillCooldowns.get(skillType) || 0;
        const skillInfo = this.getSkillInfo(skillType);
        
        if (!skillInfo) return false;
        
        return now >= lastUsed + skillInfo.cooldown;
    }

    /**
     * 스킬 쿨타임 설정
     * @param {string} skillType - 스킬 타입
     */
    setSkillCooldown(skillType) {
        this.skillCooldowns.set(skillType, Date.now());
    }

    /**
     * 스킬 쿨타임 남은 시간 계산
     * @param {string} skillType - 스킬 타입
     * @returns {number} - 남은 시간 (ms)
     */
    getRemainingCooldown(skillType) {
        const now = Date.now();
        const lastUsed = this.skillCooldowns.get(skillType) || 0;
        const skillInfo = this.getSkillInfo(skillType);
        
        if (!skillInfo) return 0;
        
        return Math.max(0, (lastUsed + skillInfo.cooldown) - now);
    }

    /**
     * 스킬 정보 조회
     * @param {string} skillType - 스킬 타입
     * @returns {Object} - 스킬 정보
     */
    getSkillInfo(skillType) {
        const jobInfo = getJobInfo(this.player.jobClass);
        return jobInfo.skills.find(skill => skill.type === skillType);
    }

    /**
     * 범위 내 적 탐색 (서버에서 처리)
     * @param {number} range - 탐색 범위
     * @param {number} x - 중심 X 좌표
     * @param {number} y - 중심 Y 좌표
     * @returns {Array} - 범위 내 적 배열
     */
    getEnemiesInRange(range, x = this.player.x, y = this.player.y) {
        const enemies = [];
        // 여기서는 게임 매니저나 다른 플레이어들을 확인해야 함
        // 실제 구현에서는 GameStateManager를 통해 접근
        return enemies;
    }

    /**
     * 범위 내 플레이어 탐색 (서버에서 처리)
     * @param {number} range - 탐색 범위
     * @param {number} x - 중심 X 좌표
     * @param {number} y - 중심 Y 좌표
     * @param {boolean} includeSelf - 자신 포함 여부
     * @returns {Array} - 범위 내 플레이어 배열
     */
    getPlayersInRange(range, x = this.player.x, y = this.player.y, includeSelf = false) {
        const players = [];
        // 게임 매니저를 통해 모든 플레이어 확인 (실제 구현시 주입 필요)
        return players;
    }

    /**
     * 데미지 계산 (서버에서 처리)
     * @param {string|number} damageFormula - 데미지 공식 또는 값
     * @returns {number} - 계산된 데미지
     */
    calculateDamage(damageFormula) {
        if (typeof damageFormula === 'number') {
            return damageFormula;
        }
        
        if (typeof damageFormula === 'string') {
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
     * 안전한 수식 파싱
     * @param {string} formula - 수식 문자열
     * @param {number} attackValue - 공격력 값
     * @returns {number} - 계산된 값
     */
    parseFormula(formula, attackValue) {
        const cleanFormula = formula.replace(/\s/g, '');
        const withValue = cleanFormula.replace(/attack/g, attackValue);
        
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
        
        const numMatch = withValue.match(/^(\d+(?:\.\d+)?)$/);
        if (numMatch) {
            return Math.round(parseFloat(numMatch[1]));
        }
        
        return attackValue;
    }

    /**
     * 거리 계산
     * @param {number} x1 - 첫 번째 점의 X 좌표
     * @param {number} y1 - 첫 번째 점의 Y 좌표
     * @param {number} x2 - 두 번째 점의 X 좌표
     * @param {number} y2 - 두 번째 점의 Y 좌표
     * @returns {number} - 거리
     */
    calculateDistance(x1, y1, x2, y2) {
        return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
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

module.exports = BaseJob; 