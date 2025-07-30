const ServerUtils = require('../utils/ServerUtils');
const { getJobInfo } = require('../../shared/JobClasses');

/**
 * 투사체 매니저 - 서버에서 투사체들을 관리
 */
class ProjectileManager {
    constructor(gameStateManager) {
        this.gameStateManager = gameStateManager;
        this.projectiles = new Map(); // 투사체 ID -> 투사체 정보
        this.nextProjectileId = 1;
        
        // 투사체 타입별 설정
        this.projectileConfigs = {
            'ninja': {
                speed: 300,
                maxDistance: 300,
                size: 18,
                sprite: 'ninja_basic_attack',
                lifetime: 3000
            },
            'mage': {
                speed: 280,
                maxDistance: 350,
                size: 4,
                sprite: 'mage_projectile',
                lifetime: 3000
            },
            'archer': {
                speed: 300,
                maxDistance: 400,
                size: 16,
                sprite: 'archer_basic_attack',
                lifetime: 3000
            },
            'slime': {
                speed: 250,
                maxDistance: 200,
                size: 12,
                sprite: 'slime_basic_attack',
                lifetime: 3000
            }
        };
    }

    /**
     * 새로운 투사체 생성
     */
    createProjectile(playerId, targetX, targetY, jobClass) {
        const player = this.gameStateManager.getPlayer(playerId);
        if (!player) {
            console.error(`플레이어를 찾을 수 없음: ${playerId}`);
            return null;
        }

        const config = this.projectileConfigs[jobClass];
        if (!config) {
            console.error(`지원하지 않는 직업: ${jobClass}`);
            return null;
        }

        // 투사체 ID 생성
        const projectileId = this.nextProjectileId++;
        
        // 투사체 방향 계산
        const angle = Math.atan2(targetY - player.y, targetX - player.x);
        
                       // 투사체 정보 생성
               const projectile = {
                   id: projectileId,
                   playerId: playerId,
                   jobClass: jobClass,
                   x: player.x,
                   y: player.y,
                   startX: player.x,  // 발사 위치 저장
                   startY: player.y,  // 발사 위치 저장
                   vx: Math.cos(angle) * config.speed,
                   vy: Math.sin(angle) * config.speed,
                   targetX: targetX,
                   targetY: targetY,
                   maxDistance: config.maxDistance,
                   speed: config.speed,
                   size: config.size,
                   sprite: config.sprite,
                   lifetime: config.lifetime,
                   createdAt: Date.now(),
                   team: player.team,
                   isActive: true
               };

        this.projectiles.set(projectileId, projectile);
        
        return projectileId;
    }

    /**
     * 투사체 업데이트 (게임 루프에서 호출)
     */
    updateProjectiles(deltaTime) {
        const currentTime = Date.now();
        const projectilesToRemove = [];

        this.projectiles.forEach((projectile, projectileId) => {
            if (!projectile.isActive) {
                projectilesToRemove.push(projectileId);
                return;
            }

            // 수명 체크
            if (currentTime - projectile.createdAt > projectile.lifetime) {
                // 수명 만료 시 클라이언트에게 제거 이벤트 전송
                this.gameStateManager.io.emit('projectile-removed', {
                    projectileId: projectileId,
                    reason: 'lifetime_expired'
                });
                projectilesToRemove.push(projectileId);
                return;
            }

            // 위치 업데이트
            const dt = deltaTime / 1000; // 초 단위로 변환
            projectile.x += projectile.vx * dt;
            projectile.y += projectile.vy * dt;

                const distance = Math.sqrt(
                    Math.pow(projectile.x - projectile.startX, 2) + 
                    Math.pow(projectile.y - projectile.startY, 2)
                );
                
                if (distance > projectile.maxDistance) {
                    this.gameStateManager.io.emit('projectile-removed', {
                        projectileId: projectileId,
                        reason: 'max_distance'
                    });
                    projectilesToRemove.push(projectileId);
                    return;
                }

            // 벽 충돌 체크
            if (this.checkWallCollision(projectile)) {
                // 벽 충돌 시 클라이언트에게 충돌 이벤트 전송
                this.gameStateManager.io.emit('projectile-hit-wall', {
                    projectileId: projectileId,
                    projectileJobClass: projectile.jobClass,
                    hitPosition: { x: projectile.x, y: projectile.y }
                });
                
                // 벽 충돌 시 클라이언트에게 제거 이벤트 전송
                this.gameStateManager.io.emit('projectile-removed', {
                    projectileId: projectileId,
                    reason: 'wall_collision'
                });
                projectilesToRemove.push(projectileId);
                return;
            }

            // 플레이어 충돌 체크
            if (this.checkPlayerCollision(projectile)) {
                // 플레이어 충돌 시 클라이언트에게 제거 이벤트 전송
                this.gameStateManager.io.emit('projectile-removed', {
                    projectileId: projectileId,
                    reason: 'player_collision'
                });
                projectilesToRemove.push(projectileId);
                return;
            }

            // 적 충돌 체크
            if (this.checkEnemyCollision(projectile)) {
                // 적 충돌 시 클라이언트에게 제거 이벤트 전송
                this.gameStateManager.io.emit('projectile-removed', {
                    projectileId: projectileId,
                    reason: 'enemy_collision'
                });
                projectilesToRemove.push(projectileId);
                return;
            }
        });

        // 제거할 투사체들 처리
        projectilesToRemove.forEach(projectileId => {
            this.removeProjectile(projectileId);
        });
    }

