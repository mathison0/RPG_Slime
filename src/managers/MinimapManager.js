/**
 * 미니맵 관리 매니저
 * 미니맵, 빅맵, 시야 탐색 등을 담당합니다.
 */
export default class MinimapManager {
    constructor(scene) {
        this.scene = scene;
        
        // 미니맵 설정
        this.minimapSize = 200;
        this.minimapViewSize = 1000;
        this.minimapScale = this.minimapSize / this.minimapViewSize;
        
        // 빅맵 설정
        this.bigMapSize = 800;
        this.bigMapScale = 0;
        
        // 맵 그리드
        this.mapCols = 0;
        this.mapRows = 0;
        
        // 방문 지역 데이터
        this.discovered = null;
        
        // UI 요소들
        this.minimap = null;
        this.bigMap = null;
        this.mapToggleKey = null;
        this.bigMapVisible = false;
        
        this.initMinimap();
    }

    /**
     * 미니맵 초기화
     */
    initMinimap() {
        this.minimap = this.scene.add.graphics();
        this.minimap.setScrollFactor(0);
        this.minimap.setDepth(1002);
        this.positionMinimap();

        this.bigMap = this.scene.add.graphics();
        this.bigMap.setScrollFactor(0);
        this.bigMap.setDepth(1001);
        this.bigMap.setVisible(false);
        this.bigMap.setPosition(
            (this.scene.scale.width - this.bigMapSize) / 2, 
            (this.scene.scale.height - this.bigMapSize) / 2
        );

        this.mapToggleKey = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.M);
    }

    /**
     * 미니맵 재초기화
     */
    reinitializeMinimap(isNewSession = false, playerTeam = null) {
        console.log('미니맵 재초기화 시작');
        
        // 미니맵 크기 관련 변수들 재계산
        this.mapCols = Math.ceil(this.scene.MAP_WIDTH / this.scene.TILE_SIZE);
        this.mapRows = Math.ceil(this.scene.MAP_HEIGHT / this.scene.TILE_SIZE);
        
        console.log(`미니맵 그리드 크기: ${this.mapCols} x ${this.mapRows}`);
        
        // 방문 지역 데이터 처리
        if (isNewSession || !this.discovered) {
            this.initializeDiscoveredData(playerTeam);
        } else {
            if (this.discovered.length !== this.mapRows || 
                (this.discovered[0] && this.discovered[0].length !== this.mapCols)) {
                console.log('맵 크기 변경으로 인한 방문 지역 데이터 재초기화');
                this.initializeDiscoveredData(playerTeam);
            } else {
                console.log('기존 방문 지역 데이터 유지');
            }
        }
        
        // 스케일 재계산
        this.minimapScale = this.minimapSize / this.minimapViewSize;
        this.bigMapScale = this.bigMapSize / this.scene.MAP_WIDTH;
        
        console.log('미니맵 재초기화 완료');
    }

    /**
     * 방문 지역 데이터 초기화
     */
    initializeDiscoveredData(playerTeam = null) {
        this.discovered = Array.from({ length: this.mapRows }, () => Array(this.mapCols).fill(false));
        
        // 시작 스폰 지역은 기본으로 공개
        const spawnCols = Math.ceil(this.scene.SPAWN_WIDTH / this.scene.TILE_SIZE);
        for (let y = 0; y < this.mapRows; y++) {
            if (playerTeam === 'red') {
                for (let x = 0; x < spawnCols + 2; x++) this.discovered[y][x] = true;
            } else if (playerTeam === 'blue') {
                for (let x = this.mapCols - spawnCols - 2; x < this.mapCols; x++) this.discovered[y][x] = true;
            } else {
                for (let x = 0; x < spawnCols + 2; x++) this.discovered[y][x] = true;
                for (let x = this.mapCols - spawnCols - 2; x < this.mapCols; x++) this.discovered[y][x] = true;
            }
        }
        
        console.log('세션 기반 방문 지역 데이터 초기화 완료');
    }

    /**
     * 미니맵 위치 설정
     */
    positionMinimap() {
        if (!this.minimap) return;
        const cam = this.scene.cameras.main;
        this.minimap.setPosition(
            cam.width - this.minimapSize - 10,
            65
        );
    }

    /**
     * 미니맵 시야 업데이트
     */
    updateMinimapVision() {
        if (!this.scene.player || !this.discovered) return;
        
        const radius = this.scene.player.minimapVisionRange;
        const startCol = Math.max(0, Math.floor((this.scene.player.x - radius) / this.scene.TILE_SIZE));
        const endCol = Math.min(this.mapCols - 1, Math.floor((this.scene.player.x + radius) / this.scene.TILE_SIZE));
        const startRow = Math.max(0, Math.floor((this.scene.player.y - radius) / this.scene.TILE_SIZE));
        const endRow = Math.min(this.mapRows - 1, Math.floor((this.scene.player.y + radius) / this.scene.TILE_SIZE));

        const radiusSq = radius * radius;
        for (let row = startRow; row <= endRow; row++) {
            for (let col = startCol; col <= endCol; col++) {
                if (this.discovered[row] && !this.discovered[row][col]) {
                    const cellCenterX = col * this.scene.TILE_SIZE + this.scene.TILE_SIZE / 2;
                    const cellCenterY = row * this.scene.TILE_SIZE + this.scene.TILE_SIZE / 2;
                    const dx = cellCenterX - this.scene.player.x;
                    const dy = cellCenterY - this.scene.player.y;
                    if (dx * dx + dy * dy <= radiusSq) {
                        this.discovered[row][col] = true;
                    }
                }
            }
        }
    }

    /**
     * 미니맵 업데이트
     */
    updateMinimap() {
        if (!this.scene.player || !this.minimap || !this.discovered || !this.scene.walls) return;
    
        const size = this.minimapSize;
        const scale = this.minimapScale;
        
        this.positionMinimap();
        this.minimap.clear();
        
        // 배경
        this.minimap.fillStyle(0x000000, 0.8);
        this.minimap.fillRect(0, 0, size, size);
    
        // 플레이어 중심 좌표 계산
        const offsetX = this.scene.player.x - (size / 2) / scale;
        const offsetY = this.scene.player.y - (size / 2) / scale;
    
        // 클리핑 헬퍼 함수들
        const minimapBounds = new Phaser.Geom.Rectangle(0, 0, size, size);
        
        const drawClippedRect = (rect, color, alpha) => {
            const zoneInMinimap = new Phaser.Geom.Rectangle(
                (rect.x - offsetX) * scale,
                (rect.y - offsetY) * scale,
                rect.width * scale,
                rect.height * scale
            );
            const intersection = Phaser.Geom.Rectangle.Intersection(minimapBounds, zoneInMinimap);
            
            if (!intersection.isEmpty()) {
                this.minimap.fillStyle(color, alpha);
                this.minimap.fillRect(intersection.x, intersection.y, intersection.width, intersection.height);
            }
        };
        
        const drawDiscoveredRect = (rect, color, alpha) => {
            const startCol = Math.max(0, Math.floor(rect.x / this.scene.TILE_SIZE));
            const endCol = Math.min(this.mapCols - 1, Math.floor((rect.x + rect.width) / this.scene.TILE_SIZE));
            const startRow = Math.max(0, Math.floor(rect.y / this.scene.TILE_SIZE));
            const endRow = Math.min(this.mapRows - 1, Math.floor((rect.y + rect.height) / this.scene.TILE_SIZE));
            
            for (let y = startRow; y <= endRow; y++) {
                for (let x = startCol; x <= endCol; x++) {
                    if (this.discovered[y] && this.discovered[y][x]) {
                        const tileWorldRect = new Phaser.Geom.Rectangle(
                            x * this.scene.TILE_SIZE, 
                            y * this.scene.TILE_SIZE, 
                            this.scene.TILE_SIZE, 
                            this.scene.TILE_SIZE
                        );
                        const intersection = Phaser.Geom.Rectangle.Intersection(rect, tileWorldRect);
                        if (!intersection.isEmpty()) {
                            drawClippedRect(intersection, color, alpha);
                        }
                    }
                }
            }
        };
    
        // 발견된 타일 그리기
        const startCol = Math.max(0, Math.floor(offsetX / this.scene.TILE_SIZE));
        const endCol = Math.min(this.mapCols - 1, Math.ceil((offsetX + this.minimapViewSize) / this.scene.TILE_SIZE));
        const startRow = Math.max(0, Math.floor(offsetY / this.scene.TILE_SIZE));
        const endRow = Math.min(this.mapRows - 1, Math.ceil((offsetY + this.minimapViewSize) / this.scene.TILE_SIZE));
    
        for (let y = startRow; y <= endRow; y++) {
            for (let x = startCol; x <= endCol; x++) {
                if (this.discovered[y][x]) {
                    const tileWorldRect = new Phaser.Geom.Rectangle(
                        x * this.scene.TILE_SIZE, 
                        y * this.scene.TILE_SIZE, 
                        this.scene.TILE_SIZE, 
                        this.scene.TILE_SIZE
                    );
                    drawClippedRect(tileWorldRect, 0x333333, 0.8);
                }
            }
        }
    
        // 특별 구역 그리기
        if (this.scene.redSpawnRect) {
            drawDiscoveredRect(this.scene.redSpawnRect, 0xff0000, 0.25);
        }
        if (this.scene.blueSpawnRect) {
            drawDiscoveredRect(this.scene.blueSpawnRect, 0x0000ff, 0.25);
        }
        if (this.scene.plazaRect) {
            drawDiscoveredRect(this.scene.plazaRect, 0xffff00, 0.15);
        }
    
        // 벽 그리기
        this.scene.walls.getChildren().forEach(wall => {
            const col = Math.floor(wall.x / this.scene.TILE_SIZE);
            const row = Math.floor(wall.y / this.scene.TILE_SIZE);
            
            if (this.discovered[row] && this.discovered[row][col]) {
                const wallWorldRect = new Phaser.Geom.Rectangle(
                    wall.x - this.scene.TILE_SIZE / 2, 
                    wall.y - this.scene.TILE_SIZE / 2, 
                    this.scene.TILE_SIZE, 
                    this.scene.TILE_SIZE
                );
                drawClippedRect(wallWorldRect, 0x8b4513, 1.0);
            }
        });
    
        // 다른 플레이어들 그리기
        if (this.scene.otherPlayers?.children) {
            this.scene.otherPlayers.getChildren().forEach(otherPlayer => {
                const playerX = (otherPlayer.x - offsetX) * scale;
                const playerY = (otherPlayer.y - offsetY) * scale;
                
                if (playerX >= 0 && playerX <= size && playerY >= 0 && playerY <= size) {
                    if (otherPlayer.team === this.scene.player.team) {
                        this.minimap.fillStyle(0x00ff00);
                        this.minimap.fillCircle(playerX, playerY, 3);
                    } else {
                        if (otherPlayer.depth === 950) {
                            this.minimap.fillStyle(0xff0000);
                            this.minimap.fillCircle(playerX, playerY, 3);
                        }
                    }
                }
            });
        }
        
        // 내 플레이어 (중앙에 파란색)
        this.minimap.fillStyle(0x0099ff);
        this.minimap.fillCircle(size / 2, size / 2, 4);
    }

    /**
     * 빅맵 그리기
     */
    drawBigMap() {
        if (!this.scene.player || !this.bigMap || !this.discovered || !this.scene.walls) return;
        
        const size = this.bigMapSize;
        const scale = this.bigMapScale;
        this.bigMap.clear();

        this.bigMap.fillStyle(0x000000, 0.85);
        this.bigMap.fillRect(0, 0, size, size);

        this.bigMap.fillStyle(0x333333, 0.85);
        const tileW = this.scene.TILE_SIZE * scale;
        const tileH = this.scene.TILE_SIZE * scale;
        
        for (let y = 0; y < this.mapRows; y++) {
            for (let x = 0; x < this.mapCols; x++) {
                if (this.discovered[y][x]) {
                    this.bigMap.fillRect(x * tileW, y * tileH, tileW, tileH);
                }
            }
        }
        
        // 특별 구역을 시야가 있는 지역에서만 그리기
        this.drawBigMapZone(this.scene.redSpawnRect, 0xff0000, 0.25, scale);
        this.drawBigMapZone(this.scene.blueSpawnRect, 0x0000ff, 0.25, scale);
        this.drawBigMapZone(this.scene.plazaRect, 0xffff00, 0.15, scale);

        this.bigMap.fillStyle(0x8b4513);
        this.scene.walls.getChildren().forEach(wall => {
            const col = Math.floor(wall.x / this.scene.TILE_SIZE);
            const row = Math.floor(wall.y / this.scene.TILE_SIZE);
            if (this.discovered[row] && this.discovered[row][col]) {
                const x = (wall.x - this.scene.TILE_SIZE / 2) * scale;
                const y = (wall.y - this.scene.TILE_SIZE / 2) * scale;
                this.bigMap.fillRect(x, y, this.scene.TILE_SIZE * scale, this.scene.TILE_SIZE * scale);
            }
        });

        // 다른 플레이어들 그리기
        if (this.scene.otherPlayers?.children) {
            this.scene.otherPlayers.getChildren().forEach(otherPlayer => {
                const playerX = otherPlayer.x * scale;
                const playerY = otherPlayer.y * scale;
                
                if (playerX >= 0 && playerX <= size && playerY >= 0 && playerY <= size) {
                    if (otherPlayer.team === this.scene.player.team) {
                        this.bigMap.fillStyle(0x00ff00);
                        this.bigMap.fillCircle(playerX, playerY, 4);
                    } else {
                        if (otherPlayer.depth === 950) {
                            this.bigMap.fillStyle(0xff0000);
                            this.bigMap.fillCircle(playerX, playerY, 4);
                        }
                    }
                }
            });
        }
        
        // 내 플레이어
        this.bigMap.fillStyle(0x0099ff);
        this.bigMap.fillCircle(this.scene.player.x * scale, this.scene.player.y * scale, 5);
    }

    /**
     * 빅맵에서 시야가 있는 지역의 특별 구역만 그리기
     */
    drawBigMapZone(rect, color, alpha, scale) {
        if (!rect) return;
        
        const startCol = Math.max(0, Math.floor(rect.x / this.scene.TILE_SIZE));
        const endCol = Math.min(this.mapCols - 1, Math.floor((rect.x + rect.width) / this.scene.TILE_SIZE));
        const startRow = Math.max(0, Math.floor(rect.y / this.scene.TILE_SIZE));
        const endRow = Math.min(this.mapRows - 1, Math.floor((rect.y + rect.height) / this.scene.TILE_SIZE));
        
        this.bigMap.fillStyle(color, alpha);
        
        for (let y = startRow; y <= endRow; y++) {
            for (let x = startCol; x <= endCol; x++) {
                if (this.discovered[y] && this.discovered[y][x]) {
                    const tileWorldRect = new Phaser.Geom.Rectangle(
                        x * this.scene.TILE_SIZE, 
                        y * this.scene.TILE_SIZE, 
                        this.scene.TILE_SIZE, 
                        this.scene.TILE_SIZE
                    );
                    const intersection = Phaser.Geom.Rectangle.Intersection(rect, tileWorldRect);
                    if (!intersection.isEmpty()) {
                        this.bigMap.fillRect(
                            intersection.x * scale, 
                            intersection.y * scale, 
                            intersection.width * scale, 
                            intersection.height * scale
                        );
                    }
                }
            }
        }
    }

    /**
     * 맵 토글 처리
     */
    handleMapToggle() {
        if (this.mapToggleKey && Phaser.Input.Keyboard.JustDown(this.mapToggleKey)) {
            this.bigMapVisible = !this.bigMapVisible;
            this.bigMap.setVisible(this.bigMapVisible);
            this.minimap.setVisible(!this.bigMapVisible);
        }
    }

    /**
     * 와드로 탐지된 적들의 미니맵 위치 업데이트
     */
    updateWardDetectedEnemies() {
        if (!this.scene.player) return;
        
        const scale = this.minimapScale;
        const offsetX = this.scene.player.x - (this.minimapSize / 2) / scale;
        const offsetY = this.scene.player.y - (this.minimapSize / 2) / scale;
        
        // 모든 와드 수집
        const allWards = [];
        
        if (this.scene.activeWard) {
            allWards.push(this.scene.activeWard);
        }
        
        this.scene.children.list.forEach(child => {
            if (child.texture && child.texture.key === 'ward' && child.isOtherPlayerWard) {
                const wardOwner = this.scene.otherPlayers.getChildren().find(p => p.networkId === child.wardOwnerId);
                
                if (wardOwner && wardOwner.team === this.scene.player.team) {
                    allWards.push({ x: child.x, y: child.y, radius: 120 });
                }
            }
        });
        
        // 적 탐지 처리
        this.scene.enemies.getChildren().forEach(enemy => {
            if (!enemy.isDead) {
                let isDetectedByAnyWard = false;
                
                allWards.forEach(ward => {
                    const distance = Phaser.Math.Distance.Between(ward.x, ward.y, enemy.x, enemy.y);
                    if (distance <= ward.radius) {
                        isDetectedByAnyWard = true;
                    }
                });
                
                if (isDetectedByAnyWard) {
                    if (!enemy.wardDetected) {
                        enemy.wardDetected = true;
                        enemy.setTint(0xff0000);
                        enemy.setAlpha(0.8);
                        
                        if (!enemy.minimapIndicator) {
                            this.showEnemyOnMinimapForWard(enemy);
                        }
                    }
                } else {
                    if (enemy.wardDetected) {
                        enemy.wardDetected = false;
                        enemy.clearTint();
                        enemy.setAlpha(1.0);
                        
                        if (enemy.minimapIndicator) {
                            this.hideEnemyFromMinimapForWard(enemy);
                        }
                    }
                }
            }
        });
        
        // 미니맵 위치 업데이트
        this.scene.enemies.getChildren().forEach(enemy => {
            if (enemy.wardDetected && enemy.minimapIndicator) {
                const minimapX = (enemy.x - offsetX) * scale;
                const minimapY = (enemy.y - offsetY) * scale;
                
                const clampedX = Math.max(0, Math.min(this.minimapSize, minimapX));
                const clampedY = Math.max(0, Math.min(this.minimapSize, minimapY));
                
                enemy.minimapIndicator.setPosition(
                    this.minimap.x + clampedX, 
                    this.minimap.y + clampedY
                );
                
                if (minimapX < 0 || minimapX > this.minimapSize || 
                    minimapY < 0 || minimapY > this.minimapSize) {
                    enemy.minimapIndicator.setVisible(false);
                } else {
                    enemy.minimapIndicator.setVisible(true);
                }
            }
        });
    }

    /**
     * 와드용 미니맵 적 표시
     */
    showEnemyOnMinimapForWard(enemy) {
        if (enemy.minimapIndicator || !this.minimap) return;
        
        const scale = this.minimapScale;
        const offsetX = this.scene.player.x - (this.minimapSize / 2) / scale;
        const offsetY = this.scene.player.y - (this.minimapSize / 2) / scale;
        
        const minimapX = (enemy.x - offsetX) * scale;
        const minimapY = (enemy.y - offsetY) * scale;
        
        const clampedX = Math.max(0, Math.min(this.minimapSize, minimapX));
        const clampedY = Math.max(0, Math.min(this.minimapSize, minimapY));
        
        const minimapEnemy = this.scene.add.circle(
            this.minimap.x + clampedX,
            this.minimap.y + clampedY,
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
     * 와드용 미니맵 적 표시 제거
     */
    hideEnemyFromMinimapForWard(enemy) {
        if (enemy.minimapIndicator) {
            enemy.minimapIndicator.destroy();
            enemy.minimapIndicator = null;
        }
    }

    /**
     * 전체 맵 발견 처리 (치트)
     */
    revealEntireMap() {
        if (!this.discovered) return;
        
        console.log('치트: 전체 맵 발견 처리');
        
        for (let y = 0; y < this.mapRows; y++) {
            for (let x = 0; x < this.mapCols; x++) {
                if (this.discovered[y]) {
                    this.discovered[y][x] = true;
                }
            }
        }
        
        console.log(`전체 맵 공개 완료: ${this.mapCols} x ${this.mapRows} 타일`);
    }

    /**
     * UI 스케일 업데이트
     */
    updateUIScale(cameraZoom) {
        const inverseZoom = 1 / cameraZoom;
        
        if (this.minimap) {
            this.minimap.setScale(inverseZoom);
        }
        
        if (this.bigMap) {
            this.bigMap.setScale(inverseZoom);
        }
    }

    /**
     * 정리 작업
     */
    destroy() {
        if (this.minimap) {
            this.minimap.destroy();
        }
        if (this.bigMap) {
            this.bigMap.destroy();
        }
    }
} 