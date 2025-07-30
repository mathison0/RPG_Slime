/**
 * 클라이언트 투사체 매니저 - 서버에서 받은 투사체 정보를 렌더링
 */
export default class ProjectileManager {
    constructor(scene) {
        this.scene = scene;
        this.projectiles = new Map(); // 투사체 ID -> 투사체 스프라이트
        
        // 기본 투사체 설정 (fallback용)
        this.fallbackProjectileConfigs = {
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
        
        // 보간 관련 설정
        this.interpolationEnabled = true;
        this.lastUpdateTime = Date.now();
    }

    /**
     * 투사체 설정 가져오기 (fallback만 사용)
     */
    getProjectileConfig(jobClass) {
        const config = this.fallbackProjectileConfigs[jobClass];
        if (!config) {
            console.error(`투사체 설정을 찾을 수 없음: ${jobClass}`);
            return {
                sprite: null,
                size: 10,
                color: 0xffffff,
                rotation: false
            };
        }
        return config;
    }

    /**
     * 매 프레임마다 투사체 보간 업데이트
     */
    update(deltaTime) {
        if (!this.interpolationEnabled) return;
        
        const now = Date.now();
        const dt = Math.min(deltaTime / 1000, 1/30); // 최대 30fps로 제한
        
        this.projectiles.forEach((projectile) => {
            if (!projectile.isActive || !projectile.targetPosition) return;
            
            // 목표 위치와 현재 위치 간의 거리 계산
            const dx = projectile.targetPosition.x - projectile.x;
            const dy = projectile.targetPosition.y - projectile.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            // 너무 가까우면 즉시 이동
            if (distance < 5) {
                projectile.x = projectile.targetPosition.x;
                projectile.y = projectile.targetPosition.y;
                projectile.targetPosition = null;
                return;
            }
            
            // 보간 속도 계산 (거리가 클수록 빠르게)
            const interpolationSpeed = Math.max(200, distance * 5); // 최소 200px/s
            const moveDistance = interpolationSpeed * dt;
            
            // 방향 벡터 정규화
            const normalizedDx = dx / distance;
            const normalizedDy = dy / distance;
            
            // 새 위치 계산
            const actualMoveDistance = Math.min(moveDistance, distance);
            projectile.x += normalizedDx * actualMoveDistance;
            projectile.y += normalizedDy * actualMoveDistance;
            
            // 회전 업데이트 (방향에 따라)
            const config = this.getProjectileConfig(projectile.jobClass);
            if (config.rotation) {
                const angle = Math.atan2(dy, dx);
                projectile.setRotation(angle);
            }
        });
        
        this.lastUpdateTime = now;
    }

    /**
     * 서버에서 투사체 업데이트 이벤트 처리
     */
    handleProjectilesUpdate(data) {
        const { projectiles } = data;
        
        if (!projectiles || !Array.isArray(projectiles)) return;
        
        const now = Date.now();
        
        projectiles.forEach(projectileData => {
            const existingProjectile = this.projectiles.get(projectileData.id);
            
            if (existingProjectile) {
                // 기존 투사체 위치 보간 업데이트
                this.updateProjectileInterpolation(existingProjectile, projectileData, now);
            } else {
                // 새 투사체 생성
                this.createProjectileFromServerData(projectileData);
            }
        });
    }

    /**
     * 투사체 보간 업데이트
     */
    updateProjectileInterpolation(projectile, serverData, now) {
        const { x, y, vx, vy } = serverData;
        
        // 서버 업데이트 시간 기록
        projectile.lastServerUpdate = now;
        
        // 현재 위치와 서버 위치 차이 계산
        const dx = x - projectile.x;
        const dy = y - projectile.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        // 차이가 크면 즉시 이동 (텔레포트)
        if (distance > 100) {
            projectile.x = x;
            projectile.y = y;
            projectile.targetPosition = null;
        } else if (distance > 5) {
            // 작은 차이는 보간으로 처리
            projectile.targetPosition = { x, y };
        }
        
        // 속도 정보로 회전 업데이트
        const config = this.getProjectileConfig(projectile.jobClass);
        if (config.rotation && (vx !== 0 || vy !== 0)) {
            const angle = Math.atan2(vy, vx);
            projectile.setRotation(angle);
        }
    }

    /**
     * 서버 데이터로부터 투사체 생성
     */
    createProjectileFromServerData(projectileData) {
        const { id, playerId, jobClass, x, y, vx, vy, size, sprite, team } = projectileData;
        
        // 서버에서 받은 정보 우선 사용, 없으면 fallback
        const fallbackConfig = this.getProjectileConfig(jobClass);
        const config = {
            sprite: sprite || fallbackConfig.sprite,
            size: size || fallbackConfig.size,
            color: fallbackConfig.color,
            rotation: fallbackConfig.rotation
        };

        console.log(`투사체 데이터 수신: ${jobClass}, 서버 sprite: ${sprite}, fallback sprite: ${fallbackConfig.sprite}, 최종 sprite: ${config.sprite}`);

        let projectile;
        
        if (config.sprite && config.sprite !== 'projectile') {
            // 스프라이트 기반 투사체
            try {
                projectile = this.scene.add.sprite(x, y, config.sprite);
                projectile.setDisplaySize(config.size, config.size);
                
                // 회전 설정
                if (config.rotation) {
                    const angle = Math.atan2(vy, vx);
                    projectile.setRotation(angle);
                }
                
                console.log(`스프라이트 투사체 생성 성공: ${config.sprite}`);
            } catch (error) {
                console.warn(`스프라이트 로드 실패: ${config.sprite}, 원형으로 대체`);
                // 스프라이트 로드 실패 시 원형으로 대체
                projectile = this.scene.add.circle(x, y, config.size / 2, config.color || 0xffffff, 1);
            }
        } else {
            // 원형 투사체 (마법사 또는 스프라이트 실패 시)
            console.log(`원형 투사체 생성: ${jobClass}`);
            projectile = this.scene.add.circle(x, y, config.size / 2, config.color || 0xffffff, 1);
        }

        // 물리 바디 추가
        this.scene.physics.add.existing(projectile);
        projectile.body.setCircle(config.size / 2);
        projectile.body.setCollideWorldBounds(false);
        projectile.body.setBounce(0, 0);
        projectile.body.setDrag(0, 0);

        // 투사체 정보 저장
        projectile.projectileId = id;
        projectile.playerId = playerId;
        projectile.jobClass = jobClass;
        projectile.team = team;
        projectile.isActive = true;
        projectile.targetPosition = null;
        projectile.lastServerUpdate = Date.now();

        // 투사체를 맵에 저장
        this.projectiles.set(id, projectile);

        // 투사체 이펙트 추가
        this.addProjectileEffects(projectile, jobClass);
        
        console.log(`투사체 생성 완료: ${jobClass}, 크기: ${config.size}, 스프라이트: ${config.sprite}`);
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