import Phaser from 'phaser';
import { getJobInfo, calculateStats } from '../data/JobClasses.js';
import AssetLoader from '../utils/AssetLoader.js';
import SkillCooldownUI from '../ui/SkillCooldownUI.js';
import EffectManager from '../effects/EffectManager.js';

// 직업별 클래스 import
import SlimeJob from './jobs/SlimeJob.js';
import MageJob from './jobs/MageJob.js';
import AssassinJob from './jobs/AssassinJob.js';
import WarriorJob from './jobs/WarriorJob.js';
import MechanicJob from './jobs/MechanicJob.js';

export default class Player extends Phaser.Physics.Arcade.Sprite {
    constructor(scene, x, y, team = 'red') {
        super(scene, x, y, 'player');
        
        this.scene = scene;
        this.scene.add.existing(this);
        this.scene.physics.add.existing(this);
        
        // 네트워크 관련
        this.networkId = null;
        this.networkManager = null;
        this.isOtherPlayer = false;
        this.nameText = null;
        
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
        this.jobClass = 'slime';
        this.job = null; // 직업 클래스 인스턴스
        
        // 크기 관련
        this.size = 64;
        this.baseCameraZoom = 1;
        this.colliderSize = 0;

        // 방향 관련
        this.direction = 'front';
        this.lastDirection = 'front';
        
        // 상태
        this.isJumping = false;
        this.team = team;
        this.isInvincible = false;
        this.visionRange = 300;
        this.minimapVisionRange = 200;
        
        // 물리 속성
        this.setCollideWorldBounds(true);
        
        // 입력 설정 (본인 플레이어만)
        this.setupInput();
        
        // 매니저들 초기화
        this.effectManager = new EffectManager(scene);
        this.skillCooldownUI = null;
        this.cooldownMessageActive = false;
        
        // 초기 설정
        this.initializeCharacter();
        
        console.log('Player 생성 완료:', this.x, this.y, this.team, this.jobClass);
    }
    
