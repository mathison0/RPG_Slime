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
        
        // 상태 플래그
        this.isDead = false;
        
        // UI 요소
        this.healthBar = null;
        
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
        this.body.setSize(24, 24);
        
        // 서버 제어 적 물리 설정
        this.body.pushable = false; // 밀리지 않음
        this.body.immovable = true; // 충돌 시 움직이지 않음
    }
    
    /**
     * 몬스터 타입에 따른 스프라이트 키 반환
     */
    static getSpriteKeyForType(type) {
        switch (type) {
            case 'basic':
                return 'enemy_basic';
            case 'charge':
                return 'enemy_charge';
            case 'elite':
                return 'enemy_elite';
            default:
                return 'enemy_basic'; // 기본값
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
            depth: 105
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
        
        // 이동 속도 정보
        this.vx = enemyData.vx || 0;
        this.vy = enemyData.vy || 0;
        
        // 몬스터 타입 업데이트 (새로운 타입이면 스프라이트 변경)
        if (enemyData.type && enemyData.type !== this.type) {
            this.type = enemyData.type;
            const newSpriteKey = Enemy.getSpriteKeyForType(this.type);
            this.setTexture(newSpriteKey);
        }
        
        // 물리 바디 위치 동기화
        if (this.body) {
            this.body.x = enemyData.x - this.width/2;
            this.body.y = enemyData.y - this.height/2;
            this.body.velocity.x = this.vx;
            this.body.velocity.y = this.vy;
        }
        
        // 색상 적용 제거 (이미지 스프라이트 사용)
        // if (enemyData.color) {
        //     this.applyServerColor(enemyData.color);
        // }
        
        // 크기 적용
        if (enemyData.size) {
            this.applyServerSize(enemyData.size);
        }
        
        // 공격 상태 처리
        if (enemyData.isAttacking) {
            this.playAttackAnimation();
        }
        
        // 체력바 업데이트
        this.updateHealthBar();
    }
    
    /**
     * 서버에서 받은 색상 적용 (이미지 스프라이트 사용으로 인해 비활성화)
     */
    // applyServerColor(colorData) {
    //     const hexColor = parseInt(
    //         `${colorData.r.toString(16).padStart(2, '0')}${colorData.g.toString(16).padStart(2, '0')}${colorData.b.toString(16).padStart(2, '0')}`, 
    //         16
    //     );
    //     this.setTint(hexColor);
    // }
    
    /**
     * 서버에서 받은 크기 적용
     */
    applyServerSize(size) {
        this.setDisplaySize(size, size);
        if (this.body) {
            this.body.setSize(size * 0.8, size * 0.8);
        }
    }
    
    /**
     * 공격 애니메이션 재생
     */
    playAttackAnimation() {
        if (Date.now() - this.lastAttackTime < 500) return; // 중복 방지
        
        this.lastAttackTime = Date.now();
        this.isAttacking = true;
        
        // 크기 살짝 확대 (색상 변경 제거)
        const originalScale = this.scaleX;
        this.setScale(originalScale * 1.2);
        
        // 200ms 후 원래대로 복구
        this.scene.time.delayedCall(200, () => {
            if (this.active) {
                this.setScale(originalScale);
                this.isAttacking = false;
            }
        });
        
        // 공격 범위 표시 (선택적)
        this.showAttackRange();
    }
    
    /**
     * 공격 범위 시각화
     */
    showAttackRange() {
        const attackRange = this.scene.add.circle(this.x, this.y, 35, 0xff0000, 0.3);
        attackRange.setDepth(this.depth - 1);
        
        this.scene.time.delayedCall(300, () => {
            if (attackRange.active) {
                attackRange.destroy();
            }
        });
    }
    
    /**
     * 피격 효과 (서버에서 데미지 처리 후 호출)
     */
    showDamageEffect() {
        // 피격 효과 제거 (이미지 스프라이트 사용)
        // this.setTintFill(0xffffff);
        
        // this.scene.time.delayedCall(100, () => {
        //     if (this.active) {
        //         this.clearTint();
        //     }
        // });
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
     * 정리 작업
     */
    destroy() {
        // 체력바가 있다면 제거
        if (this.healthBar) {
            this.healthBar.destroy();
            this.healthBar = null;
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