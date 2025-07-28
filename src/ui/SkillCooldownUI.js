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
        
        // 마법사나 전사인 경우 추가 스킬 UI 생성
        if (this.player.jobClass === 'mage' || this.player.jobClass === 'warrior') {
            this.createExtraUI(uiX1, uiY1, spacing, radius);
        }
    }

    /**
     * 추가 스킬 UI 생성 (마법사, 전사 등)
     */
    createExtraUI(baseX, baseY, spacing, radius) {
        // 두 번째 스킬 UI (2번키)
        const uiX2 = baseX + spacing;
        const uiY2 = baseY;
        
        const background2 = this.scene.add.graphics();
        background2.fillStyle(0x333333, 0.8);
        background2.fillCircle(uiX2, uiY2, radius);
        background2.setScrollFactor(0);
        background2.setDepth(1000);
        
        const cooldown2 = this.scene.add.graphics();
        cooldown2.setScrollFactor(0);
        cooldown2.setDepth(1001);
        
        const number2 = this.scene.add.text(uiX2, uiY2, 'E', {
            fontSize: '18px',
            fill: '#ffffff',
            fontStyle: 'bold'
        }).setOrigin(0.5);
        number2.setScrollFactor(0);
        number2.setDepth(1002);
        
        // 세 번째 스킬 UI (3번키)
        const uiX3 = baseX + spacing * 2;
        const uiY3 = baseY;
        
        const background3 = this.scene.add.graphics();
        background3.fillStyle(0x333333, 0.8);
        background3.fillCircle(uiX3, uiY3, radius);
        background3.setScrollFactor(0);
        background3.setDepth(1000);
        
        const cooldown3 = this.scene.add.graphics();
        cooldown3.setScrollFactor(0);
        cooldown3.setDepth(1001);
        
        const number3 = this.scene.add.text(uiX3, uiY3, 'R', {
            fontSize: '18px',
            fill: '#ffffff',
            fontStyle: 'bold'
        }).setOrigin(0.5);
        number3.setScrollFactor(0);
        number3.setDepth(1002);
        
        // 추가 UI 저장
        this.ui.background2 = background2;
        this.ui.cooldown2 = cooldown2;
        this.ui.number2 = number2;
        this.ui.x2 = uiX2;
        this.ui.y2 = uiY2;
        
        this.ui.background3 = background3;
        this.ui.cooldown3 = cooldown3;
        this.ui.number3 = number3;
        this.ui.x3 = uiX3;
        this.ui.y3 = uiY3;
    }

    /**
     * 스킬 쿨타임 UI 업데이트
     */
    update() {
        if (!this.ui || !this.player.job) return;
        
        const cooldowns = this.player.job.getSkillCooldowns();
        
        // 첫 번째 스킬 업데이트 (Q키)
        if (cooldowns.Q) {
            this.updateSingleSkillCooldown(
                this.ui.cooldown,
                this.ui.number,
                this.ui.x,
                this.ui.y,
                this.ui.radius,
                cooldowns.Q.remaining,
                cooldowns.Q.max
            );
        }
        
        // 마법사 추가 스킬들 업데이트 (E, R키)
        if (this.player.jobClass === 'mage') {
            if (cooldowns.E && this.ui.cooldown2) {
                this.updateSingleSkillCooldown(
                    this.ui.cooldown2,
                    this.ui.number2,
                    this.ui.x2,
                    this.ui.y2,
                    this.ui.radius,
                    cooldowns.E.remaining,
                    cooldowns.E.max
                );
            }
            
            if (cooldowns.R && this.ui.cooldown3) {
                this.updateSingleSkillCooldown(
                    this.ui.cooldown3,
                    this.ui.number3,
                    this.ui.x3,
                    this.ui.y3,
                    this.ui.radius,
                    cooldowns.R.remaining,
                    cooldowns.R.max
                );
            }
        }
        
        // 전사 스킬들 업데이트 (E, R키)
        if (this.player.jobClass === 'warrior') {
            if (cooldowns.E && this.ui.cooldown2) {
                this.updateSingleSkillCooldown(
                    this.ui.cooldown2,
                    this.ui.number2,
                    this.ui.x2,
                    this.ui.y2,
                    this.ui.radius,
                    cooldowns.E.remaining,
                    cooldowns.E.max
                );
            }
            
            if (cooldowns.R && this.ui.cooldown3) {
                this.updateSingleSkillCooldown(
                    this.ui.cooldown3,
                    this.ui.number3,
                    this.ui.x3,
                    this.ui.y3,
                    this.ui.radius,
                    cooldowns.R.remaining,
                    cooldowns.R.max
                );
            }
        }
    }

    /**
     * 단일 스킬 쿨타임 UI 업데이트
     */
    updateSingleSkillCooldown(cooldownGraphics, numberText, x, y, radius, remainingTime, maxCooldown) {
        cooldownGraphics.clear();
        
        if (remainingTime > 0) {
            // 쿨타임 중일 때 - 진행률에 따라 원이 채워짐
            const progress = 1 - (remainingTime / maxCooldown);
            
            // 배경 원 (어두운 색)
            cooldownGraphics.fillStyle(0x333333, 0.8);
            cooldownGraphics.fillCircle(x, y, radius);
            
            // 진행률 원 (파란색, 시계방향으로 채워짐)
            if (progress > 0) {
                cooldownGraphics.fillStyle(0x0066ff, 0.8);
                
                const startAngle = -Math.PI / 2; // 12시 방향부터 시작
                const endAngle = startAngle + (progress * 2 * Math.PI);
                
                cooldownGraphics.beginPath();
                cooldownGraphics.moveTo(x, y);
                cooldownGraphics.arc(x, y, radius, startAngle, endAngle);
                cooldownGraphics.closePath();
                cooldownGraphics.fillPath();
            }
            
            // 쿨타임 중일 때는 번호 색상을 어둡게
            numberText.setStyle({ fill: '#888888' });
            
            // 남은 시간 표시 (1초 이상일 때만)
            if (remainingTime >= 1000) {
                const seconds = Math.ceil(remainingTime / 1000);
                const timeText = this.scene.add.text(x, y + radius + 15, seconds.toString(), {
                    fontSize: '12px',
                    fill: '#ffffff',
                    fontStyle: 'bold'
                }).setOrigin(0.5);
                timeText.setScrollFactor(0);
                timeText.setDepth(1003);
                
                // 1초 후 텍스트 제거
                this.scene.time.delayedCall(1000, () => {
                    if (timeText.active) {
                        timeText.destroy();
                    }
                });
            }
        } else {
            // 쿨타임이 끝났을 때 - 사용 가능 상태
            cooldownGraphics.fillStyle(0x333333, 0.8);
            cooldownGraphics.fillCircle(x, y, radius);
            
            // 테두리로 사용 가능 표시
            cooldownGraphics.lineStyle(2, 0x00ff00, 0.8);
            cooldownGraphics.strokeCircle(x, y, radius);
            
            // 사용 가능할 때는 번호 색상을 밝게
            numberText.setStyle({ fill: '#ffffff' });
        }
    }

    /**
     * UI 제거
     */
    destroyUI() {
        if (!this.ui) return;
        
        // 기본 UI 요소들 제거
        if (this.ui.background) this.ui.background.destroy();
        if (this.ui.cooldown) this.ui.cooldown.destroy();
        if (this.ui.number) this.ui.number.destroy();
        
        // 마법사 추가 UI 요소들 제거
        if (this.ui.background2) this.ui.background2.destroy();
        if (this.ui.cooldown2) this.ui.cooldown2.destroy();
        if (this.ui.number2) this.ui.number2.destroy();
        if (this.ui.background3) this.ui.background3.destroy();
        if (this.ui.cooldown3) this.ui.cooldown3.destroy();
        if (this.ui.number3) this.ui.number3.destroy();
        
        this.ui = null;
    }

    /**
     * 직업 변경 시 UI 재생성
     */
    refreshForJobChange() {
        this.createUI();
    }

    /**
     * 정리 작업
     */
    destroy() {
        this.destroyUI();
    }
} 