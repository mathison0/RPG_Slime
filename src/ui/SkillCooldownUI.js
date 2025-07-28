/**
 * 스킬 쿨타임 UI 관리 클래스
 */
export default class SkillCooldownUI {
    constructor(scene, player) {
        this.scene = scene;
        this.player = player;
        this.ui = null;
        
        this.createUI();
    }

    /**
     * 스킬 쿨타임 UI 생성
     */
    createUI() {
        // 기존 UI 제거
        this.destroyUI();
        
        const radius = 25;
        const spacing = 70;
        
        // 첫 번째 스킬 UI (1번키)
        const uiX1 = 80;
        const uiY1 = this.scene.scale.height - 120;
        
        const background1 = this.scene.add.graphics();
        background1.fillStyle(0x333333, 0.8);
        background1.fillCircle(uiX1, uiY1, radius);
        background1.setScrollFactor(0);
        background1.setDepth(1000);
        
        const cooldown1 = this.scene.add.graphics();
        cooldown1.setScrollFactor(0);
        cooldown1.setDepth(1001);
        
        const number1 = this.scene.add.text(uiX1, uiY1, 'Q', {
            fontSize: '18px',
            fill: '#ffffff',
            fontStyle: 'bold'
        }).setOrigin(0.5);
        number1.setScrollFactor(0);
        number1.setDepth(1002);
        
        // UI 객체 저장
        this.ui = {
            background: background1,
            cooldown: cooldown1,
            number: number1,
            x: uiX1,
            y: uiY1,
            radius: radius
        };
    }

    /**
     * 서버에서 받은 스킬 쿨타임 정보로 업데이트
     * @param {Object} serverSkillCooldowns - 서버에서 받은 스킬 쿨타임 정보
     */
    updateFromServer(serverSkillCooldowns) {
        if (!this.ui || !serverSkillCooldowns) return;

        // 모든 스킬의 쿨타임 정보를 확인
        for (const [skillType, cooldownInfo] of Object.entries(serverSkillCooldowns)) {
            if (cooldownInfo.remaining > 0) {
                // 쿨타임이 남은 스킬이 있으면 UI 업데이트
                this.drawCooldown(cooldownInfo.remaining, cooldownInfo.total);
                break; // 첫 번째 쿨타임만 표시 (단일 UI)
            }
        }

        // 모든 스킬이 사용 가능하면 쿨타임 UI 숨김
        let hasActiveCooldown = false;
        for (const cooldownInfo of Object.values(serverSkillCooldowns)) {
            if (cooldownInfo.remaining > 0) {
                hasActiveCooldown = true;
                break;
            }
        }

        if (!hasActiveCooldown) {
            this.ui.cooldown.clear();
        }
    }

    /**
     * 쿨타임 원형 그래프 그리기
     * @param {number} remaining - 남은 시간 (ms)
     * @param {number} total - 전체 시간 (ms)
     */
    drawCooldown(remaining, total) {
        if (!this.ui) return;

        this.ui.cooldown.clear();
        
        if (remaining > 0) {
            const progress = remaining / total;
            const startAngle = -Math.PI / 2; // 12시 방향부터 시작
            const endAngle = startAngle + (2 * Math.PI * progress);
            
            // 쿨타임 원형 그래프
            this.ui.cooldown.fillStyle(0xff0000, 0.6);
            this.ui.cooldown.slice(this.ui.x, this.ui.y, this.ui.radius, startAngle, endAngle);
            this.ui.cooldown.fillPath();
            
            // 경계선
            this.ui.cooldown.lineStyle(2, 0xff0000, 0.8);
            this.ui.cooldown.strokeCircle(this.ui.x, this.ui.y, this.ui.radius);
        }
    }

    /**
     * 업데이트 (기존 방식과 호환성 유지)
     */
    update() {
        if (!this.player || !this.player.job) return;
        
        // 서버에서 받은 쿨타임 정보가 있으면 그것을 우선 사용
        if (this.player.serverSkillCooldowns) {
            this.updateFromServer(this.player.serverSkillCooldowns);
            return;
        }

        // 기존 방식 (fallback)
        const cooldowns = this.player.job.getSkillCooldowns();
        
        if (cooldowns[1]) {
            this.drawCooldown(cooldowns[1].remaining, cooldowns[1].max);
        } else {
            if (this.ui) {
                this.ui.cooldown.clear();
            }
        }
    }

    /**
     * UI 파괴
     */
    destroyUI() {
        if (this.ui) {
            if (this.ui.background) this.ui.background.destroy();
            if (this.ui.cooldown) this.ui.cooldown.destroy();
            if (this.ui.number) this.ui.number.destroy();
            this.ui = null;
        }
    }

    /**
     * 정리
     */
    destroy() {
        this.destroyUI();
    }
} 