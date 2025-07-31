/**
 * 핑 관리 매니저
 * 핑 생성, 표시, 화살표 관리를 담당합니다.
 */
export default class PingManager {
    constructor(scene) {
        this.scene = scene;
        
        // 핑 관련 변수들
        this.pings = this.scene.add.group();
        this.pingMessageText = null;
        this.pingCooldown = 0;
        this.pingCooldownTime = 1000; // 1초 쿨다운
        
        // 핑 화살표 추적
        this.activePingArrows = new Map();
        this.activePingPositions = new Map();
        
        this.setupPingInput();
    }

    /**
     * 핑 입력 설정
     */
    setupPingInput() {
        // 마우스휠 클릭으로 핑
        this.scene.input.on('pointerdown', (pointer) => {
            if (pointer.button === 1) { // 마우스 휠 클릭 (중간 버튼)
                this.sendPingAtPosition(pointer.worldX, pointer.worldY);
            }
        });
    }

    /**
     * 핑 생성
     */
    createPing(x, y, playerId, nickname = null) {
        // 시야 안에 있는 핑만 메인 화면에 표시
        const isInVision = this.scene.visionManager.isInVision(x, y);
        
        if (isInVision) {
            // 핑 이펙트 생성
            const ping = this.scene.add.circle(x, y, 20, 0xff0000, 1.0);
            ping.setStrokeStyle(2, 0xffffff);
            
            // 핑 애니메이션 (4초 지속)
            this.scene.tweens.add({
                targets: ping,
                scaleX: 3,
                scaleY: 3,
                alpha: 0,
                duration: 4000,
                ease: 'Power2',
                onComplete: () => {
                    ping.destroy();
                }
            });

            // 핑 텍스트 (닉네임이 있으면 닉네임, 없으면 PING)
            const displayText = nickname || 'PING';
            const pingText = this.scene.add.text(x, y - 30, displayText, {
                fontSize: '12px',
                fill: '#ffffff',
                stroke: '#000000',
                strokeThickness: 2
            }).setOrigin(0.5);

            this.scene.tweens.add({
                targets: pingText,
                y: '-=20',
                alpha: 0,
                duration: 4000,
                ease: 'Power2',
                onComplete: () => {
                    pingText.destroy();
                }
            });
        }

        // 미니맵에 핑 표시
        this.createMinimapPingArrow(x, y, 'local-ping');
        
        // 빅맵이 표시 중이면 빅맵도 업데이트
        if (this.scene.minimapManager && this.scene.minimapManager.bigMapVisible) {
            this.scene.minimapManager.drawBigMap();
        }
    }

    /**
     * 핑 메시지 표시
     */
    showPingMessage(message) {
        // 기존 메시지 제거
        if (this.pingMessageText) {
            this.pingMessageText.destroy();
        }

        // 새 메시지 생성 (좌측 하단)
        this.pingMessageText = this.scene.add.text(20, this.scene.scale.height - 60, message, {
            fontSize: '16px',
            fill: '#ffffff',
            stroke: '#000000',
            strokeThickness: 2,
            backgroundColor: '#ff0000',
            padding: { x: 10, y: 5 }
        }).setScrollFactor(0);

        // 3초 후 메시지 제거
        this.scene.time.delayedCall(3000, () => {
            if (this.pingMessageText) {
                this.pingMessageText.destroy();
                this.pingMessageText = null;
            }
        });
    }

    /**
     * 플레이어 위치에 핑 전송
     */
    sendPing() {
        if (this.scene.player) {
            this.sendPingAtPosition(this.scene.player.x, this.scene.player.y);
        }
    }

    /**
     * 지정된 위치에 핑 전송
     */
    sendPingAtPosition(x, y) {
        const currentTime = Date.now();
        if (currentTime - this.pingCooldown < this.pingCooldownTime) {
            // 쿨다운 중
            const remainingTime = Math.ceil((this.pingCooldownTime - (currentTime - this.pingCooldown)) / 1000);
            this.showPingMessage(`핑 쿨다운: ${remainingTime}초`);
            return;
        }

        // 핑 전송
        this.scene.networkManager.sendPing(x, y);
        this.pingCooldown = currentTime;
        
        // 로컬 핑 표시
        this.createPing(x, y, this.scene.networkManager.playerId, this.scene.playerNickname);
        this.showPingMessage('핑을 찍었습니다!');
    }

