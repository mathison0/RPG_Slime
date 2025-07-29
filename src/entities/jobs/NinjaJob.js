import BaseJob from './BaseJob.js';

/**
 * 닌자 직업 클래스
 */
export default class NinjaJob extends BaseJob {
    constructor(player) {
        super(player);
        this.lastBasicAttackTime = 0;
        this.basicAttackCooldown = 500; // 기본 공격 쿨다운 (밀리초)
    }

    useSkill(skillNumber, options = {}) {
        // 닌자의 스킬들을 여기에 추가
        console.log('NinjaJob: 스킬 사용 요청', skillNumber);
    }

    /**
     * 닌자 기본 공격 애니메이션 (원거리 투사체)
     */
    showBasicAttackEffect(targetX, targetY) {
        // 투사체 생성 (수리검 스프라이트 사용)
        const projectile = this.player.scene.add.sprite(this.player.x, this.player.y, 'ninja_basic_attack');
        this.player.scene.physics.add.existing(projectile);
        
        // 투사체 크기 설정
        projectile.setDisplaySize(18, 18);
        
        // 투사체 콜라이더 설정
        projectile.body.setCircle(20);
        projectile.body.setCollideWorldBounds(false);
        projectile.body.setBounce(0, 0);
        projectile.body.setDrag(0, 0);
        
        // 커서 방향으로 특정 거리까지 날아가도록 계산
        const angle = Phaser.Math.Angle.Between(this.player.x, this.player.y, targetX, targetY);
        const maxDistance = 300; // 최대 사정거리
        const finalX = this.player.x + Math.cos(angle) * maxDistance;
        const finalY = this.player.y + Math.sin(angle) * maxDistance;
        
        // 투사체 회전 (수리검이 날아가는 방향을 향하도록)
        projectile.setRotation(angle);
        
        // 투사체 이동 (Tween 사용 + 물리 바디 위치 업데이트)
        const distance = Phaser.Math.Distance.Between(this.player.x, this.player.y, finalX, finalY);
        const duration = (distance / 300) * 1000; // 300은 투사체 속도
        
        const moveTween = this.player.scene.tweens.add({
            targets: projectile,
            x: finalX,
            y: finalY,
            duration: duration,
            ease: 'Linear',
            onUpdate: () => {
                // 물리 바디 위치를 스프라이트 위치와 동기화
                if (projectile.body) {
                    projectile.body.reset(projectile.x, projectile.y);
                }
            },
            onComplete: () => {
                if (projectile.active) {
                    projectile.destroy();
                }
            }
        });
        
        // 투사체 이펙트 (회전 효과)
        const effectTween = this.player.scene.tweens.add({
            targets: projectile,
            angle: projectile.angle + 360,
            duration: 1000,
            repeat: -1
        });
        
        // 투사체 파괴 함수
        const destroyProjectile = () => {
            if (projectile.active) {
                // 모든 Tween 애니메이션 중지
                moveTween.stop();
                effectTween.stop();
                projectile.destroy();
            }
        };
        
        // 투사체에 파괴 함수 저장
        projectile.destroyProjectile = destroyProjectile;
        
        // 투사체와 벽 충돌 체크 (시각적 효과만)
        this.player.scene.physics.add.collider(projectile, this.player.scene.walls, (projectile, wall) => {
            if (projectile && projectile.active) {
                this.createShurikenExplosion(projectile.x, projectile.y);
                projectile.destroyProjectile();
            }
        });
        
        // 다른 플레이어와의 충돌 (시각적 효과만, 데미지는 서버에서 처리)
        if (this.player.scene.otherPlayers && this.player.scene.otherPlayers.getChildren) {
            this.player.scene.physics.add.overlap(projectile, this.player.scene.otherPlayers, (projectile, otherPlayer) => {
                // 발사한 플레이어 자신과는 충돌하지 않도록 제외
                if (otherPlayer && otherPlayer.networkId === this.player.networkId) {
                    return;
                }
                
                // 다른 팀 플레이어와만 충돌 처리
                if (otherPlayer && otherPlayer.team && this.player.team && otherPlayer.team !== this.player.team) {
                    if (projectile && projectile.active) {
                        this.createShurikenExplosion(projectile.x, projectile.y);
                        projectile.destroyProjectile();
                    }
                }
            });
        }
        
        // 로컬 플레이어와의 충돌 (다른 팀 투사체만)
        if (this.player.scene.player && this.player.networkId !== this.player.scene.player.networkId) {
            this.player.scene.physics.add.overlap(projectile, this.player.scene.player, (projectile, localPlayer) => {
                const localPlayerTeam = this.player.scene.player?.team;
                const shooterTeam = this.player?.team;
                
                if (shooterTeam && localPlayerTeam && shooterTeam !== localPlayerTeam) {
                    if (projectile && projectile.active) {
                        this.createShurikenExplosion(projectile.x, projectile.y);
                        projectile.destroyProjectile();
                    }
                }
            });
        }
        
        // 투사체 수명 설정 (3초 후 자동 제거)
        this.player.scene.time.delayedCall(3000, () => {
            if (projectile.active) {
                projectile.destroy();
            }
        });
    }

    /**
     * 표창 폭발 이펙트 생성 (매우 작게)
     */
    createShurikenExplosion(x, y) {
        const explosion = this.player.scene.add.circle(x, y, 5, 0x800080, 0.6);
        this.player.scene.tweens.add({
            targets: explosion,
            scaleX: 1.5,
            scaleY: 1.5,
            alpha: 0,
            duration: 200,
            onComplete: () => {
                explosion.destroy();
            }
        });
    }
} 