import BaseJob from './BaseJob.js';
import { getGlobalTimerManager } from '../../managers/AbsoluteTimerManager.js';
import EffectManager from '../../effects/EffectManager.js';
// JobClasses는 서버에서 관리하므로 import 제거

/**
 * 전사 직업 클래스
 */
export default class WarriorJob extends BaseJob {
    constructor(player) {
        super(player);
        
        this.sweepSprite = null;
        this.sweepGraphics = null;
        
        this.thrustSprite = null;
        this.thrustGraphics = null;
        
        this.effectManager = new EffectManager(player.scene);
    }

    useSkill(skillNumber, options = {}) {
        if (this.player.isOtherPlayer || !this.player.networkManager) {
            return;
        }
        switch (skillNumber) {
            case 1: // Q키
                this.player.networkManager.useSkill('roar');
                break;
            case 2: // E키
                this.player.networkManager.useSkill('sweep', {
                    targetX: this.scene.input.mousePointer.worldX,
                    targetY: this.scene.input.mousePointer.worldY
                });
                break;
            case 3: // R키
                this.player.networkManager.useSkill('thrust', {
                    targetX: mouseX,
                    targetY: mouseY
                });
                break;
            default:
                console.log('WarriorJob: 알 수 없는 스킬 번호:', skillNumber);
        }
    }

    /**
     * 전사 기본 공격 이펙트 (직사각형)
     */
    showBasicAttackEffect(targetX, targetY) {
        // 직사각형 공격 범위 설정
        const width = 30;  // 직사각형 너비
        const height = 60; // 직사각형 높이 (플레이어에서 커서까지)
        
        // 플레이어에서 마우스 커서까지의 각도 계산
        const centerX = this.player.x;
        const centerY = this.player.y;
        const angleToMouse = Phaser.Math.Angle.Between(centerX, centerY, targetX, targetY);
        
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
        
        // 회전된 좌표 계산
        const rotatedCorners = corners.map(corner => ({
            x: centerX + (corner.x * cos - corner.y * sin),
            y: centerY + (corner.x * sin + corner.y * cos)
        }));
        
        // 직사각형 근접 공격 이펙트 (빨간색 직사각형)
        const graphics = this.player.scene.add.graphics();
        graphics.fillStyle(0xff0000, 0.8);
        graphics.lineStyle(3, 0xff0000, 1);
        
        // 직사각형 그리기
        graphics.beginPath();
        graphics.moveTo(rotatedCorners[0].x, rotatedCorners[0].y);
        for (let i = 1; i < rotatedCorners.length; i++) {
            graphics.lineTo(rotatedCorners[i].x, rotatedCorners[i].y);
        }
        graphics.closePath();
        graphics.fill();
        graphics.stroke();
        
        // 이펙트 애니메이션
        this.player.scene.tweens.add({
            targets: graphics,
            alpha: 0,
            duration: 400,
            onComplete: () => {
                graphics.destroy();
            }
        });
    }

    /**
     * 울부짖기 이펙트
     */
    showRoarEffect(data = null) {
        const startTime = Date.now();
        console.log(`[${startTime}] 울부짖기 이펙트 시작`);
        
        // 기존 울부짖기 이펙트가 있다면 제거
        if (this.player.roarEffectTimer) {
            this.player.scene.time.removeEvent(this.player.roarEffectTimer);
            this.player.roarEffectTimer = null;
        }
        
        // 울부짖기 스프라이트로 변경
        this.player.setTexture('warrior_skill');
        
        // EffectManager를 사용한 울부짖기 메시지 표시
        this.effectManager.showSkillMessage(
            this.player.x, 
            this.player.y, 
            '크아앙!'
        );
        
        // 스프라이트는 지속시간 후 복원 (절대 시간 기준)
        const timerManager = getGlobalTimerManager();
        const targetEndTime = Date.now() + 1000;
        const eventId = timerManager.addEvent(targetEndTime, () => {
            if (this.player.active) {
                this.player.updateJobSprite();
            }
            this.player.roarEffectTimer = null;
        });
        
        // 호환성을 위한 타이머 객체
        this.player.roarEffectTimer = {
            remove: () => timerManager.removeEvent(eventId)
        };
    }

