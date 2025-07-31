import Phaser from 'phaser';
import HealthBar from '../ui/HealthBar.js';

/**
 * 서버 제어 적 클래스
 * - 모든 AI, 스탯, 색상 정보는 서버에서 관리
 * - 클라이언트는 위치 업데이트, 애니메이션, 렌더링만 담당
 */
export default class Enemy extends Phaser.Physics.Arcade.Sprite {
    constructor(scene, x, y, type = 'basic') {
        // 몬스터 타입에 따른 스프라이트 키 결정
        const spriteKey = Enemy.getSpriteKeyForType(type);
        super(scene, x, y, spriteKey);
        
        this.scene = scene;
        this.scene.add.existing(this);
        this.scene.physics.add.existing(this);
        
        // 서버에서 관리되는 속성들
        this.networkId = null;
        this.type = type;
        this.hp = 50;
        this.maxHp = 50;
        this.attack = 15;
        
        // 서버에서 받은 이동 정보
        this.vx = 0;
        this.vy = 0;
        
        // 방향 추적 (오른쪽: true, 왼쪽: false)
        this.facingRight = false;
        
        // 상태 플래그
        this.isDead = false;
        
        // Tint 상태 관리 (우선순위: 피격 > 기절 > 슬로우)
        this.isDamaged = false;        // 피격 상태 (0xff0000)
        this.isStunnedTint = false;    // 기절 상태 (0x888888)
        this.isSlowedTint = false;     // 슬로우 상태 (0x87ceeb)
        
        // UI 요소
        this.healthBar = null;
        
        // 어그로 표시 UI
        this.aggroIndicator = null;
        this.isTargetingPlayer = false;
        
        // 기본 물리 설정
        this.initializePhysics();
        
        // 체력바 생성
        this.createHealthBar();
        
        // 애니메이션 관련
        this.lastAttackTime = 0;
        this.isAttacking = false;
    }
    
    /**
     * 물리 바디 초기화
     */
    initializePhysics() {
        // 기본 크기 설정 (서버에서 받은 크기로 나중에 업데이트됨)
        this.setDisplaySize(32, 32);
        this.setCollideWorldBounds(true);
        
        // 기본 충돌체 크기 설정
        this.colliderSize = 32;
        this.updatePhysicsBody();
        
        // 서버 제어 적 물리 설정
        this.body.pushable = false; // 밀리지 않음
        this.body.immovable = true; // 충돌 시 움직이지 않음
    }

    /**
     * 물리 바디 크기 업데이트 (Player와 동일한 방식)
     */
    updatePhysicsBody() {
        if (this.body) {
            const bodyWidth = this.colliderSize / this.scaleX;
            const bodyHeight = this.colliderSize / this.scaleY;
            
            this.body.setSize(bodyWidth, bodyHeight);
            
            // 충돌 박스를 스프라이트 중앙에 맞추기 위한 오프셋 계산
            this.body.setOffset(0, 0);
        }
    }
    
    /**
     * 몬스터 타입과 방향에 따른 스프라이트 키 반환
     * @param {string} type - 몬스터 타입 (basic, charge, elite)
     * @param {boolean} facingRight - 오른쪽을 바라보는지 여부 (true: 오른쪽, false: 왼쪽)
     */
    static getSpriteKeyForType(type, facingRight = false) {
        const suffix = facingRight ? '_right' : '';
        switch (type) {
            case 'basic':
                return `enemy_basic${suffix}`;
            case 'charge':
                return `enemy_charge${suffix}`;
            case 'elite':
                return `enemy_elite${suffix}`;
            default:
                return `enemy_basic${suffix}`; // 기본값
        }
    }
    
    /**
     * 방향 업데이트 및 스프라이트 변경
     * @param {number} vx - x축 속도
     */
    updateDirection(vx) {
        // x축 이동 속도를 기준으로 방향 결정
        const newFacingRight = vx >= 0;
        
        // 방향이 바뀐 경우에만 스프라이트 업데이트
        if (this.facingRight !== newFacingRight) {
            this.facingRight = newFacingRight;
            const newSpriteKey = Enemy.getSpriteKeyForType(this.type, this.facingRight);
            this.setTexture(newSpriteKey);
        }
    }
    
    /**
     * 네트워크 ID 설정
     */
    setNetworkId(id) {
        this.networkId = id;
    }
    
