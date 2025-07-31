import Phaser from 'phaser';

/**
 * 직업 변경 오브 클래스
 * 몬스터를 잡으면 드롭되는 직업 변경 아이템
 */
export default class JobOrb extends Phaser.Physics.Arcade.Sprite {
    constructor(scene, x, y, orbId, jobClass) {
        super(scene, x, y, 'job_orb');
        
        this.scene = scene;
        this.orbId = orbId;
        this.jobClass = jobClass;
        this.isCollected = false; // 수집 상태 플래그 추가

        // 직업별 색상 매핑 (닌자, 메카닉 제외)
        this.jobColors = {
            assassin: 0x8B0000,   // 다크레드
            warrior: 0xFF6B6B,    // 빨강
            mage: 0x4ECDC4,       // 청록
            archer: 0x45B7D1,     // 파랑  
            supporter: 0xF9CA24,  // 노랑
            slime: 0x6C5CE7       // 보라 (실제로는 사용되지 않음)
        };
        
        // 씬에 추가
        this.scene.add.existing(this);
        this.scene.physics.add.existing(this);
        
        // 오브 설정
        this.setupOrb();
        
        // 빛나는 효과 추가
        this.createGlowEffect();
        
        // 부유 애니메이션 추가
        this.createFloatingAnimation();
        
        console.log(`직업 변경 오브 생성: ${jobClass} (${x}, ${y})`);
    }
    
    /**
     * 오브 기본 설정
     */
    setupOrb() {
        // 오브 크기 설정
        this.setDisplaySize(24, 24);
        
        // 물리 바디 설정
        this.body.setSize(20, 20);
        this.body.setImmovable(true);
        
        // 기본 색상 적용
        const orbColor = this.jobColors[this.jobClass] || 0xffffff;
        this.setTint(orbColor);
        
        // 원형 그래픽 생성 (기본 스프라이트가 없을 경우)
        this.createOrbGraphic();
    }
    
    /**
     * 오브 그래픽 생성 (동그란 모양)
     */
    createOrbGraphic() {
        const graphics = this.scene.add.graphics();
        const orbColor = this.jobColors[this.jobClass] || 0xffffff;
        
        // 외곽선 원
        graphics.lineStyle(2, 0xffffff, 0.8);
        graphics.strokeCircle(0, 0, 12);
        
        // 내부 원
        graphics.fillStyle(orbColor, 0.7);
        graphics.fillCircle(0, 0, 10);
        
        // 중앙 하이라이트
        graphics.fillStyle(0xffffff, 0.4);
        graphics.fillCircle(-3, -3, 4);
        
        // 텍스처로 변환
        graphics.generateTexture('job_orb_' + this.jobClass, 24, 24);
        graphics.destroy();
        
        // 생성된 텍스처 적용
        this.setTexture('job_orb_' + this.jobClass);
    }
    
    /**
     * 빛나는 효과 생성
     */
    createGlowEffect() {
        const orbColor = this.jobColors[this.jobClass] || 0xffffff;
        
        // 외부 글로우 이펙트
        this.glowEffect = this.scene.add.graphics();
        this.glowEffect.x = this.x;
        this.glowEffect.y = this.y;
        
        // 글로우 애니메이션
        this.scene.tweens.add({
            targets: this.glowEffect,
            alpha: { from: 0.3, to: 0.8 },
            scaleX: { from: 1.0, to: 1.5 },
            scaleY: { from: 1.0, to: 1.5 },
            duration: 1000,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });
        
        // 글로우 그래픽 그리기
        this.updateGlowEffect();
    }
    
    /**
     * 글로우 이펙트 업데이트
     */
    updateGlowEffect() {
        if (!this.glowEffect) return;
        
        const orbColor = this.jobColors[this.jobClass] || 0xffffff;
        
        this.glowEffect.clear();
        this.glowEffect.fillStyle(orbColor, 0.2);
        this.glowEffect.fillCircle(0, 0, 20);
        this.glowEffect.fillStyle(orbColor, 0.1);
        this.glowEffect.fillCircle(0, 0, 30);
    }
    
    /**
     * 부유 애니메이션 생성
     */
    createFloatingAnimation() {
        // 위아래 부유 움직임
        this.scene.tweens.add({
            targets: this,
            y: this.y - 5,
            duration: 2000,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });
        
        // 회전 효과
        this.scene.tweens.add({
            targets: this,
            rotation: Math.PI * 2,
            duration: 4000,
            repeat: -1,
            ease: 'Linear'
        });
    }
    
    /**
     * 오브 수집 애니메이션
     */
    collect() {
        if (this.isCollected) {
            return; // 이미 수집된 경우 무시
        }
        
        this.isCollected = true; // 수집 상태로 설정
        
        // 물리 바디 즉시 비활성화
        if (this.body) {
            this.body.enable = false;
        }
        
        // 수집 애니메이션 - 크기를 줄이면서 투명도 증가
        this.scene.tweens.add({
            targets: this,
            scaleX: 0.1,
            scaleY: 0.1,
            alpha: 0,
            duration: 300,
            ease: 'Power2',
            onComplete: () => {
                // 애니메이션 완료 후 오브 제거는 서버에서 처리
                console.log(`수집 애니메이션 완료: ${this.orbId}`);
            }
        });
        
        // 글로우 효과도 페이드아웃
        if (this.glowEffect) {
            this.scene.tweens.add({
                targets: this.glowEffect,
                alpha: 0,
                duration: 300
            });
        }
    }
    
    /**
     * 위치 업데이트 (글로우 이펙트 동기화)
     */
    setPosition(x, y) {
        super.setPosition(x, y);
        if (this.glowEffect) {
            this.glowEffect.setPosition(x, y);
        }
        return this;
    }
    
    /**
     * 오브 제거
     */
    destroy() {
        if (this.glowEffect) {
            this.glowEffect.destroy();
        }
        super.destroy();
    }
    
    /**
     * 직업 이름 반환
     */
    getJobDisplayName() {
        const jobNames = {
            slime: '슬라임',
            assassin: '어쌔신',
            warrior: '전사',
            mage: '마법사',
            archer: '궁수',
            supporter: '서포터'
        };
        
        return jobNames[this.jobClass] || this.jobClass;
    }
} 