/**
 * 클라이언트 투사체 매니저 - 서버에서 받은 투사체 정보를 렌더링
 */
export default class ProjectileManager {
    constructor(scene) {
        this.scene = scene;
        this.projectiles = new Map(); // 투사체 ID -> 투사체 스프라이트
        this.projectileConfigs = {
            'ninja': {
                sprite: 'ninja_basic_attack',
                size: 18,
                rotation: true
            },
                               'mage': {
                       sprite: null, // 원형으로 렌더링
                       size: 4,
                       color: 0x00ffff, // 밝은 청록색으로 변경
                       rotation: false
                   },
            'archer': {
                sprite: 'archer_basic_attack',
                size: 16,
                rotation: true
            },
            'slime': {
                sprite: 'slime_basic_attack',
                size: 12,
                rotation: true
            }
        };
    }

    /**
     * 서버에서 투사체 생성 이벤트 처리
     */
    handleProjectileCreated(data) {
        const { projectileId, playerId, jobClass, x, y, targetX, targetY, team } = data;
        
        const config = this.projectileConfigs[jobClass];
        if (!config) {
            console.error(`지원하지 않는 직업: ${jobClass}`);
            return;
        }

        let projectile;
        
        if (config.sprite) {
            // 스프라이트 기반 투사체
            projectile = this.scene.add.sprite(x, y, config.sprite);
            projectile.setDisplaySize(config.size, config.size);
            
            // 회전 설정
            if (config.rotation) {
                const angle = Math.atan2(targetY - y, targetX - x);
                projectile.setRotation(angle);
            }
        } else {
            // 원형 투사체 (마법사)
            projectile = this.scene.add.circle(x, y, config.size, config.color, 1);
        }

        // 물리 바디 추가
        this.scene.physics.add.existing(projectile);
        projectile.body.setCircle(config.size);
        projectile.body.setCollideWorldBounds(false);
        projectile.body.setBounce(0, 0);
        projectile.body.setDrag(0, 0);

        // 투사체 정보 저장
        projectile.projectileId = projectileId;
        projectile.playerId = playerId;
        projectile.jobClass = jobClass;
        projectile.team = team;
        projectile.targetX = targetX;
        projectile.targetY = targetY;

        // 투사체를 맵에 저장
        this.projectiles.set(projectileId, projectile);

        // 투사체 이펙트 추가
        this.addProjectileEffects(projectile, jobClass);
    }

    /**
     * 서버에서 투사체 업데이트 이벤트 처리
     */
    handleProjectilesUpdate(data) {
        const { projectiles } = data;
        
        // 현재 로컬 플레이어 위치
        const localPlayer = this.scene.player;
        if (!localPlayer) return;

        // 로컬 플레이어 근처의 투사체만 렌더링
        const renderRange = 1000;
        const nearbyProjectiles = projectiles.filter(projectile => {
            const distance = Math.sqrt(
                Math.pow(projectile.x - localPlayer.x, 2) + 
                Math.pow(projectile.y - localPlayer.y, 2)
            );
            return distance <= renderRange;
        });

        // 기존 투사체들 제거 (더 이상 서버에 없는 것들)
        this.projectiles.forEach((projectile, projectileId) => {
            const stillExists = nearbyProjectiles.some(p => p.id === projectileId);
            if (!stillExists) {
                this.removeProjectile(projectileId);
            }
        });

        // 새로운 투사체들 생성 또는 업데이트
        nearbyProjectiles.forEach(projectileData => {
            const existingProjectile = this.projectiles.get(projectileData.id);
            
            if (existingProjectile) {
                // 기존 투사체 위치 업데이트
                existingProjectile.x = projectileData.x;
                existingProjectile.y = projectileData.y;
                if (existingProjectile.body) {
                    existingProjectile.body.reset(projectileData.x, projectileData.y);
                }
            } else {
                // 새 투사체 생성
                this.createProjectileFromServerData(projectileData);
            }
        });
    }

