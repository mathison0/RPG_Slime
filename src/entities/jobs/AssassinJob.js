import BaseJob from './BaseJob.js';
import EffectManager from '../../effects/EffectManager.js';
import { getGlobalTimerManager } from '../../managers/AbsoluteTimerManager.js';

/**
 * 클라이언트용 어쌔신 직업 클래스
 */
export default class AssassinJob extends BaseJob {
    constructor(player) {
        super(player);
        this.jobName = 'assassin';
        
        // 은신 관련 상태
        this.isStealth = false;
        this.stealthStartTime = 0;
        this.stealthDuration = 0;
        this.stealthEndTime = 0;
        this.originalAlpha = 1;
        this.originalSpeed = 1;
        this.originalVisionRange = 320;
        this.visionRestoreTime = 0;
        
        // 타이머 관련
        this.stealthTimer = null;
        
        // EffectManager 재초기화
        this.effectManager = new EffectManager(player.scene);
    }

    /**
     * 스킬 사용
     * @param {number} skillNumber - 스킬 번호 (1, 2, 3)
     * @param {Object} options - 스킬 사용 옵션
     */
    useSkill(skillNumber, options = {}) {
        // 기절 상태에서는 스킬 사용 불가
        if (this.player.isStunned) {
            console.log(`AssassinJob: 기절 상태에서 스킬 사용 시도 - 무시됨`);
            return;
        }

        switch (skillNumber) {
            case 1:
                this.useStealth(options);
                break;
            case 2:
                this.useSkill2(options);
                break;
            case 3:
                this.useSkill3(options);
                break;
            default:
                console.log(`AssassinJob: 알 수 없는 스킬 번호: ${skillNumber}`);
        }
    }

    /**
     * 은신 스킬 (스킬 1)
     * @param {Object} options - 스킬 옵션
     */
    useStealth(options = {}) {
        // 쿨타임 체크
        if (!this.isSkillAvailable('skill1')) {
            console.log('AssassinJob: 은신 스킬 쿨다운 중');
            return;
        }

        // 이미 은신 중이면 사용 불가
        if (this.isStealth) {
            console.log('AssassinJob: 이미 은신 상태');
            return;
        }

        console.log('AssassinJob: 은신 스킬 사용 요청');
        
        // 서버에 스킬 사용 요청
        if (this.player.networkManager) {
            this.player.networkManager.useSkill('stealth');
        }
    }

    /**
     * 칼춤 스킬 (스킬 2)
     * @param {Object} options - 스킬 옵션
     */
    useSkill2(options = {}) {
        // 쿨타임 체크
        if (!this.isSkillAvailable('skill2')) {
            console.log('AssassinJob: 칼춤 스킬 쿨다운 중');
            return;
        }

        console.log('AssassinJob: 칼춤 스킬 사용 요청');
        
        // 서버에 스킬 사용 요청
        if (this.player.networkManager) {
            this.player.networkManager.useSkill('blade_dance');
        }
    }

    /**
     * 목긋기 스킬 (스킬 3)
     * @param {Object} options - 스킬 옵션
     */
    useSkill3(options = {}) {
        // 쿨타임 체크
        if (!this.isSkillAvailable('skill3')) {
            console.log('AssassinJob: 목긋기 스킬 쿨다운 중');
            return;
        }

        console.log('AssassinJob: 목긋기 스킬 사용 요청');
        
        // 서버에 스킬 사용 요청
        if (this.player.networkManager) {
            this.player.networkManager.useSkill('backstab', options);
        }
    }

    /**
     * 은신 상태 시작 (서버에서 호출됨)
     * @param {Object} data - 은신 데이터
     */
    startStealth(data) {
        console.log('AssassinJob: 은신 상태 시작', data);
        
        this.isStealth = true;
        this.stealthStartTime = data.startTime || Date.now();
        this.stealthDuration = data.duration || 5000;
        this.stealthEndTime = data.endTime || (this.stealthStartTime + this.stealthDuration);
        
        // 서버에서 받은 배율 정보 저장
        this.speedMultiplier = data.speedMultiplier || 1.2;
        this.visionMultiplier = data.visionMultiplier || 1.3;
        
        // 원본 값들 저장
        this.originalAlpha = this.player.alpha;
        this.originalSpeed = this.player.speed || 1;
        this.originalVisionRange = this.player.visionRange || 1;
        

        
        // 은신 효과 적용
        this.applyStealthEffects();
        
        // 은신 이펙트 표시
        this.showStealthEffect();
        
        // 절대 시간 기준으로 정확한 타이머 구현
        this.startStealthTimer();
    }

