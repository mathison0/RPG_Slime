import BaseJob from './BaseJob.js';

export default class ArcherJob extends BaseJob {
    constructor(player) {
        super(player);
        this.jobClass = 'archer';
        this.lastBasicAttackTime = 0;
        this.basicAttackCooldown = 500; // 기본 공격 쿨다운 (밀리초)
    }

    update(delta) {
        super.update(delta);
    }

    useJump() {
        // 궁수는 기본 점프 사용
        super.useJump();
    }

    useSkill(skillType) {
        switch (skillType) {
            case 1:
                this.useRoll();
                break;
            case 2:
                this.useFocus();
                break;
            default:
                console.warn('알 수 없는 스킬 타입:', skillType);
        }
    }

    useRoll() {
        if (this.isSkillOnCooldown('roll')) {
            this.showCooldownMessage('구르기');
            return;
        }

        console.log('궁수 구르기 사용');
        
        // 구르기 방향 계산 (현재 이동 방향)
        const direction = this.player.direction;
        let rollDistance = 100;
        
        let targetX = this.player.x;
        let targetY = this.player.y;
        
        switch (direction) {
            case 'front':
                targetY += rollDistance;
                break;
            case 'back':
                targetY -= rollDistance;
                break;
            case 'left':
                targetX -= rollDistance;
                break;
            case 'right':
                targetX += rollDistance;
                break;
        }

        // 구르기 애니메이션
        this.player.scene.tweens.add({
            targets: this.player,
            x: targetX,
            y: targetY,
            duration: 300,
            ease: 'Power2.easeOut',
            onComplete: () => {
                console.log('구르기 완료');
            }
        });

        // 스킬 쿨다운 시작
        this.startSkillCooldown('roll', 2000);
        
        // 네트워크 동기화
        if (this.player.networkManager && !this.player.isOtherPlayer) {
            this.player.networkManager.useSkill(1, this.player.x, this.player.y, targetX, targetY);
        }
    }

    useFocus() {
        if (this.isSkillOnCooldown('focus')) {
            this.showCooldownMessage('궁사의 집중');
            return;
        }

        console.log('궁사의 집중 사용');
        
        // 공격 속도 증가 효과
        this.player.activateSpeedBoost(1.5); // 1.5배 속도 증가
        
        // 5초 후 효과 해제
        this.player.scene.time.delayedCall(5000, () => {
            this.player.deactivateSpeedBoost();
            console.log('궁사의 집중 효과 종료');
        });

        // 스킬 쿨다운 시작
        this.startSkillCooldown('focus', 8000);
        
        // 네트워크 동기화
        if (this.player.networkManager && !this.player.isOtherPlayer) {
            this.player.networkManager.useSkill(2, this.player.x, this.player.y);
        }
    }

    // 기본 공격 (마우스 좌클릭)
    useBasicAttack(targetX, targetY) {
        const currentTime = this.player.scene.time.now;
        if (currentTime - this.lastBasicAttackTime < this.basicAttackCooldown) {
            return false; // 쿨다운 중
        }

        this.lastBasicAttackTime = currentTime;
        
        // 투사체 생성
        this.createProjectile(targetX, targetY);
        
        return true;
    }

    createProjectile(targetX, targetY) {
        // 투사체 생성 (빛나는 점)
        const projectile = this.player.scene.add.circle(this.player.x, this.player.y, 4, 0xFF8C00, 1);
        this.player.scene.physics.add.existing(projectile);
        
        // 방향 계산
        const angle = Phaser.Math.Angle.Between(this.player.x, this.player.y, targetX, targetY);
        const speed = 300;
        const velocityX = Math.cos(angle) * speed;
        const velocityY = Math.sin(angle) * speed;
        
        // 속도 설정
        projectile.body.setVelocity(velocityX, velocityY);
        
        // 투사체 이펙트 (빛나는 효과)
        this.player.scene.tweens.add({
            targets: projectile,
            scaleX: 1.5,
            scaleY: 1.5,
            alpha: 0.5,
            duration: 200,
            yoyo: true,
            repeat: -1
        });
        
        // 투사체 충돌 처리
        this.setupProjectileCollisions(projectile);
        
        // 3초 후 투사체 제거
        this.player.scene.time.delayedCall(3000, () => {
            if (projectile && projectile.active) {
                projectile.destroy();
            }
        });
    }

    setupProjectileCollisions(projectile) {
        // 벽과의 충돌
        if (this.player.scene.walls) {
            this.player.scene.physics.add.collider(projectile, this.player.scene.walls, () => {
                projectile.destroy();
            });
        }

        // 적과의 충돌
        if (this.player.scene.enemies) {
            this.player.scene.physics.add.overlap(projectile, this.player.scene.enemies, (projectile, enemy) => {
                // 데미지 계산
                const damage = this.player.getAttackDamage();
                enemy.takeDamage(damage);
                
                // 투사체 제거
                projectile.destroy();
                
                console.log(`궁수 기본 공격으로 ${damage} 데미지`);
            });
        }

        // 다른 플레이어와의 충돌 (적팀인 경우)
        if (this.player.scene.otherPlayers && Array.isArray(this.player.scene.otherPlayers)) {
            this.player.scene.otherPlayers.forEach(otherPlayer => {
                if (otherPlayer && otherPlayer.team !== this.player.team) {
                    this.player.scene.physics.add.overlap(projectile, otherPlayer, (projectile, targetPlayer) => {
                        // 데미지 계산
                        const damage = this.player.getAttackDamage();
                        targetPlayer.takeDamage(damage);
                        
                        // 투사체 제거
                        projectile.destroy();
                        
                        console.log(`궁수 기본 공격으로 ${targetPlayer.nameText?.text || '적'}에게 ${damage} 데미지`);
                    });
                }
            });
        }
    }

    /**
     * 쿨타임 정보 반환
     */
    getSkillCooldowns() {
        return {
            1: {
                remaining: this.getRemainingCooldown('roll'),
                max: 2000
            },
            2: {
                remaining: this.getRemainingCooldown('focus'),
                max: 8000
            }
        };
    }
} 