/**
 * 시야 관리 매니저
 * 플레이어 시야, 그림자, 가시성 처리를 담당합니다.
 */
export default class VisionManager {
    constructor(scene) {
        this.scene = scene;
        
        // 시야 텍스처
        this.baseVisionTexture = null;
        this.shadowVisionTexture = null;
        
        this.setupVisionTextures();
    }

    /**
     * 시야 텍스처 설정
     */
    setupVisionTextures() {
        // 1단계: 전체 화면을 덮는 기본 어둠 (시야 범위 밖)
        this.baseVisionTexture = this.scene.make.renderTexture({
            width: this.scene.scale.width,
            height: this.scene.scale.height
        }, false);
        this.baseVisionTexture.setDepth(980);
        this.baseVisionTexture.setOrigin(0, 0);
        this.baseVisionTexture.fill(0x000000, 1);
        this.baseVisionTexture.setScrollFactor(0);
        this.scene.add.existing(this.baseVisionTexture);

        // 2단계: 플레이어 시야 범위 내의 벽 그림자
        this.shadowVisionTexture = this.scene.make.renderTexture({
            width: this.scene.scale.width,
            height: this.scene.scale.height
        }, false);
        this.shadowVisionTexture.setDepth(700);
        this.shadowVisionTexture.setOrigin(0, 0);
        this.shadowVisionTexture.fill(0x000000, 0);
        this.shadowVisionTexture.setScrollFactor(0);
        this.scene.add.existing(this.shadowVisionTexture);
    }

    /**
     * 그래디언트 텍스처 생성
     */
    createGradientTexture() {
        const size = 512;
        const graphics = this.scene.make.graphics({ width: size, height: size, add: false });

        const radius = size / 2;
        graphics.fillGradientStyle(0xffffff, 0xffffff, 0x000000, 0x000000, 1, 1, 0, 0);

        graphics.beginPath();
        graphics.arc(radius, radius, radius, 0, 2 * Math.PI, false);
        graphics.closePath();
        graphics.fillPath();

        graphics.generateTexture('vision_gradient', size, size);
        graphics.destroy();
    }

    /**
     * 시야 업데이트
     */
    updateVision() {
        if (!this.scene.player || !this.scene.mapManager?.wallLines || !this.baseVisionTexture || !this.shadowVisionTexture) {
            return;
        }

        const playerPos = new Phaser.Math.Vector2(this.scene.player.x, this.scene.player.y);
        const visionRadius = this.scene.player.visionRange || 300;
        const cam = this.scene.cameras.main;

        // 시야 폴리곤 계산
        const endpoints = this.calculateVisionPolygon(playerPos, visionRadius);

        // 2단계 시야 시스템 구현
        this.renderBaseVision(playerPos, visionRadius, cam);
        this.renderShadowVision(playerPos, visionRadius, endpoints, cam);

        // 와드 시야 추가
        const wardVisionMask = this.scene.make.graphics({ add: false });
        this.addWardVisionToMask(wardVisionMask, cam);
        this.baseVisionTexture.erase(wardVisionMask);

        // 다른 플레이어들의 가시성 업데이트
        this.updateOtherPlayersDepth(playerPos, endpoints, visionRadius);
    }