    /**
     * 은신 타이머 시작
     */
    startStealthTimer() {
        const targetEndTime = this.stealthEndTime;
        
        const checkStealthEnd = () => {
            const now = Date.now();
            if (now >= targetEndTime) {
                // 정확한 시간에 도달 - 은신 종료
                console.log('AssassinJob: 은신 타이머 종료 [time: ' + Date.now() + '] [target: ' + targetEndTime + ']');
                this.endStealth();
                return;
            }
            
            // 아직 시간이 안됨 - 다음 프레임에 다시 체크
            this.stealthTimer = requestAnimationFrame(checkStealthEnd);
        };
        
        // 즉시 체크 시작
        requestAnimationFrame(checkStealthEnd);
        
        // 타이머 정리를 위한 참조 저장
        if (this.player.delayedSkillTimers) {
            this.player.delayedSkillTimers.add({ remove: () => {
                if (this.stealthTimer) {
                    cancelAnimationFrame(this.stealthTimer);
                    this.stealthTimer = null;
                }
            }});
        }
    }

    /**
     * 은신 상태 종료 (서버에서 호출됨)
     */
    endStealth(data = {}) {
        console.log('AssassinJob: 은신 상태 종료', data);
        
        // 타이머 정리
        if (this.stealthTimer) {
            cancelAnimationFrame(this.stealthTimer);
            this.stealthTimer = null;
        }
        
        this.isStealth = false;
        this.stealthStartTime = 0;
        this.stealthDuration = 0;
        this.stealthEndTime = 0;
        
        // 서버에서 받은 원본 시야 범위 정보 사용
        if (data.originalVisionRange !== undefined) {
            this.originalVisionRange = data.originalVisionRange;
        }
        
        // 은신 효과 제거
        this.removeStealthEffects();
        
        // 은신 해제 이펙트 표시
        this.showStealthEndEffect();
        
        // 시야 범위 복원 후 일정 시간 동안 서버 업데이트 무시
        this.visionRestoreTime = Date.now();
    }

    /**
     * 은신 효과 적용
     */
    applyStealthEffects() {
        if (!this.player) return;
        
        // 투명도 설정 (팀원과 자신에게는 약간 투명하게)
        if (this.player.isMyPlayer) {
            // 자신에게는 70% 투명도
            this.player.setAlpha(0.3);
        } else {
            // 다른 플레이어에게는 50% 투명도 (팀원)
            this.player.setAlpha(0.5);
        }
        
        // 서버에서 받은 배율 사용
        if (this.player.speed) {
            this.player.speed = this.originalSpeed * this.speedMultiplier;
        }
        
        // 서버에서 받은 배율 사용
        if (this.player.visionRange !== undefined) {
            this.player.visionRange = this.originalVisionRange * this.visionMultiplier;
            
            // VisionManager에 시야 업데이트 알림
            if (this.player.scene && this.player.scene.visionManager) {
                this.player.scene.visionManager.updateVision();
            }
        }
        
        // 적에게는 완전히 투명하게 보이도록 설정
        // (이는 서버에서 처리되며, 클라이언트에서는 시각적 효과만)
    }

    /**
     * 은신 효과 제거
     */
    removeStealthEffects() {
        if (!this.player) return;
        
        // 투명도 복원
        this.player.setAlpha(this.originalAlpha);
        
        // 이동속도 복원
        if (this.player.speed) {
            this.player.speed = this.originalSpeed;
        }
        
        // 시야 범위 복원
        if (this.player.visionRange !== undefined) {
            this.player.visionRange = this.originalVisionRange;
            
            // VisionManager에 시야 업데이트 알림
            if (this.player.scene && this.player.scene.visionManager) {
                this.player.scene.visionManager.updateVision();
            }
        }
    }