    /**
     * 체력바 생성 (이름표 없음)
     */
    createHealthBar() {
        if (this.healthBar) {
            this.healthBar.destroy();
        }
        
        // 적 체력바 설정 (체력바만, 이름표 없음)
        const healthBarConfig = {
            barWidth: 40,
            barHeight: 5,
            borderWidth: 1,
            backgroundColor: 0x000000,
            borderColor: 0xffffff,
            healthColor: 0xff8800, // 적은 주황색
            lowHealthColor: 0xff0000,
            lowHealthThreshold: 0.3,
            yOffsetFromTop: -8, // 엔티티 위쪽 가장자리에서 8px 위에
            depth: 660 // 적은 동적 변경 없이 고정값 사용
        };
        
        this.healthBar = new HealthBar(this.scene, this, healthBarConfig);
        this.updateHealthBar();
    }
    
    /**
     * 체력바 업데이트
     */
    updateHealthBar() {
        if (this.healthBar) {
            this.healthBar.updateHealth(this.hp, this.maxHp);
            this.healthBar.updatePosition();
            
            // 체력바 위치 변경 시 어그로 표시 위치도 업데이트
            this.updateAggroIndicatorPosition();
        }
    }
    
    /**
     * 어그로 표시 생성
     */
    createAggroIndicator() {
        if (this.aggroIndicator) {
            this.aggroIndicator.destroy();
        }
        
        // 초기 위치 계산 (체력바 기준)
        let initialY;
        if (this.healthBar && this.healthBar.container) {
            initialY = this.healthBar.container.y - 15; // 체력바 위 15px
        } else {
            initialY = this.y - this.height / 2 - 20;
        }
        
        // 빨간색 "!" 텍스트 생성
        this.aggroIndicator = this.scene.add.text(this.x, initialY, '!', {
            fontSize: '20px',
            fontStyle: 'bold',
            fill: '#ff0000',
            stroke: '#ffffff',
            strokeThickness: 2
        });
        
        // 텍스트를 중앙 정렬
        this.aggroIndicator.setOrigin(0.5, 0.5);
        
        // 어그로 표시를 적보다 높은 depth로 설정
        this.aggroIndicator.setDepth(700);
        
        // 어그로 표시 위치 업데이트 (한 번 더 정확한 위치로 조정)
        this.updateAggroIndicatorPosition();
    }
    
    /**
     * 어그로 표시 제거
     */
    removeAggroIndicator() {
        if (this.aggroIndicator) {
            this.aggroIndicator.destroy();
            this.aggroIndicator = null;
        }
    }
    
    /**
     * 어그로 표시 위치 업데이트
     */
    updateAggroIndicatorPosition() {
        if (this.aggroIndicator) {
            let aggroY;
            
            // 체력바가 있으면 체력바 위에 배치
            if (this.healthBar && this.healthBar.container) {
                aggroY = this.healthBar.container.y - 15; // 체력바 위 15px
            } else {
                // 체력바가 없으면 기본 위치 사용
                aggroY = this.y - this.height / 2 - 20;
            }
            
            this.aggroIndicator.setPosition(this.x, aggroY);
        }
    }
    
    /**
     * 어그로 정보 업데이트 처리
     * @param {string|null} targetId - 몬스터가 타겟팅하는 플레이어 ID
     */
    handleAggroUpdate(targetId) {
        // 현재 플레이어 ID 가져오기 (NetworkManager에서)
        const currentPlayerId = this.scene.networkManager?.playerId;
        
        // 현재 플레이어가 어그로 대상인지 확인
        const isPlayerTargeted = targetId === currentPlayerId;
        
        // 이전 상태와 다른 경우에만 업데이트
        if (this.isTargetingPlayer !== isPlayerTargeted) {
            this.isTargetingPlayer = isPlayerTargeted;
            
            if (this.isTargetingPlayer) {
                // 현재 플레이어가 어그로 대상이면 빨간색 ! 표시
                this.createAggroIndicator();
            } else {
                // 어그로 대상이 아니면 표시 제거
                this.removeAggroIndicator();
            }
        }
    }
    