    /**
     * 벽 충돌 체크
     */
    checkWallCollision(projectile) {
        // 맵 경계 체크 (실제 맵 크기 사용)
        const mapWidth = 12000; // 120 * 100
        const mapHeight = 12000; // 120 * 100
        
        if (projectile.x < 0 || projectile.x > mapWidth || 
            projectile.y < 0 || projectile.y > mapHeight) {
            return true;
        }

        // 벽 충돌 체크 (사각형 기반)
        const walls = this.gameStateManager.getWalls();
        const TILE_SIZE = 100; // 타일 크기
        const halfTile = TILE_SIZE / 2; // 타일의 절반
        
        for (const wall of walls) {
            // 벽의 사각형 범위 계산
            const wallLeft = wall.x - halfTile;
            const wallRight = wall.x + halfTile;
            const wallTop = wall.y - halfTile;
            const wallBottom = wall.y + halfTile;
            
            // 투사체의 사각형 범위 계산
            const projectileLeft = projectile.x - projectile.size;
            const projectileRight = projectile.x + projectile.size;
            const projectileTop = projectile.y - projectile.size;
            const projectileBottom = projectile.y + projectile.size;
            
            // 사각형 충돌 체크
            if (projectileRight >= wallLeft && 
                projectileLeft <= wallRight && 
                projectileBottom >= wallTop && 
                projectileTop <= wallBottom) {
                return true;
            }
        }

        return false;
    }

    /**
     * 플레이어 충돌 체크
     */
    checkPlayerCollision(projectile) {
        const players = this.gameStateManager.getAllPlayers();
        
        for (const player of players) {
            // 발사한 플레이어와는 충돌하지 않음
            if (player.id === projectile.playerId) {
                continue;
            }

            // 같은 팀과는 충돌하지 않음
            if (player.team === projectile.team) {
                continue;
            }

            const distance = Math.sqrt(
                Math.pow(projectile.x - player.x, 2) + 
                Math.pow(projectile.y - player.y, 2)
            );
            
            if (distance < player.size + projectile.size) {
                // 데미지 처리
                this.handlePlayerHit(projectile, player);
                return true;
            }
        }

        return false;
    }

    /**
     * 적 충돌 체크
     */
    checkEnemyCollision(projectile) {
        const enemies = this.gameStateManager.getAllEnemies();
        
        for (const enemy of enemies) {
            if (enemy.isDead) continue;

            const distance = Math.sqrt(
                Math.pow(projectile.x - enemy.x, 2) + 
                Math.pow(projectile.y - enemy.y, 2)
            );
            
            if (distance < enemy.size + projectile.size) {
                // 데미지 처리
                this.handleEnemyHit(projectile, enemy);
                return true;
            }
        }

        return false;
    }

