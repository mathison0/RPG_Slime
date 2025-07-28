/**
 * 맵 관리 매니저
 * 맵 생성, 충돌 처리, 스폰 구역 관리를 담당합니다.
 */
export default class MapManager {
    constructor(scene) {
        this.scene = scene;
        
        // 맵 관련 상수
        this.WALL_COLLISION_BUFFER = -15;
        
        // 충돌체들
        this.playerWallCollider = null;
        this.enemyWallCollider = null;
        this.otherPlayerWallCollider = null;
        this.playerEnemyCollider = null;
        this.enemyWardCollider = null;
        
        // 벽 선분 정보 (시야 계산용)
        this.wallLines = [];
    }

    /**
     * 서버 맵 데이터로 맵 재생성
     */
    recreateMapFromServer(mapData) {
        console.log('서버 맵 데이터로 맵 재생성:', mapData);
        
        // 기존 맵 제거
        this.destroyExistingMap();
        
        // 서버 맵 데이터 적용
        this.applyMapData(mapData);
        
        // 맵 요소들 생성
        this.createMapElements(mapData);
        
        // 시각적 구역 표시
        this.createVisualZones();
        
        // 벽 선분 정보 생성 (시야 계산용)
        this.generateWallLines();
        
        // 미니맵 재초기화
        this.scene.minimapManager?.reinitializeMinimap(this.scene.isFirstJoin, this.scene.playerTeam);
        
        console.log(`맵 재생성 완료: 벽 ${this.scene.walls.getChildren().length}개`);
    }

    /**
     * 기존 맵 요소들 제거
     */
    destroyExistingMap() {
        if (this.scene.walls) {
            this.scene.walls.clear(true, true);
        }
        
        if (this.scene.spawnBarriers) {
            this.scene.spawnBarriers.clear(true, true);
        }
        
        // 기존 스폰 구역 표시 제거
        this.scene.children.list.forEach(child => {
            if (child.type === 'Rectangle' && child.depth === -1) {
                child.destroy();
            }
        });
    }

    /**
     * 맵 데이터 적용
     */
    applyMapData(mapData) {
        this.scene.MAP_WIDTH = mapData.MAP_WIDTH;
        this.scene.MAP_HEIGHT = mapData.MAP_HEIGHT;
        this.scene.TILE_SIZE = mapData.TILE_SIZE;
        this.scene.SPAWN_WIDTH = mapData.SPAWN_WIDTH;
        this.scene.PLAZA_SIZE = mapData.PLAZA_SIZE;
        this.scene.PLAZA_X = mapData.PLAZA_X;
        this.scene.PLAZA_Y = mapData.PLAZA_Y;

        this.scene.physics.world.setBounds(0, 0, this.scene.MAP_WIDTH, this.scene.MAP_HEIGHT);
    }

    /**
     * 맵 요소들 생성
     */
    createMapElements(mapData) {
        this.scene.walls = this.scene.physics.add.staticGroup();

        // 서버에서 받은 벽 데이터로 벽 생성
        mapData.walls.forEach(wallPos => {
            this.scene.walls.create(wallPos.x, wallPos.y, 'wall')
                .setSize(this.scene.TILE_SIZE, this.scene.TILE_SIZE)
                .refreshBody();
        });

        // 스폰 구역 정보 설정
        this.scene.redSpawnRect = new Phaser.Geom.Rectangle(
            mapData.redSpawnRect.x, 
            mapData.redSpawnRect.y, 
            mapData.redSpawnRect.width, 
            mapData.redSpawnRect.height
        );
        
        this.scene.blueSpawnRect = new Phaser.Geom.Rectangle(
            mapData.blueSpawnRect.x, 
            mapData.blueSpawnRect.y, 
            mapData.blueSpawnRect.width, 
            mapData.blueSpawnRect.height
        );

        // 상대팀 스폰 구역에 물리적 벽 생성
        this.createSpawnBarriers();
    }