    /**
     * 휩쓸기 시전 이펙트
     */
    showSweepCastingEffect(mouseX, mouseY, angleOffset, range, effectEndTime, endTime) {
        console.log('휩쓸기 시전 이펙트 시작 : [time: ' + Date.now() + '] [endTime: ' + effectEndTime + ']');
        // 부채꼴 모양의 휩쓸기 그래픽 생성 (시전 중 - 연한 색상)
        const sweepGraphics = this.player.scene.add.graphics();
        sweepGraphics.setDepth(750);
        sweepGraphics.fillStyle(0xff0000, 0.3);
        sweepGraphics.lineStyle(3, 0xff0000, 0.7);
        
        // 플레이어에서 마우스 커서까지의 각도 계산
        const centerX = this.player.x;
        const centerY = this.player.y;
        
        const angleToMouse = Phaser.Math.Angle.Between(centerX, centerY, mouseX, mouseY);
        const startAngle = angleToMouse - angleOffset;
        const endAngle = angleToMouse + angleOffset;
        
        sweepGraphics.beginPath();
        sweepGraphics.moveTo(centerX, centerY);
        sweepGraphics.arc(centerX, centerY, range, startAngle, endAngle);
        sweepGraphics.closePath();
        sweepGraphics.fillPath();
        sweepGraphics.strokePath();
        
        // EffectManager를 사용한 시전 중 메시지
        const castingText = this.effectManager.showSkillCastingMessage(
            this.player.x, 
            this.player.y, 
            '휩쓸기 준비 중...'
        );
        
        // 절대 시간 기준 타이머 매니저 사용
        const timerManager = getGlobalTimerManager();
        const eventId = timerManager.addEvent(effectEndTime, () => {
            // 정확한 시간에 도달 - 정리 실행
            if (sweepGraphics.active) {
                sweepGraphics.destroy();
            }
            if (castingText.active) {
                castingText.destroy();
            }
            
            console.log('휩쓸기 시전 이펙트 종료: [time: ' + Date.now() + '] [target: ' + effectEndTime + ']');

            this.showSweepDamageEffect(mouseX, mouseY, angleOffset, range, endTime);
        });
        
        // 호환성을 위한 타이머 객체
        const cleanupTimer = {
            remove: () => timerManager.removeEvent(eventId)
        };
        
        if (this.player.delayedSkillTimers) {
            this.player.delayedSkillTimers.add(cleanupTimer);
        }
    }

    /**
     * 휩쓸기 데미지 이펙트 (실제 효과)
     */
    showSweepDamageEffect(mouseX, mouseY, angleOffset, range, endTime) {
        console.log('휩쓸기 시전 이펙트 시작 : [time: ' + Date.now() + '] [endTime: ' + endTime + ']');

        const sweepGraphics = this.player.scene.add.graphics();
        sweepGraphics.setDepth(750);
        sweepGraphics.fillStyle(0xff0000, 0.7); // 더 진한 색상으로 변경
        sweepGraphics.lineStyle(4, 0xff0000, 1.0); // 더 진한 테두리
        
        // 플레이어에서 마우스 커서까지의 각도 계산
        const centerX = this.player.x;
        const centerY = this.player.y;
        
        const angleToMouse = Phaser.Math.Angle.Between(centerX, centerY, mouseX, mouseY);
        const startAngle = angleToMouse - angleOffset;
        const endAngle = angleToMouse + angleOffset;
        
        sweepGraphics.beginPath();
        sweepGraphics.moveTo(centerX, centerY);
        sweepGraphics.arc(centerX, centerY, range, startAngle, endAngle);
        sweepGraphics.closePath();
        sweepGraphics.fillPath();
        sweepGraphics.strokePath();
        
        // EffectManager를 사용한 공격 효과 메시지
        const attackText = this.effectManager.showSkillMessage(
            this.player.x, 
            this.player.y, 
            '휩쓸기!'
        );
        
        // 절대 시간 기준 타이머 매니저 사용
        const timerManager = getGlobalTimerManager();
        const eventId = timerManager.addEvent(endTime, () => {
            // 정확한 시간에 도달 - 정리 실행
            if (sweepGraphics.active) {
                sweepGraphics.destroy();
            }
            if (attackText.active) {
                attackText.destroy();
            }
            
            console.log('휩쓸기 데미지 이펙트 종료 [time: ' + Date.now() + '] [target: ' + endTime + ']');
        });
        
        // 호환성을 위한 타이머 객체
        const effectCleanupTimer = {
            remove: () => timerManager.removeEvent(eventId)
        };
        
        if (this.player.delayedSkillTimers) {
            this.player.delayedSkillTimers.add(effectCleanupTimer);
        }
    }

