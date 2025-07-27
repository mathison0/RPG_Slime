import BaseJob from './BaseJob.js';
import { getJobInfo } from '../../../shared/JobClasses.js';

/**
 * 전사 직업 클래스
 */
export default class WarriorJob extends BaseJob {
    constructor(player) {
        super(player);
        this.jobInfo = getJobInfo('warrior');
        
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
        const skillKey = 'roar';
        
        // 쿨타임 체크
        if (!this.isSkillAvailable(skillKey)) {
            this.showCooldownMessage();
            return;
        }
        
        // 이미 울부짖기 중이거나 다른 플레이어면 실행하지 않음
        if (this.isRoaring || this.player.isOtherPlayer) {
            return;
        }
        
        const skillInfo = this.jobInfo.skills[0]; // 울부짖기 스킬
        
        // 쿨타임 설정 (즉시 설정)
        this.setSkillCooldown(skillKey, skillInfo.cooldown);
        
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
        const skillKey = 'sweep';
        
        // 쿨타임 체크
        if (!this.isSkillAvailable(skillKey)) {
            this.showCooldownMessage();
            return;
        }
        
        // 이미 휩쓸기 중이거나 다른 플레이어면 실행하지 않음
        if (this.isSweeping || this.player.isOtherPlayer) {
            return;
        }
        
        const skillInfo = this.jobInfo.skills[1]; // 휩쓸기 스킬
        
        // 쿨타임 설정
        this.setSkillCooldown(skillKey, skillInfo.cooldown);
        
        // 휩쓸기 상태 활성화
        this.isSweeping = true;
        
        // 스프라이트 변경은 서버에서 처리됨
        
        // 휩쓸기 시각적 효과
        this.player.setTint(0xff0000);
        
        // 부채꼴 모양의 휩쓸기 그래픽 생성
        this.sweepGraphics = this.scene.add.graphics();
        this.sweepGraphics.fillStyle(0xff0000, 0.3);
        this.sweepGraphics.lineStyle(2, 0xff0000, 1);
        
        // 마우스 커서 위치 기준으로 부채꼴 그리기
        const centerX = this.player.x;
        const centerY = this.player.y;
        const radius = skillInfo.range;
        const angleOffset = Math.PI / 3; // 60도
        
        // 마우스 커서 위치 가져오기
        const mouseX = this.scene.input.mousePointer.worldX;
        const mouseY = this.scene.input.mousePointer.worldY;
        
        // 플레이어에서 마우스 커서까지의 각도 계산
        const angleToMouse = Phaser.Math.Angle.Between(centerX, centerY, mouseX, mouseY);
        
        // 부채꼴의 시작과 끝 각도 계산
        const startAngle = angleToMouse - angleOffset;
        const endAngle = angleToMouse + angleOffset;
        
        this.sweepGraphics.beginPath();
        this.sweepGraphics.moveTo(centerX, centerY);
        this.sweepGraphics.arc(centerX, centerY, radius, startAngle, endAngle);
        this.sweepGraphics.closePath();
        this.sweepGraphics.fill();
        this.sweepGraphics.stroke();
        
        // 휩쓸기 애니메이션
        this.scene.tweens.add({
            targets: this.sweepGraphics,
            alpha: 0,
            duration: 500,
            onComplete: () => {
                this.endSweep();
            }
        });
        
        // 휩쓸기 효과 메시지
        const sweepText = this.scene.add.text(
            this.player.x, 
            this.player.y - 60, 
            '휩쓸기!', 
            {
                fontSize: '16px',
                fill: '#ff0000'
            }
        ).setOrigin(0.5);
        
        this.scene.time.delayedCall(1000, () => {
            if (sweepText.active) {
                sweepText.destroy();
            }
        });

        // 네트워크 동기화 (서버에서 데미지 계산)
        if (this.player.networkManager && !this.player.isOtherPlayer) {
            this.player.networkManager.useSkill('sweep', {
                targetX: this.scene.input.mousePointer.worldX,
                targetY: this.scene.input.mousePointer.worldY
            });
        }

        console.log('휩쓸기 발동!');
    }

    /**
     * 휩쓸기 데미지 적용 (서버에서 처리됨)
     * 클라이언트에서는 시각적 효과만 처리
     */
    applySweepDamage() {
        // 서버에서 데미지 계산을 처리하므로 클라이언트에서는 시각적 효과만
        console.log('휩쓸기 시각적 효과 처리');
    }

