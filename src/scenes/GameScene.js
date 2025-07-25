import Phaser from 'phaser';
import Player from '../entities/Player.js';
import Enemy from '../entities/Enemy.js';
import AssetLoader from '../utils/AssetLoader.js';
import NetworkManager from '../utils/NetworkManager.js';

export default class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameScene' });
    }

    preload() {
        console.log('GameScene preload() 시작');
        AssetLoader.preload(this);
        console.log('AssetLoader.preload() 완료');
    }
    
    create() {
        console.log('GameScene create() 시작');
        
        this.createGradientTexture();
        AssetLoader.createAnimations(this);
        this.createMaze();
        
        console.log('맵 생성 완료 (임시)');
        
        // 네트워크 매니저 초기화
        this.networkManager = new NetworkManager();
        this.otherPlayers = this.physics.add.group();
        this.enemies = this.physics.add.group();
        
        console.log('네트워크 매니저 초기화 완료');
        
        // 네트워크 이벤트 리스너 설정
        this.setupNetworkListeners();
        
        // 게임 입장 요청
        this.networkManager.joinGame();
        
        console.log('게임 입장 요청 완료');
        
        // 물리 충돌은 플레이어가 생성된 후에 설정
        // 충돌 객체들 초기화
        this.playerWallCollider = null;
        this.enemyWallCollider = null;
        this.otherPlayerWallCollider = null;
        this.playerEnemyCollider = null;

        // 점프 상태 추적을 위한 변수
        this.wasJumping = false;

        this.setupUI();

        // --- 시야 관련 로직 create 함수로 통합 ---
        // 화면 전체를 덮는 RenderTexture 생성
        this.visionTexture = this.make.renderTexture({
            width: this.scale.width,
            height: this.scale.height
        }, false);
        this.visionTexture.setDepth(999);
        this.visionTexture.setOrigin(0, 0);
        this.visionTexture.fill(0x000000, 0.95);
        this.visionTexture.setScrollFactor(0);
        this.add.existing(this.visionTexture);

        // 서버에서 적 관리하므로 클라이언트 스폰 타이머 제거
        
        // 초기 UI 스케일 설정
        this.updateUIScale(this.cameras.main.zoom);
    }
    
    // (createMaze, spawnEnemies 등 다른 함수는 그대로 유지)
    createMaze() {
        // 임시 맵 생성 (서버 연결 전까지 사용)
        console.log('임시 맵 생성 (서버에서 맵 데이터를 받기 전까지 사용)');
        this.createTemporaryMap();
    }
    
    createTemporaryMap() {
        const MAP_WIDTH = 3000;
        const MAP_HEIGHT = 3000;
        const TILE_SIZE = 50;
        const SPAWN_WIDTH = 300;
        
        this.MAP_WIDTH = MAP_WIDTH;
        this.MAP_HEIGHT = MAP_HEIGHT;
        this.TILE_SIZE = TILE_SIZE;
        this.SPAWN_WIDTH = SPAWN_WIDTH;

        this.physics.world.setBounds(0, 0, MAP_WIDTH, MAP_HEIGHT);
        this.walls = this.physics.add.staticGroup();
        
        // 기본 외벽만 생성
        for (let x = 0; x < MAP_WIDTH; x += TILE_SIZE) {
            this.walls.create(x + TILE_SIZE / 2, TILE_SIZE/2, 'wall').setSize(TILE_SIZE, TILE_SIZE).refreshBody();
            this.walls.create(x + TILE_SIZE / 2, MAP_HEIGHT - TILE_SIZE/2, 'wall').setSize(TILE_SIZE, TILE_SIZE).refreshBody();
        }
        for (let y = TILE_SIZE; y < MAP_HEIGHT - TILE_SIZE; y += TILE_SIZE) {
            this.walls.create(TILE_SIZE/2, y + TILE_SIZE/2, 'wall').setSize(TILE_SIZE, TILE_SIZE).refreshBody();
            this.walls.create(MAP_WIDTH - TILE_SIZE/2, y + TILE_SIZE/2, 'wall').setSize(TILE_SIZE, TILE_SIZE).refreshBody();
        }
        
        this.redSpawnRect = new Phaser.Geom.Rectangle(0, 0, SPAWN_WIDTH, MAP_HEIGHT);
        this.blueSpawnRect = new Phaser.Geom.Rectangle(MAP_WIDTH - SPAWN_WIDTH, 0, SPAWN_WIDTH, MAP_HEIGHT);
        
        this.wallLines = [];
    }
    
    recreateMapFromServer(mapData) {
        console.log('서버 맵 데이터로 맵 재생성:', mapData);
        
        // 기존 맵 제거
        if (this.walls) {
            this.walls.clear(true, true);
        }
        
        // 기존 스폰 구역 표시 제거
        this.children.list.forEach(child => {
            if (child.type === 'Rectangle' && child.depth === -1) {
                child.destroy();
            }
        });
        
        // 서버 맵 데이터 적용
        this.MAP_WIDTH = mapData.MAP_WIDTH;
        this.MAP_HEIGHT = mapData.MAP_HEIGHT;
        this.TILE_SIZE = mapData.TILE_SIZE;
        this.SPAWN_WIDTH = mapData.SPAWN_WIDTH;
        this.PLAZA_SIZE = mapData.PLAZA_SIZE;
        this.PLAZA_X = mapData.PLAZA_X;
        this.PLAZA_Y = mapData.PLAZA_Y;

        this.physics.world.setBounds(0, 0, this.MAP_WIDTH, this.MAP_HEIGHT);
        this.walls = this.physics.add.staticGroup();

        // 서버에서 받은 벽 데이터로 벽 생성
        mapData.walls.forEach(wallPos => {
            this.walls.create(wallPos.x, wallPos.y, 'wall').setSize(this.TILE_SIZE, this.TILE_SIZE).refreshBody();
        });

        // 스폰 및 광장 구역 시각화
        this.add.rectangle(this.SPAWN_WIDTH / 2, this.MAP_HEIGHT / 2, this.SPAWN_WIDTH, this.MAP_HEIGHT, 0xff0000, 0.25).setDepth(-1);
        this.add.rectangle(this.MAP_WIDTH - this.SPAWN_WIDTH / 2, this.MAP_HEIGHT / 2, this.SPAWN_WIDTH, this.MAP_HEIGHT, 0x0000ff, 0.25).setDepth(-1);
        
        this.plazaRect = new Phaser.Geom.Rectangle(this.PLAZA_X, this.PLAZA_Y, this.PLAZA_SIZE, this.PLAZA_SIZE);
        this.add.rectangle(this.plazaRect.centerX, this.plazaRect.centerY, this.PLAZA_SIZE, this.PLAZA_SIZE, 0xffff00, 0.15).setDepth(-1);
        
        this.redSpawnRect = new Phaser.Geom.Rectangle(mapData.redSpawnRect.x, mapData.redSpawnRect.y, mapData.redSpawnRect.width, mapData.redSpawnRect.height);
        this.blueSpawnRect = new Phaser.Geom.Rectangle(mapData.blueSpawnRect.x, mapData.blueSpawnRect.y, mapData.blueSpawnRect.width, mapData.blueSpawnRect.height);

        // 시야 계산을 위해 모든 벽의 선분 정보를 미리 추출
        this.wallLines = [];
        this.walls.getChildren().forEach(wall => {
            const bounds = wall.getBounds();
            this.wallLines.push(new Phaser.Geom.Line(bounds.left, bounds.top, bounds.right, bounds.top));
            this.wallLines.push(new Phaser.Geom.Line(bounds.right, bounds.top, bounds.right, bounds.bottom));
            this.wallLines.push(new Phaser.Geom.Line(bounds.left, bounds.bottom, bounds.right, bounds.bottom));
            this.wallLines.push(new Phaser.Geom.Line(bounds.left, bounds.top, bounds.left, bounds.bottom));
        });
        
        console.log(`맵 재생성 완료: 벽 ${this.walls.getChildren().length}개`);
        
        // 맵 재생성 후 충돌 설정 업데이트
        if (this.player) {
            this.setupCollisions();
        }
    }
    
    // 물리 충돌 설정 (별도 함수로 분리)
    setupCollisions() {
        // 기존 충돌 제거
        if (this.playerWallCollider) this.playerWallCollider.destroy();
        if (this.enemyWallCollider) this.enemyWallCollider.destroy();
        if (this.otherPlayerWallCollider) this.otherPlayerWallCollider.destroy();
        if (this.playerEnemyCollider) this.playerEnemyCollider.destroy();
        
        // 새 충돌 설정
        this.playerWallCollider = this.physics.add.collider(this.player, this.walls);
        this.enemyWallCollider = this.physics.add.collider(this.enemies, this.walls);
        this.otherPlayerWallCollider = this.physics.add.collider(this.otherPlayers, this.walls);
        this.playerEnemyCollider = this.physics.add.collider(this.player, this.enemies, this.handlePlayerEnemyCollision, null, this);
        
        console.log('물리 충돌 설정 완료');
    }
    
    updateVision() {
        // 0. 필수 객체 확인
        if (!this.player || !this.wallLines || !this.visionTexture) {
            return;
        }
    
        // =================================================================
        // Part 1. 월드 좌표계에서 시야 폴리곤 계산
        // =================================================================
        const playerPos = new Phaser.Math.Vector2(this.player.x, this.player.y);
        const visionRadius = this.player.visionRange || 300;
        const cam = this.cameras.main;
    
        const playerCircle = new Phaser.Geom.Circle(playerPos.x, playerPos.y, visionRadius);
        const nearbyWalls = this.wallLines.filter(line =>
            Phaser.Geom.Intersects.LineToCircle(line, playerCircle)
        );
    
        const rays = [];
        nearbyWalls.forEach(line => {
            [line.getPointA(), line.getPointB()].forEach(p => {
                const angle = Phaser.Math.Angle.BetweenPoints(playerPos, p);
                rays.push(angle - 0.0001, angle, angle + 0.0001); // 오차를 더 줄임
            });
        });
        for (let i = 0; i < 360; i += 4) { // 레이를 더 촘촘하게 쏴서 부드럽게 만듬
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
            
            // [수정 2] 시야를 막는 벽을 보이게 하기 위한 로직
            let finalPoint;
            if (closestIntersection) {
                // 레이가 벽에 부딪혔을 경우, 해당 지점에서 1픽셀 더 나아가게 만듭니다.
                finalPoint = new Phaser.Math.Vector2(closestIntersection.x, closestIntersection.y);
                const direction = new Phaser.Math.Vector2(rayLine.x2 - rayLine.x1, rayLine.y2 - rayLine.y1).normalize();
            } else {
                // 벽에 부딪히지 않으면 레이의 최대 길이 지점을 사용합니다.
                finalPoint = new Phaser.Math.Vector2(rayLine.x2, rayLine.y2);
            }
            endpoints.push(finalPoint);
        });
    
        // [수정 1] 렌더링 실선(틈)을 없애기 위한 정규화된 각도 정렬
        endpoints.sort(
            (a, b) => 
                Phaser.Math.Angle.Normalize(Phaser.Math.Angle.BetweenPoints(playerPos, a)) -
                Phaser.Math.Angle.Normalize(Phaser.Math.Angle.BetweenPoints(playerPos, b))
        );
    
        // =================================================================
        // Part 2. 계산된 폴리곤으로 시야 지우기 (기존과 동일)
        // =================================================================
        this.visionTexture.clear();
        this.visionTexture.fill(0x000000, 0.95);
    
        const visionMaskGraphics = this.make.graphics({ add: false });
        visionMaskGraphics.fillStyle(0xffffff);
        visionMaskGraphics.beginPath();
        visionMaskGraphics.moveTo(playerPos.x - cam.scrollX, playerPos.y - cam.scrollY);
        endpoints.forEach(p => {
            visionMaskGraphics.lineTo(p.x - cam.scrollX, p.y - cam.scrollY);
        });
        visionMaskGraphics.closePath();
        visionMaskGraphics.fillPath();
    
        this.visionTexture.erase(visionMaskGraphics);
        
        visionMaskGraphics.destroy();
    }
    // GameScene.js 클래스 내부에 추가

    /**
     * 시야 효과를 위한 원형 그래디언트 텍스처를 생성하고 'vision_gradient' 키로 등록합니다.
     */
    createGradientTexture() {
        const size = 512; // 텍스처의 크기 (플레이어 시야 반경보다 큰 것이 좋음)
        const graphics = this.make.graphics({ width: size, height: size, add: false });

        const radius = size / 2;
        const gradient = graphics.fillGradientStyle(0xffffff, 0xffffff, 0x000000, 0x000000, 1, 1, 0, 0);

        // 원형 그래디언트를 그립니다.
        graphics.beginPath();
        graphics.arc(radius, radius, radius, 0, 2 * Math.PI, false);
        graphics.closePath();
        graphics.fillPath();

        // 생성된 그래픽을 'vision_gradient'라는 키의 텍스처로 만듭니다.
        graphics.generateTexture('vision_gradient', size, size);
        graphics.destroy(); // 임시 그래픽 객체는 파괴합니다.
    }
    
    // ... (spawnEnemies, handlePlayerEnemyCollision, setupUI, etc. functions remain the same) ...
    // 서버에서 적을 관리하므로 클라이언트 스폰 메서드 제거
    
    handlePlayerEnemyCollision(player, enemy) {
        // 본인 플레이어만 적과 상호작용
        if (player === this.player && player.body.velocity.length() > 50) {
            // 서버에 적 공격 알림
            if (this.networkManager && enemy.networkId) {
                this.networkManager.hitEnemy(enemy.networkId);
            }
            
            // 넉백 효과 (즉시 표시)
            const angle = Phaser.Math.Angle.Between(player.x, player.y, enemy.x, enemy.y);
            const knockbackForce = 200;
            enemy.setVelocity(
                Math.cos(angle) * knockbackForce,
                Math.sin(angle) * knockbackForce
            );
        }
    }
    
    setupUI() {
        // 게임 UI 표시
        const gameUI = document.getElementById('game-ui');
        if (gameUI) {
            gameUI.style.display = 'block';
        }

        // 게임 제목 텍스트
        this.add.text(16, 16, 'RPG Slime', {
            fontSize: '32px',
            fill: '#fff',
            fontFamily: 'Arial'
        }).setScrollFactor(0);

        // 미니맵 & 빅맵 초기화
        this.initMinimap();
    }

    initMinimap() {
        this.minimapSize = 200;
        this.minimapViewSize = 1000;
        this.minimapScale = this.minimapSize / this.minimapViewSize;
        
        this.bigMapSize = 800;
        this.bigMapScale = this.bigMapSize / this.MAP_WIDTH;

        this.mapCols = Math.ceil(this.MAP_WIDTH / this.TILE_SIZE);
        this.mapRows = Math.ceil(this.MAP_HEIGHT / this.TILE_SIZE);

        this.discovered = Array.from({ length: this.mapRows }, () => Array(this.mapCols).fill(false));

        const spawnCols = Math.ceil(this.SPAWN_WIDTH / this.TILE_SIZE);
        for (let y = 0; y < this.mapRows; y++) {
            for (let x = 0; x < spawnCols + 2; x++) this.discovered[y][x] = true;
            for (let x = this.mapCols - spawnCols - 2; x < this.mapCols; x++) this.discovered[y][x] = true;
        }

        this.minimap = this.add.graphics();
        this.minimap.setScrollFactor(0);
        this.minimap.setDepth(1000);
        this.positionMinimap();

        this.bigMap = this.add.graphics();
        this.bigMap.setScrollFactor(0);
        this.bigMap.setDepth(1001);
        this.bigMap.setVisible(false);
        this.bigMap.setPosition((this.scale.width - this.bigMapSize) / 2, (this.scale.height - this.bigMapSize) / 2);

        this.mapToggleKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.M);
        this.bigMapVisible = false;
    }

    positionMinimap() {
        if (!this.minimap) return;
        const cam = this.cameras.main;
        this.minimap.setPosition(
            cam.width - this.minimapSize - 10,
            65
        );
    }

    updateMinimapVision() {
        if (!this.player) return;
        const radius = this.player.visionRange;
        const startCol = Math.max(0, Math.floor((this.player.x - radius) / this.TILE_SIZE));
        const endCol = Math.min(this.mapCols - 1, Math.floor((this.player.x + radius) / this.TILE_SIZE));
        const startRow = Math.max(0, Math.floor((this.player.y - radius) / this.TILE_SIZE));
        const endRow = Math.min(this.mapRows - 1, Math.floor((this.player.y + radius) / this.TILE_SIZE));

        const radiusSq = radius * radius;
        for (let row = startRow; row <= endRow; row++) {
            for (let col = startCol; col <= endCol; col++) {
                const cellCenterX = col * this.TILE_SIZE + this.TILE_SIZE / 2;
                const cellCenterY = row * this.TILE_SIZE + this.TILE_SIZE / 2;
                const dx = cellCenterX - this.player.x;
                const dy = cellCenterY - this.player.y;
                if (dx * dx + dy * dy <= radiusSq) {
                    this.discovered[row][col] = true;
                }
            }
        }
    }

    updateMinimap() {
        if (!this.player) return;
    
        const size = this.minimapSize;
        const scale = this.minimapScale;
        
        this.positionMinimap();
        this.minimap.clear();
        
        // 1. 미니맵 배경 그리기
        this.minimap.fillStyle(0x000000, 0.8);
        this.minimap.fillRect(0, 0, size, size);
    
        // 2. 플레이어 위치를 중심으로 미니맵에 보일 월드 좌표의 시작점 계산
        const offsetX = this.player.x - (size / 2) / scale;
        const offsetY = this.player.y - (size / 2) / scale;
    
        // 3. 미니맵 경계와 클리핑을 위한 헬퍼 함수 정의
        const minimapBounds = new Phaser.Geom.Rectangle(0, 0, size, size);
        
        // 월드 좌표의 사각형(rect)을 받아 미니맵 경계에 맞게 잘라 그리는 함수
        const drawClippedRect = (rect, color, alpha) => {
            const zoneInMinimap = new Phaser.Geom.Rectangle(
                (rect.x - offsetX) * scale,
                (rect.y - offsetY) * scale,
                rect.width * scale,
                rect.height * scale
            );
            // 미니맵 경계와 그릴 사각형의 겹치는 부분만 계산
            const intersection = Phaser.Geom.Rectangle.Intersection(minimapBounds, zoneInMinimap);
            
            // 겹치는 부분이 있을 경우에만 그리기
            if (!intersection.isEmpty()) {
                this.minimap.fillStyle(color, alpha);
                this.minimap.fillRect(intersection.x, intersection.y, intersection.width, intersection.height);
            }
        };
    
        // 4. 발견된 타일(회색 영역) 그리기
        const startCol = Math.max(0, Math.floor(offsetX / this.TILE_SIZE));
        const endCol = Math.min(this.mapCols - 1, Math.ceil((offsetX + this.minimapViewSize) / this.TILE_SIZE));
        const startRow = Math.max(0, Math.floor(offsetY / this.TILE_SIZE));
        const endRow = Math.min(this.mapRows - 1, Math.ceil((offsetY + this.minimapViewSize) / this.TILE_SIZE));
    
        for (let y = startRow; y <= endRow; y++) {
            for (let x = startCol; x <= endCol; x++) {
                if (this.discovered[y][x]) {
                    // BUG FIX: 직접 그리는 대신 클리핑 함수를 사용
                    const tileWorldRect = new Phaser.Geom.Rectangle(x * this.TILE_SIZE, y * this.TILE_SIZE, this.TILE_SIZE, this.TILE_SIZE);
                    drawClippedRect(tileWorldRect, 0x333333, 0.8);
                }
            }
        }
    
        // 5. 특별 구역 그리기 (기존과 동일하게 클리핑 함수 사용)
        drawClippedRect(this.redSpawnRect, 0xff0000, 0.25);
        drawClippedRect(this.blueSpawnRect, 0x0000ff, 0.25);
        drawClippedRect(this.plazaRect, 0xffff00, 0.15);
    
        // 6. 벽 그리기
        this.walls.getChildren().forEach(wall => {
            const col = Math.floor(wall.x / this.TILE_SIZE);
            const row = Math.floor(wall.y / this.TILE_SIZE);
            
            if (this.discovered[row] && this.discovered[row][col]) {
                // BUG FIX: 잘못된 경계 체크 로직을 제거하고 클리핑 함수를 사용
                // (wall의 x, y가 중앙 좌표라고 가정)
                const wallWorldRect = new Phaser.Geom.Rectangle(
                    wall.x - this.TILE_SIZE / 2, 
                    wall.y - this.TILE_SIZE / 2, 
                    this.TILE_SIZE, 
                    this.TILE_SIZE
                );
                drawClippedRect(wallWorldRect, 0x8b4513, 1.0);
            }
        });
    
        // 7. 플레이어 아이콘 그리기 (항상 중앙에 위치)
        this.minimap.fillStyle(0x00ff00);
        this.minimap.fillCircle(size / 2, size / 2, 4);
    }

    drawBigMap() {
        const size = this.bigMapSize;
        const scale = this.bigMapScale;
        this.bigMap.clear();

        this.bigMap.fillStyle(0x000000, 0.9);
        this.bigMap.fillRect(0, 0, size, size);

        this.bigMap.fillStyle(0x333333, 0.9);
        const tileW = this.TILE_SIZE * scale;
        const tileH = this.TILE_SIZE * scale;
        for (let y = 0; y < this.mapRows; y++) {
            for (let x = 0; x < this.mapCols; x++) {
                if (this.discovered[y][x]) {
                    this.bigMap.fillRect(x * tileW, y * tileH, tileW, tileH);
                }
            }
        }
        
        this.bigMap.fillStyle(0xff0000, 0.25);
        this.bigMap.fillRect(this.redSpawnRect.x * scale, this.redSpawnRect.y * scale, this.redSpawnRect.width * scale, this.redSpawnRect.height * scale);
        this.bigMap.fillStyle(0x0000ff, 0.25);
        this.bigMap.fillRect(this.blueSpawnRect.x * scale, this.blueSpawnRect.y * scale, this.blueSpawnRect.width * scale, this.blueSpawnRect.height * scale);
        this.bigMap.fillStyle(0xffff00, 0.15);
        this.bigMap.fillRect(this.plazaRect.x * scale, this.plazaRect.y * scale, this.plazaRect.width * scale, this.plazaRect.height * scale);

        this.bigMap.fillStyle(0x8b4513);
        this.walls.getChildren().forEach(wall => {
            const col = Math.floor(wall.x / this.TILE_SIZE);
            const row = Math.floor(wall.y / this.TILE_SIZE);
            if (this.discovered[row] && this.discovered[row][col]) {
                const x = (wall.x - this.TILE_SIZE / 2) * scale;
                const y = (wall.y - this.TILE_SIZE / 2) * scale;
                this.bigMap.fillRect(x, y, this.TILE_SIZE * scale, this.TILE_SIZE * scale);
            }
        });

        this.bigMap.fillStyle(0x00ff00);
        this.bigMap.fillCircle(this.player.x * scale, this.player.y * scale, 5);
    }
    
    update(time, delta) {
        // 플레이어가 아직 생성되지 않았으면 대기
        if (!this.player) {
            return;
        }
        
        // 점프 상태 변화 감지 및 카메라 제어
        if (this.player.isJumping && !this.wasJumping) {
            // 점프 시작 - 카메라 추적 중단
            this.cameras.main.stopFollow();
            this.wasJumping = true;
        } else if (!this.player.isJumping && this.wasJumping) {
            // 점프 종료 - 카메라 추적 재시작
            this.cameras.main.startFollow(this.player);
            this.wasJumping = false;
        }
        
        this.player.update(time, delta);
        
        this.enemies.getChildren().forEach(enemy => {
            enemy.update(time, delta);
        });

        if (this.mapToggleKey && Phaser.Input.Keyboard.JustDown(this.mapToggleKey)) {
            this.bigMapVisible = !this.bigMapVisible;
            this.bigMap.setVisible(this.bigMapVisible);
            this.minimap.setVisible(!this.bigMapVisible);
        }

        if (!this.player.isJumping) {
            this.updateMinimapVision();
            this.updateVision();

            if (this.bigMapVisible) {
                this.drawBigMap();
            } else {
                this.updateMinimap();
            }
        }

        this.restrictMovement();
    }

    getRandomPointInRect(rect) {
        return {
            x: Phaser.Math.Between(rect.x + this.TILE_SIZE, rect.right - this.TILE_SIZE),
            y: Phaser.Math.Between(rect.y + this.TILE_SIZE, rect.bottom - this.TILE_SIZE)
        };
    }

    restrictMovement() {
        // 플레이어가 없으면 제한 없음
        if (!this.player) {
            return;
        }
        
        if (this.player.team === 'red' && this.blueSpawnRect.contains(this.player.x, this.player.y)) {
            this.player.x = this.blueSpawnRect.x;
        } 
        else if (this.player.team === 'blue' && this.redSpawnRect.contains(this.player.x, this.player.y)) {
            this.player.x = this.redSpawnRect.right;
        }

        this.enemies.getChildren().forEach(enemy => {
            if (this.redSpawnRect.contains(enemy.x, enemy.y)) {
                enemy.x = this.redSpawnRect.right + this.TILE_SIZE;
            } 
            else if (this.blueSpawnRect.contains(enemy.x, enemy.y)) {
                enemy.x = this.blueSpawnRect.x - this.TILE_SIZE;
            }
        });
    }

    // 카메라 줌 변경 시 UI 스케일 조정 (안개와 미니맵이 영향받지 않도록)
    updateUIScale(cameraZoom) {
        const inverseZoom = 1 / cameraZoom;
        
        // 안개 스케일 조정
        if (this.visionTexture) {
            this.visionTexture.setScale(inverseZoom);
        }
        
        // 미니맵 스케일 조정
        if (this.minimap) {
            this.minimap.setScale(inverseZoom);
        }
        
        // 빅맵 스케일 조정
        if (this.bigMap) {
            this.bigMap.setScale(inverseZoom);
        }
    }

    // 네트워크 이벤트 리스너 설정
    setupNetworkListeners() {
        // 게임 입장 완료
        this.networkManager.on('game-joined', (data) => {
            console.log('게임 입장 완료:', data);
            
            // 서버 맵 데이터로 맵 재생성
            if (data.mapData) {
                console.log('서버 맵 데이터로 맵 재생성');
                this.recreateMapFromServer(data.mapData);
            }
            
            // 텍스처 존재 여부 확인
            const testTexture = `player_${data.playerData.jobClass}_front`;
            console.log(`텍스처 확인: ${testTexture} exists = ${this.textures.exists(testTexture)}`);
            
            // 본인 플레이어 생성
            this.player = new Player(this, data.playerData.x, data.playerData.y, data.playerData.team);
            this.player.setNetworkId(data.playerId);
            this.player.setNetworkManager(this.networkManager);
            
            // 물리 충돌 설정 (맵 재생성 후에도 작동하도록)
            this.setupCollisions();
            
            // 카메라 설정
            this.cameras.main.startFollow(this.player);
            this.cameras.main.setZoom(1);
            
            // 기존 플레이어들 생성
            data.players.forEach(playerData => {
                if (playerData.id !== data.playerId) {
                    this.createOtherPlayer(playerData);
                }
            });
            
            // 기존 적들 생성
            data.enemies.forEach(enemyData => {
                this.createNetworkEnemy(enemyData);
            });
            
            console.log('플레이어 생성 완료:', this.player);
        });

        // 다른 플레이어 입장
        this.networkManager.on('player-joined', (playerData) => {
            console.log('플레이어 입장:', playerData);
            this.createOtherPlayer(playerData);
        });

        // 플레이어 퇴장
        this.networkManager.on('player-left', (data) => {
            console.log('플레이어 퇴장:', data);
            const otherPlayer = this.otherPlayers.getChildren().find(p => p.networkId === data.playerId);
            if (otherPlayer) {
                otherPlayer.destroy();
            }
        });

        // 플레이어 이동
        this.networkManager.on('player-moved', (data) => {
            const otherPlayer = this.otherPlayers.getChildren().find(p => p.networkId === data.id);
            if (otherPlayer && !otherPlayer.isJumping) { // 점프 중이 아닐 때만 위치 업데이트
                // 부드러운 이동을 위한 트윈
                this.tweens.add({
                    targets: otherPlayer,
                    x: data.x,
                    y: data.y,
                    duration: 50,
                    ease: 'Linear'
                });
                
                // 상태 업데이트
                otherPlayer.direction = data.direction;
                if (data.jobClass && data.jobClass !== otherPlayer.jobClass) {
                    otherPlayer.jobClass = data.jobClass;
                }
                if (data.level && data.level !== otherPlayer.level) {
                    otherPlayer.level = data.level;
                    otherPlayer.updateCharacterSize();
                }
                if (data.size && data.size !== otherPlayer.size) {
                    otherPlayer.size = data.size;
                    otherPlayer.updateSize();
                }
                
                otherPlayer.updateJobSprite();
            }
        });

        // 스킬 사용
        this.networkManager.on('player-skill-used', (data) => {
            const player = data.playerId === this.networkManager.playerId 
                ? this.player 
                : this.otherPlayers.getChildren().find(p => p.networkId === data.playerId);
            
            if (player) {
                // 본인이 아닌 다른 플레이어의 스킬만 실행
                if (data.playerId !== this.networkManager.playerId) {
                    this.showSkillEffect(player, data.skillType);
                }
            }
        });

        // 플레이어 레벨업
        this.networkManager.on('player-level-up', (data) => {
            const player = data.playerId === this.networkManager.playerId 
                ? this.player 
                : this.otherPlayers.getChildren().find(p => p.networkId === data.playerId);
            
            if (player) {
                const levelUpText = this.add.text(player.x, player.y - 50, 'LEVEL UP!', {
                    fontSize: '24px',
                    fill: '#ffff00'
                }).setOrigin(0.5);
                
                this.time.delayedCall(2000, () => {
                    levelUpText.destroy();
                });
            }
        });

        // 적 스폰
        this.networkManager.on('enemy-spawned', (enemyData) => {
            this.createNetworkEnemy(enemyData);
        });

        // 적 제거
        this.networkManager.on('enemy-destroyed', (data) => {
            const enemy = this.enemies.getChildren().find(e => e.networkId === data.enemyId);
            if (enemy) {
                enemy.destroy();
            }
        });

        // 적 데미지
        this.networkManager.on('enemy-damaged', (data) => {
            const enemy = this.enemies.getChildren().find(e => e.networkId === data.enemyId);
            if (enemy) {
                enemy.hp = data.hp;
                enemy.maxHp = data.maxHp;
                
                // 데미지 표시
                const damageText = this.add.text(enemy.x, enemy.y - 30, `${enemy.hp}/${enemy.maxHp}`, {
                    fontSize: '12px',
                    fill: '#ff0000'
                }).setOrigin(0.5);
                
                this.time.delayedCall(1000, () => {
                    damageText.destroy();
                });
            }
        });

        // 적 위치 업데이트 (서버에서 관리)
        this.networkManager.on('enemies-update', (enemiesData) => {
            enemiesData.forEach(enemyData => {
                const enemy = this.enemies.getChildren().find(e => e.networkId === enemyData.id);
                if (enemy) {
                    // 부드러운 이동을 위한 보간
                    this.tweens.add({
                        targets: enemy,
                        x: enemyData.x,
                        y: enemyData.y,
                        duration: 50,
                        ease: 'Linear'
                    });
                    
                    // HP 업데이트
                    enemy.hp = enemyData.hp;
                    enemy.maxHp = enemyData.maxHp;
                    
                    // 공격 애니메이션
                    if (enemyData.isAttacking) {
                        this.showEnemyAttack(enemy);
                    }
                }
                         });
         });

        // 플레이어 직업 변경
        this.networkManager.on('player-job-changed', (data) => {
            const otherPlayer = this.otherPlayers.getChildren().find(p => p.networkId === data.id);
            if (otherPlayer) {
                otherPlayer.jobClass = data.jobClass;
                otherPlayer.updateJobSprite();
                console.log(`플레이어 ${data.id} 직업 변경: ${data.jobClass}`);
            }
        });
    }

    // 다른 플레이어 생성
    createOtherPlayer(playerData) {
        const otherPlayer = new Player(this, playerData.x, playerData.y, playerData.team);
        otherPlayer.setNetworkId(playerData.id);
        otherPlayer.setIsOtherPlayer(true); // 다른 플레이어임을 표시
        otherPlayer.level = playerData.level;
        otherPlayer.hp = playerData.hp;
        otherPlayer.maxHp = playerData.maxHp;
        otherPlayer.jobClass = playerData.jobClass;
        otherPlayer.direction = playerData.direction;
        otherPlayer.size = playerData.size;
        otherPlayer.updateJobSprite();
        
        this.otherPlayers.add(otherPlayer);
        
        // 다른 플레이어 이름 표시
        const nameText = this.add.text(playerData.x, playerData.y - 40, `Player ${playerData.id.slice(0, 6)}`, {
            fontSize: '12px',
            fill: playerData.team === 'red' ? '#ff0000' : '#0000ff'
        }).setOrigin(0.5);
        
        otherPlayer.nameText = nameText;
        
        return otherPlayer;
    }

    // 네트워크 적 생성
    createNetworkEnemy(enemyData) {
        const enemy = new Enemy(this, enemyData.x, enemyData.y, enemyData.type);
        enemy.setNetworkId(enemyData.id);
        enemy.hp = enemyData.hp;
        enemy.maxHp = enemyData.maxHp;
        enemy.isServerControlled = true; // 서버에서 관리됨을 표시
        
        this.enemies.add(enemy);
        return enemy;
    }

    // 적 공격 애니메이션 표시
    showEnemyAttack(enemy) {
        // 간단한 공격 이펙트
        enemy.setTint(0xff0000);
        this.time.delayedCall(200, () => {
            enemy.clearTint();
        });
        
        // 공격 범위 표시
        const attackRange = this.add.circle(enemy.x, enemy.y, 60, 0xff0000, 0.3);
        this.time.delayedCall(300, () => {
            attackRange.destroy();
        });
    }

    // 스킬 이펙트 표시
    showSkillEffect(player, skillType) {
        switch (skillType) {
            case 'stealth':
                player.setAlpha(0.3);
                player.setTint(0x888888);
                this.time.delayedCall(3000, () => {
                    player.setAlpha(1);
                    player.clearTint();
                });
                break;
            case 'jump':
                // 다른 플레이어의 점프 애니메이션 (위치 동기화 없이 시각적 효과만)
                if (player.isOtherPlayer) {
                    const originalY = player.y;
                    const originalNameY = player.nameText ? player.nameText.y : null;
                    player.isJumping = true;
                    
                    // 플레이어와 이름 태그를 함께 애니메이션
                    const targets = [player];
                    if (player.nameText) {
                        targets.push(player.nameText);
                    }
                    
                    this.tweens.add({
                        targets: targets,
                        y: '-=50', // 현재 위치에서 50 위로
                        duration: 200,
                        yoyo: true,
                        ease: 'Power2',
                        onComplete: () => {
                            // 원래 위치로 정확히 복원
                            player.y = originalY;
                            if (player.nameText && originalNameY !== null) {
                                player.nameText.y = originalNameY;
                            }
                            player.isJumping = false;
                        }
                    });
                }
                break;
            case 'charge':
                // 돌진 이펙트
                break;
            case 'ward':
                const ward = this.add.circle(player.x, player.y, 50, 0x00ffff, 0.3);
                this.time.delayedCall(5000, () => {
                    ward.destroy();
                });
                break;
        }
    }
}