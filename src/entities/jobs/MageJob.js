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
        
        this.magicMissileSprite = null;
        this.magicMissileGraphics = null;
        
        this.effectManager = new EffectManager(player.scene);
        
        // 보호막 이펙트 관리
        this.currentShield = null;
        this.shieldTimer = null;
    }

    useSkill(skillNumber, options = {}) {
        if (this.player.isOtherPlayer || !this.player.networkManager) {
            return;
        }
        
        switch (skillNumber) {
            case 1: // Q키 - 얼음 장판
                const pointer = this.scene.input.activePointer;
                const worldPoint = this.scene.cameras.main.getWorldPoint(pointer.x, pointer.y);
                console.log(`클라이언트 얼음 장판 요청: 마우스 스크린 좌표=(${pointer.x}, ${pointer.y}), 월드 좌표=(${worldPoint.x}, ${worldPoint.y}), 플레이어 위치=(${this.player.x}, ${this.player.y})`);
                this.player.networkManager.useSkill('ice_field', {
                    targetX: worldPoint.x,
                    targetY: worldPoint.y
                });
                break;
            case 2: // E키 - 마법 투사체
                const pointer2 = this.scene.input.activePointer;
                const worldPoint2 = this.scene.cameras.main.getWorldPoint(pointer2.x, pointer2.y);
                this.player.networkManager.useSkill('magic_missile', {
                    targetX: worldPoint2.x,
                    targetY: worldPoint2.y
                });
                break;
            case 3: // R키 - 보호막
                this.player.networkManager.useSkill('shield');
                break;
            default:
                console.log('MageJob: 알 수 없는 스킬 번호:', skillNumber);
        }
    }

    /**
     * 마법사 기본 공격 이펙트 (투사체)
     */
    showBasicAttackEffect(targetX, targetY) {
        // 서버에서 투사체를 관리하므로 클라이언트에서는 기본 이펙트만 처리
        console.log('마법사 기본 공격 이펙트 처리');
    }

    /**
     * 얼음 장판 이펙트 (서버에서 스킬 승인 시 호출)
     */
    showIceFieldEffect(data = null) {
        // 서버에서 받은 스킬 정보 사용
        const skillInfo = data?.skillInfo || {};
        const range = skillInfo.range || 100; // 서버에서 받은 범위
        const duration = skillInfo.duration || 6000; // 서버에서 받은 지속시간
        const endTime = data?.endTime || (Date.now() + duration);
        
        // 서버에서 받은 실제 시전 위치 사용
        const iceX = data?.x || this.player.x;
        const iceY = data?.y || this.player.y;
        
        console.log(`얼음 장판 클라이언트 이펙트: 위치=(${iceX}, ${iceY}), range=${range}, duration=${duration}ms`);
        console.log(`원본 데이터: data.x=${data?.x}, data.y=${data?.y}, player위치=(${this.player.x}, ${this.player.y})`);
        
        // 얼음 장판 생성 (서버에서 받은 위치에)
        const iceField = this.player.scene.add.circle(iceX, iceY, range, 0x87ceeb, 0.4);
        iceField.setDepth(650);
        
        // EffectManager를 사용한 스킬 메시지
        const skillText = this.effectManager.showSkillMessage(
            iceX, 
            iceY, 
            '얼음 장판!'
        );
        
        // 절대 시간 기준 타이머 매니저 사용 (WarriorJob과 동일한 방식)
        const timerManager = getGlobalTimerManager();
        const eventId = timerManager.addEvent(endTime, () => {
            if (iceField.active) {
                iceField.destroy();
            }
            if (skillText.active) {
                skillText.destroy();
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
        
        const targetX = data.targetX || this.player.x;
        const targetY = data.targetY || this.player.y;
        const skillInfo = data.skillInfo || {};
        const range = skillInfo.range || 400;
        const explosionRadius = skillInfo.explosionRadius || 60;
        const afterDelay = skillInfo.afterDelay || 0;
        const endTime = data.endTime || (Date.now() + 3000);
        const effectEndTime = endTime - afterDelay; // 실제 투사체 효과 종료 시간
        
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
        const angleToMouse = Phaser.Math.Angle.Between(centerX, centerY, targetX, targetY);
        
        // 사거리 제한
        const initialDistance = Phaser.Math.Distance.Between(centerX, centerY, targetX, targetY);
        let finalTargetX = targetX;
        let finalTargetY = targetY;
        
        if (initialDistance > range) {
            finalTargetX = centerX + Math.cos(angleToMouse) * range;
            finalTargetY = centerY + Math.sin(angleToMouse) * range;
        }
        
        // 투사체 이동
        const velocity = 200;
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
                
                // 투사체가 목표지점에 도달했을 때 폭발
                this.createMagicExplosion(missile.x, missile.y, explosionRadius);
                
                // 서버에 폭발 위치 전송 (데미지 처리용)
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
                this.createMagicExplosion(missile.x, missile.y, explosionRadius);
                
                // 서버에 벽 충돌 이벤트 전송
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
        
        // EffectManager를 사용한 공격 효과 메시지
        const attackText = this.effectManager.showSkillMessage(
            this.player.x, 
            this.player.y, 
            '마법 투사체!'
        );
        
        // 절대 시간 기준 타이머 매니저 사용 (WarriorJob과 동일한 방식)
        const timerManager = getGlobalTimerManager();
        const eventId = timerManager.addEvent(endTime, () => {
            // 정확한 시간에 도달 - 정리 실행
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
     * 보호막 이펙트 (서버에서 스킬 승인 시 호출)
     */
    showShieldEffect(data = null) {
        console.log('보호막 이펙트 시작:', data);
        
        // 서버에서 받은 스킬 정보 사용
        const skillInfo = data?.skillInfo || {};
        const duration = skillInfo.duration || 8000; // 서버에서 받은 지속시간
        const endTime = data?.endTime || (Date.now() + duration);
        
        console.log(`보호막 스킬 정보 (서버에서 받음): duration=${duration}ms`);
        
        // 보호막 생성 (플레이어 주변에 원형 보호막)
        const shield = this.player.scene.add.circle(this.player.x, this.player.y, 40, 0x00ffff, 0.3);
        shield.setDepth(750);
        shield.setStrokeStyle(3, 0x00ffff, 0.8);
        
        // 현재 보호막으로 설정
        this.currentShield = shield;
        
        // 보호막이 플레이어를 따라다니도록 설정
        const updateShieldPosition = () => {
            if (shield.active && this.player.active) {
                shield.setPosition(this.player.x, this.player.y);
            }
        };
        
        // 보호막 애니메이션 (커지고 작아지는 효과 제거)
        const shieldTween = this.player.scene.tweens.add({
            targets: shield,
            alpha: 0.5,
            duration: 1000,
            yoyo: true,
            repeat: -1,
            onUpdate: updateShieldPosition
        });
        
        // EffectManager를 사용한 스킬 메시지
        const skillText = this.effectManager.showSkillMessage(
            this.player.x, 
            this.player.y, 
            '보호막!'
        );
        
        // 절대 시간 기준 타이머 매니저 사용 (WarriorJob과 동일한 방식)
        const timerManager = getGlobalTimerManager();
        const eventId = timerManager.addEvent(endTime, () => {
            if (shield.active) {
                shieldTween.stop();
                shield.destroy();
            }
            if (skillText.active) {
                skillText.destroy();
            }
            
            // 보호막 참조 정리
            if (this.currentShield === shield) {
                this.currentShield = null;
            }
            if (this.shieldTimer === shieldTimer) {
                this.shieldTimer = null;
            }
            
            console.log('보호막 이펙트 종료 [time: ' + Date.now() + '] [target: ' + endTime + ']');
        });
        
        // 호환성을 위한 타이머 객체
        const shieldTimer = {
            remove: () => {
                timerManager.removeEvent(eventId);
                if (shield.active) {
                    shieldTween.stop();
                    shield.destroy();
                }
                if (skillText.active) {
                    skillText.destroy();
                }
                
                // 보호막 참조 정리
                if (this.currentShield === shield) {
                    this.currentShield = null;
                }
                if (this.shieldTimer === shieldTimer) {
                    this.shieldTimer = null;
                }
            }
        };
        
        // 현재 타이머로 설정
        this.shieldTimer = shieldTimer;
        
        console.log('보호막 생성 완료!');
    }

    /**
     * 보호막 제거
     */
    removeShieldEffect() {
        if (this.currentShield) {
            this.currentShield.destroy();
            this.currentShield = null;
        }
        if (this.shieldTimer) {
            this.shieldTimer.remove();
            this.shieldTimer = null;
        }
        console.log('보호막 이펙트 제거 완료');
    }

    /**
     * 마법 폭발 이펙트 생성
     */
    createMagicExplosion(x, y, explosionRadius = 60) {
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