    /**
     * 시야 폴리곤 계산
     */
    calculateVisionPolygon(playerPos, visionRadius) {
        const playerCircle = new Phaser.Geom.Circle(playerPos.x, playerPos.y, visionRadius);
        const nearbyWalls = this.scene.mapManager.wallLines.filter(line =>
            Phaser.Geom.Intersects.LineToCircle(line, playerCircle)
        );

        const rays = [];
        nearbyWalls.forEach(line => {
            [line.getPointA(), line.getPointB()].forEach(p => {
                const angle = Phaser.Math.Angle.BetweenPoints(playerPos, p);
                rays.push(angle - 0.0001, angle, angle + 0.0001);
            });
        });

        for (let i = 0; i < 360; i += 4) {
            rays.push(Phaser.Math.DegToRad(i));
        }
        rays.push(Phaser.Math.DegToRad(359.999999));

        const endpoints = [];
        rays.forEach(angle => {
            const rayLine = new Phaser.Geom.Line(
                playerPos.x,
                playerPos.y,
                playerPos.x + Math.cos(angle) * visionRadius,
                playerPos.y + Math.sin(angle) * visionRadius
            );

            let closestIntersection = null;
            let minDistanceSq = visionRadius * visionRadius;

            nearbyWalls.forEach(wallLine => {
                const intersectPoint = new Phaser.Geom.Point();
                if (Phaser.Geom.Intersects.LineToLine(rayLine, wallLine, intersectPoint)) {
                    const dSq = Phaser.Math.Distance.Squared(playerPos.x, playerPos.y, intersectPoint.x, intersectPoint.y);
                    if (dSq < minDistanceSq) {
                        minDistanceSq = dSq;
                        closestIntersection = intersectPoint;
                    }
                }
            });
            
            let finalPoint;
            if (closestIntersection) {
                finalPoint = new Phaser.Math.Vector2(closestIntersection.x, closestIntersection.y);
            } else {
                finalPoint = new Phaser.Math.Vector2(rayLine.x2, rayLine.y2);
            }
            endpoints.push(finalPoint);
        });

        // 각도별 정렬
        endpoints.sort(
            (a, b) => 
                Phaser.Math.Angle.Normalize(Phaser.Math.Angle.BetweenPoints(playerPos, a)) -
                Phaser.Math.Angle.Normalize(Phaser.Math.Angle.BetweenPoints(playerPos, b))
        );

        return endpoints;
    }

    /**
     * 기본 시야 렌더링
     */
    renderBaseVision(playerPos, visionRadius, cam) {
        this.baseVisionTexture.clear();
        this.baseVisionTexture.fill(0x000000, 1);
        
        const baseVisionMask = this.scene.make.graphics({ add: false });
        baseVisionMask.fillStyle(0xffffff);
        baseVisionMask.fillCircle(
            playerPos.x - cam.scrollX, 
            playerPos.y - cam.scrollY, 
            visionRadius
        );
        
        this.baseVisionTexture.erase(baseVisionMask);
        baseVisionMask.destroy();
    }

    /**
     * 그림자 시야 렌더링
     */
    renderShadowVision(playerPos, visionRadius, endpoints, cam) {
        this.shadowVisionTexture.clear();
        this.shadowVisionTexture.fill(0x000000, 0);
        
        // 시야 범위를 어둠으로 덮기
        const shadowMask = this.scene.make.graphics({ add: false });
        shadowMask.fillStyle(0x000000, 0.9);
        shadowMask.fillCircle(
            playerPos.x - cam.scrollX, 
            playerPos.y - cam.scrollY, 
            visionRadius
        );
        this.shadowVisionTexture.draw(shadowMask);
        
        // raycast로 보이는 부분 지우기
        const visionMaskGraphics = this.scene.make.graphics({ add: false });
        visionMaskGraphics.fillStyle(0xffffff);
        visionMaskGraphics.beginPath();
        visionMaskGraphics.moveTo(playerPos.x - cam.scrollX, playerPos.y - cam.scrollY);
        endpoints.forEach(p => {
            visionMaskGraphics.lineTo(p.x - cam.scrollX, p.y - cam.scrollY);
        });
        visionMaskGraphics.closePath();
        visionMaskGraphics.fillPath();

        this.shadowVisionTexture.erase(visionMaskGraphics);
    
        // 와드 범위 내 시야 확장
        this.addWardVisionToMask(visionMaskGraphics, cam);
        
        shadowMask.destroy();
        visionMaskGraphics.destroy();
    }

