import BaseJob from './BaseJob.js';
import { getGlobalTimerManager } from '../../managers/AbsoluteTimerManager.js';
import EffectManager from '../../effects/EffectManager.js';
// JobClasses는 서버에서 관리하므로 import 제거

/**
 * 마법사 직업 클래스
 */
export default class MageJob extends BaseJob {
    constructor(player) {
        super(player);
        this.lastBasicAttackTime = 0;
        // 쿨타임은 서버에서 관리됨
        
        this.magicMissileSprite = null;
        this.magicMissileGraphics = null;
        
        this.effectManager = new EffectManager(player.scene);
        
        // JobClasses에서 마법 투사체 스킬 정보 가져오기
        this.magicMissileSkillInfo = {
            range: 400,           // 투사체 사거리
            explosionRadius: 60,  // 폭발 범위
            damage: 'attack * 2.0' // 데미지 공식
        };
    }

    useSkill(skillNumber, options = {}) {
        switch (skillNumber) {
            case 1:
                this.useIceField();
                break;
            case 2:
                this.useMagicMissile(options);
                break;
            case 3:
                this.useShield();
                break;
            default:
                console.log('MageJob: 알 수 없는 스킬 번호:', skillNumber);
        }
    }

    /**
     * 보호막 스킬
     */
    useShield() {
        const skillKey = 'skill3'; // 통일된 스킬 키 사용

        // 다른 플레이어면 실행하지 않음
        if (this.player.isOtherPlayer) {
            return;
        }
        
        // 네트워크 매니저가 없으면 실행하지 않음
        if (!this.player.networkManager) {
            console.log('NetworkManager가 없어서 스킬을 사용할 수 없습니다.');
            return;
        }

        // 네트워크 동기화 (서버에 보호막 요청만 전송)
        if (this.player.networkManager && !this.player.isOtherPlayer) {
            this.player.networkManager.useSkill('shield');
        }

        console.log('보호막 요청 전송!');
    }

    /**
     * 얼음 장판 스킬
     */
    useIceField() {
        const skillKey = 'skill1'; // 통일된 스킬 키 사용
        
        // 다른 플레이어면 실행하지 않음
        if (this.player.isOtherPlayer) {
            return;
        }
        
        // 네트워크 매니저가 없으면 실행하지 않음
        if (!this.player.networkManager) {
            console.log('NetworkManager가 없어서 스킬을 사용할 수 없습니다.');
            return;
        }

        // 네트워크 동기화 (서버에 얼음 장판 요청만 전송)
        if (this.player.networkManager && !this.player.isOtherPlayer) {
            this.player.networkManager.useSkill('ice_field');
        }

        console.log('얼음 장판 요청 전송!');
    }

    /**
     * 마법 투사체 스킬
     */
    useMagicMissile(options = {}) {
        if (this.player.isOtherPlayer || !this.player.networkManager) {
            return;
        }
        
        // 마우스 커서의 월드 좌표 가져오기
        const pointer = this.scene.input.activePointer;
        const worldPoint = this.scene.cameras.main.getWorldPoint(pointer.x, pointer.y);

        // 네트워크 동기화 (서버에 마법 투사체 요청만 전송)
        this.player.networkManager.useSkill('magic_missile', {
            targetX: worldPoint.x,
            targetY: worldPoint.y
        });

        console.log('마법 투사체 요청 전송!');
    }

    /**
     * 마법사 기본 공격 이펙트 (서버에서 받은 이벤트 처리)
     */
    showBasicAttackEffect(targetX, targetY) {
        // 서버에서 투사체를 관리하므로 클라이언트에서는 이펙트만 처리
        console.log('마법사 기본 공격 이펙트 처리');
    }

    /**
     * 보호막 이펙트 (서버에서 스킬 승인 시 호출)
     */
    showShieldEffect(data = null) {
        // 보호막 이펙트 생성
        const shield = this.player.scene.add.circle(this.player.x, this.player.y, 50, 0x00ffff, 0.3);
        shield.setDepth(1002);
        
        // 보호막 애니메이션
        this.player.scene.tweens.add({
            targets: shield,
            scaleX: 1.2,
            scaleY: 1.2,
            alpha: 0.1,
            duration: 2000,
            yoyo: true,
            repeat: 2,
            onComplete: () => {
                shield.destroy();
            }
        });
        
        console.log('보호막 생성 완료!');
    }