    /**
     * 입력 설정
     */
    setupInput() {
        this.cursors = this.scene.input.keyboard.createCursorKeys();
        this.wasd = this.scene.input.keyboard.addKeys('W,S,A,D');
        this.spaceKey = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
        this.qKey = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.Q);
        this.eKey = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E);
        this.rKey = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.R);
        this.iKey = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.I);
        this.lKey = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.L);
        this.fKey = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.F);
        this.oneKey = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ONE);
        this.twoKey = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.TWO);
        this.threeKey = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.THREE);
    }
    
    /**
     * 캐릭터 초기화
     */
    initializeCharacter() {
        this.updateJobClass();
        this.updateJobSprite();
        this.updateCharacterSize();
        this.updateUI();
        
        // 본인 플레이어만 UI 생성
        if (!this.isOtherPlayer) {
            this.skillCooldownUI = new SkillCooldownUI(this.scene, this);
        }
    }
    
    /**
     * 직업 클래스 업데이트
     */
    updateJobClass() {
        // 기존 직업 인스턴스 정리
        if (this.job) {
            this.job.destroy();
        }
        
        // 새로운 직업 인스턴스 생성
        switch (this.jobClass) {
            case 'slime':
                this.job = new SlimeJob(this);
                break;
            case 'mage':
                this.job = new MageJob(this);
                break;
            case 'assassin':
            case 'ninja':
                this.job = new AssassinJob(this);
                break;
            case 'warrior':
                this.job = new WarriorJob(this);
                break;
            case 'mechanic':
                this.job = new MechanicJob(this);
                break;
            default:
                this.job = new SlimeJob(this);
                break;
        }
        
        // 레벨에 따른 스탯 재계산
        this.applyJobStats();
    }
    
    /**
     * 직업별 스탯 적용
     */
    applyJobStats() {
        const stats = calculateStats(this.jobClass, this.level);
        this.maxHp = stats.hp;
        this.hp = Math.min(this.hp, this.maxHp); // 현재 체력이 최대체력을 넘지 않도록
        this.attack = stats.attack;
        this.defense = stats.defense;
        this.speed = stats.speed;
        this.visionRange = stats.visionRange;
    }
    
    /**
     * 크기 계산 및 업데이트
     */
    calculateColliderSize() {
        return this.size + 450;
    }
    
    updateSize() {
        this.setDisplaySize(this.size, this.size);
        this.colliderSize = this.calculateColliderSize();
        if (this.body) {
            this.body.setSize(this.colliderSize, this.colliderSize);
        }
    }
    
    setSize(newSize) {
        this.size = newSize;
        this.updateSize();
    }
    
    getSize() {
        return this.size;
    }
    
    /**
     * 캐릭터 크기를 레벨에 따라 업데이트
     */
    updateCharacterSize() {
        const baseSize = 16;
        const growthRate = 1;
        const maxSize = 40;
        
        const targetSize = baseSize + (this.level - 1) * growthRate;
        const finalSize = Math.min(targetSize, maxSize);
        
        this.size = finalSize;
        AssetLoader.adjustSpriteSize(this, finalSize, finalSize);
        this.updateSize();
    }
    
    /**
     * 메인 업데이트 루프
     */
    update(time, delta) {
        if (!this.isOtherPlayer) {
            if (!this.isJumping) {
                this.handleMovement();
            }
            this.handleSkills();
            
            // 직업별 업데이트
            if (this.job) {
                this.job.update(delta);
            }
            
            // UI 업데이트
            if (this.skillCooldownUI) {
                this.skillCooldownUI.update();
            }
            
            // 네트워크 위치 동기화
            this.syncNetworkPosition();
        }
        
        this.updateNameTextPosition();
    }
    
    /**
     * 이동 처리
     */
    handleMovement() {
        const speed = this.speed;
        this.setVelocity(0);
        
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
        
        this.updateDirection(movingUp, movingDown, movingLeft, movingRight);
    }

    /**
     * 방향 업데이트
     */
    updateDirection(movingUp, movingDown, movingLeft, movingRight) {
        const isMoving = movingUp || movingDown || movingLeft || movingRight;
        
        if (isMoving) {
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
        
        if (this.direction !== this.lastDirection) {
            this.updateJobSprite();
            this.lastDirection = this.direction;
        }
    }
    
    /**
     * 스킬 입력 처리
     */
    handleSkills() {
        // 스페이스바로 점프 (슬라임 전용)
        if (Phaser.Input.Keyboard.JustDown(this.spaceKey)) {
            if (this.job) {
                this.job.useJump();
            }
        }

        // Q키 또는 1번키로 첫 번째 스킬
        if (Phaser.Input.Keyboard.JustDown(this.qKey) || Phaser.Input.Keyboard.JustDown(this.oneKey)) {
            if (this.job) {
                this.job.useSkill(1);
            }
        }
        
        // E키 또는 2번키로 두 번째 스킬
        if (Phaser.Input.Keyboard.JustDown(this.eKey) || Phaser.Input.Keyboard.JustDown(this.twoKey)) {
            if (this.job) {
                this.job.useSkill(2);
            }
        }
        
        // R키 또는 3번키로 세 번째 스킬
        if (Phaser.Input.Keyboard.JustDown(this.rKey) || Phaser.Input.Keyboard.JustDown(this.threeKey)) {
            if (this.job) {
                this.job.useSkill(3);
            }
        }
        
        // F키로 전직
        if (Phaser.Input.Keyboard.JustDown(this.fKey)) {
            this.showJobSelection();
        }
      
        // I키로 무적 모드 토글
        if (Phaser.Input.Keyboard.JustDown(this.iKey)) {
            this.toggleInvincible();
        }
        
        // L키로 레벨업 테스트
        if (Phaser.Input.Keyboard.JustDown(this.lKey)) {
            this.testLevelUp();
        }
    }
  
    /**
     * 벽 충돌 처리
     */
    handleWallCollision(player, wall) {
        const body = player.body;
        if (!body) return true;

        const slideThreshold = 10;
        const velocity = body.velocity;
        const intersection = Phaser.Geom.Intersects.GetRectangleIntersection(body, wall.getBounds());
        const overlapX = intersection.width;
        const overlapY = intersection.height;

        if (velocity.x !== 0 && overlapY > 0 && overlapY < slideThreshold) {
            if (body.y < wall.y) {
                player.y -= overlapY;
            } else {
                player.y += overlapY;
            }
            return false;
        }

        if (velocity.y !== 0 && overlapX > 0 && overlapX < slideThreshold) {
            if (body.x < wall.x) {
                player.x -= overlapX;
                            } else {
                player.x += overlapX;
            }
            return false;
        }
        
        return true;
    }
    
    /**
     * 네트워크 위치 동기화
     */
    syncNetworkPosition() {
        if (this.networkManager && !this.isJumping && 
            (this.lastNetworkX !== this.x || this.lastNetworkY !== this.y || this.lastNetworkDirection !== this.direction)) {
            this.networkManager.updatePlayerPosition(this.x, this.y, this.direction, false);
            this.lastNetworkX = this.x;
            this.lastNetworkY = this.y;
            this.lastNetworkDirection = this.direction;
        }
    }
    
    /**
     * 직업 변경
     */
    changeJob(jobClass) {
        this.jobClass = jobClass;
        this.updateJobClass();
        this.updateJobSprite();
        this.updateUI();
        
        // 스킬 UI 재생성
        if (this.skillCooldownUI && !this.isOtherPlayer) {
            this.skillCooldownUI.refreshForJobChange();
        }
        
        // 네트워크 동기화
        if (this.networkManager && !this.isOtherPlayer) {
            this.networkManager.changeJob(jobClass);
        }
    }
    
    /**
     * 직업 선택 UI (간단한 순환 방식)
     */
    showJobSelection() {
        const jobs = ['slime', 'assassin', 'ninja', 'warrior', 'mage', 'mechanic'];
        const currentIndex = jobs.indexOf(this.jobClass);
        const nextIndex = (currentIndex + 1) % jobs.length;
        this.changeJob(jobs[nextIndex]);
    }
    
    /**
     * 스프라이트 업데이트
     */
    updateJobSprite() {
        const spriteKey = AssetLoader.getPlayerSpriteKey(this.jobClass, this.direction);
        
        if (this.scene.textures.exists(spriteKey)) {
            this.setTexture(spriteKey);
        } else {
            console.warn(`텍스처가 존재하지 않음: ${spriteKey}`);
                this.createFallbackTexture();
        }
        
        this.updateCharacterSize();
    }
    
    /**
     * 폴백 텍스처 생성
     */
    createFallbackTexture() {
        const fallbackKey = 'player_fallback';
        if (!this.scene.textures.exists(fallbackKey)) {
            const graphics = this.scene.add.graphics();
            graphics.fillStyle(0x00ff00);
            graphics.fillRect(0, 0, 64, 64);
            graphics.generateTexture(fallbackKey, 64, 64);
            graphics.destroy();
        }
        this.setTexture(fallbackKey);
    }
    
    /**
     * 경험치 획득
     */
    gainExp(amount) {
        this.exp += amount;
        if (this.exp >= this.expToNext) {
            this.levelUp();
        }
        this.updateUI();
    }
    
    /**
     * 레벨업
     */
    levelUp() {
        this.level++;
        this.exp -= this.expToNext;
        this.expToNext = Math.floor(this.expToNext * 1.2);
        
        // 직업별 스탯 재적용
        this.applyJobStats();
        this.hp = this.maxHp; // 레벨업 시 체력 풀 회복
        
        // 크기 업데이트
        this.updateCharacterSize();
        
        // 레벨업 이펙트
        this.effectManager.showLevelUpEffect(this.x, this.y);
        
        this.updateUI();
    }
    
    /**
     * 데미지 받기
     */
    takeDamage(damage) {
        if (this.isInvincible) {
            this.effectManager.showMessage(this.x, this.y - 30, '무적!', { fill: '#00ff00' });
            return;
        }
        
        const actualDamage = Math.max(1, damage - this.defense);
        this.hp = Math.max(0, this.hp - actualDamage);
        
        // 데미지 표시
        this.effectManager.showDamageText(this.x, this.y, actualDamage);
        
        this.updateUI();
        
        if (this.hp <= 0) {
            this.die();
        }
    }
    
    /**
     * 공격력 가져오기 (직업별 보너스 포함)
     */
    getAttackDamage() {
        let damage = this.attack;
        
        // 어쌔신/닌자의 은신 보너스 처리
        if ((this.jobClass === 'assassin' || this.jobClass === 'ninja') && this.job) {
            damage = this.job.getAttackDamage();
        }
        
        return damage;
    }
    
    /**
     * 무적 모드 토글
     */
    toggleInvincible() {
        this.isInvincible = !this.isInvincible;
        
        const message = this.isInvincible ? '무적 모드 ON' : '무적 모드 OFF';
        const color = this.isInvincible ? '#00ff00' : '#ff0000';
        
        this.effectManager.showMessage(this.x, this.y - 80, message, { fill: color });
        this.updateUI();
    }
    
    /**
     * 레벨업 테스트
     */
    testLevelUp() {
        this.gainExp(this.expToNext);
        this.effectManager.showMessage(this.x, this.y - 100, '레벨업 테스트!', { fill: '#ffff00' });
    }
    
    /**
     * 사망 처리
     */
    die() {
        this.scene.scene.restart();
    }
    
    /**
     * UI 업데이트
     */
    updateUI() {
        const statsElement = document.getElementById('stats');
        if (statsElement) {
            const jobInfo = getJobInfo(this.jobClass);
            statsElement.textContent = `레벨: ${this.level} | HP: ${this.hp}/${this.maxHp} | 직업: ${jobInfo.name}`;
        }
    }
    
    /**
     * 자살 (테스트용)
     */
    suicide() {
        this.die();
    }
    
    /**
     * 속도 부스트 (치트)
     */
    activateSpeedBoost(multiplier) {
        if (!this.originalSpeed) {
            this.originalSpeed = this.speed;
        }
        this.speed = this.originalSpeed * multiplier;
        console.log(`속도 부스트 활성화: ${this.originalSpeed} -> ${this.speed}`);
    }
    
    deactivateSpeedBoost() {
        if (this.originalSpeed) {
            this.speed = this.originalSpeed;
            console.log(`속도 부스트 비활성화: ${this.speed}`);
        }
    }
    
    // 네트워크 관련 메서드들
    setNetworkId(id) {
        this.networkId = id;
    }

    setNetworkManager(networkManager) {
        this.networkManager = networkManager;
        this.lastNetworkX = this.x;
        this.lastNetworkY = this.y;
        this.lastNetworkDirection = this.direction;
    }

    setIsOtherPlayer(isOther) {
        this.isOtherPlayer = isOther;
    }

    updateFromNetwork(data) {
        this.setPosition(data.x, data.y);
        this.direction = data.direction;
        this.isJumping = data.isJumping;
        this.updateJobSprite();
    }

    // 이름표 관련 메서드들
    createNameText(nickname, team = this.team, depth) {
        if (this.nameText) {
            this.nameText.destroy();
        }
        
        const displayName = nickname || `Player ${this.networkId ? this.networkId.slice(0, 6) : 'Unknown'}`;
        const teamColor = team === 'red' ? '#ff4444' : '#4444ff';
        
        this.nameText = this.scene.add.text(this.x, this.y - 40, displayName, {
            fontSize: '12px',
            fill: teamColor,
            fontStyle: 'bold',
            stroke: '#000',
            strokeThickness: 2
        }).setOrigin(0.5);
        
        this.nameText.setDepth(depth);
        return this.nameText;
    }
    
    updateNameTextPosition() {
        if (this.nameText) {
            this.nameText.setPosition(this.x, this.y - 40);
        }
    }
    
    updateNickname(nickname) {
        if (this.nameText) {
            const displayName = nickname || `Player ${this.networkId ? this.networkId.slice(0, 6) : 'Unknown'}`;
            this.nameText.setText(displayName);
        }
    }
    
    updateTeamColor(team = this.team) {
        if (this.nameText) {
            const teamColor = team === 'red' ? '#ff4444' : '#4444ff';
            this.nameText.setColor(teamColor);
        }
    }
    
    // 위치 설정 오버라이드
    setPosition(x, y) {
        super.setPosition(x, y);
        this.updateNameTextPosition();
        return this;
    }
    
    setX(x) {
        super.setX(x);
        this.updateNameTextPosition();
        return this;
    }
    
    setY(y) {
        super.setY(y);
        this.updateNameTextPosition();
        return this;
    }

    /**
     * 정리 작업
     */
    destroy() {
        if (this.nameText) {
            this.nameText.destroy();
        }
        
        if (this.skillCooldownUI) {
            this.skillCooldownUI.destroy();
        }
        
        if (this.job) {
            this.job.destroy();
        }
        
        super.destroy();
    }
} 