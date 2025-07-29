import BaseJob from './BaseJob.js';
// JobClasses는 서버에서 관리하므로 import 제거

/**
 * 전사 직업 클래스
 */
export default class WarriorJob extends BaseJob {
    constructor(player) {
        super(player);
        // 직업 정보는 서버에서 받아옴
        
        // 울부짖기 관련 상태
        this.isRoaring = false;
        
        // 휩쓸기 관련 상태
        this.isSweeping = false;
        this.sweepSprite = null;
        this.sweepGraphics = null;
        
        // 찌르기 관련 상태
        this.isThrusting = false;
        this.thrustSprite = null;
        this.thrustGraphics = null;
        
        // 기본 공격 관련
        this.lastBasicAttackTime = 0;
        this.basicAttackCooldown = 800; // 기본 공격 쿨다운 (밀리초)
    }

    useSkill(skillNumber, options = {}) {
        switch (skillNumber) {
            case 1: // Q키
                this.useRoar();
                break;
            case 2: // E키
                this.useSweep();
                break;
            case 3: // R키
                this.useThrust();
                break;
            default:
                console.log('WarriorJob: 알 수 없는 스킬 번호:', skillNumber);
        }
    }

    /**
     * 울부짖기 스킬 (Q키)
     */
    useRoar() {
        const skillKey = 'skill1'; // 통일된 스킬 키 사용
        
        // 쿨타임 체크
        if (!this.isSkillAvailable(skillKey)) {
            this.showCooldownMessage();
            return;
        }
        
        // 이미 울부짖기 중이거나 다른 플레이어면 실행하지 않음
        if (this.isRoaring || this.player.isOtherPlayer) {
            return;
        }
        
        // 스킬 정보는 서버에서 처리됨
        
        // 쿨타임은 서버에서 관리됨
        
        // 울부짖기 상태 활성화
        this.isRoaring = true;
        
        // 스프라이트 변경은 서버 응답 후 동기화됨 (즉시 변경하지 않음)
        
        // 네트워크 동기화
        if (this.player.networkManager && !this.player.isOtherPlayer) {
            this.player.networkManager.useSkill('roar', {
                x: this.player.x,
                y: this.player.y,
                timestamp: Date.now() // 클라이언트 스킬 사용 타임스탬프 전송
            });
        }

        console.log('울부짖기 발동!');
    }

    /**
     * 울부짖기 종료
     */
    endRoar() {
        this.isRoaring = false;
        
        // 스프라이트 복원은 서버에서 처리됨
        
        console.log('울부짖기 종료');
    }

    /**
     * 휩쓸기 스킬 (E키)
     */
    useSweep() {
        const skillKey = 'skill2';
        
        console.log('휩쓸기 시도 - isSweeping:', this.isSweeping, 'isOtherPlayer:', this.player.isOtherPlayer);
        
        // 쿨타임 체크
        if (!this.isSkillAvailable(skillKey)) {
            this.showCooldownMessage();
            return;
        }
        
        // 이미 휩쓸기 중이거나 다른 플레이어면 실행하지 않음
        if (this.isSweeping || this.player.isOtherPlayer) {
            console.log('휩쓸기 차단 - isSweeping:', this.isSweeping, 'isOtherPlayer:', this.player.isOtherPlayer);
            return;
        }
        
        // 네트워크 동기화 (서버에 스킬 사용 요청만 전송)
        if (this.player.networkManager && !this.player.isOtherPlayer) {
            this.player.networkManager.useSkill('sweep', {
                targetX: this.scene.input.mousePointer.worldX,
                targetY: this.scene.input.mousePointer.worldY
            });
        }

        console.log('휩쓸기 사용 요청 전송!');
    }

    /**
     * 휩쓸기 종료
     */
    endSweep() {
        this.isSweeping = false;
    }

