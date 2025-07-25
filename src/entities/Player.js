import Phaser from 'phaser';
import { JobClasses } from '../data/JobClasses.js';
import AssetLoader from '../utils/AssetLoader.js';

export default class Player extends Phaser.Physics.Arcade.Sprite {
    constructor(scene, x, y, team = 'red') {
        super(scene, x, y, 'player');

        
        this.scene = scene;
        this.scene.add.existing(this);
        this.scene.physics.add.existing(this);
        
        // 네트워크 관련
        this.networkId = null;
        this.networkManager = null;
        this.isOtherPlayer = false; // 다른 플레이어인지 여부
        this.nameText = null; // 이름 텍스트
        
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
        this.size = 64; // 기본 표시 크기 (updateCharacterSize에서 레벨에 따라 재계산됨)
        this.baseCameraZoom = 1; // 기본 카메라 줌 레벨
        this.colliderSize = 0; // updateCharacterSize에서 계산됨

        // 방향 관련
        this.direction = 'front'; // 기본 방향
        this.lastDirection = 'front';
        
        // 초기 스프라이트 설정 (updateCharacterSize도 포함)
        this.updateJobSprite();
        
        // 상태
        this.isJumping = false; // 점프 중인지 확인하는 상태

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
        
        // 물리 속성
        this.setCollideWorldBounds(true);
        
        // 입력 (본인 플레이어만)
        this.cursors = this.scene.input.keyboard.createCursorKeys();
        this.wasd = this.scene.input.keyboard.addKeys('W,S,A,D');
        this.spaceKey = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
        this.qKey = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.Q);
        this.iKey = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.I); // 무적 모드 토글
        this.lKey = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.L); // 레벨업 테스트
        
        // UI 업데이트
        this.updateUI();
        
        console.log('Player 생성 완료:', this.x, this.y, this.team, this.jobClass);
    }
    
    calculateColliderSize() {
        return this.size + 450;
    }
    
    // 크기 업데이트 메서드
    updateSize() {
        // 표시 크기 설정
        this.setDisplaySize(this.size, this.size);
        
        // 충돌체 크기 동기화
        this.colliderSize = this.calculateColliderSize();
        if (this.body) {
            this.body.setSize(this.colliderSize, this.colliderSize);
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
        // 다른 플레이어는 입력 처리하지 않음
        if (!this.isOtherPlayer) {
            if(!this.isJumping) {
                this.handleMovement();
            }
            this.handleSkills();
            this.updateStealth(delta);
            this.updateCooldowns(delta);
            
            // 위치 변화가 있으면 서버에 전송
            if (this.networkManager && (this.lastNetworkX !== this.x || this.lastNetworkY !== this.y || this.lastNetworkDirection !== this.direction)) {
                this.networkManager.updatePlayerPosition(this.x, this.y, this.direction, this.isJumping);
                this.lastNetworkX = this.x;
                this.lastNetworkY = this.y;
                this.lastNetworkDirection = this.direction;
            }
        }
        
        // 이름 텍스트 위치 업데이트
        if (this.nameText) {
            this.nameText.setPosition(this.x, this.y - 40);
        }
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
    }
    
    useSkill() {
        let skillType;
        switch (this.jobClass) {
            case 'assassin':
            case 'ninja':
                skillType = 'stealth';
                this.useStealth();
                break;
            case 'warrior':
                skillType = 'charge';
                this.useCharge();
                break;
            case 'mage':
                skillType = 'ward';
                this.useWard();
                break;
            default:
                skillType = 'jump';
                this.useSlimeSkill();
                break;
        }
        
        // 네트워크로 스킬 사용 알림
        if (this.networkManager && !this.isOtherPlayer) {
            this.networkManager.useSkill(skillType);
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
        // 이미 점프 중이면 실행하지 않음
        if (this.isJumping) {
            return;
        }
        
        // 기본 슬라임 스킬 - 점프
        this.setVelocity(0);
        this.isJumping = true; // 점프 시작
        
        this.scene.tweens.add({
            targets: this,
            y: this.y - 50,
            duration: 200,
            yoyo: true,
            ease: 'Power2',
            onComplete: () => {
                this.isJumping = false; // 점프 완료
            }
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
        
        // 텍스처 존재 여부 확인
        if (this.scene.textures.exists(spriteKey)) {
            console.log(`텍스처 설정: ${spriteKey}`);
            this.setTexture(spriteKey);
        } else {
            console.warn(`텍스처가 존재하지 않음: ${spriteKey}`);
            // 폴백: 기본 슬라임 텍스처 사용
            const fallbackKey = 'player_slime_front';
            if (this.scene.textures.exists(fallbackKey)) {
                console.log(`폴백 텍스처 사용: ${fallbackKey}`);
                this.setTexture(fallbackKey);
            } else {
                console.error('폴백 텍스처도 없음! 기본 텍스처 생성 필요');
                // 마지막 폴백: 기본 사각형 생성
                this.createFallbackTexture();
            }
        }
        
        // 스프라이트 변경 후 크기 재조정 (레벨에 따른 크기도 함께 적용)
        this.updateCharacterSize();
        
        // 애니메이션 재생은 제거 (스프라이트만 업데이트)
    }
    
    // 긴급 폴백 텍스처 생성
    createFallbackTexture() {
        const fallbackKey = 'player_fallback';
        if (!this.scene.textures.exists(fallbackKey)) {
            const graphics = this.scene.add.graphics();
            graphics.fillStyle(0x00ff00); // 초록색 사각형
            graphics.fillRect(0, 0, 64, 64);
            graphics.generateTexture(fallbackKey, 64, 64);
            graphics.destroy();
        }
        this.setTexture(fallbackKey);
        console.log('긴급 폴백 텍스처 생성 및 설정 완료');
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
        const baseSize = 16;        // 기본 크기 (레벨 1)
        const growthRate = 1;       // 레벨당 증가 크기
        const maxSize = 40;        // 최대 크기
        
        // 레벨에 따른 크기 계산
        const targetSize = baseSize + (this.level - 1) * growthRate;
        const finalSize = Math.min(targetSize, maxSize);
        
        // this.size 속성 업데이트 (다른 메서드들과 동기화)
        this.size = finalSize;
        
        // 캐릭터 크기 조정 (정사각형 유지)
        AssetLoader.adjustSpriteSize(this, finalSize, finalSize);
        
        // 충돌 박스는 updateSize() 메서드에서 통합 관리
        this.updateSize();
    }
    
    showJobSelection() {
        // 간단한 전직 UI (실제로는 더 복잡하게 구현)
        const jobs = ['slime', 'assassin', 'ninja', 'warrior', 'mage'];
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

    // 네트워크 ID 설정
    setNetworkId(id) {
        this.networkId = id;
    }

    // 네트워크 매니저 설정
    setNetworkManager(networkManager) {
        this.networkManager = networkManager;
        this.lastNetworkX = this.x;
        this.lastNetworkY = this.y;
        this.lastNetworkDirection = this.direction;
    }

    // 다른 플레이어 여부 설정
    setIsOtherPlayer(isOther) {
        this.isOtherPlayer = isOther;
        
        // 다른 플레이어의 경우 입력 비활성화 (객체는 유지)
        // 이렇게 하면 null 체크 없이도 안전하게 처리할 수 있음
    }

    // 다른 플레이어 위치 업데이트 (네트워크에서 받은 데이터)
    updateFromNetwork(data) {
        this.x = data.x;
        this.y = data.y;
        this.direction = data.direction;
        this.isJumping = data.isJumping;
        this.updateJobSprite();
    }

    // 이름 텍스트 제거
    destroy() {
        if (this.nameText) {
            this.nameText.destroy();
        }
        super.destroy();
    }
} 