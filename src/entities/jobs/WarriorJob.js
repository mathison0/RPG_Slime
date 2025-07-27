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
        
        // 시각적 효과는 NetworkEventManager에서 처리됨 (중복 방지)

        // 네트워크 동기화 (서버에서 데미지 계산)
        if (this.player.networkManager && !this.player.isOtherPlayer) {
            this.player.networkManager.useSkill('sweep', {
                targetX: this.scene.input.mousePointer.worldX,
                targetY: this.scene.input.mousePointer.worldY
            });
        }

        // 휩쓸기 상태 자동 해제 (500ms 후)
        this.player.scene.time.delayedCall(500, () => {
            if (this.isSweeping) {
                this.endSweep();
            }
        });

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
        // 시각적 효과는 NetworkEventManager에서 처리됨
        
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
            this.isSweeping = false;
        }
        if (this.isThrusting) {
            this.endThrust();
        }
    }

    // 기본 공격 (마우스 좌클릭) - 부채꼴 근접 공격
    useBasicAttack(targetX, targetY) {
        const currentTime = this.player.scene.time.now;
        if (currentTime - this.lastBasicAttackTime < this.basicAttackCooldown) {
            return false; // 쿨다운 중
        }

        // 스킬 사용 중에는 기본 공격 막기
        if (this.isSweeping || this.isThrusting || this.isRoaring) {
            return false;
        }

        this.lastBasicAttackTime = currentTime;
        
        // 부채꼴 공격 범위 설정
        const attackRange = 60;
        const angleOffset = Math.PI / 6; // 30도 (π/6)
        
        // 마우스 커서 위치 기준으로 부채꼴 공격
        const centerX = this.player.x;
        const centerY = this.player.y;
        
        // 플레이어에서 마우스 커서까지의 각도 계산
        const angleToMouse = Phaser.Math.Angle.Between(centerX, centerY, targetX, targetY);
        
        // 부채꼴의 시작과 끝 각도 계산
        const startAngle = angleToMouse - angleOffset;
        const endAngle = angleToMouse + angleOffset;
        
        this.createMeleeAttackEffect(centerX, centerY, startAngle, endAngle, attackRange);
        this.performMeleeAttack(centerX, centerY, startAngle, endAngle, attackRange);
        
        return true;
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

    performMeleeAttack(centerX, centerY, startAngle, endAngle, radius) {
        // 적과의 부채꼴 근접 공격
        if (this.player.scene.enemies) {
            this.player.scene.enemies.getChildren().forEach(enemy => {
                if (enemy && !enemy.isDead) {
                    const distance = Phaser.Math.Distance.Between(centerX, centerY, enemy.x, enemy.y);
                    if (distance <= radius) {
                        // 부채꼴 각도 내에 있는지 확인
                        const angleToEnemy = Phaser.Math.Angle.Between(centerX, centerY, enemy.x, enemy.y);
                        if (this.isAngleInRange(angleToEnemy, startAngle, endAngle)) {
                            // 데미지 계산
                            const damage = this.player.getAttackDamage();
                            enemy.takeDamage(damage);
                            
                            console.log(`전사 부채꼴 근접 공격으로 ${damage} 데미지`);
                        }
                    }
                }
            });
        }

        // 다른 플레이어와의 부채꼴 근접 공격 (적팀인 경우)
        if (this.player.scene.otherPlayers && Array.isArray(this.player.scene.otherPlayers)) {
            this.player.scene.otherPlayers.forEach(otherPlayer => {
                if (otherPlayer && otherPlayer.team !== this.player.team) {
                    const distance = Phaser.Math.Distance.Between(centerX, centerY, otherPlayer.x, otherPlayer.y);
                    if (distance <= radius) {
                        // 부채꼴 각도 내에 있는지 확인
                        const angleToPlayer = Phaser.Math.Angle.Between(centerX, centerY, otherPlayer.x, otherPlayer.y);
                        if (this.isAngleInRange(angleToPlayer, startAngle, endAngle)) {
                            // 데미지 계산
                            const damage = this.player.getAttackDamage();
                            otherPlayer.takeDamage(damage);
                            
                            console.log(`전사 부채꼴 근접 공격으로 ${otherPlayer.nameText?.text || '적'}에게 ${damage} 데미지`);
                        }
                    }
                }
            });
        }
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
} 