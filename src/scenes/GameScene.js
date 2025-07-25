import Phaser from 'phaser';
import Player from '../entities/Player.js';
import Enemy from '../entities/Enemy.js';
import AssetLoader from '../utils/AssetLoader.js';

export default class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameScene' });
    }

    preload() {
        AssetLoader.preload(this);
    }
    
    create() {
        this.createGradientTexture();
        AssetLoader.createAnimations(this);
        this.createMaze();
        
        const playerTeam = 'red';
        const spawnPoint = this.getRandomPointInRect(playerTeam === 'red' ? this.redSpawnRect : this.blueSpawnRect);
        this.player = new Player(this, spawnPoint.x, spawnPoint.y, playerTeam);
        
        this.enemies = this.physics.add.group();
        this.spawnEnemies();
        
        this.physics.add.collider(this.player, this.walls);
        this.physics.add.collider(this.enemies, this.walls);
        this.physics.add.collider(this.player, this.enemies, this.handlePlayerEnemyCollision, null, this);
        
        this.cameras.main.startFollow(this.player);
        this.cameras.main.setZoom(1);

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

        this.enemySpawnTimer = this.time.addEvent({
            delay: 5000,
            callback: this.spawnEnemy,
            callbackScope: this,
            loop: true
        });
    }
    
    // (createMaze, spawnEnemies 등 다른 함수는 그대로 유지)
    createMaze() {
        const MAP_WIDTH = 3000;
        const MAP_HEIGHT = 3000;
        const TILE_SIZE = 50;
        const SPAWN_WIDTH = 300;
        const PLAZA_SIZE = 1000;
        const PLAZA_X = (MAP_WIDTH - PLAZA_SIZE) / 2;
        const PLAZA_Y = (MAP_HEIGHT - PLAZA_SIZE) / 2;

        this.MAP_WIDTH = MAP_WIDTH;
        this.MAP_HEIGHT = MAP_HEIGHT;
        this.TILE_SIZE = TILE_SIZE;
        this.SPAWN_WIDTH = SPAWN_WIDTH;
        this.PLAZA_SIZE = PLAZA_SIZE;
        this.PLAZA_X = PLAZA_X;
        this.PLAZA_Y = PLAZA_Y;

        this.physics.world.setBounds(0, 0, MAP_WIDTH, MAP_HEIGHT);
        this.walls = this.physics.add.staticGroup();

        // 외벽
        for (let x = 0; x < MAP_WIDTH; x += TILE_SIZE) {
            this.walls.create(x + TILE_SIZE / 2, TILE_SIZE/2, 'wall').setSize(TILE_SIZE, TILE_SIZE).refreshBody();
            this.walls.create(x + TILE_SIZE / 2, MAP_HEIGHT - TILE_SIZE/2, 'wall').setSize(TILE_SIZE, TILE_SIZE).refreshBody();
        }
        for (let y = TILE_SIZE; y < MAP_HEIGHT - TILE_SIZE; y += TILE_SIZE) {
            this.walls.create(TILE_SIZE/2, y + TILE_SIZE/2, 'wall').setSize(TILE_SIZE, TILE_SIZE).refreshBody();
            this.walls.create(MAP_WIDTH - TILE_SIZE/2, y + TILE_SIZE/2, 'wall').setSize(TILE_SIZE, TILE_SIZE).refreshBody();
        }

        // 스폰 및 광장 구역 시각화/정보 저장
        this.add.rectangle(SPAWN_WIDTH / 2, MAP_HEIGHT / 2, SPAWN_WIDTH, MAP_HEIGHT, 0xff0000, 0.25).setDepth(-1);
        this.add.rectangle(MAP_WIDTH - SPAWN_WIDTH / 2, MAP_HEIGHT / 2, SPAWN_WIDTH, MAP_HEIGHT, 0x0000ff, 0.25).setDepth(-1);
        this.plazaRect = new Phaser.Geom.Rectangle(PLAZA_X, PLAZA_Y, PLAZA_SIZE, PLAZA_SIZE);
        this.add.rectangle(this.plazaRect.centerX, this.plazaRect.centerY, PLAZA_SIZE, PLAZA_SIZE, 0xffff00, 0.15).setDepth(-1);

        // 광장 테두리 벽
        const borderPositions = [];
        for (let x = PLAZA_X; x < PLAZA_X + PLAZA_SIZE; x += TILE_SIZE) {
            borderPositions.push({ x: x + TILE_SIZE / 2, y: PLAZA_Y - TILE_SIZE / 2 });
            borderPositions.push({ x: x + TILE_SIZE / 2, y: PLAZA_Y + PLAZA_SIZE + TILE_SIZE / 2 });
        }
        for (let y = PLAZA_Y; y < PLAZA_Y + PLAZA_SIZE; y += TILE_SIZE) {
            borderPositions.push({ x: PLAZA_X - TILE_SIZE / 2, y: y + TILE_SIZE / 2 });
            borderPositions.push({ x: PLAZA_X + PLAZA_SIZE + TILE_SIZE / 2, y: y + TILE_SIZE / 2 });
        }
        Phaser.Utils.Array.Shuffle(borderPositions);
        const openings = new Set(borderPositions.slice(0, 10).map(p => `${p.x}_${p.y}`));
        borderPositions.forEach(p => {
            if (!openings.has(`${p.x}_${p.y}`)) {
                this.walls.create(p.x, p.y, 'wall').setSize(TILE_SIZE, TILE_SIZE).refreshBody();
            }
        });

        // 미로 생성
        const borderSet = new Set(borderPositions.map(p => `${p.x}_${p.y}`));
        for (let x = SPAWN_WIDTH; x < MAP_WIDTH - SPAWN_WIDTH; x += TILE_SIZE) {
            for (let y = 0; y < MAP_HEIGHT; y += TILE_SIZE) {
                if (this.plazaRect.contains(x, y) || borderSet.has(`${x + TILE_SIZE / 2}_${y + TILE_SIZE / 2}`)) continue;
                let wallProbability = 0.3;
                if (Math.random() < wallProbability) {
                    this.walls.create(x + TILE_SIZE/2, y + TILE_SIZE/2, 'wall').setSize(TILE_SIZE, TILE_SIZE).refreshBody();
                }
            }
        }
        
        this.redSpawnRect = new Phaser.Geom.Rectangle(0, 0, SPAWN_WIDTH, MAP_HEIGHT);
        this.blueSpawnRect = new Phaser.Geom.Rectangle(MAP_WIDTH - SPAWN_WIDTH, 0, SPAWN_WIDTH, MAP_HEIGHT);

        // 시야 계산을 위해 모든 벽의 선분 정보를 미리 추출
        this.wallLines = [];
        this.walls.getChildren().forEach(wall => {
            const bounds = wall.getBounds();
            this.wallLines.push(new Phaser.Geom.Line(bounds.left, bounds.top, bounds.right, bounds.top));
            this.wallLines.push(new Phaser.Geom.Line(bounds.right, bounds.top, bounds.right, bounds.bottom));
            this.wallLines.push(new Phaser.Geom.Line(bounds.left, bounds.bottom, bounds.right, bounds.bottom));
            this.wallLines.push(new Phaser.Geom.Line(bounds.left, bounds.top, bounds.left, bounds.bottom));
        });
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
    spawnEnemies() {
        const enemyTypes = ['basic', 'fast', 'tank', 'ranged'];
        const spawnCount = 10;
        
        for (let i = 0; i < spawnCount; i++) {
            const type = enemyTypes[Math.floor(Math.random() * enemyTypes.length)];
            let point;
            // 스폰구역을 피한 위치 선정
            do {
                point = {
                    x: Phaser.Math.Between(this.SPAWN_WIDTH + 50, this.MAP_WIDTH - this.SPAWN_WIDTH - 50),
                    y: Phaser.Math.Between(50, this.MAP_HEIGHT - 50)
                };
            } while (this.redSpawnRect.contains(point.x, point.y) || this.blueSpawnRect.contains(point.x, point.y));

            const enemy = new Enemy(this, point.x, point.y, type);
            this.enemies.add(enemy);
        }
    }
    
    spawnEnemy() {
        if (this.enemies.getChildren().length < 15) {
            const enemyTypes = ['basic', 'fast', 'tank', 'ranged'];
            const type = enemyTypes[Math.floor(Math.random() * enemyTypes.length)];

            let point;
            // 스폰구역을 피한 위치 선정 (플레이어 주변)
            let attempts = 0;
            do {
                const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
                const distance = Phaser.Math.Between(300, 500);
                point = {
                    x: this.player.x + Math.cos(angle) * distance,
                    y: this.player.y + Math.sin(angle) * distance
                };
                attempts++;
            } while ((this.redSpawnRect.contains(point.x, point.y) || this.blueSpawnRect.contains(point.x, point.y)) && attempts < 10);

            const enemy = new Enemy(this, point.x, point.y, type);
            this.enemies.add(enemy);
        }
    }
    
    handlePlayerEnemyCollision(player, enemy) {
        // 플레이어가 적을 공격
        if (player.body.velocity.length() > 50) {
            enemy.takeDamage(player.getAttackDamage());
            
            // 넉백 효과
            const angle = Phaser.Math.Angle.Between(player.x, player.y, enemy.x, enemy.y);
            const knockbackForce = 200;
            enemy.setVelocity(
                Math.cos(angle) * knockbackForce,
                Math.sin(angle) * knockbackForce
            );
        }
    }
    
    setupUI() {
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
        if (this.player) {
            this.player.update(time, delta);
        }
        
        this.enemies.getChildren().forEach(enemy => {
            enemy.update(time, delta);
        });
        
        this.updateMinimapVision();
        this.updateVision();

        if (Phaser.Input.Keyboard.JustDown(this.mapToggleKey)) {
            this.bigMapVisible = !this.bigMapVisible;
            this.bigMap.setVisible(this.bigMapVisible);
            this.minimap.setVisible(!this.bigMapVisible);
        }

        if (this.bigMapVisible) {
            this.drawBigMap();
        } else {
            this.updateMinimap();
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
        if (this.player) {
            if (this.player.team === 'red' && this.blueSpawnRect.contains(this.player.x, this.player.y)) {
                this.player.x = this.blueSpawnRect.x;
            } 
            else if (this.player.team === 'blue' && this.redSpawnRect.contains(this.player.x, this.player.y)) {
                this.player.x = this.redSpawnRect.right;
            }
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
}