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
        
        // 직업별 최대 쿨타임 저장 (ms 단위)
        this.maxCooldowns = {
            skill1: 1000,
            skill2: 1000,
            skill3: 1000
        };
        
        // 초기 직업에 대한 최대 쿨타임 설정
        const initialJobClass = player?.jobClass || 'slime';
        this.updateMaxCooldowns(initialJobClass);
        
        this.createUI();
    }

    /**
     * 직업 변경 시 최대 쿨타임 업데이트
     * @param {string} jobClass - 변경된 직업 클래스
     */
    updateMaxCooldowns(jobClass) {
        // 서버에서 받은 직업별 쿨타임 정보를 사용
        if (this.scene.jobCooldowns && this.scene.jobCooldowns[jobClass]) {
            const jobCooldownData = this.scene.jobCooldowns[jobClass];
            
            // 각 스킬의 최대 쿨타임 업데이트
            this.maxCooldowns.skill1 = jobCooldownData.skill1?.cooldown || 3000;
            this.maxCooldowns.skill2 = jobCooldownData.skill2?.cooldown || 3000;
            this.maxCooldowns.skill3 = jobCooldownData.skill3?.cooldown || 3000;
        } else {
            // fallback: 기본 쿨타임 사용
            console.warn(`[SkillCooldownUI] ${jobClass} 직업의 쿨타임 정보를 찾을 수 없습니다. 기본값 사용.`);
            console.warn('[SkillCooldownUI] 사용 가능한 직업 목록:', this.scene.jobCooldowns ? Object.keys(this.scene.jobCooldowns) : 'jobCooldowns가 null/undefined');
            this.maxCooldowns = {
                skill1: 3000,
                skill2: 3000,
                skill3: 3000
            };
        }
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
            
            // 쿨타임 카운트다운 텍스트 (처음에는 숨김)
            const cooldownText = this.scene.add.text(config.x, config.y + 5, '', {
                fontSize: '14px',
                fill: '#ffffff',
                fontStyle: 'bold',
                stroke: '#000000',
                strokeThickness: 2
            }).setOrigin(0.5);
            cooldownText.setScrollFactor(0);
            cooldownText.setDepth(1003);
            cooldownText.setVisible(false);
            
            // 스킬 UI 저장
            this.skillUIs[config.key] = {
                background: background,
                cooldown: cooldown,
                keyText: keyText,
                cooldownText: cooldownText,
                x: config.x,
                y: config.y,
                radius: radius,
                isVisible: true // 생성된 것은 모두 보임
            };
        }
        
        // 직업 변경 시 최대 쿨타임 업데이트
        this.updateMaxCooldowns(jobClass);
        
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

        // 각 스킬의 쿨타임 정보를 개별적으로 처리 (endTime 기반)
        Object.keys(this.skillUIs).forEach(skillKey => {
            const ui = this.skillUIs[skillKey];
            if (!ui) return;
            
            const cooldownInfo = serverSkillCooldowns[skillKey];
            if (cooldownInfo && cooldownInfo.nextAvailableTime) {
                const now = Date.now();
                const endTime = cooldownInfo.nextAvailableTime;
                const remaining = Math.max(0, endTime - now);
                
                if (remaining > 0) {
                    // 서버에서 저장된 총 쿨타임 정보 사용
                    const totalCooldown = this.getServerTotalCooldown(skillKey);
                    
                    this.drawCooldown(skillKey, remaining, totalCooldown);
                } else {
                    // 쿨타임이 끝난 스킬의 UI 초기화
                    ui.cooldown.clear();
                    // 쿨타임이 끝나면 배경을 파란색으로 복원
                    ui.background.clear();
                    ui.background.fillStyle(0x0066ff, 0.8);
                    ui.background.fillCircle(ui.x, ui.y, ui.radius);
                    
                    // 쿨타임 텍스트 숨기기
                    if (ui.cooldownText) {
                        ui.cooldownText.setVisible(false);
                    }
                }
            } else {
                // 쿨타임 정보가 없는 스킬의 UI 초기화
                ui.cooldown.clear();
                // 쿨타임이 끝나면 배경을 파란색으로 복원
                ui.background.clear();
                ui.background.fillStyle(0x0066ff, 0.8);
                ui.background.fillCircle(ui.x, ui.y, ui.radius);
                
                // 쿨타임 텍스트 숨기기
                if (ui.cooldownText) {
                    ui.cooldownText.setVisible(false);
                }
            }
        });
    }
    
    /**
     * 저장된 최대 쿨타임 시간을 가져오기
     * @param {string} skillKey - 스킬 키 (skill1, skill2, skill3)
     * @returns {number} - 총 쿨타임 시간 (ms)
     */
    getServerTotalCooldown(skillKey) {
        // 직업 변경 시 저장된 최대 쿨타임 사용 (우선순위 1)
        if (this.maxCooldowns && this.maxCooldowns[skillKey]) {
            return this.maxCooldowns[skillKey];
        }
        
        // 최종 fallback
        return 1000;
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
        
        if (remaining > 0 && total > 0) {
            // 진행률 계산: 시간이 지날수록 0에서 1로 증가 (완료된 비율)
            const completedProgress = (total - remaining) / total; 
            // 남은 비율: 시간이 지날수록 1에서 0으로 감소 (남은 비율)
            const remainingProgress = remaining / total;
            
            // 12시 방향에서 시작하여 시계방향으로 진행
            const startAngle = -Math.PI / 2; // 12시 방향
            const endAngle = startAngle + (2 * Math.PI * completedProgress); // 시계방향으로 진행
            
            // 배경을 회색으로 변경 (쿨타임 중)
            ui.background.clear();
            ui.background.fillStyle(0x666666, 0.8);
            ui.background.fillCircle(ui.x, ui.y, ui.radius);
            
            // 남은 쿨타임 부분을 파란색으로 표시 (arc 사용)
            if (remainingProgress > 0) {
                ui.cooldown.fillStyle(0x4488ff, 0.7);
                ui.cooldown.beginPath();
                ui.cooldown.arc(ui.x, ui.y, ui.radius, endAngle, startAngle + (2 * Math.PI), false);
                ui.cooldown.lineTo(ui.x, ui.y);
                ui.cooldown.closePath();
                ui.cooldown.fillPath();
            }
            
            // 경계선 (밝은 파란색)
            ui.cooldown.lineStyle(2, 0x66aaff, 1.0);
            ui.cooldown.strokeCircle(ui.x, ui.y, ui.radius);
            
            // 쿨타임 텍스트 표시 (초 단위)
            const remainingSeconds = Math.ceil(remaining / 1000);
            if (ui.cooldownText) {
                ui.cooldownText.setText(remainingSeconds.toString());
                ui.cooldownText.setVisible(true);
            }
        } else {
            // 쿨타임이 끝나면 배경을 파란색으로 복원
            ui.background.clear();
            ui.background.fillStyle(0x0066ff, 0.8);
            ui.background.fillCircle(ui.x, ui.y, ui.radius);
            
            // 쿨타임 텍스트 숨기기
            if (ui.cooldownText) {
                ui.cooldownText.setVisible(false);
            }
        }
    }

    /**
     * 업데이트 (서버 endTime 기반)
     */
    update() {
        // 직업이 변경되었는지 확인하고 필요시 UI 재생성
        this.updateVisibleSkills();
        
        if (!this.player) return;
        
        // 서버에서 받은 쿨타임 endTime 정보로만 업데이트
        if (this.player.serverSkillCooldowns) {
            this.updateFromServer(this.player.serverSkillCooldowns);
        } else {
            // 서버 쿨타임 정보가 없으면 모든 스킬을 사용 가능 상태로 표시
            Object.keys(this.skillUIs).forEach(skillKey => {
                const ui = this.skillUIs[skillKey];
                if (!ui) return;
                
                ui.cooldown.clear();
                // 쿨타임이 끝나면 배경을 파란색으로 복원
                ui.background.clear();
                ui.background.fillStyle(0x0066ff, 0.8);
                ui.background.fillCircle(ui.x, ui.y, ui.radius);
                
                // 쿨타임 텍스트 숨기기
                if (ui.cooldownText) {
                    ui.cooldownText.setVisible(false);
                }
            });
        }
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
                if (ui.cooldownText) {
                    ui.cooldownText.destroy();
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