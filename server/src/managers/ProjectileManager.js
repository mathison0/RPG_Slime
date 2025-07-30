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
        
        // 기본 투사체 설정 (JobClasses에 없는 경우 사용)
        this.fallbackProjectileConfigs = {
            'ninja': {
                speed: 450,
                maxDistance: 300,
                size: 18,
                sprite: 'ninja_basic_attack',
                lifetime: 3000
            },
            'mage': {
                speed: 280,
                maxDistance: 400,
                size: 4,
                sprite: null,
                lifetime: 3000
            },
            'archer': {
                speed: 500,
                maxDistance: 450,
                size: 16,
                sprite: 'archer_basic_attack',
                lifetime: 3000
            },
            'slime': {
                speed: 350,
                maxDistance: 250,
                size: 12,
                sprite: 'slime_basic_attack',
                lifetime: 3000
            }
        };
    }

    /**
     * JobClasses에서 투사체 설정 가져오기
     */
    getProjectileConfig(jobClass, skillType = null) {
        const { getJobInfo } = require('../../shared/JobClasses');
        const jobInfo = getJobInfo(jobClass);
        
        let projectileSettings = null;
        
        // 특정 스킬의 투사체 설정 확인
        if (skillType) {
            const skill = jobInfo.skills.find(s => s.type === skillType);
            if (skill && skill.projectile) {
                projectileSettings = skill.projectile;
            }
        }
        
        // 기본 투사체 설정 사용
        if (!projectileSettings && jobInfo.projectile) {
            projectileSettings = jobInfo.projectile;
        }
        
        // fallback 설정 가져오기 (sprite 정보용)
        const fallbackConfig = this.fallbackProjectileConfigs[jobClass];
        
        if (!projectileSettings && !fallbackConfig) {
            console.error(`투사체 설정을 찾을 수 없음: ${jobClass}`);
            return null;
        }
        
        // JobClasses 설정과 fallback 설정 합치기
        const finalConfig = {
            speed: projectileSettings?.speed || fallbackConfig?.speed || 300,
            maxDistance: projectileSettings?.maxDistance || fallbackConfig?.maxDistance || 300,
            size: projectileSettings?.size || fallbackConfig?.size || 10,
            sprite: fallbackConfig?.sprite || 'projectile', // sprite는 항상 fallback에서
            lifetime: fallbackConfig?.lifetime || 3000
        };
        
        return finalConfig;
    }

    /**
     * 새로운 투사체 생성
     * @param {string|Object} playerIdOrConfig - 플레이어 ID 또는 투사체 설정 객체
     * @param {number} targetX - 목표 X 좌표 (첫 번째 파라미터가 ID일 때)
     * @param {number} targetY - 목표 Y 좌표 (첫 번째 파라미터가 ID일 때)
     * @param {string} jobClass - 직업 클래스 (첫 번째 파라미터가 ID일 때)
     */
    createProjectile(playerIdOrConfig, targetX, targetY, jobClass) {
        let playerId, config, x, y, damage, speed, size, attackType, skillType;
        
        // 파라미터가 객체인 경우 (새로운 방식)
        if (typeof playerIdOrConfig === 'object') {
            const projectileConfig = playerIdOrConfig;
            playerId = projectileConfig.playerId;
            x = projectileConfig.x;
            y = projectileConfig.y;
            targetX = projectileConfig.targetX;
            targetY = projectileConfig.targetY;
            damage = projectileConfig.damage;
            speed = projectileConfig.speed;
            size = projectileConfig.size;
            jobClass = projectileConfig.jobClass;
            attackType = projectileConfig.attackType;
            skillType = projectileConfig.attackType === 'magic_missile' ? 'magic_missile' : null;
            
            // JobClasses에서 투사체 설정 가져오기
            config = this.getProjectileConfig(jobClass, skillType);
            if (!config) {
                return null;
            }
            
            // 커스텀 값이 있으면 덮어쓰기
            if (speed !== undefined) config.speed = speed;
            if (size !== undefined) config.size = size;
        } else {
            // 기존 방식 (레거시 지원)
            playerId = playerIdOrConfig;
            const player = this.gameStateManager.getPlayer(playerId);
            if (!player) {
                console.error(`플레이어를 찾을 수 없음: ${playerId}`);
                return null;
            }
            
            config = this.getProjectileConfig(jobClass);
            if (!config) {
                return null;
            }
            
            x = player.x;
            y = player.y;
            damage = player.attack;
            attackType = 'basic';
        }

        const player = this.gameStateManager.getPlayer(playerId);
        if (!player) {
            console.error(`플레이어를 찾을 수 없음: ${playerId}`);
            return null;
        }

        // 투사체 ID 생성
        const projectileId = this.nextProjectileId++;
        
        // 투사체 방향 계산
        const angle = Math.atan2(targetY - y, targetX - x);
        
        // 투사체 정보 생성
        const projectile = {
            id: projectileId,
            playerId: playerId,
            jobClass: jobClass,
            x: x,
            y: y,
            startX: x,  // 발사 위치 저장
            startY: y,  // 발사 위치 저장
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
            isActive: true,
            damage: damage,
            attackType: attackType,
            explosionRadius: playerIdOrConfig.explosionRadius // 마법 미사일용
        };

        this.projectiles.set(projectileId, projectile);
        
        console.log(`투사체 생성: ID=${projectileId}, 직업=${jobClass}, 속도=${config.speed}, 크기=${config.size}, 스프라이트=${config.sprite}`);
        
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
            // 자기 자신은 제외
            if (player.id === projectile.playerId) continue;
            
            // 같은 팀은 제외
            if (player.team === projectile.team) continue;
            
            // 죽은 플레이어 제외
            if (player.isDead) continue;

            const distance = Math.sqrt(
                Math.pow(projectile.x - player.x, 2) + 
                Math.pow(projectile.y - player.y, 2)
            );
            
            // 캐릭터 크기를 고려한 충돌 검사
            const playerRadius = (player.size || 32) / 2;
            const projectileRadius = projectile.size / 2;
            
            if (distance < playerRadius + projectileRadius) {
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
            
            // 캐릭터 크기를 고려한 충돌 검사
            const enemyRadius = (enemy.size || 32) / 2;
            const projectileRadius = projectile.size / 2;
            
            if (distance < enemyRadius + projectileRadius) {
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