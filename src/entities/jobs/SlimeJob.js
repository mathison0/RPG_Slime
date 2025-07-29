import BaseJob from './BaseJob.js';
// JobClasses는 서버에서 관리하므로 import 제거

/**
 * 슬라임 직업 클래스
 */
export default class SlimeJob extends BaseJob {
    constructor(player) {
        super(player);
        // 직업 정보는 서버에서 받아옴
        this.lastBasicAttackTime = 0;
        // 쿨타임은 서버에서 관리됨
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
        const skillKey = 'skill1'; // 통일된 스킬 키 사용
        
        // 쿨타임 체크
        if (!this.isSkillAvailable(skillKey)) {
            this.showCooldownMessage();
            return;
        }
        
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
        
        // 스킬 정보는 서버에서 처리됨
        
        // 쿨타임은 서버에서 관리됨

        // 서버에 스킬 사용 요청
        this.player.networkManager.useSkill('spread');
        
        console.log('슬라임 퍼지기 서버 요청 전송');
    }

    /**
     * 슬라임 기본 공격 이펙트 (서버에서 받은 이벤트 처리)
     */
    showBasicAttackEffect(targetX, targetY) {
        // 서버에서 투사체를 관리하므로 클라이언트에서는 이펙트만 처리
        console.log('슬라임 기본 공격 이펙트 처리');
    }

    /**
     * 슬라임 퍼지기 이펙트
     */
    showSpreadEffect(data = null) {
        // 본인도 이펙트를 볼 수 있도록 수정
        const isOwnPlayer = this.player === this.player.scene.player;
        const startTime = Date.now();
        console.log(`[${startTime}] 슬라임 퍼지기 이펙트 시작 (본인: ${isOwnPlayer})`);
        
        // 기존 슬라임 스킬 이펙트가 있다면 제거
        if (this.player.slimeSkillEffect) {
            this.player.slimeSkillEffect.destroy();
            this.player.slimeSkillEffect = null;
        }
        
        // 기존 슬라임 스킬 타이머가 있다면 제거
        if (this.player.slimeSkillTimer) {
            this.player.scene.time.removeEvent(this.player.slimeSkillTimer);
            this.player.slimeSkillTimer = null;
        }
        
        // 슬라임 스킬 상태 설정
        this.player.isUsingSlimeSkill = true;
        
        // 슬라임 스킬 스프라이트로 변경
        this.player.setTexture('slime_skill');
        
        // 퍼지기 스킬 메시지 표시
        const skillText = this.player.scene.add.text(
            this.player.x, 
            this.player.y - 60, 
            '퍼지기!', 
            {
                fontSize: '16px',
                fill: '#00ff00',
                stroke: '#000000',
                strokeThickness: 2
            }
        ).setOrigin(0.5);
        
        // 메시지 애니메이션 (위로 올라가면서 사라짐)
        this.player.scene.tweens.add({
            targets: skillText,
            y: skillText.y - 30,
            alpha: 0,
            duration: 1500,
            ease: 'Power2',
            onComplete: () => {
                if (skillText.active) {
                    skillText.destroy();
                }
            }
        });
        
        // 서버에서 받은 스킬 정보 사용
        const skillInfo = data?.skillInfo || {};
        const range = skillInfo.range || 50; // 서버에서 받은 범위
        const effectDuration = skillInfo.duration || 1000; // 서버에서 받은 지속시간
        
        console.log(`[${startTime}] 슬라임 퍼지기 스킬 정보 (서버에서 받음): range=${range}, duration=${effectDuration}ms`);
        
        // 초록색 범위 효과 생성
        const effect = this.player.scene.add.circle(this.player.x, this.player.y, range, 0x00ff00, 0.3);
        this.player.slimeSkillEffect = effect; // 플레이어에 이펙트 참조 저장
        
        // 스프라이트 복원 타이머 설정 (지속시간과 정확히 동일하게)
        this.player.slimeSkillTimer = this.player.scene.time.delayedCall(effectDuration, () => {
            const endTime = Date.now();
            const actualDuration = endTime - startTime;
            
            // 범위 효과 제거
            if (effect.active) {
                effect.destroy();
                console.log(`[${endTime}] 슬라임 퍼지기 범위 효과 제거 (실제 지속시간: ${actualDuration}ms)`);
            }
            
            // 플레이어 참조 정리
            if (this.player.slimeSkillEffect === effect) {
                this.player.slimeSkillEffect = null;
            }
            
            // 슬라임 스킬 상태 해제
            this.player.isUsingSlimeSkill = false;
            
            // 스프라이트 복원
            if (this.player.active) {
                this.player.updateJobSprite();
                console.log(`[${endTime}] 슬라임 퍼지기 스프라이트 복원 완료 (실제 지속시간: ${actualDuration}ms)`);
            }
            
            // 타이머 참조 정리
            this.player.slimeSkillTimer = null;
        });
    }

    /**
     * 쿨타임 정보 반환 (서버에서 받은 정보 사용)
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
        // 투사체 생성 (슬라임 투사체 스프라이트 사용)
        const projectile = this.player.scene.add.sprite(this.player.x, this.player.y, 'slime_basic_attack');
        this.player.scene.physics.add.existing(projectile);
        
        // 투사체 크기 설정
        projectile.setDisplaySize(12, 12);
        
        // 투사체 콜라이더 설정
        projectile.body.setCircle(32); // 원형 콜라이더 설정
        projectile.body.setCollideWorldBounds(false); // 월드 경계 충돌 비활성화
        projectile.body.setBounce(0, 0); // 튕김 없음
        projectile.body.setDrag(0, 0); // 저항 없음
        
        // 커서 방향으로 특정 거리까지 날아가도록 계산
        const angle = Phaser.Math.Angle.Between(this.player.x, this.player.y, targetX, targetY);
        const maxDistance = 250; // 최대 사정거리
        const finalX = this.player.x + Math.cos(angle) * maxDistance;
        const finalY = this.player.y + Math.sin(angle) * maxDistance;
        
        // 투사체 회전 (슬라임 투사체가 날아가는 방향을 향하도록)
        projectile.setRotation(angle);
        
        // 투사체 이동 (Tween 사용 + 물리 바디 위치 업데이트)
        const distance = Phaser.Math.Distance.Between(this.player.x, this.player.y, finalX, finalY);
        const duration = (distance / 250) * 1000; // 250은 투사체 속도
        
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
        
        // 투사체 이펙트 (미세한 크기 변화)
        const effectTween = this.player.scene.tweens.add({
            targets: projectile,
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
            console.log('슬라임 투사체가 벽과 충돌!');
            if (projectile && projectile.active) {
                // 벽 충돌 시 폭발 이펙트 생성
                this.createSlimeExplosion(projectile.x, projectile.y);
                projectile.destroyProjectile();
            }
        });
        
        // 다른 플레이어와의 충돌 (시각적 효과만, 데미지는 서버에서 처리)
        this.player.scene.physics.add.overlap(projectile, this.player.scene.otherPlayers, (projectile, otherPlayer) => {
            if (otherPlayer && otherPlayer.team !== this.player.team) {
                console.log('슬라임 투사체가 다른 팀 플레이어와 충돌!');
                if (projectile && projectile.active) {
                    // 다른 플레이어 충돌 시 폭발 이펙트 생성
                    this.createSlimeExplosion(projectile.x, projectile.y);
                    projectile.destroyProjectile();
                }
            }
        });
    }

    /**
     * 슬라임 폭발 이펙트 생성 (매우 작게)
     */
    createSlimeExplosion(x, y) {
        const explosion = this.player.scene.add.circle(x, y, 5, 0x00ff00, 0.6);
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