    /**
     * 휩쓸기 종료
     */
    endSweep() {
        this.isSweeping = false;
        this.player.clearTint();
        
        // 휩쓸기 그래픽 제거
        if (this.sweepGraphics) {
            this.sweepGraphics.destroy();
            this.sweepGraphics = null;
        }
        
        console.log('휩쓸기 종료');
    }

    /**
     * 찌르기 스킬 (R키)
     */
    useThrust() {
        const skillKey = 'thrust';
        
        // 쿨타임 체크
        if (!this.isSkillAvailable(skillKey)) {
            this.showCooldownMessage();
            return;
        }
        
        // 이미 찌르기 중이거나 다른 플레이어면 실행하지 않음
        if (this.isThrusting || this.player.isOtherPlayer) {
            return;
        }
        
        const skillInfo = this.jobInfo.skills[2]; // 찌르기 스킬
        
        // 쿨타임 설정
        this.setSkillCooldown(skillKey, skillInfo.cooldown);
        
        // 찌르기 상태 활성화
        this.isThrusting = true;
        
        // 스프라이트 변경은 서버에서 처리됨
        
        // 찌르기 시각적 효과
        this.player.setTint(0xff0000);
        
        // 직사각형 모양의 찌르기 그래픽 생성
        this.thrustGraphics = this.scene.add.graphics();
        this.thrustGraphics.fillStyle(0xff0000, 0.3);
        this.thrustGraphics.lineStyle(2, 0xff0000, 1);
        
        // 플레이어 몸에서 마우스 커서 방향으로 직사각형 그리기
        const centerX = this.player.x;
        const centerY = this.player.y;
        const width = 40;
        const height = skillInfo.range;
        
        // 마우스 커서 위치 가져오기
        const mouseX = this.scene.input.mousePointer.worldX;
        const mouseY = this.scene.input.mousePointer.worldY;
        
        // 플레이어에서 마우스 커서까지의 각도 계산
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
        this.thrustGraphics.beginPath();
        this.thrustGraphics.moveTo(bottomLeftX, bottomLeftY);
        this.thrustGraphics.lineTo(topLeftX, topLeftY);
        this.thrustGraphics.lineTo(topRightX, topRightY);
        this.thrustGraphics.lineTo(bottomRightX, bottomRightY);
        this.thrustGraphics.closePath();
        this.thrustGraphics.fill();
        this.thrustGraphics.stroke();
        
        // 찌르기 애니메이션
        this.scene.tweens.add({
            targets: this.thrustGraphics,
            alpha: 0,
            duration: 800,
            onComplete: () => {
                this.endThrust();
            }
        });
        
        // 찌르기 효과 메시지
        const thrustText = this.scene.add.text(
            this.player.x, 
            this.player.y - 60, 
            '찌르기!', 
            {
                fontSize: '16px',
                fill: '#ff0000'
            }
        ).setOrigin(0.5);
        
        this.scene.time.delayedCall(1000, () => {
            if (thrustText.active) {
                thrustText.destroy();
            }
        });

        // 네트워크 동기화 (서버에서 데미지 계산)
        if (this.player.networkManager && !this.player.isOtherPlayer) {
            this.player.networkManager.useSkill('thrust', {
                targetX: this.scene.input.mousePointer.worldX,
                targetY: this.scene.input.mousePointer.worldY
            });
        }

        console.log('찌르기 발동!');
    }

    /**
     * 찌르기 데미지 적용 (서버에서 처리됨)
     * 클라이언트에서는 시각적 효과만 처리
     */
    applyThrustDamage() {
        // 서버에서 데미지 계산을 처리하므로 클라이언트에서는 시각적 효과만
        console.log('찌르기 시각적 효과 처리');
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
        const roarSkill = this.jobInfo.skills[0];
        const sweepSkill = this.jobInfo.skills[1];
        const thrustSkill = this.jobInfo.skills[2];
        
        return {
            Q: {
                remaining: this.getRemainingCooldown('roar'),
                max: roarSkill ? roarSkill.cooldown : 1000
            },
            E: {
                remaining: this.getRemainingCooldown('sweep'),
                max: sweepSkill ? sweepSkill.cooldown : 3000
            },
            R: {
                remaining: this.getRemainingCooldown('thrust'),
                max: thrustSkill ? thrustSkill.cooldown : 6000
            }
        };
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
            this.endSweep();
        }
        if (this.isThrusting) {
            this.endThrust();
        }
    }
} 