/**
 * 이펙트 관리 클래스
 * 다양한 시각적 효과들을 생성하고 관리합니다.
 */
export default class EffectManager {
    constructor(scene) {
        this.scene = scene;
    }

    /**
     * 데미지 텍스트 표시
     * @param {number} x - X 좌표
     * @param {number} y - Y 좌표
     * @param {number} damage - 데미지 값
     * @param {string} color - 텍스트 색상
     */
    showDamageText(x, y, damage, color = '#ff0000') {
        const damageText = this.scene.add.text(x, y, `${damage}`, {
            fontSize: '16px',
            fill: color,
            fontStyle: 'bold'
        }).setOrigin(0.5);
        
        // 데미지 텍스트 애니메이션
        this.scene.tweens.add({
            targets: damageText,
            y: damageText.y - 30,
            alpha: 0,
            duration: 1000,
            onComplete: () => {
                damageText.destroy();
            }
        });
        
        return damageText;
    }

    /**
     * 힐링 텍스트 표시
     * @param {number} x - X 좌표
     * @param {number} y - Y 좌표
     * @param {number} heal - 힐링 값
     */
    showHealText(x, y, heal) {
        const healText = this.scene.add.text(x, y - 40, `+${heal}`, {
            fontSize: '16px',
            fill: '#00ff00',
            fontStyle: 'bold'
        }).setOrigin(0.5);
        
        // 힐링 텍스트 애니메이션
        this.scene.tweens.add({
            targets: healText,
            y: healText.y - 30,
            alpha: 0,
            duration: 1000,
            onComplete: () => {
                healText.destroy();
            }
        });
        
        return healText;
    }

    /**
     * 임시 메시지 표시
     * @param {number} x - X 좌표
     * @param {number} y - Y 좌표
     * @param {string} message - 메시지 내용
     * @param {Object} style - 텍스트 스타일
     * @param {number} duration - 표시 시간 (ms)
     */
    showMessage(x, y, message, style = {}, duration = 1000) {
        const defaultStyle = {
            fontSize: '16px',
            fill: '#ffffff',
            fontStyle: 'bold'
        };
        
        const finalStyle = { ...defaultStyle, ...style };
        
        const messageText = this.scene.add.text(x, y, message, finalStyle).setOrigin(0.5);
        
        // 메시지 페이드아웃
        this.scene.time.delayedCall(duration, () => {
            if (messageText.active) {
                this.scene.tweens.add({
                    targets: messageText,
                    alpha: 0,
                    duration: 200,
                    onComplete: () => {
                        messageText.destroy();
                    }
                });
            }
        });
        
        return messageText;
    }

    /**
     * 레벨업 이펙트
     * @param {number} x - X 좌표
     * @param {number} y - Y 좌표
     */
    showLevelUpEffect(x, y) {
        // 레벨업 텍스트
        const levelUpText = this.scene.add.text(x, y - 50, 'LEVEL UP!', {
            fontSize: '24px',
            fill: '#ffff00',
            fontStyle: 'bold'
        }).setOrigin(0.5);
        
        // 레벨업 이펙트 링
        const ring = this.scene.add.circle(x, y, 20, 0xffff00, 0);
        ring.setStrokeStyle(3, 0xffff00);
        
        // 링 확장 애니메이션
        this.scene.tweens.add({
            targets: ring,
            scaleX: 3,
            scaleY: 3,
            alpha: 0,
            duration: 1000,
            onComplete: () => {
                ring.destroy();
            }
        });
        
        // 텍스트 애니메이션
        this.scene.tweens.add({
            targets: levelUpText,
            y: levelUpText.y - 30,
            alpha: 0,
            duration: 2000,
            onComplete: () => {
                levelUpText.destroy();
            }
        });
        
        return { text: levelUpText, ring: ring };
    }

    /**
     * 원형 범위 이펙트
     * @param {number} x - X 좌표
     * @param {number} y - Y 좌표
     * @param {number} radius - 반지름
     * @param {number} color - 색상
     * @param {number} duration - 지속시간 (ms)
     */
    showCircleEffect(x, y, radius, color = 0x00ff00, duration = 300) {
        const circle = this.scene.add.circle(x, y, radius, color, 0.3);
        
        this.scene.time.delayedCall(duration, () => {
            this.scene.tweens.add({
                targets: circle,
                alpha: 0,
                duration: 200,
                onComplete: () => {
                    circle.destroy();
                }
            });
        });
        
        return circle;
    }

    /**
     * 폭발 이펙트
     * @param {number} x - X 좌표
     * @param {number} y - Y 좌표
     * @param {number} color - 색상
     * @param {number} size - 크기
     */
    showExplosion(x, y, color = 0xff00ff, size = 20) {
        const explosion = this.scene.add.circle(x, y, size, color, 0.8);
        
        this.scene.tweens.add({
            targets: explosion,
            scaleX: 2,
            scaleY: 2,
            alpha: 0,
            duration: 300,
            onComplete: () => {
                explosion.destroy();
            }
        });
        
        return explosion;
    }

    /**
     * 상태 변화 이펙트 (틴트 변경)
     * @param {Phaser.GameObjects.Sprite} target - 대상 객체
     * @param {number} color - 틴트 색상
     * @param {number} duration - 지속시간 (ms)
     */
    showStatusEffect(target, color, duration = 1000) {
        target.setTint(color);
        
        this.scene.time.delayedCall(duration, () => {
            if (target.active) {
                target.clearTint();
            }
        });
    }

    /**
     * 깜빡이는 이펙트
     * @param {Phaser.GameObjects.Sprite} target - 대상 객체
     * @param {number} duration - 지속시간 (ms)
     * @param {number} interval - 깜빡이는 간격 (ms)
     */
    showBlinkEffect(target, duration = 1000, interval = 200) {
        const blinkEvent = this.scene.time.addEvent({
            delay: interval,
            callback: () => {
                if (target.active) {
                    target.alpha = target.alpha === 1 ? 0.3 : 1;
                }
            },
            loop: true
        });
        
        this.scene.time.delayedCall(duration, () => {
            blinkEvent.destroy();
            if (target.active) {
                target.alpha = 1;
            }
        });
        
        return blinkEvent;
    }

    /**
     * 움직이는 텍스트 (플레이어 따라다니기)
     * @param {Phaser.GameObjects.Sprite} target - 따라다닐 대상
     * @param {string} message - 메시지
     * @param {Object} style - 스타일
     * @param {number} duration - 지속시간 (ms)
     * @param {number} offsetY - Y 오프셋
     */
    showFollowingText(target, message, style = {}, duration = 500, offsetY = -60) {
        const defaultStyle = {
            fontSize: '16px',
            fill: '#ffffff',
            fontStyle: 'bold'
        };
        
        const finalStyle = { ...defaultStyle, ...style };
        
        const text = this.scene.add.text(target.x, target.y + offsetY, message, finalStyle).setOrigin(0.5);
        
        // 텍스트가 대상을 따라다니도록 업데이트
        const updatePosition = () => {
            if (text.active && target.active) {
                text.setPosition(target.x, target.y + offsetY);
            }
        };
        
        const positionTimer = this.scene.time.addEvent({
            delay: 16, // 약 60fps
            callback: updatePosition,
            loop: true
        });
        
        // 지정된 시간 후 제거
        this.scene.time.delayedCall(duration, () => {
            if (positionTimer) {
                positionTimer.destroy();
            }
            if (text.active) {
                text.destroy();
            }
        });
        
        return { text, timer: positionTimer };
    }
} 