    /**
     * 찌르기 시전 이펙트
     */
    showThrustCastingEffect(mouseX, mouseY, height, width, effectEndTime, endTime) {
        console.log('찌르기 시전 이펙트 시작 : [time: ' + Date.now() + '] [endTime: ' + effectEndTime + ']');
        // 직사각형 모양의 찌르기 그래픽 생성 (시전 중 - 연한 색상)
        const thrustGraphics = this.player.scene.add.graphics();
        thrustGraphics.fillStyle(0xff0000, 0.2); // 더 연한 색상
        thrustGraphics.lineStyle(2, 0xff0000, 0.5); // 더 연한 테두리
        
        // 플레이어에서 마우스 커서까지의 각도 계산
        const centerX = this.player.x;
        const centerY = this.player.y;
        const angleToMouse = Phaser.Math.Angle.Between(centerX, centerY, mouseX, mouseY);
        
        // 직사각형의 네 꼭지점 계산 (회전된)
        const cos = Math.cos(angleToMouse);
        const sin = Math.sin(angleToMouse);
        const halfWidth = width / 2;
        
        // 회전 변환을 직접 계산
        const corners = [
            { x: 0, y: -halfWidth },        // 좌하단
            { x: height, y: -halfWidth },   // 우하단  
            { x: height, y: halfWidth },    // 우상단
            { x: 0, y: halfWidth }          // 좌상단
        ];
        
        // 회전된 좌표 계산
        const rotatedCorners = corners.map(corner => ({
            x: centerX + (corner.x * cos - corner.y * sin),
            y: centerY + (corner.x * sin + corner.y * cos)
        }));
        
        // 직사각형 그리기
        thrustGraphics.beginPath();
        thrustGraphics.moveTo(rotatedCorners[0].x, rotatedCorners[0].y);
        for (let i = 1; i < rotatedCorners.length; i++) {
            thrustGraphics.lineTo(rotatedCorners[i].x, rotatedCorners[i].y);
        }
        thrustGraphics.closePath();
        thrustGraphics.fillPath();
        thrustGraphics.strokePath();
        
        // EffectManager를 사용한 시전 중 메시지
        const castingText = this.effectManager.showSkillCastingMessage(
            this.player.x, 
            this.player.y, 
            '찌르기 준비 중...'
        );
        
        // 절대 시간 기준 타이머 매니저 사용
        const timerManager = getGlobalTimerManager();
        const eventId = timerManager.addEvent(effectEndTime, () => {
            // 정확한 시간에 도달 - 정리 실행
            if (thrustGraphics.active) {
                thrustGraphics.destroy();
            }
            if (castingText.active) {
                castingText.destroy();
            }

            this.showThrustDamageEffect(mouseX, mouseY, height, width, endTime);
        });
        
        // 호환성을 위한 타이머 객체
        const cleanupTimer = {
            remove: () => timerManager.removeEvent(eventId)
        };
        
        if (this.player.delayedSkillTimers) {
            this.player.delayedSkillTimers.add(cleanupTimer);
        }
    }