    /**
     * 핑 화살표 확인 및 표시
     */
    checkAndShowPingArrow(pingX, pingY, pingId, nickname = null) {
        const cam = this.scene.cameras.main;
        const screenWidth = this.scene.scale.width;
        const screenHeight = this.scene.scale.height;
        
        // 화면 좌표로 변환
        const screenX = pingX - cam.scrollX;
        const screenY = pingY - cam.scrollY;
        
        // 화면 밖에 있는지 확인
        const margin = 20;
        const isOffScreen = screenX < margin || screenX > screenWidth - margin || 
                           screenY < margin || screenY > screenHeight - margin;
        
        // 시야 안에 있는지 확인
        const isInVision = this.scene.visionManager.isInVision(pingX, pingY);
        
        // 화면 밖이거나 시야 밖이면 화살표 표시
        if (isOffScreen || !isInVision) {
            this.createPingArrow(pingX, pingY, pingId, nickname);
        }
    }

    /**
     * 핑 화살표 생성
     */
    createPingArrow(pingX, pingY, pingId, nickname = null) {
        const cam = this.scene.cameras.main;
        const screenWidth = this.scene.scale.width;
        const screenHeight = this.scene.scale.height;
        
        // 화면 좌표로 변환
        const screenX = pingX - cam.scrollX;
        const screenY = pingY - cam.scrollY;
        
        // 화면 경계 내에서 화살표 위치 계산
        const margin = 5;
        let arrowX = Math.max(margin, Math.min(screenWidth - margin, screenX));
        let arrowY = Math.max(margin, Math.min(screenHeight - margin, screenY));
        
        // 화살표 방향 계산
        const angle = Phaser.Math.Angle.Between(arrowX, arrowY, screenX, screenY);
        
        // 화살표 이미지 생성
        const arrow = this.scene.add.image(arrowX, arrowY, 'ping_arrow');
        arrow.setScrollFactor(0);
        arrow.setDepth(1001);
        arrow.setScale(0.5);
        arrow.setRotation(angle);
        
        // 닉네임 텍스트 생성 (화살표 위에 표시)
        let nicknameText = null;
        if (nickname) {
            nicknameText = this.scene.add.text(arrowX, arrowY - 25, nickname, {
                fontSize: '12px',
                fill: '#ffffff',
                stroke: '#000000',
                strokeThickness: 2
            }).setOrigin(0.5).setScrollFactor(0).setDepth(1002);
        }
        
        // 화살표 객체를 Map에 저장
        this.activePingArrows.set(pingId, {
            arrow: arrow,
            nicknameText: nicknameText,
            pingX: pingX,
            pingY: pingY,
            nickname: nickname,
            startTime: Date.now()
        });
        
        // 화살표 애니메이션 (3초 지속)
        this.scene.tweens.add({
            targets: arrow,
            alpha: 0,
            duration: 3000,
            ease: 'Power2',
            onComplete: () => {
                arrow.destroy();
                this.activePingArrows.delete(pingId);
                this.activePingPositions.delete(pingId);
            }
        });
        
        // 닉네임 텍스트는 2초 후 사라지도록 설정
        if (nicknameText) {
            this.scene.tweens.add({
                targets: nicknameText,
                alpha: 0,
                duration: 2000,
                ease: 'Power2',
                onComplete: () => {
                    if (nicknameText) {
                        nicknameText.destroy();
                    }
                }
            });
        }
        
        // 미니맵에 핑 표시
        this.createMinimapPingArrow(pingX, pingY, pingId);
        
        // 빅맵이 표시 중이면 빅맵도 업데이트
        if (this.scene.minimapManager && this.scene.minimapManager.bigMapVisible) {
            this.scene.minimapManager.drawBigMap();
        }
    }

