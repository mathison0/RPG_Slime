import Phaser from 'phaser';
import { getJobInfo, calculateStats } from '../shared/JobClasses.js';
import AssetLoader from '../utils/AssetLoader.js';
import SkillCooldownUI from '../ui/SkillCooldownUI.js';
import EffectManager from '../effects/EffectManager.js';

// 직업별 클래스 import
import SlimeJob from './jobs/SlimeJob.js';
import MageJob from './jobs/MageJob.js';
import AssassinJob from './jobs/AssassinJob.js';
import NinjaJob from './jobs/NinjaJob.js';
import WarriorJob from './jobs/WarriorJob.js';
import MechanicJob from './jobs/MechanicJob.js';
import ArcherJob from './jobs/ArcherJob.js';
import SupporterJob from './jobs/SupporterJob.js';

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
        this.expToNext = 100; // 서버에서 동기화됨
        this.maxHp = 100;
        this.hp = this.maxHp;
        this.speed = 200;
        this.attack = 20;
        this.defense = 10;
        
        // 직업 관련
        this.jobClass = 'slime';
        this.job = null; // 직업 클래스 인스턴스
        
        // 크기 관련 (서버에서 받아서 설정됨)
        this.size = 32; // 기본 크기 (서버에서 올바른 값을 받아서 설정될 예정)
        this.baseCameraZoom = 1;
        this.colliderSize = 0;

        // 방향 관련
        this.direction = 'front';
        this.lastDirection = 'front';
        
        // 상태
        this.isJumping = false;
        this.team = team;
        this.isInvincible = false;
        this.isDead = false; // 사망 상태
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
        
        // 디버그 관련
        this.debugMode = false;
        this.debugGraphics = null;
        this.spriteDebugBox = null;
        this.bodyDebugBox = null;
        
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
        
        // 마우스 클릭 이벤트 설정 (중복 등록 방지)
        if (!this.mouseClickHandler) {
            this.mouseClickHandler = (pointer) => {
                if (pointer.leftButtonDown()) {
                    this.handleMouseClick(pointer.worldX, pointer.worldY);
                }
            };
            this.scene.input.on('pointerdown', this.mouseClickHandler);
        }
        this.tKey = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.T); // 디버그 토글
    }
    
    /**
     * 캐릭터 초기화
     */
    initializeCharacter() {
        this.updateJobClass();
        this.updateJobSprite();
        // 크기는 서버에서 받은 값으로만 설정됨 (클라이언트에서 계산하지 않음)
        this.updateCharacterSize(); // 화면 업데이트용으로만 사용
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
        try {
            switch (this.jobClass) {
                case 'slime':
                    this.job = new SlimeJob(this);
                    break;
                case 'mage':
                    this.job = new MageJob(this);
                    break;
                case 'assassin':
                    this.job = new AssassinJob(this);
                    break;
                case 'ninja':
                    this.job = new NinjaJob(this);
                    break;
                case 'warrior':
                    this.job = new WarriorJob(this);
                    break;
                            case 'mechanic':
                this.job = new MechanicJob(this);
                break;
            case 'archer':
                this.job = new ArcherJob(this);
                break;
            case 'supporter':
                this.job = new SupporterJob(this);
                break;
            default:
                this.job = new SlimeJob(this);
                break;
            }
        } catch (error) {
            console.error('직업 생성 중 오류 발생:', error);
            // 오류 발생 시 기본 슬라임으로 폴백
            this.jobClass = 'slime';
            this.job = new SlimeJob(this);
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
    

    
    updateSize() {
        console.log(`updateSize 호출: this.size=${this.size}, 물리적 크기 업데이트 중...`);
        
        // 화면 표시 크기와 물리적 충돌 크기를 동일하게 설정
        this.setDisplaySize(this.size, this.size);
        this.colliderSize = this.size; // 스프라이트 크기와 동일하게 설정
        
        if (this.body) {
            const bodyWidth = this.colliderSize / this.scaleX;
            const bodyHeight = this.colliderSize / this.scaleY;
            
            this.body.setSize(bodyWidth, bodyHeight);
            
            // 충돌 박스를 스프라이트 중앙에 맞추기 위한 오프셋 계산
            this.body.setOffset(0, 0);
        }
        
        console.log(`updateSize 완료: displaySize=${this.displayWidth}x${this.displayHeight}, colliderSize=${this.colliderSize}`);
        
        // 디버그 박스 업데이트
        if (this.debugMode) {
            this.updateDebugBoxes();
        }
    }
    
    setSize(newSize) {
        const oldSize = this.size;
        console.log(`setSize 호출: ${oldSize} -> ${newSize}, level=${this.level}, networkId=${this.networkId}, isOtherPlayer=${this.isOtherPlayer}`);
        console.trace('setSize 호출 스택:'); // 호출 스택 추가
        
        this.size = newSize;
        this.updateSize();
        
        // 네트워크 동기화 (크기가 실제로 변경된 경우만)
        if (oldSize !== newSize && this.networkManager && !this.isOtherPlayer) {
            console.log(`setSize: 네트워크로 size 업데이트 전송: ${newSize}`);
            this.networkManager.updatePlayerPosition(this.x, this.y, this.direction, false, { size: newSize });
        }
    }
    
    getSize() {
        return this.size;
    }
    
    /**
     * 캐릭터 크기를 서버에서 받은 값으로 업데이트 (크기 계산은 서버에서만 수행)
     */
    updateCharacterSize() {
        // 서버에서 받은 크기 정보만 사용하고, 화면 표시만 업데이트
        console.log(`updateCharacterSize: 서버에서 받은 size=${this.size} 사용, 화면 업데이트만 수행`);
        
        // 직접 크기 설정 (크기 계산은 서버에서만 수행)
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
        
        // 디버그 박스 업데이트
        if (this.debugMode) {
            this.updateDebugBoxes();
        }
    }
    
    /**
     * 이동 처리
     */
    handleMovement() {
        // 죽은 상태에서는 이동 불가
        if (this.isDead) {
            this.setVelocity(0);
            return;
        }
        
        const speed = this.speed;
        this.setVelocity(0);
        
        // 슬라임 스킬 사용 중이면 이동 불가
        if (this.isUsingSlimeSkill) {
            return;
        }
        
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
     * 마우스 클릭 처리
     */
    handleMouseClick(worldX, worldY) {
        // 다른 플레이어면 실행하지 않음
        if (this.isOtherPlayer) {
            return;
        }

        // 중복 실행 방지 (마지막 클릭 시간 체크)
        const currentTime = this.scene.time.now;
        if (this.lastClickTime && currentTime - this.lastClickTime < 100) {
            return; // 100ms 내에 중복 클릭 방지
        }
        this.lastClickTime = currentTime;

        // 모든 직업이 기본 공격 사용 가능
        if (this.job && this.job.useBasicAttack) {
            const success = this.job.useBasicAttack(worldX, worldY);
            
            // 기본 공격이 성공적으로 실행되었으면 서버로 전송
            if (success && this.networkManager) {
                this.networkManager.useSkill('basic_attack', {
                    targetX: worldX,
                    targetY: worldY,
                    jobClass: this.jobClass
                });
            }
        }
    }

    /**
     * 스킬 입력 처리
     */
    handleSkills() {
        // 죽은 상태에서는 스킬과 점프 사용 불가
        if (this.isDead) {
            return;
        }

        // 스페이스바로 점프 (모든 직업 공통)
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
        
        // T키로 디버그 모드 토글
        if (Phaser.Input.Keyboard.JustDown(this.tKey)) {
            this.toggleDebugMode();
        }
    }
  
        /**
     * 벽 충돌 처리
     */
    handleWallCollision(player, wall) {
        const body = player.body;
        if (!body) return true;

        const slideThreshold = body.width / 4;
        const velocity = body.velocity;
        const intersection = Phaser.Geom.Intersects.GetRectangleIntersection(body, wall.getBounds());
        const overlapX = intersection.width;
        const overlapY = intersection.height;

        const wallBounds = wall.getBounds();
        
        // 수평 이동 시: 플레이어 중심축에서 벽의 위/아래 가장자리까지의 거리 확인
        if (velocity.x !== 0 && overlapY > 0) {
            const thresholdTop = wallBounds.top + slideThreshold;
            const thresholdBottom = wallBounds.bottom - slideThreshold;
            const moveX = velocity.x > 0 ? 1 : -1;
            
            if (body.y + body.height < thresholdTop) {
                player.y -= overlapY;
                player.x += moveX;
                return false;
            } else if (body.y > thresholdBottom) {
                player.y += overlapY;
                player.x += moveX;
                return false;
            }
        }

        // 수직 이동 시: 플레이어 중심축에서 벽의 좌/우 가장자리까지의 거리 확인
        if (velocity.y !== 0 && overlapX > 0) {
            const thresholdLeft = wallBounds.left + slideThreshold;
            const thresholdRight = wallBounds.right - slideThreshold;
            const moveY = velocity.y > 0 ? 1 : -1;
            
            if (body.x + body.width < thresholdLeft) {
                player.x -= overlapX;
                player.y += moveY;
                return false;
            } else if (body.x > thresholdRight) {
                player.x += overlapX;
                player.y += moveY;
                return false;
            }
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
        const jobs = ['slime', 'assassin', 'ninja', 'warrior', 'mage', 'mechanic', 'archer', 'supporter'];
        const currentIndex = jobs.indexOf(this.jobClass);
        const nextIndex = (currentIndex + 1) % jobs.length;
        this.changeJob(jobs[nextIndex]);
    }
    
    /**
     * 스프라이트 업데이트
     */
    updateJobSprite() {
        // 스킬 사용 중일 때는 스프라이트 변경하지 않음
        if (this.isUsingSlimeSkill || this.isUsingRoarSkill) {
            return;
        }
        
        const spriteKey = AssetLoader.getPlayerSpriteKey(this.jobClass, this.direction);
        
        if (this.scene.textures.exists(spriteKey)) {
            this.setTexture(spriteKey);
        } else {
            console.warn(`텍스처가 존재하지 않음: ${spriteKey}`);
            this.createFallbackTexture();
        }
        
        // 크기는 서버에서 받은 값으로만 설정됨 (클라이언트에서 계산하지 않음)
        this.updateCharacterSize(); // 화면 업데이트용으로만 사용
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
     * 경험치 획득 (더 이상 사용하지 않음 - 서버에서 관리)
     */
    gainExp(amount) {
        console.warn('gainExp 호출됨 - 이제 서버에서 레벨업을 관리합니다. testLevelUp()을 사용하세요.');
        // 경험치는 서버에서 관리하므로 클라이언트에서는 처리하지 않음
    }
    
    /**
     * 레벨업 (더 이상 사용하지 않음 - 서버에서 관리)
     */
    levelUp() {
        console.warn('levelUp 호출됨 - 이제 서버에서 레벨업을 관리합니다.');
        // 레벨업은 서버에서 처리하고 클라이언트는 결과만 받음
    }
    
    /**
     * 데미지 받기
     */
    takeDamage(damage) {
        if (this.isDead) {
            return; // 이미 죽은 상태면 데미지 받지 않음
        }
        
        if (this.isInvincible) {
            this.effectManager.showMessage(this.x, this.y - 30, '무적!', { fill: '#00ff00' });
            return;
        }
        
        // 방어력 계산 제거 (서버와 동일하게)
        const actualDamage = damage;
        this.hp = Math.max(0, this.hp - actualDamage);
        
        // 데미지 표시
        this.effectManager.showDamageText(this.x, this.y, actualDamage);
        
        this.updateUI();
        
        if (this.hp <= 0) {
            this.isDead = true;
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
     * 레벨업 테스트 (서버에 요청)
     */
    testLevelUp() {
        if (this.networkManager && !this.isOtherPlayer) {
            console.log('서버에 레벨업 요청 전송');
            this.networkManager.requestLevelUp();
            this.effectManager.showMessage(this.x, this.y - 100, '레벨업 요청 전송!', { fill: '#ffff00' });
        }
    }
    
    /**
     * 서버에서 받은 체력 정보로 업데이트
     */
    updateHealthFromServer() {
        // 서버에서 이미 데미지가 적용되었으므로 클라이언트에서는 시각적 효과만 처리
        if (this.hp <= 0 && !this.isDead) {
            this.die();
        }
    }

    /**
     * 서버에서 체력 정보 설정
     */
    setHealthFromServer(hp, maxHp) {
        this.hp = hp;
        this.maxHp = maxHp;
        
        if (this.hp <= 0 && !this.isDead) {
            this.die();
        }
    }

    /**
     * 플레이어 사망 처리
     */
    die() {
        // 새로운 사망 처리 로직 사용
        this.scene.handlePlayerDeath('direct');
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
    }
    
    deactivateSpeedBoost() {
        if (this.originalSpeed) {
            this.speed = this.originalSpeed;
        }
        this.buffFieldActive = false;
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
        if (this.debugMode) {
            this.updateDebugBoxes();
        }
        return this;
    }
    
    setX(x) {
        super.setX(x);
        this.updateNameTextPosition();
        if (this.debugMode) {
            this.updateDebugBoxes();
        }
        return this;
    }
    
    setY(y) {
        super.setY(y);
        this.updateNameTextPosition();
        if (this.debugMode) {
            this.updateDebugBoxes();
        }
        return this;
    }

    /**
     * 디버그 모드 토글
     */
    toggleDebugMode() {
        this.debugMode = !this.debugMode;
        
        if (this.debugMode) {
            this.createDebugBoxes();
            this.effectManager.showMessage(this.x, this.y - 120, '디버그 모드 ON', { fill: '#00ffff' });
        } else {
            this.destroyDebugBoxes();
            this.effectManager.showMessage(this.x, this.y - 120, '디버그 모드 OFF', { fill: '#888888' });
        }
    }
    
    /**
     * 디버그 박스 생성
     */
    createDebugBoxes() {
        this.destroyDebugBoxes(); // 기존 박스 제거
        
        // 스프라이트 크기 박스 (파란색)
        this.spriteDebugBox = this.scene.add.graphics();
        this.spriteDebugBox.lineStyle(2, 0x0088ff);
        this.spriteDebugBox.setDepth(1000);
        
        // 물리 바디 크기 박스 (빨간색)
        this.bodyDebugBox = this.scene.add.graphics();
        this.bodyDebugBox.lineStyle(2, 0xff0088);
        this.bodyDebugBox.setDepth(1001);
        
        this.updateDebugBoxes();
    }
    
    /**
     * 디버그 박스 업데이트
     */
    updateDebugBoxes() {
        if (!this.spriteDebugBox || !this.bodyDebugBox) return;
        
        // 스프라이트 크기 박스 (파란색) - 실제 표시되는 크기
        this.spriteDebugBox.clear();
        this.spriteDebugBox.lineStyle(2, 0x0088ff);
        const spriteX = this.x - this.displayWidth / 2;
        const spriteY = this.y - this.displayHeight / 2;
        this.spriteDebugBox.strokeRect(spriteX, spriteY, this.displayWidth, this.displayHeight);
        
        // 물리 바디 크기 박스 (빨간색) - 충돌 판정 크기
        this.bodyDebugBox.clear();
        this.bodyDebugBox.lineStyle(2, 0xff0088);
        if (this.body) {
            this.bodyDebugBox.strokeRect(this.body.x, this.body.y, this.body.width, this.body.height);
        }
        
        // 디버그 정보 텍스트 업데이트
        this.updateDebugInfo();
    }
    
    /**
     * 디버그 정보 텍스트 업데이트
     */
    updateDebugInfo() {
        if (!this.debugMode) return;
        
        // 기존 디버그 텍스트 제거
        if (this.debugText) {
            this.debugText.destroy();
        }
        
        // 디버그 정보 생성
        const spriteInfo = `스프라이트: ${this.displayWidth}x${this.displayHeight}`;
        const bodyInfo = this.body ? `물리바디: ${this.body.width}x${this.body.height}` : '물리바디: 없음';
        const offsetInfo = this.body ? `오프셋: ${this.body.offset.x}, ${this.body.offset.y}` : '오프셋: 없음';
        const debugInfo = `${spriteInfo}\n${bodyInfo}\n${offsetInfo}`;
        
        this.debugText = this.scene.add.text(this.x + 50, this.y - 40, debugInfo, {
            fontSize: '10px',
            fill: '#ffffff',
            backgroundColor: '#000000',
            padding: { x: 4, y: 4 }
        }).setOrigin(0);
        
        this.debugText.setDepth(1002);
    }
    
    /**
     * 디버그 박스 제거
     */
    destroyDebugBoxes() {
        if (this.spriteDebugBox) {
            this.spriteDebugBox.destroy();
            this.spriteDebugBox = null;
        }
        
        if (this.bodyDebugBox) {
            this.bodyDebugBox.destroy();
            this.bodyDebugBox = null;
        }
        
        if (this.debugText) {
            this.debugText.destroy();
            this.debugText = null;
        }
    }

    /**
     * 정리 작업
     */
    destroy() {
        this.destroyDebugBoxes();
        // 스킬 이펙트 타이머 정리
        if (this.roarEffectTimer) {
            this.scene.time.removeEvent(this.roarEffectTimer);
            this.roarEffectTimer = null;
        }
        
        // 슬라임 스킬 타이머 정리
        if (this.slimeSkillTimer) {
            this.scene.time.removeEvent(this.slimeSkillTimer);
            this.slimeSkillTimer = null;
        }
        
        // 슬라임 스킬 이펙트 정리
        if (this.slimeSkillEffect) {
            this.slimeSkillEffect.destroy();
            this.slimeSkillEffect = null;
        }
        
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