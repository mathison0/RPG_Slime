import Phaser from 'phaser';
import AssetLoader from '../utils/AssetLoader.js';
import SkillCooldownUI from '../ui/SkillCooldownUI.js';
import EffectManager from '../effects/EffectManager.js';
import HealthBar from '../ui/HealthBar.js';

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
        this.healthBar = null;
        
        // 기본 스탯
        this.level = 1;
        this.exp = 0;
        this.expToNext = 100; // 서버에서 동기화됨
        this.maxHp = 100;
        this.hp = this.maxHp;
        this.speed = 200;
        this.attack = 20;
        
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
        
        // 네트워크 동기화 관련
        this.lastNetworkX = this.x;
        this.lastNetworkY = this.y;
        this.lastNetworkDirection = this.direction;
        
        // 상태
        this.isJumping = false;
        this.team = team;
        this.isInvincible = false;
        this.isDead = false; // 사망 상태
        this.visionRange = 300;
        this.minimapVisionRange = 200;
        
        // 디버그 모드 최적화
        this.lastEnemyDebugUpdate = 0;
        this.enemyDebugUpdateInterval = 200; // 200ms마다 업데이트
        
        // 물리 속성
        this.setCollideWorldBounds(true);
        
        // 입력 설정 (본인 플레이어만)
        this.setupInput();
        
        // 매니저들 초기화
        this.effectManager = new EffectManager(scene);
        this.skillCooldownUI = null;
        
        // 지연된 스킬 이펙트 타이머들 추적
        this.delayedSkillTimers = new Set();
        
        // 후딜레이 관련
        this.isInAfterDelay = false;
        this.afterDelayEndTime = 0;
        
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
        
        // 본인 플레이어만 UI 생성
        if (!this.isOtherPlayer) {
            this.skillCooldownUI = new SkillCooldownUI(this.scene, this);
            // createUI에서 이미 직업에 맞는 스킬이 생성되므로 중복 호출 불필요
        }
        
        // 체력바 생성 (모든 플레이어에 적용)
        this.createHealthBar();
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
     * 직업별 스탯 적용 (서버에서 계산된 값 사용)
     * 이제 서버에서 모든 스탯을 계산해서 보내주므로 여기서는 아무것도 하지 않음
     */
    applyJobStats() {
        // 서버에서 updatePlayerStates를 통해 스탯이 전송되므로 
        // 클라이언트에서는 별도 계산하지 않음
        console.log('applyJobStats: 서버에서 스탯 관리 중');
    }

    /**
     * 직업 변경 (서버에서 호출됨)
     */
    setJobClass(newJobClass) {
        this.jobClass = newJobClass;
        this.updateJobClass();
        this.updateJobSprite();
        
        // 스킬 쿨다운 UI 갱신
        if (this.skillCooldownUI) {
            // updateVisibleSkills에서 직업 변경을 감지하여 자동으로 UI를 재생성하므로
            // 여기서는 직업 정보만 업데이트하고 update()에서 처리되도록 함
            console.log(`[Player] 직업 변경: ${newJobClass}`);
        }
        
        // 전체 UI 업데이트 (직업 정보 반영)
        this.updateUI();
    }
    

    
    updateSize() {
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
        
        // 디버그 박스 업데이트
        if (this.debugMode) {
            this.updateDebugBoxes();
        }
    }
    
    setSize(newSize) {
        const oldSize = this.size;
        this.size = newSize;
        this.updateSize();
        
        // 체력바 크기 업데이트
        this.updateHealthBar();
        
        // 네트워크 동기화 (크기가 실제로 변경된 경우만)
        if (oldSize !== newSize && this.networkManager && !this.isOtherPlayer) {
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
        // 직접 크기 설정 (크기 계산은 서버에서만 수행)
        this.updateSize();
        // 체력바 크기도 업데이트
        this.updateHealthBar();
        // 전체 UI 업데이트 (레벨, 크기 변화 반영)
        this.updateUI();
    }
    
    /**
     * 메인 업데이트 루프
     */
    update(time, delta) {
        if (!this.isOtherPlayer) {
            // 후딜레이 상태 체크
            this.updateAfterDelayStatus();
            
            this.handleMovement();
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
        
        // 매 프레임마다 이름표와 체력바 위치 업데이트 (모든 플레이어)
        this.updateNameTextPosition();
        this.updateHealthBar();
        
        // 디버그 박스 업데이트
        if (this.debugMode) {
            this.updateDebugBoxes();
        }
    }
    
    /**
     * 후딜레이 상태 업데이트
     */
    updateAfterDelayStatus() {
        if (this.isInAfterDelay) {
            const now = Date.now();
            if (now >= this.afterDelayEndTime) {
                this.isInAfterDelay = false;
                this.afterDelayEndTime = 0;
                console.log('후딜레이 종료 [time: ' + Date.now() + ']');
            }
        }
    }

    /**
     * 이동 처리 (클라이언트에서 처리)
     */
    handleMovement() {
        // 죽은 상태에서는 이동 불가
        if (this.isDead) {
            this.setVelocity(0);
            return;
        }

        // 후딜레이 중일 때는 이동 불가
        if (this.isInAfterDelay) {
            this.setVelocity(0);
            return;
        }
        
        const speed = this.speed;
        this.setVelocity(0);
        
        if (this.isJumping || this.isCasting || this.isStunned) {
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
        if (this.isOtherPlayer) {
            return;
        }

        this.lastClickTime = Date.now();

        // 서버로 투사체 발사 요청 전송
        if (this.job && this.job.useBasicAttack) {
            this.job.useBasicAttack(worldX, worldY);
        }
    }

    /**
     * 스킬 입력 처리 (서버 권한 방식)
     */
    handleSkills() {
        // 서버에서 모든 조건을 검증하므로 클라이언트에서는 조건 체크 없이 요청만 전송

        // 스페이스바로 점프 (모든 직업 공통)
        if (Phaser.Input.Keyboard.JustDown(this.spaceKey)) {
            this.requestSkillUse('jump');
        }

        // Q키로 첫 번째 스킬
        if (Phaser.Input.Keyboard.JustDown(this.qKey)) {
            this.requestSkillUse('skill1');
        }
        
        // E키로 두 번째 스킬
        if (Phaser.Input.Keyboard.JustDown(this.eKey)) {
            this.requestSkillUse('skill2');
        }
        
        // R키로 세 번째 스킬
        if (Phaser.Input.Keyboard.JustDown(this.rKey)) {
            this.requestSkillUse('skill3');
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
     * 네트워크 위치 동기화 (주기적으로 서버에 위치 전송)
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
     * 서버에 스킬 사용 요청
     */
    requestSkillUse(skillType) {
        if (this.networkManager) {
            // 타겟이 필요한 스킬의 경우 마우스 위치 전송
            const pointer = this.scene.input.activePointer;
            const worldPoint = this.scene.cameras.main.getWorldPoint(pointer.x, pointer.y);
            
            this.networkManager.useSkill(skillType, worldPoint.x, worldPoint.y);
        }
    }
    
    /**
     * 직업 변경 요청 (서버 권한 방식)
     */
    showJobSelection() {
        const jobs = ['slime', 'assassin', 'ninja', 'warrior', 'mage', 'mechanic', 'archer', 'supporter'];
        const currentIndex = jobs.indexOf(this.jobClass);
        const nextIndex = (currentIndex + 1) % jobs.length;
        
        // 서버에 직업 변경 요청
        if (this.networkManager && !this.isOtherPlayer) {
            this.networkManager.changeJob(jobs[nextIndex]);
        }
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
     * 데미지 받기
     */
    takeDamage(damage) {
        if (this.isDead) {
            return; // 이미 죽은 상태면 데미지 받지 않음
        }
        
        // 데미지 표시 (무적 상태는 서버에서 처리됨)
        this.effectManager.showDamageText(this.x, this.y, damage);
    }
    
    /**
     * 무적 모드 토글 (서버에 요청)
     */
    toggleInvincible() {
        if (this.networkManager && this.networkManager.socket && this.networkManager.isConnected) {
            this.networkManager.socket.emit('player-invincible-request', {});
            console.log('무적 상태 토글 요청을 서버에 전송');
        } else {
            console.warn('네트워크 매니저가 없거나 연결되지 않아서 무적 상태를 토글할 수 없습니다');
        }
    }
    
    /**
     * 레벨업 테스트 (서버에 요청)
     */
    testLevelUp() {
        if (this.networkManager && !this.isOtherPlayer) {
            this.networkManager.requestLevelUp();
        }
    }

    /**
     * 서버에서 체력 정보 설정
     */
    setHealthFromServer(hp, maxHp) {
        this.hp = hp;
        this.maxHp = maxHp;
        
        // 체력바 업데이트
        this.updateHealthBar();
        
        // 전체 UI 업데이트
        this.updateUI();
        
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
     * 지연된 스킬 이펙트들을 모두 정리
     */
    clearDelayedSkillEffects() {
        // 지연된 타이머들 모두 제거
        for (const timer of this.delayedSkillTimers) {
            if (timer && timer.remove) {
                timer.remove();
            }
        }
        this.delayedSkillTimers.clear();
        
        // 기존 스킬 이펙트들 정리
        if (this.slimeSkillEffect) {
            this.slimeSkillEffect.destroy();
            this.slimeSkillEffect = null;
        }
        
        if (this.slimeSkillTimer) {
            this.scene.time.removeEvent(this.slimeSkillTimer);
            this.slimeSkillTimer = null;
        }
        
        if (this.wardEffect) {
            this.wardEffect.destroy();
            this.wardEffect = null;
        }
        
        // 직업별 스킬 이펙트 정리
        if (this.job && this.job.clearSkillEffects) {
            this.job.clearSkillEffects();
        }
        
        console.log(`플레이어 ${this.networkId || 'local'}의 지연된 스킬 이펙트들 정리 완료`);
    }

    /**
     * 플레이어의 현재 상태를 UI에 반영 (본인 플레이어에게만 적용)
     */
    updateUI() {
        // 다른 플레이어들은 UI를 업데이트하지 않음
        if (this.isOtherPlayer) {
            return;
        }
        
        // 새로운 UI 구조에 맞게 각 요소 업데이트
        const levelElement = document.getElementById('level');
        const hpElement = document.getElementById('hp');
        const jobElement = document.getElementById('job');
        const expElement = document.getElementById('exp');
        
        if (levelElement) {
            levelElement.textContent = `레벨: ${this.level}`;
        }
        
        if (hpElement) {
            hpElement.textContent = `HP: ${this.hp}/${this.maxHp}`;
        }
        
        if (jobElement) {
            const jobName = this.jobInfo?.name || this.jobClass;
            jobElement.textContent = `직업: ${jobName}`;
        }
        
        if (expElement) {
            const currentExp = this.exp || 0;
            const expToNext = this.expToNext || 100;
            expElement.textContent = `경험치: ${currentExp}/${expToNext}`;
        }

        // 스킬 쿨타임 UI 업데이트 (본인 플레이어만)
        if (this.skillCooldownUI && this.serverSkillCooldowns) {
            this.skillCooldownUI.updateFromServer(this.serverSkillCooldowns);
        }
        
        // 체력바 업데이트 (모든 플레이어에게 적용)
        if (this.healthBar) {
            this.healthBar.updateHealth(this.hp, this.maxHp);
        }
    }
    
    /**
     * 자살 (치트) - 서버에 사망 요청
     */
    suicide() {
        if (this.networkManager && this.networkManager.socket && this.networkManager.isConnected) {
            this.networkManager.socket.emit('player-suicide-request', {});
            console.log('자살 치트 요청을 서버에 전송');
        } else {
            console.warn('네트워크 매니저가 없거나 연결되지 않아서 자살 치트를 사용할 수 없습니다');
        }
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
        
        // 점프 상태 변경 시 속도를 0으로 설정
        if (data.isJumping) {
            // 점프가 시작될 때 즉시 속도를 0으로 설정
            this.setVelocity(0, 0);
        }
        
        this.isJumping = data.isJumping;
        this.isStunned = data.isStunned; // 기절 상태 추가
        this.updateJobSprite();
    }

    // 체력바 관련 메서드들
    createHealthBar() {
        if (this.healthBar) {
            this.healthBar.destroy();
        }
        
        // 체력바 설정 (체력바만)
        const healthBarConfig = {
            barWidth: 50,
            barHeight: 6,
            borderWidth: 1,
            backgroundColor: 0x000000,
            borderColor: 0xffffff,
            healthColor: 0x00ff00,
            lowHealthColor: 0xff0000,
            lowHealthThreshold: 0.3,
            yOffsetFromTop: -10, // 엔티티 위쪽 가장자리에서 10px 위에
            depth: 960 // 초기값, NetworkEventManager와 VisionManager에서 동적으로 재설정됨
        };
        
        this.healthBar = new HealthBar(this.scene, this, healthBarConfig);
        this.updateHealthBar();
    }
    
    updateHealthBar() {
        if (this.healthBar) {
            this.healthBar.updateHealth(this.hp, this.maxHp);
            this.healthBar.updatePosition();
        }
    }

    // 이름표 관련 메서드들
    createNameText(nickname, team = this.team, depth) {
        if (this.nameText) {
            this.nameText.destroy();
        }
        
        const displayName = nickname || `Player ${this.networkId ? this.networkId.slice(0, 6) : 'Unknown'}`;
        const teamColor = team === 'red' ? '#ff4444' : '#4444ff';
        
        // 엔티티의 크기를 고려한 위치 계산
        const entitySize = this.size || this.displayHeight || 32;
        const entityTop = this.y - (entitySize / 2);
        const nameY = entityTop - 25; // 엔티티 위쪽 가장자리에서 25px 위에
        
        this.nameText = this.scene.add.text(this.x, nameY, displayName, {
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
            // 엔티티의 크기를 고려한 위쪽 가장자리 계산
            const entitySize = this.size || this.displayHeight || 32;
            const entityTop = this.y - (entitySize / 2);
            
            // 이름표 위치 (엔티티 위쪽 가장자리에서 25px 위에)
            const nameY = entityTop - 25;
            this.nameText.setPosition(this.x, nameY);
        }
    }
    
    updateNickname(nickname) {
        this.nickname = nickname;
        if (this.nameText) {
            const displayName = nickname || `Player ${this.networkId ? this.networkId.slice(0, 6) : 'Unknown'}`;
            this.nameText.setText(displayName);
        }
    }
    
    updateTeamColor(team = this.team) {
        this.team = team;
        if (this.nameText) {
            const teamColor = team === 'red' ? '#ff4444' : '#4444ff';
            this.nameText.setColor(teamColor);
        }
    }
    
    // 위치 설정 오버라이드 - 이제는 update에서 처리하므로 즉시 업데이트만
    setPosition(x, y) {
        const changed = (this.x !== x || this.y !== y);
        super.setPosition(x, y);
        
        if (changed) {
            // 즉시 업데이트 (중요한 위치 변경의 경우)
            this.updateNameTextPosition();
            this.updateHealthBar();
            if (this.debugMode) {
                this.updateDebugBoxes();
            }
        }
        return this;
    }
    
    setX(x) {
        const changed = (this.x !== x);
        super.setX(x);
        
        if (changed) {
            this.updateNameTextPosition();
            this.updateHealthBar();
            if (this.debugMode) {
                this.updateDebugBoxes();
            }
        }
        return this;
    }
    
    setY(y) {
        const changed = (this.y !== y);
        super.setY(y);
        
        if (changed) {
            this.updateNameTextPosition();
            this.updateHealthBar();
            if (this.debugMode) {
                this.updateDebugBoxes();
            }
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
            this.createEnemyDebugBoxes(); // 몬스터 디버그 정보 추가
            this.lastEnemyDebugUpdate = 0; // 디버그 타이머 초기화 (즉시 업데이트되도록)
            this.effectManager.showMessage(this.x, this.y - 120, '디버그 모드 ON', { fill: '#00ffff' });
        } else {
            this.destroyDebugBoxes();
            this.destroyEnemyDebugBoxes(); // 몬스터 디버그 정보 제거
            this.lastEnemyDebugUpdate = 0; // 디버그 타이머 초기화
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
        
        // 몬스터 디버그 정보 업데이트 (성능 최적화: 일정 간격마다만 업데이트)
        const currentTime = Date.now();
        if (currentTime - this.lastEnemyDebugUpdate > this.enemyDebugUpdateInterval) {
            this.updateEnemyDebugBoxes();
            this.lastEnemyDebugUpdate = currentTime;
        }
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
     * 몬스터 디버그 박스 생성
     */
    createEnemyDebugBoxes() {
        this.destroyEnemyDebugBoxes(); // 기존 박스 제거
        
        if (!this.scene.enemies || !this.debugMode) return;
        
        // 몬스터 디버그 정보를 저장할 배열 초기화
        this.enemyDebugBoxes = [];
        this.enemyDebugTexts = [];
        
        // 타이머 초기화해서 즉시 업데이트되도록 함
        this.lastEnemyDebugUpdate = 0;
        this.updateEnemyDebugBoxes();
    }
    
    /**
     * 몬스터 디버그 박스 업데이트 (시야 범위 내 몬스터만)
     */
    updateEnemyDebugBoxes() {
        if (!this.debugMode || !this.scene.enemies) return;
        
        // 기존 디버그 정보 제거
        this.destroyEnemyDebugBoxes();
        
        // 몬스터 디버그 정보를 저장할 배열 초기화
        this.enemyDebugBoxes = [];
        this.enemyDebugTexts = [];
        
        const enemies = this.scene.enemies.getChildren();
        
        // 디버그 시야 범위 (일반 시야 범위보다 넓게 설정)
        const debugVisionRange = this.visionRange * 1.5;
        const debugVisionRangeSquared = debugVisionRange * debugVisionRange; // 제곱근 계산 최적화
        
        let visibleEnemyCount = 0;
        let totalEnemyCount = 0;
        
        enemies.forEach((enemy, index) => {
            if (!enemy.active) return;
            
            totalEnemyCount++;
            
            // 플레이어와 몬스터 간의 거리 계산 (제곱근 생략으로 성능 최적화)
            const dx = enemy.x - this.x;
            const dy = enemy.y - this.y;
            const distanceSquared = dx * dx + dy * dy;
            
            // 시야 범위 내에 있는지 확인
            if (distanceSquared > debugVisionRangeSquared) {
                return; // 시야 범위 밖이면 스킵
            }
            
            visibleEnemyCount++;
            
            // 몬스터 스프라이트 크기 박스 (녹색)
            const spriteBox = this.scene.add.graphics();
            spriteBox.lineStyle(2, 0x00ff00);
            spriteBox.setDepth(1000);
            const spriteX = enemy.x - enemy.displayWidth / 2;
            const spriteY = enemy.y - enemy.displayHeight / 2;
            spriteBox.strokeRect(spriteX, spriteY, enemy.displayWidth, enemy.displayHeight);
            
            // 몬스터 물리 바디 크기 박스 (주황색)
            const bodyBox = this.scene.add.graphics();
            bodyBox.lineStyle(2, 0xff8800);
            bodyBox.setDepth(1001);
            if (enemy.body) {
                bodyBox.strokeRect(enemy.body.x, enemy.body.y, enemy.body.width, enemy.body.height);
            }

            // 몬스터 어그로 범위 원 (연한 빨간색)
            const aggroRange = 300; // MonsterConfig.COMMON_CONFIG.AGGRO_RANGE
            const aggroCircle = this.scene.add.graphics();
            aggroCircle.lineStyle(2, 0xff4444, 0.6);
            aggroCircle.setDepth(999); // 다른 요소들보다 뒤에 표시
            aggroCircle.strokeCircle(enemy.x, enemy.y, aggroRange);

            // 몬스터 어그로 해제 범위 원 (연한 오렌지색)
            const maxAggroRange = 600; // MonsterConfig.COMMON_CONFIG.MAX_AGGRO_RANGE
            const maxAggroCircle = this.scene.add.graphics();
            maxAggroCircle.lineStyle(2, 0xff8844, 0.4);
            maxAggroCircle.setDepth(998); // 어그로 범위보다 더 뒤에 표시
            maxAggroCircle.strokeCircle(enemy.x, enemy.y, maxAggroRange);
            
            // 몬스터 정보 텍스트
            const spriteInfo = `스프라이트: ${enemy.displayWidth}x${enemy.displayHeight}`;
            const bodyInfo = enemy.body ? `물리바디: ${enemy.body.width}x${enemy.body.height}` : '물리바디: 없음';
            const statsInfo = `HP: ${enemy.hp}/${enemy.maxHp}`;
            const attackInfo = `공격력: ${enemy.attack}`;
            const typeInfo = `타입: ${enemy.type}`;
            const distanceInfo = `거리: ${Math.round(Math.sqrt(distanceSquared))}`;
            const aggroInfo = `어그로: ${aggroRange} / 해제: ${maxAggroRange}`;
            const debugInfo = `${spriteInfo}\n${bodyInfo}\n${statsInfo}\n${attackInfo}\n${typeInfo}\n${distanceInfo}\n${aggroInfo}`;
            
            const debugText = this.scene.add.text(enemy.x + 50, enemy.y - 60, debugInfo, {
                fontSize: '10px',
                fill: '#ffffff',
                backgroundColor: '#000000',
                padding: { x: 4, y: 4 }
            }).setOrigin(0);
            debugText.setDepth(1002);
            
            // 배열에 저장
            this.enemyDebugBoxes.push(spriteBox, bodyBox, aggroCircle, maxAggroCircle);
            this.enemyDebugTexts.push(debugText);
        });
        
        // 성능 정보 로그 (가끔씩만 출력)
        if (totalEnemyCount > 0 && Math.random() < 0.1) { // 10% 확률로만 로그 출력
            console.log(`디버그 몬스터: ${visibleEnemyCount}/${totalEnemyCount} (시야범위: ${Math.round(debugVisionRange)})`);
        }
    }
    
    /**
     * 몬스터 디버그 박스 제거
     */
    destroyEnemyDebugBoxes() {
        if (this.enemyDebugBoxes) {
            this.enemyDebugBoxes.forEach(box => {
                if (box && box.active) {
                    box.destroy();
                }
            });
            this.enemyDebugBoxes = [];
        }
        
        if (this.enemyDebugTexts) {
            this.enemyDebugTexts.forEach(text => {
                if (text && text.active) {
                    text.destroy();
                }
            });
            this.enemyDebugTexts = [];
        }
    }

    /**
     * 정리 작업
     */
    destroy() {
        this.destroyDebugBoxes();
        this.destroyEnemyDebugBoxes();
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
        
        if (this.healthBar) {
            this.healthBar.destroy();
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