    /**
     * 얼음 장판 이펙트 (서버에서 스킬 승인 시 호출)
     */
    showIceFieldEffect(data = null) {
        // 서버에서 받은 스킬 정보 사용
        const skillInfo = data?.skillInfo || {};
        const range = skillInfo.range || 100; // 서버에서 받은 범위
        const duration = skillInfo.duration || 6000; // 서버에서 받은 지속시간
        
        console.log(`얼음 장판 스킬 정보 (서버에서 받음): range=${range}, duration=${duration}ms`);
        
        // 얼음 장판 생성
        const iceField = this.player.scene.add.circle(this.player.x, this.player.y, range, 0x87ceeb, 0.4);
        this.player.scene.physics.add.existing(iceField);
        iceField.body.setImmovable(true);
    
        
        // 절대 시간 기준 타이머 매니저 사용 (WarriorJob과 동일한 방식)
        const timerManager = getGlobalTimerManager();
        const targetEndTime = Date.now() + duration;
        const eventId = timerManager.addEvent(targetEndTime, () => {
            if (iceField.active) {
                iceField.destroy();
            }
        });
        
        // 호환성을 위한 타이머 객체
        const iceFieldTimer = {
            remove: () => timerManager.removeEvent(eventId)
        };
        
        if (this.player.delayedSkillTimers) {
            this.player.delayedSkillTimers.add(iceFieldTimer);
        }

        console.log('얼음 장판 생성 완료!');
    }

