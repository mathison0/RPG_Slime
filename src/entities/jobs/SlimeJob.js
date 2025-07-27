import BaseJob from './BaseJob.js';
import { getJobInfo } from '../../../shared/JobClasses.js';

/**
 * 슬라임 직업 클래스
 */
export default class SlimeJob extends BaseJob {
    constructor(player) {
        super(player);
        this.jobInfo = getJobInfo('slime');
        this.lastBasicAttackTime = 0;
        this.basicAttackCooldown = 600; // 기본 공격 쿨다운 (밀리초)
    }

    useSkill(skillNumber, options = {}) {
        switch (skillNumber) {
            case 1:
                this.useSpreadSkill();
                break;
            default:
                console.log('SlimeJob: 알 수 없는 스킬 번호:', skillNumber);
        }
    }

    /**
     * 슬라임 퍼지기 스킬
     */
    useSpreadSkill() {
        const skillKey = 'spread';
        
        // 다른 플레이어면 실행하지 않음
        if (this.player.isOtherPlayer) {
            return;
        }

        // 점프 중이면 실행하지 않음
        if (this.player.isJumping) {
            return;
        }

        // 네트워크 매니저가 없으면 실행하지 않음
        if (!this.player.networkManager) {
            console.log('NetworkManager가 없어서 스킬을 사용할 수 없습니다.');
            return;
        }

        // 서버에 스킬 사용 요청
        this.player.networkManager.useSkill('spread');
        
        console.log('슬라임 퍼지기 서버 요청 전송');
    }

    /**
     * 쿨타임 정보 반환
     */
    getSkillCooldowns() {
        return {
            1: {
                remaining: this.getRemainingCooldown('spread'),
                max: this.jobInfo.skills[0].cooldown
            }
        };
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
        const projectile = this.player.scene.add.circle(this.player.x, this.player.y, 4, 0x00ff00, 1);
        this.player.scene.physics.add.existing(projectile);
        
        // 방향 계산
        const angle = Phaser.Math.Angle.Between(this.player.x, this.player.y, targetX, targetY);
        const speed = 250;
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
                
                console.log(`슬라임 기본 공격으로 ${damage} 데미지`);
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
                        
                        console.log(`슬라임 기본 공격으로 ${targetPlayer.nameText?.text || '적'}에게 ${damage} 데미지`);
                    });
                }
            });
        }
    }
} 