    /**
     * 미니맵 핑 화살표 생성
     */
    createMinimapPingArrow(pingX, pingY, pingId) {
        const scale = this.scene.minimapManager.minimapScale;
        const offsetX = this.scene.player.x - (this.scene.minimapManager.minimapSize / 2) / scale;
        const offsetY = this.scene.player.y - (this.scene.minimapManager.minimapSize / 2) / scale;
        
        const minimapX = (pingX - offsetX) * scale;
        const minimapY = (pingY - offsetY) * scale;
        
        // 미니맵 경계 margin
        const margin = 5;
        const isInsideMinimap = minimapX >= margin && minimapX <= this.scene.minimapManager.minimapSize - margin &&
                               minimapY >= margin && minimapY <= this.scene.minimapManager.minimapSize - margin;
        const isOutsideMinimap = minimapX < 0 || minimapX > this.scene.minimapManager.minimapSize || 
                                 minimapY < 0 || minimapY > this.scene.minimapManager.minimapSize;
        
        if (!isInsideMinimap || isOutsideMinimap) {
            // 미니맵 경계에 화살표 위치 고정
            let arrowX = Math.max(margin, Math.min(this.scene.minimapManager.minimapSize - margin, minimapX));
            let arrowY = Math.max(margin, Math.min(this.scene.minimapManager.minimapSize - margin, minimapY));
            
            // 화살표 방향 계산
            const angle = Phaser.Math.Angle.Between(arrowX, arrowY, minimapX, minimapY);
            
            // 화살표 생성
            const minimapArrow = this.scene.add.image(
                this.scene.minimapManager.minimap.x + arrowX, 
                this.scene.minimapManager.minimap.y + arrowY, 
                'ping_arrow'
            );
            minimapArrow.setScrollFactor(0);
            minimapArrow.setDepth(1003);
            minimapArrow.pingWorldX = pingX;
            minimapArrow.pingWorldY = pingY;
            minimapArrow.setScale(0.2);
            minimapArrow.setRotation(angle);
            
            // 화살표 애니메이션 (3초)
            this.scene.tweens.add({
                targets: minimapArrow,
                alpha: 0,
                duration: 3000,
                ease: 'Power2',
                onComplete: () => {
                    minimapArrow.destroy();
                }
            });
        } else {
            // 미니맵 내부면 점으로 표시
            const minimapDot = this.scene.add.circle(
                this.scene.minimapManager.minimap.x + minimapX,
                this.scene.minimapManager.minimap.y + minimapY,
                2,
                0xff0000,
                1.0
            );
            minimapDot.setScrollFactor(0);
            minimapDot.setDepth(1003);
            minimapDot.pingWorldX = pingX;
            minimapDot.pingWorldY = pingY;
            
            // 점 애니메이션 (3초)
            this.scene.tweens.add({
                targets: minimapDot,
                scaleX: 2,
                scaleY: 2,
                alpha: 0,
                duration: 3000,
                ease: 'Power2',
                onComplete: () => {
                    minimapDot.destroy();
                }
            });
        }
    }