    /**
     * 기본 공격 이펙트
     */
    showBasicAttackEffect(targetX, targetY) {
        if (!this.scene) return;    
        
        // 어쌔신 쌍단검 공격 이펙트 (검은색으로 빠르게 두 번 공격)
        const width = 40;  // 직사각형 너비 (서버와 동일)
        const height = 60; // 직사각형 높이 (서버와 동일)
        
        // 플레이어에서 마우스 커서까지의 각도 계산
        const centerX = this.player.x;
        const centerY = this.player.y;
        const angleToMouse = Phaser.Math.Angle.Between(centerX, centerY, targetX, targetY);
        
        // 첫 번째 공격 이펙트 (왼쪽 단검)
        this.createDaggerEffect(centerX, centerY, angleToMouse, width, height, -10, 0);
        
        // 두 번째 공격 이펙트 (오른쪽 단검) - 약간의 지연 후
        this.scene.time.delayedCall(100, () => {
            this.createDaggerEffect(centerX, centerY, angleToMouse, width, height, 10, 0);
        });
    }

    /**
     * 단검 공격 이펙트 생성
     */
    createDaggerEffect(centerX, centerY, angleToMouse, width, height, offsetX, offsetY) {
        // 직사각형의 네 꼭지점 계산 (회전된)
        const cos = Math.cos(angleToMouse);
        const sin = Math.sin(angleToMouse);
        const halfWidth = width / 2;
        
        // 회전 변환을 직접 계산 (플레이어 위치가 직사각형 하단 중심)
        const corners = [
            { x: 0, y: -halfWidth },        // 좌하단
            { x: height, y: -halfWidth },   // 우하단  
            { x: height, y: halfWidth },    // 우상단
            { x: 0, y: halfWidth }          // 좌상단
        ];
        
        // 회전된 좌표 계산 (오프셋 적용)
        const rotatedCorners = corners.map(corner => ({
            x: centerX + (corner.x * cos - corner.y * sin) + (offsetX * cos - offsetY * sin),
            y: centerY + (corner.x * sin + corner.y * cos) + (offsetX * sin + offsetY * cos)
        }));
        
        // 검은색 단검 공격 이펙트
        const graphics = this.scene.add.graphics();
        graphics.fillStyle(0x000000, 0.9); // 검은색
        graphics.lineStyle(1, 0x333333, 1); // 어두운 회색 테두리
        
        // 직사각형 그리기
        graphics.beginPath();
        graphics.moveTo(rotatedCorners[0].x, rotatedCorners[0].y);
        for (let i = 1; i < rotatedCorners.length; i++) {
            graphics.lineTo(rotatedCorners[i].x, rotatedCorners[i].y);
        }
        graphics.closePath();
        graphics.fill();
        graphics.stroke();
        
        // 이펙트 애니메이션 (어쌔신은 매우 빠르게 사라짐)
        this.scene.tweens.add({
            targets: graphics,
            alpha: 0,
            duration: 150, // 매우 빠름
            onComplete: () => {
                graphics.destroy();
            }
        });
    }

    /**
     * 은신 이펙트 표시
     */
    showStealthEffect() {
        if (!this.player || !this.scene) return;
        
        // 은신 시작 메시지
        this.effectManager.showSkillMessage(
            this.player.x,
            this.player.y - 60,
            '은신!'
        );
    }

    /**
     * 은신 해제 이펙트 표시
     */
    showStealthEndEffect() {
        if (!this.player || !this.scene) return;
        
        // 은신 해제 메시지
        this.effectManager.showSkillMessage(
            this.player.x,
            this.player.y - 60,
            '은신 해제!'
        );
    }

    /**
     * 스킬 이펙트 표시
     */
    showSkillEffect(skillType, data = null) {
        if (!this.scene) return;
        
        switch (skillType) {
            case 'stealth':
                this.showStealthEffect();
                break;
            case 'stealth_end':
                this.showStealthEndEffect();
                break;
            case 'blade_dance':
                this.showBladeDanceEffect(data);
                break;
            case 'backstab':
                this.showBackstabEffect(data);
                break;
            default:
                console.log('AssassinJob: 알 수 없는 스킬 이펙트:', skillType);
        }
    }