    /**
     * 플레이어 피격 처리
     */
    handlePlayerHit(projectile, player) {
        const attacker = this.gameStateManager.getPlayer(projectile.playerId);
        if (!attacker) {
            console.error(`투사체 발사자를 찾을 수 없음: ${projectile.playerId}`);
            return;
        }

        const damage = this.getProjectileDamage(projectile.jobClass, projectile.playerId);
        
        // gameStateManager를 통한 데미지 처리
        const result = this.gameStateManager.takeDamage(attacker, player, damage);

        if (result.success) {
            // 클라이언트에게 충돌 이벤트 전송
            this.gameStateManager.io.emit('projectile-hit-player', {
                projectileId: projectile.id,
                projectileJobClass: projectile.jobClass,
                playerId: player.id,
                damage: result.actualDamage,
                newHp: result.newHp,
                hitPosition: { x: projectile.x, y: projectile.y }
            });

            console.log(`플레이어 피격: ${player.id}가 ${projectile.playerId}의 ${projectile.jobClass} 투사체에 의해 ${result.actualDamage} 데미지`);
        } else {
            console.log(`플레이어 피격 실패: ${result.reason}`);
        }
    }

    /**
     * 적 피격 처리
     */
    handleEnemyHit(projectile, enemy) {
        const attacker = this.gameStateManager.getPlayer(projectile.playerId);
        if (!attacker) {
            console.error(`투사체 발사자를 찾을 수 없음: ${projectile.playerId}`);
            return;
        }

        const damage = this.getProjectileDamage(projectile.jobClass, projectile.playerId);
        
        // gameStateManager를 통한 데미지 처리
        const result = this.gameStateManager.takeDamage(attacker, enemy, damage);

        if (result.success) {
            // 클라이언트에게 충돌 이벤트 전송
            this.gameStateManager.io.emit('projectile-hit-enemy', {
                projectileId: projectile.id,
                projectileJobClass: projectile.jobClass,
                enemyId: enemy.id,
                damage: result.actualDamage,
                newHp: result.newHp,
                hitPosition: { x: projectile.x, y: projectile.y }
            });

            console.log(`적 피격: ${enemy.id}가 ${projectile.playerId}의 ${projectile.jobClass} 투사체에 의해 ${result.actualDamage} 데미지`);
        } else {
            console.log(`적 피격 실패: ${result.reason}`);
        }
    }

    /**
     * 투사체 데미지 계산
     */
    getProjectileDamage(jobClass, playerId) {
        const player = this.gameStateManager.getPlayer(playerId);
        if (player && player.attack) {
            // 플레이어의 실제 공격력 사용
            return player.attack;
        }
        
        // fallback: JobClasses에서 기본 공격력 가져오기
        const jobInfo = getJobInfo(jobClass);
        return jobInfo.baseStats.attack;
    }

    /**
     * 투사체 제거
     */
    removeProjectile(projectileId) {
        const projectile = this.projectiles.get(projectileId);
        if (projectile) {
            projectile.isActive = false;
            this.projectiles.delete(projectileId);
        }
    }

    /**
     * 모든 투사체 정보 반환 (클라이언트 동기화용)
     */
    getAllProjectiles() {
        const activeProjectiles = [];
        
        this.projectiles.forEach(projectile => {
            if (projectile.isActive) {
                activeProjectiles.push({
                    id: projectile.id,
                    playerId: projectile.playerId,
                    jobClass: projectile.jobClass,
                    x: projectile.x,
                    y: projectile.y,
                    vx: projectile.vx,
                    vy: projectile.vy,
                    size: projectile.size,
                    sprite: projectile.sprite,
                    team: projectile.team
                });
            }
        });
        
        return activeProjectiles;
    }

    /**
     * 특정 플레이어 근처의 투사체만 반환
     */
    getProjectilesNearPlayer(playerId, range = 500) {
        const player = this.gameStateManager.getPlayer(playerId);
        if (!player) return [];

        const nearbyProjectiles = [];
        
        this.projectiles.forEach(projectile => {
            if (!projectile.isActive) return;
            
            const distance = Math.sqrt(
                Math.pow(projectile.x - player.x, 2) + 
                Math.pow(projectile.y - player.y, 2)
            );
            
            if (distance <= range) {
                nearbyProjectiles.push({
                    id: projectile.id,
                    playerId: projectile.playerId,
                    jobClass: projectile.jobClass,
                    x: projectile.x,
                    y: projectile.y,
                    vx: projectile.vx,
                    vy: projectile.vy,
                    size: projectile.size,
                    sprite: projectile.sprite,
                    team: projectile.team
                });
            }
        });
        
        return nearbyProjectiles;
    }

    /**
     * 정리 작업
     */
    cleanup() {
        this.projectiles.clear();
    }
}

module.exports = ProjectileManager; 