    /**
     * 시각적 구역 표시
     */
    createVisualZones() {
        // 스폰 구역 표시
        this.scene.add.rectangle(
            this.scene.SPAWN_WIDTH / 2, 
            this.scene.MAP_HEIGHT / 2, 
            this.scene.SPAWN_WIDTH, 
            this.scene.MAP_HEIGHT, 
            0xff0000, 
            0.25
        ).setDepth(-1);
        
        this.scene.add.rectangle(
            this.scene.MAP_WIDTH - this.scene.SPAWN_WIDTH / 2, 
            this.scene.MAP_HEIGHT / 2, 
            this.scene.SPAWN_WIDTH, 
            this.scene.MAP_HEIGHT, 
            0x0000ff, 
            0.25
        ).setDepth(-1);
        
        // 광장 구역 표시
        this.scene.plazaRect = new Phaser.Geom.Rectangle(
            this.scene.PLAZA_X, 
            this.scene.PLAZA_Y, 
            this.scene.PLAZA_SIZE, 
            this.scene.PLAZA_SIZE
        );
        
        this.scene.add.rectangle(
            this.scene.plazaRect.centerX, 
            this.scene.plazaRect.centerY, 
            this.scene.PLAZA_SIZE, 
            this.scene.PLAZA_SIZE, 
            0xffff00, 
            0.15
        ).setDepth(-1);
    }

    /**
     * 상대팀 스폰 배리어 구역 시각적 표시 생성
     */
    createSpawnBarriers() {
        if (!this.scene.player) return;
        
        // 서버 설정과 동일한 확장 크기
        const extraWidth = 4 * 100; // SPAWN_BARRIER_EXTRA_TILES * TILE_SIZE
        const extraHeight = extraWidth;
        
        if (this.scene.player.team === 'red') {
            // 빨간팀 플레이어는 파란팀 스폰 구역 바깥 테두리를 빨간색으로 표시
            this.createSpawnBarrierBorder(this.scene.blueSpawnRect, extraWidth, extraHeight);
            console.log(`빨간팀 플레이어 - 파란팀 스폰 배리어 테두리를 위험 지역으로 표시`);
            
        } else if (this.scene.player.team === 'blue') {
            // 파란팀 플레이어는 빨간팀 스폰 구역 바깥 테두리를 빨간색으로 표시
            this.createSpawnBarrierBorder(this.scene.redSpawnRect, extraWidth, extraHeight);
            console.log(`파란팀 플레이어 - 빨간팀 스폰 배리어 테두리를 위험 지역으로 표시`);
        }
    }
    
    /**
     * 스폰 구역 바깥 테두리만 빨간색으로 표시
     */
    createSpawnBarrierBorder(spawnRect, extraWidth, extraHeight) {
        const graphics = this.scene.add.graphics();
        graphics.fillStyle(0xff0000, 0.3);
        graphics.setDepth(-2);
        
        // 위쪽 테두리
        graphics.fillRect(
            spawnRect.x - extraWidth,
            spawnRect.y - extraHeight,
            spawnRect.width + extraWidth * 2,
            extraHeight
        );
        
        // 아래쪽 테두리
        graphics.fillRect(
            spawnRect.x - extraWidth,
            spawnRect.y + spawnRect.height,
            spawnRect.width + extraWidth * 2,
            extraHeight
        );
        
        // 왼쪽 테두리
        graphics.fillRect(
            spawnRect.x - extraWidth,
            spawnRect.y,
            extraWidth,
            spawnRect.height
        );
        
        // 오른쪽 테두리
        graphics.fillRect(
            spawnRect.x + spawnRect.width,
            spawnRect.y,
            extraWidth,
            spawnRect.height
        );
        
        // 경고 텍스트를 테두리 위쪽에 표시
        this.scene.add.text(
            spawnRect.centerX,
            spawnRect.y - extraHeight / 2,
            '⚠️ 적 스폰 배리어 ⚠️',
            {
                fontSize: '24px',
                fill: '#ff0000',
                fontStyle: 'bold',
                stroke: '#000',
                strokeThickness: 3,
                align: 'center'
            }
        ).setOrigin(0.5).setDepth(-1);
        
        // 체력 감소 텍스트를 아래쪽에 표시
        this.scene.add.text(
            spawnRect.centerX,
            spawnRect.y + spawnRect.height + extraHeight / 2,
            '체력 감소!',
            {
                fontSize: '20px',
                fill: '#ff0000',
                fontStyle: 'bold',
                stroke: '#000',
                strokeThickness: 3,
                align: 'center'
            }
        ).setOrigin(0.5).setDepth(-1);
    }

