/**
 * 스킬 쿨타임 UI 관리 클래스
 */
export default class SkillCooldownUI {
    constructor(scene, player) {
        this.scene = scene;
        this.player = player;
        this.skillUIs = {}; // 여러 스킬 UI를 저장할 객체
        this.lastJobClass = null; // 직업 변경 감지용
        this.isUpdating = false; // 중복 업데이트 방지
        
        this.createUI();
    }

    /**
     * 스킬 쿨타임 UI 생성
     */
    createUI() {
        // 중복 호출 방지
        if (this.isUpdating) {
            return;
        }
        this.isUpdating = true;
        
        // 기존 UI 완전 제거
        this.destroyUI();
        
        // 플레이어의 직업에 따라 필요한 스킬만 생성
        const jobClass = this.player?.jobClass || 'slime';
        const jobSkillCounts = {
            'slime': 1,
            'mage': 3,
            'warrior': 3,
            'assassin': 1,
            'ninja': 1,
            'mechanic': 1,
            'archer': 2,
            'supporter': 3
        };
        
        const skillCount = jobSkillCounts[jobClass] || 1;
        
        const radius = 25;
        const spacing = 70;
        const startX = 80;
        const baseY = this.scene.scale.height - 120;
        
        // 필요한 스킬만 생성
        const skillConfigs = [
            { key: 'skill1', keyText: 'Q', x: startX, y: baseY },
            { key: 'skill2', keyText: 'E', x: startX + spacing, y: baseY },
            { key: 'skill3', keyText: 'R', x: startX + spacing * 2, y: baseY }
        ];
        
        // 직업에 맞는 스킬 개수만큼만 UI 생성
        for (let i = 0; i < skillCount; i++) {
            const config = skillConfigs[i];
            
            const background = this.scene.add.graphics();
            background.fillStyle(0x0066ff, 0.8); // 파란색 배경 (사용 가능 상태)
            background.fillCircle(config.x, config.y, radius);
            background.setScrollFactor(0);
            background.setDepth(1000);
            
            const cooldown = this.scene.add.graphics();
            cooldown.setScrollFactor(0);
            cooldown.setDepth(1001);
            
            const keyText = this.scene.add.text(config.x, config.y, config.keyText, {
                fontSize: '18px',
                fill: '#ffffff',
                fontStyle: 'bold'
            }).setOrigin(0.5);
            keyText.setScrollFactor(0);
            keyText.setDepth(1002);
            
            // 스킬 UI 저장
            this.skillUIs[config.key] = {
                background: background,
                cooldown: cooldown,
                keyText: keyText,
                x: config.x,
                y: config.y,
                radius: radius,
                isVisible: true // 생성된 것은 모두 보임
            };
        }
        
        this.lastJobClass = jobClass;
        this.isUpdating = false;
    }

    /**
     * 플레이어의 직업에 따라 표시할 스킬 UI 결정
     */
    updateVisibleSkills() {
        // 중복 호출 방지
        if (this.isUpdating) {
            return;
        }
        
        const jobClass = this.player?.jobClass || 'slime';
        
        // 직업이 변경되었을 때만 UI 재생성
        if (jobClass !== this.lastJobClass) {
            this.createUI();
        }
    }

    /**
     * 특정 스킬 UI 표시 (더 이상 사용하지 않음)
     */
    showSkillUI(skillKey) {
        // 이 메서드는 더 이상 사용하지 않음 - createUI에서 필요한 것만 생성
    }

    /**
     * 특정 스킬 UI 숨김 (더 이상 사용하지 않음)
     */
    hideSkillUI(skillKey) {
        // 이 메서드는 더 이상 사용하지 않음 - destroyUI에서 모두 제거
    }

    /**
     * 서버에서 받은 스킬 쿨타임 정보로 업데이트
     * @param {Object} serverSkillCooldowns - 서버에서 받은 스킬 쿨타임 정보
     */
    updateFromServer(serverSkillCooldowns) {
        if (!serverSkillCooldowns) return;
        
        console.log('UI 쿨타임 업데이트:', serverSkillCooldowns);

        // 각 스킬의 쿨타임 정보를 개별적으로 처리
        Object.keys(this.skillUIs).forEach(skillKey => {
            const ui = this.skillUIs[skillKey];
            if (!ui) return;
            
            const cooldownInfo = serverSkillCooldowns[skillKey];
            if (cooldownInfo && cooldownInfo.remaining > 0) {
                // 쿨타임이 남은 스킬의 UI 업데이트
                this.drawCooldown(skillKey, cooldownInfo.remaining, cooldownInfo.total);
            } else {
                // 쿨타임이 끝난 스킬의 UI 초기화
                ui.cooldown.clear();
                // 쿨타임이 끝나면 배경을 파란색으로 복원
                ui.background.clear();
                ui.background.fillStyle(0x0066ff, 0.8);
                ui.background.fillCircle(ui.x, ui.y, ui.radius);
            }
        });
    }