    /**
     * 와드 범위 내 시야를 마스크에 추가
     */
    addWardVisionToMask(visionMaskGraphics, cam) {
        visionMaskGraphics.fillStyle(0xffffff);
        
        // 로컬 와드들 (최대 2개)
        if (this.scene.wardList && this.scene.wardList.length > 0) {
            this.scene.wardList.forEach(ward => {
                visionMaskGraphics.fillCircle(ward.x - cam.scrollX, ward.y - cam.scrollY, ward.radius);
            });
        }
        
        // 다른 플레이어들의 와드들 (시야 효과는 같은 팀만)
        this.scene.children.list.forEach(child => {
            if (child.texture && child.texture.key === 'ward' && child.isOtherPlayerWard) {
                const wardOwner = this.scene.otherPlayers.getChildren().find(p => p.networkId === child.ownerId);
                
                if (wardOwner && wardOwner.team === this.scene.player.team) {
                    visionMaskGraphics.fillCircle(child.x - cam.scrollX, child.y - cam.scrollY, 120);
                }
            }
        });
    }

    /**
     * 다른 플레이어들과 와드들의 가시성 업데이트
     */
    updateOtherPlayersDepth(playerPos, endpoints, visionRadius) {
        if (!this.scene.otherPlayers?.children || !this.scene.mapManager.wallLines) {
            return;
        }
        
        // 다른 플레이어들의 가시성 업데이트
        this.scene.otherPlayers.getChildren().forEach(otherPlayer => {
            // 점프 중일 때는 점프 전 위치 기준
            let checkX, checkY;
            if (otherPlayer.isJumping && otherPlayer.preJumpPosition) {
                checkX = otherPlayer.preJumpPosition.x;
                checkY = otherPlayer.preJumpPosition.y;
            } else {
                checkX = otherPlayer.x;
                checkY = otherPlayer.y;
                if (!otherPlayer.preJumpPosition) {
                    otherPlayer.preJumpPosition = { x: checkX, y: checkY };
                } else {
                    otherPlayer.preJumpPosition.x = checkX;
                    otherPlayer.preJumpPosition.y = checkY;
                }
            }
            
            // 시야 범위 체크
            const distance = Phaser.Math.Distance.Between(playerPos.x, playerPos.y, checkX, checkY);
            if (distance > visionRadius) {
                if (otherPlayer.depth !== 650) {
                    this.setPlayerDepthWithNameTag(otherPlayer, 650, false);
                }
                return;
            }
            
            // 플레이어 바운딩 박스 체크
            const bounds = otherPlayer.getBounds();
            const playerSize = Math.max(bounds.width, bounds.height);
            const checkRadius = playerSize / 2;
            const adjustedRadius = checkRadius * 0.85;
            const diagonalRadius = adjustedRadius * 0.7;
            
            const checkPoints = [
                new Phaser.Math.Vector2(checkX, checkY),
                new Phaser.Math.Vector2(checkX, checkY - adjustedRadius),
                new Phaser.Math.Vector2(checkX, checkY + adjustedRadius),
                new Phaser.Math.Vector2(checkX - adjustedRadius, checkY),
                new Phaser.Math.Vector2(checkX + adjustedRadius, checkY),
                new Phaser.Math.Vector2(checkX - diagonalRadius, checkY - diagonalRadius),
                new Phaser.Math.Vector2(checkX + diagonalRadius, checkY - diagonalRadius),
                new Phaser.Math.Vector2(checkX - diagonalRadius, checkY + diagonalRadius),
                new Phaser.Math.Vector2(checkX + diagonalRadius, checkY + diagonalRadius)
            ];
            
            let visiblePointsCount = 0;
            checkPoints.forEach(point => {
                if (this.isPointVisibleFromPlayer(playerPos, point)) {
                    visiblePointsCount++;
                }
            });
            
            const allPointsVisible = visiblePointsCount === checkPoints.length;
            const targetDepth = allPointsVisible ? 950 : 650;
            
            if (otherPlayer.depth !== targetDepth) {
                this.setPlayerDepthWithNameTag(otherPlayer, targetDepth, allPointsVisible);
            }
        });
        
        // 다른 팀의 와드들의 가시성 업데이트
        this.scene.children.list.forEach(child => {
            if (child.texture && child.texture.key === 'ward' && child.isOtherPlayerWard) {
                const wardOwner = this.scene.otherPlayers.getChildren().find(p => p.networkId === child.ownerId);
                
                // 다른 팀의 와드만 처리
                if (wardOwner && wardOwner.team !== this.scene.player.team) {
                    // 시야 범위 체크
                    const distance = Phaser.Math.Distance.Between(playerPos.x, playerPos.y, child.x, child.y);
                    if (distance > visionRadius) {
                        // 시야 밖이면 숨김
                        if (child.visible) {
                            child.setVisible(false);
                            if (child.rangeIndicator) {
                                child.rangeIndicator.setVisible(false);
                            }
                        }
                        return;
                    }
                    
                    // 시야 범위 내에 있으면 가시성 체크
                    const isVisible = this.isPointVisibleFromPlayer(playerPos, new Phaser.Math.Vector2(child.x, child.y));
                    
                    if (isVisible) {
                        // 보이는 경우 표시
                        if (!child.visible) {
                            child.setVisible(true);
                            if (child.rangeIndicator) {
                                child.rangeIndicator.setVisible(true);
                            }
                        }
                    } else {
                        // 보이지 않는 경우 숨김
                        if (child.visible) {
                            child.setVisible(false);
                            if (child.rangeIndicator) {
                                child.rangeIndicator.setVisible(false);
                            }
                        }
                    }
                }
            }
        });
    }

