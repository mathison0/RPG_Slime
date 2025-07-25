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
        
        // 시야 범위
        this.visionRange = 300;
        
        // 애니메이션 설정 - 모든 직업이 레벨에 따라 크기 조정
        this.updateCharacterSize();
        
        // 물리 속성
        this.setCollideWorldBounds(true);
        this.body.setSize(48, 48); // 충돌 박스도 크기에 맞게 조정
        
        // 입력
        this.cursors = this.scene.input.keyboard.createCursorKeys();
        this.wasd = this.scene.input.keyboard.addKeys('W,S,A,D');
        this.spaceKey = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
        this.qKey = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.Q);
        
        // UI 업데이트
        this.updateUI();
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
        this.scene.add.text(this.x, this.y - 50, 'LEVEL UP!', {
            fontSize: '24px',
            fill: '#ffff00'
        }).setOrigin(0.5);
        
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
        const jobs = ['slime', 'assassin', 'ninja', 'warrior', 'mage'];
        const currentIndex = jobs.indexOf(this.jobClass);
        const nextIndex = (currentIndex + 1) % jobs.length;
        this.changeJob(jobs[nextIndex]);
    }
    
    takeDamage(damage) {
        const actualDamage = Math.max(1, damage - this.defense);
        this.hp = Math.max(0, this.hp - actualDamage);
        
        // 데미지 표시
        this.scene.add.text(this.x, this.y - 30, `-${actualDamage}`, {
            fontSize: '16px',
            fill: '#ff0000'
        }).setOrigin(0.5);
        
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