    /**
     * 칼춤 이펙트 표시
     */
    showBladeDanceEffect(data = null) {
        if (!this.player || !this.scene) return;
        
        const startTime = Date.now();
        console.log(`[${startTime}] 어쌔신의 칼춤 이펙트 시작`);
        
        // 기존 칼춤 이펙트가 있다면 제거
        if (this.player.bladeDanceEffect) {
            this.player.bladeDanceEffect.destroy();
            this.player.bladeDanceEffect = null;
        }
        
        // 기존 칼춤 타이머가 있다면 제거
        if (this.player.bladeDanceTimer) {
            if (this.player.bladeDanceTimer.remove) {
                this.player.bladeDanceTimer.remove();
            }
            this.player.bladeDanceTimer = null;
        }
        
        // 서버에서 받은 스킬 정보 사용
        const skillInfo = data.skillInfo;
        const endTime = data.endTime; // 서버에서 받은 절대 종료 시간
        
        console.log(`[${startTime}] 어쌔신의 칼춤 스킬 정보 (서버에서 받음): endTime=${endTime}`);
        
        // EffectManager를 사용한 칼춤 스킬 메시지 표시
        this.effectManager.showSkillMessage(
            this.player.x, 
            this.player.y, 
            '칼춤!', 
            {
                fontSize: '16px',
                fill: '#FF0000'
            }
        );
        
        // 칼춤 효과 (빨간색 오라) - 플레이어를 따라다니도록 설정
        const bladeDanceAura = this.player.scene.add.circle(this.player.x, this.player.y, 40, 0xFF0000, 0.4);
        this.player.bladeDanceEffect = bladeDanceAura;
        
        // 플레이어를 따라다니도록 설정 (깜빡임 없이 고정 투명도)
        this.player.scene.tweens.add({
            targets: bladeDanceAura,
            alpha: 0.4, // 고정 투명도
            duration: 100,
            onComplete: () => {
                // 플레이어 위치에 고정
                bladeDanceAura.setPosition(this.player.x, this.player.y);
            }
        });
        
        // 다른 플레이어들도 이펙트를 볼 수 있도록 설정
        bladeDanceAura.setDepth(1); // 플레이어 위에 표시
        
        // 플레이어 업데이트 시 오라 위치도 업데이트 (모든 플레이어에 적용)
        const originalUpdate = this.player.update;
        this.player.update = function(time, delta) {
            originalUpdate.call(this, time, delta);
            if (bladeDanceAura.active) {
                bladeDanceAura.setPosition(this.x, this.y);
            }
        };
        
        // 다른 플레이어의 경우 추가적인 위치 추적 설정
        let originalSetPosition = null;
        if (this.player.isOtherPlayer) {
            // 다른 플레이어의 경우, 위치 업데이트 시 이펙트도 함께 이동
            originalSetPosition = this.player.setPosition;
            this.player.setPosition = function(x, y) {
                originalSetPosition.call(this, x, y);
                if (bladeDanceAura.active) {
                    bladeDanceAura.setPosition(x, y);
                }
            };
        }
        
        // 절대 시간 기준으로 효과 종료 타이머 설정
        const timerManager = getGlobalTimerManager();
        const eventId = timerManager.addEvent(endTime, () => {
            const actualEndTime = Date.now();
            const actualDuration = actualEndTime - startTime;
            
            // 칼춤 효과 제거
            if (bladeDanceAura.active) {
                bladeDanceAura.destroy();
                console.log(`[${actualEndTime}] 어쌔신의 칼춤 효과 제거 (실제 지속시간: ${actualDuration}ms)`);
            }
            
            // 플레이어 참조 정리
            if (this.player.bladeDanceEffect === bladeDanceAura) {
                this.player.bladeDanceEffect = null;
            }
            
            // 플레이어 업데이트 함수 복원
            this.player.update = originalUpdate;
            
            // 다른 플레이어의 경우 setPosition 함수도 복원
            if (this.player.isOtherPlayer && originalSetPosition !== null) {
                this.player.setPosition = originalSetPosition;
            }
            
            // 타이머 참조 정리
            this.player.bladeDanceTimer = null;
        });
        
        // 호환성을 위한 타이머 객체
        this.player.bladeDanceTimer = {
            remove: () => timerManager.removeEvent(eventId)
        };
    }