    /**
     * 벽 선분 정보 생성 (시야 계산용)
     */
    generateWallLines() {
        this.wallLines = [];
        
        this.scene.walls.getChildren().forEach(wall => {
            const bounds = wall.getBounds();
            this.wallLines.push(
                new Phaser.Geom.Line(bounds.left, bounds.top, bounds.right, bounds.top),
                new Phaser.Geom.Line(bounds.right, bounds.top, bounds.right, bounds.bottom),
                new Phaser.Geom.Line(bounds.left, bounds.bottom, bounds.right, bounds.bottom),
                new Phaser.Geom.Line(bounds.left, bounds.top, bounds.left, bounds.bottom)
            );
        });
    }

    /**
     * 물리 충돌 설정
     */
    setupCollisions() {
        // 기존 충돌 제거
        this.destroyColliders();
        
        if (!this.scene.player) return;
        
        // 플레이어가 생성된 후 스폰 구역 위험 지역 표시
        this.createSpawnBarriers();
        
        // 새 충돌 설정
        this.playerWallCollider = this.scene.physics.add.collider(
            this.scene.player, 
            this.scene.walls, 
            null, 
            this.scene.player.handleWallCollision, 
            this.scene.player
        );
        
        this.enemyWallCollider = this.scene.physics.add.collider(
            this.scene.enemies, 
            this.scene.walls
        );
        
        this.otherPlayerWallCollider = this.scene.physics.add.collider(
            this.scene.otherPlayers, 
            this.scene.walls
        );
        
        this.playerEnemyCollider = this.scene.physics.add.collider(
            this.scene.player, 
            this.scene.enemies, 
            this.handlePlayerEnemyCollision, 
            null, 
            this.scene
        );
        

      
        // 와드 충돌 설정
        if (this.scene.activeWard?.sprite) {
            this.enemyWardCollider = this.scene.physics.add.collider(
                this.scene.enemies, 
                this.scene.activeWard.sprite, 
                this.handleEnemyWardCollision, 
                null, 
                this.scene
            );
        }
        
        console.log('물리 충돌 설정 완료');
    }

    /**
     * 기존 충돌체들 제거
     */
    destroyColliders() {
        const colliders = [
            'playerWallCollider',
            'enemyWallCollider', 
            'otherPlayerWallCollider',
            'playerEnemyCollider',
            'enemyWardCollider'
        ];
        
        colliders.forEach(colliderName => {
            if (this[colliderName]) {
                this[colliderName].destroy();
                this[colliderName] = null;
            }
        });
    }

    /**
     * 플레이어-적 충돌 처리
     */
    handlePlayerEnemyCollision(player, enemy) {
        if (player === this.scene.player && player.body.velocity.length() > 50) {
            // 서버에 적 공격 알림
            if (this.scene.networkManager && enemy.networkId) {
                this.scene.networkManager.hitEnemy(enemy.networkId);
            }
            
            // 넉백 효과
            const angle = Phaser.Math.Angle.Between(player.x, player.y, enemy.x, enemy.y);
            const knockbackForce = 200;
            enemy.setVelocity(
                Math.cos(angle) * knockbackForce,
                Math.sin(angle) * knockbackForce
            );
        }
    }
    
    /**
     * 적-와드 충돌 처리
     */
    handleEnemyWardCollision(enemy, ward) {
        if (this.scene.activeWard && this.scene.activeWard.hp > 0) {
            const damage = 20;
            this.scene.activeWard.hp -= damage;
            
            // 와드 데미지 이펙트
            ward.setTint(0xff0000);
            this.scene.time.delayedCall(200, () => {
                ward.clearTint();
            });
            
            console.log(`와드가 공격받음! 남은 체력: ${this.scene.activeWard.hp}/${this.scene.activeWard.maxHp}`);
            
            // 와드 파괴
            if (this.scene.activeWard.hp <= 0) {
                this.destroyWard(ward);
            }
        }
    }