    /**
     * 마법 투사체 이펙트 (서버에서 스킬 승인 시 호출)
     */
    showMagicMissileEffect(data = null) {
        if (!data) return;
        
        const mouseX = data.targetX || this.player.x;
        const mouseY = data.targetY || this.player.y;
        const endTime = data.endTime || (Date.now() + 3000); // 기본 3초
        
        console.log('마법 투사체 이펙트 시작 : [time: ' + Date.now() + '] [endTime: ' + endTime + ']');
        
        // 마법 투사체 생성
        const missile = this.player.scene.add.circle(this.player.x, this.player.y, 8, 0xff00ff, 1);
        this.player.scene.physics.add.existing(missile);
        missile.setDepth(750);
        
        // 투사체 이펙트 애니메이션
        this.player.scene.tweens.add({
            targets: missile,
            scaleX: 1.5,
            scaleY: 1.5,
            duration: 500,
            yoyo: true,
            repeat: -1
        });
        
        // 플레이어에서 마우스 커서까지의 각도 계산
        const centerX = this.player.x;
        const centerY = this.player.y;
        const angleToMouse = Phaser.Math.Angle.Between(centerX, centerY, mouseX, mouseY);
        
        // 사거리 제한 (JobClasses에서 가져온 값 사용)
        const maxRange = this.magicMissileSkillInfo.range;
        const initialDistance = Phaser.Math.Distance.Between(centerX, centerY, mouseX, mouseY);
        let finalTargetX = mouseX;
        let finalTargetY = mouseY;
        
        if (initialDistance > maxRange) {
            finalTargetX = centerX + Math.cos(angleToMouse) * maxRange;
            finalTargetY = centerY + Math.sin(angleToMouse) * maxRange;
        }
        
        // 투사체 이동 (속도를 느리게 조정)
        const velocity = 200; // 400에서 200으로 감소 (50% 느려짐)
        const distance = Phaser.Math.Distance.Between(centerX, centerY, finalTargetX, finalTargetY);
        const duration = (distance / velocity) * 1000;
        
        this.player.scene.tweens.add({
            targets: missile,
            x: finalTargetX,
            y: finalTargetY,
            duration: duration,
            ease: 'Linear',
            onUpdate: () => {
                // 물리 바디 위치를 스프라이트 위치와 동기화
                if (missile.body) {
                    missile.body.reset(missile.x, missile.y);
                }
            },
            onComplete: () => {
                // 투사체가 이미 벽에 충돌했다면 onComplete 실행하지 않음
                if (missile.hasCollided) {
                    return;
                }
                
                // 투사체가 목표지점에 도달했을 때 폭발하고 서버에 충돌 정보 전송
                this.createMagicExplosion(missile.x, missile.y);
                
                // 서버에 벽 충돌 이벤트 전송 (기존 방식과 일관성 유지)
                if (this.player.networkManager) {
                    this.player.networkManager.socket.emit('projectile-wall-collision', {
                        playerId: this.player.networkId,
                        x: missile.x,
                        y: missile.y,
                        jobClass: this.player.jobClass
                    });
                }
                
                missile.destroy();
            }
        });
        
        // 투사체와 벽 충돌 체크
        this.player.scene.physics.add.collider(missile, this.player.scene.walls, (missile, wall) => {
            console.log('마법 투사체가 벽과 충돌!');
            if (missile && missile.active) {
                // 벽 충돌 시 폭발 이펙트 생성
                this.createMagicExplosion(missile.x, missile.y);
                
                // 서버에 벽 충돌 이벤트 전송 (기존 방식과 일관성 유지)
                if (this.player.networkManager) {
                    this.player.networkManager.socket.emit('projectile-wall-collision', {
                        playerId: this.player.networkId,
                        x: missile.x,
                        y: missile.y,
                        jobClass: this.player.jobClass
                    });
                }
                
                // 투사체가 벽에 충돌했으므로 onComplete 콜백이 실행되지 않도록 플래그 설정
                missile.hasCollided = true;
                missile.destroy();
            }
        });
        
        // 투사체가 날아가는 동안 계속 보이도록 설정
        missile.setVisible(true);
        
        // EffectManager를 사용한 공격 효과 메시지
        const attackText = this.effectManager.showSkillMessage(
            this.player.x, 
            this.player.y, 
            '메테오!'
        );
        
        // 절대 시간 기준 타이머 매니저 사용 (WarriorJob과 동일한 방식)
        const timerManager = getGlobalTimerManager();
        const eventId = timerManager.addEvent(endTime, () => {
            // 정확한 시간에 도달 - 정리 실행 (투사체는 이미 목표지점에서 사라짐)
            if (attackText.active) {
                attackText.destroy();
            }
            
            console.log('마법 투사체 이펙트 종료 [time: ' + Date.now() + '] [target: ' + endTime + ']');
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
     * 투사체 충돌 설정
     */
    setupMissileCollisions(missile) {
        // 상대팀 플레이어와 충돌
        const allPlayers = [this.player.scene.player, ...this.player.scene.otherPlayers.getChildren()];
        allPlayers.forEach(targetPlayer => {
            if (!targetPlayer || missile.team === targetPlayer.team) return;
            
            this.player.scene.physics.add.overlap(missile, targetPlayer, (missile, hitPlayer) => {
                const damage = 30;
                if (typeof hitPlayer.takeDamage === 'function') {
                    hitPlayer.takeDamage(damage);
                }
                this.player.scene.effectManager.showExplosion(missile.x, missile.y);
                missile.destroy();
            });
        });
        
        // 적과 충돌
        this.player.scene.physics.add.overlap(missile, this.player.scene.enemies, (missile, enemy) => {
            if (this.player.networkManager && enemy.networkId) {
                this.player.networkManager.hitEnemy(enemy.networkId);
            }
            this.player.scene.effectManager.showExplosion(missile.x, missile.y);
            missile.destroy();
        });
        
        // 벽과 충돌
        this.player.scene.physics.add.collider(missile, this.player.scene.walls, (missile, wall) => {
            this.player.scene.effectManager.showExplosion(missile.x, missile.y);
            missile.destroy();
        });
    }

    /**
     * 마법 폭발 이펙트 생성
     */
    createMagicExplosion(x, y) {
        // 범위 공격 반지름 (JobClasses에서 가져온 값 사용)
        const explosionRadius = this.magicMissileSkillInfo.explosionRadius;
        
        // 폭발 이펙트 생성 (시각적 효과만)
        const explosion = this.player.scene.add.circle(x, y, explosionRadius, 0xff00ff, 0.3);
        explosion.setDepth(750);
        this.player.scene.tweens.add({
            targets: explosion,
            scaleX: 1.5,
            scaleY: 1.5,
            alpha: 0,
            duration: 400,
            onComplete: () => {
                explosion.destroy();
            }
        });
        
        // 서버에서 데미지 처리를 담당하므로 클라이언트에서는 시각적 효과만 처리
        // 데미지 처리 로직 제거됨
    }

    /**
     * 미니맵에 적 표시
     */
    showEnemyOnMinimap(enemy) {
        if (enemy.minimapIndicator || !this.scene.minimap) return;
        
        const scale = this.scene.minimapScale;
        const offsetX = this.player.x - (this.scene.minimapSize / 2) / scale;
        const offsetY = this.player.y - (this.scene.minimapSize / 2) / scale;
        
        const minimapX = (enemy.x - offsetX) * scale;
        const minimapY = (enemy.y - offsetY) * scale;
        
        const clampedX = Math.max(0, Math.min(this.scene.minimapSize, minimapX));
        const clampedY = Math.max(0, Math.min(this.scene.minimapSize, minimapY));
        
        const minimapEnemy = this.scene.add.circle(
            this.scene.minimap.x + clampedX,
            this.scene.minimap.y + clampedY,
            3,
            0xff0000, 
            1.0
        );
        minimapEnemy.setScrollFactor(0);
        minimapEnemy.setDepth(1004);
        
        enemy.minimapIndicator = minimapEnemy;
        
        this.scene.tweens.add({
            targets: minimapEnemy,
            alpha: 0.3,
            duration: 500,
            yoyo: true,
            repeat: -1
        });
    }

    /**
     * 미니맵에서 적 표시 제거
     */
    hideEnemyFromMinimap(enemy) {
        if (enemy.minimapIndicator) {
            enemy.minimapIndicator.destroy();
            enemy.minimapIndicator = null;
        }
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

    // 기본 공격은 서버에서 처리됩니다. 클라이언트는 이벤트 응답으로만 애니메이션 실행

    createProjectile(targetX, targetY) {
        // 투사체 생성 (빛나는 점)
        const projectile = this.player.scene.add.circle(this.player.x, this.player.y, 4, 0x0000ff, 1);
        this.player.scene.physics.add.existing(projectile);
        
        // 투사체 콜라이더 설정
        projectile.body.setCircle(4); // 원형 콜라이더 설정
        projectile.body.setCollideWorldBounds(false); // 월드 경계 충돌 비활성화
        projectile.body.setBounce(0, 0); // 튕김 없음
        projectile.body.setDrag(0, 0); // 저항 없음
        
        // 커서 방향으로 특정 거리까지 날아가도록 계산
        const angle = Phaser.Math.Angle.Between(this.player.x, this.player.y, targetX, targetY);
        const maxDistance = this.magicMissileSkillInfo.range; // JobClasses에서 정의된 사거리
        const finalX = this.player.x + Math.cos(angle) * maxDistance;
        const finalY = this.player.y + Math.sin(angle) * maxDistance;
        
        // 투사체 이동 (Tween 사용 + 물리 바디 위치 업데이트)
        const distance = Phaser.Math.Distance.Between(this.player.x, this.player.y, finalX, finalY);
        const duration = (distance / 280) * 1000; // 280은 투사체 속도
        
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
                    // 최대 사거리에 도달했을 때 범위 공격 실행
                    this.createMagicExplosion(projectile.x, projectile.y);
                    projectile.destroy();
                }
            }
        });
        
        // 투사체 이펙트 (빛나는 효과)
        const effectTween = this.player.scene.tweens.add({
            targets: projectile,
            scaleX: 1.5,
            scaleY: 1.5,
            alpha: 0.5,
            duration: 200,
            yoyo: true,
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
            console.log('마법사 투사체가 벽과 충돌!');
            if (projectile && projectile.active) {
                // 벽 충돌 시 폭발 이펙트 생성
                this.createMagicExplosion(projectile.x, projectile.y);
                
                // 서버에 벽 충돌 이벤트 전송 (마법사 범위 공격용)
                if (this.player.networkManager) {
                    this.player.networkManager.socket.emit('projectile-wall-collision', {
                        playerId: this.player.networkId,
                        x: projectile.x,
                        y: projectile.y,
                        jobClass: this.player.jobClass
                    });
                }
                
                projectile.destroyProjectile();
            }
        });
        
        // 다른 플레이어와의 충돌 (시각적 효과만, 데미지는 서버에서 처리)
        this.player.scene.physics.add.overlap(projectile, this.player.scene.otherPlayers, (projectile, otherPlayer) => {
            if (otherPlayer && otherPlayer.team !== this.player.team) {
                console.log('마법사 투사체가 다른 팀 플레이어와 충돌!');
                if (projectile && projectile.active) {
                    // 다른 플레이어 충돌 시 폭발 이펙트 생성
                    this.createMagicExplosion(projectile.x, projectile.y);
                    projectile.destroyProjectile();
                }
            }
        });
    }

    /**
     * 정리 작업
     */
    destroy() {
        super.destroy();
        
        // 마법 투사체 그래픽 정리
        if (this.magicMissileGraphics && this.magicMissileGraphics.active) {
            this.magicMissileGraphics.destroy();
            this.magicMissileGraphics = null;
        }
        
        console.log('MageJob: 스킬 이펙트 정리 완료');
    }

    clearSkillEffects() {
        super.clearSkillEffects();
        
        // 마법 투사체 그래픽 정리
        if (this.magicMissileGraphics && this.magicMissileGraphics.active) {
            this.magicMissileGraphics.destroy();
            this.magicMissileGraphics = null;
        }
        
        console.log('MageJob: 스킬 이펙트 정리 완료');
    }
} 