    /**
     * 찌르기 스킬 (R키)
     */
    useThrust() {
        const skillKey = 'skill3';
        
        // 쿨타임 체크
        if (!this.isSkillAvailable(skillKey)) {
            this.showCooldownMessage();
            return;
        }
        
        // 이미 찌르기 중이거나 다른 플레이어면 실행하지 않음
        if (this.isThrusting || this.player.isOtherPlayer) {
            return;
        }
        
        // 마우스 커서 위치 가져오기
        const mouseX = this.scene.input.mousePointer.worldX;
        const mouseY = this.scene.input.mousePointer.worldY;

        // 네트워크 동기화 (서버에 스킬 사용 요청만 전송)
        if (this.player.networkManager && !this.player.isOtherPlayer) {
            this.player.networkManager.useSkill('thrust', {
                targetX: mouseX,
                targetY: mouseY
            });
        }

        console.log('찌르기 사용 요청 전송!');
    }

    /**
     * 전사 기본 공격 이펙트 (근접 부채꼴)
     */
    showBasicAttackEffect(targetX, targetY) {
        // 부채꼴 공격 범위 설정
        const attackRange = 60;
        const angleOffset = Math.PI / 6; // 30도 (π/6)
        
        // 플레이어에서 마우스 커서까지의 각도 계산
        const centerX = this.player.x;
        const centerY = this.player.y;
        const angleToMouse = Phaser.Math.Angle.Between(centerX, centerY, targetX, targetY);
        
        // 부채꼴의 시작과 끝 각도 계산
        const startAngle = angleToMouse - angleOffset;
        const endAngle = angleToMouse + angleOffset;
        
        // 부채꼴 근접 공격 이펙트 (빨간색 부채꼴)
        const graphics = this.player.scene.add.graphics();
        graphics.fillStyle(0xff0000, 0.8);
        graphics.lineStyle(3, 0xff0000, 1);
        
        // 부채꼴 그리기
        graphics.beginPath();
        graphics.moveTo(centerX, centerY);
        graphics.arc(centerX, centerY, attackRange, startAngle, endAngle);
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
        // 기존 울부짖기 이펙트가 있다면 제거
        if (this.player.roarEffectTimer) {
            this.player.scene.time.removeEvent(this.player.roarEffectTimer);
            this.player.roarEffectTimer = null;
        }
        
        // 울부짖기 스킬 상태 설정
        this.player.isUsingRoarSkill = true;
        this.player.isUsingWarriorSkill = true;
        
        // 울부짖기 스프라이트로 변경
        this.player.setTexture('warrior_skill');
        
        // 서버에서 받은 지속시간 사용 (기본값 1000ms)
        const skillInfo = data?.skillInfo || {};
        const effectDuration = skillInfo.duration || 1000;
        
        console.log(`울부짖기 스킬 정보 (서버에서 받음): duration=${effectDuration}ms`);
        
        // 울부짖기 효과 메시지 (1초 후 제거)
        const roarText = this.player.scene.add.text(
            this.player.x, 
            this.player.y - 80, 
            '크아앙!', 
            {
                fontSize: '18px',
                fill: '#ff0000',
                fontStyle: 'bold'
            }
        ).setOrigin(0.5);
        
        // 텍스트는 1초 후 제거
        this.player.scene.time.delayedCall(1000, () => {
            if (roarText.active) {
                roarText.destroy();
            }
        });
        
        // 스프라이트는 지속시간 후 복원 (정확한 타이밍)
        this.player.roarEffectTimer = this.player.scene.time.delayedCall(effectDuration, () => {
            // 울부짖기 스킬 상태 해제
            this.player.isUsingRoarSkill = false;
            this.player.isUsingWarriorSkill = false;
            
            // WarriorJob의 isRoaring 상태도 해제
            if (this.player.job && this.player.job.isRoaring) {
                this.player.job.isRoaring = false;
                console.log('울부짖기 상태 해제 완료');
            }
            
            if (this.player.active) {
                // 원래 직업 스프라이트로 복원
                this.player.updateJobSprite();
                console.log(`울부짖기 스프라이트 복원 완료 (지속시간: ${effectDuration}ms)`);
            }
            this.player.roarEffectTimer = null;
        });
        
        console.log('울부짖기 스프라이트 변경 완료');
    }