    /**
     * 와드 파괴 처리
     */
    destroyWard(ward) {
        console.log('와드가 파괴되었습니다!');
        
        // 파괴 이펙트
        this.scene.effectManager.showExplosion(ward.x, ward.y, 0xff0000, 50);
        
        // 와드 파괴 함수 호출
        if (ward.destroyWard) {
            ward.destroyWard();
        }
        
        // 네트워크에 와드 파괴 알림
        if (this.scene.networkManager) {
            this.scene.networkManager.emit('ward-destroyed', {
                playerId: this.scene.networkManager.playerId,
                x: ward.x,
                y: ward.y
            });
        }
        
        // 충돌 설정 업데이트
        this.setupCollisions();
    }

    /**
     * 플레이어가 벽과 충돌하는지 체크 (모든 충돌하는 벽 반환)
     */
    checkPlayerWallCollision() {
        return this.getAllCollidingWalls();
    }

    /**
     * 모든 충돌하는 벽들 찾기
     */
    getAllCollidingWalls() {
        if (!this.scene.player || !this.scene.walls?.children) {
            return [];
        }

        const playerBounds = this.scene.player.getBounds();
        const collidingWalls = [];
        
        const expandedBounds = new Phaser.Geom.Rectangle(
            playerBounds.x - this.WALL_COLLISION_BUFFER,
            playerBounds.y - this.WALL_COLLISION_BUFFER,
            playerBounds.width + this.WALL_COLLISION_BUFFER * 2,
            playerBounds.height + this.WALL_COLLISION_BUFFER * 2
        );

        for (let wall of this.scene.walls.children.entries) {
            const wallBounds = wall.getBounds();
            
            if (Phaser.Geom.Rectangle.Overlaps(expandedBounds, wallBounds)) {
                collidingWalls.push(wall);
            }
        }
        
        return collidingWalls;
    }

    /**
     * 플레이어를 벽들 밖으로 강제 이동 (개선된 로직)
     */
    pushPlayerOutOfWall(collidingWalls) {
        if (!this.scene.player || !collidingWalls || collidingWalls.length === 0) {
            return;
        }

        // 단일 벽인 경우 기존 로직 사용
        if (collidingWalls.length === 1) {
            this.pushPlayerOutOfSingleWall(collidingWalls[0]);
            return;
        }

        // 다중 벽인 경우 개선된 로직 사용
        this.pushPlayerOutOfMultipleWalls(collidingWalls);
    }

    /**
     * 단일 벽에서 플레이어 밀어내기
     */
    pushPlayerOutOfSingleWall(wall) {
        const playerBounds = this.scene.player.getBounds();
        const wallBounds = wall.getBounds();
        
        const playerCenterX = playerBounds.centerX;
        const playerCenterY = playerBounds.centerY;
        const wallCenterX = wallBounds.centerX;
        const wallCenterY = wallBounds.centerY;
        
        const deltaX = playerCenterX - wallCenterX;
        const deltaY = playerCenterY - wallCenterY;
        
        const overlapX = (playerBounds.width / 2 + wallBounds.width / 2) - Math.abs(deltaX);
        const overlapY = (playerBounds.height / 2 + wallBounds.height / 2) - Math.abs(deltaY);
        
        const minSeparation = 2;
        
        if (overlapX < overlapY) {
            if (deltaX > 0) {
                this.scene.player.x += overlapX + minSeparation;
            } else {
                this.scene.player.x -= overlapX + minSeparation;
            }
        } else {
            if (deltaY > 0) {
                this.scene.player.y += overlapY + minSeparation;
            } else {
                this.scene.player.y -= overlapY + minSeparation;
            }
        }

        this.clampPlayerToWorldBounds();
    }