    /**
     * 특정 스킬의 쿨타임 원형 그래프 그리기
     * @param {string} skillKey - 스킬 키 (skill1, skill2, skill3)
     * @param {number} remaining - 남은 시간 (ms)
     * @param {number} total - 전체 시간 (ms)
     */
    drawCooldown(skillKey, remaining, total) {
        const ui = this.skillUIs[skillKey];
        if (!ui) return;

        ui.cooldown.clear();
        
        if (remaining > 0) {
            const progress = remaining / total;
            const startAngle = -Math.PI / 2; // 12시 방향부터 시작
            const endAngle = startAngle - (2 * Math.PI * progress); // 시계방향으로 변경
            
            // 쿨타임 원형 그래프 (회색 + 파란색 혼합)
            ui.cooldown.fillStyle(0x8888aa, 0.6);
            ui.cooldown.slice(ui.x, ui.y, ui.radius, startAngle, endAngle);
            ui.cooldown.fillPath();
            
            // 경계선 (파란색)
            ui.cooldown.lineStyle(2, 0x0066ff, 0.8);
            ui.cooldown.strokeCircle(ui.x, ui.y, ui.radius);
            
            // 배경을 회색으로 변경 (쿨타임 중)
            ui.background.clear();
            ui.background.fillStyle(0x666666, 0.8);
            ui.background.fillCircle(ui.x, ui.y, ui.radius);
        } else {
            // 쿨타임이 끝나면 배경을 파란색으로 복원
            ui.background.clear();
            ui.background.fillStyle(0x0066ff, 0.8);
            ui.background.fillCircle(ui.x, ui.y, ui.radius);
        }
    }

    /**
     * 업데이트 (기존 방식과 호환성 유지)
     */
    update() {
        // 직업이 변경되었는지 확인하고 필요시 UI 재생성
        this.updateVisibleSkills();
        
        if (!this.player) return;
        
        // 서버에서 받은 쿨타임 정보가 있으면 그것을 우선 사용
        if (this.player.serverSkillCooldowns) {
            this.updateFromServer(this.player.serverSkillCooldowns);
            return;
        }

        // 기존 방식 (fallback) - 각 스킬에 대해 개별 처리
        if (!this.player.job) return;
        
        const cooldowns = this.player.job.getSkillCooldowns ? this.player.job.getSkillCooldowns() : {};
        
        // 각 스킬의 쿨타임 정보를 개별적으로 처리
        Object.keys(this.skillUIs).forEach(skillKey => {
            const ui = this.skillUIs[skillKey];
            if (!ui) return;
            
            const skillNumber = parseInt(skillKey.replace('skill', ''));
            const cooldownInfo = cooldowns[skillNumber];
            
            if (cooldownInfo && cooldownInfo.remaining > 0) {
                this.drawCooldown(skillKey, cooldownInfo.remaining, cooldownInfo.max);
            } else {
                ui.cooldown.clear();
                // 쿨타임이 끝나면 배경을 파란색으로 복원
                ui.background.clear();
                ui.background.fillStyle(0x0066ff, 0.8);
                ui.background.fillCircle(ui.x, ui.y, ui.radius);
            }
        });
    }

    /**
     * UI 파괴
     */
    destroyUI() {
        Object.keys(this.skillUIs).forEach(skillKey => {
            const ui = this.skillUIs[skillKey];
            if (ui) {
                if (ui.background) {
                    ui.background.destroy();
                }
                if (ui.cooldown) {
                    ui.cooldown.destroy();
                }
                if (ui.keyText) {
                    ui.keyText.destroy();
                }
            }
        });
        this.skillUIs = {};
    }

    /**
     * 정리
     */
    destroy() {
        this.destroyUI();
        this.lastJobClass = null;
        this.isUpdating = false;
    }
} 