    /**
     * 활성 핑 화살표들의 방향 실시간 업데이트
     */
    updatePingArrows() {
        if (!this.scene.player || this.activePingArrows.size === 0) {
            return;
        }

        const cam = this.scene.cameras.main;
        const screenWidth = this.scene.scale.width;
        const screenHeight = this.scene.scale.height;
        const margin = 120;

        // 각 활성 핑 화살표 업데이트
        for (const [pingId, arrowData] of this.activePingArrows) {
            const { arrow, nicknameText, pingX, pingY } = arrowData;
            
            // 화면 좌표로 변환
            const screenX = pingX - cam.scrollX;
            const screenY = pingY - cam.scrollY;
            
            // 화면 밖에 있는지 확인
            const isOffScreen = screenX < margin || screenX > screenWidth - margin || 
                               screenY < margin || screenY > screenHeight - margin;
            
            // 시야 밖에 있는지 확인
            const isOutOfVision = !this.scene.visionManager.isInVision(pingX, pingY);
            
            // 화면 밖이거나 시야 밖이면 화살표 표시
            if (isOffScreen || isOutOfVision) {
                // 화살표를 화면 경계 내로 이동
                let arrowX = Math.max(margin, Math.min(screenWidth - margin, screenX));
                let arrowY = Math.max(margin, Math.min(screenHeight - margin, screenY));
                
                // 화살표 위치 업데이트
                arrow.setPosition(arrowX, arrowY);
                
                // 닉네임 텍스트 위치 업데이트
                if (nicknameText) {
                    nicknameText.setPosition(arrowX, arrowY - 25);
                    nicknameText.setVisible(true);
                }
                
                // 화살표 방향 재계산
                const angle = Phaser.Math.Angle.Between(arrowX, arrowY, screenX, screenY);
                arrow.setRotation(angle);
                
                // 화살표가 보이도록 설정
                arrow.setVisible(true);
            } else {
                // 화면 안에 있으면 화살표와 닉네임 숨김
                arrow.setVisible(false);
                if (nicknameText) {
                    nicknameText.setVisible(false);
                }
            }
        }
    }

    /**
     * 미니맵 핑 점들의 위치 업데이트
     */
    updateMinimapPingPositions() {
        if (!this.scene.player || !this.scene.minimapManager) return;
        
        const scale = this.scene.minimapManager.minimapScale;
        const offsetX = this.scene.player.x - (this.scene.minimapManager.minimapSize / 2) / scale;
        const offsetY = this.scene.player.y - (this.scene.minimapManager.minimapSize / 2) / scale;
        
        // 모든 핑 점들과 화살표들을 찾아서 위치 업데이트
        this.scene.children.list.forEach(child => {
            if (child.pingWorldX !== undefined && child.pingWorldY !== undefined) {
                // 핑의 절대 위치를 미니맵 좌표로 변환
                const minimapX = (child.pingWorldX - offsetX) * scale;
                const minimapY = (child.pingWorldY - offsetY) * scale;
                
                // 미니맵 위치 업데이트 (경계 내로 제한)
                const clampedX = Math.max(0, Math.min(this.scene.minimapManager.minimapSize, minimapX));
                const clampedY = Math.max(0, Math.min(this.scene.minimapManager.minimapSize, minimapY));
                child.setPosition(
                    this.scene.minimapManager.minimap.x + clampedX, 
                    this.scene.minimapManager.minimap.y + clampedY
                );
                
                // 화살표인 경우 방향도 업데이트
                if (child.texture && child.texture.key === 'ping_arrow') {
                    const margin = 5;
                    const isOutsideMinimap = minimapX < 0 || minimapX > this.scene.minimapManager.minimapSize || 
                                            minimapY < 0 || minimapY > this.scene.minimapManager.minimapSize;
                    
                    if (isOutsideMinimap) {
                        const angle = Phaser.Math.Angle.Between(clampedX, clampedY, minimapX, minimapY);
                        child.setRotation(angle);
                        child.setVisible(true);
                    } else {
                        child.setVisible(false);
                    }
                }
            }
        });
    }

    /**
     * 정리 작업
     */
    destroy() {
        if (this.pings && this.pings.active) {
            try {
                this.pings.clear(true, true);
            } catch (e) {
                console.warn('핑 제거 중 오류:', e);
            }
        }
        
        if (this.pingMessageText) {
            this.pingMessageText.destroy();
        }
        
        // 활성 핑 화살표들의 닉네임 텍스트 정리
        for (const [pingId, arrowData] of this.activePingArrows) {
            if (arrowData.nicknameText) {
                arrowData.nicknameText.destroy();
            }
        }
        
        // 빅맵 닉네임 텍스트들 정리
        this.scene.children.list.forEach(child => {
            if (child.bigMapNicknameId) {
                child.destroy();
            }
        });
        
        if (this.activePingArrows) {
            this.activePingArrows.clear();
        }
        if (this.activePingPositions) {
            this.activePingPositions.clear();
        }
    }
} 