    /**
     * 다중 벽에서 플레이어 밀어내기 (연결된 벽 고려)
     */
    pushPlayerOutOfMultipleWalls(collidingWalls) {
        const playerBounds = this.scene.player.getBounds();
        const playerCenter = { x: playerBounds.centerX, y: playerBounds.centerY };
        
        // 각 방향별로 밀어낼 거리 계산
        const pushDirections = this.calculatePushDirections(collidingWalls, playerCenter, playerBounds);
        
        // 가장 안전한 방향 찾기
        const safestDirection = this.findSafestPushDirection(pushDirections, collidingWalls, playerBounds);
        
        if (safestDirection) {
            // 안전한 방향으로 밀어내기
            this.scene.player.x += safestDirection.x;
            this.scene.player.y += safestDirection.y;
            
            console.log(`다중 벽 충돌: ${collidingWalls.length}개 벽에서 (${safestDirection.x.toFixed(1)}, ${safestDirection.y.toFixed(1)}) 방향으로 밀어냄`);
        } else {
            // 안전한 방향이 없으면 최소 겹침 방향으로 강제 밀어내기
            this.forceMinimalPush(collidingWalls, playerCenter, playerBounds);
        }

        this.clampPlayerToWorldBounds();
    }

    /**
     * 각 벽에 대한 밀어낼 방향과 거리 계산
     */
    calculatePushDirections(collidingWalls, playerCenter, playerBounds) {
        const directions = [];
        
        collidingWalls.forEach(wall => {
            const wallBounds = wall.getBounds();
            const wallCenter = { x: wallBounds.centerX, y: wallBounds.centerY };
            
            const deltaX = playerCenter.x - wallCenter.x;
            const deltaY = playerCenter.y - wallCenter.y;
            
            const overlapX = (playerBounds.width / 2 + wallBounds.width / 2) - Math.abs(deltaX);
            const overlapY = (playerBounds.height / 2 + wallBounds.height / 2) - Math.abs(deltaY);
            
            if (overlapX > 0 && overlapY > 0) {
                // 4방향으로 밀어낼 수 있는 거리 계산
                directions.push({
                    wall: wall,
                    right: deltaX > 0 ? overlapX + 2 : -1,
                    left: deltaX < 0 ? overlapX + 2 : -1,
                    down: deltaY > 0 ? overlapY + 2 : -1,
                    up: deltaY < 0 ? overlapY + 2 : -1,
                    overlapX: overlapX,
                    overlapY: overlapY
                });
            }
        });
        
        return directions;
    }

    /**
     * 가장 안전한 밀어내기 방향 찾기
     */
    findSafestPushDirection(pushDirections, collidingWalls, playerBounds) {
        const candidateDirections = [
            { name: 'right', x: 1, y: 0 },
            { name: 'left', x: -1, y: 0 },
            { name: 'down', x: 0, y: 1 },
            { name: 'up', x: 0, y: -1 }
        ];

        let bestDirection = null;
        let minPushDistance = Infinity;

        for (let candidate of candidateDirections) {
            let maxPushDistance = 0;
            let canPushInDirection = true;

            // 이 방향으로 밀어내기 위해 필요한 최대 거리 계산
            for (let pushInfo of pushDirections) {
                const requiredDistance = pushInfo[candidate.name];
                
                if (requiredDistance < 0) {
                    // 이 방향으로는 밀어낼 수 없음
                    canPushInDirection = false;
                    break;
                }
                
                maxPushDistance = Math.max(maxPushDistance, requiredDistance);
            }

            if (canPushInDirection && maxPushDistance < minPushDistance) {
                // 이 방향으로 밀어낸 후의 위치가 다른 벽과 충돌하는지 확인
                const testX = this.scene.player.x + candidate.x * maxPushDistance;
                const testY = this.scene.player.y + candidate.y * maxPushDistance;
                
                if (this.isPositionSafe(testX, testY, playerBounds, collidingWalls)) {
                    minPushDistance = maxPushDistance;
                    bestDirection = {
                        x: candidate.x * maxPushDistance,
                        y: candidate.y * maxPushDistance
                    };
                }
            }
        }

        return bestDirection;
    }