    /**
     * 특정 지점이 플레이어로부터 보이는지 확인
     */
    isPointVisibleFromPlayer(playerPos, targetPoint) {
        const rayLine = new Phaser.Geom.Line(playerPos.x, playerPos.y, targetPoint.x, targetPoint.y);
        
        for (let wallLine of this.scene.mapManager.wallLines) {
            const intersectPoint = new Phaser.Geom.Point();
            if (Phaser.Geom.Intersects.LineToLine(rayLine, wallLine, intersectPoint)) {
                const distToPlayer = Phaser.Math.Distance.Between(playerPos.x, playerPos.y, intersectPoint.x, intersectPoint.y);
                const distToTarget = Phaser.Math.Distance.Between(playerPos.x, playerPos.y, targetPoint.x, targetPoint.y);
                
                if (distToPlayer < distToTarget - 5) {
                    return false;
                }
            }
        }
        
        return true;
    }

    /**
     * 플레이어 depth 설정 및 이름표 가시성 조정
     */
    setPlayerDepthWithNameTag(player, playerDepth, isFullyVisible) {
        player.setDepth(playerDepth);
        const nameTagDepth = playerDepth + 10; // 플레이어보다 약간 위에 표시
        
        if (player.nameText) {
            player.nameText.setDepth(nameTagDepth);
            
            const isEnemyTeam = this.scene.player && player.team !== this.scene.player.team;
            if (isEnemyTeam && !isFullyVisible) {
                player.nameText.setVisible(false);
            } else {
                player.nameText.setVisible(true);
            }
        }
        
        // 체력바도 이름표와 같은 depth로 설정
        if (player.healthBar && player.healthBar.container) {
            player.healthBar.container.setDepth(nameTagDepth);
        }
    }

    /**
     * 시야 판정 함수
     */
    isInVision(x, y) {
        if (!this.scene.player) return false;
        
        const distance = Phaser.Math.Distance.Between(this.scene.player.x, this.scene.player.y, x, y);
        const visionRadius = this.scene.player.visionRange || 300;
        
        return distance <= visionRadius;
    }

    /**
     * UI 스케일 업데이트
     */
    updateUIScale(cameraZoom) {
        const inverseZoom = 1 / cameraZoom;
        
        if (this.baseVisionTexture) {
            this.baseVisionTexture.setScale(inverseZoom);
        }
        if (this.shadowVisionTexture) {
            this.shadowVisionTexture.setScale(inverseZoom);
        }
    }

    /**
     * 정리 작업
     */
    destroy() {
        if (this.baseVisionTexture) {
            this.baseVisionTexture.destroy();
        }
        if (this.shadowVisionTexture) {
            this.shadowVisionTexture.destroy();
        }
    }
} 