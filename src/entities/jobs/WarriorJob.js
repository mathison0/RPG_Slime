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
        
        // 쿨타임 설정
        this.setSkillCooldown(skillKey, skillInfo.cooldown);
        
        // 울부짖기 상태 활성화
        this.isRoaring = true;
        
        // 울부짖기 스프라이트로 변경
        this.player.setTexture('warrior_skill');
        
        // 1초 후 원래 스프라이트로 복원
        this.scene.time.delayedCall(1000, () => {
            this.endRoar();
        });
        
        // 울부짖기 효과 메시지
        const roarText = this.scene.add.text(
            this.player.x, 
            this.player.y - 80, 
            '울부짖기!', 
            {
                fontSize: '18px',
                fill: '#ff0000',
                fontStyle: 'bold'
            }
        ).setOrigin(0.5);
        
        this.scene.time.delayedCall(1000, () => {
            if (roarText.active) {
                roarText.destroy();
            }
        });

        // 네트워크 동기화
        if (this.player.networkManager && !this.player.isOtherPlayer) {
            this.player.networkManager.useSkill('roar', {
                x: this.player.x,
                y: this.player.y
            });
        }

        console.log('울부짖기 발동!');
    }

    /**
     * 울부짖기 종료
     */
    endRoar() {
        this.isRoaring = false;
        
        // 원래 스프라이트로 복원
        this.player.updateJobSprite();
        
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
        
        // 휩쓸기 시각적 효과
        this.player.setTint(0xff0000);
        
        // 부채꼴 모양의 휩쓸기 그래픽 생성
        this.sweepGraphics = this.scene.add.graphics();
        this.sweepGraphics.fillStyle(0xff0000, 0.3);
        this.sweepGraphics.lineStyle(2, 0xff0000, 1);
        
        // 플레이어 방향에 따른 부채꼴 그리기
        const centerX = this.player.x;
        const centerY = this.player.y;
        const radius = skillInfo.range;
        const angleOffset = Math.PI / 3; // 60도
        
        let startAngle, endAngle;
        switch (this.player.direction) {
            case 'front':
                startAngle = -angleOffset;
                endAngle = angleOffset;
                break;
            case 'back':
                startAngle = Math.PI - angleOffset;
                endAngle = Math.PI + angleOffset;
                break;
            case 'left':
                startAngle = Math.PI / 2 - angleOffset;
                endAngle = Math.PI / 2 + angleOffset;
                break;
            case 'right':
                startAngle = -Math.PI / 2 - angleOffset;
                endAngle = -Math.PI / 2 + angleOffset;
                break;
        }
        
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

        // 휩쓸기 데미지 적용
        this.applySweepDamage();

        // 네트워크 동기화
        if (this.player.networkManager && !this.player.isOtherPlayer) {
            this.player.networkManager.useSkill('sweep', {
                direction: this.player.direction,
                x: this.player.x,
                y: this.player.y
            });
        }

        console.log('휩쓸기 발동!');
    }

    /**
     * 휩쓸기 데미지 적용
     */
    applySweepDamage() {
        const skillInfo = this.jobInfo.skills[1];
        const damage = this.calculateDamage(skillInfo.damage);
        
        // 부채꼴 범위 내 적들과의 충돌 체크
        this.scene.enemies.getChildren().forEach(enemy => {
            if (!enemy.isDead) {
                const distance = Phaser.Math.Distance.Between(
                    this.player.x, this.player.y, 
                    enemy.x, enemy.y
                );
                
                // 휩쓸기 범위 내에 있으면 데미지 적용
                if (distance <= skillInfo.range) {
                    // 부채꼴 각도 체크
                    const angle = Phaser.Math.Angle.Between(
                        this.player.x, this.player.y, 
                        enemy.x, enemy.y
                    );
                    
                    let isInSweepAngle = false;
                    const angleOffset = Math.PI / 3; // 60도
                    
                    switch (this.player.direction) {
                        case 'front':
                            isInSweepAngle = angle >= -angleOffset && angle <= angleOffset;
                            break;
                        case 'back':
                            isInSweepAngle = angle >= Math.PI - angleOffset && angle <= Math.PI + angleOffset;
                            break;
                        case 'left':
                            isInSweepAngle = angle >= Math.PI / 2 - angleOffset && angle <= Math.PI / 2 + angleOffset;
                            break;
                        case 'right':
                            isInSweepAngle = angle >= -Math.PI / 2 - angleOffset && angle <= -Math.PI / 2 + angleOffset;
                            break;
                    }
                    
                    if (isInSweepAngle) {
                        enemy.takeDamage(damage);
                        console.log(`휩쓸기로 적에게 ${damage} 데미지!`);
                    }
                }
            }
        });
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
        
        // 찌르기 시각적 효과
        this.player.setTint(0xff0000);
        
        // 직사각형 모양의 찌르기 그래픽 생성
        this.thrustGraphics = this.scene.add.graphics();
        this.thrustGraphics.fillStyle(0xff0000, 0.3);
        this.thrustGraphics.lineStyle(2, 0xff0000, 1);
        
        // 플레이어 방향에 따른 직사각형 그리기
        const centerX = this.player.x;
        const centerY = this.player.y;
        const width = 40;
        const height = skillInfo.range;
        
        let rectX, rectY;
        switch (this.player.direction) {
            case 'front':
                rectX = centerX - width / 2;
                rectY = centerY;
                break;
            case 'back':
                rectX = centerX - width / 2;
                rectY = centerY - height;
                break;
            case 'left':
                rectX = centerX - height;
                rectY = centerY - width / 2;
                break;
            case 'right':
                rectX = centerX;
                rectY = centerY - width / 2;
                break;
        }
        
        if (this.player.direction === 'left' || this.player.direction === 'right') {
            this.thrustGraphics.fillRect(rectX, rectY, height, width);
            this.thrustGraphics.strokeRect(rectX, rectY, height, width);
        } else {
            this.thrustGraphics.fillRect(rectX, rectY, width, height);
            this.thrustGraphics.strokeRect(rectX, rectY, width, height);
        }
        
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

        // 찌르기 데미지 적용
        this.applyThrustDamage();

        // 네트워크 동기화
        if (this.player.networkManager && !this.player.isOtherPlayer) {
            this.player.networkManager.useSkill('thrust', {
                direction: this.player.direction,
                x: this.player.x,
                y: this.player.y
            });
        }

        console.log('찌르기 발동!');
    }

    /**
     * 찌르기 데미지 적용
     */
    applyThrustDamage() {
        const skillInfo = this.jobInfo.skills[2];
        const damage = this.calculateDamage(skillInfo.damage);
        
        // 직사각형 범위 내 적들과의 충돌 체크
        this.scene.enemies.getChildren().forEach(enemy => {
            if (!enemy.isDead) {
                const distance = Phaser.Math.Distance.Between(
                    this.player.x, this.player.y, 
                    enemy.x, enemy.y
                );
                
                // 찌르기 범위 내에 있으면 데미지 적용
                if (distance <= skillInfo.range) {
                    // 직사각형 각도 체크
                    const angle = Phaser.Math.Angle.Between(
                        this.player.x, this.player.y, 
                        enemy.x, enemy.y
                    );
                    
                    let isInThrustAngle = false;
                    const angleTolerance = Math.PI / 6; // 30도
                    
                    switch (this.player.direction) {
                        case 'front':
                            isInThrustAngle = Math.abs(angle) <= angleTolerance;
                            break;
                        case 'back':
                            isInThrustAngle = Math.abs(angle - Math.PI) <= angleTolerance;
                            break;
                        case 'left':
                            isInThrustAngle = Math.abs(angle - Math.PI / 2) <= angleTolerance;
                            break;
                        case 'right':
                            isInThrustAngle = Math.abs(angle + Math.PI / 2) <= angleTolerance;
                            break;
                    }
                    
                    if (isInThrustAngle) {
                        enemy.takeDamage(damage);
                        console.log(`찌르기로 적에게 ${damage} 데미지!`);
                    }
                }
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