    /**
     * 서버 데이터로부터 투사체 생성
     */
    createProjectileFromServerData(projectileData) {
        const { id, playerId, jobClass, x, y, vx, vy, size, sprite, team } = projectileData;
        
        const config = this.projectileConfigs[jobClass];
        if (!config) return;

        let projectile;
        
        if (config.sprite && sprite) {
            // 스프라이트 기반 투사체
            projectile = this.scene.add.sprite(x, y, sprite);
            projectile.setDisplaySize(size, size);
            
            // 회전 설정
            if (config.rotation) {
                const angle = Math.atan2(vy, vx);
                projectile.setRotation(angle);
            }
        } else {
            // 원형 투사체 (마법사)
            projectile = this.scene.add.circle(x, y, size, config.color, 1);
        }

        // 물리 바디 추가
        this.scene.physics.add.existing(projectile);
        projectile.body.setCircle(size);
        projectile.body.setCollideWorldBounds(false);
        projectile.body.setBounce(0, 0);
        projectile.body.setDrag(0, 0);

        // 투사체 정보 저장
        projectile.projectileId = id;
        projectile.playerId = playerId;
        projectile.jobClass = jobClass;
        projectile.team = team;

        // 투사체를 맵에 저장
        this.projectiles.set(id, projectile);

        // 투사체 이펙트 추가
        this.addProjectileEffects(projectile, jobClass);
    }

    /**
     * 투사체 이펙트 추가
     */
    addProjectileEffects(projectile, jobClass) {
        // 투사체별 이펙트
        switch (jobClass) {
            case 'ninja':
                // 수리검 회전 효과
                this.scene.tweens.add({
                    targets: projectile,
                    angle: projectile.angle + 360,
                    duration: 1000,
                    repeat: -1
                });
                break;
                
            case 'mage':
                // 마법 투사체 빛나는 효과
                this.scene.tweens.add({
                    targets: projectile,
                    scaleX: 1.5,
                    scaleY: 1.5,
                    alpha: 0.5,
                    duration: 200,
                    yoyo: true,
                    repeat: -1
                });
                break;
                
            case 'archer':
                this.scene.tweens.add({
                    targets: projectile,
                });
                break;
                
            case 'slime':
                this.scene.tweens.add({
                    targets: projectile,
                });
                break;
        }
    }

    /**
     * 투사체 제거
     */
    removeProjectile(projectileId) {
        const projectile = this.projectiles.get(projectileId);
        if (projectile) {
            // 모든 Tween 애니메이션 중지
            this.scene.tweens.killTweensOf(projectile);
            
            // 투사체 파괴
            projectile.destroy();
            
            // 맵에서 제거
            this.projectiles.delete(projectileId);
        }
    }

    /**
     * 서버에서 투사체 제거 이벤트 처리
     */
    handleProjectileRemoved(data) {
        const { projectileId, reason } = data;
        
        // 투사체 제거
        this.removeProjectile(projectileId);
        
        // 제거 이유에 따른 이펙트 추가 (필요시)
        switch (reason) {
            case 'max_distance':
                // 최대 거리 도달 시 이펙트
                break;
            case 'wall_collision':
                // 벽 충돌 시 이펙트
                break;
            case 'player_collision':
                // 플레이어 충돌 시 이펙트
                break;
            case 'enemy_collision':
                // 적 충돌 시 이펙트
                break;
            case 'lifetime_expired':
                // 수명 만료 시 이펙트
                break;
        }
    }

    /**
     * 모든 투사체 제거
     */
    clearAllProjectiles() {
        this.projectiles.forEach((projectile, projectileId) => {
            this.scene.tweens.killTweensOf(projectile);
            projectile.destroy();
        });
        this.projectiles.clear();
    }

    /**
     * 정리 작업
     */
    destroy() {
        this.clearAllProjectiles();
    }
} 