    /**
     * 목긋기 이펙트 표시
     */
    showBackstabEffect(data = null) {
        if (!this.player || !this.scene) return;
        
        console.log('어쌔신 목긋기 이펙트 시작', data);
        
        // 서버에서 받은 정보
        console.log('목긋기 받은 데이터:', data);
        const { targetId, targetX, targetY, newX, newY, damage, wasStealthAttack, endTime } = data;
        
        // 목긋기 스킬 메시지 표시
        this.effectManager.showSkillMessage(
            this.player.x, 
            this.player.y, 
            '목긋기!', 
            {
                fontSize: '16px',
                fill: '#FF0000'
            }
        );
        
        // 순간이동 이펙트 (검은색 연기)
        const teleportEffect = this.scene.add.circle(this.player.x, this.player.y, 30, 0x000000, 0.6);
        teleportEffect.setDepth(2);
        
        // 순간이동 애니메이션
        this.scene.tweens.add({
            targets: teleportEffect,
            scaleX: 0.1,
            scaleY: 0.1,
            alpha: 0,
            duration: 300,
            onComplete: () => {
                teleportEffect.destroy();
            }
        });
        
        // 즉시 이동 처리
        if (newX !== undefined && newY !== undefined) {
            console.log(`목긋기 즉시 이동: (${this.player.x}, ${this.player.y}) -> (${newX}, ${newY})`);
            this.player.setPosition(newX, newY);
            console.log(`목긋기 이동 완료: (${newX}, ${newY})`);
        } else {
            console.log('목긋기: newX/newY 정보가 없습니다:', { newX, newY });
        }
        
        // 대상에게 데미지 표시
        if (targetId && damage) {
            // 플레이어에서 찾기
            let target = this.player.scene.players?.get(targetId);
            
            // 플레이어에서 찾지 못했으면 몬스터에서 찾기
            if (!target) {
                target = this.player.scene.enemies?.get(targetId);
            }
            
            if (target) {
                this.effectManager.showDamageText(
                    target.x,
                    target.y - 30,
                    damage,
                    wasStealthAttack ? '#FF0000' : '#FFFFFF'
                );
            }
        }
        
        // 은신 상태에서 사용했다면 은신 상태 유지 (서버에서 이미 처리됨)
        if (wasStealthAttack) {
            console.log('어쌔신: 은신 상태에서 목긋기 사용 - 은신 상태 유지');
        }
    }

    update(delta) {
        super.update(delta);
        
        // 은신 지속시간 체크는 이제 requestAnimationFrame 기반 타이머로 처리
        // 매 프레임 체크하는 방식 제거
    }

    /**
     * 스킬 이펙트 정리
     */
    clearSkillEffects() {
        super.clearSkillEffects();
        
        // 은신 타이머 정리
        if (this.stealthTimer) {
            cancelAnimationFrame(this.stealthTimer);
            this.stealthTimer = null;
        }
        
        // 은신 상태 초기화
        this.isStealth = false;
        this.stealthStartTime = 0;
        this.stealthDuration = 0;
        this.stealthEndTime = 0;
        
        // 칼춤 이펙트 정리
        if (this.player.bladeDanceEffect) {
            this.player.bladeDanceEffect.destroy();
            this.player.bladeDanceEffect = null;
        }
        
        // 칼춤 타이머 정리
        if (this.player.bladeDanceTimer) {
            if (this.player.bladeDanceTimer.remove) {
                this.player.bladeDanceTimer.remove();
            }
            this.player.bladeDanceTimer = null;
        }
    }

    /**
     * 정리 작업
     */
    destroy() {
        this.clearSkillEffects();
        super.destroy();
    }
}