    /**
     * 휩쓸기 이펙트 (서버에서 스킬 승인 시 호출)
     */
    showSweepEffect(data = null) {
        // 휩쓸기 상태 활성화 (서버 승인 시)
        this.isSweeping = true;
        
        // 휩쓸기 스킬 상태 설정
        this.player.isUsingWarriorSkill = true;
        
        // 휩쓸기 시각적 효과
        this.player.setTint(0xff0000);
        
        // 마우스 커서 위치 가져오기 (서버 데이터에서)
        const mouseX = data?.targetX || this.player.x;
        const mouseY = data?.targetY || this.player.y;
        
        // 서버에서 받은 스킬 정보 사용 (하드코딩 제거)
        const skillInfo = data?.skillInfo || {};
        const delay = skillInfo.delay || 1000; // 서버에서 받은 지연시간
        const angleOffset = skillInfo.angleOffset || (Math.PI / 3); // 서버에서 받은 각도 오프셋
        const range = skillInfo.range || 80; // 서버에서 받은 범위
        
        console.log(`휩쓸기 스킬 정보 (서버에서 받음): delay=${delay}ms, angleOffset=${angleOffset}, range=${range}`);
        
        // 부채꼴 모양의 휩쓸기 그래픽 생성 (처음에는 덜 진한 색상)
        const sweepGraphics = this.player.scene.add.graphics();
        sweepGraphics.fillStyle(0xff0000, 0.1); // 덜 진한 색상
        sweepGraphics.lineStyle(2, 0xff0000, 0.3); // 덜 진한 테두리
        
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
        sweepGraphics.fill();
        sweepGraphics.stroke();
        
        // 지연 시간 동안 이펙트 유지 후 색상 변경 및 페이드 아웃
        const delayedTimer = this.player.scene.time.delayedCall(delay, () => {
            // 플레이어가 죽었는지 확인
            if (this.player.isDead) {
                console.log('휩쓸기 이펙트 취소: 플레이어가 사망함');
                if (sweepGraphics && sweepGraphics.active) {
                    sweepGraphics.destroy();
                }
                this.player.delayedSkillTimers.delete(delayedTimer);
                return;
            }
            
            // 지연 시간 후 색상을 진하게 변경 (데미지 적용 시점)
            sweepGraphics.clear();
            sweepGraphics.fillStyle(0xff0000, 0.8); // 진한 색상으로 변경
            sweepGraphics.lineStyle(3, 0xff0000, 1); // 진한 테두리로 변경
            
            // 부채꼴 다시 그리기
            sweepGraphics.beginPath();
            sweepGraphics.moveTo(centerX, centerY);
            sweepGraphics.arc(centerX, centerY, range, startAngle, endAngle);
            sweepGraphics.closePath();
            sweepGraphics.fill();
            sweepGraphics.stroke();
            
            // 지연 시간 후 이펙트 페이드 아웃
            this.player.scene.tweens.add({
                targets: sweepGraphics,
                alpha: 0,
                duration: 300,
                onComplete: () => {
                    sweepGraphics.destroy();
                    if (this.player.active) {
                        this.player.clearTint();
                        // 휩쓸기 상태 해제 (서버 타이밍에 맞춤)
                        this.endSweep();
                        // 휩쓸기 스킬 상태 해제
                        this.player.isUsingWarriorSkill = false;
                    }
                }
            });
            
            this.player.delayedSkillTimers.delete(delayedTimer);
        });
        
        // 타이머 추적
        if (this.player.delayedSkillTimers) {
            this.player.delayedSkillTimers.add(delayedTimer);
        }
        
        // 현재 휩쓸기 그래픽 저장 (정리용)
        this.currentSweepGraphics = sweepGraphics;
        
        // 휩쓸기 효과 메시지
        const sweepText = this.player.scene.add.text(
            this.player.x, 
            this.player.y - 60, 
            '휩쓸기!', 
            {
                fontSize: '16px',
                fill: '#ff0000'
            }
        ).setOrigin(0.5);
        
        this.player.scene.time.delayedCall(1000, () => {
            if (sweepText.active) {
                sweepText.destroy();
            }
        });
    }