    /**
     * 찌르기 데미지 이펙트 (실제 효과)
     */
    showThrustDamageEffect(mouseX, mouseY, height, width, endTime) {
        console.log('찌르기 데미지 이펙트 시작 : [time: ' + Date.now() + '] [endTime: ' + endTime + ']');
        
        // 강력한 공격 이펙트 - 진한 색상
        const thrustGraphics = this.player.scene.add.graphics();
        thrustGraphics.setDepth(750); // 깊이 설정으로 다른 객체 위에 표시
        thrustGraphics.fillStyle(0xff0000, 0.7); // 더 진한 색상으로 변경
        thrustGraphics.lineStyle(4, 0xff0000, 1.0); // 더 진한 테두리
        
        // 플레이어에서 마우스 커서까지의 각도 계산
        const centerX = this.player.x;
        const centerY = this.player.y;
        const angleToMouse = Phaser.Math.Angle.Between(centerX, centerY, mouseX, mouseY);
        
        // 직사각형의 네 꼭지점 계산 (회전된)
        const cos = Math.cos(angleToMouse);
        const sin = Math.sin(angleToMouse);
        const halfWidth = width / 2;
        
        // 회전 변환을 직접 계산
        const corners = [
            { x: 0, y: -halfWidth },        // 좌하단
            { x: height, y: -halfWidth },   // 우하단  
            { x: height, y: halfWidth },    // 우상단
            { x: 0, y: halfWidth }          // 좌상단
        ];
        
        // 회전된 좌표 계산
        const rotatedCorners = corners.map(corner => ({
            x: centerX + (corner.x * cos - corner.y * sin),
            y: centerY + (corner.x * sin + corner.y * cos)
        }));
        
        // 직사각형 그리기
        thrustGraphics.beginPath();
        thrustGraphics.moveTo(rotatedCorners[0].x, rotatedCorners[0].y);
        for (let i = 1; i < rotatedCorners.length; i++) {
            thrustGraphics.lineTo(rotatedCorners[i].x, rotatedCorners[i].y);
        }
        thrustGraphics.closePath();
        thrustGraphics.fillPath();
        thrustGraphics.strokePath();
        
        // EffectManager를 사용한 공격 효과 메시지
        const attackText = this.effectManager.showSkillMessage(
            this.player.x, 
            this.player.y, 
            '찌르기!'
        );
        
        // 절대 시간 기준으로 정확한 타이머 구현
        const targetEndTime = endTime;
        const checkCleanup = () => {
            const now = Date.now();
            if (now >= targetEndTime) {
                // 정확한 시간에 도달 - 정리 실행
                if (thrustGraphics.active) {
                    thrustGraphics.destroy();
                }
                if (attackText.active) {
                    attackText.destroy();
                }
                
                if (this.thrustGraphics) {
                    this.thrustGraphics.destroy();
                    this.thrustGraphics = null;
                }
                
                console.log('찌르기 데미지 이펙트 종료 [time: ' + Date.now() + '] [target: ' + targetEndTime + ']');
                return;
            }
            
            // 아직 시간이 안됨 - 다음 프레임에 다시 체크
            requestAnimationFrame(checkCleanup);
        };
        
        // 즉시 체크 시작
        const effectCleanupTimer = { remove: () => {} }; // 호환성을 위한 더미 객체
        requestAnimationFrame(checkCleanup);
        
        if (this.player.delayedSkillTimers) {
            this.player.delayedSkillTimers.add(effectCleanupTimer);
        }
    }

    createMeleeAttackEffect(centerX, centerY, startAngle, endAngle, radius) {
        // 부채꼴 근접 공격 이펙트 (빨간색 부채꼴)
        const graphics = this.player.scene.add.graphics();
        graphics.fillStyle(0xff0000, 0.8);
        graphics.lineStyle(3, 0xff0000, 1);
        
        // 부채꼴 그리기
        graphics.beginPath();
        graphics.moveTo(centerX, centerY);
        graphics.arc(centerX, centerY, radius, startAngle, endAngle);
        graphics.closePath();
        graphics.fill();
        graphics.stroke();
        
        // 이펙트 애니메이션
        this.player.scene.tweens.add({
            targets: graphics,
            alpha: 0,
            duration: 400,
            onComplete: () => {
                graphics.destroy();
            }
        });
    }

    isAngleInRange(angle, startAngle, endAngle) {
        // 각도를 0~2π 범위로 정규화
        angle = Phaser.Math.Angle.Normalize(angle);
        startAngle = Phaser.Math.Angle.Normalize(startAngle);
        endAngle = Phaser.Math.Angle.Normalize(endAngle);
        
        // 부채꼴이 0도를 걸치는 경우 처리
        if (startAngle > endAngle) {
            return angle >= startAngle || angle <= endAngle;
        } else {
            return angle >= startAngle && angle <= endAngle;
        }
    }

    clearSkillEffects() {
        super.clearSkillEffects();
        
        // 휩쓸기 그래픽 정리
        if (this.currentSweepGraphics && this.currentSweepGraphics.active) {
            this.currentSweepGraphics.destroy();
            this.currentSweepGraphics = null;
        }
        
        // 찌르기 그래픽 정리
        if (this.currentThrustGraphics && this.currentThrustGraphics.active) {
            this.currentThrustGraphics.destroy();
            this.currentThrustGraphics = null;
        }
        
        console.log('WarriorJob: 스킬 이펙트 정리 완료');
    }
} 