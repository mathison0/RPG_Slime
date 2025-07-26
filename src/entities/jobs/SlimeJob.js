import BaseJob from './BaseJob.js';
import { getJobInfo } from '../../data/JobClasses.js';

/**
 * 슬라임 직업 클래스
 */
export default class SlimeJob extends BaseJob {
    constructor(player) {
        super(player);
        this.jobInfo = getJobInfo('slime');
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
        
        // 쿨타임 체크
        if (!this.isSkillAvailable(skillKey)) {
            this.showCooldownMessage();
            return;
        }

        // 스킬 사용 중이거나 다른 플레이어면 실행하지 않음
        if (this.player.isJumping || this.player.isOtherPlayer) {
            return;
        }

        // 스킬 정보 가져오기
        const skillInfo = this.jobInfo.skills[0]; // 퍼지기 스킬
        const range = skillInfo.range;
        const damage = this.calculateDamage(skillInfo.damage);

        // 쿨타임 설정
        this.setSkillCooldown(skillKey, skillInfo.cooldown);

        // 스킬 사용 중 상태
        this.player.isJumping = true;
        this.player.setVelocity(0);

        // 슬라임 퍼지기 스프라이트 적용
        const originalTexture = this.player.texture.key;
        this.player.setTexture('slime_skill');

        // 시각적 이펙트 (원형 범위 표시)
        const effect = this.scene.add.circle(this.player.x, this.player.y, range, 0x00ff00, 0.3);
        this.scene.time.delayedCall(300, () => {
            effect.destroy();
        });

        // 범위 내 적 탐색 및 데미지 적용
        const enemies = this.getEnemiesInRange(range);
        enemies.forEach(enemy => {
            enemy.takeDamage(damage);
        });

        // 스킬 사용 후 딜레이
        this.scene.time.delayedCall(400, () => {
            this.player.isJumping = false;
            // 원래 스프라이트로 복원
            this.player.updateJobSprite();
        });

        // 네트워크 동기화
        if (this.player.networkManager && !this.player.isOtherPlayer) {
            this.player.networkManager.useSkill('slime_spread');
        }

        console.log(`슬라임 퍼지기 사용! 데미지: ${damage}, 범위: ${range}`);
    }

    /**
     * 점프 기능 (스페이스바)
     */
    useJump() {
        // 이미 점프 중이거나 다른 플레이어면 실행하지 않음
        if (this.player.isJumping || this.player.isOtherPlayer) {
            return;
        }
        
        const originalY = this.player.y;
        const originalNameY = this.player.nameText ? this.player.nameText.y : null;
        
        this.player.setVelocity(0);
        this.player.isJumping = true;
        
        // 플레이어와 이름표를 함께 애니메이션
        const targets = [this.player];
        if (this.player.nameText) {
            targets.push(this.player.nameText);
        }
        
        this.scene.tweens.add({
            targets: targets,
            y: originalY - 50,
            duration: 200,
            yoyo: true,
            ease: 'Power2',
            onComplete: () => {
                // 점프 완료 후 정확한 위치로 복원
                this.player.y = originalY;
                if (this.player.nameText && originalNameY !== null) {
                    this.player.nameText.y = originalNameY;
                }
                this.player.isJumping = false;
                
                // 점프 완료 후 서버에 위치 동기화
                if (this.player.networkManager) {
                    this.player.networkManager.updatePlayerPosition(
                        this.player.x, 
                        this.player.y, 
                        this.player.direction, 
                        false
                    );
                }
            }
        });

        // 네트워크 동기화
        if (this.player.networkManager && !this.player.isOtherPlayer) {
            this.player.networkManager.useSkill('jump');
        }
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
} 