    /**
     * 찌르기 이펙트 (서버에서 스킬 승인 시 호출)
     */
    showThrustEffect(data = null) {
        // 찌르기 상태 활성화 (서버 승인 시)
        this.isThrusting = true;
        
        // 찌르기 스킬 상태 설정
        this.player.isUsingWarriorSkill = true;
        
        // 찌르기 시각적 효과
        this.player.setTint(0xff0000);
        
        // 마우스 커서 위치 가져오기 (서버 데이터에서)
        const mouseX = data?.targetX || this.player.x;
        const mouseY = data?.targetY || this.player.y;
        
        // 서버에서 받은 스킬 정보 사용 (하드코딩 제거)
        const skillInfo = data?.skillInfo || {};
        const height = skillInfo.range || 100; // 서버에서 받은 사정거리 (직사각형 높이)
        const width = skillInfo.width || 80; // 서버에서 받은 가로 길이
        const delay = skillInfo.delay || 1500; // 서버에서 받은 지연시간
        
        console.log(`찌르기 스킬 정보 (서버에서 받음): height=${height}, width=${width}, delay=${delay}ms`);
        
        // 직사각형 모양의 찌르기 그래픽 생성 (처음에는 덜 진한 색상)
        const thrustGraphics = this.player.scene.add.graphics();
        thrustGraphics.fillStyle(0xff0000, 0.1); // 덜 진한 색상
        thrustGraphics.lineStyle(2, 0xff0000, 0.3); // 덜 진한 테두리
        
        // 플레이어에서 마우스 커서까지의 각도 계산
        const centerX = this.player.x;
        const centerY = this.player.y;
        
        const angleToMouse = Phaser.Math.Angle.Between(centerX, centerY, mouseX, mouseY);
        
        // 직사각형의 시작점 (플레이어 위치에서 아래변 중심)
        const startX = centerX;
        const startY = centerY;
        
        // 직사각형의 끝점 (마우스 방향으로 height만큼 이동한 윗변 중심)
        const endX = centerX + Math.cos(angleToMouse) * height;
        const endY = centerY + Math.sin(angleToMouse) * height;
        
        // 직사각형의 네 꼭지점 계산
        const halfWidth = width / 2;
        
        // width 방향의 수직 벡터 계산 (마우스 방향에 수직)
        const perpendicularAngle = angleToMouse + Math.PI / 2;
        const widthVectorX = Math.cos(perpendicularAngle) * halfWidth;
        const widthVectorY = Math.sin(perpendicularAngle) * halfWidth;
        
        // 아래변의 두 꼭지점 (플레이어 위치에서)
        const bottomLeftX = startX - widthVectorX;
        const bottomLeftY = startY - widthVectorY;
        const bottomRightX = startX + widthVectorX;
        const bottomRightY = startY + widthVectorY;
        
        // 윗변의 두 꼭지점 (마우스 방향으로)
        const topLeftX = endX - widthVectorX;
        const topLeftY = endY - widthVectorY;
        const topRightX = endX + widthVectorX;
        const topRightY = endY + widthVectorY;
        
        // 직사각형 그리기 (플레이어에서 마우스 방향으로)
        thrustGraphics.beginPath();
        thrustGraphics.moveTo(bottomLeftX, bottomLeftY);
        thrustGraphics.lineTo(topLeftX, topLeftY);
        thrustGraphics.lineTo(topRightX, topRightY);
        thrustGraphics.lineTo(bottomRightX, bottomRightY);
        thrustGraphics.closePath();
        thrustGraphics.fill();
        thrustGraphics.stroke();
        
        // 지연 시간 동안 이펙트 유지 후 색상 변경 및 페이드 아웃
        const thrustDelayedTimer = this.player.scene.time.delayedCall(delay, () => {
            // 플레이어가 죽었는지 확인
            if (this.player.isDead) {
                console.log('찔러기 이펙트 취소: 플레이어가 사망함');
                if (thrustGraphics && thrustGraphics.active) {
                    thrustGraphics.destroy();
                }
                this.player.delayedSkillTimers.delete(thrustDelayedTimer);
                return;
            }
            
            // 지연 시간 후 색상을 진하게 변경 (데미지 적용 시점)
            thrustGraphics.clear();
            thrustGraphics.fillStyle(0xff0000, 0.8); // 진한 색상으로 변경
            thrustGraphics.lineStyle(3, 0xff0000, 1); // 진한 테두리로 변경
            
            // 직사각형 다시 그리기
            thrustGraphics.beginPath();
            thrustGraphics.moveTo(bottomLeftX, bottomLeftY);
            thrustGraphics.lineTo(topLeftX, topLeftY);
            thrustGraphics.lineTo(topRightX, topRightY);
            thrustGraphics.lineTo(bottomRightX, bottomRightY);
            thrustGraphics.closePath();
            thrustGraphics.fill();
            thrustGraphics.stroke();
            
            // 지연 시간 후 이펙트 페이드 아웃
            this.player.scene.tweens.add({
                targets: thrustGraphics,
                alpha: 0,
                duration: 300,
                onComplete: () => {
                    thrustGraphics.destroy();
                    if (this.player.active) {
                        this.player.clearTint();
                        // 찌르기 상태 해제 (서버 타이밍에 맞춤)
                        this.endThrust();
                        // 찌르기 스킬 상태 해제
                        this.player.isUsingWarriorSkill = false;
                    }
                }
            });
            
            this.player.delayedSkillTimers.delete(thrustDelayedTimer);
        });
        
        // 타이머 추적
        if (this.player.delayedSkillTimers) {
            this.player.delayedSkillTimers.add(thrustDelayedTimer);
        }
        
        // 현재 찔러기 그래픽 저장 (정리용)
        this.currentThrustGraphics = thrustGraphics;
        
        // 찌르기 효과 메시지
        const thrustText = this.player.scene.add.text(
            this.player.x, 
            this.player.y - 60, 
            '찌르기!', 
            {
                fontSize: '16px',
                fill: '#ff0000'
            }
        ).setOrigin(0.5);
        
        this.player.scene.time.delayedCall(1000, () => {
            if (thrustText.active) {
                thrustText.destroy();
            }
        });
    }

