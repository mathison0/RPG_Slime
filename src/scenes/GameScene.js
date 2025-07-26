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
        if (this.enemyWardCollider) this.enemyWardCollider.destroy();
        
        // 새 충돌 설정
        this.playerWallCollider = this.physics.add.collider(this.player, this.walls);
        this.enemyWallCollider = this.physics.add.collider(this.enemies, this.walls);
        this.otherPlayerWallCollider = this.physics.add.collider(this.otherPlayers, this.walls);
        this.playerEnemyCollider = this.physics.add.collider(this.player, this.enemies, this.handlePlayerEnemyCollision, null, this);
        
        // 와드 충돌 설정 (와드가 있을 때만)
        if (this.activeWard && this.activeWard.sprite) {
            this.enemyWardCollider = this.physics.add.collider(this.enemies, this.activeWard.sprite, this.handleEnemyWardCollision, null, this);
        }
        
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
        // Part 2. 계산된 폴리곤으로 시야 지우기 (와드 범위 포함)
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
    
        // 와드 범위 내 시야 확장 (와드가 있을 때)
        this.addWardVisionToMask(visionMaskGraphics, cam);
    
        this.visionTexture.erase(visionMaskGraphics);
        
        visionMaskGraphics.destroy();
    }
    
    // 와드 범위 내 시야를 마스크에 추가
    addWardVisionToMask(visionMaskGraphics, cam) {
        // 같은 팀 플레이어들의 와드 시야만 추가
        
        // 1. 로컬 와드 (같은 팀이므로 항상 추가)
        if (this.activeWard) {
            const ward = this.activeWard;
            visionMaskGraphics.fillCircle(ward.x - cam.scrollX, ward.y - cam.scrollY, ward.radius);
        }
        
        // 2. 같은 팀 다른 플레이어들의 와드들만 추가
        this.children.list.forEach(child => {
            if (child.texture && child.texture.key === 'ward' && child.isOtherPlayerWard) {
                // 와드를 설치한 플레이어의 팀 확인
                const wardOwner = this.otherPlayers.getChildren().find(p => p.networkId === child.wardOwnerId);
                
                if (wardOwner && wardOwner.team === this.player.team) {
                    // 같은 팀의 와드만 시야 추가
                    visionMaskGraphics.fillCircle(child.x - cam.scrollX, child.y - cam.scrollY, 120); // 와드 반지름
                }
            }
        });
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
    
    // 적과 와드 충돌 처리
    handleEnemyWardCollision(enemy, ward) {
        // 와드가 존재하고 체력이 있을 때만 데미지
        if (this.activeWard && this.activeWard.hp > 0) {
            // 슬라임 공격력 (20)으로 와드 데미지
            const damage = 20;
            this.activeWard.hp -= damage;
            
            // 와드 데미지 이펙트
            ward.setTint(0xff0000);
            this.time.delayedCall(200, () => {
                ward.clearTint();
            });
            
            console.log(`와드가 공격받음! 남은 체력: ${this.activeWard.hp}/${this.activeWard.maxHp}`);
            
            // 와드 체력이 0 이하가 되면 파괴
            if (this.activeWard.hp <= 0) {
                console.log('와드가 파괴되었습니다!');
                
                // 와드 파괴 이펙트
                const explosion = this.add.circle(ward.x, ward.y, 50, 0xff0000, 0.5);
                this.tweens.add({
                    targets: explosion,
                    scaleX: 2,
                    scaleY: 2,
                    alpha: 0,
                    duration: 500,
                    onComplete: () => {
                        explosion.destroy();
                    }
                });
                
                // 와드 파괴 함수 호출
                if (ward.destroyWard) {
                    ward.destroyWard();
                }
                
                // 네트워크에 와드 파괴 알림
                if (this.networkManager) {
                    this.networkManager.emit('ward-destroyed', {
                        playerId: this.networkManager.playerId,
                        x: ward.x,
                        y: ward.y
                    });
                }
                
                // 충돌 설정 업데이트
                this.setupCollisions();
            }
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
        this.minimap.setDepth(1002);
        this.positionMinimap();

        this.bigMap = this.add.graphics();
        this.bigMap.setScrollFactor(0);
        this.bigMap.setDepth(1001);
        this.bigMap.setVisible(false);
        this.bigMap.setPosition((this.scale.width - this.bigMapSize) / 2, (this.scale.height - this.bigMapSize) / 2);

        this.mapToggleKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.M);
        this.bigMapVisible = false;

        // 핑 관련 변수들
        this.pingKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.CTRL);
        this.pings = this.add.group();
        this.pingMessageText = null;
        this.pingCooldown = 0;
        this.pingCooldownTime = 1000; // 1초 쿨다운
        
        // 핑 화살표 추적을 위한 변수들
        this.activePingArrows = new Map(); // 핑 ID별 화살표 객체 저장
        this.activePingPositions = new Map(); // 핑 ID별 위치 저장

        // 마우스 핑 이벤트 설정 (마우스휠 클릭)
        this.input.on('pointerdown', (pointer) => {
            if (pointer.button === 1) { // 마우스 휠 클릭 (중간 버튼)
                this.sendPingAtPosition(pointer.worldX, pointer.worldY);
            }
        });
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
        
        // 8. 핑 점들의 위치 업데이트
        this.updateMinimapPingPositions();
    }

    // 미니맵 핑 점들과 화살표들의 위치 업데이트
    updateMinimapPingPositions() {
        const scale = this.minimapScale;
        const offsetX = this.player.x - (this.minimapSize / 2) / scale;
        const offsetY = this.player.y - (this.minimapSize / 2) / scale;
        
        // 모든 핑 점들과 화살표들을 찾아서 위치 업데이트
        this.children.list.forEach(child => {
            if (child.pingWorldX !== undefined && child.pingWorldY !== undefined) {
                // 핑의 절대 위치를 미니맵 좌표로 변환
                const minimapX = (child.pingWorldX - offsetX) * scale;
                const minimapY = (child.pingWorldY - offsetY) * scale;
                
                // 미니맵 위치 업데이트 (경계 내로 제한)
                const clampedX = Math.max(0, Math.min(this.minimapSize, minimapX));
                const clampedY = Math.max(0, Math.min(this.minimapSize, minimapY));
                child.setPosition(this.minimap.x + clampedX, this.minimap.y + clampedY);
                
                // 화살표가 미니맵 경계를 벗어나면 강제로 경계에 고정
                if (child.texture && child.texture.key === 'ping_arrow') {
                    const margin = 5;
                    const maxX = this.minimapSize - margin;
                    const maxY = this.minimapSize - margin;
                    
                    if (clampedX < margin || clampedX > maxX || clampedY < margin || clampedY > maxY) {
                        const finalX = Math.max(margin, Math.min(maxX, clampedX));
                        const finalY = Math.max(margin, Math.min(maxY, clampedY));
                        child.setPosition(this.minimap.x + finalX, this.minimap.y + finalY);
                    }
                }
                
                // 화살표인 경우 방향도 업데이트
                if (child.texture && child.texture.key === 'ping_arrow') {
                    const margin = 5;
                    const isOffMinimap = minimapX < margin || minimapX > this.minimapSize - margin || 
                                        minimapY < margin || minimapY > this.minimapSize - margin;
                    
                    // 미니맵 밖에 있는 모든 핑은 화살표로 표시 (거리에 상관없이)
                    const isOutsideMinimap = minimapX < 0 || minimapX > this.minimapSize || 
                                            minimapY < 0 || minimapY > this.minimapSize;
                    
                    // 미니맵 밖에 있으면 무조건 화살표 표시
                    if (isOutsideMinimap || isOffMinimap) {
                        // 화살표 방향 재계산 (경계에 고정)
                        // 화살표가 미니맵 바깥으로 나가지 않도록 clamp 처리
                        let arrowX = Math.max(margin, Math.min(this.minimapSize - margin, minimapX));
                        let arrowY = Math.max(margin, Math.min(this.minimapSize - margin, minimapY));
                        // 화살표 방향 계산 (미니맵 경계에서 핑의 실제 위치를 가리킴)
                        const angle = Phaser.Math.Angle.Between(arrowX, arrowY, minimapX, minimapY);
                        child.setRotation(angle);
                        child.setVisible(true);
                    } else {
                        // 미니맵 안에 있으면 화살표 숨김
                        child.setVisible(false);
                    }
                }
                
                // 핑은 2초 후 자동으로 사라지므로 제거 코드 불필요
                // 한국어 주석: 핑의 수명은 애니메이션으로 관리되므로 여기서 제거하지 않음
            }
        });
    }

    // 시야 판정 함수 - 해당 좌표가 플레이어의 시야 안에 있는지 확인
    isInVision(x, y) {
        if (!this.player) return false;
        
        // 플레이어와 핑 사이의 거리 계산
        const distance = Phaser.Math.Distance.Between(this.player.x, this.player.y, x, y);
        
        // 시야 반지름 (기존 시야 시스템과 동일하게 설정)
        const visionRadius = this.player.visionRange || 300; // 기존 시야 반지름 사용
        
        return distance <= visionRadius;
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

        // 활성 핑 화살표들의 방향 실시간 업데이트
        this.updatePingArrows();
        
        // 와드로 탐지된 적들의 미니맵 위치 업데이트
        this.updateWardDetectedEnemies();

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
                    this.showSkillEffect(player, data.skillType, data);
                }
            }
        });
        
        // 와드 파괴 (다른 플레이어의 와드가 파괴될 때)
        this.networkManager.on('ward-destroyed', (data) => {
            // 다른 플레이어의 와드 스프라이트들을 찾아서 제거
            this.children.list.forEach(child => {
                if (child.texture && child.texture.key === 'ward' && child.isOtherPlayerWard) {
                    // 파괴 이펙트
                    const explosion = this.add.circle(child.x, child.y, 50, 0xff0000, 0.5);
                    this.tweens.add({
                        targets: explosion,
                        scaleX: 2,
                        scaleY: 2,
                        alpha: 0,
                        duration: 500,
                        onComplete: () => {
                            explosion.destroy();
                        }
                    });
                    
                    child.destroy();
                }
            });
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

        // 핑 수신
        this.networkManager.on('player-ping', (data) => {
            // 같은 팀의 핑만 표시
            if (data.team === this.player.team && data.playerId !== this.networkManager.playerId) {
                this.createPing(data.x, data.y, data.playerId);
                this.showPingMessage(`팀원이 핑을 찍었습니다!`);
                
                // 핑 ID 생성 (플레이어 ID + 타임스탬프)
                const pingId = `${data.playerId}_${Date.now()}`;
                
                // 핑 위치 저장
                this.activePingPositions.set(pingId, { x: data.x, y: data.y });
                
                // 화면 밖에 있는 핑인지 확인하고 화살표 표시
                this.checkAndShowPingArrow(data.x, data.y, pingId);
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
    showSkillEffect(player, skillType, data = null) {
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
            case 'slime_spread':
                // 슬라임 퍼지기 이펙트 (다른 플레이어용)
                if (player.isOtherPlayer) {
                    // 플레이어 스프라이트를 슬라임 스킬 이미지로 변경 (로컬과 동일)
                    const originalTexture = player.texture.key;
                    player.setTexture('slime_skill');
                    
                    // 시각적 이펙트(원형 범위 표시) - 원래 방식과 동일
                    const effect = this.add.circle(player.x, player.y, 50, 0x00ff00, 0.3);
                    this.time.delayedCall(300, () => {
                        effect.destroy();
                    });
                    
                    // 400ms 후 원래 스프라이트로 복원 (로컬과 동일)
                    this.time.delayedCall(400, () => {
                        player.updateJobSprite();
                    });
                    
                    console.log('다른 플레이어의 슬라임 퍼지기 스킬 사용됨:', player.x, player.y);
                }
                break;
            case 'ward':
                // 마법사 와드 이펙트 (다른 플레이어용)
                if (player.isOtherPlayer) {
                    // 와드 스프라이트 생성
                    const ward = this.add.sprite(player.x, player.y, 'ward');
                    ward.setScale(0.02); // 로컬과 동일한 크기
                    ward.isOtherPlayerWard = true; // 다른 플레이어 와드 표시
                    ward.wardOwnerId = data.playerId; // 와드 소유자 ID 저장
                    
                    // 와드 이펙트 (깜빡이는 효과)
                    this.tweens.add({
                        targets: ward,
                        alpha: 0.8,
                        duration: 1000,
                        yoyo: true,
                        repeat: -1
                    });
                    
                    // 와드가 파괴될 때까지 유지 (실제로는 서버에서 관리)
                    // 다른 플레이어의 와드는 시각적 표시만
                    console.log('다른 플레이어의 와드 설치됨:', player.x, player.y, '팀:', player.team);
                }
                break;
            case 'ice_field':
                // 마법사 얼음 장판 이펙트 (다른 플레이어용)
                if (player.isOtherPlayer) {
                    const iceField = this.add.circle(player.x, player.y, 100, 0x87ceeb, 0.4);
                    this.tweens.add({
                        targets: iceField,
                        scaleX: 1.2,
                        scaleY: 1.2,
                        duration: 2000,
                        yoyo: true,
                        repeat: 2
                    });
                    this.time.delayedCall(6000, () => {
                        iceField.destroy();
                    });
                }
                break;
            case 'magic_missile':
                // 마법사 마법 투사체 이펙트 (다른 플레이어용)
                if (player.isOtherPlayer && data && data.startX !== undefined && data.targetX !== undefined) {
                    // 사거리 제한 적용 (로컬과 동일하게)
                    let finalTargetX = data.targetX;
                    let finalTargetY = data.targetY;
                    const maxRange = data.maxRange || 400; // 기본값 400
                    
                    // 시작점에서 목표점까지의 거리 계산
                    const distance = Phaser.Math.Distance.Between(data.startX, data.startY, data.targetX, data.targetY);
                    console.log('투사체 사거리 계산:', {
                        start: [data.startX, data.startY],
                        target: [data.targetX, data.targetY],
                        distance: distance,
                        maxRange: maxRange,
                        isOverRange: distance > maxRange
                    });
                    
                    if (distance > maxRange) {
                        // 사거리 밖이면 최대 사거리만큼만 이동
                        const angle = Phaser.Math.Angle.Between(data.startX, data.startY, data.targetX, data.targetY);
                        finalTargetX = data.startX + Math.cos(angle) * maxRange;
                        finalTargetY = data.startY + Math.sin(angle) * maxRange;
                        console.log('사거리 제한 적용됨:', {
                            originalTarget: [data.targetX, data.targetY],
                            finalTarget: [finalTargetX, finalTargetY],
                            angle: angle * (180 / Math.PI) // 라디안을 도로 변환
                        });
                    }
                    
                    // 투사체 생성 (시작 위치에서)
                    const missile = this.add.circle(data.startX, data.startY, 8, 0xff00ff, 0.3); // 투명도 낮춤
                    missile.team = data.team; // 팀 정보 저장 (충돌 판정용)
                    
                    // 물리 바디 추가 (충돌 판정용)
                    this.physics.add.existing(missile);
                    missile.body.setSize(8, 8); // 투사체 크기를 더 작게 설정
                    missile.body.setOffset(0, 0); // 오프셋 설정
                    
                    // 투사체 충돌 디버깅을 위한 이벤트 추가
                    missile.body.onOverlap = (bodyA, bodyB) => {
                        console.log('투사체 충돌 발생:', {
                            missileTeam: missile.team,
                            bodyAType: bodyA.gameObject?.constructor?.name || 'unknown',
                            bodyBType: bodyB.gameObject?.constructor?.name || 'unknown',
                            bodyAIsPlayer: bodyA.gameObject?.team !== undefined,
                            bodyBIsPlayer: bodyB.gameObject?.team !== undefined,
                            bodyATeam: bodyA.gameObject?.team,
                            bodyBTeam: bodyB.gameObject?.team
                        });
                    };
                    
                    // 투사체 이펙트 (깜빡이는 효과)
                    this.tweens.add({
                        targets: missile,
                        scaleX: 1.5,
                        scaleY: 1.5,
                        duration: 500,
                        yoyo: true,
                        repeat: -1
                    });
                    
                    // 투사체 이동 (최종 목표 위치로) - 로컬과 동일한 속도로 계산
                    const finalDistance = Phaser.Math.Distance.Between(data.startX, data.startY, finalTargetX, finalTargetY);
                    const velocity = 400; // 로컬과 동일한 속도 (pixels/second)
                    const duration = (finalDistance / velocity) * 1000; // 밀리초 단위로 변환
                    
                    console.log('투사체 이동 계산:', {
                        finalDistance: finalDistance,
                        velocity: velocity,
                        duration: duration,
                        finalTarget: [finalTargetX, finalTargetY]
                    });
                    
                    this.tweens.add({
                        targets: missile,
                        x: finalTargetX,
                        y: finalTargetY,
                        duration: duration,
                        ease: 'Linear',
                        onComplete: () => {
                            // 최종 목표 지점에서 폭발 이펙트
                            const explosion = this.add.circle(finalTargetX, finalTargetY, 20, 0xff00ff, 0.8);
                            this.tweens.add({
                                targets: explosion,
                                scaleX: 2,
                                scaleY: 2,
                                alpha: 0,
                                duration: 300,
                                onComplete: () => {
                                    explosion.destroy();
                                }
                            });
                            missile.destroy();
                        }
                    });
                    
                    // 다른 플레이어 투사체와 팀원 충돌 방지
                    // 다른 플레이어 투사체는 벽과만 충돌 (팀원과는 충돌하지 않음)
                    // 팀원과의 충돌은 아예 등록하지 않음
                    
                    // 모든 플레이어(본인+otherPlayers)와 투사체 충돌 등록
                    const allPlayers = [this.player, ...this.otherPlayers.getChildren()];
                    allPlayers.forEach(targetPlayer => {
                        if (!targetPlayer) return; // null 체크
                        // 같은 팀이면 충돌 등록하지 않음
                        if (missile.team === targetPlayer.team) return;
                        // 다른 팀이면 충돌 등록
                        this.physics.add.overlap(missile, targetPlayer, (missile, hitPlayer) => {
                            // 적팀 플레이어에게 데미지 적용 (마법 데미지: 1.5배, 예시값 30)
                            const damage = 30; // 실제 밸런스에 맞게 조정
                            if (typeof hitPlayer.takeDamage === 'function') {
                                hitPlayer.takeDamage(damage);
                            }
                            // 폭발 이펙트
                            const explosion = this.add.circle(missile.x, missile.y, 20, 0xff00ff, 0.8);
                            this.tweens.add({
                                targets: explosion,
                                scaleX: 2,
                                scaleY: 2,
                                alpha: 0,
                                duration: 300,
                                onComplete: () => {
                                    explosion.destroy();
                                }
                            });
                            missile.destroy();
                        });
                    });
                    
                    // 다른 플레이어 투사체와 적(Enemy) 충돌
                    this.physics.add.overlap(missile, this.enemies, (missile, enemy) => {
                        console.log('다른 플레이어 투사체가 적과 충돌:', missile.x, missile.y);
                        // 서버에 적 공격 알림 (서버에서 관리되는 적이므로)
                        if (this.networkManager && enemy.networkId) {
                            this.networkManager.hitEnemy(enemy.networkId);
                        }
                        // 폭발 이펙트
                        const explosion = this.add.circle(missile.x, missile.y, 20, 0xff00ff, 0.8);
                        this.tweens.add({
                            targets: explosion,
                            scaleX: 2,
                            scaleY: 2,
                            alpha: 0,
                            duration: 300,
                            onComplete: () => {
                                explosion.destroy();
                            }
                        });
                        missile.destroy();
                    });
                    
                    // 다른 플레이어 투사체와 벽 충돌
                    this.physics.add.collider(missile, this.walls, (missile, wall) => {
                        console.log('다른 플레이어 투사체가 벽과 충돌:', missile.x, missile.y);
                        // 벽에 부딪혔을 때 폭발 이펙트
                        const explosion = this.add.circle(missile.x, missile.y, 20, 0xff00ff, 0.8);
                        this.tweens.add({
                            targets: explosion,
                            scaleX: 2,
                            scaleY: 2,
                            alpha: 0,
                            duration: 300,
                            onComplete: () => {
                                explosion.destroy();
                            }
                        });
                        missile.destroy();
                    });
                    
                    // 디버깅: 현재 등록된 충돌체 확인
                    console.log('투사체 충돌 정보:', {
                        missileId: missile.id,
                        missileTeam: missile.team,
                        hasPhysicsBody: missile.body !== undefined,
                        colliders: this.physics.world.colliders?.entries?.length || 0,
                        overlaps: this.physics.world.overlaps?.entries?.length || 0,
                        isInOtherPlayersGroup: this.otherPlayers.contains(missile),
                        isInEnemiesGroup: this.enemies.contains(missile),
                        isInWallsGroup: this.walls.contains(missile),
                        registeredOverlaps: allPlayers.filter(p => p && missile.team !== p.team).length
                    });
                    
                    // 3초 후 투사체 제거 (혹시라도)
                    this.time.delayedCall(3000, () => {
                        if (missile.active) {
                            missile.destroy();
                        }
                    });
                    
                    console.log('다른 플레이어의 마법 미사일 발사:', {
                        start: [data.startX, data.startY],
                        originalTarget: [data.targetX, data.targetY],
                        finalTarget: [finalTargetX, finalTargetY],
                        maxRange: maxRange,
                        missileTeam: data.team,
                        myTeam: this.player.team,
                        otherPlayersCount: this.otherPlayers.getChildren().length
                    });
                }
                break;
            case 'charge':
                // 돌진 이펙트
                break;
        }
    }

    // 핑 생성
    createPing(x, y, playerId) {
        // 시야 안에 있는 핑만 메인 화면에 표시
        const isInVision = this.isInVision(x, y);
        
        if (isInVision) {
            // 핑 이펙트 생성 (불투명하게)
            const ping = this.add.circle(x, y, 20, 0xff0000, 1.0);
            ping.setStrokeStyle(2, 0xffffff);
            
            // 핑 애니메이션 (4초 지속)
            this.tweens.add({
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

            // 핑 텍스트 (플레이어 ID)
            const pingText = this.add.text(x, y - 30, `PING`, {
                fontSize: '12px',
                fill: '#ffffff',
                stroke: '#000000',
                strokeThickness: 2
            }).setOrigin(0.5);

            this.tweens.add({
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

        // 미니맵에 핑 표시 (화살표 또는 점)
        this.createMinimapPingArrow(x, y, 'local-ping');
    }

    // 미니맵 핑 생성
    createMinimapPing(x, y) {
        const scale = this.minimapScale;
        const offsetX = this.player.x - (this.minimapSize / 2) / scale;
        const offsetY = this.player.y - (this.minimapSize / 2) / scale;
        
        const minimapX = (x - offsetX) * scale;
        const minimapY = (y - offsetY) * scale;
        
        // 미니맵 경계 내에 있는지 확인
        if (minimapX >= 0 && minimapX <= this.minimapSize && 
            minimapY >= 0 && minimapY <= this.minimapSize) {
            
            const minimapPing = this.add.circle(
                this.minimap.x + minimapX, 
                this.minimap.y + minimapY, 
                3, 
                0xff0000, 
                1.0
            );
            minimapPing.setScrollFactor(0);
            minimapPing.setDepth(1001);
            
            // 핑의 절대 위치를 저장 (플레이어 이동에 영향받지 않도록)
            minimapPing.pingWorldX = x;
            minimapPing.pingWorldY = y;
            
            // 미니맵 핑 애니메이션 (4초 지속)
            this.tweens.add({
                targets: minimapPing,
                scaleX: 2,
                scaleY: 2,
                alpha: 0,
                duration: 4000,
                ease: 'Power2',
                onComplete: () => {
                    minimapPing.destroy();
                }
            });
        }
    }

    // 핑 메시지 표시
    showPingMessage(message) {
        // 기존 메시지 제거
        if (this.pingMessageText) {
            this.pingMessageText.destroy();
        }

        // 새 메시지 생성 (좌측 하단)
        this.pingMessageText = this.add.text(20, this.scale.height - 60, message, {
            fontSize: '16px',
            fill: '#ffffff',
            stroke: '#000000',
            strokeThickness: 2,
            backgroundColor: '#ff0000',
            padding: { x: 10, y: 5 }
        }).setScrollFactor(0);

        // 3초 후 메시지 제거
        this.time.delayedCall(3000, () => {
            if (this.pingMessageText) {
                this.pingMessageText.destroy();
                this.pingMessageText = null;
            }
        });
    }

    // 핑 전송 (플레이어 위치)
    sendPing() {
        this.sendPingAtPosition(this.player.x, this.player.y);
    }

    // 핑 전송 (지정된 위치)
    sendPingAtPosition(x, y) {
        const currentTime = Date.now();
        if (currentTime - this.pingCooldown < this.pingCooldownTime) {
            // 쿨다운 중
            const remainingTime = Math.ceil((this.pingCooldownTime - (currentTime - this.pingCooldown)) / 1000);
            this.showPingMessage(`핑 쿨다운: ${remainingTime}초`);
            return;
        }

        // 핑 전송
        this.networkManager.sendPing(x, y);
        this.pingCooldown = currentTime;
        
        // 로컬 핑 표시
        this.createPing(x, y, this.networkManager.playerId);
        this.showPingMessage('핑을 찍었습니다!');
    }

    // 핑 화살표 확인 및 표시 (시야 고려)
    checkAndShowPingArrow(pingX, pingY, pingId) {
        const cam = this.cameras.main;
        const screenWidth = this.scale.width;
        const screenHeight = this.scale.height;
        
        // 화면 좌표로 변환
        const screenX = pingX - cam.scrollX;
        const screenY = pingY - cam.scrollY;
        
        // 화면 밖에 있는지 확인
        const margin = 20; // 화면 가장자리 여백
        const isOffScreen = screenX < margin || screenX > screenWidth - margin || 
                           screenY < margin || screenY > screenHeight - margin;
        
        // 시야 안에 있는지 확인
        const isInVision = this.isInVision(pingX, pingY);
        
        // 화면 밖이거나 시야 밖이면 화살표 표시
        if (isOffScreen || !isInVision) {
            this.createPingArrow(pingX, pingY, pingId);
        }
    }

    // 핑 화살표 생성
    createPingArrow(pingX, pingY, pingId) {
        const cam = this.cameras.main;
        const screenWidth = this.scale.width;
        const screenHeight = this.scale.height;
        
        // 화면 좌표로 변환
        const screenX = pingX - cam.scrollX;
        const screenY = pingY - cam.scrollY;
        
        // 화면 경계 내에서 화살표 위치 계산 (더 여유있는 위치)
        const margin = 5;
        let arrowX = Math.max(margin, Math.min(screenWidth - margin, screenX));
        let arrowY = Math.max(margin, Math.min(screenHeight - margin, screenY));
        
        // 화살표 방향 계산 (플레이어 현재 위치 기준)
        const angle = Phaser.Math.Angle.Between(arrowX, arrowY, screenX, screenY);
        
        // 화살표 이미지 생성
        const arrow = this.add.image(arrowX, arrowY, 'ping_arrow');
        arrow.setScrollFactor(0);
        arrow.setDepth(1001);
        
        // 화살표 크기 설정
        arrow.setScale(0.07);
        
        // 화살표 방향 회전 (오른쪽을 가리키는 이미지를 핑 방향으로 회전)
        arrow.setRotation(angle);
        
        // 화살표 객체를 Map에 저장 (실시간 업데이트를 위해)
        this.activePingArrows.set(pingId, {
            arrow: arrow,
            pingX: pingX,
            pingY: pingY,
            startTime: Date.now()
        });
        
        // 화살표 애니메이션 (3초 지속)
        this.tweens.add({
            targets: arrow,
            alpha: 0,
            duration: 3000,
            ease: 'Power2',
            onComplete: () => {
                // 화살표 제거 및 Map에서 삭제
                arrow.destroy();
                this.activePingArrows.delete(pingId);
                this.activePingPositions.delete(pingId);
            }
        });
        
        // 미니맵에 핑 표시 (화살표 또는 점)
        this.createMinimapPingArrow(pingX, pingY, pingId);
    }

    // 미니맵 핑 화살표 생성
    createMinimapPingArrow(pingX, pingY, pingId) {
        const scale = this.minimapScale;
        const offsetX = this.player.x - (this.minimapSize / 2) / scale;
        const offsetY = this.player.y - (this.minimapSize / 2) / scale;
        
        const minimapX = (pingX - offsetX) * scale;
        const minimapY = (pingY - offsetY) * scale;
        
        // 미니맵 경계 margin (화살표가 미니맵 끝에 붙어서 나오도록)
        const margin = 5;
        // 미니맵 내부(점) 판정 - margin 안쪽에 있는 핑만 점으로 표시
        const isInsideMinimap = minimapX >= margin && minimapX <= this.minimapSize - margin &&
                               minimapY >= margin && minimapY <= this.minimapSize - margin;
        // 미니맵 밖에 있는 핑 판정 (미니맵 전체 영역 밖)
        const isOutsideMinimap = minimapX < 0 || minimapX > this.minimapSize || 
                                 minimapY < 0 || minimapY > this.minimapSize;
        // 미니맵 경계에 있는 핑 판정 (margin 밖이지만 미니맵 안)
        const isOnMinimapBorder = !isInsideMinimap && !isOutsideMinimap;
        
        // 미니맵 내부가 아니면 모두 화살표로 표시 (경계 + 밖)
        // 또는 미니맵 밖에 있는 핑은 무조건 화살표로 표시
        if (!isInsideMinimap || isOutsideMinimap) {
            // 디버깅: 화살표 생성 조건 확인
            console.log('미니맵 화살표 생성:', {
                pingX, pingY,
                minimapX, minimapY,
                isInsideMinimap, isOutsideMinimap, isOnMinimapBorder,
                margin, minimapSize: this.minimapSize
            });
            // 미니맵 경계에 화살표 위치 고정 (경계 밖이어도 무조건 경계에 붙임)
            // 한국어 주석: clamp로 경계에 고정
            let arrowX = Math.max(margin, Math.min(this.minimapSize - margin, minimapX));
            let arrowY = Math.max(margin, Math.min(this.minimapSize - margin, minimapY));
            // 화살표 방향 계산 (경계에서 실제 핑 위치를 바라보게)
            const angle = Phaser.Math.Angle.Between(arrowX, arrowY, minimapX, minimapY);
            // 화살표 생성
            const minimapArrow = this.add.image(
                this.minimap.x + arrowX, 
                this.minimap.y + arrowY, 
                'ping_arrow'
            );
            minimapArrow.setScrollFactor(0);
            minimapArrow.setDepth(1003);
            // 핑의 절대 위치 저장 (플레이어 이동에 영향받지 않게)
            minimapArrow.pingWorldX = pingX;
            minimapArrow.pingWorldY = pingY;
            // 화살표 크기 (더 크게 설정)
            minimapArrow.setScale(0.02);
            // 화살표 방향
            minimapArrow.setRotation(angle);
            
            // 디버깅: 화살표 생성 확인
            console.log('미니맵 화살표 생성 완료:', {
                arrowX, arrowY,
                finalX: this.minimap.x + arrowX,
                finalY: this.minimap.y + arrowY,
                angle: angle * (180 / Math.PI), // 라디안을 도로 변환
                scale: minimapArrow.scale,
                visible: minimapArrow.visible,
                depth: minimapArrow.depth
            });
            
            // 디버깅: 화살표 생성 확인
            console.log('미니맵 화살표 생성 완료:', {
                arrowX, arrowY,
                finalX: this.minimap.x + arrowX,
                finalY: this.minimap.y + arrowY,
                angle: angle * (180 / Math.PI), // 라디안을 도로 변환
                scale: minimapArrow.scale,
                visible: minimapArrow.visible,
                depth: minimapArrow.depth
            });
            // 화살표 애니메이션 (4초)
            this.tweens.add({
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
            const minimapDot = this.add.circle(
                this.minimap.x + minimapX,
                this.minimap.y + minimapY,
                2,
                0xff0000,
                1.0
            );
            minimapDot.setScrollFactor(0);
            minimapDot.setDepth(1003);
            // 핑의 절대 위치 저장
            minimapDot.pingWorldX = pingX;
            minimapDot.pingWorldY = pingY;
            // 점 애니메이션 (4초)
            this.tweens.add({
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

    // 활성 핑 화살표들의 방향 실시간 업데이트
    updatePingArrows() {
        if (!this.player || this.activePingArrows.size === 0) {
            return;
        }

        const cam = this.cameras.main;
        const screenWidth = this.scale.width;
        const screenHeight = this.scale.height;
        const margin = 120;

        // 각 활성 핑 화살표 업데이트
        for (const [pingId, arrowData] of this.activePingArrows) {
            const { arrow, pingX, pingY } = arrowData;
            
            // 화면 좌표로 변환 (플레이어 현재 위치 기준)
            const screenX = pingX - cam.scrollX;
            const screenY = pingY - cam.scrollY;
            
            // 화면 밖에 있는지 확인
            const isOffScreen = screenX < margin || screenX > screenWidth - margin || 
                               screenY < margin || screenY > screenHeight - margin;
            
            // 시야 밖에 있는지 확인
            const isOutOfVision = !this.isInVision(pingX, pingY);
            
            // 화면 밖이거나 시야 밖이면 화살표 표시
            if (isOffScreen || isOutOfVision) {
                // 화살표를 화면 경계 내로 이동
                let arrowX = Math.max(margin, Math.min(screenWidth - margin, screenX));
                let arrowY = Math.max(margin, Math.min(screenHeight - margin, screenY));
                
                // 화살표 위치 업데이트
                arrow.setPosition(arrowX, arrowY);
                
                // 화살표 방향 재계산 (플레이어 현재 위치 기준)
                const angle = Phaser.Math.Angle.Between(arrowX, arrowY, screenX, screenY);
                arrow.setRotation(angle);
                
                // 화살표가 보이도록 설정
                arrow.setVisible(true);
            } else {
                // 화면 안에 있으면 화살표 숨김
                arrow.setVisible(false);
            }
        }
    }
    
    // 와드로 탐지된 적들의 미니맵 위치 업데이트
    updateWardDetectedEnemies() {
        if (!this.player) return;
        
        const scale = this.minimapScale;
        const offsetX = this.player.x - (this.minimapSize / 2) / scale;
        const offsetY = this.player.y - (this.minimapSize / 2) / scale;
        
        // 같은 팀 플레이어들의 와드 위치만 수집
        const allWards = [];
        
        // 1. 로컬 와드 (같은 팀이므로 항상 추가)
        if (this.activeWard) {
            allWards.push(this.activeWard);
        }
        
        // 2. 같은 팀 다른 플레이어들의 와드들만 추가
        this.children.list.forEach(child => {
            if (child.texture && child.texture.key === 'ward' && child.isOtherPlayerWard) {
                // 와드를 설치한 플레이어의 팀 확인
                const wardOwner = this.otherPlayers.getChildren().find(p => p.networkId === child.wardOwnerId);
                
                if (wardOwner && wardOwner.team === this.player.team) {
                    // 같은 팀의 와드만 추가
                    allWards.push({ x: child.x, y: child.y, radius: 120 });
                }
            }
        });
        
        // 모든 적들을 모든 와드로 체크
        this.enemies.getChildren().forEach(enemy => {
            if (!enemy.isDead) {
                let isDetectedByAnyWard = false;
                
                // 모든 와드에서 적 탐지
                allWards.forEach(ward => {
                    const distance = Phaser.Math.Distance.Between(ward.x, ward.y, enemy.x, enemy.y);
                    if (distance <= ward.radius) {
                        isDetectedByAnyWard = true;
                    }
                });
                
                // 와드에 탐지된 적 처리
                if (isDetectedByAnyWard) {
                    if (!enemy.wardDetected) {
                        enemy.wardDetected = true;
                        enemy.setTint(0xff0000);
                        enemy.setAlpha(0.8);
                        
                        // 미니맵에 표시
                        if (!enemy.minimapIndicator) {
                            this.showEnemyOnMinimapForWard(enemy);
                        }
                    }
                } else {
                    if (enemy.wardDetected) {
                        enemy.wardDetected = false;
                        enemy.clearTint();
                        enemy.setAlpha(1.0);
                        
                        // 미니맵에서 제거
                        if (enemy.minimapIndicator) {
                            this.hideEnemyFromMinimapForWard(enemy);
                        }
                    }
                }
            }
        });
        
        // 와드로 탐지된 적들의 미니맵 위치 업데이트
        this.enemies.getChildren().forEach(enemy => {
            if (enemy.wardDetected && enemy.minimapIndicator) {
                const minimapX = (enemy.x - offsetX) * scale;
                const minimapY = (enemy.y - offsetY) * scale;
                
                // 미니맵 경계 내로 제한
                const clampedX = Math.max(0, Math.min(this.minimapSize, minimapX));
                const clampedY = Math.max(0, Math.min(this.minimapSize, minimapY));
                
                // 미니맵 표시 위치 업데이트
                enemy.minimapIndicator.setPosition(
                    this.minimap.x + clampedX, 
                    this.minimap.y + clampedY
                );
                
                // 미니맵 밖으로 나가면 숨김
                if (minimapX < 0 || minimapX > this.minimapSize || 
                    minimapY < 0 || minimapY > this.minimapSize) {
                    enemy.minimapIndicator.setVisible(false);
                } else {
                    enemy.minimapIndicator.setVisible(true);
                }
            }
        });
    }
    
    // 와드용 미니맵 적 표시 함수
    showEnemyOnMinimapForWard(enemy) {
        // 이미 미니맵에 표시되어 있으면 중복 생성 방지
        if (enemy.minimapIndicator) {
            return;
        }
        
        // 미니맵 위치 확인
        if (!this.minimap) {
            return;
        }
        
        // 미니맵에 빨간색 점으로 적 표시
        const scale = this.minimapScale;
        const offsetX = this.player.x - (this.minimapSize / 2) / scale;
        const offsetY = this.player.y - (this.minimapSize / 2) / scale;
        
        const minimapX = (enemy.x - offsetX) * scale;
        const minimapY = (enemy.y - offsetY) * scale;
        
        // 미니맵 경계 내로 제한
        const clampedX = Math.max(0, Math.min(this.minimapSize, minimapX));
        const clampedY = Math.max(0, Math.min(this.minimapSize, minimapY));
        
        const minimapEnemy = this.add.circle(
            this.minimap.x + clampedX,
            this.minimap.y + clampedY,
            3, // 적당한 크기
            0xff0000, 
            1.0
        );
        minimapEnemy.setScrollFactor(0);
        minimapEnemy.setDepth(1004); // 미니맵 위에 표시
        
        // 적 객체에 미니맵 표시 참조 저장
        enemy.minimapIndicator = minimapEnemy;
        
        // 깜빡이는 효과
        this.tweens.add({
            targets: minimapEnemy,
            alpha: 0.3,
            duration: 500,
            yoyo: true,
            repeat: -1
        });
    }
    
    // 와드용 미니맵 적 표시 제거 함수
    hideEnemyFromMinimapForWard(enemy) {
        if (enemy.minimapIndicator) {
            enemy.minimapIndicator.destroy();
            enemy.minimapIndicator = null;
        }
    }
}