    /**
     * 서버에서 받은 스탯 정보 적용
     */
    applyServerStats(enemyData) {
        // 위치 업데이트
        this.x = enemyData.x;
        this.y = enemyData.y;
        
        // HP 정보 업데이트
        this.hp = enemyData.hp;
        this.maxHp = enemyData.maxHp;
        
        // 이동 속도 정보 (슬로우 효과 적용)
        let effectiveVx = enemyData.vx || 0;
        let effectiveVy = enemyData.vy || 0;
        
        // 슬로우 효과 적용
        if (this.slowEffects && this.slowEffects.length > 0) {
            // 가장 강한 슬로우 효과 적용
            const strongestSlow = this.slowEffects.reduce((strongest, current) => {
                return current.speedReduction < strongest.speedReduction ? current : strongest;
            });
            effectiveVx *= strongestSlow.speedReduction;
            effectiveVy *= strongestSlow.speedReduction;
        }
        
        this.vx = effectiveVx;
        this.vy = effectiveVy;
        
        // 방향 업데이트 (x축 속도 기준)
        this.updateDirection(this.vx);
        
        // 몬스터 타입 업데이트 (새로운 타입이면 스프라이트 변경)
        if (enemyData.type && enemyData.type !== this.type) {
            this.type = enemyData.type;
            const newSpriteKey = Enemy.getSpriteKeyForType(this.type, this.facingRight);
            this.setTexture(newSpriteKey);
        }
        
        // 물리 바디 위치 동기화
        if (this.body) {
            this.body.x = enemyData.x - this.width/2;
            this.body.y = enemyData.y - this.height/2;
            this.body.velocity.x = this.vx;
            this.body.velocity.y = this.vy;
        }
        
        // 크기 적용
        if (enemyData.size) {
            this.applyServerSize(enemyData.size);
        }
        
        // 어그로 정보 처리
        this.handleAggroUpdate(enemyData.targetId);
        
        // 체력바 업데이트 (내부에서 어그로 위치도 함께 업데이트됨)
        this.updateHealthBar();
    }
    
    /**
     * 서버에서 받은 크기 적용 (Player의 updateSize 방식 적용)
     */
    applyServerSize(size) {
        // 화면 표시 크기와 물리적 충돌 크기를 동일하게 설정
        this.setDisplaySize(size, size);
        this.colliderSize = size; // 스프라이트 크기와 동일하게 설정
        
        this.updatePhysicsBody();
    }
    
    /**
     * 사망 처리 (서버에서 호출)
     */
    die() {
        this.isDead = true;
        
        // 물리 바디 비활성화
        if (this.body) {
            this.body.setEnable(false);
        }
        
        // 사망 애니메이션
        this.scene.tweens.add({
            targets: this,
            alpha: 0,
            scaleX: 0.5,
            scaleY: 0.5,
            duration: 300,
            ease: 'Power2',
            onComplete: () => {
                if (this.active) {
                    this.destroy();
                }
            }
        });
    }
    
    /**
     * Tint 상태를 우선순위에 따라 업데이트
     * 우선순위: 피격 > 기절 > 슬로우
     */
    updateTint() {
        // 우선순위에 따라 tint 결정
        if (this.isDamaged) {
            this.setTint(0xff0000); // 빨간색 (피격)
        } else if (this.isStunnedTint) {
            this.setTint(0x888888); // 회색 (기절)
        } else if (this.isSlowedTint) {
            this.setTint(0x87ceeb); // 하늘색 (슬로우)
        } else {
            this.clearTint(); // 모든 효과가 없으면 원래 색상
        }
    }
    
    /**
     * 피격 효과 처리
     * @param {number} damage - 데미지 양 (옵션)
     */
    takeDamage(damage = 0) {
        // 피격 상태 설정
        this.isDamaged = true;
        this.updateTint();
        
        // 200ms 후 피격 상태 해제
        this.scene.time.delayedCall(200, () => {
            if (this && this.active && !this.isDead) {
                this.isDamaged = false;
                this.updateTint();
            }
        });
    }
    
    /**
     * 정리 작업
     */
    destroy() {
        // 체력바가 있다면 제거
        if (this.healthBar) {
            this.healthBar.destroy();
            this.healthBar = null;
        }
        
        // 어그로 표시가 있다면 제거
        if (this.aggroIndicator) {
            this.aggroIndicator.destroy();
            this.aggroIndicator = null;
        }
        
        // HP 바가 있다면 제거 (기존 코드 호환성)
        if (this.hpBar) {
            this.hpBar.destroy();
            this.hpBar = null;
        }
        
        // 미니맵 표시 제거
        if (this.minimapIndicator) {
            this.minimapIndicator.destroy();
            this.minimapIndicator = null;
        }
        
        super.destroy();
    }
}