    /**
     * 찌르기 종료
     */
    endThrust() {
        this.isThrusting = false;
        this.player.clearTint();
        
        // 찌르기 그래픽 제거
        if (this.thrustGraphics) {
            this.thrustGraphics.destroy();
            this.thrustGraphics = null;
        }
        
        console.log('찌르기 종료');
    }

    /**
     * 업데이트
     */
    update(delta) {
        super.update(delta);
    }

    /**
     * 스킬 상태 확인
     */
    isRoaringState() {
        return this.isRoaring;
    }

    isSweepingState() {
        return this.isSweeping;
    }

    isThrustingState() {
        return this.isThrusting;
    }

    /**
     * 쿨타임 정보 반환
     */
    getSkillCooldowns() {
        // 서버에서 받은 쿨타임 정보를 사용
        if (this.player.serverSkillCooldowns) {
            return this.player.serverSkillCooldowns;
        }
        return {};
    }

    /**
     * 정리 작업
     */
    destroy() {
        super.destroy();
        if (this.isRoaring) {
            this.endRoar();
        }
        if (this.isSweeping) {
            this.isSweeping = false;
        }
        if (this.isThrusting) {
            this.endThrust();
        }
    }

    // 기본 공격은 서버에서 처리됩니다. 클라이언트는 이벤트 응답으로만 애니메이션 실행

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

    performMeleeAttack(centerX, centerY, startAngle, endAngle, radius) {
        // 시각적 효과만 (데미지는 서버에서 처리)
        console.log('전사 부채꼴 근접 공격 이펙트 (데미지는 서버에서 처리)');
    }

    // 각도가 부채꼴 범위 내에 있는지 확인하는 헬퍼 메서드
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

    /**
     * 스킬 이펙트 정리 (사망 시 호출)
     */
    clearSkillEffects() {
        super.clearSkillEffects();
        
        // 휩쓸기 그래픽 정리
        if (this.currentSweepGraphics && this.currentSweepGraphics.active) {
            this.currentSweepGraphics.destroy();
            this.currentSweepGraphics = null;
        }
        
        // 찢기 그래픽 정리
        if (this.currentThrustGraphics && this.currentThrustGraphics.active) {
            this.currentThrustGraphics.destroy();
            this.currentThrustGraphics = null;
        }
        
        // 전사 스킬 상태 초기화
        this.isSweeping = false;
        this.isThrusting = false;
        
        console.log('WarriorJob: 스킬 이펙트 정리 완료');
    }
} 