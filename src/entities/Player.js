import Phaser from 'phaser';
import { JobClasses } from '../data/JobClasses.js';
import AssetLoader from '../utils/AssetLoader.js';

export default class Player extends Phaser.Physics.Arcade.Sprite {
    constructor(scene, x, y, team = 'red') {
        super(scene, x, y, 'player');

        
        this.scene = scene;
        this.scene.add.existing(this);
        this.scene.physics.add.existing(this);
        
        // 기본 스탯
        this.level = 1;
        this.exp = 0;
        this.expToNext = 100;
        this.maxHp = 100;
        this.hp = this.maxHp;
        this.speed = 200;
        this.attack = 20;
        this.defense = 10;
        
        // 직업 관련
        this.jobClass = 'slime'; // 기본 슬라임
        this.jobLevel = 1;
        this.skills = [];
        
        // 크기 관련 (기본 크기 설정)
        this.size = 64; // 기본 표시 크기
        this.baseCameraZoom = 1; // 기본 카메라 줌 레벨
        this.colliderSize = this.calculateColliderSize(); // 크기에 비례한 충돌체 크기

        // 방향 관련
        this.direction = 'front'; // 기본 방향
        this.lastDirection = 'front';
        
        // 초기 스프라이트 설정
        this.updateJobSprite();
        
        // 상태

        // 팀 및 상태
        this.team = team; // 'red' | 'blue'

        this.isStealth = false;
        this.stealthCooldown = 0;
        this.stealthDuration = 0;
        this.stealthBonusDamage = 0;
        
        // 테스트용 무적 모드
        this.isInvincible = false;
        
        // 시야 범위
        this.visionRange = 300;
        
        // 애니메이션 설정 - 모든 직업이 레벨에 따라 크기 조정
        this.updateCharacterSize();
        
        // 물리 속성
        this.setCollideWorldBounds(true);
        
        // 입력
        this.cursors = this.scene.input.keyboard.createCursorKeys();
        this.wasd = this.scene.input.keyboard.addKeys('W,S,A,D');
        this.spaceKey = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
        this.qKey = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.Q);
        this.iKey = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.I); // 무적 모드 토글
        this.lKey = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.L); // 레벨업 테스트
        
        // 디버깅용 크기 조절 키
        this.key1 = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ONE);
        this.key2 = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.TWO);
        
        // UI 업데이트
        this.updateUI();
    }
    
    // 충돌체 크기 계산 (현재 비율 유지: 64 -> 500, 즉 약 7.8배)
    calculateColliderSize() {
        return Math.round(this.size * 7.8125); // 500/64 = 7.8125
    }
    
    // 카메라 줌 계산 (플레이어가 화면에서 같은 크기로 보이도록)
    calculateCameraZoom() {
        return this.baseCameraZoom * (64 / this.size);
    }
    
    // 크기 업데이트 메서드
    updateSize() {
        // 표시 크기 설정
        this.setDisplaySize(this.size, this.size);
        
        // 충돌체 크기 동기화
        this.colliderSize = this.calculateColliderSize();
        this.body.setSize(this.colliderSize, this.colliderSize);
        
        // 카메라 줌 조정
        const newZoom = this.calculateCameraZoom();
        if (this.scene.cameras && this.scene.cameras.main) {
            this.scene.cameras.main.setZoom(newZoom);
            
            // GameScene에 줌 변경을 알림 (안개와 미니맵 스케일 조정용)
            if (this.scene.updateUIScale) {
                this.scene.updateUIScale(newZoom);
            }
        }
    }
    
    // 크기 변경 메서드
    setSize(newSize) {
        this.size = newSize;
        this.updateSize();
    }
    
    // 크기 가져오기
    getSize() {
        return this.size;
    }
    
    update(time, delta) {
        this.handleMovement();
        this.handleSkills();
        this.updateStealth(delta);
        this.updateCooldowns(delta);
    }
    
    handleMovement() {
        const speed = this.speed;
        this.setVelocity(0);
        
        // 방향 감지
        let movingUp = false;
        let movingDown = false;
        let movingLeft = false;
        let movingRight = false;
        
        // WASD 또는 방향키로 이동
        if (this.wasd.W.isDown || this.cursors.up.isDown) {
            this.setVelocityY(-speed);
            movingUp = true;
        }
        if (this.wasd.S.isDown || this.cursors.down.isDown) {
            this.setVelocityY(speed);
            movingDown = true;
        }
        if (this.wasd.A.isDown || this.cursors.left.isDown) {
            this.setVelocityX(-speed);
            movingLeft = true;
        }
        if (this.wasd.D.isDown || this.cursors.right.isDown) {
            this.setVelocityX(speed);
            movingRight = true;
        }
        
        // 대각선 이동 정규화
        if (this.body.velocity.x !== 0 && this.body.velocity.y !== 0) {
            this.body.velocity.normalize().scale(speed);
        }
        
        // 방향 업데이트
        this.updateDirection(movingUp, movingDown, movingLeft, movingRight);
    }
    
    updateDirection(movingUp, movingDown, movingLeft, movingRight) {
        // 움직이고 있는지 확인
        const isMoving = movingUp || movingDown || movingLeft || movingRight;
        
        if (isMoving) {
            // 우선순위: 위 > 아래 > 왼쪽 > 오른쪽
            if (movingUp) {
                this.direction = 'back';
            } else if (movingDown) {
                this.direction = 'front';
            } else if (movingLeft) {
                this.direction = 'left';
            } else if (movingRight) {
                this.direction = 'right';
            }
        }
        // 움직이지 않을 때는 마지막 방향을 유지 (스프라이트 변경하지 않음)
        
        // 방향이 바뀌었으면 스프라이트 업데이트
        if (this.direction !== this.lastDirection) {
            this.updateJobSprite();
            this.lastDirection = this.direction;
        }
    }
    
    handleSkills() {
        // 스페이스바로 스킬 사용
        if (Phaser.Input.Keyboard.JustDown(this.spaceKey)) {
            this.useSkill();
        }
        
        // Q키로 전직
        if (Phaser.Input.Keyboard.JustDown(this.qKey)) {
            this.showJobSelection();
        }
      
        if (Phaser.Input.Keyboard.JustDown(this.iKey)) {
            this.toggleInvincible();
        }
        
        // L키로 레벨업 테스트
        if (Phaser.Input.Keyboard.JustDown(this.lKey)) {
            this.testLevelUp();
        }
      
        // 디버깅용 크기 조절
        if (Phaser.Input.Keyboard.JustDown(this.key1)) {
            this.decreaseSize();
        }
        
        if (Phaser.Input.Keyboard.JustDown(this.key2)) {
            this.increaseSize();
        }
    }
    
    decreaseSize() {
        const newSize = Math.max(16, Math.round(this.size * 0.99));
        this.setSize(newSize);
        console.log(`플레이어 크기 축소: ${newSize}`);
    }
    
    // 크기 확대 (10% 증가, 최대 256까지)
    increaseSize() {
        const newSize = Math.min(256, Math.round(this.size * 1.01));
        this.setSize(newSize);
        console.log(`플레이어 크기 확대: ${newSize}`);
    }
    
    useSkill() {
        switch (this.jobClass) {
            case 'assassin':
                this.useStealth();
                break;
            case 'ninja':
                this.useStealth();
                break;
            case 'warrior':
                this.useCharge();
                break;
            case 'mage':
                this.useWard();
                break;
            case 'mechanic':
                this.useMechanicSkill();
                break;
            default:
                this.useSlimeSkill();
                break;
        }
    }
    
    useStealth() {
        if (this.stealthCooldown <= 0) {
            this.isStealth = true;
            this.stealthDuration = 3000; // 3초
            this.stealthCooldown = 10000; // 10초 쿨타임
            this.stealthBonusDamage = 50;
            this.setAlpha(0.3);
            this.setTint(0x888888);
        }
    }
    
    useCharge() {
        // 전사의 돌진 공격
        const targetX = this.x + Math.cos(this.rotation) * 100;
        const targetY = this.y + Math.sin(this.rotation) * 100;
        
        this.scene.tweens.add({
            targets: this,
            x: targetX,
            y: targetY,
            duration: 200,
            ease: 'Power2',
            onComplete: () => {
                // 충돌 체크
                this.checkChargeCollision();
            }
        });
    }
    
    useWard() {
        // 마법사의 와드 생성
        const ward = this.scene.add.circle(this.x, this.y, 50, 0x00ffff, 0.3);
        this.scene.physics.add.existing(ward);
        ward.body.setImmovable(true);
        
        // 5초 후 와드 제거
        this.scene.time.delayedCall(5000, () => {
            ward.destroy();
        });
    }
    
    useSlimeSkill() {
        // 기본 슬라임 스킬 - 점프
        this.scene.tweens.add({
            targets: this,
            y: this.y - 50,
            duration: 200,
            yoyo: true,
            ease: 'Power2'
        });
    }
    
    useMechanicSkill() {
        // 기본 메카닉 스킬 - 아직 구현되지 않음
        this.scene.add.text(this.x, this.y - 60, '메카닉 스킬!', {
            fontSize: '16px',
            fill: '#ff6600'
        }).setOrigin(0.5);
        
        // 1초 후 메시지 제거
        this.scene.time.delayedCall(1000, () => {
            this.scene.children.list.forEach(child => {
                if (child.type === 'Text' && child.text === '메카닉 스킬!') {
                    child.destroy();
                }
            });
        });
    }
    
    updateStealth(delta) {
        if (this.isStealth) {
            this.stealthDuration -= delta;
            if (this.stealthDuration <= 0) {
                this.isStealth = false;
                this.stealthBonusDamage = 0;
                this.setAlpha(1);
                this.updateJobSprite();
            }
        }
    }
    
    updateCooldowns(delta) {
        if (this.stealthCooldown > 0) {
            this.stealthCooldown -= delta;
        }
    }
    
    gainExp(amount) {
        this.exp += amount;
        if (this.exp >= this.expToNext) {
            this.levelUp();
        }
        this.updateUI();
    }
    
    levelUp() {
        this.level++;
        this.exp -= this.expToNext;
        this.expToNext = Math.floor(this.expToNext * 1.2);
        
        // 스탯 증가
        this.maxHp += 20;
        this.hp = this.maxHp;
        this.attack += 5;
        this.defense += 2;
        this.speed += 10;
        
        // 모든 직업이 레벨에 따라 크기 증가
        this.updateCharacterSize();
        
        // 레벨업 효과
        const levelUpText = this.scene.add.text(this.x, this.y - 50, 'LEVEL UP!', {
            fontSize: '24px',
            fill: '#ffff00'
        }).setOrigin(0.5);
        
        // 2초 후 레벨업 메시지 제거
        this.scene.time.delayedCall(2000, () => {
            levelUpText.destroy();
        });
        
        this.updateUI();
    }
    
    changeJob(jobClass) {
        this.jobClass = jobClass;
        this.jobLevel = 1;
        this.updateJobSprite();
        this.updateUI();
    }
    
    updateJobSprite() {
        // 직업과 방향에 따른 스프라이트 변경
        const spriteKey = AssetLoader.getPlayerSpriteKey(this.jobClass, this.direction);
        this.setTexture(spriteKey);
        
        // 스프라이트 변경 후 크기 재조정
        this.updateCharacterSize();
        
        // 애니메이션 재생은 제거 (스프라이트만 업데이트)
    }
    
    // 무적 모드 토글
    toggleInvincible() {
        this.isInvincible = !this.isInvincible;
        
        if (this.isInvincible) {
            // 무적 모드 ON - 색상 변경 없이 메시지만 표시
            const invincibleText = this.scene.add.text(this.x, this.y - 80, '무적 모드 ON', {
                fontSize: '16px',
                fill: '#00ff00'
            }).setOrigin(0.5);
            
            // 1초 후 메시지 제거
            this.scene.time.delayedCall(1000, () => {
                invincibleText.destroy();
            });
        } else {
            // 무적 모드 OFF - 메시지만 표시
            this.updateJobSprite(); // 원래 스프라이트로 복원
            const invincibleText = this.scene.add.text(this.x, this.y - 80, '무적 모드 OFF', {
                fontSize: '16px',
                fill: '#ff0000'
            }).setOrigin(0.5);
            
            // 2초 후 메시지 제거
            this.scene.time.delayedCall(2000, () => {
                invincibleText.destroy();
            });
        }
        
        this.updateUI();
    }
    
    // 레벨업 테스트
    testLevelUp() {
        this.gainExp(this.expToNext); // 바로 레벨업할 수 있는 경험치 추가
        const testText = this.scene.add.text(this.x, this.y - 100, '레벨업 테스트!', {
            fontSize: '20px',
            fill: '#ffff00'
        }).setOrigin(0.5);
        
        // 1초 후 메시지 제거
        this.scene.time.delayedCall(1000, () => {
            testText.destroy();
        });
    }
    
    // 캐릭터 크기를 레벨에 따라 업데이트하는 메서드
    updateCharacterSize() {
        // 모든 직업이 동일한 성장률과 최대 크기를 가짐
        const baseSize = 32;        // 기본 크기 (레벨 1)
        const growthRate = 4;       // 레벨당 증가 크기
        const maxSize = 120;        // 최대 크기
        
        // 레벨에 따른 크기 계산
        const targetSize = baseSize + (this.level - 1) * growthRate;
        const finalSize = Math.min(targetSize, maxSize);
        
        // 캐릭터 크기 조정 (정사각형 유지)
        AssetLoader.adjustSpriteSize(this, finalSize, finalSize);
        
        // 충돌 박스도 크기에 맞게 조정
        const collisionSize = Math.max(32, finalSize * 0.75);
        this.body.setSize(collisionSize, collisionSize);
    }
    
    showJobSelection() {
        // 간단한 전직 UI (실제로는 더 복잡하게 구현)
        const jobs = ['slime', 'assassin', 'ninja', 'warrior', 'mage', 'mechanic'];
        const currentIndex = jobs.indexOf(this.jobClass);
        const nextIndex = (currentIndex + 1) % jobs.length;
        this.changeJob(jobs[nextIndex]);
    }
    
    takeDamage(damage) {
        // 무적 모드일 때는 데미지를 받지 않음
        if (this.isInvincible) {
            const invincibleText = this.scene.add.text(this.x, this.y - 30, '무적!', {
                fontSize: '16px',
                fill: '#00ff00'
            }).setOrigin(0.5);
            
            // 1초 후 메시지 제거
            this.scene.time.delayedCall(1000, () => {
                invincibleText.destroy();
            });
            return;
        }
        
        const actualDamage = Math.max(1, damage - this.defense);
        this.hp = Math.max(0, this.hp - actualDamage);
        
        // 데미지 표시
        const damageText = this.scene.add.text(this.x, this.y - 30, `-${actualDamage}`, {
            fontSize: '16px',
            fill: '#ff0000'
        }).setOrigin(0.5);
        
        // 1초 후 데미지 메시지 제거
        this.scene.time.delayedCall(1000, () => {
            damageText.destroy();
        });
        
        this.updateUI();
        
        if (this.hp <= 0) {
            this.die();
        }
    }
    
    die() {
        this.scene.scene.restart();
    }
    
    updateUI() {
        const statsElement = document.getElementById('stats');
        if (statsElement) {
            statsElement.textContent = `레벨: ${this.level} | HP: ${this.hp}/${this.maxHp} | 직업: ${JobClasses[this.jobClass]?.name || '슬라임'}`;
        }
    }
    
    getAttackDamage() {
        let damage = this.attack;
        if (this.isStealth && this.stealthBonusDamage > 0) {
            damage += this.stealthBonusDamage;
            this.stealthBonusDamage = 0; // 한 번만 적용
        }
        return damage;
    }
} 