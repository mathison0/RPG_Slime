import Phaser from 'phaser';

/**
 * 체력바 UI 컴포넌트 (체력바만 관리)
 */
export default class HealthBar {
    constructor(scene, entity, config = {}) {
        this.scene = scene;
        this.entity = entity;
        
        // 설정
        this.config = {
            barWidth: config.barWidth || 40,
            barHeight: config.barHeight || 6,
            borderWidth: config.borderWidth || 1,
            backgroundColor: config.backgroundColor || 0x000000,
            borderColor: config.borderColor || 0xffffff,
            healthColor: config.healthColor || 0x00ff00,
            lowHealthColor: config.lowHealthColor || 0xff0000,
            lowHealthThreshold: config.lowHealthThreshold || 0.3,
            yOffsetFromTop: config.yOffsetFromTop || -10, // 엔티티 위쪽 가장자리에서의 오프셋
            depth: config.depth || 100
        };
        
        // UI 요소들
        this.container = null;
        this.background = null;
        this.border = null;
        this.healthBar = null;
        
        this.createHealthBar();
    }
    
    /**
     * 체력바 생성
     */
    createHealthBar() {
        // 컨테이너 생성
        this.container = this.scene.add.container(0, 0);
        this.container.setDepth(this.config.depth);
        
        // 체력바 배경
        this.background = this.scene.add.rectangle(
            0, 0, 
            this.config.barWidth, 
            this.config.barHeight, 
            this.config.backgroundColor
        );
        this.container.add(this.background);
        
        // 체력바 테두리
        this.border = this.scene.add.rectangle(
            0, 0, 
            this.config.barWidth + this.config.borderWidth * 2, 
            this.config.barHeight + this.config.borderWidth * 2, 
            this.config.borderColor
        );
        this.border.setStrokeStyle(this.config.borderWidth, this.config.borderColor);
        this.border.setFillStyle(); // 배경 없음
        this.container.add(this.border);
        
        // 실제 체력바
        this.healthBar = this.scene.add.rectangle(
            0, 0, 
            this.config.barWidth, 
            this.config.barHeight, 
            this.config.healthColor
        );
        this.container.add(this.healthBar);
        
        // 초기 위치 설정
        this.updatePosition();
    }
    
    /**
     * 체력바 업데이트
     */
    updateHealth(currentHp, maxHp) {
        if (!this.healthBar || !this.entity) return;
        
        const healthPercentage = Math.max(0, Math.min(1, currentHp / maxHp));
        
        // 체력바 크기 조정
        const newWidth = this.config.barWidth * healthPercentage;
        this.healthBar.setSize(newWidth, this.config.barHeight);
        
        // 체력바 색상 변경 (낮은 체력일 때 빨간색)
        const color = healthPercentage <= this.config.lowHealthThreshold 
            ? this.config.lowHealthColor 
            : this.config.healthColor;
        this.healthBar.setFillStyle(color);
        
        // 체력바 위치 조정 (왼쪽 정렬을 위해)
        const offsetX = -(this.config.barWidth - newWidth) / 2;
        this.healthBar.setPosition(offsetX, 0);
        
        // 체력이 0이거나 은신 중이면 체력바 숨기기
        const shouldHide = currentHp <= 0 || (this.entity.isStealth && this.entity.visibleToEnemies === false);
        this.container.setVisible(!shouldHide);
    }
    
    /**
     * 위치 업데이트 (엔티티 크기에 따라 y좌표만 동적 조정)
     */
    updatePosition() {
        if (!this.entity || !this.container) return;
        
        // 엔티티의 크기를 고려한 위쪽 가장자리 계산
        const entitySize = this.entity.size || this.entity.displayHeight || 32;
        const entityTop = this.entity.y - (entitySize / 2);
        
        // 체력바 위치 (엔티티 위쪽 가장자리에서 일정 거리 위에)
        const healthBarY = entityTop + this.config.yOffsetFromTop;
        this.container.setPosition(this.entity.x, healthBarY);
    }
    
    /**
     * 가시성 설정
     */
    setVisible(visible) {
        if (this.container) {
            this.container.setVisible(visible);
        }
    }
    
    /**
     * 깊이 설정
     */
    setDepth(depth) {
        if (this.container) {
            this.container.setDepth(depth);
        }
    }
    
    /**
     * 정리
     */
    destroy() {
        if (this.container) {
            this.container.destroy();
        }
        this.container = null;
        this.background = null;
        this.border = null;
        this.healthBar = null;
    }
} 