    /**
     * 특정 위치가 안전한지 확인 (다른 벽과 충돌하지 않는지)
     */
    isPositionSafe(testX, testY, playerBounds, excludeWalls) {
        const testBounds = new Phaser.Geom.Rectangle(
            testX - playerBounds.width / 2,
            testY - playerBounds.height / 2,
            playerBounds.width,
            playerBounds.height
        );

        // 맵 경계 확인
        if (testX < playerBounds.width / 2 || testX > this.scene.MAP_WIDTH - playerBounds.width / 2 ||
            testY < playerBounds.height / 2 || testY > this.scene.MAP_HEIGHT - playerBounds.height / 2) {
            return false;
        }

        // 다른 벽들과의 충돌 확인
        for (let wall of this.scene.walls.children.entries) {
            if (excludeWalls.includes(wall)) continue;
            
            const wallBounds = wall.getBounds();
            if (Phaser.Geom.Rectangle.Overlaps(testBounds, wallBounds)) {
                return false;
            }
        }

        return true;
    }

    /**
     * 안전한 방향이 없을 때 최소 겹침으로 강제 밀어내기
     */
    forceMinimalPush(collidingWalls, playerCenter, playerBounds) {
        let minOverlap = Infinity;
        let bestPush = { x: 0, y: 0 };

        collidingWalls.forEach(wall => {
            const wallBounds = wall.getBounds();
            const wallCenter = { x: wallBounds.centerX, y: wallBounds.centerY };
            
            const deltaX = playerCenter.x - wallCenter.x;
            const deltaY = playerCenter.y - wallCenter.y;
            
            const overlapX = (playerBounds.width / 2 + wallBounds.width / 2) - Math.abs(deltaX);
            const overlapY = (playerBounds.height / 2 + wallBounds.height / 2) - Math.abs(deltaY);
            
            if (overlapX < overlapY && overlapX < minOverlap) {
                minOverlap = overlapX;
                bestPush = { 
                    x: deltaX > 0 ? overlapX + 2 : -(overlapX + 2), 
                    y: 0 
                };
            } else if (overlapY < minOverlap) {
                minOverlap = overlapY;
                bestPush = { 
                    x: 0, 
                    y: deltaY > 0 ? overlapY + 2 : -(overlapY + 2) 
                };
            }
        });

        this.scene.player.x += bestPush.x;
        this.scene.player.y += bestPush.y;
        
        console.log(`강제 최소 밀어내기: (${bestPush.x.toFixed(1)}, ${bestPush.y.toFixed(1)})`);
    }

    /**
     * 플레이어를 월드 경계 내로 제한
     */
    clampPlayerToWorldBounds() {
        const playerBounds = this.scene.player.getBounds();
        
        this.scene.player.x = Phaser.Math.Clamp(
            this.scene.player.x, 
            playerBounds.width / 2, 
            this.scene.MAP_WIDTH - playerBounds.width / 2
        );
        this.scene.player.y = Phaser.Math.Clamp(
            this.scene.player.y, 
            playerBounds.height / 2, 
            this.scene.MAP_HEIGHT - playerBounds.height / 2
        );
    }

    /**
     * 스폰 구역 이동 제한
     */
    restrictMovement() {
        // 적들만 스폰 구역에서 밀어내기
        if (this.scene.enemies?.children) {
            this.scene.enemies.getChildren().forEach(enemy => {
                if (this.scene.redSpawnRect.contains(enemy.x, enemy.y)) {
                    enemy.x = this.scene.redSpawnRect.right + this.scene.TILE_SIZE;
                } 
                else if (this.scene.blueSpawnRect.contains(enemy.x, enemy.y)) {
                    enemy.x = this.scene.blueSpawnRect.x - this.scene.TILE_SIZE;
                }
            });
        }
    }

    /**
     * 랜덤 위치 생성
     */
    getRandomPointInRect(rect) {
        return {
            x: Phaser.Math.Between(rect.x + this.scene.TILE_SIZE, rect.right - this.scene.TILE_SIZE),
            y: Phaser.Math.Between(rect.y + this.scene.TILE_SIZE, rect.bottom - this.scene.TILE_SIZE)
        };
    }

    /**
     * 정리 작업
     */
    destroy() {
        this.destroyColliders();
        this.wallLines = [];
    }
} 